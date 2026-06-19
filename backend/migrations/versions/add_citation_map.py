"""add citation map tables, drop citation_canvas_items

Revision ID: citation_map_001
Revises: c79b3de432d9
Create Date: 2026-06-19 22:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "citation_map_001"
down_revision: Union[str, Sequence[str], None] = "c79b3de432d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  op.create_table(
    "citation_map_items",
    sa.Column("id", sa.Integer(), nullable=False),
    sa.Column("user_id", sa.Integer(), nullable=False),
    sa.Column("paper_id", sa.Integer(), nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    sa.ForeignKeyConstraint(["paper_id"], ["papers.id"], ondelete="CASCADE"),
    sa.PrimaryKeyConstraint("id"),
    sa.UniqueConstraint("user_id", "paper_id", name="uq_citation_map_user_paper"),
  )
  op.create_index(
    op.f("ix_citation_map_items_id"), "citation_map_items", ["id"], unique=False
  )
  op.create_index(
    op.f("ix_citation_map_items_user_id"),
    "citation_map_items",
    ["user_id"],
    unique=False,
  )

  op.create_table(
    "citation_map_positions",
    sa.Column("id", sa.Integer(), nullable=False),
    sa.Column("user_id", sa.Integer(), nullable=False),
    sa.Column("node_key", sa.String(), nullable=False),
    sa.Column("x", sa.Float(), nullable=False),
    sa.Column("y", sa.Float(), nullable=False),
    sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    sa.PrimaryKeyConstraint("id"),
    sa.UniqueConstraint("user_id", "node_key", name="uq_citation_map_user_node"),
  )
  op.create_index(
    op.f("ix_citation_map_positions_id"),
    "citation_map_positions",
    ["id"],
    unique=False,
  )
  op.create_index(
    op.f("ix_citation_map_positions_user_id"),
    "citation_map_positions",
    ["user_id"],
    unique=False,
  )

  op.create_table(
    "citation_map_cache",
    sa.Column("paper_id", sa.Integer(), nullable=False),
    sa.Column("s2_paper_id", sa.String(), nullable=True),
    sa.Column("resolved", sa.Integer(), nullable=False, server_default="0"),
    sa.Column("references_json", sa.JSON(), nullable=True),
    sa.Column("citations_json", sa.JSON(), nullable=True),
    sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(["paper_id"], ["papers.id"], ondelete="CASCADE"),
    sa.PrimaryKeyConstraint("paper_id"),
  )

  op.drop_table("citation_canvas_items")


def downgrade() -> None:
  op.create_table(
    "citation_canvas_items",
    sa.Column("id", sa.Integer(), nullable=False),
    sa.Column("user_id", sa.Integer(), nullable=False),
    sa.Column("paper_id", sa.Integer(), nullable=False),
    sa.Column("x", sa.Float(), nullable=False),
    sa.Column("y", sa.Float(), nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    sa.ForeignKeyConstraint(["paper_id"], ["papers.id"], ondelete="CASCADE"),
    sa.PrimaryKeyConstraint("id"),
    sa.UniqueConstraint("user_id", "paper_id", name="uq_canvas_user_paper"),
  )

  op.drop_table("citation_map_cache")
  op.drop_index(
    op.f("ix_citation_map_positions_user_id"), table_name="citation_map_positions"
  )
  op.drop_index(
    op.f("ix_citation_map_positions_id"), table_name="citation_map_positions"
  )
  op.drop_table("citation_map_positions")
  op.drop_index(op.f("ix_citation_map_items_user_id"), table_name="citation_map_items")
  op.drop_index(op.f("ix_citation_map_items_id"), table_name="citation_map_items")
  op.drop_table("citation_map_items")
