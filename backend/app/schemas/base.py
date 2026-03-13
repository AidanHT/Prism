"""Shared Pydantic v2 base models for request/response validation."""

from pydantic import BaseModel, ConfigDict


class AppBaseModel(BaseModel):
    """Project-wide Pydantic base.

    All schema models inherit from this to enforce consistent serialisation
    behaviour (e.g., populate_by_name, from_attributes for ORM mode).
    """

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
    )


class OkResponse(AppBaseModel):
    """Generic success response carrying a human-readable message."""

    message: str


class ErrorDetail(AppBaseModel):
    """Structured error detail returned in error responses."""

    code: str
    detail: str
