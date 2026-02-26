"""Aumenta tamanho do titulo de criterio

Revision ID: 0012_criterio_titulo_texto
Revises: 0011_evid_nao_conforme
Create Date: 2026-02-26 16:35:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0012_criterio_titulo_texto"
down_revision = "0011_evid_nao_conforme"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "criterios",
        "titulo",
        existing_type=sa.String(length=255),
        type_=sa.Text(),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "criterios",
        "titulo",
        existing_type=sa.Text(),
        type_=sa.String(length=255),
        existing_nullable=False,
    )

