import enum
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class StatusConformidadeEnum(str, enum.Enum):
    conforme = 'conforme'
    nc_menor = 'nc_menor'
    nc_maior = 'nc_maior'
    oportunidade_melhoria = 'oportunidade_melhoria'
    nao_se_aplica = 'nao_se_aplica'


class StatusAndamentoEnum(str, enum.Enum):
    aberta = 'aberta'
    em_andamento = 'em_andamento'
    em_validacao = 'em_validacao'
    concluida = 'concluida'
    bloqueada = 'bloqueada'


class PrioridadeEnum(str, enum.Enum):
    baixa = 'baixa'
    media = 'media'
    alta = 'alta'
    critica = 'critica'


class EvidenciaKindEnum(str, enum.Enum):
    arquivo = 'arquivo'
    link = 'link'
    texto = 'texto'


class ProgramaCertificacao(Base):
    __tablename__ = 'programas_certificacao'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    codigo: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    nome: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    principios = relationship('Principio', back_populates='programa')
    criterios = relationship('Criterio', back_populates='programa')
    indicadores = relationship('Indicador', back_populates='programa')
    auditorias = relationship('AuditoriaAno', back_populates='programa')
    avaliacoes = relationship('AvaliacaoIndicador', back_populates='programa')
    evidencias = relationship('Evidencia', back_populates='programa')
    demandas = relationship('Demanda', back_populates='programa')
    tipos_evidencia = relationship('EvidenceType', back_populates='programa')


