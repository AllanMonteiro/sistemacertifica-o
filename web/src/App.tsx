import { useEffect, useState } from 'react';
import { BrowserRouter, NavLink } from 'react-router-dom';

import { api, Auditoria, ConfiguracaoSistema, ProgramaCertificacao, Usuario } from './api';
import AppRoutes from './routes';

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [programas, setProgramas] = useState<ProgramaCertificacao[]>([]);
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  const [configuracao, setConfiguracao] = useState<ConfiguracaoSistema | null>(null);

  const [programaId, setProgramaId] = useState<number | null>(() => {
    const stored = localStorage.getItem('programa_id');
    return stored ? Number(stored) : null;
  });
  const [auditoriaId, setAuditoriaId] = useState<number | null>(() => {
    const stored = localStorage.getItem('auditoria_id');
    return stored ? Number(stored) : null;
  });

  const carregarProgramas = async (): Promise<ProgramaCertificacao[]> => {
    const { data } = await api.get<ProgramaCertificacao[]>('/programas-certificacao');
    setProgramas(data);
    return data;
  };

  const carregarAuditorias = async (programaSelecionado: number | null = programaId) => {
    if (!programaSelecionado) {
      setAuditorias([]);
      setAuditoriaId(null);
      localStorage.removeItem('auditoria_id');
      return;
    }

    const { data } = await api.get<Auditoria[]>('/auditorias', {
      params: { programa_id: programaSelecionado },
    });
    setAuditorias(data);

    if (data.length > 0) {
      const existeSelecionada = auditoriaId && data.some((a) => a.id === auditoriaId);
      if (!existeSelecionada) {
        const id = data[0].id;
        setAuditoriaId(id);
        localStorage.setItem('auditoria_id', String(id));
      }
    } else {
      setAuditoriaId(null);
      localStorage.removeItem('auditoria_id');
    }
  };

  const carregarUsuario = async () => {
    const { data } = await api.get<Usuario>('/auth/me');
    setUsuario(data);
  };

  const carregarConfiguracao = async () => {
    const { data } = await api.get<ConfiguracaoSistema>('/configuracoes');
    setConfiguracao(data);
  };

  const bootstrap = async () => {
    if (!localStorage.getItem('token')) return;
    try {
      await carregarUsuario();
      await carregarConfiguracao();
      const programasDisponiveis = await carregarProgramas();
      let programaSelecionado = programaId;

      const programaValido = programaSelecionado
        ? programasDisponiveis.some((programa) => programa.id === programaSelecionado)
        : false;

      if (!programaValido) {
        programaSelecionado = programasDisponiveis[0]?.id ?? null;
        setProgramaId(programaSelecionado);
        if (programaSelecionado) {
          localStorage.setItem('programa_id', String(programaSelecionado));
        } else {
          localStorage.removeItem('programa_id');
        }
      }

      await carregarAuditorias(programaSelecionado);
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('programa_id');
      localStorage.removeItem('auditoria_id');
      setToken(null);
      setUsuario(null);
      setConfiguracao(null);
      setProgramas([]);
      setAuditorias([]);
      setProgramaId(null);
      setAuditoriaId(null);
    }
  };

  useEffect(() => {
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLogin = async (newToken: string) => {
    setToken(newToken);
    await bootstrap();
  };

  const onLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('programa_id');
    localStorage.removeItem('auditoria_id');
    setToken(null);
    setUsuario(null);
    setConfiguracao(null);
    setProgramas([]);
    setAuditorias([]);
    setProgramaId(null);
    setAuditoriaId(null);
  };

  const rotas = (
    <AppRoutes
      token={token}
      onLogin={onLogin}
      auditorias={auditorias}
      programaId={programaId}
      auditoriaId={auditoriaId}
      setAuditoriaId={setAuditoriaId}
      refreshAuditorias={carregarAuditorias}
      refreshConfiguracaoNoHeader={carregarConfiguracao}
    />
  );

  return (
    <BrowserRouter>
      <div className="app-shell">
        {token ? (
          <div className="layout-auth">
            <aside className="sidebar">
              <div className="brand">
                <div className="brand-top">
                  {configuracao?.logo_preview_url && (
                    <img
                      src={configuracao.logo_preview_url}
                      alt="Logo da empresa"
                      className="brand-logo"
                    />
                  )}
                  <strong>{configuracao?.nome_empresa || 'Sistema de Certificações'}</strong>
                </div>
                <small>Conformidade, auditoria e rastreabilidade</small>
              </div>

              <nav className="sidebar-menu">
                <NavLink to="/" end className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                  Dashboard
                </NavLink>
                <NavLink to="/auditorias" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                  Auditorias
                </NavLink>
                <NavLink to="/cadastros" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                  Cadastros
                </NavLink>
                <NavLink to="/avaliacoes" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                  Avaliações
                </NavLink>
                <NavLink to="/demandas" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                  Demandas
                </NavLink>
                <NavLink to="/cronograma" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                  Cronograma
                </NavLink>
                <NavLink to="/configuracoes" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                  Configurações
                </NavLink>
              </nav>
            </aside>

            <div className="main-shell">
              <header className="topbar">
                <div className="topbar-actions">
                  <label className="form-row compact">
                    <span>Programa</span>
                    <select
                      value={programaId ?? ''}
                      onChange={(e) => {
                        const value = e.target.value ? Number(e.target.value) : null;
                        setProgramaId(value);
                        if (value) {
                          localStorage.setItem('programa_id', String(value));
                        } else {
                          localStorage.removeItem('programa_id');
                        }
                        setAuditoriaId(null);
                        localStorage.removeItem('auditoria_id');
                        void carregarAuditorias(value);
                      }}
                    >
                      <option value="">Selecione</option>
                      {programas.map((programa) => (
                        <option key={programa.id} value={programa.id}>
                          {programa.nome}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="form-row compact">
                    <span>Auditoria (Ano)</span>
                    <select
                      value={auditoriaId ?? ''}
                      onChange={(e) => {
                        const value = e.target.value ? Number(e.target.value) : null;
                        setAuditoriaId(value);
                        if (value) {
                          localStorage.setItem('auditoria_id', String(value));
                        } else {
                          localStorage.removeItem('auditoria_id');
                        }
                      }}
                    >
                      <option value="">Selecione</option>
                      {auditorias.map((a) => (
                        <option key={a.id} value={a.id}>
                          Auditoria {a.year}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="user-block">
                    <span>{usuario ? `${usuario.nome} (${usuario.role})` : 'Usuário'}</span>
                    <button type="button" onClick={onLogout}>
                      Sair
                    </button>
                  </div>
                </div>
              </header>

              <main className="page-container">{rotas}</main>
            </div>
          </div>
        ) : (
          <main className="page-container">{rotas}</main>
        )}
      </div>
    </BrowserRouter>
  );
}
