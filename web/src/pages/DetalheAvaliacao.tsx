import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  api,
  AvaliacaoDetalhe,
  PRIORIDADE_LABELS,
  Prioridade,
  STATUS_ANDAMENTO_LABELS,
  STATUS_CONFORMIDADE_LABELS,
  StatusAndamento,
  StatusConformidade,
  TipoEvidencia,
  Usuario,
} from '../api';
import Modal from '../components/Modal';
import Table from '../components/Table';

const STATUS_CONFORMIDADE_LIST: StatusConformidade[] = [
  'conforme',
  'nc_menor',
  'nc_maior',
  'oportunidade_melhoria',
  'nao_se_aplica',
];

const STATUS_DEMANDA_LIST: StatusAndamento[] = ['aberta', 'em_andamento', 'em_validacao', 'concluida', 'bloqueada'];
const PRIORIDADE_LIST: Prioridade[] = ['baixa', 'media', 'alta', 'critica'];

export default function DetalheAvaliacao() {
  const { id } = useParams();
  const navigate = useNavigate();
  const avaliacaoId = Number(id);

  const [detalhe, setDetalhe] = useState<AvaliacaoDetalhe | null>(null);
  const [tipos, setTipos] = useState<TipoEvidencia[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  const [statusConformidade, setStatusConformidade] = useState<StatusConformidade>('conforme');
  const [observacoes, setObservacoes] = useState('');

  const [tipoEvidenciaId, setTipoEvidenciaId] = useState<number | ''>('');
  const [kind, setKind] = useState<'link' | 'texto'>('link');
  const [urlOuTexto, setUrlOuTexto] = useState('');
  const [evidenciaNaoConforme, setEvidenciaNaoConforme] = useState(false);
  const [obsEvidencia, setObsEvidencia] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);

  const [demanda, setDemanda] = useState({
    titulo: '',
    padrao: '',
    descricao: '',
    responsavel_id: '' as number | '',
    start_date: '',
    due_date: '',
    status_andamento: 'aberta' as StatusAndamento,
    prioridade: 'media' as Prioridade,
  });

  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const tiposMap = new Map(tipos.map((tipo) => [tipo.id, tipo.nome]));
  const usuariosMap = new Map(usuarios.map((usuario) => [usuario.id, usuario]));
  const [modalResponsavelOpen, setModalResponsavelOpen] = useState(false);
  const [novoResponsavel, setNovoResponsavel] = useState({ nome: '', email: '', senha: '' });
  const [criandoResponsavel, setCriandoResponsavel] = useState(false);

  const carregar = async () => {
    if (!avaliacaoId) return;
    setErro('');
    try {
      const detalheResp = await api.get<AvaliacaoDetalhe>(`/avaliacoes/${avaliacaoId}/detalhe`);
      setDetalhe(detalheResp.data);
      setStatusConformidade(detalheResp.data.avaliacao.status_conformidade);
      setObservacoes(detalheResp.data.avaliacao.observacoes || '');

      const tiposResp = await api.get<TipoEvidencia[]>('/tipos-evidencia', {
        params: {
          programa_id: detalheResp.data.avaliacao.programa_id,
          criterio_id: detalheResp.data.criterio.id,
          indicator_id: detalheResp.data.indicador.id,
        },
      });
      setTipos(tiposResp.data);
      setTipoEvidenciaId(tiposResp.data[0]?.id || '');

      try {
        const usuariosResp = await api.get<Usuario[]>('/usuarios');
        const responsaveis = usuariosResp.data.filter((u) => u.role === 'RESPONSAVEL');
        setUsuarios(responsaveis);
        if (responsaveis[0]) {
          setDemanda((prev) => ({ ...prev, responsavel_id: prev.responsavel_id || responsaveis[0].id }));
        }
      } catch {
        setUsuarios([]);
      }
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao carregar detalhe da avaliação.');
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avaliacaoId]);

  const sucesso = (msg: string) => {
    setMensagem(msg);
    setTimeout(() => setMensagem(''), 2500);
  };

  const erroApi = (err: any) => {
    setErro(err?.response?.data?.detail || 'Erro na operação.');
  };

  const atualizarAvaliacao = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    try {
      await api.patch(`/avaliacoes/${avaliacaoId}`, {
        status_conformidade: statusConformidade,
        observacoes: observacoes || null,
      });
      await carregar();
      sucesso('Avaliação atualizada.');
    } catch (err) {
      erroApi(err);
    }
  };

  const criarEvidenciaTextoLink = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    try {
      await api.post('/evidencias', {
        avaliacao_id: avaliacaoId,
        tipo_evidencia_id: tipoEvidenciaId || null,
        kind,
        url_or_path: urlOuTexto,
        nao_conforme: evidenciaNaoConforme,
        observacoes: obsEvidencia || null,
      });
      setUrlOuTexto('');
      setEvidenciaNaoConforme(false);
      setObsEvidencia('');
      await carregar();
      sucesso('Evidência adicionada.');
    } catch (err) {
      erroApi(err);
    }
  };

  const uploadArquivo = async (e: FormEvent) => {
    e.preventDefault();
    if (!arquivo) {
      setErro('Selecione um arquivo para upload.');
      return;
    }
    setErro('');
    try {
      const formData = new FormData();
      formData.append('avaliacao_id', String(avaliacaoId));
      if (tipoEvidenciaId) {
        formData.append('tipo_evidencia_id', String(tipoEvidenciaId));
      }
      formData.append('nao_conforme', evidenciaNaoConforme ? 'true' : 'false');
      if (obsEvidencia) {
        formData.append('observacoes', obsEvidencia);
      }
      formData.append('file', arquivo);
      await api.post('/evidencias/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setArquivo(null);
      setEvidenciaNaoConforme(false);
      setObsEvidencia('');
      await carregar();
      sucesso('Upload de evidência concluído.');
    } catch (err) {
      erroApi(err);
    }
  };

  const criarDemanda = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    try {
      await api.post('/demandas', {
        avaliacao_id: avaliacaoId,
        titulo: demanda.titulo,
        padrao: demanda.padrao || null,
        descricao: demanda.descricao || null,
        responsavel_id: demanda.responsavel_id || null,
        start_date: demanda.start_date || null,
        due_date: demanda.due_date || null,
        status_andamento: demanda.status_andamento,
        prioridade: demanda.prioridade,
      });
      setDemanda((prev) => ({ ...prev, titulo: '', padrao: '', descricao: '', start_date: '', due_date: '' }));
      await carregar();
      sucesso('Demanda criada.');
    } catch (err) {
      erroApi(err);
    }
  };

  const cadastrarResponsavel = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    setMensagem('');
    setCriandoResponsavel(true);
    try {
      const { data } = await api.post<Usuario>('/usuarios/responsaveis', {
        nome: novoResponsavel.nome,
        email: novoResponsavel.email,
        senha: novoResponsavel.senha,
      });
      setUsuarios((prev) => {
        const atualizados = [...prev, data];
        atualizados.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        return atualizados;
      });
      setDemanda((prev) => ({ ...prev, responsavel_id: data.id }));
      setNovoResponsavel({ nome: '', email: '', senha: '' });
      setModalResponsavelOpen(false);
      setMensagem('Responsável cadastrado e vinculado à demanda.');
    } catch (err) {
      erroApi(err);
    } finally {
      setCriandoResponsavel(false);
    }
  };

  if (!detalhe) {
    return <div className="card">Carregando detalhe da avaliação...</div>;
  }

  return (
    <div className="grid gap-16 detalhe-avaliacao-page">
      <h2>Detalhe da Avaliação</h2>

      <div className="card detalhe-trilha-card">
        <span className="detalhe-trilha-label">Trilha do Indicador</span>
        <strong className="detalhe-trilha-path">
          {detalhe.principio.titulo} {'>'} {detalhe.criterio.titulo} {'>'} {detalhe.indicador.titulo}
        </strong>
      </div>

      {erro && <div className="error">{erro}</div>}
      {mensagem && <div className="success">{mensagem}</div>}

      <div className="card">
        <h3>Avaliação do Indicador</h3>
        <form className="detalhe-avaliacao-form" onSubmit={atualizarAvaliacao}>
          <div className="grid two-col gap-12">
            <label className="form-row">
              <span>Status de Conformidade</span>
              <select
                value={statusConformidade}
                onChange={(e) => setStatusConformidade(e.target.value as StatusConformidade)}
              >
                {STATUS_CONFORMIDADE_LIST.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_CONFORMIDADE_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-row">
              <span>Justificativa/Observações</span>
              <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={4} />
            </label>
          </div>
          <div className="detalhe-form-actions">
            <button type="submit">Salvar Avaliação</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Evidências</h3>

        <Table
          rows={detalhe.evidencias}
          columns={[
            {
              title: 'Tipo',
              render: (e) => (e.tipo_evidencia_id ? tiposMap.get(e.tipo_evidencia_id) || e.tipo_evidencia_id : '-'),
            },
            { title: 'Formato', render: (e) => e.kind },
            { title: 'URL/Caminho/Texto', render: (e) => e.url_or_path },
            { title: 'Observações', render: (e) => e.observacoes || '-' },
            {
              title: 'Conformidade da Evidência',
              render: (e) => (
                <span className={`badge-conformidade-evidencia ${e.nao_conforme ? 'nao-conforme' : 'conforme'}`}>
                  {e.nao_conforme ? 'Não Conforme' : 'Conforme'}
                </span>
              ),
            },
            {
              title: 'Documentos',
              render: (e) => (
                <button type="button" onClick={() => navigate(`/documentos?evidencia_id=${e.id}`)}>
                  Construir/Revisar
                </button>
              ),
            },
          ]}
        />

        <form className="detalhe-evidencia-form" onSubmit={criarEvidenciaTextoLink}>
          <div className="grid four-col gap-12">
            <label className="form-row">
              <span>Tipo de Evidência</span>
              <select
                value={tipoEvidenciaId}
                onChange={(e) => setTipoEvidenciaId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Sem tipo</option>
                {tipos.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nome}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-row">
              <span>Formato</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as 'link' | 'texto')}>
                <option value="link">Link</option>
                <option value="texto">Texto</option>
              </select>
            </label>

            <label className="form-row">
              <span>{kind === 'link' ? 'URL da Evidência' : 'Texto da Evidência'}</span>
              <input
                placeholder={kind === 'link' ? 'https://...' : 'Descreva a evidência textual'}
                value={urlOuTexto}
                onChange={(e) => setUrlOuTexto(e.target.value)}
                required
              />
            </label>

            <label className="form-row">
              <span>Conformidade da Evidência</span>
              <select
                value={evidenciaNaoConforme ? 'nao_conforme' : 'conforme'}
                onChange={(e) => setEvidenciaNaoConforme(e.target.value === 'nao_conforme')}
              >
                <option value="conforme">Conforme</option>
                <option value="nao_conforme">Não Conforme</option>
              </select>
            </label>
          </div>

          <div className="grid two-col gap-12">
            <label className="form-row">
              <span>Observações</span>
              <input
                placeholder="Informações adicionais"
                value={obsEvidencia}
                onChange={(e) => setObsEvidencia(e.target.value)}
              />
            </label>
            <div className="detalhe-form-actions align-end">
              <button type="submit">Adicionar Evidência (Link/Texto)</button>
            </div>
          </div>
        </form>

        <form className="detalhe-upload-form" onSubmit={uploadArquivo}>
          <label className="form-row">
            <span>Arquivo de Evidência</span>
            <input type="file" onChange={(e) => setArquivo(e.target.files?.[0] || null)} required />
          </label>
          <div className="detalhe-form-actions align-end">
            <button type="submit">Upload de Arquivo</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Demandas</h3>
        <Table
          rows={detalhe.demandas}
          columns={[
            { title: 'Título', render: (d) => d.titulo },
            { title: 'Padrão', render: (d) => d.padrao || '-' },
            {
              title: 'Responsável',
              render: (d) => (d.responsavel_id ? usuariosMap.get(d.responsavel_id)?.nome || d.responsavel_id : '-'),
            },
            { title: 'Data Início', render: (d) => d.start_date || '-' },
            { title: 'Prazo', render: (d) => d.due_date || '-' },
            { title: 'Andamento', render: (d) => STATUS_ANDAMENTO_LABELS[d.status_andamento] },
            { title: 'Prioridade', render: (d) => PRIORIDADE_LABELS[d.prioridade] },
          ]}
        />

        <form className="detalhe-demanda-form" onSubmit={criarDemanda}>
          <div className="detalhe-demanda-grid">
            <label className="form-row demanda-field demanda-titulo">
              <span>Título</span>
              <input
                placeholder="Título da demanda"
                value={demanda.titulo}
                onChange={(e) => setDemanda((d) => ({ ...d, titulo: e.target.value }))}
                required
              />
            </label>
            <label className="form-row demanda-field demanda-padrao">
              <span>Padrão</span>
              <input
                placeholder="Ex.: FSC-STD-BR-01"
                value={demanda.padrao}
                onChange={(e) => setDemanda((d) => ({ ...d, padrao: e.target.value }))}
              />
            </label>
            <label className="form-row demanda-field demanda-descricao">
              <span>Descrição</span>
              <input
                placeholder="Descrição"
                value={demanda.descricao}
                onChange={(e) => setDemanda((d) => ({ ...d, descricao: e.target.value }))}
              />
            </label>
            <label className="form-row demanda-field demanda-responsavel">
              <span>Responsável</span>
              <div className="demanda-responsavel-actions">
                <select
                  value={demanda.responsavel_id}
                  onChange={(e) =>
                    setDemanda((d) => ({
                      ...d,
                      responsavel_id: e.target.value ? Number(e.target.value) : '',
                    }))
                  }
                >
                  <option value="">Sem responsável</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome} ({u.role})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setErro('');
                    setMensagem('');
                    setModalResponsavelOpen(true);
                  }}
                >
                  Cadastrar Responsável
                </button>
              </div>
            </label>
            <label className="form-row demanda-field demanda-data-inicio">
              <span>Data Início</span>
              <input
                type="date"
                value={demanda.start_date}
                onChange={(e) => setDemanda((d) => ({ ...d, start_date: e.target.value }))}
              />
            </label>
            <label className="form-row demanda-field demanda-data-fim">
              <span>Data Fim</span>
              <input
                type="date"
                value={demanda.due_date}
                onChange={(e) => setDemanda((d) => ({ ...d, due_date: e.target.value }))}
              />
            </label>
            <label className="form-row demanda-field demanda-status">
              <span>Status de Andamento</span>
              <select
                value={demanda.status_andamento}
                onChange={(e) => setDemanda((d) => ({ ...d, status_andamento: e.target.value as StatusAndamento }))}
              >
                {STATUS_DEMANDA_LIST.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_ANDAMENTO_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row demanda-field demanda-prioridade">
              <span>Prioridade</span>
              <select
                value={demanda.prioridade}
                onChange={(e) => setDemanda((d) => ({ ...d, prioridade: e.target.value as Prioridade }))}
              >
                {PRIORIDADE_LIST.map((p) => (
                  <option key={p} value={p}>
                    {PRIORIDADE_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="detalhe-form-actions detalhe-demanda-actions">
            <button type="submit">Criar Demanda</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Log de Auditoria (recentes)</h3>
        <Table
          rows={detalhe.logs}
          columns={[
            { title: 'Data', render: (l) => new Date(l.created_at).toLocaleString('pt-BR') },
            { title: 'Entidade', render: (l) => l.entidade },
            { title: 'Ação', render: (l) => l.acao },
            { title: 'Usuário ID', render: (l) => l.created_by || '-' },
          ]}
        />
      </div>

      <Modal open={modalResponsavelOpen} title="Cadastrar Responsável da Demanda" onClose={() => setModalResponsavelOpen(false)}>
        <form className="grid gap-12" onSubmit={cadastrarResponsavel}>
          <label className="form-row">
            <span>Nome</span>
            <input
              value={novoResponsavel.nome}
              onChange={(e) => setNovoResponsavel((prev) => ({ ...prev, nome: e.target.value }))}
              placeholder="Nome do responsável"
              required
            />
          </label>
          <label className="form-row">
            <span>Email</span>
            <input
              type="email"
              value={novoResponsavel.email}
              onChange={(e) => setNovoResponsavel((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="email@empresa.com"
              required
            />
          </label>
          <label className="form-row">
            <span>Senha inicial</span>
            <input
              type="password"
              value={novoResponsavel.senha}
              onChange={(e) => setNovoResponsavel((prev) => ({ ...prev, senha: e.target.value }))}
              placeholder="Mínimo 6 caracteres"
              minLength={6}
              required
            />
          </label>
          <div className="row-actions">
            <button type="button" className="btn-secondary" onClick={() => setModalResponsavelOpen(false)}>
              Cancelar
            </button>
            <button type="submit" disabled={criandoResponsavel}>
              {criandoResponsavel ? 'Cadastrando...' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
