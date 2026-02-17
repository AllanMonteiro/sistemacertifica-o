import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  api,
  Avaliacao,
  Indicador,
  STATUS_CONFORMIDADE_LABELS,
  StatusConformidade,
} from '../api';
import Table from '../components/Table';

type Props = {
  programaId: number | null;
  auditoriaId: number | null;
};

const STATUS_OPTIONS: StatusConformidade[] = [
  'conforme',
  'nc_menor',
  'nc_maior',
  'oportunidade_melhoria',
  'nao_se_aplica',
];

export default function Avaliacoes({ programaId, auditoriaId }: Props) {
  const navigate = useNavigate();
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [statusFiltro, setStatusFiltro] = useState<string>('');
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const [novoIndicadorId, setNovoIndicadorId] = useState<number>(0);
  const [novoStatus, setNovoStatus] = useState<StatusConformidade>('conforme');
  const [novaObs, setNovaObs] = useState('');

  const carregar = async () => {
    if (!auditoriaId || !programaId) return;
    setErro('');
    try {
      const [aResp, iResp] = await Promise.all([
        api.get<Avaliacao[]>('/avaliacoes', {
          params: {
            programa_id: programaId,
            auditoria_id: auditoriaId,
            status_conformidade: statusFiltro || undefined,
          },
        }),
        api.get<Indicador[]>('/indicadores', { params: { programa_id: programaId } }),
      ]);
      setAvaliacoes(aResp.data);
      setIndicadores(iResp.data);
      if (!iResp.data.some((item) => item.id === novoIndicadorId)) {
        setNovoIndicadorId(iResp.data[0]?.id || 0);
      }
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao carregar avaliações.');
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId, auditoriaId, statusFiltro]);

  const indicadorMap = useMemo(() => new Map(indicadores.map((i) => [i.id, i])), [indicadores]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return avaliacoes;
    return avaliacoes.filter((a) => {
      const indicador = indicadorMap.get(a.indicator_id);
      const texto = `${indicador?.codigo || ''} ${indicador?.titulo || ''}`.toLowerCase();
      return texto.includes(termo);
    });
  }, [avaliacoes, busca, indicadorMap]);

  const criar = async (e: FormEvent) => {
    e.preventDefault();
    if (!auditoriaId || !programaId) return;
    setErro('');
    setMensagem('');
    try {
      await api.post('/avaliacoes', {
        indicator_id: Number(novoIndicadorId),
        auditoria_ano_id: auditoriaId,
        status_conformidade: novoStatus,
        observacoes: novaObs || null,
      });
      setNovaObs('');
      await carregar();
      setMensagem('Avaliação criada com sucesso.');
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao criar avaliação.');
    }
  };

  if (!auditoriaId) {
    return <div className="card">Selecione uma Auditoria (Ano) para gerenciar avaliações.</div>;
  }
  if (!programaId) {
    return <div className="card">Selecione um Programa de Certificação para gerenciar avaliações.</div>;
  }

  return (
    <div className="grid gap-16">
      <h2>Avaliações do Indicador</h2>

      <div className="card">
        <h3>Nova Avaliação</h3>
        <form className="grid four-col gap-12" onSubmit={criar}>
          <select value={novoIndicadorId} onChange={(e) => setNovoIndicadorId(Number(e.target.value))} required>
            {indicadores.map((indicador) => (
              <option key={indicador.id} value={indicador.id}>
                {indicador.codigo ? `${indicador.codigo} - ` : ''}
                {indicador.titulo}
              </option>
            ))}
          </select>

          <select value={novoStatus} onChange={(e) => setNovoStatus(e.target.value as StatusConformidade)}>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {STATUS_CONFORMIDADE_LABELS[status]}
              </option>
            ))}
          </select>

          <input
            placeholder="Justificativa/Observações"
            value={novaObs}
            onChange={(e) => setNovaObs(e.target.value)}
          />

          <button type="submit">Criar Avaliação</button>
        </form>
      </div>

      <div className="card">
        <div className="filters-row">
          <label className="form-row compact">
            <span>Status</span>
            <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)}>
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {STATUS_CONFORMIDADE_LABELS[status]}
                </option>
              ))}
            </select>
          </label>

          <label className="form-row compact">
            <span>Busca por Indicador</span>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Código ou título" />
          </label>
        </div>

        {erro && <div className="error">{erro}</div>}
        {mensagem && <div className="success">{mensagem}</div>}

        <Table
          rows={filtradas}
          columns={[
            {
              title: 'Indicador',
              render: (a) => {
                const indicador = indicadorMap.get(a.indicator_id);
                return indicador ? `${indicador.codigo ? `${indicador.codigo} - ` : ''}${indicador.titulo}` : a.indicator_id;
              },
            },
            { title: 'Status de Conformidade', render: (a) => STATUS_CONFORMIDADE_LABELS[a.status_conformidade] },
            { title: 'Justificativa', render: (a) => a.observacoes || '-' },
            {
              title: 'Ações',
              render: (a) => (
                <button type="button" onClick={() => navigate(`/avaliacoes/${a.id}`)}>
                  Detalhar
                </button>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
