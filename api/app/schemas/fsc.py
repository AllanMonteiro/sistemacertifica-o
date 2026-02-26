from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.auditlog import AcaoAuditEnum
from app.models.fsc import (
    EvidenciaKindEnum,
    PrioridadeEnum,
    StatusAnaliseNcEnum,
    StatusAndamentoEnum,
    StatusConformidadeEnum,
    StatusDocumentoEnum,
    StatusMonitoramentoCriterioEnum,
    StatusNotificacaoEnum,
)


STATUS_CONFORMIDADE_LABELS = {
    StatusConformidadeEnum.conforme: 'Conforme',
    StatusConformidadeEnum.nc_menor: 'Não Conformidade Menor',
    StatusConformidadeEnum.nc_maior: 'Não Conformidade Maior',
    StatusConformidadeEnum.oportunidade_melhoria: 'Oportunidade de Melhoria',
    StatusConformidadeEnum.nao_se_aplica: 'Não se Aplica',
}


STATUS_ANDAMENTO_LABELS = {
    StatusAndamentoEnum.aberta: 'Aberta',
    StatusAndamentoEnum.em_andamento: 'Em Andamento',
    StatusAndamentoEnum.em_validacao: 'Em Validação',
    StatusAndamentoEnum.concluida: 'Concluída',
    StatusAndamentoEnum.bloqueada: 'Bloqueada',
}


PRIORIDADE_LABELS = {
    PrioridadeEnum.baixa: 'Baixa',
    PrioridadeEnum.media: 'Média',
    PrioridadeEnum.alta: 'Alta',
    PrioridadeEnum.critica: 'Crítica',
}

STATUS_DOCUMENTO_LABELS = {
    StatusDocumentoEnum.em_construcao: 'Em Construção',
    StatusDocumentoEnum.em_revisao: 'Em Revisão',
    StatusDocumentoEnum.aprovado: 'Aprovado',
    StatusDocumentoEnum.reprovado: 'Reprovado',
}

STATUS_MONITORAMENTO_CRITERIO_LABELS = {
    StatusMonitoramentoCriterioEnum.sem_dados: 'Sem Dados',
    StatusMonitoramentoCriterioEnum.conforme: 'Conforme',
    StatusMonitoramentoCriterioEnum.alerta: 'Alerta',
    StatusMonitoramentoCriterioEnum.critico: 'Crítico',
}

STATUS_NOTIFICACAO_LABELS = {
    StatusNotificacaoEnum.aberta: 'Aberta',
    StatusNotificacaoEnum.em_tratamento: 'Em Tratamento',
    StatusNotificacaoEnum.resolvida: 'Resolvida',
    StatusNotificacaoEnum.cancelada: 'Cancelada',
}

STATUS_ANALISE_NC_LABELS = {
    StatusAnaliseNcEnum.aberta: 'Aberta',
    StatusAnaliseNcEnum.em_analise: 'Em Analise',
    StatusAnaliseNcEnum.concluida: 'Concluida',
}


class MensagemOut(BaseModel):
    mensagem: str


class ResponsavelCreate(BaseModel):
    nome: str = Field(min_length=2, max_length=150)
    email: str = Field(min_length=3, max_length=255)
    senha: str = Field(min_length=6, max_length=128)


class ConfiguracaoSistemaUpdate(BaseModel):
    nome_empresa: str | None = Field(default=None, min_length=2, max_length=255)
    logo_url: str | None = None


class ConfiguracaoSistemaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome_empresa: str
    logo_url: str | None
    logo_preview_url: str | None = None
    updated_by: int | None
    created_at: datetime
    updated_at: datetime


class ProgramaCertificacaoBase(BaseModel):
    codigo: str = Field(min_length=2, max_length=50)
    nome: str = Field(min_length=2, max_length=120)
    descricao: str | None = None


class ProgramaCertificacaoCreate(ProgramaCertificacaoBase):
    pass


class ProgramaCertificacaoUpdate(BaseModel):
    codigo: str | None = Field(default=None, min_length=2, max_length=50)
    nome: str | None = Field(default=None, min_length=2, max_length=120)
    descricao: str | None = None


