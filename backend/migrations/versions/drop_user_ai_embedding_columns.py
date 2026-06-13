"""Drop per-user embedding columns from AI provider/settings tables

Embeddings always run through the Google embedding service (configured by the
``GOOGLE_API_KEY`` env var), never a user's chat provider. The per-user
``embedding_model`` / ``embedding_dimension`` columns on ``user_ai_providers``
and ``user_ai_settings`` were therefore inert and are no longer exposed in the
API or UI. Drop them.

Revision ID: drop_user_ai_embedding_columns
Revises: drop_chat_session_paper_unique
Create Date: 2026-06-13
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "drop_user_ai_embedding_columns"
down_revision: Union[str, Sequence[str], None] = "drop_chat_session_paper_unique"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  for table in ("user_ai_providers", "user_ai_settings"):
    op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS embedding_model")
    op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS embedding_dimension")


def downgrade() -> None:
  for table in ("user_ai_providers", "user_ai_settings"):
    op.add_column(
      table,
      sa.Column(
        "embedding_model",
        sa.String(length=100),
        nullable=False,
        server_default="",
      ),
    )
    op.add_column(
      table,
      sa.Column(
        "embedding_dimension",
        sa.Integer(),
        nullable=False,
        server_default="768",
      ),
    )
