import {
  FormEvent,
  useEffect,
  useState } from 'react';

import { api,
  ConfiguracaoSistema,
  Usuario,
  formatApiError,
} from '../api';

type Props = {
  refreshConfiguracaoNoHeader: () => Promise<void>;
};

export default function Configuracoes({ refreshConfiguracaoNoHeader }: Props) {
  const [configuracao, setConfiguracao] = useState<ConfiguracaoSistema | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [arquivoLogo, setArquivoLogo] = useState<File | null>(null);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacaoNovaSenha, setConfirmacaoNovaSenha] = useState('');
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const carregar = async () => {
    try {
      setErro('');
      const [configResp, usuarioResp] = await Promise.all([
        api.get<ConfiguracaoSistema>('/configuracoes'),
        api.get<Usuario>('/auth/me'),
      ]);
      setConfiguracao(configResp.data);
      setNomeEmpresa(configResp.data.nome_empresa);
      setUsuario(usuarioResp.data);
    } catch (err: any) {
      setErro(formatApiError(err, 'Falha ao carregar configuracoes.'));
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const salvarNomeEmpresa = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setErro('');
      setMensagem('');
      await api.put('/configuracoes', { nome_empresa: nomeEmpresa });
      await carregar();
      await refreshConfiguracaoNoHeader();
      setMensagem('Nome da empresa atualizado com sucesso.');
    } catch (err: any) {
      setErro(formatApiError(err, 'Falha ao atualizar nome da empresa.'));
    }
  };

  const uploadLogo = async (e: FormEvent) => {
    e.preventDefault();
    if (!arquivoLogo) {
      setErro('Selecione um arquivo de logo.');
      return;
    }
    try {
      setErro('');
      setMensagem('');
      const formData = new FormData();
      formData.append('file', arquivoLogo);
      await api.post('/configuracoes/logo-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setArquivoLogo(null);
      await carregar();
      await refreshConfiguracaoNoHeader();
      setMensagem('Logo da empresa atualizada com sucesso.');
    } catch (err: any) {
      setErro(formatApiError(err, 'Falha ao atualizar logo da empresa.'));
    }
  };

  const removerLogo = async () => {
    try {
      setErro('');
      setMensagem('');
      await api.put('/configuracoes', { logo_url: null });
      await carregar();
      await refreshConfiguracaoNoHeader();
      setMensagem('Logo removida com sucesso.');
    } catch (err: any) {
      setErro(formatApiError(err, 'Falha ao remover logo.'));
    }
  };

  const alterarSenhaLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (novaSenha !== confirmacaoNovaSenha) {
      setErro('A confirmacao da nova senha nao confere.');
      return;
    }
    try {
      setErro('');
      setMensagem('');
      await api.post('/auth/alterar-senha', {
        senha_atual: senhaAtual,
        nova_senha: novaSenha,
      });
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmacaoNovaSenha('');
      setMensagem('Senha de login alterada com sucesso.');
    } catch (err: any) {
      setErro(formatApiError(err, 'Falha ao alterar senha.'));
    }
  };

  return (
    <div className="grid gap-16">
      <h2>Configuracoes</h2>

      {erro && <div className="error">{erro}</div>}
      {mensagem && <div className="success">{mensagem}</div>}

      <div className="card grid gap-12">
        <h3>Nome da Empresa</h3>
        <form className="grid gap-12" onSubmit={salvarNomeEmpresa}>
          <label className="form-row">
            <span>Nome da empresa</span>
            <input
              value={nomeEmpresa}
              onChange={(e) => setNomeEmpresa(e.target.value)}
              placeholder="Digite o nome da empresa"
              required
            />
          </label>
          <button type="submit">Salvar Nome</button>
        </form>
      </div>

      <div className="card grid gap-12">
        <h3>Logo da Empresa</h3>
        <div className="config-logo-box">
          {configuracao?.logo_preview_url ? (
            <img src={configuracao.logo_preview_url} alt="Logo da empresa" className="config-logo-preview" />
          ) : (
            <p className="muted-text">Nenhuma logo cadastrada.</p>
          )}
        </div>

        <form className="grid gap-12" onSubmit={uploadLogo}>
          <label className="form-row">
            <span>Arquivo da logo</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => setArquivoLogo(e.target.files?.[0] || null)}
            />
          </label>
          <button type="submit">Enviar Logo</button>
        </form>

        {configuracao?.logo_url && (
          <button type="button" onClick={removerLogo}>
            Remover Logo
          </button>
        )}
      </div>

      <div className="card grid gap-12">
        <h3>Senha de Login</h3>
        {usuario?.role === 'ADMIN' ? (
          <form className="grid gap-12" onSubmit={alterarSenhaLogin}>
            <label className="form-row">
              <span>Senha atual</span>
              <input
                type="password"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                placeholder="Digite a senha atual"
                required
              />
            </label>
            <label className="form-row">
              <span>Nova senha</span>
              <input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Minimo 6 caracteres"
                minLength={6}
                required
              />
            </label>
            <label className="form-row">
              <span>Confirmar nova senha</span>
              <input
                type="password"
                value={confirmacaoNovaSenha}
                onChange={(e) => setConfirmacaoNovaSenha(e.target.value)}
                placeholder="Repita a nova senha"
                minLength={6}
                required
              />
            </label>
            <button type="submit">Alterar Senha</button>
          </form>
        ) : (
          <p className="muted-text">Apenas ADMIN pode alterar senha de login.</p>
        )}
      </div>
    </div>
  );
}
