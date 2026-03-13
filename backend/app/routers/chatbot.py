"""Chatbot microservice router.

Handles RAG-based course chatbot sessions powered by Bedrock.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/chatbot", tags=["chatbot"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "chatbot"}
