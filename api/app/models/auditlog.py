import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class AcaoAuditEnum(str, enum.Enum):
    CREATE = 'CREATE'
    UPDATE = 'UPDATE'
    DELETE = 'DELETE'
    STATUS_CHANGE = 'STATUS_CHANGE'


class AuditLog(Base):
    __tablename__ = 'audit_logs'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    entidade: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entidade_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    acao: Mapped[AcaoAuditEnum] = mapped_column(Enum(AcaoAuditEnum, name='acao_audit_enum', native_enum=False), nullable=False)
    old_value: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    new_value: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True)
    programa_id: Mapped[int | None] = mapped_column(ForeignKey('programas_certificacao.id', ondelete='SET NULL'), nullable=True, index=True)
    auditoria_ano_id: Mapped[int | None] = mapped_column(ForeignKey('auditorias_ano.id', ondelete='SET NULL'), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)

    autor = relationship('User', back_populates='logs')
