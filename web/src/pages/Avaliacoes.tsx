import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  api,
  Avaliacao,
  Criterio,
  Indicador,
  STATUS_CONFORMIDADE_LABELS,
  StatusConformidade,
} from '../api';
import Modal from '../components/Modal';
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
  const [criterios, setCriterios] = useState<Criterio[]>([]);
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [statusFiltro, setStatusFiltro] = useState<string>('');
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const [novoCriterioId, setNovoCriterioId] = useState<number>(0);
  const [novoIndicadorId, setNovoIndicadorId] = useState<number>(0);
  const [novoStatus, setNovoStatus] = useState<StatusConformidade>('conforme');
  const [novaObs, setNovaObs] = useState('');
  const [avaliacaoEdicao, setAvaliacaoEdicao] = useState<Avaliacao | null>(null);
  const [edicaoStatus, setEdicaoStatus] = useState<StatusConformidade>('conforme');
  const [edicaoObs, setEdicaoObs] = useState('');
  const [avaliacaoStatusAtualizandoId, setAvaliacaoStatusAtualizandoId] = useState<number | null>(null);

  const carregar = async () => {
    if (!auditoriaId || !programaId) return;
    setErro('');
    try {
      const [aResp, cResp, iResp] = await Promise.all([
        api.get<Avaliacao[]>('/avaliacoes', {
          params: {
            programa_id: programaId,
            auditoria_id: auditoriaId,
            status_conformidade: statusFiltro || undefined,
          },
        }),
        api.get<Criterio[]>('/criterios', { params: { programa_id: programaId } }),
        api.get<Indicador[]>('/indicadores', { params: { programa_id: programaId } }),
      ]);
      const indicadoresAvaliados = new Set(aResp.data.map((item) => item.indicator_id));
      const indicadoresDisponiveis = iResp.data.filter((item) => !indicadoresAvaliados.has(item.id));
      setAvaliacoes(aResp.data);
      setCriterios(cResp.data);
      setIndicadores(iResp.data);
      if (!indicadoresDisponiveis.some((item) => item.id === novoIndicadorId)) {
        setNovoIndicadorId(indicadoresDisponiveis[0]?.id || 0);
      }
      if (!indicadoresDisponiveis.some((item) => item.criterio_id === novoCriterioId)) {
        setNovoCriterioId(indicadoresDisponiveis[0]?.criterio_id || cResp.data[0]?.id || 0);
      }
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao carregar avaliações.');
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId, auditoriaId, statusFiltro]);

  const criterioMap = useMemo(() => new Map(criterios.map((c) => [c.id, c])), [criterios]);
  const indicadorMap = useMemo(() => new Map(indicadores.map((i) => [i.id, i])), [indicadores]);
  const indicadoresDisponiveis = useMemo(() => {
    const avaliados = new Set(avaliacoes.map((item) => item.indicator_id));
    return indicadores.filter((item) => !avaliados.has(item.id));
  }, [avaliacoes, indicadores]);
  const criteriosComIndicadorDisponivel = useMemo(() => {
    const ids = new Set(indicadoresDisponiveis.map((item) => item.criterio_id));
    return criterios.filter((item) => ids.has(item.id));
  }, [criterios, indicadoresDisponiveis]);
  const indicadoresDoCriterioSelecionado = useMemo(() => {
    if (!novoCriterioId) return indicadoresDisponiveis;
    return indicadoresDisponiveis.filter((item) => item.criterio_id === novoCriterioId);
  }, [indicadoresDisponiveis, novoCriterioId]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return avaliacoes;
    return avaliacoes.filter((a) => {
      const indicador = indicadorMap.get(a.indicator_id);
      const criterio = criterioMap.get(indicador?.criterio_id || 0);
      const texto = `${criterio?.codigo || ''} ${criterio?.titulo || ''} ${indicador?.codigo || ''} ${indicador?.titulo || ''}`.toLowerCase();
      return texto.includes(termo);
    });
  }, [avaliacoes, busca, indicadorMap, criterioMap]);

  useEffect(() => {
    if (!indicadoresDoCriterioSelecionado.some((item) => item.id === novoIndicadorId)) {
      setNovoIndicadorId(indicadoresDoCriterioSelecionado[0]?.id || 0);
    }
  }, [indicadoresDoCriterioSelecionado, novoIndicadorId]);

  const criar = async (e: FormEvent) => {
    e.preventDefault();
    if (!auditoriaId || !programaId) return;
    if (!novoIndicadorId) {
      setErro('Não há indicador disponível para criar avaliação nesta auditoria.');
      return;
    }
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

  const abrirEdicao = (avaliacao: Avaliacao) => {
    setAvaliacaoEdicao(avaliacao);
    setEdicaoStatus(avaliacao.status_conformidade);
    setEdicaoObs(avaliacao.observacoes || '');
  };

  const fecharEdicao = () => {
    setAvaliacaoEdicao(null);
    setEdicaoStatus('conforme');
    setEdicaoObs('');
  };

  const salvarEdicao = async (e: FormEvent) => {
    e.preventDefault();
    if (!avaliacaoEdicao) return;
    setErro('');
    setMensagem('');
    try {
      await api.patch(`/avaliacoes/${avaliacaoEdicao.id}`, {
        status_conformidade: edicaoStatus,
        observacoes: edicaoObs || null,
      });
      await carregar();
      fecharEdicao();
      setMensagem('Avaliação atualizada com sucesso.');
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao atualizar avaliação.');
    }
  };

  const atualizarStatusDireto = async (avaliacao: Avaliacao, statusConformidade: StatusConformidade) => {
    if (avaliacao.status_conformidade === statusConformidade) return;
    setErro('');
    setMensagem('');
    setAvaliacaoStatusAtualizandoId(avaliacao.id);
    try {
      await api.patch(`/avaliacoes/${avaliacao.id}`, {
        status_conformidade: statusConformidade,
        observacoes: avaliacao.observacoes || null,
      });
      await carregar();
      setMensagem('Status de conformidade atualizado.');
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao atualizar status da avaliação.');
    } finally {
      setAvaliacaoStatusAtualizandoId(null);
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
          <select value={novoCriterioId} onChange={(e) => setNovoCriterioId(Number(e.target.value))} required>
            {criteriosComIndicadorDisponivel.map((criterio) => (
              <option key={criterio.id} value={criterio.id}>
                {criterio.codigo ? `${criterio.codigo} - ` : ''}
                {criterio.titulo}
              </option>
            ))}
          </select>

          <select value={novoIndicadorId} onChange={(e) => setNovoIndicadorId(Number(e.target.value))} required>
            {indicadoresDoCriterioSelecionado.map((indicador) => (
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

          <button type="submit" disabled={indicadoresDisponiveis.length === 0}>
            Criar Avaliação
          </button>
        </form>
        {indicadoresDisponiveis.length === 0 && (
          <p className="muted-text">Todos os indicadores deste programa já possuem avaliação para esta auditoria.</p>
        )}
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
              title: 'Critério',
              render: (a) => {
                const indicador = indicadorMap.get(a.indicator_id);
                const criterio = criterioMap.get(indicador?.criterio_id || 0);
                if (!criterio) return '-';
                return `${criterio.codigo ? `${criterio.codigo} - ` : ''}${criterio.titulo}`;
              },
            },
            {
              title: 'Indicador',
              render: (a) => {
                const indicador = indicadorMap.get(a.indicator_id);
                return indicador ? `${indicador.codigo ? `${indicador.codigo} - ` : ''}${indicador.titulo}` : a.indicator_id;
              },
            },
            {
              title: 'Status de Conformidade',
              render: (a) => (
                <select
                  value={a.status_conformidade}
                  disabled={avaliacaoStatusAtualizandoId === a.id}
                  onChange={(e) => void atualizarStatusDireto(a, e.target.value as StatusConformidade)}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_CONFORMIDADE_LABELS[status]}
                    </option>
                  ))}
                </select>
              ),
            },
            { title: 'Justificativa', render: (a) => a.observacoes || '-' },
            {
              title: 'Ações',
              render: (a) => (
                <div className="row-actions">
                  <button type="button" onClick={() => abrirEdicao(a)}>
                    Editar
                  </button>
                  <button type="button" onClick={() => navigate(`/avaliacoes/${a.id}`)}>
                    Detalhar
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>

      <Modal open={!!avaliacaoEdicao} title="Editar Avaliação" onClose={fecharEdicao}>
        <form className="grid gap-12" onSubmit={salvarEdicao}>
          <label className="form-row">
            <span>Status de Conformidade</span>
            <select value={edicaoStatus} onChange={(e) => setEdicaoStatus(e.target.value as StatusConformidade)}>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {STATUS_CONFORMIDADE_LABELS[status]}
                </option>
              ))}
            </select>
          </label>

          <label className="form-row">
            <span>Justificativa/Observações</span>
            <input
              value={edicaoObs}
              onChange={(e) => setEdicaoObs(e.target.value)}
              placeholder="Informe justificativa ou observações"
            />
          </label>

          <div className="row-actions">
            <button type="button" onClick={fecharEdicao}>
              Cancelar
            </button>
            <button type="submit">Salvar Alterações</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
