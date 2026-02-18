
import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  api,
  Auditoria,
  Criterio,
  Indicador,
  Principio,
  ProgramaCertificacao,
  STATUS_CONFORMIDADE_LABELS,
  StatusConformidade,
  TipoEvidencia,
} from '../api';
import FormRow from '../components/FormRow';
import Modal from '../components/Modal';
import Table from '../components/Table';

type Props = {
  programaId: number | null;
  auditoriaId: number | null;
  selecionarContextoRelatorio: (programaId: number, year: number) => Promise<void>;
};

type EtapaAuditoriaForm = {
  year: number;
  tipo: string;
  organismo_certificador: string;
  padrao_utilizado: string;
  escopo: string;
};

const CERTIFICACOES_FIXAS = [
  { codigo: 'FSC', label: 'FSC' },
  { codigo: 'PEFC', label: 'PEFC' },
  { codigo: 'ONCA_PINTADA', label: 'Onça Pintada' },
  { codigo: 'CARBONO', label: 'Carbono' },
] as const;

const STATUS_CONFORMIDADE_OPTIONS = Object.keys(STATUS_CONFORMIDADE_LABELS) as StatusConformidade[];

const normalizarTexto = (valor: string) =>
  valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export default function Cadastros({ programaId, auditoriaId, selecionarContextoRelatorio }: Props) {
  const [principios, setPrincipios] = useState<Principio[]>([]);
  const [criterios, setCriterios] = useState<Criterio[]>([]);
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [tipos, setTipos] = useState<TipoEvidencia[]>([]);
  const [programas, setProgramas] = useState<ProgramaCertificacao[]>([]);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const [certificacaoSelecionada, setCertificacaoSelecionada] = useState<string>('FSC');
  const [etapaAuditoria, setEtapaAuditoria] = useState<EtapaAuditoriaForm>({
    year: new Date().getFullYear(),
    tipo: 'Certificação',
    organismo_certificador: '',
    padrao_utilizado: '',
    escopo: '',
  });

  const [novoPrincipio, setNovoPrincipio] = useState({ codigo: '', titulo: '', descricao: '' });
  const [novoCriterio, setNovoCriterio] = useState({ principio_id: 0, codigo: '', titulo: '', descricao: '' });
  const [novoIndicador, setNovoIndicador] = useState({ criterio_id: 0, codigo: '', titulo: '', descricao: '' });
  const [novoTipo, setNovoTipo] = useState({
    criterio_id: 0,
    indicador_id: 0,
    nome: '',
    descricao: '',
    status_conformidade: 'conforme' as StatusConformidade,
  });

  const [principioEdicao, setPrincipioEdicao] = useState<Principio | null>(null);
  const [criterioEdicao, setCriterioEdicao] = useState<Criterio | null>(null);
  const [indicadorEdicao, setIndicadorEdicao] = useState<Indicador | null>(null);
  const [edicaoPrincipio, setEdicaoPrincipio] = useState({ codigo: '', titulo: '', descricao: '' });
  const [edicaoCriterio, setEdicaoCriterio] = useState({ principio_id: 0, codigo: '', titulo: '', descricao: '' });
  const [edicaoIndicador, setEdicaoIndicador] = useState({ criterio_id: 0, codigo: '', titulo: '', descricao: '' });
  const [tipoStatusAtualizandoId, setTipoStatusAtualizandoId] = useState<number | null>(null);

  const fluxoPronto = Boolean(programaId && auditoriaId);
  const principioMap = useMemo(() => new Map(principios.map((p) => [p.id, p])), [principios]);
  const criterioMap = useMemo(() => new Map(criterios.map((c) => [c.id, c])), [criterios]);
  const indicadorMap = useMemo(() => new Map(indicadores.map((i) => [i.id, i])), [indicadores]);

  const indicadoresDoTipo = useMemo(
    () => indicadores.filter((indicador) => indicador.criterio_id === novoTipo.criterio_id),
    [indicadores, novoTipo.criterio_id]
  );

  const tiposFiltrados = useMemo(
    () =>
      tipos.filter((tipo) => {
        if (!tipo.criterio_id || !tipo.indicador_id) return false;
        if (!criterioMap.has(tipo.criterio_id) || !indicadorMap.has(tipo.indicador_id)) return false;
        if (novoTipo.criterio_id && tipo.criterio_id !== novoTipo.criterio_id) return false;
        if (novoTipo.indicador_id && tipo.indicador_id !== novoTipo.indicador_id) return false;
        return true;
      }),
    [tipos, criterioMap, indicadorMap, novoTipo.criterio_id, novoTipo.indicador_id]
  );

  const buscarProgramaPorCertificacao = (codigo: string, lista: ProgramaCertificacao[]) => {
    const meta = CERTIFICACOES_FIXAS.find((item) => item.codigo === codigo);
    const labelNormalizado = normalizarTexto(meta?.label || codigo);
    return (
      lista.find((programa) => programa.codigo.toUpperCase() === codigo.toUpperCase()) ||
      lista.find((programa) => normalizarTexto(programa.nome) === labelNormalizado)
    );
  };

  const carregarProgramas = async () => {
    const { data } = await api.get<ProgramaCertificacao[]>('/programas-certificacao');
    setProgramas(data);
    return data;
  };

  const carregarAuditoriasESelecionada = async (programaSelecionado: number | null) => {
    if (!programaSelecionado) {
      setEtapaAuditoria((prev) => ({ ...prev, year: new Date().getFullYear() }));
      return;
    }
    const { data } = await api.get<Auditoria[]>('/auditorias', { params: { programa_id: programaSelecionado } });

    if (auditoriaId) {
      const selecionada = data.find((item) => item.id === auditoriaId);
      if (selecionada) {
        setEtapaAuditoria({
          year: selecionada.year,
          tipo: selecionada.tipo || 'Certificação',
          organismo_certificador: selecionada.organismo_certificador || '',
          padrao_utilizado: selecionada.padrao_utilizado || '',
          escopo: selecionada.escopo || '',
        });
        return;
      }
    }

    const primeira = data[0];
    if (primeira) {
      setEtapaAuditoria({
        year: primeira.year,
        tipo: primeira.tipo || 'Certificação',
        organismo_certificador: primeira.organismo_certificador || '',
        padrao_utilizado: primeira.padrao_utilizado || '',
        escopo: primeira.escopo || '',
      });
      return;
    }

    setEtapaAuditoria((prev) => ({
      ...prev,
      year: prev.year || new Date().getFullYear(),
      tipo: prev.tipo || 'Certificação',
    }));
  };

  const carregarEstrutura = async () => {
    setErro('');
    if (!programaId) {
      setPrincipios([]);
      setCriterios([]);
      setIndicadores([]);
      setTipos([]);
      return;
    }

    try {
      const [p, c, i, t] = await Promise.all([
        api.get<Principio[]>('/principios', { params: { programa_id: programaId } }),
        api.get<Criterio[]>('/criterios', { params: { programa_id: programaId } }),
        api.get<Indicador[]>('/indicadores', { params: { programa_id: programaId } }),
        api.get<TipoEvidencia[]>('/tipos-evidencia', { params: { programa_id: programaId } }),
      ]);
      setPrincipios(p.data);
      setCriterios(c.data);
      setIndicadores(i.data);
      setTipos(t.data);

      if (!p.data.some((item) => item.id === novoCriterio.principio_id)) {
        setNovoCriterio((prev) => ({ ...prev, principio_id: p.data[0]?.id || 0 }));
      }
      if (!c.data.some((item) => item.id === novoIndicador.criterio_id)) {
        setNovoIndicador((prev) => ({ ...prev, criterio_id: c.data[0]?.id || 0 }));
      }

      const criterioTipoBase = c.data.some((item) => item.id === novoTipo.criterio_id)
        ? novoTipo.criterio_id
        : c.data[0]?.id || 0;
      const indicadoresDoCriterio = i.data.filter((item) => item.criterio_id === criterioTipoBase);
      const indicadorTipoBase = indicadoresDoCriterio.some((item) => item.id === novoTipo.indicador_id)
        ? novoTipo.indicador_id
        : indicadoresDoCriterio[0]?.id || i.data[0]?.id || 0;

      setNovoTipo((prev) => ({ ...prev, criterio_id: criterioTipoBase, indicador_id: indicadorTipoBase }));
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao carregar cadastros.');
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const listaProgramas = await carregarProgramas();
        const selecionado = listaProgramas.find((programa) => programa.id === programaId);
        if (selecionado) {
          const fixo = CERTIFICACOES_FIXAS.find((item) => {
            if (item.codigo === selecionado.codigo.toUpperCase()) return true;
            return normalizarTexto(item.label) === normalizarTexto(selecionado.nome);
          });
          if (fixo) {
            setCertificacaoSelecionada(fixo.codigo);
          }
        }
      } catch {
        // Mensagens de erro serão exibidas pelos carregamentos específicos.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void carregarEstrutura();
    void carregarAuditoriasESelecionada(programaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId, auditoriaId]);

  useEffect(() => {
    if (!indicadoresDoTipo.some((item) => item.id === novoTipo.indicador_id)) {
      setNovoTipo((prev) => ({ ...prev, indicador_id: indicadoresDoTipo[0]?.id || 0 }));
    }
  }, [indicadoresDoTipo, novoTipo.indicador_id]);

  const sucesso = (msg: string) => {
    setMensagem(msg);
    setTimeout(() => setMensagem(''), 2500);
  };

  const erroApi = (err: any) => {
    setErro(err?.response?.data?.detail || 'Erro na operação.');
  };

  const alterarCertificacao = async (codigo: string) => {
    setCertificacaoSelecionada(codigo);
    const programa = buscarProgramaPorCertificacao(codigo, programas);
    if (!programa) {
      setErro('Tipo de certificação não encontrado. Verifique os programas cadastrados.');
      return;
    }

    setErro('');
    try {
      await selecionarContextoRelatorio(programa.id, etapaAuditoria.year);
    } catch {
      setErro('Não foi possível selecionar o programa desta certificação.');
    }
  };

  const salvarEtapaAuditoria = async (e: FormEvent) => {
    e.preventDefault();
    const programa = buscarProgramaPorCertificacao(certificacaoSelecionada, programas);
    if (!programa) {
      setErro('Tipo de certificação não encontrado. Verifique os programas cadastrados.');
      return;
    }

    setErro('');
    setMensagem('');
    try {
      await api.post('/auditorias', {
        programa_id: programa.id,
        year: etapaAuditoria.year,
        tipo: etapaAuditoria.tipo || null,
        organismo_certificador: etapaAuditoria.organismo_certificador || null,
        padrao_utilizado: etapaAuditoria.padrao_utilizado || null,
        escopo: etapaAuditoria.escopo || null,
      });
      await selecionarContextoRelatorio(programa.id, etapaAuditoria.year);
      await carregarEstrutura();
      sucesso('Etapa 1 concluída: auditoria cadastrada e selecionada.');
    } catch (err: any) {
      const detail = String(err?.response?.data?.detail || '');
      if (detail.toLowerCase().includes('já existe auditoria')) {
        await selecionarContextoRelatorio(programa.id, etapaAuditoria.year);
        await carregarEstrutura();
        sucesso('Auditoria já cadastrada para este ano. Ela foi selecionada para continuar o cadastro.');
        return;
      }
      erroApi(err);
    }
  };

  const criarPrincipio = async (e: FormEvent) => {
    e.preventDefault();
    if (!programaId || !fluxoPronto) {
      setErro('Conclua a Etapa 1 (Auditoria e Certificação) antes de cadastrar estrutura.');
      return;
    }
    setErro('');
    try {
      await api.post('/principios', {
        programa_id: programaId,
        codigo: novoPrincipio.codigo || null,
        titulo: novoPrincipio.titulo,
        descricao: novoPrincipio.descricao || null,
      });
      setNovoPrincipio({ codigo: '', titulo: '', descricao: '' });
      await carregarEstrutura();
      sucesso('Princípio criado.');
    } catch (err) {
      erroApi(err);
    }
  };

  const criarCriterio = async (e: FormEvent) => {
    e.preventDefault();
    if (!programaId || !fluxoPronto) {
      setErro('Conclua a Etapa 1 (Auditoria e Certificação) antes de cadastrar estrutura.');
      return;
    }
    setErro('');
    try {
      await api.post('/criterios', {
        programa_id: programaId,
        principio_id: Number(novoCriterio.principio_id),
        codigo: novoCriterio.codigo || null,
        titulo: novoCriterio.titulo,
        descricao: novoCriterio.descricao || null,
      });
      setNovoCriterio((prev) => ({ ...prev, codigo: '', titulo: '', descricao: '' }));
      await carregarEstrutura();
      sucesso('Critério criado.');
    } catch (err) {
      erroApi(err);
    }
  };

  const criarIndicador = async (e: FormEvent) => {
    e.preventDefault();
    if (!programaId || !fluxoPronto) {
      setErro('Conclua a Etapa 1 (Auditoria e Certificação) antes de cadastrar estrutura.');
      return;
    }
    setErro('');
    try {
      await api.post('/indicadores', {
        programa_id: programaId,
        criterio_id: Number(novoIndicador.criterio_id),
        codigo: novoIndicador.codigo || null,
        titulo: novoIndicador.titulo,
        descricao: novoIndicador.descricao || null,
      });
      setNovoIndicador((prev) => ({ ...prev, codigo: '', titulo: '', descricao: '' }));
      await carregarEstrutura();
      sucesso('Indicador criado.');
    } catch (err) {
      erroApi(err);
    }
  };

  const criarTipo = async (e: FormEvent) => {
    e.preventDefault();
    if (!programaId || !fluxoPronto) {
      setErro('Conclua a Etapa 1 (Auditoria e Certificação) antes de cadastrar tipos de evidência.');
      return;
    }
    if (!novoTipo.criterio_id || !novoTipo.indicador_id) {
      setErro('Selecione critério e indicador para vincular o tipo de evidência.');
      return;
    }

    setErro('');
    try {
      await api.post('/tipos-evidencia', {
        programa_id: programaId,
        criterio_id: Number(novoTipo.criterio_id),
        indicador_id: Number(novoTipo.indicador_id),
        nome: novoTipo.nome,
        descricao: novoTipo.descricao || null,
        status_conformidade: novoTipo.status_conformidade,
      });
      setNovoTipo((prev) => ({ ...prev, nome: '', descricao: '' }));
      await carregarEstrutura();
      sucesso('Tipo de evidência criado.');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === 'string' && detail.toLowerCase().includes('já existe tipo de evidência')) {
        const { data } = await api.get<TipoEvidencia[]>('/tipos-evidencia', {
          params: { programa_id: programaId },
        });
        setTipos(data);

        const nomeBusca = novoTipo.nome.trim().toLowerCase();
        const existenteMesmoNome = data.find((item) => item.nome.trim().toLowerCase() === nomeBusca);
        if (existenteMesmoNome?.criterio_id && existenteMesmoNome?.indicador_id) {
          setNovoTipo((prev) => ({
            ...prev,
            criterio_id: existenteMesmoNome.criterio_id as number,
            indicador_id: existenteMesmoNome.indicador_id as number,
            status_conformidade: existenteMesmoNome.status_conformidade,
            nome: '',
            descricao: '',
          }));
          setErro('');
          sucesso('Tipo já cadastrado. Filtro ajustado para mostrar o registro existente.');
          return;
        }

        await carregarEstrutura();
        setErro('');
        sucesso('Este tipo já estava cadastrado para o vínculo selecionado. Lista atualizada.');
        return;
      }
      erroApi(err);
    }
  };

  const remover = async (rota: string, mensagemSucesso: string) => {
    setErro('');
    try {
      await api.delete(rota);
      await carregarEstrutura();
      sucesso(mensagemSucesso);
    } catch (err) {
      erroApi(err);
    }
  };

  const abrirEdicaoPrincipio = (principio: Principio) => {
    setPrincipioEdicao(principio);
    setEdicaoPrincipio({
      codigo: principio.codigo || '',
      titulo: principio.titulo,
      descricao: principio.descricao || '',
    });
  };

  const salvarEdicaoPrincipio = async (e: FormEvent) => {
    e.preventDefault();
    if (!principioEdicao || !programaId) return;
    setErro('');
    try {
      await api.put(`/principios/${principioEdicao.id}`, {
        programa_id: programaId,
        codigo: edicaoPrincipio.codigo || null,
        titulo: edicaoPrincipio.titulo,
        descricao: edicaoPrincipio.descricao || null,
      });
      setPrincipioEdicao(null);
      await carregarEstrutura();
      sucesso('Princípio atualizado.');
    } catch (err) {
      erroApi(err);
    }
  };

  const abrirEdicaoCriterio = (criterio: Criterio) => {
    setCriterioEdicao(criterio);
    setEdicaoCriterio({
      principio_id: criterio.principio_id,
      codigo: criterio.codigo || '',
      titulo: criterio.titulo,
      descricao: criterio.descricao || '',
    });
  };

  const salvarEdicaoCriterio = async (e: FormEvent) => {
    e.preventDefault();
    if (!criterioEdicao || !programaId) return;
    setErro('');
    try {
      await api.put(`/criterios/${criterioEdicao.id}`, {
        programa_id: programaId,
        principio_id: Number(edicaoCriterio.principio_id),
        codigo: edicaoCriterio.codigo || null,
        titulo: edicaoCriterio.titulo,
        descricao: edicaoCriterio.descricao || null,
      });
      setCriterioEdicao(null);
      await carregarEstrutura();
      sucesso('Critério atualizado.');
    } catch (err) {
      erroApi(err);
    }
  };

  const abrirEdicaoIndicador = (indicador: Indicador) => {
    setIndicadorEdicao(indicador);
    setEdicaoIndicador({
      criterio_id: indicador.criterio_id,
      codigo: indicador.codigo || '',
      titulo: indicador.titulo,
      descricao: indicador.descricao || '',
    });
  };

  const salvarEdicaoIndicador = async (e: FormEvent) => {
    e.preventDefault();
    if (!indicadorEdicao || !programaId) return;
    setErro('');
    try {
      await api.put(`/indicadores/${indicadorEdicao.id}`, {
        programa_id: programaId,
        criterio_id: Number(edicaoIndicador.criterio_id),
        codigo: edicaoIndicador.codigo || null,
        titulo: edicaoIndicador.titulo,
        descricao: edicaoIndicador.descricao || null,
      });
      setIndicadorEdicao(null);
      await carregarEstrutura();
      sucesso('Indicador atualizado.');
    } catch (err) {
      erroApi(err);
    }
  };

  const atualizarStatusTipoEvidencia = async (tipo: TipoEvidencia, statusConformidade: StatusConformidade) => {
    if (tipo.status_conformidade === statusConformidade) return;
    setErro('');
    setTipoStatusAtualizandoId(tipo.id);
    try {
      const { data } = await api.put<TipoEvidencia>(`/tipos-evidencia/${tipo.id}`, {
        status_conformidade: statusConformidade,
      });
      setTipos((prev) => prev.map((item) => (item.id === tipo.id ? data : item)));
      sucesso('Status de conformidade do tipo de evidência atualizado.');
    } catch (err) {
      erroApi(err);
    } finally {
      setTipoStatusAtualizandoId(null);
    }
  };

  return (
    <div className="grid gap-16">
      <h2>Cadastros Base</h2>

      {erro && <div className="error">{erro}</div>}
      {mensagem && <div className="success">{mensagem}</div>}

      <div className="card">
        <h3>Etapa 1 - Auditoria e Certificação</h3>
        <form className="grid four-col gap-12" onSubmit={salvarEtapaAuditoria}>
          <label className="form-row">
            <span>Tipo de Certificação</span>
            <select
              value={certificacaoSelecionada}
              onChange={(e) => {
                void alterarCertificacao(e.target.value);
              }}
            >
              {CERTIFICACOES_FIXAS.map((cert) => (
                <option key={cert.codigo} value={cert.codigo}>
                  {cert.label}
                </option>
              ))}
            </select>
          </label>

          <label className="form-row">
            <span>Ano da Auditoria</span>
            <input
              type="number"
              min={2000}
              max={2100}
              value={etapaAuditoria.year}
              onChange={(e) => setEtapaAuditoria((prev) => ({ ...prev, year: Number(e.target.value) }))}
              required
            />
          </label>

          <label className="form-row">
            <span>Tipo</span>
            <select
              value={etapaAuditoria.tipo}
              onChange={(e) => setEtapaAuditoria((prev) => ({ ...prev, tipo: e.target.value }))}
            >
              <option value="Certificação">Certificação</option>
              <option value="Recertificação">Recertificação</option>
            </select>
          </label>

          <label className="form-row">
            <span>Certificadora</span>
            <input
              value={etapaAuditoria.organismo_certificador}
              onChange={(e) =>
                setEtapaAuditoria((prev) => ({ ...prev, organismo_certificador: e.target.value }))
              }
              placeholder="Ex.: Systfor"
            />
          </label>

          <label className="form-row">
            <span>Padrão Utilizado</span>
            <input
              value={etapaAuditoria.padrao_utilizado}
              onChange={(e) => setEtapaAuditoria((prev) => ({ ...prev, padrao_utilizado: e.target.value }))}
              placeholder="Ex.: FSC-STD-BRA"
            />
          </label>

          <label className="form-row three-col" style={{ gridColumn: 'span 2' }}>
            <span>Escopo</span>
            <input
              value={etapaAuditoria.escopo}
              onChange={(e) => setEtapaAuditoria((prev) => ({ ...prev, escopo: e.target.value }))}
            />
          </label>

          <div className="form-row" style={{ alignSelf: 'end' }}>
            <button type="submit">Salvar Etapa 1</button>
          </div>
        </form>

        {!fluxoPronto && (
          <p className="muted-text">
            Após salvar a Etapa 1, continue com Princípios, Critérios, Indicadores e Tipos de Evidência.
          </p>
        )}
      </div>

      {!fluxoPronto && (
        <div className="card">
          Conclua a Etapa 1 para liberar as próximas etapas de cadastro da estrutura e evidências.
        </div>
      )}

      {fluxoPronto && (
        <>
          <div className="card">
            <h3>Etapa 2 - Princípios</h3>
            <form className="grid three-col gap-12" onSubmit={criarPrincipio}>
              <input
                placeholder="Código"
                value={novoPrincipio.codigo}
                onChange={(e) => setNovoPrincipio((p) => ({ ...p, codigo: e.target.value }))}
              />
              <input
                placeholder="Título"
                value={novoPrincipio.titulo}
                onChange={(e) => setNovoPrincipio((p) => ({ ...p, titulo: e.target.value }))}
                required
              />
              <input
                placeholder="Descrição"
                value={novoPrincipio.descricao}
                onChange={(e) => setNovoPrincipio((p) => ({ ...p, descricao: e.target.value }))}
              />
              <button type="submit" disabled={!programaId}>
                Adicionar Princípio
              </button>
            </form>
            <Table
              rows={principios}
              columns={[
                { title: 'Código', render: (p) => p.codigo || '-' },
                { title: 'Título', render: (p) => p.titulo },
                { title: 'Descrição', render: (p) => p.descricao || '-' },
                {
                  title: 'Ações',
                  render: (p) => (
                    <div className="row-actions cadastros-row-actions">
                      <button type="button" onClick={() => abrirEdicaoPrincipio(p)}>
                        Editar
                      </button>
                      <button type="button" onClick={() => remover(`/principios/${p.id}`, 'Princípio removido.')}>
                        Excluir
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          </div>

          <div className="card">
            <h3>Etapa 3 - Critérios</h3>
            <form className="grid four-col gap-12" onSubmit={criarCriterio}>
              <select
                value={novoCriterio.principio_id}
                onChange={(e) => setNovoCriterio((c) => ({ ...c, principio_id: Number(e.target.value) }))}
                required
              >
                {principios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.titulo}
                  </option>
                ))}
              </select>
              <input
                placeholder="Código"
                value={novoCriterio.codigo}
                onChange={(e) => setNovoCriterio((c) => ({ ...c, codigo: e.target.value }))}
              />
              <input
                placeholder="Título"
                value={novoCriterio.titulo}
                onChange={(e) => setNovoCriterio((c) => ({ ...c, titulo: e.target.value }))}
                required
              />
              <input
                placeholder="Descrição"
                value={novoCriterio.descricao}
                onChange={(e) => setNovoCriterio((c) => ({ ...c, descricao: e.target.value }))}
              />
              <button type="submit" disabled={!programaId || principios.length === 0}>
                Adicionar Critério
              </button>
            </form>
            <Table
              rows={criterios}
              columns={[
                { title: 'Princípio', render: (c) => principioMap.get(c.principio_id)?.titulo || '-' },
                { title: 'Código', render: (c) => c.codigo || '-' },
                { title: 'Título', render: (c) => c.titulo },
                {
                  title: 'Ações',
                  render: (c) => (
                    <div className="row-actions cadastros-row-actions">
                      <button type="button" onClick={() => abrirEdicaoCriterio(c)}>
                        Editar
                      </button>
                      <button type="button" onClick={() => remover(`/criterios/${c.id}`, 'Critério removido.')}>
                        Excluir
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          </div>

          <div className="card">
            <h3>Etapa 4 - Indicadores</h3>
            <form className="grid four-col gap-12" onSubmit={criarIndicador}>
              <select
                value={novoIndicador.criterio_id}
                onChange={(e) => setNovoIndicador((i) => ({ ...i, criterio_id: Number(e.target.value) }))}
                required
              >
                {criterios.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titulo}
                  </option>
                ))}
              </select>
              <input
                placeholder="Código"
                value={novoIndicador.codigo}
                onChange={(e) => setNovoIndicador((i) => ({ ...i, codigo: e.target.value }))}
              />
              <input
                placeholder="Título"
                value={novoIndicador.titulo}
                onChange={(e) => setNovoIndicador((i) => ({ ...i, titulo: e.target.value }))}
                required
              />
              <input
                placeholder="Descrição"
                value={novoIndicador.descricao}
                onChange={(e) => setNovoIndicador((i) => ({ ...i, descricao: e.target.value }))}
              />
              <button type="submit" disabled={!programaId || criterios.length === 0}>
                Adicionar Indicador
              </button>
            </form>
            <Table
              rows={indicadores}
              columns={[
                { title: 'Critério', render: (i) => criterioMap.get(i.criterio_id)?.titulo || '-' },
                { title: 'Código', render: (i) => i.codigo || '-' },
                { title: 'Título', render: (i) => i.titulo },
                {
                  title: 'Ações',
                  render: (i) => (
                    <div className="row-actions cadastros-row-actions">
                      <button type="button" onClick={() => abrirEdicaoIndicador(i)}>
                        Editar
                      </button>
                      <button type="button" onClick={() => remover(`/indicadores/${i.id}`, 'Indicador removido.')}>
                        Excluir
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          </div>

          <div className="card">
            <h3>Etapa 5 - Tipos de Evidência</h3>
            <form className="grid four-col gap-12" onSubmit={criarTipo}>
              <select
                value={novoTipo.criterio_id}
                onChange={(e) =>
                  setNovoTipo((t) => ({
                    ...t,
                    criterio_id: Number(e.target.value),
                  }))
                }
                required
              >
                {criterios.length === 0 && <option value={0}>Nenhum critério cadastrado</option>}
                {criterios.map((criterio) => (
                  <option key={criterio.id} value={criterio.id}>
                    {criterio.codigo ? `${criterio.codigo} - ` : ''}
                    {criterio.titulo}
                  </option>
                ))}
              </select>

              <select
                value={novoTipo.indicador_id}
                onChange={(e) => setNovoTipo((t) => ({ ...t, indicador_id: Number(e.target.value) }))}
                required
              >
                {indicadoresDoTipo.length === 0 && <option value={0}>Nenhum indicador cadastrado</option>}
                {indicadoresDoTipo.map((indicador) => (
                  <option key={indicador.id} value={indicador.id}>
                    {indicador.codigo ? `${indicador.codigo} - ` : ''}
                    {indicador.titulo}
                  </option>
                ))}
              </select>

              <input
                placeholder="Nome"
                value={novoTipo.nome}
                onChange={(e) => setNovoTipo((t) => ({ ...t, nome: e.target.value }))}
                required
              />

              <input
                placeholder="Descrição"
                value={novoTipo.descricao}
                onChange={(e) => setNovoTipo((t) => ({ ...t, descricao: e.target.value }))}
              />

              <select
                value={novoTipo.status_conformidade}
                onChange={(e) =>
                  setNovoTipo((t) => ({ ...t, status_conformidade: e.target.value as StatusConformidade }))
                }
              >
                {STATUS_CONFORMIDADE_OPTIONS.map((valor) => (
                  <option key={valor} value={valor}>
                    {STATUS_CONFORMIDADE_LABELS[valor]}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                disabled={!programaId || criterios.length === 0 || indicadoresDoTipo.length === 0}
              >
                Adicionar Tipo de Evidência
              </button>
            </form>

            <Table
              rows={tiposFiltrados}
              emptyText="Nenhum tipo de evidência encontrado para o critério/indicador selecionado."
              columns={[
                {
                  title: 'Critério',
                  render: (t) => {
                    const criterio = criterioMap.get(t.criterio_id || 0);
                    if (!criterio) return '-';
                    return `${criterio.codigo ? `${criterio.codigo} - ` : ''}${criterio.titulo}`;
                  },
                },
                {
                  title: 'Indicador',
                  render: (t) => {
                    const indicador = indicadorMap.get(t.indicador_id || 0);
                    if (!indicador) return '-';
                    return `${indicador.codigo ? `${indicador.codigo} - ` : ''}${indicador.titulo}`;
                  },
                },
                { title: 'Nome', render: (t) => t.nome },
                { title: 'Descrição', render: (t) => t.descricao || '-' },
                {
                  title: 'Status de Conformidade',
                  render: (t) => (
                    <select
                      value={t.status_conformidade}
                      disabled={tipoStatusAtualizandoId === t.id}
                      onChange={(e) => void atualizarStatusTipoEvidencia(t, e.target.value as StatusConformidade)}
                    >
                      {STATUS_CONFORMIDADE_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_CONFORMIDADE_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  ),
                },
                {
                  title: 'Ações',
                  render: (t) => (
                    <button type="button" onClick={() => remover(`/tipos-evidencia/${t.id}`, 'Tipo removido.')}>
                      Excluir
                    </button>
                  ),
                },
              ]}
            />
          </div>
        </>
      )}

      <Modal open={!!principioEdicao} title="Editar Princípio" onClose={() => setPrincipioEdicao(null)}>
        <form className="grid gap-12" onSubmit={salvarEdicaoPrincipio}>
          <FormRow label="Código">
            <input
              value={edicaoPrincipio.codigo}
              onChange={(e) => setEdicaoPrincipio((state) => ({ ...state, codigo: e.target.value }))}
            />
          </FormRow>

          <FormRow label="Título">
            <input
              value={edicaoPrincipio.titulo}
              onChange={(e) => setEdicaoPrincipio((state) => ({ ...state, titulo: e.target.value }))}
              required
            />
          </FormRow>

          <FormRow label="Descrição">
            <input
              value={edicaoPrincipio.descricao}
              onChange={(e) => setEdicaoPrincipio((state) => ({ ...state, descricao: e.target.value }))}
            />
          </FormRow>

          <button type="submit">Salvar Alterações</button>
        </form>
      </Modal>

      <Modal open={!!criterioEdicao} title="Editar Critério" onClose={() => setCriterioEdicao(null)}>
        <form className="grid gap-12" onSubmit={salvarEdicaoCriterio}>
          <FormRow label="Princípio">
            <select
              value={edicaoCriterio.principio_id}
              onChange={(e) => setEdicaoCriterio((state) => ({ ...state, principio_id: Number(e.target.value) }))}
              required
            >
              {principios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titulo}
                </option>
              ))}
            </select>
          </FormRow>

          <FormRow label="Código">
            <input
              value={edicaoCriterio.codigo}
              onChange={(e) => setEdicaoCriterio((state) => ({ ...state, codigo: e.target.value }))}
            />
          </FormRow>

          <FormRow label="Título">
            <input
              value={edicaoCriterio.titulo}
              onChange={(e) => setEdicaoCriterio((state) => ({ ...state, titulo: e.target.value }))}
              required
            />
          </FormRow>

          <FormRow label="Descrição">
            <input
              value={edicaoCriterio.descricao}
              onChange={(e) => setEdicaoCriterio((state) => ({ ...state, descricao: e.target.value }))}
            />
          </FormRow>

          <button type="submit">Salvar Alterações</button>
        </form>
      </Modal>

      <Modal open={!!indicadorEdicao} title="Editar Indicador" onClose={() => setIndicadorEdicao(null)}>
        <form className="grid gap-12" onSubmit={salvarEdicaoIndicador}>
          <FormRow label="Critério">
            <select
              value={edicaoIndicador.criterio_id}
              onChange={(e) => setEdicaoIndicador((state) => ({ ...state, criterio_id: Number(e.target.value) }))}
              required
            >
              {criterios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titulo}
                </option>
              ))}
            </select>
          </FormRow>

          <FormRow label="Código">
            <input
              value={edicaoIndicador.codigo}
              onChange={(e) => setEdicaoIndicador((state) => ({ ...state, codigo: e.target.value }))}
            />
          </FormRow>

          <FormRow label="Título">
            <input
              value={edicaoIndicador.titulo}
              onChange={(e) => setEdicaoIndicador((state) => ({ ...state, titulo: e.target.value }))}
              required
            />
          </FormRow>

          <FormRow label="Descrição">
            <input
              value={edicaoIndicador.descricao}
              onChange={(e) => setEdicaoIndicador((state) => ({ ...state, descricao: e.target.value }))}
            />
          </FormRow>

          <button type="submit">Salvar Alterações</button>
        </form>
      </Modal>
    </div>
  );
}
