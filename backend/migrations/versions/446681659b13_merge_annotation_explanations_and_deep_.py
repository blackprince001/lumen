"""merge annotation explanations and deep-research heads

Revision ID: 446681659b13
Revises: annotation_explanations_001, deep_research_004
Create Date: 2026-09-17 23:16:54.858250

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '446681659b13'
down_revision: Union[str, Sequence[str], None] = ('annotation_explanations_001', 'deep_research_004')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
