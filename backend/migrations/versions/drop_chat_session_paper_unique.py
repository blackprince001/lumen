"""Drop the unique constraint on chat_sessions.paper_id

Multiple chat sessions per paper are supported (the model dropped
``unique=True`` on ``paper_id``), but the original ``chat_sessions_paper_id_key``
UNIQUE constraint was never dropped — only the index was recreated as
non-unique. This left creating a second session for a paper failing with
``UniqueViolationError``. Drop the leftover constraint.

Revision ID: drop_chat_session_paper_unique
Revises: add_session_provider_id
Create Date: 2026-06-13
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "drop_chat_session_paper_unique"
down_revision: Union[str, Sequence[str], None] = "add_session_provider_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  # Constraint name is the Postgres default for a column-level UNIQUE.
  op.execute(
    "ALTER TABLE chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_paper_id_key"
  )


def downgrade() -> None:
  op.create_unique_constraint(
    "chat_sessions_paper_id_key", "chat_sessions", ["paper_id"]
  )
