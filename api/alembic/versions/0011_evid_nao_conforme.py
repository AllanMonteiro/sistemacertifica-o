"""adiciona flag de evidencia nao conforme

Revision ID: 0011_evid_nao_conf
Revises: 0010_analise_nc
Create Date: 2026-02-25 00:30:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0011_evid_nao_conf'
down_revision: Union[str, None] = '0010_analise_nc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'evidencias',
        sa.Column('nao_conforme', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.alter_column('evidencias', 'nao_conforme', server_default=None)


def downgrade() -> None:
    op.drop_column('evidencias', 'nao_conforme')

