"""Drop per-user reading state columns from papers.

Revision ID: drop_paper_per_user_columns
Revises: backfill_user_paper_state
Create Date: 2026-04-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "drop_paper_per_user_columns"
down_revision: Union[str, None] = "backfill_user_paper_state"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  op.drop_column("papers", "reading_status")
  op.drop_column("papers", "priority")
  op.drop_column("papers", "reading_time_minutes")
  op.drop_column("papers", "last_read_page")
  op.drop_column("papers", "last_read_at")
  op.drop_column("papers", "status_updated_at")


def downgrade() -> None:
  op.add_column(
    "papers",
    sa.Column(
      "status_updated_at",
      sa.DateTime(timezone=True),
      nullable=True,
    ),
  )
  op.add_column(
    "papers",
    sa.Column(
      "last_read_at",
      sa.DateTime(timezone=True),
      nullable=True,
    ),
  )
  op.add_column(
    "papers",
    sa.Column(
      "last_read_page",
      sa.Integer(),
      nullable=True,
    ),
  )
  op.add_column(
    "papers",
    sa.Column(
      "reading_time_minutes",
      sa.Integer(),
      nullable=False,
      server_default="0",
    ),
  )
  op.add_column(
    "papers",
    sa.Column(
      "priority",
      sa.Enum("low", "medium", "high", "critical", name="prioritylevel"),
      nullable=False,
      server_default="low",
    ),
  )
  op.add_column(
    "papers",
    sa.Column(
      "reading_status",
      sa.Enum("not_started", "in_progress", "read", "archived", name="readingstatus"),
      nullable=False,
      server_default="not_started",
    ),
  )

  op.execute("""
    UPDATE papers p
    SET
      reading_status = ups.reading_status,
      priority = ups.priority,
      reading_time_minutes = ups.reading_time_minutes,
      last_read_page = ups.last_read_page,
      last_read_at = ups.last_read_at,
      status_updated_at = ups.status_updated_at
    FROM user_paper_state ups
    WHERE ups.paper_id = p.id
      AND ups.user_id = p.uploaded_by_id
  """)
