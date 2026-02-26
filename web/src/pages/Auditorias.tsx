import {
  FormEvent,
  useState } from 'react';

import { api,
  Auditoria,
  formatApiError,
} from '../api';
import Modal from '../components/Modal';
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
  const [padrao, setPadrao] = useState('');
  const [escopo, setEscopo] = useState('');
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const [auditoriaEdicao, setAuditoriaEdicao] = useState<Auditoria | null>(null);
  const [editYear, setEditYear] = useState(new Date().getFullYear());
  const [editTipo, setEditTipo] = useState('Certificação');
  const [editOrganismo, setEditOrganismo] = useState('');
  const [editPadrao, setEditPadrao] = useState('');
  const [editEscopo, setEditEscopo] = useState('');
  const [senhaEdicao, setSenhaEdicao] = useState('');

  const [auditoriaExclusao, setAuditoriaExclusao] = useState<Auditoria | null>(null);
  const [senhaExclusao, setSenhaExclusao] = useState('');

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
        padrao_utilizado: padrao || null,
        escopo: escopo || null,
      });
      await refreshAuditorias();
      setMensagem('Auditoria criada com sucesso.');
    } catch (err: any) {
      setErro(formatApiError(err, 'Falha ao criar auditoria.'));
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
      setErro(formatApiError(err, 'Falha ao gerar avaliações.'));
    }
  };

  const abrirEdicao = (auditoria: Auditoria) => {
    setAuditoriaEdicao(auditoria);
    setEditYear(auditoria.year);
    setEditTipo(auditoria.tipo || 'Certificação');
    setEditOrganismo(auditoria.organismo_certificador || '');
    setEditPadrao(auditoria.padrao_utilizado || '');
    setEditEscopo(auditoria.escopo || '');
    setSenhaEdicao('');
  };

  const fecharEdicao = () => {
    setAuditoriaEdicao(null);
    setSenhaEdicao('');
  };

  const salvarEdicao = async (e: FormEvent) => {
    e.preventDefault();
    if (!auditoriaEdicao) return;
    if (!senhaEdicao.trim()) {
      setErro('Informe a senha do sistema para salvar a edição.');
      return;
    }

    setErro('');
    setMensagem('');
    try {
      await api.put(`/auditorias/${auditoriaEdicao.id}`, {
        programa_id: auditoriaEdicao.programa_id,
        year: editYear,
        tipo: editTipo || null,
        organismo_certificador: editOrganismo || null,
        padrao_utilizado: editPadrao || null,
        escopo: editEscopo || null,
        senha_sistema: senhaEdicao.trim(),
      });
      await refreshAuditorias();
      fecharEdicao();
      setMensagem('Auditoria atualizada com sucesso.');
    } catch (err: any) {
      setErro(formatApiError(err, 'Falha ao atualizar auditoria.'));
    }
  };

  const abrirExclusao = (auditoria: Auditoria) => {
    setAuditoriaExclusao(auditoria);
    setSenhaExclusao('');
  };

  const fecharExclusao = () => {
    setAuditoriaExclusao(null);
    setSenhaExclusao('');
  };

  const confirmarExclusao = async (e: FormEvent) => {
    e.preventDefault();
    if (!auditoriaExclusao) return;
    if (!senhaExclusao.trim()) {
      setErro('Informe a senha do sistema para confirmar a exclusão.');
      return;
    }

    setErro('');
    setMensagem('');
    try {
      await api.delete(`/auditorias/${auditoriaExclusao.id}`, {
        data: {
          senha_sistema: senhaExclusao.trim(),
        },
      });
      if (auditoriaId === auditoriaExclusao.id) {
        setAuditoriaId(null);
      }
      await refreshAuditorias();
      fecharExclusao();
      setMensagem('Auditoria excluída com sucesso.');
    } catch (err: any) {
      setErro(formatApiError(err, 'Falha ao excluir auditoria.'));
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
            <span>Padrão Utilizado</span>
            <input value={padrao} onChange={(e) => setPadrao(e.target.value)} />
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
            { title: 'Padrão', render: (a) => a.padrao_utilizado || '-' },
            { title: 'Escopo', render: (a) => a.escopo || '-' },
            {
              title: 'Ações',
              render: (a) => (
                <div className="row-actions">
                  <button type="button" className="btn-secondary" onClick={() => abrirEdicao(a)}>
                    Editar
                  </button>
                  <button type="button" className="btn-danger" onClick={() => abrirExclusao(a)}>
                    Excluir
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>

      <Modal open={!!auditoriaEdicao} title="Editar Auditoria" onClose={fecharEdicao}>
        <form className="grid gap-12" onSubmit={salvarEdicao}>
          <label className="form-row">
            <span>Ano</span>
            <input
              type="number"
              min={2000}
              max={2100}
              value={editYear}
              onChange={(e) => setEditYear(Number(e.target.value))}
              required
            />
          </label>

          <label className="form-row">
            <span>Tipo</span>
            <select value={editTipo} onChange={(e) => setEditTipo(e.target.value)}>
              <option value="Certificação">Certificação</option>
              <option value="Recertificação">Recertificação</option>
            </select>
          </label>

          <label className="form-row">
            <span>Organismo Certificador</span>
            <input value={editOrganismo} onChange={(e) => setEditOrganismo(e.target.value)} />
          </label>

          <label className="form-row">
            <span>Padrão Utilizado</span>
            <input value={editPadrao} onChange={(e) => setEditPadrao(e.target.value)} />
          </label>

          <label className="form-row">
            <span>Escopo</span>
            <input value={editEscopo} onChange={(e) => setEditEscopo(e.target.value)} />
          </label>

          <label className="form-row">
            <span>Senha de login do usuário atual (confirmação)</span>
            <input
              type="password"
              value={senhaEdicao}
              onChange={(e) => setSenhaEdicao(e.target.value)}
              placeholder="Digite a mesma senha usada no login"
              required
            />
          </label>

          <div className="row-actions">
            <button type="button" className="btn-secondary" onClick={fecharEdicao}>
              Cancelar
            </button>
            <button type="submit">Salvar Alterações</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!auditoriaExclusao} title="Excluir Auditoria" onClose={fecharExclusao}>
        <form className="grid gap-12" onSubmit={confirmarExclusao}>
          <p>
            Confirma a exclusão da auditoria <strong>{auditoriaExclusao?.year}</strong>?
          </p>
          <label className="form-row">
            <span>Senha de login do usuário atual (confirmação)</span>
            <input
              type="password"
              value={senhaExclusao}
              onChange={(e) => setSenhaExclusao(e.target.value)}
              placeholder="Digite a mesma senha usada no login"
              required
            />
          </label>

          <div className="row-actions">
            <button type="button" className="btn-secondary" onClick={fecharExclusao}>
              Cancelar
            </button>
            <button type="submit" className="btn-danger">
              Excluir Auditoria
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
