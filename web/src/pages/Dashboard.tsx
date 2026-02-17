import { useEffect, useMemo, useState } from 'react';

import {
  api,
  Auditoria,
  Demanda,
  ProgramaCertificacao,
  ResumoConformidadeCertificacaoItem,
  ResumoStatusItem,
  STATUS_ANDAMENTO_LABELS,
  STATUS_CONFORMIDADE_LABELS,
  StatusConformidade,
} from '../api';
import Table from '../components/Table';

type Props = {
  programaId: number | null;
  auditoriaId: number | null;
};

const ORDEM_STATUS: StatusConformidade[] = [
  'conforme',
  'nc_menor',
  'nc_maior',
  'oportunidade_melhoria',
  'nao_se_aplica',
];

const CLASSE_RISCO_STATUS: Record<StatusConformidade, string> = {
  conforme: 'status-risco-baixo',
  nc_menor: 'status-risco-medio',
  nc_maior: 'status-risco-alto',
  oportunidade_melhoria: 'status-risco-atencao',
  nao_se_aplica: 'status-risco-neutro',
};

export default function Dashboard({ programaId, auditoriaId }: Props) {
  const [resumo, setResumo] = useState<ResumoStatusItem[]>([]);
  const [demandasAtrasadas, setDemandasAtrasadas] = useState<Demanda[]>([]);
  const [resumoCertificacaoAno, setResumoCertificacaoAno] = useState<ResumoConformidadeCertificacaoItem[]>([]);
  const [programas, setProgramas] = useState<ProgramaCertificacao[]>([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([]);
  const [anoRelatorio, setAnoRelatorio] = useState<number>(new Date().getFullYear());
  const [programaRelatorio, setProgramaRelatorio] = useState<string>('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    const carregarFiltros = async () => {
      try {
        const [programasResp, auditoriasResp] = await Promise.all([
          api.get<ProgramaCertificacao[]>('/programas-certificacao'),
          api.get<Auditoria[]>('/auditorias'),
        ]);
        setProgramas(programasResp.data);
        const anos = Array.from(new Set(auditoriasResp.data.map((a) => a.year))).sort((a, b) => b - a);
        setAnosDisponiveis(anos);
        if (anos.length > 0 && !anos.includes(anoRelatorio)) {
          setAnoRelatorio(anos[0]);
        }
      } catch {
        // O erro principal do dashboard será tratado nos outros carregamentos.
      }
    };
    void carregarFiltros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!auditoriaId) return;
    const carregarResumoAuditoria = async () => {
      try {
        setErro('');
        const [resumoResp, demandasResp] = await Promise.all([
          api.get<ResumoStatusItem[]>('/reports/resumo-status', { params: { auditoria_id: auditoriaId } }),
          api.get<Demanda[]>('/reports/demandas-atrasadas', { params: { auditoria_id: auditoriaId } }),
        ]);
        setResumo(resumoResp.data);
        setDemandasAtrasadas(demandasResp.data);
      } catch (err: any) {
        setErro(err?.response?.data?.detail || 'Falha ao carregar dashboard.');
      }
    };
    void carregarResumoAuditoria();
  }, [auditoriaId]);

  useEffect(() => {
    if (!anoRelatorio) return;
    const carregarResumoCertificacaoAno = async () => {
      try {
        setErro('');
        const params: Record<string, string | number> = { year: anoRelatorio };
        if (programaRelatorio) {
          params.programa_id = Number(programaRelatorio);
        }
        const { data } = await api.get<ResumoConformidadeCertificacaoItem[]>(
          '/reports/resumo-conformidade-por-certificacao',
          { params }
        );
        setResumoCertificacaoAno(data);
      } catch (err: any) {
        setErro(err?.response?.data?.detail || 'Falha ao carregar relatório por certificação.');
      }
    };
    void carregarResumoCertificacaoAno();
  }, [anoRelatorio, programaRelatorio]);

  const resumoMap = useMemo(() => new Map(resumo.map((item) => [item.status_conformidade, item.quantidade])), [resumo]);

  return (
    <div className="grid gap-16">
      <h2>Dashboard da Auditoria</h2>

      {erro && <div className="error">{erro}</div>}

      {!auditoriaId && (
        <div className="card">Selecione Programa e Auditoria (Ano) no topo para visualizar o resumo operacional.</div>
      )}

      {auditoriaId && (
        <>
          <div className="cards-status">
            {ORDEM_STATUS.map((status) => (
              <div className={`card status-card ${CLASSE_RISCO_STATUS[status]}`} key={status}>
                <h3>{STATUS_CONFORMIDADE_LABELS[status]}</h3>
                <strong>{resumoMap.get(status) || 0}</strong>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>Demandas Atrasadas</h3>
            <Table
              rows={demandasAtrasadas}
              emptyText="Nenhuma demanda atrasada para este ano."
              columns={[
                { title: 'Título', render: (d) => d.titulo },
                { title: 'Data Início', render: (d) => d.start_date || '-' },
                { title: 'Data Fim', render: (d) => d.due_date || '-' },
                { title: 'Status', render: (d) => STATUS_ANDAMENTO_LABELS[d.status_andamento] },
                { title: 'Responsável ID', render: (d) => d.responsavel_id || '-' },
              ]}
            />
          </div>
        </>
      )}

      <div className="card">
        <h3>Relatório por Certificação/Ano</h3>
        <div className="filters-row">
          <label className="form-row compact">
            <span>Ano</span>
            <select value={anoRelatorio} onChange={(e) => setAnoRelatorio(Number(e.target.value))}>
              {anosDisponiveis.length === 0 ? (
                <option value={anoRelatorio}>{anoRelatorio}</option>
              ) : (
                anosDisponiveis.map((ano) => (
                  <option key={ano} value={ano}>
                    {ano}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="form-row compact">
            <span>Certificação</span>
            <select value={programaRelatorio} onChange={(e) => setProgramaRelatorio(e.target.value)}>
              <option value="">Todas</option>
              {programas.map((programa) => (
                <option key={programa.id} value={programa.id}>
                  {programa.nome}
                </option>
              ))}
            </select>
          </label>
        </div>

        <Table
          rows={resumoCertificacaoAno}
          emptyText="Sem avaliações para os filtros selecionados."
          columns={[
            { title: 'Certificação', render: (item) => item.programa_nome },
            { title: 'Ano', render: (item) => item.year },
            { title: 'Conformes', render: (item) => item.conformes },
            { title: 'Não Conformes', render: (item) => item.nao_conformes },
            { title: 'Oportunidades', render: (item) => item.oportunidades_melhoria },
            { title: 'Não se Aplica', render: (item) => item.nao_se_aplica },
            { title: 'Total', render: (item) => item.total_avaliacoes },
          ]}
        />
      </div>
    </div>
  );
}
