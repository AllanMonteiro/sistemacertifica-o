"""demanda padrao

Revision ID: 0005_demanda_padrao
Revises: 0004_configuracoes_sistema
Create Date: 2026-02-18 00:40:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0005_demanda_padrao'
down_revision: Union[str, None] = '0004_configuracoes_sistema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('demandas', sa.Column('padrao', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('demandas', 'padrao')
