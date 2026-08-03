"""make measurement report optional

Revision ID: 20260326_02
Revises: 20260326_01
Create Date: 2026-03-26 00:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260326_02"
down_revision = "20260326_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("measurements", "report_id", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    op.alter_column("measurements", "report_id", existing_type=sa.Integer(), nullable=False)
