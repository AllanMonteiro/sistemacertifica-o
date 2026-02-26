import {
  FormEvent,
  useEffect,
  useMemo,
  useState } from 'react';

import {
  api,
  Criterio,
  MonitoramentoCriterio,
  NotificacaoMonitoramento,
  Prioridade,
  PRIORIDADE_LABELS,
  ResolucaoNotificacao,
  STATUS_MONITORAMENTO_CRITERIO_LABELS,
  STATUS_NOTIFICACAO_MONITORAMENTO_LABELS,
  StatusMonitoramentoCriterio,
  StatusNotificacaoMonitoramento,
  Usuario,
  formatApiError,
} from '../api';
import Modal from '../components/Modal';
import Table from '../components/Table';

type Props = {
  programaId: number | null;
  auditoriaId: number | null;
};

const STATUS_MONITORAMENTO_LIST: StatusMonitoramentoCriterio[] = ['sem_dados', 'conforme', 'alerta', 'critico'];
const STATUS_NOTIFICACAO_LIST: StatusNotificacaoMonitoramento[] = ['aberta', 'em_tratamento', 'resolvida', 'cancelada'];
const PRIORIDADE_LIST: Prioridade[] = ['baixa', 'media', 'alta', 'critica'];

const today = new Date();
const MES_ATUAL_PADRAO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

function formatarData(valor?: string | null): string {
  if (!valor) return '-';
  const data = new Date(`${valor}T00:00:00`);
  if (Number.isNaN(data.getTime())) return '-';
  return data.toLocaleDateString('pt-BR');
}

function formatarDataHora(valor?: string | null): string {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '-';
  return data.toLocaleString('pt-BR');
}

function isoParaMes(iso?: string | null): string {
  if (!iso || iso.length < 7) return MES_ATUAL_PADRAO;
  return iso.slice(0, 7);
}

function mesParaIso(mes: string): string {
  return `${mes}-01`;
}

