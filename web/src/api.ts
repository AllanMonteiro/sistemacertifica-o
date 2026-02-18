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
  nome: string;
  descricao?: string | null;
}

export interface Evidencia {
  id: number;
  programa_id: number;
  avaliacao_id: number;
  tipo_evidencia_id?: number | null;
  kind: KindEvidencia;
  url_or_path: string;
  observacoes?: string | null;
  created_by: number;
  created_at: string;
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
  prioridade: Prioridade;
  status_andamento: StatusAndamento;
  status_conformidade: StatusConformidade;
  data_inicio: string;
  data_fim: string;
}
