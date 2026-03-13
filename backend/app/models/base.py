"""Re-exports Base and TimestampMixin from app.db.base for backward compatibility."""
from app.db.base import Base, TimestampMixin

__all__ = ["Base", "TimestampMixin"]