class Principio(Base):
    __tablename__ = 'principios'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    programa_id: Mapped[int] = mapped_column(ForeignKey('programas_certificacao.id', ondelete='RESTRICT'), nullable=False, index=True)
    codigo: Mapped[str | None] = mapped_column(String(50), nullable=True)
    titulo: Mapped[str] = mapped_column(String(255), nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    programa = relationship('ProgramaCertificacao', back_populates='principios')
    criterios = relationship('Criterio', back_populates='principio', cascade='all, delete-orphan')


class Criterio(Base):
    __tablename__ = 'criterios'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    programa_id: Mapped[int] = mapped_column(ForeignKey('programas_certificacao.id', ondelete='RESTRICT'), nullable=False, index=True)
    principio_id: Mapped[int] = mapped_column(ForeignKey('principios.id', ondelete='CASCADE'), nullable=False, index=True)
    codigo: Mapped[str | None] = mapped_column(String(50), nullable=True)
    titulo: Mapped[str] = mapped_column(String(255), nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)

    programa = relationship('ProgramaCertificacao', back_populates='criterios')
    principio = relationship('Principio', back_populates='criterios')
    indicadores = relationship('Indicador', back_populates='criterio', cascade='all, delete-orphan')
    tipos_evidencia = relationship('EvidenceType', back_populates='criterio')


class Indicador(Base):
    __tablename__ = 'indicadores'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    programa_id: Mapped[int] = mapped_column(ForeignKey('programas_certificacao.id', ondelete='RESTRICT'), nullable=False, index=True)
    criterio_id: Mapped[int] = mapped_column(ForeignKey('criterios.id', ondelete='CASCADE'), nullable=False, index=True)
    codigo: Mapped[str | None] = mapped_column(String(50), nullable=True)
    titulo: Mapped[str] = mapped_column(String(255), nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)

    programa = relationship('ProgramaCertificacao', back_populates='indicadores')
    criterio = relationship('Criterio', back_populates='indicadores')
    avaliacoes = relationship('AvaliacaoIndicador', back_populates='indicador', cascade='all, delete-orphan')
    tipos_evidencia = relationship('EvidenceType', back_populates='indicador')


class AuditoriaAno(Base):
    __tablename__ = 'auditorias_ano'
    __table_args__ = (UniqueConstraint('programa_id', 'year', name='uq_auditoria_programa_year'),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    programa_id: Mapped[int] = mapped_column(ForeignKey('programas_certificacao.id', ondelete='RESTRICT'), nullable=False, index=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    tipo: Mapped[str | None] = mapped_column(String(100), nullable=True)
    data_inicio: Mapped[date | None] = mapped_column(Date, nullable=True)
    data_fim: Mapped[date | None] = mapped_column(Date, nullable=True)
    organismo_certificador: Mapped[str | None] = mapped_column(String(255), nullable=True)
    escopo: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    programa = relationship('ProgramaCertificacao', back_populates='auditorias')
    avaliacoes = relationship('AvaliacaoIndicador', back_populates='auditoria', cascade='all, delete-orphan')


class AvaliacaoIndicador(Base):
    __tablename__ = 'avaliacoes_indicador'
    __table_args__ = (UniqueConstraint('indicator_id', 'auditoria_ano_id', name='uq_avaliacao_indicator_auditoria'),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    programa_id: Mapped[int] = mapped_column(ForeignKey('programas_certificacao.id', ondelete='RESTRICT'), nullable=False, index=True)
    indicator_id: Mapped[int] = mapped_column(ForeignKey('indicadores.id', ondelete='CASCADE'), nullable=False, index=True)
    auditoria_ano_id: Mapped[int] = mapped_column(ForeignKey('auditorias_ano.id', ondelete='CASCADE'), nullable=False, index=True)
    status_conformidade: Mapped[StatusConformidadeEnum] = mapped_column(
        Enum(StatusConformidadeEnum, name='status_conformidade_enum', native_enum=False),
        nullable=False,
    )
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    assessed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    programa = relationship('ProgramaCertificacao', back_populates='avaliacoes')
    indicador = relationship('Indicador', back_populates='avaliacoes')
    auditoria = relationship('AuditoriaAno', back_populates='avaliacoes')
    evidencias = relationship('Evidencia', back_populates='avaliacao', cascade='all, delete-orphan')
    demandas = relationship('Demanda', back_populates='avaliacao', cascade='all, delete-orphan')


class EvidenceType(Base):
    __tablename__ = 'tipos_evidencia'
    __table_args__ = (
        UniqueConstraint('programa_id', 'criterio_id', 'indicador_id', 'nome', name='uq_tipos_evidencia_nome_vinculo'),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    programa_id: Mapped[int | None] = mapped_column(
        ForeignKey('programas_certificacao.id', ondelete='RESTRICT'),
        nullable=True,
        index=True,
    )
    criterio_id: Mapped[int | None] = mapped_column(
        ForeignKey('criterios.id', ondelete='CASCADE'),
        nullable=True,
        index=True,
    )
    indicador_id: Mapped[int | None] = mapped_column(
        ForeignKey('indicadores.id', ondelete='CASCADE'),
        nullable=True,
        index=True,
    )
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)

    programa = relationship('ProgramaCertificacao', back_populates='tipos_evidencia')
    criterio = relationship('Criterio', back_populates='tipos_evidencia')
    indicador = relationship('Indicador', back_populates='tipos_evidencia')
    evidencias = relationship('Evidencia', back_populates='tipo_evidencia')


class Evidencia(Base):
    __tablename__ = 'evidencias'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    programa_id: Mapped[int] = mapped_column(ForeignKey('programas_certificacao.id', ondelete='RESTRICT'), nullable=False, index=True)
    avaliacao_id: Mapped[int] = mapped_column(ForeignKey('avaliacoes_indicador.id', ondelete='CASCADE'), nullable=False, index=True)
    tipo_evidencia_id: Mapped[int | None] = mapped_column(ForeignKey('tipos_evidencia.id', ondelete='SET NULL'), nullable=True)
    kind: Mapped[EvidenciaKindEnum] = mapped_column(Enum(EvidenciaKindEnum, name='evidencia_kind_enum', native_enum=False), nullable=False)
    url_or_path: Mapped[str] = mapped_column(Text, nullable=False)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey('usuarios.id', ondelete='RESTRICT'), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    programa = relationship('ProgramaCertificacao', back_populates='evidencias')
    avaliacao = relationship('AvaliacaoIndicador', back_populates='evidencias')
    tipo_evidencia = relationship('EvidenceType', back_populates='evidencias')
    criador = relationship('User', back_populates='evidencias_criadas')


class Demanda(Base):
    __tablename__ = 'demandas'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    programa_id: Mapped[int] = mapped_column(ForeignKey('programas_certificacao.id', ondelete='RESTRICT'), nullable=False, index=True)
    avaliacao_id: Mapped[int] = mapped_column(ForeignKey('avaliacoes_indicador.id', ondelete='CASCADE'), nullable=False, index=True)
    titulo: Mapped[str] = mapped_column(String(255), nullable=False)
    padrao: Mapped[str | None] = mapped_column(String(255), nullable=True)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    responsavel_id: Mapped[int | None] = mapped_column(ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True, index=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    status_andamento: Mapped[StatusAndamentoEnum] = mapped_column(
        Enum(StatusAndamentoEnum, name='status_andamento_enum', native_enum=False),
        nullable=False,
        default=StatusAndamentoEnum.aberta,
    )
    prioridade: Mapped[PrioridadeEnum] = mapped_column(
        Enum(PrioridadeEnum, name='prioridade_enum', native_enum=False),
        nullable=False,
        default=PrioridadeEnum.media,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    programa = relationship('ProgramaCertificacao', back_populates='demandas')
    avaliacao = relationship('AvaliacaoIndicador', back_populates='demandas')
    responsavel = relationship('User', back_populates='demandas_responsavel')


class ConfiguracaoSistema(Base):
    __tablename__ = 'configuracoes_sistema'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nome_empresa: Mapped[str] = mapped_column(String(255), nullable=False, default='Empresa')
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey('usuarios.id', ondelete='SET NULL'), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    autor_atualizacao = relationship('User')
