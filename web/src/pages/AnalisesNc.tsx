import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  AnaliseNc,
  api,
  AuditLog,
  Avaliacao,
  Demanda,
  STATUS_ANALISE_NC_LABELS,
  STATUS_CONFORMIDADE_LABELS,
  StatusAnaliseNc,
  Usuario,
} from '../api';
import Table from '../components/Table';

type Props = {
  programaId: number | null;
  auditoriaId: number | null;
};

const STATUS_ANALISE_LIST: StatusAnaliseNc[] = ['aberta', 'em_analise', 'concluida'];
const STATUS_AVALIACAO_NC = ['nc_menor', 'nc_maior', 'oportunidade_melhoria'];
const CLASSE_STATUS_ANALISE: Record<StatusAnaliseNc, string> = {
  aberta: 'analise-status-aberta',
  em_analise: 'analise-status-em-analise',
  concluida: 'analise-status-concluida',
};

type FormAnalise = {
  avaliacao_id: number | '';
  demanda_id: number | '';
  titulo_problema: string;
  contexto: string;
  porque_1: string;
  porque_2: string;
  porque_3: string;
  porque_4: string;
  porque_5: string;
  causa_raiz: string;
  acao_corretiva: string;
  swot_forcas: string;
  swot_fraquezas: string;
  swot_oportunidades: string;
  swot_ameacas: string;
  status_analise: StatusAnaliseNc;
  responsavel_id: number | '';
};

const FORM_INICIAL: FormAnalise = {
  avaliacao_id: '',
  demanda_id: '',
  titulo_problema: '',
  contexto: '',
  porque_1: '',
  porque_2: '',
  porque_3: '',
  porque_4: '',
  porque_5: '',
  causa_raiz: '',
  acao_corretiva: '',
  swot_forcas: '',
  swot_fraquezas: '',
  swot_oportunidades: '',
  swot_ameacas: '',
  status_analise: 'aberta',
  responsavel_id: '',
};

function formatarDataHora(valor?: string | null): string {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '-';
  return data.toLocaleString('pt-BR');
}