export default function Monitoramentos({ programaId, auditoriaId }: Props) {
  const [usuarioAtual, setUsuarioAtual] = useState<Usuario | null>(null);
  const [criterios, setCriterios] = useState<Criterio[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  const [monitoramentos, setMonitoramentos] = useState<MonitoramentoCriterio[]>([]);
  const [monitoramentoSelecionadoId, setMonitoramentoSelecionadoId] = useState<number | null>(null);
  const [notificacoes, setNotificacoes] = useState<NotificacaoMonitoramento[]>([]);
  const [notificacaoSelecionadaId, setNotificacaoSelecionadaId] = useState<number | null>(null);
  const [resolucoes, setResolucoes] = useState<ResolucaoNotificacao[]>([]);

  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const [filtroCriterioId, setFiltroCriterioId] = useState<number | ''>('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusMonitoramentoCriterio | ''>('');

  const [novoMonitoramento, setNovoMonitoramento] = useState({
    criterio_id: '' as number | '',
    mes_referencia: MES_ATUAL_PADRAO,
    status_monitoramento: 'sem_dados' as StatusMonitoramentoCriterio,
    observacoes: '',
  });

  const [novaNotificacao, setNovaNotificacao] = useState({
    titulo: '',
    descricao: '',
    severidade: 'media' as Prioridade,
    status_notificacao: 'aberta' as StatusNotificacaoMonitoramento,
    responsavel_id: '' as number | '',
    prazo: '',
  });

  const [novaResolucao, setNovaResolucao] = useState({
    descricao: '',
    resultado: '',
  });

  const [monitoramentoEdicao, setMonitoramentoEdicao] = useState<MonitoramentoCriterio | null>(null);
  const [edicaoMonitoramento, setEdicaoMonitoramento] = useState({
    criterio_id: '' as number | '',
    mes_referencia: MES_ATUAL_PADRAO,
    status_monitoramento: 'sem_dados' as StatusMonitoramentoCriterio,
    observacoes: '',
  });

  const [notificacaoEdicao, setNotificacaoEdicao] = useState<NotificacaoMonitoramento | null>(null);
  const [edicaoNotificacao, setEdicaoNotificacao] = useState({
    titulo: '',
    descricao: '',
    severidade: 'media' as Prioridade,
    status_notificacao: 'aberta' as StatusNotificacaoMonitoramento,
    responsavel_id: '' as number | '',
    prazo: '',
  });

  const criterioMap = useMemo(() => new Map(criterios.map((item) => [item.id, item])), [criterios]);
  const usuarioMap = useMemo(() => new Map(usuarios.map((item) => [item.id, item])), [usuarios]);
  const monitoramentoSelecionado = useMemo(
    () => monitoramentos.find((item) => item.id === monitoramentoSelecionadoId) || null,
    [monitoramentos, monitoramentoSelecionadoId]
  );
  const notificacaoSelecionada = useMemo(
    () => notificacoes.find((item) => item.id === notificacaoSelecionadaId) || null,
    [notificacoes, notificacaoSelecionadaId]
  );

  const criterioLabel = (criterioId: number): string => {
    const criterio = criterioMap.get(criterioId);
    if (!criterio) return `Critério #${criterioId}`;
    return `${criterio.codigo ? `${criterio.codigo} - ` : ''}${criterio.titulo}`;
  };

  const usuarioLabel = (usuarioId?: number | null): string => {
    if (!usuarioId) return '-';
    const usuario = usuarioMap.get(usuarioId);
    if (!usuario) return String(usuarioId);
    return usuario.nome;
  };

  const limparMensagem = () => {
    setTimeout(() => setMensagem(''), 3000);
  };

  const tratarErro = (err: any, fallback: string) => {
    setErro(formatApiError(err, fallback));
  };

  const carregarBase = async () => {
    if (!programaId) return;
    setErro('');
    try {
      const [criteriosResp, meResp] = await Promise.all([
        api.get<Criterio[]>('/criterios', { params: { programa_id: programaId } }),
        api.get<Usuario>('/auth/me'),
      ]);
      setCriterios(criteriosResp.data);
      setUsuarioAtual(meResp.data);
      setNovoMonitoramento((prev) => ({
        ...prev,
        criterio_id: prev.criterio_id || criteriosResp.data[0]?.id || '',
      }));
      try {
        const usuariosResp = await api.get<Usuario[]>('/usuarios');
        setUsuarios(usuariosResp.data);
      } catch {
        setUsuarios([]);
      }
    } catch (err: any) {
      tratarErro(err, 'Falha ao carregar base de monitoramento.');
    }
  };

  const carregarMonitoramentos = async () => {
    if (!programaId || !auditoriaId) {
      setMonitoramentos([]);
      setMonitoramentoSelecionadoId(null);
      return;
    }
    try {
      const { data } = await api.get<MonitoramentoCriterio[]>('/monitoramentos-criterio', {
        params: {
          programa_id: programaId,
          auditoria_id: auditoriaId,
          criterio_id: filtroCriterioId || undefined,
          mes_referencia: filtroMes ? mesParaIso(filtroMes) : undefined,
          status_monitoramento: filtroStatus || undefined,
        },
      });
      setMonitoramentos(data);
      setMonitoramentoSelecionadoId((atual) => {
        if (atual && data.some((item) => item.id === atual)) return atual;
        return data[0]?.id || null;
      });
    } catch (err: any) {
      tratarErro(err, 'Falha ao carregar monitoramentos.');
    }
  };

  const carregarNotificacoes = async () => {
    if (!monitoramentoSelecionadoId) {
      setNotificacoes([]);
      setNotificacaoSelecionadaId(null);
      return;
    }
    try {
      const { data } = await api.get<NotificacaoMonitoramento[]>(
        `/monitoramentos-criterio/${monitoramentoSelecionadoId}/notificacoes`
      );
      setNotificacoes(data);
      setNotificacaoSelecionadaId((atual) => {
        if (atual && data.some((item) => item.id === atual)) return atual;
        return data[0]?.id || null;
      });
    } catch (err: any) {
      tratarErro(err, 'Falha ao carregar notificações.');
    }
  };

  const carregarResolucoes = async () => {
    if (!notificacaoSelecionadaId) {
      setResolucoes([]);
      return;
    }
    try {
      const { data } = await api.get<ResolucaoNotificacao[]>(
        `/notificacoes-monitoramento/${notificacaoSelecionadaId}/resolucoes`
      );
      setResolucoes(data);
    } catch (err: any) {
      tratarErro(err, 'Falha ao carregar resoluções.');
    }
  };

  useEffect(() => {
    if (!programaId || !auditoriaId) return;
    setMonitoramentoSelecionadoId(null);
    setNotificacaoSelecionadaId(null);
    setNotificacoes([]);
    setResolucoes([]);
    void carregarBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId, auditoriaId]);

  useEffect(() => {
    void carregarMonitoramentos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId, auditoriaId, filtroCriterioId, filtroMes, filtroStatus]);

  useEffect(() => {
    void carregarNotificacoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monitoramentoSelecionadoId]);

  useEffect(() => {
    void carregarResolucoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificacaoSelecionadaId]);

  const podeGerirMonitoramentos =
    usuarioAtual?.role === 'ADMIN' || usuarioAtual?.role === 'GESTOR' || usuarioAtual?.role === 'AUDITOR';
  const podeExcluirMonitoramento = usuarioAtual?.role === 'ADMIN' || usuarioAtual?.role === 'GESTOR';
  const podeExcluirNotificacao =
    usuarioAtual?.role === 'ADMIN' || usuarioAtual?.role === 'GESTOR' || usuarioAtual?.role === 'AUDITOR';
  const podeCriarResolucao =
    usuarioAtual?.role === 'ADMIN' ||
    usuarioAtual?.role === 'GESTOR' ||
    usuarioAtual?.role === 'AUDITOR' ||
    usuarioAtual?.role === 'RESPONSAVEL';
  const podeExcluirResolucao =
    usuarioAtual?.role === 'ADMIN' || usuarioAtual?.role === 'GESTOR' || usuarioAtual?.role === 'AUDITOR';

  const criarMonitoramento = async (e: FormEvent) => {
    e.preventDefault();
    if (!auditoriaId || !novoMonitoramento.criterio_id || !novoMonitoramento.mes_referencia) {
      setErro('Selecione critério e mês de referência para criar o monitoramento.');
      return;
    }
    setErro('');
    try {
      const { data } = await api.post<MonitoramentoCriterio>('/monitoramentos-criterio', {
        auditoria_ano_id: auditoriaId,
        criterio_id: Number(novoMonitoramento.criterio_id),
        mes_referencia: mesParaIso(novoMonitoramento.mes_referencia),
        status_monitoramento: novoMonitoramento.status_monitoramento,
        observacoes: novoMonitoramento.observacoes || null,
      });
      setMensagem('Monitoramento criado com sucesso.');
      limparMensagem();
      setMonitoramentoSelecionadoId(data.id);
      setNovoMonitoramento((prev) => ({ ...prev, observacoes: '' }));
      await carregarMonitoramentos();
    } catch (err: any) {
      tratarErro(err, 'Não foi possível criar o monitoramento.');
    }
  };

  const abrirEdicaoMonitoramento = (item: MonitoramentoCriterio) => {
    setMonitoramentoEdicao(item);
    setEdicaoMonitoramento({
      criterio_id: item.criterio_id,
      mes_referencia: isoParaMes(item.mes_referencia),
      status_monitoramento: item.status_monitoramento,
      observacoes: item.observacoes || '',
    });
  };

  const salvarEdicaoMonitoramento = async (e: FormEvent) => {
    e.preventDefault();
    if (!monitoramentoEdicao || !edicaoMonitoramento.criterio_id || !edicaoMonitoramento.mes_referencia) return;
    setErro('');
    try {
      await api.put(`/monitoramentos-criterio/${monitoramentoEdicao.id}`, {
        criterio_id: Number(edicaoMonitoramento.criterio_id),
        mes_referencia: mesParaIso(edicaoMonitoramento.mes_referencia),
        status_monitoramento: edicaoMonitoramento.status_monitoramento,
        observacoes: edicaoMonitoramento.observacoes || null,
      });
      setMonitoramentoEdicao(null);
      setMensagem('Monitoramento atualizado com sucesso.');
      limparMensagem();
      await carregarMonitoramentos();
    } catch (err: any) {
      tratarErro(err, 'Não foi possível atualizar o monitoramento.');
    }
  };

  const excluirMonitoramento = async (item: MonitoramentoCriterio) => {
    if (!window.confirm('Deseja excluir este monitoramento?')) return;
    setErro('');
    try {
      await api.delete(`/monitoramentos-criterio/${item.id}`);
      setMensagem('Monitoramento removido com sucesso.');
      limparMensagem();
      await carregarMonitoramentos();
    } catch (err: any) {
      tratarErro(err, 'Não foi possível remover o monitoramento.');
    }
  };

  const criarNotificacao = async (e: FormEvent) => {
    e.preventDefault();
    if (!monitoramentoSelecionadoId || !novaNotificacao.titulo.trim()) {
      setErro('Informe o título da notificação.');
      return;
    }
    setErro('');
    try {
      const { data } = await api.post<NotificacaoMonitoramento>(
        `/monitoramentos-criterio/${monitoramentoSelecionadoId}/notificacoes`,
        {
          titulo: novaNotificacao.titulo.trim(),
          descricao: novaNotificacao.descricao || null,
          severidade: novaNotificacao.severidade,
          status_notificacao: novaNotificacao.status_notificacao,
          responsavel_id: novaNotificacao.responsavel_id || null,
          prazo: novaNotificacao.prazo || null,
        }
      );
      setMensagem('Notificação criada com sucesso.');
      limparMensagem();
      setNotificacaoSelecionadaId(data.id);
      setNovaNotificacao((prev) => ({ ...prev, titulo: '', descricao: '', prazo: '' }));
      await carregarNotificacoes();
    } catch (err: any) {
      tratarErro(err, 'Não foi possível criar a notificação.');
    }
  };

  const abrirEdicaoNotificacao = (item: NotificacaoMonitoramento) => {
    setNotificacaoEdicao(item);
    setEdicaoNotificacao({
      titulo: item.titulo,
      descricao: item.descricao || '',
      severidade: item.severidade,
      status_notificacao: item.status_notificacao,
      responsavel_id: item.responsavel_id || '',
      prazo: item.prazo || '',
    });
  };

  const salvarEdicaoNotificacao = async (e: FormEvent) => {
    e.preventDefault();
    if (!notificacaoEdicao) return;
    setErro('');
    try {
      await api.put(`/notificacoes-monitoramento/${notificacaoEdicao.id}`, {
        titulo: edicaoNotificacao.titulo,
        descricao: edicaoNotificacao.descricao || null,
        severidade: edicaoNotificacao.severidade,
        status_notificacao: edicaoNotificacao.status_notificacao,
        responsavel_id: edicaoNotificacao.responsavel_id || null,
        prazo: edicaoNotificacao.prazo || null,
      });
      setNotificacaoEdicao(null);
      setMensagem('Notificação atualizada com sucesso.');
      limparMensagem();
      await carregarNotificacoes();
    } catch (err: any) {
      tratarErro(err, 'Não foi possível atualizar a notificação.');
    }
  };

  const atualizarStatusNotificacao = async (
    item: NotificacaoMonitoramento,
    novoStatus: StatusNotificacaoMonitoramento
  ) => {
    setErro('');
    try {
      await api.patch(`/notificacoes-monitoramento/${item.id}/status`, {
        status_notificacao: novoStatus,
      });
      await carregarNotificacoes();
      setMensagem('Status da notificação atualizado.');
      limparMensagem();
    } catch (err: any) {
      tratarErro(err, 'Não foi possível atualizar o status da notificação.');
    }
  };

  const excluirNotificacao = async (item: NotificacaoMonitoramento) => {
    if (!window.confirm('Deseja excluir esta notificação?')) return;
    setErro('');
    try {
      await api.delete(`/notificacoes-monitoramento/${item.id}`);
      setMensagem('Notificação removida com sucesso.');
      limparMensagem();
      await carregarNotificacoes();
    } catch (err: any) {
      tratarErro(err, 'Não foi possível remover a notificação.');
    }
  };

  const criarResolucao = async (e: FormEvent) => {
    e.preventDefault();
    if (!notificacaoSelecionadaId || !novaResolucao.descricao.trim()) {
      setErro('Informe a descrição da resolução.');
      return;
    }
    setErro('');
    try {
      await api.post(`/notificacoes-monitoramento/${notificacaoSelecionadaId}/resolucoes`, {
        descricao: novaResolucao.descricao.trim(),
        resultado: novaResolucao.resultado || null,
      });
      setMensagem('Resolução registrada com sucesso.');
      limparMensagem();
      setNovaResolucao({ descricao: '', resultado: '' });
      await carregarResolucoes();
      await carregarNotificacoes();
    } catch (err: any) {
      tratarErro(err, 'Não foi possível registrar a resolução.');
    }
  };

  const excluirResolucao = async (item: ResolucaoNotificacao) => {
    if (!window.confirm('Deseja excluir esta resolução?')) return;
    setErro('');
    try {
      await api.delete(`/resolucoes-notificacao/${item.id}`);
      setMensagem('Resolução removida com sucesso.');
      limparMensagem();
      await carregarResolucoes();
    } catch (err: any) {
      tratarErro(err, 'Não foi possível remover a resolução.');
    }
  };

  if (!programaId || !auditoriaId) {
    return <div className="card">Selecione Programa e Auditoria (Ano) para monitorar critérios.</div>;
  }

  return (
    <div className="grid gap-16">
      <h2>Monitoramento de Critérios e Notificações</h2>

      {erro && <div className="error">{erro}</div>}
      {mensagem && <div className="success">{mensagem}</div>}

      <div className="card">
        <h3>Novo Monitoramento</h3>
        {podeGerirMonitoramentos ? (
          <form className="grid four-col gap-12" onSubmit={criarMonitoramento}>
            <label className="form-row">
              <span>Critério</span>
              <select
                value={novoMonitoramento.criterio_id}
                onChange={(e) =>
                  setNovoMonitoramento((prev) => ({ ...prev, criterio_id: e.target.value ? Number(e.target.value) : '' }))
                }
                required
              >
                <option value="">Selecione</option>
                {criterios.map((criterio) => (
                  <option key={criterio.id} value={criterio.id}>
                    {criterioLabel(criterio.id)}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-row">
              <span>Mês de Referência</span>
              <input
                type="month"
                value={novoMonitoramento.mes_referencia}
                onChange={(e) => setNovoMonitoramento((prev) => ({ ...prev, mes_referencia: e.target.value }))}
                required
              />
            </label>

            <label className="form-row">
              <span>Status de Monitoramento</span>
              <select
                value={novoMonitoramento.status_monitoramento}
                onChange={(e) =>
                  setNovoMonitoramento((prev) => ({
                    ...prev,
                    status_monitoramento: e.target.value as StatusMonitoramentoCriterio,
                  }))
                }
              >
                {STATUS_MONITORAMENTO_LIST.map((statusItem) => (
                  <option key={statusItem} value={statusItem}>
                    {STATUS_MONITORAMENTO_CRITERIO_LABELS[statusItem]}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-row">
              <span>Observações</span>
              <input
                value={novoMonitoramento.observacoes}
                onChange={(e) => setNovoMonitoramento((prev) => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Opcional"
              />
            </label>

            <button type="submit">Criar Monitoramento</button>
          </form>
        ) : (
          <p className="muted-text">Seu perfil possui acesso de leitura para monitoramentos.</p>
        )}
      </div>

      <div className="card">
        <h3>Monitoramentos Cadastrados</h3>
        <div className="filters-row">
          <label className="form-row compact">
            <span>Critério</span>
            <select
              value={filtroCriterioId}
              onChange={(e) => setFiltroCriterioId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Todos</option>
              {criterios.map((criterio) => (
                <option key={criterio.id} value={criterio.id}>
                  {criterioLabel(criterio.id)}
                </option>
              ))}
            </select>
          </label>

          <label className="form-row compact">
            <span>Mês</span>
            <input type="month" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} />
          </label>

          <label className="form-row compact">
            <span>Status</span>
            <select value={filtroStatus} onChange={(e) => setFiltroStatus((e.target.value as StatusMonitoramentoCriterio) || '')}>
              <option value="">Todos</option>
              {STATUS_MONITORAMENTO_LIST.map((statusItem) => (
                <option key={statusItem} value={statusItem}>
                  {STATUS_MONITORAMENTO_CRITERIO_LABELS[statusItem]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <Table
          rows={monitoramentos}
          emptyText="Nenhum monitoramento encontrado."
          columns={[
            { title: 'Critério', render: (item) => criterioLabel(item.criterio_id) },
            { title: 'Mês', render: (item) => formatarData(item.mes_referencia) },
            { title: 'Status', render: (item) => STATUS_MONITORAMENTO_CRITERIO_LABELS[item.status_monitoramento] },
            { title: 'Observações', render: (item) => item.observacoes || '-' },
            {
              title: 'Ações',
              render: (item) => (
                <div className="row-actions">
                  <button
                    type="button"
                    className={item.id === monitoramentoSelecionadoId ? 'btn-secondary' : ''}
                    onClick={() => setMonitoramentoSelecionadoId(item.id)}
                  >
                    {item.id === monitoramentoSelecionadoId ? 'Selecionado' : 'Selecionar'}
                  </button>
                  {podeGerirMonitoramentos && (
                    <button type="button" onClick={() => abrirEdicaoMonitoramento(item)}>
                      Editar
                    </button>
                  )}
                  {podeExcluirMonitoramento && (
                    <button type="button" className="btn-danger" onClick={() => void excluirMonitoramento(item)}>
                      Excluir
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      <div className="card">
        <h3>Notificações Geradas</h3>
        {!monitoramentoSelecionado ? (
          <p className="muted-text">Selecione um monitoramento para gerenciar notificações.</p>
        ) : (
          <>
            <p className="muted-text">
              Monitoramento ativo: <strong>{criterioLabel(monitoramentoSelecionado.criterio_id)}</strong> |{' '}
              {formatarData(monitoramentoSelecionado.mes_referencia)}
            </p>

            {podeGerirMonitoramentos && (
              <form className="grid four-col gap-12" onSubmit={criarNotificacao}>
                <label className="form-row">
                  <span>Título</span>
                  <input
                    value={novaNotificacao.titulo}
                    onChange={(e) => setNovaNotificacao((prev) => ({ ...prev, titulo: e.target.value }))}
                    placeholder="Título da notificação"
                    required
                  />
                </label>

                <label className="form-row">
                  <span>Severidade</span>
                  <select
                    value={novaNotificacao.severidade}
                    onChange={(e) =>
                      setNovaNotificacao((prev) => ({ ...prev, severidade: e.target.value as Prioridade }))
                    }
                  >
                    {PRIORIDADE_LIST.map((prioridade) => (
                      <option key={prioridade} value={prioridade}>
                        {PRIORIDADE_LABELS[prioridade]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-row">
                  <span>Status</span>
                  <select
                    value={novaNotificacao.status_notificacao}
                    onChange={(e) =>
                      setNovaNotificacao((prev) => ({
                        ...prev,
                        status_notificacao: e.target.value as StatusNotificacaoMonitoramento,
                      }))
                    }
                  >
                    {STATUS_NOTIFICACAO_LIST.map((statusItem) => (
                      <option key={statusItem} value={statusItem}>
                        {STATUS_NOTIFICACAO_MONITORAMENTO_LABELS[statusItem]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-row">
                  <span>Prazo</span>
                  <input
                    type="date"
                    value={novaNotificacao.prazo}
                    onChange={(e) => setNovaNotificacao((prev) => ({ ...prev, prazo: e.target.value }))}
                  />
                </label>

                <label className="form-row">
                  <span>Responsável</span>
                  <select
                    value={novaNotificacao.responsavel_id}
                    onChange={(e) =>
                      setNovaNotificacao((prev) => ({
                        ...prev,
                        responsavel_id: e.target.value ? Number(e.target.value) : '',
                      }))
                    }
                  >
                    <option value="">Sem responsável</option>
                    {usuarios.map((usuario) => (
                      <option key={usuario.id} value={usuario.id}>
                        {usuario.nome} ({usuario.role})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-row" style={{ gridColumn: 'span 3' }}>
                  <span>Descrição</span>
                  <input
                    value={novaNotificacao.descricao}
                    onChange={(e) => setNovaNotificacao((prev) => ({ ...prev, descricao: e.target.value }))}
                    placeholder="Descrição da notificação"
                  />
                </label>

                <button type="submit">Criar Notificação</button>
              </form>
            )}

            <Table
              rows={notificacoes}
              emptyText="Nenhuma notificação gerada para este monitoramento."
              columns={[
                { title: 'Título', render: (item) => item.titulo },
                { title: 'Severidade', render: (item) => PRIORIDADE_LABELS[item.severidade] },
                {
                  title: 'Status',
                  render: (item) => (
                    <select
                      value={item.status_notificacao}
                      onChange={(e) =>
                        void atualizarStatusNotificacao(item, e.target.value as StatusNotificacaoMonitoramento)
                      }
                    >
                      {STATUS_NOTIFICACAO_LIST.map((statusItem) => (
                        <option key={statusItem} value={statusItem}>
                          {STATUS_NOTIFICACAO_MONITORAMENTO_LABELS[statusItem]}
                        </option>
                      ))}
                    </select>
                  ),
                },
                { title: 'Responsável', render: (item) => usuarioLabel(item.responsavel_id) },
                { title: 'Prazo', render: (item) => formatarData(item.prazo) },
                {
                  title: 'Ações',
                  render: (item) => (
                    <div className="row-actions">
                      <button
                        type="button"
                        className={item.id === notificacaoSelecionadaId ? 'btn-secondary' : ''}
                        onClick={() => setNotificacaoSelecionadaId(item.id)}
                      >
                        {item.id === notificacaoSelecionadaId ? 'Selecionado' : 'Selecionar'}
                      </button>
                      {podeGerirMonitoramentos && (
                        <button type="button" onClick={() => abrirEdicaoNotificacao(item)}>
                          Editar
                        </button>
                      )}
                      {podeExcluirNotificacao && (
                        <button type="button" className="btn-danger" onClick={() => void excluirNotificacao(item)}>
                          Excluir
                        </button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </>
        )}
      </div>

      <div className="card">
        <h3>Resoluções da Notificação</h3>
        {!notificacaoSelecionada ? (
          <p className="muted-text">Selecione uma notificação para registrar e acompanhar resoluções.</p>
        ) : (
          <>
            <p className="muted-text">
              Notificação ativa: <strong>{notificacaoSelecionada.titulo}</strong>
            </p>

            {podeCriarResolucao && (
              <form className="grid two-col gap-12" onSubmit={criarResolucao}>
                <label className="form-row">
                  <span>Descrição da Resolução</span>
                  <textarea
                    rows={3}
                    value={novaResolucao.descricao}
                    onChange={(e) => setNovaResolucao((prev) => ({ ...prev, descricao: e.target.value }))}
                    placeholder="Descreva a ação de resolução"
                    required
                  />
                </label>

                <label className="form-row">
                  <span>Resultado</span>
                  <textarea
                    rows={3}
                    value={novaResolucao.resultado}
                    onChange={(e) => setNovaResolucao((prev) => ({ ...prev, resultado: e.target.value }))}
                    placeholder="Resultado obtido (opcional)"
                  />
                </label>

                <button type="submit">Registrar Resolução</button>
              </form>
            )}

            <Table
              rows={resolucoes}
              emptyText="Nenhuma resolução registrada para esta notificação."
              columns={[
                { title: 'Descrição', render: (item) => item.descricao },
                { title: 'Resultado', render: (item) => item.resultado || '-' },
                { title: 'Data/Hora', render: (item) => formatarDataHora(item.created_at) },
                { title: 'Autor', render: (item) => usuarioLabel(item.created_by) },
                {
                  title: 'Ações',
                  render: (item) =>
                    podeExcluirResolucao ? (
                      <button type="button" className="btn-danger" onClick={() => void excluirResolucao(item)}>
                        Excluir
                      </button>
                    ) : (
                      '-'
                    ),
                },
              ]}
            />
          </>
        )}
      </div>

      <Modal
        open={!!monitoramentoEdicao}
        title="Editar Monitoramento"
        onClose={() => setMonitoramentoEdicao(null)}
      >
        <form className="grid gap-12" onSubmit={salvarEdicaoMonitoramento}>
          <label className="form-row">
            <span>Critério</span>
            <select
              value={edicaoMonitoramento.criterio_id}
              onChange={(e) =>
                setEdicaoMonitoramento((prev) => ({ ...prev, criterio_id: e.target.value ? Number(e.target.value) : '' }))
              }
              required
            >
              <option value="">Selecione</option>
              {criterios.map((criterio) => (
                <option key={criterio.id} value={criterio.id}>
                  {criterioLabel(criterio.id)}
                </option>
              ))}
            </select>
          </label>

          <label className="form-row">
            <span>Mês de Referência</span>
            <input
              type="month"
              value={edicaoMonitoramento.mes_referencia}
              onChange={(e) => setEdicaoMonitoramento((prev) => ({ ...prev, mes_referencia: e.target.value }))}
              required
            />
          </label>

          <label className="form-row">
            <span>Status</span>
            <select
              value={edicaoMonitoramento.status_monitoramento}
              onChange={(e) =>
                setEdicaoMonitoramento((prev) => ({
                  ...prev,
                  status_monitoramento: e.target.value as StatusMonitoramentoCriterio,
                }))
              }
            >
              {STATUS_MONITORAMENTO_LIST.map((statusItem) => (
                <option key={statusItem} value={statusItem}>
                  {STATUS_MONITORAMENTO_CRITERIO_LABELS[statusItem]}
                </option>
              ))}
            </select>
          </label>

          <label className="form-row">
            <span>Observações</span>
            <textarea
              rows={3}
              value={edicaoMonitoramento.observacoes}
              onChange={(e) => setEdicaoMonitoramento((prev) => ({ ...prev, observacoes: e.target.value }))}
            />
          </label>

          <div className="row-actions">
            <button type="button" className="btn-secondary" onClick={() => setMonitoramentoEdicao(null)}>
              Cancelar
            </button>
            <button type="submit">Salvar</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!notificacaoEdicao}
        title="Editar Notificação"
        onClose={() => setNotificacaoEdicao(null)}
      >
        <form className="grid gap-12" onSubmit={salvarEdicaoNotificacao}>
          <label className="form-row">
            <span>Título</span>
            <input
              value={edicaoNotificacao.titulo}
              onChange={(e) => setEdicaoNotificacao((prev) => ({ ...prev, titulo: e.target.value }))}
              required
            />
          </label>

          <label className="form-row">
            <span>Descrição</span>
            <textarea
              rows={3}
              value={edicaoNotificacao.descricao}
              onChange={(e) => setEdicaoNotificacao((prev) => ({ ...prev, descricao: e.target.value }))}
            />
          </label>

          <label className="form-row">
            <span>Severidade</span>
            <select
              value={edicaoNotificacao.severidade}
              onChange={(e) =>
                setEdicaoNotificacao((prev) => ({ ...prev, severidade: e.target.value as Prioridade }))
              }
            >
              {PRIORIDADE_LIST.map((prioridade) => (
                <option key={prioridade} value={prioridade}>
                  {PRIORIDADE_LABELS[prioridade]}
                </option>
              ))}
            </select>
          </label>

          <label className="form-row">
            <span>Status</span>
            <select
              value={edicaoNotificacao.status_notificacao}
              onChange={(e) =>
                setEdicaoNotificacao((prev) => ({
                  ...prev,
                  status_notificacao: e.target.value as StatusNotificacaoMonitoramento,
                }))
              }
            >
              {STATUS_NOTIFICACAO_LIST.map((statusItem) => (
                <option key={statusItem} value={statusItem}>
                  {STATUS_NOTIFICACAO_MONITORAMENTO_LABELS[statusItem]}
                </option>
              ))}
            </select>
          </label>

          <label className="form-row">
            <span>Responsável</span>
            <select
              value={edicaoNotificacao.responsavel_id}
              onChange={(e) =>
                setEdicaoNotificacao((prev) => ({
                  ...prev,
                  responsavel_id: e.target.value ? Number(e.target.value) : '',
                }))
              }
            >
              <option value="">Sem responsável</option>
              {usuarios.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.nome} ({usuario.role})
                </option>
              ))}
            </select>
          </label>

          <label className="form-row">
            <span>Prazo</span>
            <input
              type="date"
              value={edicaoNotificacao.prazo}
              onChange={(e) => setEdicaoNotificacao((prev) => ({ ...prev, prazo: e.target.value }))}
            />
          </label>

          <div className="row-actions">
            <button type="button" className="btn-secondary" onClick={() => setNotificacaoEdicao(null)}>
              Cancelar
            </button>
            <button type="submit">Salvar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
