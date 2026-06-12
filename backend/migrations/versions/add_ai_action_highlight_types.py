"""Add explain/why/define to the highlighttype enum

Revision ID: add_ai_action_highlight_types
Revises: add_layout_blocks
Create Date: 2026-06-12

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_ai_action_highlight_types"
down_revision: Union[str, None] = "add_layout_blocks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  """Extend highlighttype with the selection AI-action kinds."""
  # ADD VALUE cannot run inside a transaction block.
  with op.get_context().autocommit_block():
    op.execute("ALTER TYPE highlighttype ADD VALUE IF NOT EXISTS 'explain'")
    op.execute("ALTER TYPE highlighttype ADD VALUE IF NOT EXISTS 'why'")
    op.execute("ALTER TYPE highlighttype ADD VALUE IF NOT EXISTS 'define'")


def downgrade() -> None:
  """Postgres cannot drop enum values; leave them in place."""
