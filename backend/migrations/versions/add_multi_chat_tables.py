"""add multi-chat tables for group/selection-based AI conversations

Revision ID: add_multi_chat_001
Revises: remove_unused_discovery_tables
Create Date: 2026-03-08 18:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_multi_chat_001"
down_revision: Union[str, Sequence[str], None] = "remove_unused_discovery_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  """Create multi-chat tables."""
  # Create multi_chat_sessions table
  op.create_table(
    "multi_chat_sessions",
    sa.Column("id", sa.Integer(), nullable=False),
    sa.Column("name", sa.String(), server_default="New Session", nullable=False),
    sa.Column("group_id", sa.Integer(), nullable=True),
    sa.Column(
      "created_at",
      sa.DateTime(timezone=True),
      nullable=False,
      server_default=sa.func.now(),
    ),
    sa.Column(
      "updated_at",
      sa.DateTime(timezone=True),
      nullable=False,
      server_default=sa.func.now(),
    ),
    sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="SET NULL"),
    sa.PrimaryKeyConstraint("id"),
  )
  op.create_index(
    op.f("ix_multi_chat_sessions_id"),
    "multi_chat_sessions",
    ["id"],
    unique=False,
  )
  op.create_index(
    op.f("ix_multi_chat_sessions_group_id"),
    "multi_chat_sessions",
    ["group_id"],
    unique=False,
  )

  # Create junction table for sessions <-> papers
  op.create_table(
    "multi_chat_session_papers",
    sa.Column("session_id", sa.Integer(), nullable=False),
    sa.Column("paper_id", sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(
      ["session_id"], ["multi_chat_sessions.id"], ondelete="CASCADE"
    ),
    sa.ForeignKeyConstraint(["paper_id"], ["papers.id"], ondelete="CASCADE"),
    sa.PrimaryKeyConstraint("session_id", "paper_id"),
  )

  # Create multi_chat_messages table
  op.create_table(
    "multi_chat_messages",
    sa.Column("id", sa.Integer(), nullable=False),
    sa.Column("session_id", sa.Integer(), nullable=False),
    sa.Column("parent_message_id", sa.Integer(), nullable=True),
    sa.Column("role", sa.String(), nullable=False),
    sa.Column("content", sa.Text(), nullable=False),
    sa.Column("references", sa.JSON(), nullable=True),
    sa.Column(
      "created_at",
      sa.DateTime(timezone=True),
      nullable=False,
      server_default=sa.func.now(),
    ),
    sa.ForeignKeyConstraint(
      ["session_id"], ["multi_chat_sessions.id"], ondelete="CASCADE"
    ),
    sa.ForeignKeyConstraint(
      ["parent_message_id"], ["multi_chat_messages.id"], ondelete="CASCADE"
    ),
    sa.PrimaryKeyConstraint("id"),
  )
  op.create_index(
    op.f("ix_multi_chat_messages_id"),
    "multi_chat_messages",
    ["id"],
    unique=False,
  )
  op.create_index(
    op.f("ix_multi_chat_messages_session_id"),
    "multi_chat_messages",
    ["session_id"],
    unique=False,
  )
  op.create_index(
    op.f("ix_multi_chat_messages_parent_message_id"),
    "multi_chat_messages",
    ["parent_message_id"],
    unique=False,
  )


def downgrade() -> None:
  """Drop multi-chat tables."""
  op.drop_index(
    op.f("ix_multi_chat_messages_parent_message_id"),
    table_name="multi_chat_messages",
  )
  op.drop_index(
    op.f("ix_multi_chat_messages_session_id"),
    table_name="multi_chat_messages",
  )
  op.drop_index(
    op.f("ix_multi_chat_messages_id"),
    table_name="multi_chat_messages",
  )
  op.drop_table("multi_chat_messages")
  op.drop_table("multi_chat_session_papers")
  op.drop_index(
    op.f("ix_multi_chat_sessions_group_id"),
    table_name="multi_chat_sessions",
  )
  op.drop_index(
    op.f("ix_multi_chat_sessions_id"),
    table_name="multi_chat_sessions",
  )
  op.drop_table("multi_chat_sessions")
