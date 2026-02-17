"""demanda start date

Revision ID: 0003_demanda_start_date
Revises: 0002_multi_certificacao
Create Date: 2026-02-17 12:30:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0003_demanda_start_date'
down_revision: Union[str, None] = '0002_multi_certificacao'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('demandas', sa.Column('start_date', sa.Date(), nullable=True))
    op.create_index(op.f('ix_demandas_start_date'), 'demandas', ['start_date'], unique=False)
    op.execute(
        """
        UPDATE demandas
        SET start_date = due_date
        WHERE start_date IS NULL AND due_date IS NOT NULL;
        """
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_demandas_start_date'), table_name='demandas')
    op.drop_column('demandas', 'start_date')
