"""LangGraph-based AI grading evaluation pipeline.

The pipeline is a three-node state graph:

  extraction → evaluation → validation → END

- extraction : Downloads the submission file from S3 (or uses the inline body)
               and extracts plain text via Amazon Textract.
- evaluation : Sends the text + rubric to Claude Opus 4.6 via Amazon Bedrock
               and stores the raw JSON response.
- validation : Parses and validates the raw response with Pydantic v2,
               producing a typed EvaluationResult.
"""
from __future__ import annotations

import asyncio
import json
import operator
import re
from typing import Annotated, Any
from urllib.parse import urlparse

import boto3
from langgraph.graph import END, StateGraph
from typing_extensions import TypedDict

from app.core.config import settings
from app.models.rubric import Rubric
from app.schemas.grading import CriterionScore, EvaluationResult
from app.services.bedrock import invoke_model_complex
from app.services.textract import extract_text_from_bytes, extract_text_from_s3_pdf, is_pdf

# ── State schema ──────────────────────────────────────────────────────────────


class GradingState(TypedDict):
    """Shared state passed between evaluation pipeline nodes.

    Primary fields (per spec):
        submission_file_url  – S3 URL of the uploaded file (or None).
        extracted_text       – Plain text extracted from the submission.
        rubric               – Serialised rubric fed to the LLM prompt.
        evaluation_result    – Validated EvaluationResult (set by validation node).
        errors               – Accumulated error messages (appended across nodes).

    Supplementary fields:
        submission_body      – Inline text for text-only submissions.
        evaluation_raw       – Raw LLM JSON string passed from evaluation → validation.
    """

    submission_file_url: str | None
    submission_body: str | None
    extracted_text: str
    rubric: str
    evaluation_raw: str
    evaluation_result: EvaluationResult | None
    # operator.add reducer accumulates error lists across nodes automatically.
    errors: Annotated[list[str], operator.add]


# ── Evaluation system prompt ──────────────────────────────────────────────────

_EVALUATE_SYSTEM = """\
You are an expert university-level grader evaluating a student submission against a rubric.

Respond ONLY with a valid JSON object matching this exact schema – no prose, no markdown fences:
{
  "suggested_total_score": <total score as float>,
  "criterion_breakdown": [
    {"criterion_id": "<criterion UUID>", "score": <points awarded as float>}
  ],
  "constructive_feedback": "<3–5 sentences of specific, encouraging feedback for the student>"
}

Rules:
- suggested_total_score must equal the sum of all criterion scores.
- Each criterion score must be >= 0 and <= the criterion's max points.
- Use the exact criterion_id values shown in the rubric (they are UUIDs).
- constructive_feedback must reference specific content from the submission.
- Output ONLY the JSON object. No explanation, no markdown code fences.
"""


# ── S3 helpers ────────────────────────────────────────────────────────────────

_s3_client: Any = None


def _get_s3_client() -> Any:
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client("s3", region_name=settings.AWS_REGION)
    return _s3_client


def _parse_s3_url(url: str) -> tuple[str, str]:
    """Return *(bucket, key)* from any common S3 URL format.

    Handles:
    - ``s3://bucket/key``
    - ``https://bucket.s3.amazonaws.com/key``
    - ``https://s3.amazonaws.com/bucket/key``
    """
    parsed = urlparse(url)
    if parsed.scheme == "s3":
        return parsed.netloc, parsed.path.lstrip("/")
    if ".s3." in parsed.netloc:
        bucket = parsed.netloc.split(".s3.")[0]
        return bucket, parsed.path.lstrip("/")
    # https://s3.amazonaws.com/bucket/key
    parts = parsed.path.lstrip("/").split("/", 1)
    return parts[0], parts[1]


def _download_from_s3_sync(url: str) -> tuple[bytes, str, str]:
    """Blocking S3 download.  Returns *(file_bytes, content_type, filename)*."""
    bucket, key = _parse_s3_url(url)
    response = _get_s3_client().get_object(Bucket=bucket, Key=key)
    file_bytes: bytes = response["Body"].read()
    content_type: str = response.get("ContentType", "application/octet-stream")
    filename: str = key.split("/")[-1]
    return file_bytes, content_type, filename


# ── Pipeline nodes ────────────────────────────────────────────────────────────


async def extraction_node(state: GradingState) -> dict[str, Any]:
    """Node 1 – Extract plain text from the student submission.

    If a ``submission_body`` is present (text-only submission) it is used
    directly.  Otherwise the file at ``submission_file_url`` is downloaded
    from S3 and processed through Amazon Textract.
    """
    body = state.get("submission_body")
    if body:
        return {"extracted_text": body}

    file_url = state.get("submission_file_url")
    if not file_url:
        return {
            "errors": ["No submission content: both file_url and body are absent."],
            "extracted_text": "",
        }

    try:
        file_bytes, content_type, filename = await asyncio.to_thread(
            _download_from_s3_sync, file_url
        )
        if is_pdf(content_type, filename):
            # Multi-page PDFs must go through the async Textract job API.
            # Pass the S3 reference directly — no need to hold the file bytes
            # in memory during extraction.
            bucket, key = _parse_s3_url(file_url)
            text: str = await asyncio.to_thread(extract_text_from_s3_pdf, bucket, key)
        else:
            text = await asyncio.to_thread(
                extract_text_from_bytes,
                file_bytes,
                content_type=content_type,
                filename=filename,
            )
        return {"extracted_text": text}
    except Exception as exc:  # noqa: BLE001
        return {
            "errors": [f"Text extraction failed: {exc}"],
            "extracted_text": "",
        }


