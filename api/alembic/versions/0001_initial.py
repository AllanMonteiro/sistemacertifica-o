"""initial schema

Revision ID: 0001_initial
Revises: 
Create Date: 2026-02-17 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


role_enum = sa.Enum('ADMIN', 'GESTOR', 'AUDITOR', 'RESPONSAVEL', name='role_enum', native_enum=False)
status_conformidade_enum = sa.Enum(
    'conforme',
    'nc_menor',
    'nc_maior',
    'oportunidade_melhoria',
    'nao_se_aplica',
    name='status_conformidade_enum',
    native_enum=False,
)
status_andamento_enum = sa.Enum(
    'aberta',
    'em_andamento',
    'em_validacao',
    'concluida',
    'bloqueada',
    name='status_andamento_enum',
    native_enum=False,
)
prioridade_enum = sa.Enum('baixa', 'media', 'alta', 'critica', name='prioridade_enum', native_enum=False)
evidencia_kind_enum = sa.Enum('arquivo', 'link', 'texto', name='evidencia_kind_enum', native_enum=False)
acao_audit_enum = sa.Enum('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', name='acao_audit_enum', native_enum=False)


def upgrade() -> None:
    op.create_table(
        'usuarios',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nome', sa.String(length=150), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('role', role_enum, nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_usuarios_email'), 'usuarios', ['email'], unique=True)
    op.create_index(op.f('ix_usuarios_id'), 'usuarios', ['id'], unique=False)

    op.create_table(
        'principios',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('codigo', sa.String(length=50), nullable=True),
        sa.Column('titulo', sa.String(length=255), nullable=False),
        sa.Column('descricao', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_principios_id'), 'principios', ['id'], unique=False)

    op.create_table(
        'criterios',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('principio_id', sa.Integer(), nullable=False),
        sa.Column('codigo', sa.String(length=50), nullable=True),
        sa.Column('titulo', sa.String(length=255), nullable=False),
        sa.Column('descricao', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['principio_id'], ['principios.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_criterios_id'), 'criterios', ['id'], unique=False)
    op.create_index(op.f('ix_criterios_principio_id'), 'criterios', ['principio_id'], unique=False)

    op.create_table(
        'indicadores',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('criterio_id', sa.Integer(), nullable=False),
        sa.Column('codigo', sa.String(length=50), nullable=True),
        sa.Column('titulo', sa.String(length=255), nullable=False),
        sa.Column('descricao', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['criterio_id'], ['criterios.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_indicadores_criterio_id'), 'indicadores', ['criterio_id'], unique=False)
    op.create_index(op.f('ix_indicadores_id'), 'indicadores', ['id'], unique=False)

    op.create_table(
        'auditorias_ano',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('tipo', sa.String(length=100), nullable=True),
        sa.Column('data_inicio', sa.Date(), nullable=True),
        sa.Column('data_fim', sa.Date(), nullable=True),
        sa.Column('organismo_certificador', sa.String(length=255), nullable=True),
        sa.Column('escopo', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('year'),
    )
    op.create_index(op.f('ix_auditorias_ano_id'), 'auditorias_ano', ['id'], unique=False)
    op.create_index(op.f('ix_auditorias_ano_year'), 'auditorias_ano', ['year'], unique=True)

    op.create_table(
        'tipos_evidencia',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nome', sa.String(length=120), nullable=False),
        sa.Column('descricao', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('nome'),
    )
    op.create_index(op.f('ix_tipos_evidencia_id'), 'tipos_evidencia', ['id'], unique=False)

    op.create_table(
        'avaliacoes_indicador',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('indicator_id', sa.Integer(), nullable=False),
        sa.Column('auditoria_ano_id', sa.Integer(), nullable=False),
        sa.Column('status_conformidade', status_conformidade_enum, nullable=False),
        sa.Column('observacoes', sa.Text(), nullable=True),
        sa.Column('assessed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['auditoria_ano_id'], ['auditorias_ano.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['indicator_id'], ['indicadores.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('indicator_id', 'auditoria_ano_id', name='uq_avaliacao_indicator_auditoria'),
    )
    op.create_index(op.f('ix_avaliacoes_indicador_auditoria_ano_id'), 'avaliacoes_indicador', ['auditoria_ano_id'], unique=False)
    op.create_index(op.f('ix_avaliacoes_indicador_id'), 'avaliacoes_indicador', ['id'], unique=False)
    op.create_index(op.f('ix_avaliacoes_indicador_indicator_id'), 'avaliacoes_indicador', ['indicator_id'], unique=False)

    op.create_table(
        'evidencias',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('avaliacao_id', sa.Integer(), nullable=False),
        sa.Column('tipo_evidencia_id', sa.Integer(), nullable=True),
        sa.Column('kind', evidencia_kind_enum, nullable=False),
        sa.Column('url_or_path', sa.Text(), nullable=False),
        sa.Column('observacoes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['avaliacao_id'], ['avaliacoes_indicador.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['usuarios.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['tipo_evidencia_id'], ['tipos_evidencia.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_evidencias_avaliacao_id'), 'evidencias', ['avaliacao_id'], unique=False)
    op.create_index(op.f('ix_evidencias_id'), 'evidencias', ['id'], unique=False)

    op.create_table(
        'demandas',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('avaliacao_id', sa.Integer(), nullable=False),
        sa.Column('titulo', sa.String(length=255), nullable=False),
        sa.Column('descricao', sa.Text(), nullable=True),
        sa.Column('responsavel_id', sa.Integer(), nullable=True),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('status_andamento', status_andamento_enum, nullable=False),
        sa.Column('prioridade', prioridade_enum, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['avaliacao_id'], ['avaliacoes_indicador.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['responsavel_id'], ['usuarios.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_demandas_avaliacao_id'), 'demandas', ['avaliacao_id'], unique=False)
    op.create_index(op.f('ix_demandas_due_date'), 'demandas', ['due_date'], unique=False)
    op.create_index(op.f('ix_demandas_id'), 'demandas', ['id'], unique=False)
    op.create_index(op.f('ix_demandas_responsavel_id'), 'demandas', ['responsavel_id'], unique=False)

    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('entidade', sa.String(length=100), nullable=False),
        sa.Column('entidade_id', sa.Integer(), nullable=False),
        sa.Column('acao', acao_audit_enum, nullable=False),
        sa.Column('old_value', sa.JSON(), nullable=True),
        sa.Column('new_value', sa.JSON(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('auditoria_ano_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['auditoria_ano_id'], ['auditorias_ano.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['usuarios.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_audit_logs_auditoria_ano_id'), 'audit_logs', ['auditoria_ano_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_created_at'), 'audit_logs', ['created_at'], unique=False)
    op.create_index(op.f('ix_audit_logs_entidade'), 'audit_logs', ['entidade'], unique=False)
    op.create_index(op.f('ix_audit_logs_entidade_id'), 'audit_logs', ['entidade_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_id'), 'audit_logs', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_audit_logs_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_entidade_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_entidade'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_created_at'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_auditoria_ano_id'), table_name='audit_logs')
    op.drop_table('audit_logs')

    op.drop_index(op.f('ix_demandas_responsavel_id'), table_name='demandas')
    op.drop_index(op.f('ix_demandas_id'), table_name='demandas')
    op.drop_index(op.f('ix_demandas_due_date'), table_name='demandas')
    op.drop_index(op.f('ix_demandas_avaliacao_id'), table_name='demandas')
    op.drop_table('demandas')

    op.drop_index(op.f('ix_evidencias_id'), table_name='evidencias')
    op.drop_index(op.f('ix_evidencias_avaliacao_id'), table_name='evidencias')
    op.drop_table('evidencias')

    op.drop_index(op.f('ix_avaliacoes_indicador_indicator_id'), table_name='avaliacoes_indicador')
    op.drop_index(op.f('ix_avaliacoes_indicador_id'), table_name='avaliacoes_indicador')
    op.drop_index(op.f('ix_avaliacoes_indicador_auditoria_ano_id'), table_name='avaliacoes_indicador')
    op.drop_table('avaliacoes_indicador')

    op.drop_index(op.f('ix_tipos_evidencia_id'), table_name='tipos_evidencia')
    op.drop_table('tipos_evidencia')

    op.drop_index(op.f('ix_auditorias_ano_year'), table_name='auditorias_ano')
    op.drop_index(op.f('ix_auditorias_ano_id'), table_name='auditorias_ano')
    op.drop_table('auditorias_ano')

    op.drop_index(op.f('ix_indicadores_id'), table_name='indicadores')
    op.drop_index(op.f('ix_indicadores_criterio_id'), table_name='indicadores')
    op.drop_table('indicadores')

    op.drop_index(op.f('ix_criterios_principio_id'), table_name='criterios')
    op.drop_index(op.f('ix_criterios_id'), table_name='criterios')
    op.drop_table('criterios')

    op.drop_index(op.f('ix_principios_id'), table_name='principios')
    op.drop_table('principios')

    op.drop_index(op.f('ix_usuarios_id'), table_name='usuarios')
    op.drop_index(op.f('ix_usuarios_email'), table_name='usuarios')
    op.drop_table('usuarios')
