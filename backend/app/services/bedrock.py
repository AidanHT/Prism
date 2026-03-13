"""Shared Bedrock client and typed helper functions.

All Bedrock API calls in the application must go through this module.
"""

import asyncio
import threading
from collections.abc import AsyncIterator
from typing import Any

import boto3
from mypy_boto3_bedrock_runtime import BedrockRuntimeClient

from app.core.config import settings

_client: BedrockRuntimeClient | None = None


def get_bedrock_client() -> BedrockRuntimeClient:
    """Return a lazily-initialised Bedrock runtime client (singleton)."""
    global _client
    if _client is None:
        _client = boto3.client(
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


async def invoke_model_stream_async(
    *,
    model_id: str,
    messages: list[dict[str, Any]],
    system: str | None = None,
    max_tokens: int = 2048,
    temperature: float = 0.7,
) -> AsyncIterator[str]:
    """Stream text tokens from a Bedrock model via the converse_stream API.

    Runs the blocking Boto3 call on a daemon thread and bridges chunks to the
    async caller through an ``asyncio.Queue``, preserving true token-by-token
    streaming without stalling the event loop.

    Yields:
        Individual text delta strings as they arrive from the model.
    """
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[str | None] = asyncio.Queue()

    def _run_stream() -> None:
        try:
            client = get_bedrock_client()
            request: dict[str, Any] = {
                "modelId": model_id,
                "messages": messages,
                "inferenceConfig": {"maxTokens": max_tokens, "temperature": temperature},
            }
            if system is not None:
                request["system"] = [{"text": system}]

            response = client.converse_stream(**request)
            for event in response["stream"]:
                if "contentBlockDelta" in event:
                    delta = event["contentBlockDelta"]["delta"]
                    if "text" in delta:
                        loop.call_soon_threadsafe(queue.put_nowait, delta["text"])
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, None)  # sentinel

    threading.Thread(target=_run_stream, daemon=True).start()

    while True:
        chunk = await queue.get()
        if chunk is None:
            break
        yield chunk


async def invoke_model_complex_stream_async(
    *,
    messages: list[dict[str, Any]],
    system: str | None = None,
    max_tokens: int = 4096,
    temperature: float = 0.7,
) -> AsyncIterator[str]:
    """Stream tokens from Claude Opus 4.6 for complex agentic tasks."""
    async for chunk in invoke_model_stream_async(
        model_id=settings.BEDROCK_MODEL_COMPLEX,
        messages=messages,
        system=system,
        max_tokens=max_tokens,
        temperature=temperature,
    ):
        yield chunk


async def invoke_model_fast_stream_async(
    *,
    messages: list[dict[str, Any]],
    system: str | None = None,
    max_tokens: int = 1024,
    temperature: float = 0.5,
) -> AsyncIterator[str]:
    """Stream tokens from Claude Haiku 4.5 for high-volume, low-latency tasks."""
    async for chunk in invoke_model_stream_async(
        model_id=settings.BEDROCK_MODEL_FAST,
        messages=messages,
        system=system,
        max_tokens=max_tokens,
        temperature=temperature,
    ):
        yield chunk
