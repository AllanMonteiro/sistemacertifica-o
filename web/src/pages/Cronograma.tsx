import { useEffect, useMemo, useState } from 'react';

import {
  api,
  CronogramaGanttItem,
  PRIORIDADE_LABELS,
  STATUS_ANDAMENTO_LABELS,
  STATUS_CONFORMIDADE_LABELS,
} from '../api';

type Props = {
  programaId: number | null;
  auditoriaId: number | null;
};

const prioridadeClasse: Record<string, string> = {
  baixa: 'bar-prioridade-baixa',
  media: 'bar-prioridade-media',
  alta: 'bar-prioridade-alta',
  critica: 'bar-prioridade-critica',
};

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function diffDays(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export default function Cronograma({ programaId, auditoriaId }: Props) {
  const [itens, setItens] = useState<CronogramaGanttItem[]>([]);
  const [incluirConcluidas, setIncluirConcluidas] = useState(true);
  const [erro, setErro] = useState('');

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
        setItens(data);
      } catch (err: any) {
        setErro(err?.response?.data?.detail || 'Falha ao carregar cronograma.');
      }
    };
    void carregar();
  }, [programaId, auditoriaId, incluirConcluidas]);

  const escala = useMemo(() => {
    if (itens.length === 0) return null;
    const minDate = itens
      .map((item) => toDate(item.data_inicio))
      .reduce((acc, date) => (date < acc ? date : acc));
    const maxDate = itens
      .map((item) => toDate(item.data_fim))
      .reduce((acc, date) => (date > acc ? date : acc));
    const totalDias = Math.max(1, diffDays(minDate, maxDate) + 1);
    return { minDate, maxDate, totalDias };
  }, [itens]);

  if (!programaId || !auditoriaId) {
    return <div className="card">Selecione Programa e Auditoria (Ano) para visualizar o cronograma Gantt.</div>;
  }

  return (
    <div className="grid gap-16">
      <h2>Cronograma de Ajuste de Não Conformidades</h2>

      <div className="card">
        <label className="form-row compact checkbox-row">
          <input
            type="checkbox"
            checked={incluirConcluidas}
            onChange={(e) => setIncluirConcluidas(e.target.checked)}
          />
          <span>Incluir demandas concluídas</span>
        </label>
      </div>

      {erro && <div className="error">{erro}</div>}

      <div className="card">
        {itens.length === 0 || !escala ? (
          <p>Não há demandas com data de início/fim para NC Maior, NC Menor ou Oportunidade de Melhoria.</p>
        ) : (
          <>
            <div className="gantt-header">
              <strong>Período:</strong>{' '}
              {escala.minDate.toLocaleDateString('pt-BR')} até {escala.maxDate.toLocaleDateString('pt-BR')}
            </div>

            <div className="gantt-list">
              {itens.map((item) => {
                const inicio = toDate(item.data_inicio);
                const fim = toDate(item.data_fim);
                const offset = (diffDays(escala.minDate, inicio) / escala.totalDias) * 100;
                const duracao = ((diffDays(inicio, fim) + 1) / escala.totalDias) * 100;
                const classe = prioridadeClasse[item.prioridade] || 'bar-prioridade-media';
                return (
                  <div key={item.demanda_id} className="gantt-row">
                    <div className="gantt-meta">
                      <strong>{item.titulo}</strong>
                      <span>
                        {item.indicador_titulo} | {STATUS_CONFORMIDADE_LABELS[item.status_conformidade]} |{' '}
                        {PRIORIDADE_LABELS[item.prioridade]} | {STATUS_ANDAMENTO_LABELS[item.status_andamento]}
                      </span>
                      <span>
                        Início: {item.data_inicio} | Fim: {item.data_fim}
                      </span>
                    </div>
                    <div className="gantt-track">
                      <div className={`gantt-bar ${classe}`} style={{ marginLeft: `${offset}%`, width: `${duracao}%` }}>
                        {item.data_inicio} → {item.data_fim}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
