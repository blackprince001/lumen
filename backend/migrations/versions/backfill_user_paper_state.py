"""Backfill per-user paper state from owner paper rows.

Revision ID: backfill_user_paper_state
Revises: add_sharing_tables
Create Date: 2026-04-21
"""

from typing import Sequence, Union

from alembic import op

revision: str = "backfill_user_paper_state"
down_revision: Union[str, None] = "add_sharing_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  op.execute("""
    INSERT INTO user_paper_state (
      user_id, paper_id, reading_status, priority,
      reading_time_minutes, last_read_page, last_read_at,
      status_updated_at, created_at, updated_at
    )
    SELECT
      uploaded_by_id, id, reading_status, priority,
      COALESCE(reading_time_minutes, 0), last_read_page, last_read_at,
      status_updated_at, NOW(), NOW()
    FROM papers
    WHERE uploaded_by_id IS NOT NULL
    ON CONFLICT (user_id, paper_id) DO NOTHING
  """)


def downgrade() -> None:
  pass
