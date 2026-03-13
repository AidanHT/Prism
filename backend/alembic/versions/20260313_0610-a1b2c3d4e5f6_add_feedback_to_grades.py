"""Add feedback column to grades table.

Revision ID: a1b2c3d4e5f6
Revises: 7d2d09b82c53
Create Date: 2026-03-13 06:10:00.000000+00:00

Rationale: SpeedGrader collects rich-text instructor feedback via TipTap.
The feedback HTML must be persisted on the grade record so it survives
page refreshes and can be surfaced to students after grade publication.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str = "7d2d09b82c53"
branch_labels: None = None
depends_on: None = None


def upgrade() -> None:
    op.add_column("grades", sa.Column("feedback", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("grades", "feedback")
