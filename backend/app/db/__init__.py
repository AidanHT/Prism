"""Database package.

Import Base and TimestampMixin from here; import session utilities directly
from app.db.session to avoid loading the engine/settings at model import time.
"""
from app.db.base import Base, TimestampMixin

__all__ = ["Base", "TimestampMixin"]
