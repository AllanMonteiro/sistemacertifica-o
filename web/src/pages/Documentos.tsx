import {
  FormEvent,
  useEffect,
  useMemo,
  useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  api,
  AuditLog,
  Avaliacao,
  DocumentoEvidencia,
  Evidencia,
  Indicador,
  STATUS_DOCUMENTO_LABELS,
  StatusDocumento,
  TipoEvidencia,
  Usuario,
  formatApiError,
} from '../api';
import Modal from '../components/Modal';
import Table from '../components/Table';

type Props = {
  programaId: number | null;
  auditoriaId: number | null;
};

const STATUS_DOCUMENTO_OPCOES: StatusDocumento[] = ['em_construcao', 'em_revisao', 'aprovado', 'reprovado'];

function formatarDataHora(valor?: string | null): string {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '-';
  return data.toLocaleString('pt-BR');
}

export default function Documentos({ programaId, auditoriaId }: Props) {
  const [searchParams] = useSearchParams();
  const evidenciaInicial = Number(searchParams.get('evidencia_id') || '');

  const [documentos, setDocumentos] = useState<DocumentoEvidencia[]>([]);
  const [evidencias, setEvidencias] = useState<Evidencia[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [tiposEvidencia, setTiposEvidencia] = useState<TipoEvidencia[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  const [statusFiltro, setStatusFiltro] = useState<StatusDocumento | ''>('');
  const [evidenciaFiltro, setEvidenciaFiltro] = useState<number | ''>(Number.isFinite(evidenciaInicial) ? evidenciaInicial : '');
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const [novoDocumento, setNovoDocumento] = useState({
    evidencia_id: '' as number | '',
    titulo: '',
    conteudo: '',
    status_documento: 'em_construcao' as StatusDocumento,
    observacoes_revisao: '',
    data_limite: '',
    responsavel_id: '' as number | '',
  });

  const [documentoEdicao, setDocumentoEdicao] = useState<DocumentoEvidencia | null>(null);
  const [edicao, setEdicao] = useState({
    titulo: '',
    conteudo: '',
    data_limite: '',
    responsavel_id: '' as number | '',
  });

  const [documentoRevisao, setDocumentoRevisao] = useState<DocumentoEvidencia | null>(null);
  const [revisao, setRevisao] = useState({
    status_documento: 'em_revisao' as StatusDocumento,
    observacoes_revisao: '',
  });

  const avaliacaoMap = useMemo(() => new Map(avaliacoes.map((item) => [item.id, item])), [avaliacoes]);
  const indicadorMap = useMemo(() => new Map(indicadores.map((item) => [item.id, item])), [indicadores]);
  const tipoMap = useMemo(() => new Map(tiposEvidencia.map((item) => [item.id, item.nome])), [tiposEvidencia]);
  const usuarioMap = useMemo(() => new Map(usuarios.map((item) => [item.id, item])), [usuarios]);
  const evidenciaMap = useMemo(() => new Map(evidencias.map((item) => [item.id, item])), [evidencias]);

  const descreverEvidencia = (evidenciaId: number): string => {
    const evidencia = evidenciaMap.get(evidenciaId);
    if (!evidencia) return `Evidência #${evidenciaId}`;
    const avaliacao = avaliacaoMap.get(evidencia.avaliacao_id);
    const indicador = indicadorMap.get(avaliacao?.indicator_id || 0);
    const indicadorLabel = indicador
      ? `${indicador.codigo ? `${indicador.codigo} - ` : ''}${indicador.titulo}`
      : `Indicador #${avaliacao?.indicator_id || '-'}`;
    const tipoLabel = evidencia.tipo_evidencia_id ? tipoMap.get(evidencia.tipo_evidencia_id) || 'Sem tipo' : 'Sem tipo';
    return `${indicadorLabel} | ${tipoLabel}`;
  };

  const carregar = async () => {
    if (!programaId || !auditoriaId) {
      setDocumentos([]);
      setEvidencias([]);
      setAvaliacoes([]);
      setIndicadores([]);
      setTiposEvidencia([]);
      setUsuarios([]);
      setLogs([]);
      return;
    }
    setErro('');
    try {
      const [docsResp, evidResp, avalResp, indResp, tipoResp] = await Promise.all([
        api.get<DocumentoEvidencia[]>('/documentos-evidencia', {
          params: {
            programa_id: programaId,
            auditoria_id: auditoriaId,
            status_documento: statusFiltro || undefined,
            evidencia_id: evidenciaFiltro || undefined,
          },
        }),
        api.get<Evidencia[]>('/evidencias', {
          params: {
            programa_id: programaId,
            auditoria_id: auditoriaId,
          },
        }),
        api.get<Avaliacao[]>('/avaliacoes', {
          params: {
            programa_id: programaId,
            auditoria_id: auditoriaId,
          },
        }),
        api.get<Indicador[]>('/indicadores', { params: { programa_id: programaId } }),
        api.get<TipoEvidencia[]>('/tipos-evidencia', { params: { programa_id: programaId } }),
      ]);
      setDocumentos(docsResp.data);
      setEvidencias(evidResp.data);
      setAvaliacoes(avalResp.data);
      setIndicadores(indResp.data);
      setTiposEvidencia(tipoResp.data);

      setNovoDocumento((prev) => {
        const evidenciasIds = new Set(evidResp.data.map((e) => e.id));
        if (prev.evidencia_id && evidenciasIds.has(Number(prev.evidencia_id))) return prev;
        return { ...prev, evidencia_id: evidResp.data[0]?.id || '' };
      });

      try {
        const usersResp = await api.get<Usuario[]>('/usuarios');
        const responsaveis = usersResp.data.filter(
          (item) => item.role === 'RESPONSAVEL' || item.role === 'GESTOR' || item.role === 'AUDITOR'
        );
        setUsuarios(responsaveis);
      } catch {
        setUsuarios([]);
      }

      try {
        const logsResp = await api.get<AuditLog[]>('/logs', {
          params: {
            entidade: 'documento_evidencia',
            programa_id: programaId,
            auditoria_id: auditoriaId,
          },
        });
        setLogs(logsResp.data);
      } catch {
        setLogs([]);
      }
    } catch (err: any) {
      setErro(formatApiError(err, 'Falha ao carregar documentos da evidência.'));
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId, auditoriaId, statusFiltro, evidenciaFiltro]);

  const documentosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return documentos;
    return documentos.filter((documento) => {
      const texto = `${documento.titulo} ${documento.conteudo || ''} ${descreverEvidencia(documento.evidencia_id)}`.toLowerCase();
      return texto.includes(termo);
    });
  }, [busca, documentos, evidenciaMap, avaliacaoMap, indicadorMap, tipoMap]);

  const sucesso = (texto: string) => {
    setMensagem(texto);
    setTimeout(() => setMensagem(''), 2500);
  };

  const erroApi = (err: any, fallback: string) => {
    setErro(formatApiError(err, fallback));
  };

  const criarDocumento = async (e: FormEvent) => {
    e.preventDefault();
    if (!novoDocumento.evidencia_id) {
      setErro('Selecione uma evidência para criar o documento.');
      return;
    }
    setErro('');
    try {
      await api.post('/documentos-evidencia', {
        evidencia_id: Number(novoDocumento.evidencia_id),
        titulo: novoDocumento.titulo,
        conteudo: novoDocumento.conteudo || null,
        status_documento: novoDocumento.status_documento,
        observacoes_revisao: novoDocumento.observacoes_revisao || null,
        data_limite: novoDocumento.data_limite || null,
        responsavel_id: novoDocumento.responsavel_id || null,
      });
      setNovoDocumento((prev) => ({
        ...prev,
        titulo: '',
        conteudo: '',
        observacoes_revisao: '',
        data_limite: '',
      }));
      await carregar();
      sucesso('Documento da evidência criado com sucesso.');
    } catch (err: any) {
      erroApi(err, 'Não foi possível criar o documento.');
    }
  };

  const abrirEdicao = (documento: DocumentoEvidencia) => {
    setDocumentoEdicao(documento);
    setEdicao({
      titulo: documento.titulo,
      conteudo: documento.conteudo || '',
      data_limite: documento.data_limite || '',
      responsavel_id: documento.responsavel_id || '',
    });
  };

  const salvarEdicao = async (e: FormEvent) => {
    e.preventDefault();
    if (!documentoEdicao) return;
    setErro('');
    try {
      await api.put(`/documentos-evidencia/${documentoEdicao.id}`, {
        titulo: edicao.titulo,
        conteudo: edicao.conteudo || null,
        data_limite: edicao.data_limite || null,
        responsavel_id: edicao.responsavel_id || null,
      });
      setDocumentoEdicao(null);
      await carregar();
      sucesso('Documento atualizado com sucesso.');
    } catch (err: any) {
      erroApi(err, 'Não foi possível atualizar o documento.');
    }
  };

  const abrirRevisao = (documento: DocumentoEvidencia) => {
    setDocumentoRevisao(documento);
    setRevisao({
      status_documento: documento.status_documento,
      observacoes_revisao: documento.observacoes_revisao || '',
    });
  };

  const salvarRevisao = async (e: FormEvent) => {
    e.preventDefault();
    if (!documentoRevisao) return;
    setErro('');
    try {
      await api.patch(`/documentos-evidencia/${documentoRevisao.id}/status`, {
        status_documento: revisao.status_documento,
        observacoes_revisao: revisao.observacoes_revisao || null,
      });
      setDocumentoRevisao(null);
      await carregar();
      sucesso('Status de revisão atualizado.');
    } catch (err: any) {
      erroApi(err, 'Não foi possível atualizar o status de revisão.');
    }
  };

  const excluirDocumento = async (documento: DocumentoEvidencia) => {
    if (!window.confirm(`Excluir o documento "${documento.titulo}"?`)) return;
    setErro('');
    try {
      await api.delete(`/documentos-evidencia/${documento.id}`);
      await carregar();
      sucesso('Documento removido com sucesso.');
    } catch (err: any) {
      erroApi(err, 'Não foi possível remover o documento.');
    }
  };

  if (!auditoriaId) {
    return <div className="card">Selecione uma Auditoria (Ano) para gerenciar documentos das evidências.</div>;
  }

  if (!programaId) {
    return <div className="card">Selecione um Programa para gerenciar documentos das evidências.</div>;
  }

  return (
    <div className="grid gap-16">
      <h2>Construção e Revisão de Documentos</h2>

      {erro && <div className="error">{erro}</div>}
      {mensagem && <div className="success">{mensagem}</div>}

      <div className="card">
        <h3>Novo Documento Vinculado à Evidência</h3>
        <form className="grid three-col gap-12" onSubmit={criarDocumento}>
          <label className="form-row">
            <span>Evidência</span>
            <select
              value={novoDocumento.evidencia_id}
              onChange={(e) =>
                setNovoDocumento((prev) => ({ ...prev, evidencia_id: e.target.value ? Number(e.target.value) : '' }))
              }
              required
            >
              <option value="">Selecione</option>
              {evidencias.map((item) => (
                <option key={item.id} value={item.id}>
                  {descreverEvidencia(item.id)}
                </option>
              ))}
            </select>
          </label>

          <label className="form-row">
            <span>Título do Documento</span>
            <input
              value={novoDocumento.titulo}
              onChange={(e) => setNovoDocumento((prev) => ({ ...prev, titulo: e.target.value }))}
              placeholder="Ex.: Procedimento de verificação de campo"
              required
            />
          </label>

          <label className="form-row">
            <span>Status</span>
            <select
              value={novoDocumento.status_documento}
              onChange={(e) =>
                setNovoDocumento((prev) => ({ ...prev, status_documento: e.target.value as StatusDocumento }))
              }
            >
              {STATUS_DOCUMENTO_OPCOES.map((statusDocumento) => (
                <option key={statusDocumento} value={statusDocumento}>
                  {STATUS_DOCUMENTO_LABELS[statusDocumento]}
                </option>
              ))}
            </select>
          </label>

          <label className="form-row">
            <span>Responsável</span>
            <select
              value={novoDocumento.responsavel_id}
              onChange={(e) =>
                setNovoDocumento((prev) => ({
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
            <span>Data Limite de Revisão</span>
            <input
              type="date"
              value={novoDocumento.data_limite}
              onChange={(e) => setNovoDocumento((prev) => ({ ...prev, data_limite: e.target.value }))}
            />
          </label>

          <label className="form-row">
            <span>Observações de Revisão</span>
            <input
              value={novoDocumento.observacoes_revisao}
              onChange={(e) => setNovoDocumento((prev) => ({ ...prev, observacoes_revisao: e.target.value }))}
              placeholder="Opcional"
            />
          </label>

          <label className="form-row" style={{ gridColumn: '1 / -1' }}>
            <span>Conteúdo do Documento</span>
            <textarea
              rows={5}
              value={novoDocumento.conteudo}
              onChange={(e) => setNovoDocumento((prev) => ({ ...prev, conteudo: e.target.value }))}
              placeholder="Escreva o conteúdo inicial do documento..."
            />
          </label>

          <button type="submit" disabled={evidencias.length === 0}>
            Criar Documento
          </button>
        </form>
        {evidencias.length === 0 && (
          <p className="muted-text">
            Nenhuma evidência cadastrada para esta auditoria. Cadastre evidências primeiro em Avaliações {'>'} Detalhar.
          </p>
        )}
      </div>

      <div className="card">
        <h3>Documentos Cadastrados</h3>
        <div className="filters-row">
          <label className="form-row compact">
            <span>Status</span>
            <select value={statusFiltro} onChange={(e) => setStatusFiltro((e.target.value as StatusDocumento) || '')}>
              <option value="">Todos</option>
              {STATUS_DOCUMENTO_OPCOES.map((statusDocumento) => (
                <option key={statusDocumento} value={statusDocumento}>
                  {STATUS_DOCUMENTO_LABELS[statusDocumento]}
                </option>
              ))}
            </select>
          </label>

          <label className="form-row compact">
            <span>Filtrar por Evidência</span>
            <select
              value={evidenciaFiltro}
              onChange={(e) => setEvidenciaFiltro(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Todas</option>
              {evidencias.map((item) => (
                <option key={item.id} value={item.id}>
                  {descreverEvidencia(item.id)}
                </option>
              ))}
            </select>
          </label>

          <label className="form-row compact">
            <span>Busca</span>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Título, conteúdo ou evidência"
            />
          </label>
        </div>

        <Table
          rows={documentosFiltrados}
          emptyText="Nenhum documento encontrado para os filtros informados."
          columns={[
            { title: 'Evidência', render: (item) => descreverEvidencia(item.evidencia_id) },
            { title: 'Documento', render: (item) => item.titulo },
            { title: 'Versão', render: (item) => item.versao },
            { title: 'Status', render: (item) => STATUS_DOCUMENTO_LABELS[item.status_documento] },
            {
              title: 'Responsável',
              render: (item) => (item.responsavel_id ? usuarioMap.get(item.responsavel_id)?.nome || item.responsavel_id : '-'),
            },
            { title: 'Atualizado em', render: (item) => formatarDataHora(item.updated_at) },
            {
              title: 'Ações',
              render: (item) => (
                <div className="row-actions">
                  <button type="button" onClick={() => abrirEdicao(item)}>
                    Editar
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => abrirRevisao(item)}>
                    Revisar
                  </button>
                  <button type="button" className="btn-danger" onClick={() => void excluirDocumento(item)}>
                    Excluir
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>

      <div className="card">
        <h3>Eventos de Construção e Revisão</h3>
        <Table
          rows={logs}
          emptyText="Sem eventos de revisão para exibir."
          columns={[
            { title: 'Data/Hora', render: (item) => formatarDataHora(item.created_at) },
            { title: 'Documento ID', render: (item) => item.entidade_id },
            { title: 'Ação', render: (item) => item.acao },
            { title: 'Usuário ID', render: (item) => item.created_by || '-' },
          ]}
        />
      </div>

      <Modal open={!!documentoEdicao} title="Editar Documento da Evidência" onClose={() => setDocumentoEdicao(null)}>
        <form className="grid gap-12" onSubmit={salvarEdicao}>
          <label className="form-row">
            <span>Título</span>
            <input
              value={edicao.titulo}
              onChange={(e) => setEdicao((prev) => ({ ...prev, titulo: e.target.value }))}
              required
            />
          </label>

          <label className="form-row">
            <span>Conteúdo</span>
            <textarea
              rows={6}
              value={edicao.conteudo}
              onChange={(e) => setEdicao((prev) => ({ ...prev, conteudo: e.target.value }))}
            />
          </label>

          <label className="form-row">
            <span>Responsável</span>
            <select
              value={edicao.responsavel_id}
              onChange={(e) => setEdicao((prev) => ({ ...prev, responsavel_id: e.target.value ? Number(e.target.value) : '' }))}
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
            <span>Data Limite de Revisão</span>
            <input
              type="date"
              value={edicao.data_limite}
              onChange={(e) => setEdicao((prev) => ({ ...prev, data_limite: e.target.value }))}
            />
          </label>

          <div className="row-actions">
            <button type="button" className="btn-secondary" onClick={() => setDocumentoEdicao(null)}>
              Cancelar
            </button>
            <button type="submit">Salvar Alterações</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!documentoRevisao} title="Revisar Documento" onClose={() => setDocumentoRevisao(null)}>
        <form className="grid gap-12" onSubmit={salvarRevisao}>
          <label className="form-row">
            <span>Status de Revisão</span>
            <select
              value={revisao.status_documento}
              onChange={(e) => setRevisao((prev) => ({ ...prev, status_documento: e.target.value as StatusDocumento }))}
            >
              {STATUS_DOCUMENTO_OPCOES.map((statusDocumento) => (
                <option key={statusDocumento} value={statusDocumento}>
                  {STATUS_DOCUMENTO_LABELS[statusDocumento]}
                </option>
              ))}
            </select>
          </label>

          <label className="form-row">
            <span>Observações da Revisão</span>
            <textarea
              rows={4}
              value={revisao.observacoes_revisao}
              onChange={(e) => setRevisao((prev) => ({ ...prev, observacoes_revisao: e.target.value }))}
              placeholder="Obrigatório para Aprovado/Reprovado"
            />
          </label>

          <div className="row-actions">
            <button type="button" className="btn-secondary" onClick={() => setDocumentoRevisao(null)}>
              Cancelar
            </button>
            <button type="submit">Salvar Revisão</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
