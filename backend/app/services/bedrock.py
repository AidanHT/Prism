"""Shared Bedrock client and typed helper functions.

All Bedrock API calls in the application must go through this module.
"""

import json
from typing import Any

import boto3
from mypy_boto3_bedrock_runtime import BedrockRuntimeClient

from app.core.config import settings

_client: BedrockRuntimeClient | None = None


def get_bedrock_client() -> BedrockRuntimeClient:
    """Return a lazily-initialised Bedrock runtime client (singleton)."""
    global _client
    if _client is None:
        _client = boto3.client(  # type: ignore[assignment]
            "bedrock-runtime",
            region_name=settings.AWS_REGION,
        )
    return _client


def invoke_model(
    *,
    model_id: str,
    messages: list[dict[str, Any]],
    system: str | None = None,
    max_tokens: int = 2048,
    temperature: float = 0.7,
) -> str:
    """Invoke a Bedrock model using the Converse API and return the text response.

    Args:
        model_id: Bedrock model identifier (use constants from Settings).
        messages: List of conversation turns in Converse API format.
        system: Optional system prompt string.
        max_tokens: Maximum tokens to generate.
        temperature: Sampling temperature.

    Returns:
        The assistant's text reply.
    """
    client = get_bedrock_client()

    request: dict[str, Any] = {
        "modelId": model_id,
        "messages": messages,
        "inferenceConfig": {
            "maxTokens": max_tokens,
            "temperature": temperature,
        },
    }

    if system is not None:
        request["system"] = [{"text": system}]

    response = client.converse(**request)
    output: str = response["output"]["message"]["content"][0]["text"]
    return output


def invoke_model_complex(
    *,
    messages: list[dict[str, Any]],
    system: str | None = None,
    max_tokens: int = 4096,
    temperature: float = 0.7,
) -> str:
    """Invoke Claude Opus 4.6 for complex agentic tasks (grading, deep reasoning)."""
    return invoke_model(
        model_id=settings.BEDROCK_MODEL_COMPLEX,
        messages=messages,
        system=system,
        max_tokens=max_tokens,
        temperature=temperature,
    )


def invoke_model_fast(
    *,
    messages: list[dict[str, Any]],
    system: str | None = None,
    max_tokens: int = 1024,
    temperature: float = 0.5,
) -> str:
    """Invoke Claude Haiku 4.5 for high-volume, low-latency tasks."""
    return invoke_model(
        model_id=settings.BEDROCK_MODEL_FAST,
        messages=messages,
        system=system,
        max_tokens=max_tokens,
        temperature=temperature,
    )
