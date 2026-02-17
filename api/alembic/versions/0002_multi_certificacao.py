"""multi certificacao

Revision ID: 0002_multi_certificacao
Revises: 0001_initial
Create Date: 2026-02-17 11:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0002_multi_certificacao'
down_revision: Union[str, None] = '0001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'programas_certificacao',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('codigo', sa.String(length=50), nullable=False),
        sa.Column('nome', sa.String(length=120), nullable=False),
        sa.Column('descricao', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('codigo'),
        sa.UniqueConstraint('nome'),
    )
    op.create_index(op.f('ix_programas_certificacao_id'), 'programas_certificacao', ['id'], unique=False)
    op.create_index(op.f('ix_programas_certificacao_codigo'), 'programas_certificacao', ['codigo'], unique=True)

    op.execute(
        """
        INSERT INTO programas_certificacao (codigo, nome, descricao)
        VALUES
            ('FSC', 'FSC', 'Forest Stewardship Council'),
            ('PFC', 'PFC', 'Programa de Certificação Florestal'),
            ('ONCA_PINTADA', 'Onça Pintada', 'Certificação e monitoramento para onça pintada'),
            ('CARBONO', 'Carbono', 'Programas e auditorias para carbono florestal');
        """
    )

    op.add_column('principios', sa.Column('programa_id', sa.Integer(), nullable=True))
    op.add_column('criterios', sa.Column('programa_id', sa.Integer(), nullable=True))
    op.add_column('indicadores', sa.Column('programa_id', sa.Integer(), nullable=True))
    op.add_column('auditorias_ano', sa.Column('programa_id', sa.Integer(), nullable=True))
    op.add_column('avaliacoes_indicador', sa.Column('programa_id', sa.Integer(), nullable=True))
    op.add_column('evidencias', sa.Column('programa_id', sa.Integer(), nullable=True))
    op.add_column('demandas', sa.Column('programa_id', sa.Integer(), nullable=True))
    op.add_column('audit_logs', sa.Column('programa_id', sa.Integer(), nullable=True))

    op.create_index(op.f('ix_principios_programa_id'), 'principios', ['programa_id'], unique=False)
    op.create_index(op.f('ix_criterios_programa_id'), 'criterios', ['programa_id'], unique=False)
    op.create_index(op.f('ix_indicadores_programa_id'), 'indicadores', ['programa_id'], unique=False)
    op.create_index(op.f('ix_auditorias_ano_programa_id'), 'auditorias_ano', ['programa_id'], unique=False)
    op.create_index(op.f('ix_avaliacoes_indicador_programa_id'), 'avaliacoes_indicador', ['programa_id'], unique=False)
    op.create_index(op.f('ix_evidencias_programa_id'), 'evidencias', ['programa_id'], unique=False)
    op.create_index(op.f('ix_demandas_programa_id'), 'demandas', ['programa_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_programa_id'), 'audit_logs', ['programa_id'], unique=False)

    op.execute(
        """
        UPDATE principios
        SET programa_id = (SELECT id FROM programas_certificacao WHERE codigo = 'FSC')
        WHERE programa_id IS NULL;
        """
    )
    op.execute(
        """
        UPDATE criterios c
        SET programa_id = COALESCE(
            (SELECT p.programa_id FROM principios p WHERE p.id = c.principio_id),
            (SELECT id FROM programas_certificacao WHERE codigo = 'FSC')
        )
        WHERE c.programa_id IS NULL;
        """
    )
    op.execute(
        """
        UPDATE indicadores i
        SET programa_id = COALESCE(
            (SELECT c.programa_id FROM criterios c WHERE c.id = i.criterio_id),
            (SELECT id FROM programas_certificacao WHERE codigo = 'FSC')
        )
        WHERE i.programa_id IS NULL;
        """
    )
    op.execute(
        """
        UPDATE auditorias_ano
        SET programa_id = (SELECT id FROM programas_certificacao WHERE codigo = 'FSC')
        WHERE programa_id IS NULL;
        """
    )
    op.execute(
        """
        UPDATE avaliacoes_indicador a
        SET programa_id = COALESCE(
            (SELECT au.programa_id FROM auditorias_ano au WHERE au.id = a.auditoria_ano_id),
            (SELECT i.programa_id FROM indicadores i WHERE i.id = a.indicator_id),
            (SELECT id FROM programas_certificacao WHERE codigo = 'FSC')
        )
        WHERE a.programa_id IS NULL;
        """
    )
    op.execute(
        """
        UPDATE evidencias e
        SET programa_id = COALESCE(
            (SELECT a.programa_id FROM avaliacoes_indicador a WHERE a.id = e.avaliacao_id),
            (SELECT id FROM programas_certificacao WHERE codigo = 'FSC')
        )
        WHERE e.programa_id IS NULL;
        """
    )
    op.execute(
        """
        UPDATE demandas d
        SET programa_id = COALESCE(
            (SELECT a.programa_id FROM avaliacoes_indicador a WHERE a.id = d.avaliacao_id),
            (SELECT id FROM programas_certificacao WHERE codigo = 'FSC')
        )
        WHERE d.programa_id IS NULL;
        """
    )
    op.execute(
        """
        UPDATE audit_logs l
        SET programa_id = COALESCE(
            (SELECT au.programa_id FROM auditorias_ano au WHERE au.id = l.auditoria_ano_id),
            (SELECT id FROM programas_certificacao WHERE codigo = 'FSC')
        )
        WHERE l.programa_id IS NULL;
        """
    )

    op.alter_column('principios', 'programa_id', nullable=False)
    op.alter_column('criterios', 'programa_id', nullable=False)
    op.alter_column('indicadores', 'programa_id', nullable=False)
    op.alter_column('auditorias_ano', 'programa_id', nullable=False)
    op.alter_column('avaliacoes_indicador', 'programa_id', nullable=False)
    op.alter_column('evidencias', 'programa_id', nullable=False)
    op.alter_column('demandas', 'programa_id', nullable=False)

    op.create_foreign_key(
        'fk_principios_programa_id_programas_certificacao',
        'principios',
        'programas_certificacao',
        ['programa_id'],
        ['id'],
        ondelete='RESTRICT',
    )
    op.create_foreign_key(
        'fk_criterios_programa_id_programas_certificacao',
        'criterios',
        'programas_certificacao',
        ['programa_id'],
        ['id'],
        ondelete='RESTRICT',
    )
    op.create_foreign_key(
        'fk_indicadores_programa_id_programas_certificacao',
        'indicadores',
        'programas_certificacao',
        ['programa_id'],
        ['id'],
        ondelete='RESTRICT',
    )
    op.create_foreign_key(
        'fk_auditorias_ano_programa_id_programas_certificacao',
        'auditorias_ano',
        'programas_certificacao',
        ['programa_id'],
        ['id'],
        ondelete='RESTRICT',
    )
    op.create_foreign_key(
        'fk_avaliacoes_indicador_programa_id_programas_certificacao',
        'avaliacoes_indicador',
        'programas_certificacao',
        ['programa_id'],
        ['id'],
        ondelete='RESTRICT',
    )
    op.create_foreign_key(
        'fk_evidencias_programa_id_programas_certificacao',
        'evidencias',
        'programas_certificacao',
        ['programa_id'],
        ['id'],
        ondelete='RESTRICT',
    )
    op.create_foreign_key(
        'fk_demandas_programa_id_programas_certificacao',
        'demandas',
        'programas_certificacao',
        ['programa_id'],
        ['id'],
        ondelete='RESTRICT',
    )
    op.create_foreign_key(
        'fk_audit_logs_programa_id_programas_certificacao',
        'audit_logs',
        'programas_certificacao',
        ['programa_id'],
        ['id'],
        ondelete='SET NULL',
    )

    op.drop_index(op.f('ix_auditorias_ano_year'), table_name='auditorias_ano')
    op.execute('ALTER TABLE auditorias_ano DROP CONSTRAINT IF EXISTS auditorias_ano_year_key')
    op.create_index(op.f('ix_auditorias_ano_year'), 'auditorias_ano', ['year'], unique=False)
    op.create_unique_constraint('uq_auditoria_programa_year', 'auditorias_ano', ['programa_id', 'year'])


def downgrade() -> None:
    op.drop_constraint('uq_auditoria_programa_year', 'auditorias_ano', type_='unique')

    op.drop_constraint('fk_audit_logs_programa_id_programas_certificacao', 'audit_logs', type_='foreignkey')
    op.drop_constraint('fk_demandas_programa_id_programas_certificacao', 'demandas', type_='foreignkey')
    op.drop_constraint('fk_evidencias_programa_id_programas_certificacao', 'evidencias', type_='foreignkey')
    op.drop_constraint('fk_avaliacoes_indicador_programa_id_programas_certificacao', 'avaliacoes_indicador', type_='foreignkey')
    op.drop_constraint('fk_auditorias_ano_programa_id_programas_certificacao', 'auditorias_ano', type_='foreignkey')
    op.drop_constraint('fk_indicadores_programa_id_programas_certificacao', 'indicadores', type_='foreignkey')
    op.drop_constraint('fk_criterios_programa_id_programas_certificacao', 'criterios', type_='foreignkey')
    op.drop_constraint('fk_principios_programa_id_programas_certificacao', 'principios', type_='foreignkey')

    op.drop_index(op.f('ix_audit_logs_programa_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_demandas_programa_id'), table_name='demandas')
    op.drop_index(op.f('ix_evidencias_programa_id'), table_name='evidencias')
    op.drop_index(op.f('ix_avaliacoes_indicador_programa_id'), table_name='avaliacoes_indicador')
    op.drop_index(op.f('ix_auditorias_ano_programa_id'), table_name='auditorias_ano')
    op.drop_index(op.f('ix_indicadores_programa_id'), table_name='indicadores')
    op.drop_index(op.f('ix_criterios_programa_id'), table_name='criterios')
    op.drop_index(op.f('ix_principios_programa_id'), table_name='principios')

    op.drop_column('audit_logs', 'programa_id')
    op.drop_column('demandas', 'programa_id')
    op.drop_column('evidencias', 'programa_id')
    op.drop_column('avaliacoes_indicador', 'programa_id')
    op.drop_column('auditorias_ano', 'programa_id')
    op.drop_column('indicadores', 'programa_id')
    op.drop_column('criterios', 'programa_id')
    op.drop_column('principios', 'programa_id')

    op.drop_index(op.f('ix_programas_certificacao_codigo'), table_name='programas_certificacao')
    op.drop_index(op.f('ix_programas_certificacao_id'), table_name='programas_certificacao')
    op.drop_table('programas_certificacao')

    op.drop_index(op.f('ix_auditorias_ano_year'), table_name='auditorias_ano')
    op.create_unique_constraint('auditorias_ano_year_key', 'auditorias_ano', ['year'])
    op.create_index(op.f('ix_auditorias_ano_year'), 'auditorias_ano', ['year'], unique=True)
