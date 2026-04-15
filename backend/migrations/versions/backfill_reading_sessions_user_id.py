"""Backfill reading_sessions.user_id from NULL rows.

Revision ID: backfill_rs_user_id
Revises: add_user_id_to_tags
Create Date: 2026-04-14
"""

from typing import Sequence, Union

from alembic import op

revision: str = "backfill_rs_user_id"
down_revision: Union[str, None] = "add_user_id_to_tags"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  # Backfill NULL user_id rows to the first admin user (if any)
  op.execute("""
    UPDATE reading_sessions
    SET user_id = (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1)
    WHERE user_id IS NULL
      AND EXISTS (SELECT 1 FROM users WHERE role = 'admin')
  """)


def downgrade() -> None:
  pass  # Backfill is non-destructive; no rollback needed