export default function AnalisesNc({ programaId, auditoriaId }: Props) {
  const [usuarioAtual, setUsuarioAtual] = useState<Usuario | null>(null);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  const [analises, setAnalises] = useState<AnaliseNc[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  const [form, setForm] = useState<FormAnalise>(FORM_INICIAL);
  const [analiseEditandoId, setAnaliseEditandoId] = useState<number | null>(null);
  const [analiseSelecionadaId, setAnaliseSelecionadaId] = useState<number | null>(null);

  const [filtroStatus, setFiltroStatus] = useState<StatusAnaliseNc | ''>('');
  const [filtroAvaliacaoId, setFiltroAvaliacaoId] = useState<number | ''>('');
  const [busca, setBusca] = useState('');

  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const usuariosMap = useMemo(() => new Map(usuarios.map((item) => [item.id, item])), [usuarios]);
  const avaliacoesNc = useMemo(
    () => avaliacoes.filter((item) => STATUS_AVALIACAO_NC.includes(item.status_conformidade)),
    [avaliacoes]
  );
  const avaliacoesMap = useMemo(() => new Map(avaliacoes.map((item) => [item.id, item])), [avaliacoes]);
  const demandasMap = useMemo(() => new Map(demandas.map((item) => [item.id, item])), [demandas]);
  const analiseSelecionada = useMemo(
    () => analises.find((item) => item.id === analiseSelecionadaId) || null,
    [analises, analiseSelecionadaId]
  );
  const demandasDaAvaliacaoSelecionada = useMemo(
    () => demandas.filter((item) => item.avaliacao_id === Number(form.avaliacao_id || 0)),
    [demandas, form.avaliacao_id]
  );

  const podeGerirAnalises =
    usuarioAtual?.role === 'ADMIN' || usuarioAtual?.role === 'GESTOR' || usuarioAtual?.role === 'AUDITOR';
  const podeAtualizarStatus =
    usuarioAtual?.role === 'ADMIN' ||
    usuarioAtual?.role === 'GESTOR' ||
    usuarioAtual?.role === 'AUDITOR' ||
    usuarioAtual?.role === 'RESPONSAVEL';

  const tratarErro = (err: any, fallback: string) => {
    setErro(err?.response?.data?.detail || fallback);
  };

  const avisar = (texto: string) => {
    setMensagem(texto);
    setTimeout(() => setMensagem(''), 3000);
  };

  const descricaoAvaliacao = (avaliacaoId: number): string => {
    const avaliacao = avaliacoesMap.get(avaliacaoId);
    if (!avaliacao) return `Avaliacao #${avaliacaoId}`;
    return `${STATUS_CONFORMIDADE_LABELS[avaliacao.status_conformidade]} - Indicador #${avaliacao.indicator_id}`;
  };

  const carregarBase = async () => {
    if (!programaId || !auditoriaId) return;
    setErro('');
    try {
      const [meResp, avaliacoesResp, demandasResp] = await Promise.all([
        api.get<Usuario>('/auth/me'),
        api.get<Avaliacao[]>('/avaliacoes', { params: { programa_id: programaId, auditoria_id: auditoriaId } }),
        api.get<Demanda[]>('/demandas', { params: { programa_id: programaId, auditoria_id: auditoriaId } }),
      ]);
      setUsuarioAtual(meResp.data);
      setAvaliacoes(avaliacoesResp.data);
      setDemandas(demandasResp.data);
      try {
        const usuariosResp = await api.get<Usuario[]>('/usuarios');
        setUsuarios(usuariosResp.data);
      } catch {
        setUsuarios([]);
      }
      setForm((prev) => ({
        ...prev,
        avaliacao_id: prev.avaliacao_id || avaliacoesResp.data.find((item) => STATUS_AVALIACAO_NC.includes(item.status_conformidade))?.id || '',
      }));
    } catch (err: any) {
      tratarErro(err, 'Falha ao carregar dados base das analises.');
    }
  };

  const carregarAnalises = async () => {
    if (!programaId || !auditoriaId) {
      setAnalises([]);
      setAnaliseSelecionadaId(null);
      return;
    }
    try {
      const { data } = await api.get<AnaliseNc[]>('/analises-nc', {
        params: {
          programa_id: programaId,
          auditoria_id: auditoriaId,
          avaliacao_id: filtroAvaliacaoId || undefined,
          status_analise: filtroStatus || undefined,
        },
      });
      const termo = busca.trim().toLowerCase();
      const filtradas = termo
        ? data.filter((item) => {
            const demanda = item.demanda_id ? demandasMap.get(item.demanda_id)?.titulo || '' : '';
            const texto = `${item.titulo_problema} ${item.causa_raiz || ''} ${item.acao_corretiva || ''} ${demanda}`.toLowerCase();
            return texto.includes(termo);
          })
        : data;
      setAnalises(filtradas);
      setAnaliseSelecionadaId((atual) => (atual && filtradas.some((item) => item.id === atual) ? atual : filtradas[0]?.id || null));
    } catch (err: any) {
      tratarErro(err, 'Falha ao carregar analises.');
    }
  };

  const carregarLogs = async (analiseId: number | null) => {
    if (!analiseId) {
      setLogs([]);
      return;
    }
    try {
      const { data } = await api.get<AuditLog[]>(`/analises-nc/${analiseId}/logs`);
      setLogs(data);
    } catch (err: any) {
      tratarErro(err, 'Falha ao carregar logs da analise.');
    }
  };

  useEffect(() => {
    if (!programaId || !auditoriaId) return;
    setAnaliseEditandoId(null);
    setAnaliseSelecionadaId(null);
    setForm(FORM_INICIAL);
    void carregarBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId, auditoriaId]);

  useEffect(() => {
    void carregarAnalises();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId, auditoriaId, filtroStatus, filtroAvaliacaoId, busca, demandas]);

  useEffect(() => {
    void carregarLogs(analiseSelecionadaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analiseSelecionadaId]);

  const limparFormulario = () => {
    setForm((prev) => ({
      ...FORM_INICIAL,
      avaliacao_id: prev.avaliacao_id || avaliacoesNc[0]?.id || '',
    }));
    setAnaliseEditandoId(null);
  };

  const salvarAnalise = async (e: FormEvent) => {
    e.preventDefault();
    if (!auditoriaId || !form.avaliacao_id || !form.titulo_problema.trim()) {
      setErro('Informe avaliacao e titulo do problema.');
      return;
    }
    setErro('');
    const payload = {
      auditoria_ano_id: auditoriaId,
      avaliacao_id: Number(form.avaliacao_id),
      demanda_id: form.demanda_id || null,
      titulo_problema: form.titulo_problema,
      contexto: form.contexto || null,
      porque_1: form.porque_1 || null,
      porque_2: form.porque_2 || null,
      porque_3: form.porque_3 || null,
      porque_4: form.porque_4 || null,
      porque_5: form.porque_5 || null,
      causa_raiz: form.causa_raiz || null,
      acao_corretiva: form.acao_corretiva || null,
      swot_forcas: form.swot_forcas || null,
      swot_fraquezas: form.swot_fraquezas || null,
      swot_oportunidades: form.swot_oportunidades || null,
      swot_ameacas: form.swot_ameacas || null,
      status_analise: form.status_analise,
      responsavel_id: form.responsavel_id || null,
    };

    try {
      if (analiseEditandoId) {
        await api.put(`/analises-nc/${analiseEditandoId}`, payload);
        avisar('Analise atualizada com sucesso.');
      } else {
        await api.post('/analises-nc', payload);
        avisar('Analise criada com sucesso.');
      }
      limparFormulario();
      await carregarAnalises();
    } catch (err: any) {
      tratarErro(err, 'Falha ao salvar analise.');
    }
  };

  const editarAnalise = (analise: AnaliseNc) => {
    setAnaliseEditandoId(analise.id);
    setForm({
      avaliacao_id: analise.avaliacao_id,
      demanda_id: analise.demanda_id || '',
      titulo_problema: analise.titulo_problema,
      contexto: analise.contexto || '',
      porque_1: analise.porque_1 || '',
      porque_2: analise.porque_2 || '',
      porque_3: analise.porque_3 || '',
      porque_4: analise.porque_4 || '',
      porque_5: analise.porque_5 || '',
      causa_raiz: analise.causa_raiz || '',
      acao_corretiva: analise.acao_corretiva || '',
      swot_forcas: analise.swot_forcas || '',
      swot_fraquezas: analise.swot_fraquezas || '',
      swot_oportunidades: analise.swot_oportunidades || '',
      swot_ameacas: analise.swot_ameacas || '',
      status_analise: analise.status_analise,
      responsavel_id: analise.responsavel_id || '',
    });
  };

  const excluirAnalise = async (analise: AnaliseNc) => {
    if (!window.confirm('Deseja excluir esta analise de nao conformidade?')) return;
    setErro('');
    try {
      await api.delete(`/analises-nc/${analise.id}`);
      avisar('Analise removida com sucesso.');
      if (analiseSelecionadaId === analise.id) setAnaliseSelecionadaId(null);
      if (analiseEditandoId === analise.id) limparFormulario();
      await carregarAnalises();
    } catch (err: any) {
      tratarErro(err, 'Falha ao excluir analise.');
    }
  };

  const patchStatus = async (analise: AnaliseNc, novoStatus: StatusAnaliseNc) => {
    if (!podeAtualizarStatus) return;
    setErro('');
    try {
      await api.patch(`/analises-nc/${analise.id}/status`, { status_analise: novoStatus });
      avisar('Status da analise atualizado.');
      await carregarAnalises();
      await carregarLogs(analise.id);
    } catch (err: any) {
      tratarErro(err, 'Falha ao atualizar status da analise.');
    }
  };

  if (!programaId || !auditoriaId) {
    return <div className="card">Selecione Programa e Auditoria (Ano) para gerenciar analises de nao conformidade.</div>;
  }

  return (
    <div className="analise-nc-page grid gap-16">
      <h2>5 Porques e Matriz SWOT para Nao Conformidades</h2>

      {erro && <div className="error">{erro}</div>}
      {mensagem && <div className="success">{mensagem}</div>}

      <div className="card">
        <h3>{analiseEditandoId ? 'Editar Analise NC' : 'Nova Analise NC'}</h3>
        {podeGerirAnalises ? (
          <form className="grid gap-12" onSubmit={salvarAnalise}>
            <div className="analise-meta-grid grid gap-12">
              <label className="form-row">
                <span>Avaliacao NC/OM</span>
                <select
                  value={form.avaliacao_id}
                  onChange={(e) => {
                    const avaliacaoId = e.target.value ? Number(e.target.value) : '';
                    setForm((prev) => ({ ...prev, avaliacao_id: avaliacaoId, demanda_id: '' }));
                  }}
                  required
                >
                  <option value="">Selecione</option>
                  {avaliacoesNc.map((avaliacao) => (
                    <option key={avaliacao.id} value={avaliacao.id}>
                      {descricaoAvaliacao(avaliacao.id)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-row">
                <span>Demanda (opcional)</span>
                <select
                  value={form.demanda_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, demanda_id: e.target.value ? Number(e.target.value) : '' }))}
                >
                  <option value="">Sem demanda</option>
                  {demandasDaAvaliacaoSelecionada.map((demanda) => (
                    <option key={demanda.id} value={demanda.id}>
                      {demanda.titulo}
                    </option>
                  ))}
                </select>
              </label>

              <label className={`form-row analise-status-field ${CLASSE_STATUS_ANALISE[form.status_analise]}`}>
                <span>Status da Analise</span>
                <select
                  value={form.status_analise}
                  onChange={(e) => setForm((prev) => ({ ...prev, status_analise: e.target.value as StatusAnaliseNc }))}
                >
                  {STATUS_ANALISE_LIST.map((statusItem) => (
                    <option key={statusItem} value={statusItem}>
                      {STATUS_ANALISE_NC_LABELS[statusItem]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-row">
                <span>Responsavel</span>
                <select
                  value={form.responsavel_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, responsavel_id: e.target.value ? Number(e.target.value) : '' }))}
                >
                  <option value="">Sem responsavel</option>
                  {usuarios.map((usuario) => (
                    <option key={usuario.id} value={usuario.id}>
                      {usuario.nome} ({usuario.role})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="form-row">
              <span>Problema / Não Conformidade</span>
              <textarea
                rows={3}
                value={form.titulo_problema}
                onChange={(e) => setForm((prev) => ({ ...prev, titulo_problema: e.target.value }))}
                required
              />
            </label>

            <label className="form-row">
              <span>Contexto</span>
              <textarea
                rows={2}
                value={form.contexto}
                onChange={(e) => setForm((prev) => ({ ...prev, contexto: e.target.value }))}
              />
            </label>

            <div className="analise-porques-grid grid gap-12">
              <label className="form-row">
                <span>1º Porquê</span>
                <textarea rows={2} value={form.porque_1} onChange={(e) => setForm((prev) => ({ ...prev, porque_1: e.target.value }))} />
              </label>
              <label className="form-row">
                <span>2º Porquê</span>
                <textarea rows={2} value={form.porque_2} onChange={(e) => setForm((prev) => ({ ...prev, porque_2: e.target.value }))} />
              </label>
              <label className="form-row">
                <span>3º Porquê</span>
                <textarea rows={2} value={form.porque_3} onChange={(e) => setForm((prev) => ({ ...prev, porque_3: e.target.value }))} />
              </label>
              <label className="form-row">
                <span>4º Porquê</span>
                <textarea rows={2} value={form.porque_4} onChange={(e) => setForm((prev) => ({ ...prev, porque_4: e.target.value }))} />
              </label>
              <label className="form-row">
                <span>5º Porquê</span>
                <textarea rows={2} value={form.porque_5} onChange={(e) => setForm((prev) => ({ ...prev, porque_5: e.target.value }))} />
              </label>
            </div>

            <div className="analise-dupla-grid grid gap-12">
              <label className="form-row">
                <span>Causa Raiz</span>
                <textarea
                  rows={3}
                  value={form.causa_raiz}
                  onChange={(e) => setForm((prev) => ({ ...prev, causa_raiz: e.target.value }))}
                />
              </label>
              <label className="form-row">
                <span>Ação Corretiva</span>
                <textarea
                  rows={3}
                  value={form.acao_corretiva}
                  onChange={(e) => setForm((prev) => ({ ...prev, acao_corretiva: e.target.value }))}
                />
              </label>
            </div>

            <div className="analise-swot-grid grid gap-12">
              <label className="form-row swot-card swot-forcas">
                <span>SWOT - Forças</span>
                <textarea rows={3} value={form.swot_forcas} onChange={(e) => setForm((prev) => ({ ...prev, swot_forcas: e.target.value }))} />
              </label>
              <label className="form-row swot-card swot-fraquezas">
                <span>SWOT - Fraquezas</span>
                <textarea rows={3} value={form.swot_fraquezas} onChange={(e) => setForm((prev) => ({ ...prev, swot_fraquezas: e.target.value }))} />
              </label>
              <label className="form-row swot-card swot-oportunidades">
                <span>SWOT - Oportunidades</span>
                <textarea rows={3} value={form.swot_oportunidades} onChange={(e) => setForm((prev) => ({ ...prev, swot_oportunidades: e.target.value }))} />
              </label>
              <label className="form-row swot-card swot-ameacas">
                <span>SWOT - Ameaças</span>
                <textarea rows={3} value={form.swot_ameacas} onChange={(e) => setForm((prev) => ({ ...prev, swot_ameacas: e.target.value }))} />
              </label>
            </div>

            <div className="row-actions">
              {analiseEditandoId && (
                <button type="button" className="btn-secondary" onClick={limparFormulario}>
                  Cancelar Edicao
                </button>
              )}
              <button type="submit">{analiseEditandoId ? 'Salvar Alteracoes' : 'Criar Analise NC'}</button>
            </div>
          </form>
        ) : (
          <p className="muted-text">Seu perfil possui acesso de leitura para esta aba.</p>
        )}
      </div>

      <div className="card">
        <h3>Analises Registradas</h3>
        <div className="filters-row">
          <label className="form-row compact">
            <span>Status</span>
            <select value={filtroStatus} onChange={(e) => setFiltroStatus((e.target.value as StatusAnaliseNc) || '')}>
              <option value="">Todos</option>
              {STATUS_ANALISE_LIST.map((statusItem) => (
                <option key={statusItem} value={statusItem}>
                  {STATUS_ANALISE_NC_LABELS[statusItem]}
                </option>
              ))}
            </select>
          </label>

          <label className="form-row compact">
            <span>Avaliacao</span>
            <select value={filtroAvaliacaoId} onChange={(e) => setFiltroAvaliacaoId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Todas</option>
              {avaliacoesNc.map((avaliacao) => (
                <option key={avaliacao.id} value={avaliacao.id}>
                  {descricaoAvaliacao(avaliacao.id)}
                </option>
              ))}
            </select>
          </label>

          <label className="form-row compact">
            <span>Busca</span>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Problema, causa ou demanda" />
          </label>
        </div>

        <Table
          rows={analises}
          emptyText="Nenhuma analise encontrada."
          columns={[
            {
              title: 'Problema',
              render: (item) => (
                <div className={`analise-problema-cell ${CLASSE_STATUS_ANALISE[item.status_analise]}`}>
                  <strong>{item.titulo_problema}</strong>
                  <small>{STATUS_ANALISE_NC_LABELS[item.status_analise]}</small>
                </div>
              ),
            },
            { title: 'Avaliacao', render: (item) => descricaoAvaliacao(item.avaliacao_id) },
            { title: 'Demanda', render: (item) => (item.demanda_id ? demandasMap.get(item.demanda_id)?.titulo || item.demanda_id : '-') },
            {
              title: 'Status',
              render: (item) => (
                <div className={`analise-status-editor ${CLASSE_STATUS_ANALISE[item.status_analise]}`}>
                  <select
                    value={item.status_analise}
                    onChange={(e) => void patchStatus(item, e.target.value as StatusAnaliseNc)}
                    disabled={!podeAtualizarStatus}
                  >
                    {STATUS_ANALISE_LIST.map((statusItem) => (
                      <option key={statusItem} value={statusItem}>
                        {STATUS_ANALISE_NC_LABELS[statusItem]}
                      </option>
                    ))}
                  </select>
                </div>
              ),
            },
            { title: 'Responsavel', render: (item) => (item.responsavel_id ? usuariosMap.get(item.responsavel_id)?.nome || item.responsavel_id : '-') },
            { title: 'Atualizado em', render: (item) => formatarDataHora(item.updated_at) },
            {
              title: 'Ações',
              render: (item) => (
                <div className="row-actions">
                  <button type="button" className={item.id === analiseSelecionadaId ? 'btn-secondary' : ''} onClick={() => setAnaliseSelecionadaId(item.id)}>
                    {item.id === analiseSelecionadaId ? 'Selecionada' : 'Selecionar'}
                  </button>
                  {podeGerirAnalises && (
                    <button type="button" onClick={() => editarAnalise(item)}>
                      Editar
                    </button>
                  )}
                  {podeGerirAnalises && (
                    <button type="button" className="btn-danger" onClick={() => void excluirAnalise(item)}>
                      Excluir
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      {analiseSelecionada && (
        <div className="card">
          <h3>Detalhamento da Análise Selecionada</h3>

          <div className={`analise-detalhe-hero ${CLASSE_STATUS_ANALISE[analiseSelecionada.status_analise]}`}>
            <div className="analise-detalhe-head">
              <span className="analise-detalhe-tag">Status da Analise</span>
              <strong>{STATUS_ANALISE_NC_LABELS[analiseSelecionada.status_analise]}</strong>
            </div>
            <p>{analiseSelecionada.titulo_problema}</p>
          </div>

          <div className="analise-dupla-grid analise-detalhe-meta grid gap-12">
            <div>
              <strong>Avaliacao:</strong> {descricaoAvaliacao(analiseSelecionada.avaliacao_id)}
            </div>
            <div>
              <strong>Responsavel:</strong>{' '}
              {analiseSelecionada.responsavel_id ? usuariosMap.get(analiseSelecionada.responsavel_id)?.nome || analiseSelecionada.responsavel_id : '-'}
            </div>
            <div>
              <strong>Contexto:</strong> {analiseSelecionada.contexto || '-'}
            </div>
            <div>
              <strong>Causa Raiz:</strong> {analiseSelecionada.causa_raiz || '-'}
            </div>
            <div>
              <strong>Ação Corretiva:</strong> {analiseSelecionada.acao_corretiva || '-'}
            </div>
          </div>

          <h4>5 Porquês</h4>
          <Table
            rows={[
              { ordem: '1', valor: analiseSelecionada.porque_1 || '-' },
              { ordem: '2', valor: analiseSelecionada.porque_2 || '-' },
              { ordem: '3', valor: analiseSelecionada.porque_3 || '-' },
              { ordem: '4', valor: analiseSelecionada.porque_4 || '-' },
              { ordem: '5', valor: analiseSelecionada.porque_5 || '-' },
            ]}
            columns={[
              { title: 'Porquê', render: (item) => item.ordem },
              { title: 'Descrição', render: (item) => item.valor },
            ]}
          />

          <h4>Matriz SWOT</h4>
          <div className="analise-swot-grid grid gap-12">
            <div className="swot-card swot-forcas">
              <span>Forcas</span>
              <p>{analiseSelecionada.swot_forcas || '-'}</p>
            </div>
            <div className="swot-card swot-fraquezas">
              <span>Fraquezas</span>
              <p>{analiseSelecionada.swot_fraquezas || '-'}</p>
            </div>
            <div className="swot-card swot-oportunidades">
              <span>Oportunidades</span>
              <p>{analiseSelecionada.swot_oportunidades || '-'}</p>
            </div>
            <div className="swot-card swot-ameacas">
              <span>Ameacas</span>
              <p>{analiseSelecionada.swot_ameacas || '-'}</p>
            </div>
          </div>

          <h4>Rastreabilidade (Log de Auditoria)</h4>
          <Table
            rows={logs}
            emptyText="Sem eventos para esta análise."
            columns={[
              { title: 'Data/Hora', render: (item) => formatarDataHora(item.created_at) },
              { title: 'Ação', render: (item) => item.acao },
              { title: 'Usuário ID', render: (item) => item.created_by || '-' },
            ]}
          />
        </div>
      )}
    </div>
  );
}