async def evaluation_node(state: GradingState) -> dict[str, Any]:
    """Node 2 – Call Amazon Bedrock (Claude Opus 4.6) to evaluate the submission.

    Skips gracefully if the extraction node encountered errors.
    """
    if not state.get("extracted_text"):
        return {"errors": ["Evaluation skipped: no extracted text available."]}

    prompt = (
        f"Rubric:\n{state['rubric']}\n\n"
        f"Student Submission:\n{state['extracted_text']}\n\n"
        "Evaluate this student submission against the rubric and provide structured feedback."
    )

    try:
        raw: str = await asyncio.to_thread(
            invoke_model_complex,
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            system=_EVALUATE_SYSTEM,
            max_tokens=2048,
            temperature=0.2,
        )
        return {"evaluation_raw": raw}
    except Exception as exc:  # noqa: BLE001
        exc_str = str(exc).lower()
        if "throttl" in exc_str:
            msg = "Bedrock request was throttled – please retry in a few seconds."
        else:
            msg = f"Bedrock invocation failed: {exc}"
        return {"errors": [msg]}


async def validation_node(state: GradingState) -> dict[str, Any]:
    """Node 3 – Validate the raw LLM output with Pydantic v2.

    Extracts the first JSON object from the response string (defensive against
    accidental preamble) and constructs a typed ``EvaluationResult``.
    """
    raw = state.get("evaluation_raw", "")
    if not raw:
        return {"evaluation_result": None}

    try:
        match = re.search(r"\{[\s\S]*\}", raw)
        json_str = match.group(0) if match else raw.strip()
        data: dict[str, Any] = json.loads(json_str)

        breakdown = [
            CriterionScore(
                criterion_id=str(item["criterion_id"]),
                score=float(item["score"]),
            )
            for item in data["criterion_breakdown"]
        ]
        result = EvaluationResult(
            suggested_total_score=float(data["suggested_total_score"]),
            criterion_breakdown=breakdown,
            constructive_feedback=str(data["constructive_feedback"]),
        )
        return {"evaluation_result": result}
    except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        return {
            "errors": [f"LLM output failed Pydantic validation: {exc}"],
            "evaluation_result": None,
        }


# ── Graph assembly ────────────────────────────────────────────────────────────

_workflow: StateGraph = StateGraph(GradingState)
_workflow.add_node("extraction", extraction_node)
_workflow.add_node("evaluation", evaluation_node)
_workflow.add_node("validation", validation_node)

_workflow.set_entry_point("extraction")
_workflow.add_edge("extraction", "evaluation")
_workflow.add_edge("evaluation", "validation")
_workflow.add_edge("validation", END)

grading_graph = _workflow.compile()


# ── Public helper ─────────────────────────────────────────────────────────────


def format_rubric_for_evaluation(rubric: Rubric) -> str:
    """Serialise a ``Rubric`` ORM object as structured text for the Bedrock prompt.

    Each criterion is listed with its UUID so that the LLM can reference them
    exactly in the ``criterion_breakdown`` output field.
    """
    lines: list[str] = [f"Rubric Title: {rubric.title}", ""]
    for criterion in rubric.criteria:
        lines.append(f"Criterion ID: {criterion.id}")
        lines.append(f"Description: {criterion.description}")
        lines.append(f"Max Points: {criterion.points}")
        lines.append("Rating Levels:")
        for rating in criterion.ratings:
            lines.append(
                f"  - {rating.get('description', '')} ({rating.get('points', 0)} pts)"
            )
        lines.append("")
    return "\n".join(lines)


async def run_grading_pipeline(
    *,
    submission_file_url: str | None,
    submission_body: str | None,
    rubric_text: str,
) -> GradingState:
    """Run the full evaluation pipeline and return the final state.

    Args:
        submission_file_url: S3 URL of the uploaded submission file, or ``None``.
        submission_body:     Inline text for text-only submissions, or ``None``.
        rubric_text:         Pre-formatted rubric string (from
                             :func:`format_rubric_for_evaluation`).

    Returns:
        The completed :class:`GradingState` with ``evaluation_result`` populated
        on success or ``errors`` populated on failure.
    """
    initial_state: GradingState = {
        "submission_file_url": submission_file_url,
        "submission_body": submission_body,
        "extracted_text": "",
        "rubric": rubric_text,
        "evaluation_raw": "",
        "evaluation_result": None,
        "errors": [],
    }
    result: GradingState = await grading_graph.ainvoke(initial_state)  # type: ignore[assignment]
    return result
