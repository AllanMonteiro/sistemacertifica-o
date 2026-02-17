import { FormEvent, useState } from 'react';

import { api, Auditoria } from '../api';
import Table from '../components/Table';

type Props = {
  auditorias: Auditoria[];
  programaId: number | null;
  auditoriaId: number | null;
  setAuditoriaId: (id: number | null) => void;
  refreshAuditorias: () => Promise<void>;
};

export default function Auditorias({
  auditorias,
  programaId,
  auditoriaId,
  setAuditoriaId,
  refreshAuditorias,
}: Props) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [tipo, setTipo] = useState('Certificação');
  const [organismo, setOrganismo] = useState('');
  const [escopo, setEscopo] = useState('');
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const criar = async (e: FormEvent) => {
    e.preventDefault();
    if (!programaId) {
      setErro('Selecione um Programa de Certificação antes de criar auditoria.');
      return;
    }
    setErro('');
    setMensagem('');
    try {
      await api.post('/auditorias', {
        programa_id: programaId,
        year,
        tipo: tipo || null,
        organismo_certificador: organismo || null,
        escopo: escopo || null,
      });
      await refreshAuditorias();
      setMensagem('Auditoria criada com sucesso.');
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao criar auditoria.');
    }
  };

  const gerarAvaliacoes = async () => {
    if (!auditoriaId) return;
    setErro('');
    setMensagem('');
    try {
      const { data } = await api.post<{ mensagem: string }>(`/auditorias/${auditoriaId}/gerar-avaliacoes`);
      setMensagem(data.mensagem);
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao gerar avaliações.');
    }
  };

  return (
    <div className="grid gap-16">
      <h2>Auditorias (Ano)</h2>
      {!programaId && (
        <div className="card">Selecione um Programa de Certificação no topo para gerenciar auditorias.</div>
      )}

      <div className="card">
        <h3>Nova Auditoria</h3>
        <form className="grid two-col gap-12" onSubmit={criar}>
          <label className="form-row">
            <span>Ano</span>
            <input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              required
            />
          </label>

          <label className="form-row">
            <span>Tipo</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="Certificação">Certificação</option>
              <option value="Recertificação">Recertificação</option>
            </select>
          </label>

          <label className="form-row">
            <span>Organismo Certificador</span>
            <input value={organismo} onChange={(e) => setOrganismo(e.target.value)} />
          </label>

          <label className="form-row">
            <span>Escopo</span>
            <input value={escopo} onChange={(e) => setEscopo(e.target.value)} />
          </label>

          <button type="submit" disabled={!programaId}>
            Criar Auditoria
          </button>
        </form>
      </div>

      {erro && <div className="error">{erro}</div>}
      {mensagem && <div className="success">{mensagem}</div>}

      <div className="card">
        <div className="between">
          <h3>Anos Cadastrados</h3>
          <button type="button" onClick={gerarAvaliacoes} disabled={!auditoriaId}>
            Gerar Avaliações do Ano Selecionado
          </button>
        </div>
        <Table
          rows={auditorias}
          columns={[
            {
              title: 'Selecionar',
              render: (a) => (
                <button type="button" onClick={() => setAuditoriaId(a.id)}>
                  {auditoriaId === a.id ? 'Selecionada' : 'Selecionar'}
                </button>
              ),
            },
            { title: 'Ano', render: (a) => a.year },
            { title: 'Tipo', render: (a) => a.tipo || '-' },
            { title: 'Organismo', render: (a) => a.organismo_certificador || '-' },
            { title: 'Escopo', render: (a) => a.escopo || '-' },
          ]}
        />
      </div>
    </div>
  );
}
