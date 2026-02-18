"""tipos evidencia vinculados a criterio e indicador

Revision ID: 0006_tipos_evidencia_vinculos
Revises: 0005_demanda_padrao
Create Date: 2026-02-18 23:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0006_tipos_evidencia_vinculos'
down_revision: Union[str, None] = '0005_demanda_padrao'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tipos_evidencia', sa.Column('programa_id', sa.Integer(), nullable=True))
    op.add_column('tipos_evidencia', sa.Column('criterio_id', sa.Integer(), nullable=True))
    op.add_column('tipos_evidencia', sa.Column('indicador_id', sa.Integer(), nullable=True))

    op.create_index(op.f('ix_tipos_evidencia_programa_id'), 'tipos_evidencia', ['programa_id'], unique=False)
    op.create_index(op.f('ix_tipos_evidencia_criterio_id'), 'tipos_evidencia', ['criterio_id'], unique=False)
    op.create_index(op.f('ix_tipos_evidencia_indicador_id'), 'tipos_evidencia', ['indicador_id'], unique=False)

    op.create_foreign_key(
        'fk_tipos_evidencia_programa_id_programas_certificacao',
        'tipos_evidencia',
        'programas_certificacao',
        ['programa_id'],
        ['id'],
        ondelete='RESTRICT',
    )
    op.create_foreign_key(
        'fk_tipos_evidencia_criterio_id_criterios',
        'tipos_evidencia',
        'criterios',
        ['criterio_id'],
        ['id'],
        ondelete='CASCADE',
    )
    op.create_foreign_key(
        'fk_tipos_evidencia_indicador_id_indicadores',
        'tipos_evidencia',
        'indicadores',
        ['indicador_id'],
        ['id'],
        ondelete='CASCADE',
    )

    op.execute('ALTER TABLE tipos_evidencia DROP CONSTRAINT IF EXISTS tipos_evidencia_nome_key')
    op.create_unique_constraint(
        'uq_tipos_evidencia_nome_vinculo',
        'tipos_evidencia',
        ['programa_id', 'criterio_id', 'indicador_id', 'nome'],
    )


def downgrade() -> None:
    op.drop_constraint('uq_tipos_evidencia_nome_vinculo', 'tipos_evidencia', type_='unique')

    op.drop_constraint('fk_tipos_evidencia_indicador_id_indicadores', 'tipos_evidencia', type_='foreignkey')
    op.drop_constraint('fk_tipos_evidencia_criterio_id_criterios', 'tipos_evidencia', type_='foreignkey')
    op.drop_constraint('fk_tipos_evidencia_programa_id_programas_certificacao', 'tipos_evidencia', type_='foreignkey')

    op.drop_index(op.f('ix_tipos_evidencia_indicador_id'), table_name='tipos_evidencia')
    op.drop_index(op.f('ix_tipos_evidencia_criterio_id'), table_name='tipos_evidencia')
    op.drop_index(op.f('ix_tipos_evidencia_programa_id'), table_name='tipos_evidencia')

    op.drop_column('tipos_evidencia', 'indicador_id')
    op.drop_column('tipos_evidencia', 'criterio_id')
    op.drop_column('tipos_evidencia', 'programa_id')

    op.create_unique_constraint('tipos_evidencia_nome_key', 'tipos_evidencia', ['nome'])
