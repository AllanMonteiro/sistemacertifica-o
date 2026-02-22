import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  api,
  Avaliacao,
  Demanda,
  PRIORIDADE_LABELS,
  STATUS_ANDAMENTO_LABELS,
  STATUS_CONFORMIDADE_LABELS,
  StatusConformidade,
} from '../api';

type Props = {
  programaId: number | null;
  auditoriaId: number | null;
};

type FiltroConformidade = '' | 'nao_conformes' | StatusConformidade;

type EventoDia = {
  demanda_id: number;
  avaliacao_id: number;
  titulo: string;
  prioridade: Demanda['prioridade'];
  status_andamento: Demanda['status_andamento'];
  status_conformidade: StatusConformidade;
  tipo_data: 'inicio' | 'prazo';
  atrasada: boolean;
};

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
const ORDEM_PRIORIDADE: Record<Demanda['prioridade'], number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baixa: 3,
};

function inicioDoDia(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

function inicioDoMes(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), 1);
}

function fimDoMes(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth() + 1, 0);
}

function inicioSemanaSegunda(data: Date): Date {
  const dia = data.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  return new Date(data.getFullYear(), data.getMonth(), data.getDate() + diff);
}

function fimSemanaDomingo(data: Date): Date {
  const dia = data.getDay();
  const diff = dia === 0 ? 0 : 7 - dia;
  return new Date(data.getFullYear(), data.getMonth(), data.getDate() + diff);
}

function adicionarDias(data: Date, dias: number): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate() + dias);
}

function adicionarMeses(data: Date, meses: number): Date {
  return new Date(data.getFullYear(), data.getMonth() + meses, 1);
}

