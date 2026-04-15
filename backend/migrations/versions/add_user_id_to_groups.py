"""Add user_id to groups table.

Revision ID: add_user_id_to_groups
Revises: a1b2c3d4e5f7
Create Date: 2026-04-14
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "add_user_id_to_groups"
down_revision: Union[str, None] = "a1b2c3d4e5f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  op.add_column(
    "groups",
    sa.Column(
      "user_id",
      sa.Integer(),
      sa.ForeignKey("users.id", ondelete="CASCADE"),
      nullable=True,
    ),
  )
  op.create_index("idx_groups_user_id", "groups", ["user_id"])

  # Leave existing rows as NULL — admin sees all, users only see their own
  pass


def downgrade() -> None:
  op.drop_index("idx_groups_user_id", table_name="groups")
  op.drop_column("groups", "user_id")
