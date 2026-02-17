import { FormEvent, useEffect, useState } from 'react';

import { api, ConfiguracaoSistema } from '../api';

type Props = {
  refreshConfiguracaoNoHeader: () => Promise<void>;
};

export default function Configuracoes({ refreshConfiguracaoNoHeader }: Props) {
  const [configuracao, setConfiguracao] = useState<ConfiguracaoSistema | null>(null);
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [arquivoLogo, setArquivoLogo] = useState<File | null>(null);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const carregar = async () => {
    try {
      setErro('');
      const { data } = await api.get<ConfiguracaoSistema>('/configuracoes');
      setConfiguracao(data);
      setNomeEmpresa(data.nome_empresa);
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao carregar configurações.');
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
      setErro(err?.response?.data?.detail || 'Falha ao atualizar nome da empresa.');
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
      setErro(err?.response?.data?.detail || 'Falha ao atualizar logo da empresa.');
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
      setErro(err?.response?.data?.detail || 'Falha ao remover logo.');
    }
  };

  return (
    <div className="grid gap-16">
      <h2>Configurações</h2>

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
    </div>
  );
}
