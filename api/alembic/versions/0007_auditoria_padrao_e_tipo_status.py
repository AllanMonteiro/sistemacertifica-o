"""auditoria padrao e status em tipo evidencia

Revision ID: 0007_aud_padrao_tipo_status
Revises: 0006_tipos_evidencia_vinculos
Create Date: 2026-02-19 00:20:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0007_aud_padrao_tipo_status'
down_revision: Union[str, None] = '0006_tipos_evidencia_vinculos'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


status_conformidade_enum = sa.Enum(
    'conforme',
    'nc_menor',
    'nc_maior',
    'oportunidade_melhoria',
    'nao_se_aplica',
    name='status_conformidade_enum',
    native_enum=False,
)


def upgrade() -> None:
    op.add_column('auditorias_ano', sa.Column('padrao_utilizado', sa.String(length=255), nullable=True))

    op.add_column(
        'tipos_evidencia',
        sa.Column(
            'status_conformidade',
            status_conformidade_enum,
            nullable=False,
            server_default='conforme',
        ),
    )
    op.alter_column('tipos_evidencia', 'status_conformidade', server_default=None)


def downgrade() -> None:
    op.drop_column('tipos_evidencia', 'status_conformidade')
    op.drop_column('auditorias_ano', 'padrao_utilizado')
