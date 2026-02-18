import { FormEvent, useEffect, useMemo, useState } from 'react';

import { api, Criterio, Indicador, Principio, TipoEvidencia } from '../api';
import FormRow from '../components/FormRow';
import Modal from '../components/Modal';
import Table from '../components/Table';

type Props = {
  programaId: number | null;
};

export default function Cadastros({ programaId }: Props) {
  const [principios, setPrincipios] = useState<Principio[]>([]);
  const [criterios, setCriterios] = useState<Criterio[]>([]);
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [tipos, setTipos] = useState<TipoEvidencia[]>([]);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const [novoPrincipio, setNovoPrincipio] = useState({ codigo: '', titulo: '', descricao: '' });
  const [novoCriterio, setNovoCriterio] = useState({ principio_id: 0, codigo: '', titulo: '', descricao: '' });
  const [novoIndicador, setNovoIndicador] = useState({ criterio_id: 0, codigo: '', titulo: '', descricao: '' });
  const [novoTipo, setNovoTipo] = useState({ criterio_id: 0, indicador_id: 0, nome: '', descricao: '' });
  const [principioEdicao, setPrincipioEdicao] = useState<Principio | null>(null);
  const [criterioEdicao, setCriterioEdicao] = useState<Criterio | null>(null);
  const [indicadorEdicao, setIndicadorEdicao] = useState<Indicador | null>(null);
  const [edicaoPrincipio, setEdicaoPrincipio] = useState({ codigo: '', titulo: '', descricao: '' });
  const [edicaoCriterio, setEdicaoCriterio] = useState({ principio_id: 0, codigo: '', titulo: '', descricao: '' });
  const [edicaoIndicador, setEdicaoIndicador] = useState({ criterio_id: 0, codigo: '', titulo: '', descricao: '' });

  const principioMap = useMemo(() => new Map(principios.map((p) => [p.id, p])), [principios]);
  const criterioMap = useMemo(() => new Map(criterios.map((c) => [c.id, c])), [criterios]);
  const indicadorMap = useMemo(() => new Map(indicadores.map((i) => [i.id, i])), [indicadores]);
  const indicadoresDoTipo = useMemo(
    () => indicadores.filter((indicador) => indicador.criterio_id === novoTipo.criterio_id),
    [indicadores, novoTipo.criterio_id]
  );

  const carregar = async () => {
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
      const criterioTipoBase = c.data.some((item) => item.id === novoTipo.criterio_id) ? novoTipo.criterio_id : c.data[0]?.id || 0;
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
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId]);

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

  const criarPrincipio = async (e: FormEvent) => {
    e.preventDefault();
    if (!programaId) {
      setErro('Selecione um Programa de Certificação para cadastrar estrutura.');
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
      await carregar();
      sucesso('Princípio criado.');
    } catch (err) {
      erroApi(err);
    }
  };

  const criarCriterio = async (e: FormEvent) => {
    e.preventDefault();
    if (!programaId) {
      setErro('Selecione um Programa de Certificação para cadastrar estrutura.');
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
      await carregar();
      sucesso('Critério criado.');
    } catch (err) {
      erroApi(err);
    }
  };

  const criarIndicador = async (e: FormEvent) => {
    e.preventDefault();
    if (!programaId) {
      setErro('Selecione um Programa de Certificação para cadastrar estrutura.');
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
      await carregar();
      sucesso('Indicador criado.');
    } catch (err) {
      erroApi(err);
    }
  };

  const criarTipo = async (e: FormEvent) => {
    e.preventDefault();
    if (!programaId) {
      setErro('Selecione um Programa de Certificação para cadastrar tipos de evidência.');
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
      });
      setNovoTipo((prev) => ({ ...prev, nome: '', descricao: '' }));
      await carregar();
      sucesso('Tipo de evidência criado.');
    } catch (err) {
      erroApi(err);
    }
  };

  const remover = async (rota: string, mensagemSucesso: string) => {
    setErro('');
    try {
      await api.delete(rota);
      await carregar();
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
      await carregar();
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
      await carregar();
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
      await carregar();
      sucesso('Indicador atualizado.');
    } catch (err) {
      erroApi(err);
    }
  };

  return (
    <div className="grid gap-16">
      <h2>Cadastros Base</h2>
      {!programaId && (
        <div className="card">Selecione um Programa de Certificação no topo para trabalhar os cadastros.</div>
      )}

      {erro && <div className="error">{erro}</div>}
      {mensagem && <div className="success">{mensagem}</div>}

      <div className="card">
        <h3>Princípios</h3>
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
        <h3>Critérios</h3>
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
        <h3>Indicadores</h3>
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
        <h3>Tipos de Evidência</h3>
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
          <button type="submit" disabled={!programaId || criterios.length === 0 || indicadoresDoTipo.length === 0}>
            Adicionar Tipo de Evidência
          </button>
        </form>
        <Table
          rows={tipos}
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
