import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type Role = 'ADMIN' | 'GESTOR' | 'AUDITOR' | 'RESPONSAVEL';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  role: Role;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  usuario: Usuario;
}

export interface ProgramaCertificacao {
  id: number;
  codigo: string;
  nome: string;
  descricao?: string | null;
  created_at: string;
}

export interface ConfiguracaoSistema {
  id: number;
  nome_empresa: string;
  logo_url?: string | null;
  logo_preview_url?: string | null;
  updated_by?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Auditoria {
  id: number;
  programa_id: number;
  year: number;
  tipo?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  organismo_certificador?: string | null;
  padrao_utilizado?: string | null;
  escopo?: string | null;
  created_at: string;
}

export interface Principio {
  id: number;
  programa_id: number;
  codigo?: string | null;
  titulo: string;
  descricao?: string | null;
  created_at: string;
}

export interface Criterio {
  id: number;
  programa_id: number;
  principio_id: number;
  codigo?: string | null;
  titulo: string;
  descricao?: string | null;
}

export interface Indicador {
  id: number;
  programa_id: number;
  criterio_id: number;
  codigo?: string | null;
  titulo: string;
  descricao?: string | null;
}

export type StatusConformidade =
  | 'conforme'
  | 'nc_menor'
  | 'nc_maior'
  | 'oportunidade_melhoria'
  | 'nao_se_aplica';

export const STATUS_CONFORMIDADE_LABELS: Record<StatusConformidade, string> = {
  conforme: 'Conforme',
  nc_menor: 'Não Conformidade Menor',
  nc_maior: 'Não Conformidade Maior',
  oportunidade_melhoria: 'Oportunidade de Melhoria',
  nao_se_aplica: 'Não se Aplica',
};

export interface Avaliacao {
  id: number;
  programa_id: number;
  indicator_id: number;
  auditoria_ano_id: number;
  status_conformidade: StatusConformidade;
  observacoes?: string | null;
  assessed_at: string;
  updated_at: string;
}

export type KindEvidencia = 'arquivo' | 'link' | 'texto';

export interface TipoEvidencia {
  id: number;
  programa_id?: number | null;
  criterio_id?: number | null;
  indicador_id?: number | null;
  nome: string;
  descricao?: string | null;
  status_conformidade: StatusConformidade;
}

export interface Evidencia {
  id: number;
  programa_id: number;
  avaliacao_id: number;
  tipo_evidencia_id?: number | null;
  kind: KindEvidencia;
  url_or_path: string;
  nao_conforme: boolean;
  observacoes?: string | null;
  created_by: number;
  created_at: string;
}

export type StatusDocumento = 'em_construcao' | 'em_revisao' | 'aprovado' | 'reprovado';

export const STATUS_DOCUMENTO_LABELS: Record<StatusDocumento, string> = {
  em_construcao: 'Em Construção',
  em_revisao: 'Em Revisão',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
};

export interface DocumentoEvidencia {
  id: number;
  programa_id: number;
  auditoria_ano_id: number;
  evidencia_id: number;
  titulo: string;
  conteudo?: string | null;
  versao: number;
  status_documento: StatusDocumento;
  observacoes_revisao?: string | null;
  data_limite?: string | null;
  responsavel_id?: number | null;
  revisado_por_id?: number | null;
  data_revisao?: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export type StatusMonitoramentoCriterio = 'sem_dados' | 'conforme' | 'alerta' | 'critico';

export const STATUS_MONITORAMENTO_CRITERIO_LABELS: Record<StatusMonitoramentoCriterio, string> = {
  sem_dados: 'Sem Dados',
  conforme: 'Conforme',
  alerta: 'Alerta',
  critico: 'Crítico',
};

export interface MonitoramentoCriterio {
  id: number;
  programa_id: number;
  auditoria_ano_id: number;
  criterio_id: number;
  mes_referencia: string;
  status_monitoramento: StatusMonitoramentoCriterio;
  observacoes?: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export type StatusNotificacaoMonitoramento = 'aberta' | 'em_tratamento' | 'resolvida' | 'cancelada';

export const STATUS_NOTIFICACAO_MONITORAMENTO_LABELS: Record<StatusNotificacaoMonitoramento, string> = {
  aberta: 'Aberta',
  em_tratamento: 'Em Tratamento',
  resolvida: 'Resolvida',
  cancelada: 'Cancelada',
};

export interface NotificacaoMonitoramento {
  id: number;
  programa_id: number;
  auditoria_ano_id: number;
  criterio_id: number;
  monitoramento_id: number;
  titulo: string;
  descricao?: string | null;
  severidade: Prioridade;
  status_notificacao: StatusNotificacaoMonitoramento;
  responsavel_id?: number | null;
  prazo?: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface ResolucaoNotificacao {
  id: number;
  programa_id: number;
  notificacao_id: number;
  descricao: string;
  resultado?: string | null;
  created_by: number;
  created_at: string;
}

export type StatusAnaliseNc = 'aberta' | 'em_analise' | 'concluida';

export const STATUS_ANALISE_NC_LABELS: Record<StatusAnaliseNc, string> = {
  aberta: 'Aberta',
  em_analise: 'Em Analise',
  concluida: 'Concluida',
};

export interface AnaliseNc {
  id: number;
  programa_id: number;
  auditoria_ano_id: number;
  avaliacao_id: number;
  demanda_id?: number | null;
  titulo_problema: string;
  contexto?: string | null;
  porque_1?: string | null;
  porque_2?: string | null;
  porque_3?: string | null;
  porque_4?: string | null;
  porque_5?: string | null;
  causa_raiz?: string | null;
  acao_corretiva?: string | null;
  swot_forcas?: string | null;
  swot_fraquezas?: string | null;
  swot_oportunidades?: string | null;
  swot_ameacas?: string | null;
  status_analise: StatusAnaliseNc;
  responsavel_id?: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export type StatusAndamento =
  | 'aberta'
  | 'em_andamento'
  | 'em_validacao'
  | 'concluida'
  | 'bloqueada';

export const STATUS_ANDAMENTO_LABELS: Record<StatusAndamento, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em Andamento',
  em_validacao: 'Em Validação',
  concluida: 'Concluída',
  bloqueada: 'Bloqueada',
};

export type Prioridade = 'baixa' | 'media' | 'alta' | 'critica';

export const PRIORIDADE_LABELS: Record<Prioridade, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

export interface Demanda {
  id: number;
  programa_id: number;
  avaliacao_id: number;
  titulo: string;
  padrao?: string | null;
  descricao?: string | null;
  responsavel_id?: number | null;
  start_date?: string | null;
  due_date?: string | null;
  status_andamento: StatusAndamento;
  prioridade: Prioridade;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  entidade: string;
  entidade_id: number;
  acao: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  created_by?: number | null;
  programa_id?: number | null;
  auditoria_ano_id?: number | null;
  created_at: string;
}

export interface AvaliacaoDetalhe {
  avaliacao: Avaliacao;
  indicador: Indicador;
  criterio: Criterio;
  principio: Principio;
  evidencias: Evidencia[];
  demandas: Demanda[];
  logs: AuditLog[];
}

export interface ResumoStatusItem {
  status_conformidade: StatusConformidade;
  label: string;
  quantidade: number;
}

export interface AvaliacaoSemEvidenciaItem {
  avaliacao_id: number;
  indicator_id: number;
  indicador_titulo: string;
  status_conformidade: StatusConformidade;
}

export interface NcPorPrincipioItem {
  principio_id: number;
  principio_titulo: string;
  nc_menor: number;
  nc_maior: number;
  total_nc: number;
}

export interface ResumoConformidadeCertificacaoItem {
  programa_id: number;
  programa_nome: string;
  year: number;
  conformes: number;
  nao_conformes: number;
  oportunidades_melhoria: number;
  nao_se_aplica: number;
  total_avaliacoes: number;
}

export interface CronogramaGanttItem {
  demanda_id: number;
  avaliacao_id: number;
  auditoria_id: number;
  programa_id: number;
  indicador_titulo: string;
  titulo: string;
  responsavel_nome?: string | null;
  prioridade: Prioridade;
  status_andamento: StatusAndamento;
  status_conformidade: StatusConformidade;
  data_inicio: string;
  data_fim: string;
}

export interface MonitoramentoMensalItem {
  mes: number;
  mes_nome: string;
  principios_cadastrados: number;
  principios_monitorados: number;
  criterios_cadastrados: number;
  criterios_monitorados: number;
  avaliacoes_registradas: number;
  evidencias_registradas: number;
}
