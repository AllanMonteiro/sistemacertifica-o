import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  api,
  Auditoria,
  Demanda,
  MonitoramentoMensalItem,
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
  selecionarContextoRelatorio: (programaId: number, year: number) => Promise<void>;
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

type FiltroConformidadeDemandas =
  | 'conforme'
  | 'nao_conformes'
  | 'oportunidade_melhoria'
  | 'nao_se_aplica';

export default function Dashboard({
  programaId,
  auditoriaId,
  selecionarContextoRelatorio,
}: Props) {
  const navigate = useNavigate();
  const [resumo, setResumo] = useState<ResumoStatusItem[]>([]);
  const [demandasAtrasadas, setDemandasAtrasadas] = useState<Demanda[]>([]);
  const [monitoramentoMensal, setMonitoramentoMensal] = useState<MonitoramentoMensalItem[]>([]);
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
        // Erros detalhados serao exibidos nos carregamentos principais.
      }
    };
    void carregarFiltros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!auditoriaId || !programaId) {
      setMonitoramentoMensal([]);
      return;
    }
    const carregarResumoAuditoria = async () => {
      try {
        setErro('');
        const [resumoResp, demandasResp] = await Promise.all([
          api.get<ResumoStatusItem[]>('/reports/resumo-status', { params: { auditoria_id: auditoriaId } }),
          api.get<Demanda[]>('/reports/demandas-atrasadas', { params: { auditoria_id: auditoriaId } }),
        ]);
        setResumo(resumoResp.data);
        setDemandasAtrasadas(demandasResp.data);
        try {
          const monitoramentoResp = await api.get<MonitoramentoMensalItem[]>('/reports/monitoramento-mensal', {
            params: { programa_id: programaId, auditoria_id: auditoriaId },
          });
          setMonitoramentoMensal(monitoramentoResp.data);
        } catch (err: any) {
          if (err?.response?.status === 404) {
            // Ambientes com API antiga podem não ter este relatório.
            setMonitoramentoMensal([]);
          } else {
            setErro(err?.response?.data?.detail || 'Falha ao carregar monitoramento mensal.');
          }
        }
      } catch (err: any) {
        setErro(err?.response?.data?.detail || 'Falha ao carregar dashboard.');
      }
    };
    void carregarResumoAuditoria();
  }, [auditoriaId, programaId]);

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
        setErro(err?.response?.data?.detail || 'Falha ao carregar relatorio por certificacao.');
      }
    };
    void carregarResumoCertificacaoAno();
  }, [anoRelatorio, programaRelatorio]);

  const resumoMap = useMemo(
    () => new Map(resumo.map((item) => [item.status_conformidade, item.quantidade])),
    [resumo]
  );

  const abrirDemandasPorRelatorio = async (
    item: ResumoConformidadeCertificacaoItem,
    filtroConformidade: FiltroConformidadeDemandas
  ) => {
    try {
      setErro('');
      await selecionarContextoRelatorio(item.programa_id, item.year);
      navigate(`/demandas?filtro_conformidade=${filtroConformidade}`);
    } catch {
      setErro('Nao foi possivel abrir as demandas para o filtro selecionado.');
    }
  };

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
                { title: 'Titulo', render: (d) => d.titulo },
                { title: 'Data Inicio', render: (d) => d.start_date || '-' },
                { title: 'Data Fim', render: (d) => d.due_date || '-' },
                { title: 'Status', render: (d) => STATUS_ANDAMENTO_LABELS[d.status_andamento] },
                { title: 'Responsavel ID', render: (d) => d.responsavel_id || '-' },
              ]}
            />
          </div>

          <div className="card">
            <h3>Monitoramento Mensal (Principios, Criterios e Evidencias)</h3>
            <Table
              rows={monitoramentoMensal}
              emptyText="Sem dados de monitoramento mensal para esta auditoria."
              columns={[
                { title: 'Mes', render: (item) => item.mes_nome },
                {
                  title: 'Principios Monitorados',
                  render: (item) => `${item.principios_monitorados}/${item.principios_cadastrados}`,
                },
                {
                  title: 'Criterios Monitorados',
                  render: (item) => `${item.criterios_monitorados}/${item.criterios_cadastrados}`,
                },
                { title: 'Avaliacoes no Mes', render: (item) => item.avaliacoes_registradas },
                { title: 'Evidencias no Mes', render: (item) => item.evidencias_registradas },
              ]}
            />
          </div>
        </>
      )}

      <div className="card">
        <h3>Relatorio por Certificacao/Ano</h3>
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
            <span>Certificacao</span>
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
          emptyText="Sem avaliacoes para os filtros selecionados."
          columns={[
            { title: 'Certificacao', render: (item) => item.programa_nome },
            { title: 'Ano', render: (item) => item.year },
            {
              title: 'Conformes',
              render: (item) => (
                <button
                  type="button"
                  className="table-link-button"
                  onClick={() => abrirDemandasPorRelatorio(item, 'conforme')}
                  disabled={item.conformes === 0}
                  title="Abrir demandas relacionadas a avaliacoes conformes"
                >
                  {item.conformes}
                </button>
              ),
            },
            {
              title: 'Nao Conformes',
              render: (item) => (
                <button
                  type="button"
                  className="table-link-button"
                  onClick={() => abrirDemandasPorRelatorio(item, 'nao_conformes')}
                  disabled={item.nao_conformes === 0}
                  title="Abrir demandas relacionadas a NC Menor e NC Maior"
                >
                  {item.nao_conformes}
                </button>
              ),
            },
            {
              title: 'Oportunidades',
              render: (item) => (
                <button
                  type="button"
                  className="table-link-button"
                  onClick={() => abrirDemandasPorRelatorio(item, 'oportunidade_melhoria')}
                  disabled={item.oportunidades_melhoria === 0}
                  title="Abrir demandas relacionadas a oportunidade de melhoria"
                >
                  {item.oportunidades_melhoria}
                </button>
              ),
            },
            {
              title: 'Nao se Aplica',
              render: (item) => (
                <button
                  type="button"
                  className="table-link-button"
                  onClick={() => abrirDemandasPorRelatorio(item, 'nao_se_aplica')}
                  disabled={item.nao_se_aplica === 0}
                  title="Abrir demandas relacionadas a nao se aplica"
                >
                  {item.nao_se_aplica}
                </button>
              ),
            },
            { title: 'Total', render: (item) => item.total_avaliacoes },
          ]}
        />
      </div>

    </div>
  );
}
