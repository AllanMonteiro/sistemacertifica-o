import {
  useEffect,
  useMemo,
  useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  api,
  Demanda,
  STATUS_CONFORMIDADE_LABELS,
  STATUS_ANDAMENTO_LABELS,
  StatusConformidade,
  StatusAndamento,
  Usuario,
  formatApiError,
} from '../api';
import Table from '../components/Table';

type Props = {
  programaId: number | null;
  auditoriaId: number | null;
};

const STATUS_LIST: StatusAndamento[] = ['aberta', 'em_andamento', 'em_validacao', 'concluida', 'bloqueada'];

type FiltroConformidade = '' | StatusConformidade | 'nao_conformes';
const FILTRO_CONFORMIDADE_VALUES: FiltroConformidade[] = [
  '',
  'conforme',
  'nao_conformes',
  'nc_menor',
  'nc_maior',
  'oportunidade_melhoria',
  'nao_se_aplica',
];

const parseFiltroConformidade = (value: string | null): FiltroConformidade => {
  if (!value) return '';
  if (FILTRO_CONFORMIDADE_VALUES.includes(value as FiltroConformidade)) {
    return value as FiltroConformidade;
  }
  return '';
};

export default function Demandas({ programaId, auditoriaId }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [statusFiltro, setStatusFiltro] = useState('');
  const [conformidadeFiltro, setConformidadeFiltro] = useState<FiltroConformidade>(() =>
    parseFiltroConformidade(searchParams.get('filtro_conformidade'))
  );
  const [responsavelFiltro, setResponsavelFiltro] = useState('');
  const [atrasadas, setAtrasadas] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const usuariosMap = useMemo(() => new Map(usuarios.map((u) => [u.id, u.nome])), [usuarios]);

  useEffect(() => {
    const filtroUrl = parseFiltroConformidade(searchParams.get('filtro_conformidade'));
    if (filtroUrl !== conformidadeFiltro) {
      setConformidadeFiltro(filtroUrl);
    }
  }, [searchParams, conformidadeFiltro]);

  const atualizarFiltroConformidade = (value: FiltroConformidade) => {
    setConformidadeFiltro(value);
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set('filtro_conformidade', value);
    } else {
      params.delete('filtro_conformidade');
    }
    setSearchParams(params);
  };

  const carregar = async () => {
    if (!programaId || !auditoriaId) return;
    setErro('');
    try {
      const [dResp, uResp] = await Promise.all([
        api.get<Demanda[]>('/demandas', {
          params: {
            programa_id: programaId,
            auditoria_id: auditoriaId,
            status_conformidade:
              conformidadeFiltro && conformidadeFiltro !== 'nao_conformes' ? conformidadeFiltro : undefined,
            nao_conformes: conformidadeFiltro === 'nao_conformes' ? true : undefined,
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
      setErro(formatApiError(err, 'Falha ao carregar demandas.'));
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId, auditoriaId, conformidadeFiltro, statusFiltro, responsavelFiltro, atrasadas]);

  const atualizarStatus = async (id: number, novoStatus: StatusAndamento) => {
    setErro('');
    setMensagem('');
    try {
      await api.patch(`/demandas/${id}`, { status_andamento: novoStatus });
      await carregar();
      setMensagem('Andamento da demanda atualizado.');
    } catch (err: any) {
      setErro(formatApiError(err, 'Falha ao atualizar demanda.'));
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
            <span>Status de Conformidade</span>
            <select
              value={conformidadeFiltro}
              onChange={(e) => atualizarFiltroConformidade(e.target.value as FiltroConformidade)}
            >
              <option value="">Todos</option>
              <option value="conforme">{STATUS_CONFORMIDADE_LABELS.conforme}</option>
              <option value="nao_conformes">Não Conformes (Menor + Maior)</option>
              <option value="nc_menor">{STATUS_CONFORMIDADE_LABELS.nc_menor}</option>
              <option value="nc_maior">{STATUS_CONFORMIDADE_LABELS.nc_maior}</option>
              <option value="oportunidade_melhoria">{STATUS_CONFORMIDADE_LABELS.oportunidade_melhoria}</option>
              <option value="nao_se_aplica">{STATUS_CONFORMIDADE_LABELS.nao_se_aplica}</option>
            </select>
          </label>

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