class ProgramaCertificacaoOut(ProgramaCertificacaoBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class PrincipioBase(BaseModel):
    programa_id: int
    codigo: str | None = Field(default=None, max_length=50)
    titulo: str = Field(min_length=2, max_length=255)
    descricao: str | None = None


class PrincipioCreate(PrincipioBase):
    pass


class PrincipioUpdate(BaseModel):
    programa_id: int | None = None
    codigo: str | None = Field(default=None, max_length=50)
    titulo: str | None = Field(default=None, min_length=2, max_length=255)
    descricao: str | None = None


class PrincipioOut(PrincipioBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class CriterioBase(BaseModel):
    programa_id: int
    principio_id: int
    codigo: str | None = Field(default=None, max_length=50)
    titulo: str = Field(min_length=2, max_length=4000)
    descricao: str | None = None


class CriterioCreate(CriterioBase):
    pass


class CriterioUpdate(BaseModel):
    programa_id: int | None = None
    principio_id: int | None = None
    codigo: str | None = Field(default=None, max_length=50)
    titulo: str | None = Field(default=None, min_length=2, max_length=4000)
    descricao: str | None = None


class CriterioOut(CriterioBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class IndicadorBase(BaseModel):
    programa_id: int
    criterio_id: int
    codigo: str | None = Field(default=None, max_length=50)
    titulo: str = Field(min_length=2, max_length=255)
    descricao: str | None = None


class IndicadorCreate(IndicadorBase):
    pass


class IndicadorUpdate(BaseModel):
    programa_id: int | None = None
    criterio_id: int | None = None
    codigo: str | None = Field(default=None, max_length=50)
    titulo: str | None = Field(default=None, min_length=2, max_length=255)
    descricao: str | None = None


class IndicadorOut(IndicadorBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class AuditoriaBase(BaseModel):
    programa_id: int
    year: int = Field(ge=2000, le=2100)
    tipo: str | None = Field(default=None, max_length=100)
    data_inicio: date | None = None
    data_fim: date | None = None
    organismo_certificador: str | None = Field(default=None, max_length=255)
    padrao_utilizado: str | None = Field(default=None, max_length=255)
    escopo: str | None = None


class AuditoriaCreate(AuditoriaBase):
    pass


class AuditoriaUpdate(BaseModel):
    programa_id: int | None = None
    year: int | None = Field(default=None, ge=2000, le=2100)
    tipo: str | None = Field(default=None, max_length=100)
    data_inicio: date | None = None
    data_fim: date | None = None
    organismo_certificador: str | None = Field(default=None, max_length=255)
    padrao_utilizado: str | None = Field(default=None, max_length=255)
    escopo: str | None = None
    senha_sistema: str | None = Field(default=None, min_length=1, max_length=128)


class ConfirmacaoSenhaRequest(BaseModel):
    senha_sistema: str = Field(min_length=1, max_length=128)


class AuditoriaOut(AuditoriaBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class AvaliacaoBase(BaseModel):
    indicator_id: int
    auditoria_ano_id: int
    status_conformidade: StatusConformidadeEnum
    observacoes: str | None = None


class AvaliacaoCreate(AvaliacaoBase):
    pass


class AvaliacaoUpdate(BaseModel):
    indicator_id: int | None = None
    auditoria_ano_id: int | None = None
    status_conformidade: StatusConformidadeEnum | None = None
    observacoes: str | None = None


class AvaliacaoPatch(BaseModel):
    status_conformidade: StatusConformidadeEnum | None = None
    observacoes: str | None = None


class AvaliacaoOut(AvaliacaoBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    programa_id: int
    assessed_at: datetime
    updated_at: datetime


class EvidenceTypeBase(BaseModel):
    programa_id: int
    criterio_id: int
    indicador_id: int
    nome: str = Field(min_length=2, max_length=120)
    descricao: str | None = None
    status_conformidade: StatusConformidadeEnum = StatusConformidadeEnum.conforme


class EvidenceTypeCreate(EvidenceTypeBase):
    pass


class EvidenceTypeUpdate(BaseModel):
    programa_id: int | None = None
    criterio_id: int | None = None
    indicador_id: int | None = None
    nome: str | None = Field(default=None, min_length=2, max_length=120)
    descricao: str | None = None
    status_conformidade: StatusConformidadeEnum | None = None


class EvidenceTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    programa_id: int | None
    criterio_id: int | None
    indicador_id: int | None
    nome: str
    descricao: str | None
    status_conformidade: StatusConformidadeEnum


class EvidenciaCreate(BaseModel):
    avaliacao_id: int
    tipo_evidencia_id: int | None = None
    kind: EvidenciaKindEnum
    url_or_path: str = Field(min_length=1)
    nao_conforme: bool = False
    observacoes: str | None = None


class EvidenciaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    programa_id: int
    avaliacao_id: int
    tipo_evidencia_id: int | None
    kind: EvidenciaKindEnum
    url_or_path: str
    nao_conforme: bool
    observacoes: str | None
    created_by: int
    created_at: datetime


class DocumentoEvidenciaCreate(BaseModel):
    evidencia_id: int
    titulo: str = Field(min_length=3, max_length=255)
    conteudo: str | None = None
    status_documento: StatusDocumentoEnum = StatusDocumentoEnum.em_construcao
    observacoes_revisao: str | None = None
    data_limite: date | None = None
    responsavel_id: int | None = None


class DocumentoEvidenciaUpdate(BaseModel):
    titulo: str | None = Field(default=None, min_length=3, max_length=255)
    conteudo: str | None = None
    status_documento: StatusDocumentoEnum | None = None
    observacoes_revisao: str | None = None
    data_limite: date | None = None
    responsavel_id: int | None = None


class DocumentoEvidenciaStatusPatch(BaseModel):
    status_documento: StatusDocumentoEnum
    observacoes_revisao: str | None = None


class DocumentoEvidenciaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    programa_id: int
    auditoria_ano_id: int
    evidencia_id: int
    titulo: str
    conteudo: str | None
    versao: int
    status_documento: StatusDocumentoEnum
    observacoes_revisao: str | None
    data_limite: date | None
    responsavel_id: int | None
    revisado_por_id: int | None
    data_revisao: datetime | None
    created_by: int
    created_at: datetime
    updated_at: datetime


class MonitoramentoCriterioCreate(BaseModel):
    auditoria_ano_id: int
    criterio_id: int
    mes_referencia: date
    status_monitoramento: StatusMonitoramentoCriterioEnum = StatusMonitoramentoCriterioEnum.sem_dados
    observacoes: str | None = None


class MonitoramentoCriterioUpdate(BaseModel):
    criterio_id: int | None = None
    mes_referencia: date | None = None
    status_monitoramento: StatusMonitoramentoCriterioEnum | None = None
    observacoes: str | None = None


class MonitoramentoCriterioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    programa_id: int
    auditoria_ano_id: int
    criterio_id: int
    mes_referencia: date
    status_monitoramento: StatusMonitoramentoCriterioEnum
    observacoes: str | None
    created_by: int
    created_at: datetime
    updated_at: datetime


class NotificacaoMonitoramentoCreate(BaseModel):
    titulo: str = Field(min_length=3, max_length=255)
    descricao: str | None = None
    severidade: PrioridadeEnum = PrioridadeEnum.media
    status_notificacao: StatusNotificacaoEnum = StatusNotificacaoEnum.aberta
    responsavel_id: int | None = None
    prazo: date | None = None


class NotificacaoMonitoramentoUpdate(BaseModel):
    titulo: str | None = Field(default=None, min_length=3, max_length=255)
    descricao: str | None = None
    severidade: PrioridadeEnum | None = None
    status_notificacao: StatusNotificacaoEnum | None = None
    responsavel_id: int | None = None
    prazo: date | None = None


class NotificacaoMonitoramentoStatusPatch(BaseModel):
    status_notificacao: StatusNotificacaoEnum


class NotificacaoMonitoramentoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    programa_id: int
    auditoria_ano_id: int
    criterio_id: int
    monitoramento_id: int
    titulo: str
    descricao: str | None
    severidade: PrioridadeEnum
    status_notificacao: StatusNotificacaoEnum
    responsavel_id: int | None
    prazo: date | None
    created_by: int
    created_at: datetime
    updated_at: datetime


class ResolucaoNotificacaoCreate(BaseModel):
    descricao: str = Field(min_length=3)
    resultado: str | None = None


class ResolucaoNotificacaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    programa_id: int
    notificacao_id: int
    descricao: str
    resultado: str | None
    created_by: int
    created_at: datetime


class AnaliseNcCreate(BaseModel):
    auditoria_ano_id: int
    avaliacao_id: int
    demanda_id: int | None = None
    titulo_problema: str = Field(min_length=3, max_length=255)
    contexto: str | None = None
    porque_1: str | None = None
    porque_2: str | None = None
    porque_3: str | None = None
    porque_4: str | None = None
    porque_5: str | None = None
    causa_raiz: str | None = None
    acao_corretiva: str | None = None
    swot_forcas: str | None = None
    swot_fraquezas: str | None = None
    swot_oportunidades: str | None = None
    swot_ameacas: str | None = None
    status_analise: StatusAnaliseNcEnum = StatusAnaliseNcEnum.aberta
    responsavel_id: int | None = None


class AnaliseNcUpdate(BaseModel):
    auditoria_ano_id: int | None = None
    avaliacao_id: int | None = None
    demanda_id: int | None = None
    titulo_problema: str | None = Field(default=None, min_length=3, max_length=255)
    contexto: str | None = None
    porque_1: str | None = None
    porque_2: str | None = None
    porque_3: str | None = None
    porque_4: str | None = None
    porque_5: str | None = None
    causa_raiz: str | None = None
    acao_corretiva: str | None = None
    swot_forcas: str | None = None
    swot_fraquezas: str | None = None
    swot_oportunidades: str | None = None
    swot_ameacas: str | None = None
    status_analise: StatusAnaliseNcEnum | None = None
    responsavel_id: int | None = None


class AnaliseNcStatusPatch(BaseModel):
    status_analise: StatusAnaliseNcEnum


class AnaliseNcOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    programa_id: int
    auditoria_ano_id: int
    avaliacao_id: int
    demanda_id: int | None
    titulo_problema: str
    contexto: str | None
    porque_1: str | None
    porque_2: str | None
    porque_3: str | None
    porque_4: str | None
    porque_5: str | None
    causa_raiz: str | None
    acao_corretiva: str | None
    swot_forcas: str | None
    swot_fraquezas: str | None
    swot_oportunidades: str | None
    swot_ameacas: str | None
    status_analise: StatusAnaliseNcEnum
    responsavel_id: int | None
    created_by: int
    created_at: datetime
    updated_at: datetime


class DemandaCreate(BaseModel):
    avaliacao_id: int
    titulo: str = Field(min_length=3, max_length=255)
    padrao: str | None = Field(default=None, max_length=255)
    descricao: str | None = None
    responsavel_id: int | None = None
    start_date: date | None = None
    due_date: date | None = None
    status_andamento: StatusAndamentoEnum = StatusAndamentoEnum.aberta
    prioridade: PrioridadeEnum = PrioridadeEnum.media


class DemandaUpdate(BaseModel):
    titulo: str | None = Field(default=None, min_length=3, max_length=255)
    padrao: str | None = Field(default=None, max_length=255)
    descricao: str | None = None
    responsavel_id: int | None = None
    start_date: date | None = None
    due_date: date | None = None
    status_andamento: StatusAndamentoEnum | None = None
    prioridade: PrioridadeEnum | None = None


class DemandaPatch(BaseModel):
    padrao: str | None = Field(default=None, max_length=255)
    responsavel_id: int | None = None
    start_date: date | None = None
    due_date: date | None = None
    status_andamento: StatusAndamentoEnum | None = None


class DemandaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    programa_id: int
    avaliacao_id: int
    titulo: str
    padrao: str | None
    descricao: str | None
    responsavel_id: int | None
    start_date: date | None
    due_date: date | None
    status_andamento: StatusAndamentoEnum
    prioridade: PrioridadeEnum
    created_at: datetime
    updated_at: datetime


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entidade: str
    entidade_id: int
    acao: AcaoAuditEnum
    old_value: dict | None
    new_value: dict | None
    created_by: int | None
    programa_id: int | None
    auditoria_ano_id: int | None
    created_at: datetime


class AvaliacaoDetalheOut(BaseModel):
    avaliacao: AvaliacaoOut
    indicador: IndicadorOut
    criterio: CriterioOut
    principio: PrincipioOut
    evidencias: list[EvidenciaOut]
    demandas: list[DemandaOut]
    logs: list[AuditLogOut]


class ResumoStatusItem(BaseModel):
    status_conformidade: StatusConformidadeEnum
    label: str
    quantidade: int


class AvaliacaoSemEvidenciaOut(BaseModel):
    avaliacao_id: int
    indicator_id: int
    indicador_titulo: str
    status_conformidade: StatusConformidadeEnum


class NcPorPrincipioItem(BaseModel):
    principio_id: int
    principio_titulo: str
    nc_menor: int
    nc_maior: int
    total_nc: int


class ResumoConformidadeCertificacaoItem(BaseModel):
    programa_id: int
    programa_nome: str
    year: int
    conformes: int
    nao_conformes: int
    oportunidades_melhoria: int
    nao_se_aplica: int
    total_avaliacoes: int


class CronogramaGanttItem(BaseModel):
    demanda_id: int
    avaliacao_id: int
    auditoria_id: int
    programa_id: int
    indicador_titulo: str
    titulo: str
    responsavel_nome: str | None = None
    prioridade: PrioridadeEnum
    status_andamento: StatusAndamentoEnum
    status_conformidade: StatusConformidadeEnum
    data_inicio: date
    data_fim: date


class MonitoramentoMensalItem(BaseModel):
    mes: int
    mes_nome: str
    principios_cadastrados: int
    principios_monitorados: int
    criterios_cadastrados: int
    criterios_monitorados: int
    avaliacoes_registradas: int
    evidencias_registradas: int
