"""Add sharing and per-user paper state tables.

Revision ID: add_sharing_tables
Revises: backfill_rs_user_id
Create Date: 2026-04-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "add_sharing_tables"
down_revision: Union[str, None] = "backfill_rs_user_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  share_permission = postgresql.ENUM(
    "viewer", "editor", name="sharepermission", create_type=False
  )
  share_permission.create(op.get_bind(), checkfirst=True)

  reading_status = postgresql.ENUM(
    "not_started",
    "in_progress",
    "read",
    "archived",
    name="readingstatus",
    create_type=False,
  )
  priority_level = postgresql.ENUM(
    "low", "medium", "high", "critical", name="prioritylevel", create_type=False
  )

  op.create_table(
    "user_paper_state",
    sa.Column(
      "user_id",
      sa.Integer(),
      sa.ForeignKey("users.id", ondelete="CASCADE"),
      nullable=False,
    ),
    sa.Column(
      "paper_id",
      sa.Integer(),
      sa.ForeignKey("papers.id", ondelete="CASCADE"),
      nullable=False,
    ),
    sa.Column(
      "reading_status",
      reading_status,
      nullable=False,
      server_default="not_started",
    ),
    sa.Column(
      "priority",
      priority_level,
      nullable=False,
      server_default="low",
    ),
    sa.Column("reading_time_minutes", sa.Integer(), nullable=False, server_default="0"),
    sa.Column("last_read_page", sa.Integer(), nullable=True),
    sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=True),
    sa.Column("status_updated_at", sa.DateTime(timezone=True), nullable=True),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint("user_id", "paper_id"),
  )

  op.create_table(
    "paper_shares",
    sa.Column("id", sa.Integer(), primary_key=True),
    sa.Column(
      "paper_id",
      sa.Integer(),
      sa.ForeignKey("papers.id", ondelete="CASCADE"),
      nullable=False,
    ),
    sa.Column(
      "recipient_id",
      sa.Integer(),
      sa.ForeignKey("users.id", ondelete="CASCADE"),
      nullable=False,
    ),
    sa.Column(
      "shared_by_id",
      sa.Integer(),
      sa.ForeignKey("users.id", ondelete="SET NULL"),
      nullable=True,
    ),
    sa.Column(
      "permission",
      share_permission,
      nullable=False,
      server_default="viewer",
    ),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    sa.UniqueConstraint(
      "paper_id", "recipient_id", name="uq_paper_shares_paper_recipient"
    ),
  )
  op.create_index("idx_paper_shares_recipient_id", "paper_shares", ["recipient_id"])

  op.create_table(
    "group_shares",
    sa.Column("id", sa.Integer(), primary_key=True),
    sa.Column(
      "group_id",
      sa.Integer(),
      sa.ForeignKey("groups.id", ondelete="CASCADE"),
      nullable=False,
    ),
    sa.Column(
      "recipient_id",
      sa.Integer(),
      sa.ForeignKey("users.id", ondelete="CASCADE"),
      nullable=False,
    ),
    sa.Column(
      "shared_by_id",
      sa.Integer(),
      sa.ForeignKey("users.id", ondelete="SET NULL"),
      nullable=True,
    ),
    sa.Column(
      "permission",
      share_permission,
      nullable=False,
      server_default="viewer",
    ),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    sa.UniqueConstraint(
      "group_id", "recipient_id", name="uq_group_shares_group_recipient"
    ),
  )
  op.create_index("idx_group_shares_recipient_id", "group_shares", ["recipient_id"])


def downgrade() -> None:
  op.drop_index("idx_group_shares_recipient_id", table_name="group_shares")
  op.drop_table("group_shares")
  op.drop_index("idx_paper_shares_recipient_id", table_name="paper_shares")
  op.drop_table("paper_shares")
  op.drop_table("user_paper_state")

  share_permission = sa.Enum("viewer", "editor", name="sharepermission")
  share_permission.drop(op.get_bind(), checkfirst=True)
