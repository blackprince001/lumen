"""Add citation_canvas_items table.

Revision ID: add_citation_canvas_items
Revises: drop_paper_per_user_columns
Create Date: 2026-04-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "add_citation_canvas_items"
down_revision: Union[str, None] = "drop_paper_per_user_columns"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  op.create_table(
    "citation_canvas_items",
    sa.Column("id", sa.Integer(), primary_key=True),
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
    sa.Column("x", sa.Float(), nullable=False),
    sa.Column("y", sa.Float(), nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    sa.UniqueConstraint("user_id", "paper_id", name="uq_canvas_user_paper"),
  )
  op.create_index(
    "idx_canvas_user_id", "citation_canvas_items", ["user_id"]
  )


def downgrade() -> None:
  op.drop_index("idx_canvas_user_id", table_name="citation_canvas_items")
  op.drop_table("citation_canvas_items")
