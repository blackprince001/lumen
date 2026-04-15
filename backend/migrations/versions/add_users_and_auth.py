"""Add users table, refresh_tokens table, and user_id FKs to existing tables.

Revision ID: a1b2c3d4e5f7
Revises: remove_unused_paper_fields
Create Date: 2026-04-13
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers
revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, None] = "remove_unused_paper_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  # --- Create users table ---
  op.create_table(
    "users",
    sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
    sa.Column("email", sa.String(255), unique=True, nullable=False),
    sa.Column("google_id", sa.String(255), unique=True, nullable=True),
    sa.Column("display_name", sa.String(255), nullable=False),
    sa.Column("avatar_url", sa.Text(), nullable=True),
    sa.Column("organization", sa.String(255), nullable=True),
    sa.Column("department", sa.String(255), nullable=True),
    sa.Column("research_field", sa.String(255), nullable=True),
    sa.Column("bio", sa.Text(), nullable=True),
    sa.Column("role", sa.String(20), nullable=False, server_default="user"),
    sa.Column("auth_provider", sa.String(20), nullable=False, server_default="google"),
    sa.Column("password_hash", sa.String(255), nullable=True),
    sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
    sa.Column("login_count", sa.Integer(), nullable=False, server_default="0"),
    sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
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
  )
  op.create_index("idx_users_email", "users", ["email"])
  op.create_index("idx_users_google_id", "users", ["google_id"])
  op.create_index("idx_users_role", "users", ["role"])
  op.create_index("idx_users_organization", "users", ["organization"])

  # --- Create refresh_tokens table ---
  op.create_table(
    "refresh_tokens",
    sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
    sa.Column(
      "user_id",
      sa.Integer(),
      sa.ForeignKey("users.id", ondelete="CASCADE"),
      nullable=False,
    ),
    sa.Column("token_hash", sa.String(255), unique=True, nullable=False),
    sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column(
      "created_at",
      sa.DateTime(timezone=True),
      nullable=False,
      server_default=sa.func.now(),
    ),
    sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
  )
  op.create_index("idx_refresh_tokens_user", "refresh_tokens", ["user_id"])
  op.create_index("idx_refresh_tokens_hash", "refresh_tokens", ["token_hash"])

  # --- Add user_id FK columns to existing tables ---

  # papers.uploaded_by_id
  op.add_column(
    "papers",
    sa.Column(
      "uploaded_by_id",
      sa.Integer(),
      sa.ForeignKey("users.id", ondelete="SET NULL"),
      nullable=True,
    ),
  )
  op.create_index("idx_papers_uploaded_by", "papers", ["uploaded_by_id"])

  # annotations.user_id
  op.add_column(
    "annotations",
    sa.Column(
      "user_id",
      sa.Integer(),
      sa.ForeignKey("users.id", ondelete="SET NULL"),
      nullable=True,
    ),
  )
  op.create_index("idx_annotations_user", "annotations", ["user_id"])

  # bookmarks.user_id
  op.add_column(
    "bookmarks",
    sa.Column(
      "user_id",
      sa.Integer(),
      sa.ForeignKey("users.id", ondelete="SET NULL"),
      nullable=True,
    ),
  )
  op.create_index("idx_bookmarks_user", "bookmarks", ["user_id"])

  # reading_sessions.user_id
  op.add_column(
    "reading_sessions",
    sa.Column(
      "user_id",
      sa.Integer(),
      sa.ForeignKey("users.id", ondelete="SET NULL"),
      nullable=True,
    ),
  )
  op.create_index("idx_reading_sessions_user", "reading_sessions", ["user_id"])

  # chat_sessions.user_id
  op.add_column(
    "chat_sessions",
    sa.Column(
      "user_id",
      sa.Integer(),
      sa.ForeignKey("users.id", ondelete="SET NULL"),
      nullable=True,
    ),
  )
  op.create_index("idx_chat_sessions_user", "chat_sessions", ["user_id"])

  # multi_chat_sessions.user_id
  op.add_column(
    "multi_chat_sessions",
    sa.Column(
      "user_id",
      sa.Integer(),
      sa.ForeignKey("users.id", ondelete="SET NULL"),
      nullable=True,
    ),
  )
  op.create_index("idx_multi_chat_sessions_user", "multi_chat_sessions", ["user_id"])

  # saved_searches.user_id
  op.add_column(
    "saved_searches",
    sa.Column(
      "user_id",
      sa.Integer(),
      sa.ForeignKey("users.id", ondelete="SET NULL"),
      nullable=True,
    ),
  )
  op.create_index("idx_saved_searches_user", "saved_searches", ["user_id"])

  # discovery_sessions.user_id
  op.add_column(
    "discovery_sessions",
    sa.Column(
      "user_id",
      sa.Integer(),
      sa.ForeignKey("users.id", ondelete="SET NULL"),
      nullable=True,
    ),
  )
  op.create_index("idx_discovery_sessions_user", "discovery_sessions", ["user_id"])


def downgrade() -> None:
  # Remove FK columns from existing tables (reverse order)
  op.drop_index("idx_discovery_sessions_user", table_name="discovery_sessions")
  op.drop_column("discovery_sessions", "user_id")

  op.drop_index("idx_saved_searches_user", table_name="saved_searches")
  op.drop_column("saved_searches", "user_id")

  op.drop_index("idx_multi_chat_sessions_user", table_name="multi_chat_sessions")
  op.drop_column("multi_chat_sessions", "user_id")

  op.drop_index("idx_chat_sessions_user", table_name="chat_sessions")
  op.drop_column("chat_sessions", "user_id")

  op.drop_index("idx_reading_sessions_user", table_name="reading_sessions")
  op.drop_column("reading_sessions", "user_id")

  op.drop_index("idx_bookmarks_user", table_name="bookmarks")
  op.drop_column("bookmarks", "user_id")

  op.drop_index("idx_annotations_user", table_name="annotations")
  op.drop_column("annotations", "user_id")

  op.drop_index("idx_papers_uploaded_by", table_name="papers")
  op.drop_column("papers", "uploaded_by_id")

  # Drop new tables
  op.drop_index("idx_refresh_tokens_hash", table_name="refresh_tokens")
  op.drop_index("idx_refresh_tokens_user", table_name="refresh_tokens")
  op.drop_table("refresh_tokens")

  op.drop_index("idx_users_organization", table_name="users")
  op.drop_index("idx_users_role", table_name="users")
  op.drop_index("idx_users_google_id", table_name="users")
  op.drop_index("idx_users_email", table_name="users")
  op.drop_table("users")
