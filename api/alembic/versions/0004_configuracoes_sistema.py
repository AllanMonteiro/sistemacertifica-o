"""configuracoes sistema

Revision ID: 0004_configuracoes_sistema
Revises: 0003_demanda_start_date
Create Date: 2026-02-17 15:20:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0004_configuracoes_sistema'
down_revision: Union[str, None] = '0003_demanda_start_date'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'configuracoes_sistema',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nome_empresa', sa.String(length=255), nullable=False),
        sa.Column('logo_url', sa.Text(), nullable=True),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['updated_by'], ['usuarios.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_configuracoes_sistema_id'), 'configuracoes_sistema', ['id'], unique=False)
    op.execute(
        """
        INSERT INTO configuracoes_sistema (nome_empresa)
        VALUES ('Empresa');
        """
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_configuracoes_sistema_id'), table_name='configuracoes_sistema')
    op.drop_table('configuracoes_sistema')
