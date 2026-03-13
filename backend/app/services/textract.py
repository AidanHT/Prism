"""Amazon Textract helper for extracting plain text from uploaded documents.

All Textract calls in the application should go through this module so the
client is initialised once and the extraction logic stays testable.

Single-page images use the synchronous ``detect_document_text`` API (inline
bytes).  Multi-page PDFs require the asynchronous job API
(``start_document_text_detection`` → ``get_document_text_detection``) which
takes an S3 reference rather than inline bytes.
"""
from __future__ import annotations

import time

import boto3
from mypy_boto3_textract import TextractClient

from app.core.config import settings

_TEXT_EXTENSIONS = frozenset({".txt", ".md", ".py", ".js", ".ts", ".csv"})
_PDF_CONTENT_TYPES = frozenset({"application/pdf"})

# Maximum number of 2-second poll intervals before giving up (~5 minutes).
_TEXTRACT_POLL_LIMIT = 150

_client: TextractClient | None = None


def get_textract_client() -> TextractClient:
    """Return a lazily-initialised Textract client (singleton)."""
    global _client
    if _client is None:
        _client = boto3.client(
            "textract",
            region_name=settings.AWS_REGION,
        )
    return _client


def extract_text_from_bytes(
    file_bytes: bytes,
    *,
    content_type: str,
    filename: str,
) -> str:
    """Return the plain-text content of an uploaded file.

    For plain-text files (identified by MIME type or extension) the bytes are
    decoded directly.  For PDFs and images, Amazon Textract
    ``detect_document_text`` is called with the raw bytes so that handwritten
    and printed content is both captured.

    Args:
        file_bytes: Raw file contents.
        content_type: MIME type reported by the HTTP client.
        filename: Original filename (used as a fallback for extension lookup).

    Returns:
        Extracted text as a single string.
    """
    suffix = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    is_plain_text = content_type.startswith("text/") or suffix in _TEXT_EXTENSIONS

    if is_plain_text:
        return file_bytes.decode("utf-8", errors="replace")

    client = get_textract_client()
    response = client.detect_document_text(Document={"Bytes": file_bytes})
    lines: list[str] = [
        block["Text"]
        for block in response.get("Blocks", [])
        if block.get("BlockType") == "LINE" and "Text" in block
    ]
    return "\n".join(lines)


def extract_text_from_s3_pdf(bucket: str, key: str) -> str:
    """Extract text from a multi-page PDF stored in S3.

    Uses the Textract asynchronous job API
    (``start_document_text_detection`` → ``get_document_text_detection``)
    which supports documents with any number of pages.  The S3 object is
    referenced directly so the file does **not** need to be downloaded to
    memory first.

    Args:
        bucket: S3 bucket name.
        key:    S3 object key.

    Returns:
        All extracted text joined by newlines, preserving page order.

    Raises:
        RuntimeError:  If Textract reports ``FAILED`` status.
        TimeoutError:  If the job does not complete within ~5 minutes.
    """
    client = get_textract_client()

    start_resp = client.start_document_text_detection(
        DocumentLocation={"S3Object": {"Bucket": bucket, "Name": key}}
    )
    job_id: str = start_resp["JobId"]

    # Poll until the job finishes.
    poll: dict = {}
    for _ in range(_TEXTRACT_POLL_LIMIT):
        poll = client.get_document_text_detection(JobId=job_id)  # type: ignore[assignment]
        status: str = poll["JobStatus"]
        if status == "SUCCEEDED":
            break
        if status == "FAILED":
            raise RuntimeError(
                f"Textract async job failed for s3://{bucket}/{key}: "
                f"{poll.get('StatusMessage', 'no details')}"
            )
        time.sleep(2)
    else:
        raise TimeoutError(
            f"Textract async job for s3://{bucket}/{key} did not complete "
            "within 5 minutes."
        )

    # Paginate through all result pages to collect every LINE block.
    all_blocks: list[dict] = list(poll.get("Blocks", []))
    next_token: str | None = poll.get("NextToken")
    while next_token:
        poll = client.get_document_text_detection(JobId=job_id, NextToken=next_token)  # type: ignore[assignment]
        all_blocks.extend(poll.get("Blocks", []))
        next_token = poll.get("NextToken")

    lines: list[str] = [
        block["Text"]
        for block in all_blocks
        if block.get("BlockType") == "LINE" and "Text" in block
    ]
    return "\n".join(lines)


def is_pdf(content_type: str, filename: str) -> bool:
    """Return True when the file is identified as a PDF by MIME type or extension."""
    suffix = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return content_type in _PDF_CONTENT_TYPES or suffix == ".pdf"