function paraChaveData(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function parseIsoDate(dataIso: string): Date {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  return new Date(ano, (mes || 1) - 1, dia || 1);
}

export default function Calendario({ programaId, auditoriaId }: Props) {
  const navigate = useNavigate();
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [mesAtual, setMesAtual] = useState<Date>(() => inicioDoMes(new Date()));
  const [incluirConcluidas, setIncluirConcluidas] = useState(false);
  const [filtroConformidade, setFiltroConformidade] = useState<FiltroConformidade>('nao_conformes');
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!programaId || !auditoriaId) return;
    const carregar = async () => {
      setErro('');
      try {
        const [demandasResp, avaliacoesResp] = await Promise.all([
          api.get<Demanda[]>('/demandas', {
            params: { programa_id: programaId, auditoria_id: auditoriaId },
          }),
          api.get<Avaliacao[]>('/avaliacoes', {
            params: { programa_id: programaId, auditoria_id: auditoriaId },
          }),
        ]);
        setDemandas(demandasResp.data);
        setAvaliacoes(avaliacoesResp.data);
      } catch (err: any) {
        setErro(err?.response?.data?.detail || 'Falha ao carregar calendario.');
      }
    };
    void carregar();
  }, [programaId, auditoriaId]);

  const statusConformidadePorAvaliacao = useMemo(
    () => new Map(avaliacoes.map((item) => [item.id, item.status_conformidade])),
    [avaliacoes]
  );

  const demandasFiltradas = useMemo(() => {
    return demandas.filter((demanda) => {
      if (!incluirConcluidas && demanda.status_andamento === 'concluida') return false;
      const statusConformidade = statusConformidadePorAvaliacao.get(demanda.avaliacao_id);
      if (!statusConformidade) return false;
      if (filtroConformidade === 'nao_conformes') {
        return statusConformidade === 'nc_menor' || statusConformidade === 'nc_maior';
      }
      if (filtroConformidade) {
        return statusConformidade === filtroConformidade;
      }
      return true;
    });
  }, [demandas, incluirConcluidas, filtroConformidade, statusConformidadePorAvaliacao]);

  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, EventoDia[]>();
    const hoje = inicioDoDia(new Date());

    const adicionarEvento = (chave: string, evento: EventoDia) => {
      const lista = mapa.get(chave) || [];
      lista.push(evento);
      mapa.set(chave, lista);
    };

    for (const demanda of demandasFiltradas) {
      const statusConformidade = statusConformidadePorAvaliacao.get(demanda.avaliacao_id);
      if (!statusConformidade) continue;

      if (demanda.start_date) {
        const inicio = parseIsoDate(demanda.start_date);
        adicionarEvento(paraChaveData(inicio), {
          demanda_id: demanda.id,
          avaliacao_id: demanda.avaliacao_id,
          titulo: demanda.titulo,
          prioridade: demanda.prioridade,
          status_andamento: demanda.status_andamento,
          status_conformidade: statusConformidade,
          tipo_data: 'inicio',
          atrasada: false,
        });
      }

      if (demanda.due_date) {
        const prazo = parseIsoDate(demanda.due_date);
        const atrasada = inicioDoDia(prazo) < hoje && demanda.status_andamento !== 'concluida';
        adicionarEvento(paraChaveData(prazo), {
          demanda_id: demanda.id,
          avaliacao_id: demanda.avaliacao_id,
          titulo: demanda.titulo,
          prioridade: demanda.prioridade,
          status_andamento: demanda.status_andamento,
          status_conformidade: statusConformidade,
          tipo_data: 'prazo',
          atrasada,
        });
      }
    }

    for (const [, lista] of mapa) {
      lista.sort((a, b) => {
        if (a.atrasada !== b.atrasada) return a.atrasada ? -1 : 1;
        const prioridade = ORDEM_PRIORIDADE[a.prioridade] - ORDEM_PRIORIDADE[b.prioridade];
        if (prioridade !== 0) return prioridade;
        if (a.tipo_data !== b.tipo_data) return a.tipo_data === 'prazo' ? -1 : 1;
        return b.demanda_id - a.demanda_id;
      });
    }
    return mapa;
  }, [demandasFiltradas, statusConformidadePorAvaliacao]);

  const celulasMes = useMemo(() => {
    const inicioGrid = inicioSemanaSegunda(inicioDoMes(mesAtual));
    const fimGrid = fimSemanaDomingo(fimDoMes(mesAtual));
    const dias: Date[] = [];
    let cursor = inicioGrid;
    while (cursor <= fimGrid) {
      dias.push(cursor);
      cursor = adicionarDias(cursor, 1);
    }
    return dias;
  }, [mesAtual]);

  const tituloMes = useMemo(
    () => mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    [mesAtual]
  );

  const totalEventos = useMemo(() => {
    let total = 0;
    for (const lista of eventosPorDia.values()) total += lista.length;
    return total;
  }, [eventosPorDia]);

  if (!programaId || !auditoriaId) {
    return <div className="card">Selecione Programa e Auditoria (Ano) para visualizar o calendario.</div>;
  }

  return (
    <div className="grid gap-16">
      <div className="card calendar-toolbar">
        <div className="calendar-month-nav">
          <button type="button" className="btn-secondary" onClick={() => setMesAtual((v) => adicionarMeses(v, -1))}>
            Mes anterior
          </button>
          <strong>{tituloMes}</strong>
          <button type="button" className="btn-secondary" onClick={() => setMesAtual((v) => adicionarMeses(v, 1))}>
            Proximo mes
          </button>
        </div>

        <div className="calendar-filters">
          <label className="form-row compact">
            <span>Status de Conformidade</span>
            <select
              value={filtroConformidade}
              onChange={(e) => setFiltroConformidade(e.target.value as FiltroConformidade)}
            >
              <option value="">Todos</option>
              <option value="nao_conformes">Nao Conformes (Menor + Maior)</option>
              <option value="nc_menor">{STATUS_CONFORMIDADE_LABELS.nc_menor}</option>
              <option value="nc_maior">{STATUS_CONFORMIDADE_LABELS.nc_maior}</option>
              <option value="oportunidade_melhoria">{STATUS_CONFORMIDADE_LABELS.oportunidade_melhoria}</option>
              <option value="conforme">{STATUS_CONFORMIDADE_LABELS.conforme}</option>
              <option value="nao_se_aplica">{STATUS_CONFORMIDADE_LABELS.nao_se_aplica}</option>
            </select>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={incluirConcluidas}
              onChange={(e) => setIncluirConcluidas(e.target.checked)}
            />
            <span>Incluir concluidas</span>
          </label>
          <span className="calendar-total-itens">{totalEventos} registros no mes</span>
        </div>
      </div>

      {erro && <div className="error">{erro}</div>}

      <div className="card">
        <div className="calendar-grid">
          {DIAS_SEMANA.map((dia) => (
            <div key={dia} className="calendar-weekday">
              {dia}
            </div>
          ))}

          {celulasMes.map((dia) => {
            const chave = paraChaveData(dia);
            const eventos = eventosPorDia.get(chave) || [];
            const foraDoMes = dia.getMonth() !== mesAtual.getMonth();
            const hoje = paraChaveData(inicioDoDia(new Date())) === chave;
            return (
              <div key={chave} className={`calendar-day${foraDoMes ? ' is-outside' : ''}${hoje ? ' is-today' : ''}`}>
                <div className="calendar-day-head">
                  <span>{dia.getDate()}</span>
                  {eventos.length > 0 && <small>{eventos.length}</small>}
                </div>
                <div className="calendar-events">
                  {eventos.slice(0, 4).map((evento) => (
                    <button
                      key={`${evento.demanda_id}-${evento.tipo_data}-${evento.avaliacao_id}`}
                      type="button"
                      className={`calendar-event prioridade-${evento.prioridade}${
                        evento.atrasada ? ' is-atrasada' : ''
                      }`}
                      onClick={() => navigate(`/avaliacoes/${evento.avaliacao_id}`)}
                      title={`${evento.tipo_data === 'inicio' ? 'Inicio' : 'Prazo'} | ${
                        STATUS_CONFORMIDADE_LABELS[evento.status_conformidade]
                      } | ${STATUS_ANDAMENTO_LABELS[evento.status_andamento]}`}
                    >
                      <strong>{evento.tipo_data === 'inicio' ? 'I' : 'P'}</strong>
                      <span>{evento.titulo}</span>
                    </button>
                  ))}
                  {eventos.length > 4 && <small className="calendar-more">+{eventos.length - 4} mais</small>}
                </div>
              </div>
            );
          })}
        </div>

        <p className="muted-text">
          Clique em um item para abrir a avaliacao relacionada. "I" = Data de inicio, "P" = Prazo.
          Cores indicam prioridade da demanda ({PRIORIDADE_LABELS.baixa}, {PRIORIDADE_LABELS.media},{' '}
          {PRIORIDADE_LABELS.alta}, {PRIORIDADE_LABELS.critica}).
        </p>
      </div>
    </div>
  );
}
