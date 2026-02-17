import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api, LoginResponse } from '../api';

type Props = {
  onLogin: (token: string) => Promise<void>;
};

export default function Login({ onLogin }: Props) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@local');
  const [senha, setSenha] = useState('admin123');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const { data } = await api.post<LoginResponse>('/auth/login', { email, senha });
      localStorage.setItem('token', data.access_token);
      await onLogin(data.access_token);
      navigate('/');
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha no login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-center">
      <form className="card login-card" onSubmit={submit}>
        <h1>Sistema de Certificações</h1>
        <p>Gerenciamento de conformidade, auditoria anual e rastreabilidade.</p>

        <label className="form-row">
          <span>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>

        <label className="form-row">
          <span>Senha</span>
          <input value={senha} onChange={(e) => setSenha(e.target.value)} type="password" required />
        </label>

        {erro && <div className="error">{erro}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
