"""Add user_id to tags table, replace global unique(name) with unique(name, user_id).

Revision ID: add_user_id_to_tags
Revises: add_user_id_to_groups
Create Date: 2026-04-14
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "add_user_id_to_tags"
down_revision: Union[str, None] = "add_user_id_to_groups"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  # Drop the old global unique constraint on name
  op.drop_index("ix_tags_name", table_name="tags")

  op.add_column(
    "tags",
    sa.Column(
      "user_id",
      sa.Integer(),
      sa.ForeignKey("users.id", ondelete="CASCADE"),
      nullable=True,
    ),
  )
  op.create_index("idx_tags_user_id", "tags", ["user_id"])

  # Leave existing rows as NULL — admin sees all, users only see their own
  pass

  # Add per-user unique constraint
  op.create_unique_constraint("uq_tags_name_user_id", "tags", ["name", "user_id"])

  # Restore a non-unique index on name for search performance
  op.create_index("ix_tags_name", "tags", ["name"])


def downgrade() -> None:
  op.drop_constraint("uq_tags_name_user_id", "tags", type_="unique")
  op.drop_index("idx_tags_user_id", table_name="tags")
  op.drop_column("tags", "user_id")

  # Restore original global unique index
  op.drop_index("ix_tags_name", table_name="tags")
  op.create_index("ix_tags_name", "tags", ["name"], unique=True)
