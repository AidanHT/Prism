"""SQLAlchemy declarative base shared by all ORM models."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Project-wide declarative base.

    All ORM model classes must inherit from this base so that Alembic
    can discover them for auto-generated migrations.
    """
