import { useEffect, useMemo, useState } from 'react';

import {
  api,
  Demanda,
  STATUS_ANDAMENTO_LABELS,
  StatusAndamento,
  Usuario,
} from '../api';
import Table from '../components/Table';

type Props = {
  programaId: number | null;
  auditoriaId: number | null;
};

const STATUS_LIST: StatusAndamento[] = ['aberta', 'em_andamento', 'em_validacao', 'concluida', 'bloqueada'];

export default function Demandas({ programaId, auditoriaId }: Props) {
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [statusFiltro, setStatusFiltro] = useState('');
  const [responsavelFiltro, setResponsavelFiltro] = useState('');
  const [atrasadas, setAtrasadas] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const usuariosMap = useMemo(() => new Map(usuarios.map((u) => [u.id, u.nome])), [usuarios]);

  const carregar = async () => {
    if (!programaId || !auditoriaId) return;
    setErro('');
    try {
      const [dResp, uResp] = await Promise.all([
        api.get<Demanda[]>('/demandas', {
          params: {
            programa_id: programaId,
            auditoria_id: auditoriaId,
            status_andamento: statusFiltro || undefined,
            responsavel_id: responsavelFiltro || undefined,
            atrasadas: atrasadas || undefined,
          },
        }),
        api.get<Usuario[]>('/usuarios').catch(() => ({ data: [] as Usuario[] })),
      ]);
      setDemandas(dResp.data);
      setUsuarios(uResp.data);
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao carregar demandas.');
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId, auditoriaId, statusFiltro, responsavelFiltro, atrasadas]);

  const atualizarStatus = async (id: number, novoStatus: StatusAndamento) => {
    setErro('');
    setMensagem('');
    try {
      await api.patch(`/demandas/${id}`, { status_andamento: novoStatus });
      await carregar();
      setMensagem('Andamento da demanda atualizado.');
    } catch (err: any) {
      setErro(err?.response?.data?.detail || 'Falha ao atualizar demanda.');
    }
  };

  if (!programaId || !auditoriaId) {
    return <div className="card">Selecione Programa e Auditoria (Ano) para visualizar demandas.</div>;
  }

  return (
    <div className="grid gap-16">
      <h2>Demandas</h2>

      <div className="card">
        <div className="filters-row">
          <label className="form-row compact">
            <span>Status</span>
            <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)}>
              <option value="">Todos</option>
              {STATUS_LIST.map((status) => (
                <option key={status} value={status}>
                  {STATUS_ANDAMENTO_LABELS[status]}
                </option>
              ))}
            </select>
          </label>

          <label className="form-row compact">
            <span>Responsável</span>
            <select value={responsavelFiltro} onChange={(e) => setResponsavelFiltro(e.target.value)}>
              <option value="">Todos</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="form-row compact checkbox-row">
            <input type="checkbox" checked={atrasadas} onChange={(e) => setAtrasadas(e.target.checked)} />
            <span>Somente atrasadas</span>
          </label>
        </div>

        {erro && <div className="error">{erro}</div>}
        {mensagem && <div className="success">{mensagem}</div>}

        <Table
          rows={demandas}
          columns={[
            { title: 'Título', render: (d) => d.titulo },
            { title: 'Padrão', render: (d) => d.padrao || '-' },
            {
              title: 'Responsável',
              render: (d) => (d.responsavel_id ? usuariosMap.get(d.responsavel_id) || d.responsavel_id : '-'),
            },
            { title: 'Início', render: (d) => d.start_date || '-' },
            { title: 'Prazo', render: (d) => d.due_date || '-' },
            {
              title: 'Andamento',
              render: (d) => (
                <select
                  value={d.status_andamento}
                  onChange={(e) => atualizarStatus(d.id, e.target.value as StatusAndamento)}
                >
                  {STATUS_LIST.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_ANDAMENTO_LABELS[status]}
                    </option>
                  ))}
                </select>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
