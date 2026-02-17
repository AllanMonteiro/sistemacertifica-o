import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class RoleEnum(str, enum.Enum):
    ADMIN = 'ADMIN'
    GESTOR = 'GESTOR'
    AUDITOR = 'AUDITOR'
    RESPONSAVEL = 'RESPONSAVEL'


class User(Base):
    __tablename__ = 'usuarios'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    role: Mapped[RoleEnum] = mapped_column(Enum(RoleEnum, name='role_enum', native_enum=False), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    evidencias_criadas = relationship('Evidencia', back_populates='criador')
    demandas_responsavel = relationship('Demanda', back_populates='responsavel')
    logs = relationship('AuditLog', back_populates='autor')
