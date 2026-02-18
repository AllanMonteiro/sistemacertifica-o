import { useEffect, useMemo, useState } from 'react';

import {
  api,
  ConfiguracaoSistema,
  CronogramaGanttItem,
  PRIORIDADE_LABELS,
  STATUS_ANDAMENTO_LABELS,
  STATUS_CONFORMIDADE_LABELS,
  StatusConformidade,
} from '../api';

type Props = {
  programaId: number | null;
  auditoriaId: number | null;
};

type GanttWeek = {
  index: number;
  startDate: Date;
  endDate: Date;
  intervalLabel: string;
};

const DAY_MS = 1000 * 60 * 60 * 24;
const WEEK_WIDTH = 132;
const LEFT_WIDTH = 620;
const SEMANAS_POR_TELA = 8;

const prioridadeClasse: Record<string, string> = {
  baixa: 'gantt-bar-baixa',
  media: 'gantt-bar-media',
  alta: 'gantt-bar-alta',
  critica: 'gantt-bar-critica',
};

const progressoPorStatus: Record<string, number> = {
  aberta: 10,
  em_andamento: 50,
  em_validacao: 80,
  concluida: 100,
  bloqueada: 20,
};

const grupoClassePorStatus: Record<StatusConformidade, string> = {
  conforme: 'gantt-group-conforme',
  nc_menor: 'gantt-group-nc-menor',
  nc_maior: 'gantt-group-nc-maior',
  oportunidade_melhoria: 'gantt-group-om',
  nao_se_aplica: 'gantt-group-nsa',
};

function toDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function diffDays(start: Date, end: Date): number {
  const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUTC = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(0, Math.floor((endUTC - startUTC) / DAY_MS));
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

function formatDateBR(date: Date): string {
  return date.toLocaleDateString('pt-BR');
}

function formatWeekInterval(startDate: Date, endDate: Date): string {
  return `${formatDateBR(startDate)} a ${formatDateBR(endDate)}`;
}

function formatWeekCompact(startDate: Date, endDate: Date): string {
  const inicio = startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const fim = endDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${inicio} - ${fim}`;
}

function ordenarPorInicio(a: CronogramaGanttItem, b: CronogramaGanttItem): number {
  const inicioA = toDate(a.data_inicio).getTime();
  const inicioB = toDate(b.data_inicio).getTime();
  if (inicioA !== inicioB) return inicioA - inicioB;
  const fimA = toDate(a.data_fim).getTime();
  const fimB = toDate(b.data_fim).getTime();
  return fimA - fimB;
}

function calcularSemanaPorData(
  semanas: GanttWeek[],
  inicioEscala: Date,
  fimEscala: Date,
  referencia: Date
): number | null {
  if (semanas.length === 0) return null;
  const dia = startOfDay(referencia);
  if (dia < inicioEscala) return 1;
  if (dia > fimEscala) return semanas.length;
  return Math.floor(diffDays(inicioEscala, dia) / 7) + 1;
}

export default function Cronograma({ programaId, auditoriaId }: Props) {
  const [itens, setItens] = useState<CronogramaGanttItem[]>([]);
  const [incluirConcluidas, setIncluirConcluidas] = useState(true);
  const [semanaExibicao, setSemanaExibicao] = useState(1);
  const [semanaSelecionada, setSemanaSelecionada] = useState<number | null>(null);
  const [nomeEmpresa, setNomeEmpresa] = useState('Empresa');
  const [erro, setErro] = useState('');

  useEffect(() => {
    const carregarConfiguracao = async () => {
      try {
        const { data } = await api.get<ConfiguracaoSistema>('/configuracoes');
        setNomeEmpresa(data.nome_empresa || 'Empresa');
      } catch {
        setNomeEmpresa('Empresa');
      }
    };
    void carregarConfiguracao();
  }, []);

  useEffect(() => {
    if (!programaId || !auditoriaId) return;
    const carregar = async () => {
      try {
        setErro('');
        const { data } = await api.get<CronogramaGanttItem[]>('/reports/cronograma-nc', {
          params: {
            programa_id: programaId,
            auditoria_id: auditoriaId,
            incluir_concluidas: incluirConcluidas,
          },
        });
        setItens(data.sort(ordenarPorInicio));
      } catch (err: any) {
        setErro(err?.response?.data?.detail || 'Falha ao carregar cronograma.');
      }
    };
    void carregar();
  }, [programaId, auditoriaId, incluirConcluidas]);

  const escala = useMemo(() => {
    if (itens.length === 0) return null;
    const minDate = startOfDay(
      itens.map((item) => toDate(item.data_inicio)).reduce((acc, value) => (value < acc ? value : acc))
    );
    const maxDate = startOfDay(
      itens.map((item) => toDate(item.data_fim)).reduce((acc, value) => (value > acc ? value : acc))
    );
    const inicioEscala = startOfWeek(minDate);
    const fimEscala = addDays(startOfWeek(maxDate), 6);
    const totalSemanas = Math.floor(diffDays(inicioEscala, fimEscala) / 7) + 1;
    const semanas: GanttWeek[] = Array.from({ length: totalSemanas }, (_, index) => {
      const startDate = addDays(inicioEscala, index * 7);
      const endDate = addDays(startDate, 6);
      return {
        index: index + 1,
        startDate,
        endDate,
        intervalLabel: formatWeekInterval(startDate, endDate),
      };
    });

    return {
      minDate,
      maxDate,
      inicioEscala,
      fimEscala,
      semanas,
    };
  }, [itens]);

  const totalSemanas = escala?.semanas.length || 1;
  const semanaHoje = useMemo(() => {
    if (!escala) return null;
    return calcularSemanaPorData(escala.semanas, escala.inicioEscala, escala.fimEscala, new Date());
  }, [escala]);

  useEffect(() => {
    setSemanaExibicao((valorAtual) => {
      if (valorAtual < 1) return 1;
      if (valorAtual > totalSemanas) return totalSemanas;
      return valorAtual;
    });
  }, [totalSemanas]);

  const faixaVisivel = useMemo(() => {
    if (!escala) return null;
    const inicioSemana = Math.max(0, Math.min(semanaExibicao - 1, escala.semanas.length - 1));
    const fimSemana = Math.min(escala.semanas.length, inicioSemana + SEMANAS_POR_TELA);
    const semanasVisiveis = escala.semanas.slice(inicioSemana, fimSemana);
    if (semanasVisiveis.length === 0) return null;
    return {
      semanasVisiveis,
      startWeekOffset: inicioSemana,
      endWeekOffset: fimSemana - 1,
      timelineWidth: semanasVisiveis.length * WEEK_WIDTH,
    };
  }, [escala, semanaExibicao]);

  useEffect(() => {
    if (!faixaVisivel) return;
    const inicioVisivel = faixaVisivel.startWeekOffset + 1;
    const fimVisivel = faixaVisivel.endWeekOffset + 1;
    if (!semanaSelecionada || semanaSelecionada < inicioVisivel || semanaSelecionada > fimVisivel) {
      setSemanaSelecionada(inicioVisivel);
    }
  }, [faixaVisivel, semanaSelecionada]);

  const semanaSelecionadaInfo = useMemo(() => {
    if (!escala || !semanaSelecionada) return null;
    return escala.semanas.find((week) => week.index === semanaSelecionada) || null;
  }, [escala, semanaSelecionada]);

  const grupos = useMemo(() => {
    const ordem: StatusConformidade[] = ['nc_maior', 'nc_menor', 'oportunidade_melhoria'];
    return ordem
      .map((status) => ({
        status,
        label: STATUS_CONFORMIDADE_LABELS[status],
        itens: itens.filter((item) => item.status_conformidade === status),
      }))
      .filter((grupo) => grupo.itens.length > 0);
  }, [itens]);

  const irParaSemanaHoje = () => {
    if (!semanaHoje) return;
    const maxInicio = Math.max(1, totalSemanas - SEMANAS_POR_TELA + 1);
    const inicioFaixa = Math.min(maxInicio, Math.max(1, semanaHoje - Math.floor(SEMANAS_POR_TELA / 2)));
    setSemanaExibicao(inicioFaixa);
    setSemanaSelecionada(semanaHoje);
  };

  if (!programaId || !auditoriaId) {
    return <div className="card">Selecione Programa e Auditoria (Ano) para visualizar o cronograma Gantt.</div>;
  }

  return (
    <div className="grid gap-16">
      <h2>Cronograma de Ajuste de Nao Conformidades</h2>

      <div className="card">
        <div className="cronograma-info-grid">
          <div className="cronograma-info-item">
            <span>Nome da empresa</span>
            <strong>{nomeEmpresa}</strong>
          </div>
          <div className="cronograma-info-item">
            <span>Inicio do projeto</span>
            <strong>{escala ? formatDateBR(escala.minDate) : '-'}</strong>
          </div>
          <div className="cronograma-info-item">
            <span>Semana de exibicao</span>
            <div className="cronograma-semana-controls">
              <select value={semanaExibicao} onChange={(e) => setSemanaExibicao(Number(e.target.value))}>
                {Array.from({ length: totalSemanas }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    Semana {index + 1}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary cronograma-btn-hoje"
                onClick={irParaSemanaHoje}
                disabled={!semanaHoje}
              >
                Hoje
              </button>
            </div>
          </div>
          <label className="cronograma-info-item checkbox-row">
            <input
              type="checkbox"
              checked={incluirConcluidas}
              onChange={(e) => setIncluirConcluidas(e.target.checked)}
            />
            <span>Incluir demandas concluidas</span>
          </label>
        </div>
      </div>

      {erro && <div className="error">{erro}</div>}

      <div className="card">
        {itens.length === 0 || !escala || !faixaVisivel ? (
          <p>Nao ha demandas com datas para NC Maior, NC Menor ou Oportunidade de Melhoria.</p>
        ) : (
          <>
            <div className="gantt-header">
              <strong>Periodo:</strong> {formatDateBR(escala.inicioEscala)} ate {formatDateBR(escala.fimEscala)}
            </div>
            {semanaSelecionadaInfo && (
              <div className="gantt-week-detail">
                <strong>Semana {semanaSelecionadaInfo.index}</strong>
                <span>Inicio: {formatDateBR(semanaSelecionadaInfo.startDate)}</span>
                <span>Fim: {formatDateBR(semanaSelecionadaInfo.endDate)}</span>
              </div>
            )}

            <div className="gantt-sheet-scroll">
              <div className="gantt-sheet" style={{ minWidth: `${LEFT_WIDTH + faixaVisivel.timelineWidth}px` }}>
                <div className="gantt-sheet-row gantt-sheet-row-head">
                  <div className="gantt-left-head">
                    <div>Tarefa</div>
                    <div>Atribuido para</div>
                    <div>Progresso</div>
                    <div>Inicio</div>
                    <div>Termino</div>
                  </div>

                  <div className="gantt-right-head" style={{ width: `${faixaVisivel.timelineWidth}px` }}>
                    <div className="gantt-week-head-row">
                      {faixaVisivel.semanasVisiveis.map((week) => (
                        <button
                          key={`week-${week.index}`}
                          type="button"
                          className={`gantt-week-head-cell ${semanaSelecionada === week.index ? 'active' : ''}`}
                          style={{ width: `${WEEK_WIDTH}px` }}
                          onClick={() => setSemanaSelecionada(week.index)}
                          title={week.intervalLabel}
                        >
                          <span>Semana {week.index}</span>
                          <small>{formatWeekCompact(week.startDate, week.endDate)}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {grupos.map((grupo) => (
                  <div key={grupo.status}>
                    <div className="gantt-sheet-row">
                      <div className={`gantt-group-title ${grupoClassePorStatus[grupo.status]}`}>{grupo.label}</div>
                      <div className="gantt-group-timeline" style={{ width: `${faixaVisivel.timelineWidth}px` }} />
                    </div>

                    {grupo.itens.map((item) => {
                      const inicio = toDate(item.data_inicio);
                      const fim = toDate(item.data_fim);
                      const inicioSemana = Math.floor(diffDays(escala.inicioEscala, inicio) / 7);
                      const fimSemana = Math.floor(diffDays(escala.inicioEscala, fim) / 7);
                      const inicioVisivel = Math.max(inicioSemana, faixaVisivel.startWeekOffset);
                      const fimVisivel = Math.min(fimSemana, faixaVisivel.endWeekOffset);
                      const visivel = inicioVisivel <= fimVisivel;
                      const left = (inicioVisivel - faixaVisivel.startWeekOffset) * WEEK_WIDTH;
                      const width = Math.max(1, fimVisivel - inicioVisivel + 1) * WEEK_WIDTH;
                      const progresso = progressoPorStatus[item.status_andamento] ?? 0;
                      const classeBarra = prioridadeClasse[item.prioridade] || 'gantt-bar-media';

                      return (
                        <div key={item.demanda_id} className="gantt-sheet-row gantt-task-row">
                          <div className="gantt-left-row">
                            <div className="gantt-task-title">
                              <strong>{item.titulo}</strong>
                              <small>{item.indicador_titulo}</small>
                            </div>
                            <div>{item.responsavel_nome || 'Sem responsavel'}</div>
                            <div className="gantt-progress-cell">{progresso}%</div>
                            <div>{formatDateBR(inicio)}</div>
                            <div>{formatDateBR(fim)}</div>
                          </div>

                          <div className="gantt-right-row" style={{ width: `${faixaVisivel.timelineWidth}px` }}>
                            <div className="gantt-week-grid">
                              {faixaVisivel.semanasVisiveis.map((week) => (
                                <span
                                  key={`grid-${item.demanda_id}-w${week.index}`}
                                  className={`gantt-week-grid-cell ${semanaSelecionada === week.index ? 'active' : ''}`}
                                  style={{ width: `${WEEK_WIDTH}px` }}
                                />
                              ))}
                            </div>
                            {visivel && (
                              <div className={`gantt-bar ${classeBarra}`} style={{ left: `${left}px`, width: `${width}px` }}>
                                <span className="gantt-bar-progress" style={{ width: `${progresso}%` }} />
                                <span className="gantt-bar-label">{STATUS_ANDAMENTO_LABELS[item.status_andamento]}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <p className="muted-text">
              Prioridade: {PRIORIDADE_LABELS.baixa}, {PRIORIDADE_LABELS.media}, {PRIORIDADE_LABELS.alta} e{' '}
              {PRIORIDADE_LABELS.critica}. Andamento atual: {STATUS_ANDAMENTO_LABELS.aberta}, {STATUS_ANDAMENTO_LABELS.em_andamento},{' '}
              {STATUS_ANDAMENTO_LABELS.em_validacao}, {STATUS_ANDAMENTO_LABELS.bloqueada} e {STATUS_ANDAMENTO_LABELS.concluida}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
