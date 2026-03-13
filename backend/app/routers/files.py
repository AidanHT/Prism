"""Files microservice router.

Implements a two-step S3 upload flow:
  1. POST /files/upload_url  → server returns a presigned POST URL + S3 key.
  2. Client uploads directly to S3 using the presigned URL.
  3. POST /files/confirm      → client confirms success; server saves the
     CourseFile record to PostgreSQL.
"""
from __future__ import annotations

from uuid import UUID

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db
from app.core.config import settings
from app.models.content import CourseFile
from app.models.user import User
from app.schemas.base import AppBaseModel
from app.schemas.content import CourseFileCreate, CourseFileResponse

router = APIRouter(prefix="/files", tags=["files"])

# Maximum upload size enforced in the presigned policy: 100 MB.
_MAX_FILE_BYTES = 100 * 1024 * 1024
# Presigned URL validity window.
_PRESIGNED_TTL_SECONDS = 900  # 15 minutes


def _s3_client() -> "boto3.client":
    """Construct a Boto3 S3 client from validated settings."""
    return boto3.client(
        "s3",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
    )


# ── Local request / response schemas ─────────────────────────────────────────

class UploadUrlRequest(AppBaseModel):
    """Parameters needed to generate the presigned POST URL."""

    course_id: UUID
    filename: str = Field(..., min_length=1, max_length=255)
    content_type: str = Field(..., max_length=255)
    folder_path: str = Field("/", max_length=1024)


class UploadUrlResponse(AppBaseModel):
    """
    Contains the presigned POST ``url`` and ``fields`` that the browser must
    include when uploading directly to S3, plus the ``s3_key`` to pass to
    ``POST /files/confirm`` after a successful upload.
    """

    url: str
    fields: dict[str, str]
    s3_key: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/upload_url", response_model=UploadUrlResponse)
async def get_upload_url(
    payload: UploadUrlRequest,
    current_user: User = Depends(get_current_user),
) -> UploadUrlResponse:
    """
    Generate an S3 presigned POST URL for direct browser-to-S3 upload.

    The client should:
      1. Submit a multipart ``POST`` to ``url`` using the returned ``fields``
         as form fields alongside the file data.
      2. On HTTP 2xx from S3, call ``POST /files/confirm`` with the ``s3_key``
         and file metadata to persist the record in PostgreSQL.
    """
    # Normalise folder path and build the S3 key.
    folder = payload.folder_path.strip("/")
    s3_key = f"courses/{payload.course_id}/{folder}/{payload.filename}"
    # Collapse any double slashes that could result from an empty folder.
    while "//" in s3_key:
        s3_key = s3_key.replace("//", "/")

    try:
        presigned: dict[str, object] = _s3_client().generate_presigned_post(
            Bucket=settings.S3_FILES_BUCKET,
            Key=s3_key,
            Fields={"Content-Type": payload.content_type},
            Conditions=[
                {"Content-Type": payload.content_type},
                ["content-length-range", 1, _MAX_FILE_BYTES],
            ],
            ExpiresIn=_PRESIGNED_TTL_SECONDS,
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not generate upload URL: {exc}",
        ) from exc

    return UploadUrlResponse(
        url=str(presigned["url"]),
        fields={k: str(v) for k, v in presigned["fields"].items()},  # type: ignore[union-attr]
        s3_key=s3_key,
    )


@router.post(
    "/confirm",
    response_model=CourseFileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def confirm_upload(
    payload: CourseFileCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CourseFile:
    """
    Persist a ``CourseFile`` record in PostgreSQL after a successful S3 upload.

    The client must provide the same ``s3_key`` returned by ``/upload_url``
    and the actual ``size_bytes`` reported by S3 or the browser ``File`` API.
    """
    file_record = CourseFile(**payload.model_dump())
    db.add(file_record)
    try:
        await db.flush()
        await db.refresh(file_record)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A file record with that S3 key already exists.",
        ) from exc
    return file_record
