import {
  useEffect,
  useMemo,
  useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  api,
  Avaliacao,
  Criterio,
  Demanda,
  Indicador,
  Principio,
  STATUS_ANDAMENTO_LABELS,
  STATUS_CONFORMIDADE_LABELS,
  StatusConformidade,
  formatApiError,
} from '../api';

type Props = {
  programaId: number | null;
  auditoriaId: number | null;
};

type CriterioDirecionador = {
  id: number;
  codigo: string;
  titulo: string;
  avaliacaoIds: number[];
  totalAvaliacoes: number;
  ideias: Demanda[];
};

type PrincipioDirecionador = {
  id: number;
  codigo: string;
  titulo: string;
  totalAvaliacoes: number;
  totalIdeias: number;
  criterios: CriterioDirecionador[];
};

const STATUS_NC: StatusConformidade[] = ['nc_maior', 'nc_menor', 'oportunidade_melhoria'];

const ORDEM_STATUS_NC: Record<StatusConformidade, number> = {
  nc_maior: 0,
  nc_menor: 1,
  oportunidade_melhoria: 2,
  conforme: 3,
  nao_se_aplica: 4,
};

const CLASSE_IDEIA_POR_STATUS: Record<StatusConformidade, string> = {
  nc_maior: 'driver-idea-critica',
  nc_menor: 'driver-idea-media',
  oportunidade_melhoria: 'driver-idea-melhoria',
  conforme: 'driver-idea-neutra',
  nao_se_aplica: 'driver-idea-neutra',
};

function ordenarCodigoOuTitulo(aCodigo?: string | null, aTitulo?: string, bCodigo?: string | null, bTitulo?: string): number {
  const a = `${aCodigo || ''} ${aTitulo || ''}`.trim().toLowerCase();
  const b = `${bCodigo || ''} ${bTitulo || ''}`.trim().toLowerCase();
  return a.localeCompare(b, 'pt-BR');
}

function statusEhNaoConformidade(status: StatusConformidade): boolean {
  return STATUS_NC.includes(status);
}

export default function Direcionadores({ programaId, auditoriaId }: Props) {
  const navigate = useNavigate();
  const [avaliacoesNc, setAvaliacoesNc] = useState<Avaliacao[]>([]);
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [criterios, setCriterios] = useState<Criterio[]>([]);
  const [principios, setPrincipios] = useState<Principio[]>([]);
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [mostrarApenasAtivas, setMostrarApenasAtivas] = useState(true);
  const [mostrarResumo, setMostrarResumo] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!programaId || !auditoriaId) return;
    const carregar = async () => {
      setErro('');
      try {
        const [avaliacoesResp, indicadoresResp, criteriosResp, principiosResp, demandasResp] = await Promise.all([
          api.get<Avaliacao[]>('/avaliacoes', { params: { programa_id: programaId, auditoria_id: auditoriaId } }),
          api.get<Indicador[]>('/indicadores', { params: { programa_id: programaId } }),
          api.get<Criterio[]>('/criterios', { params: { programa_id: programaId } }),
          api.get<Principio[]>('/principios', { params: { programa_id: programaId } }),
          api.get<Demanda[]>('/demandas', { params: { programa_id: programaId, auditoria_id: auditoriaId } }),
        ]);

        setAvaliacoesNc(
          avaliacoesResp.data.filter((avaliacao) => statusEhNaoConformidade(avaliacao.status_conformidade))
        );
        setIndicadores(indicadoresResp.data);
        setCriterios(criteriosResp.data);
        setPrincipios(principiosResp.data);
        setDemandas(demandasResp.data);
      } catch (err: any) {
        setErro(formatApiError(err, 'Falha ao carregar diagrama de direcionadores.'));
      }
    };
    void carregar();
  }, [programaId, auditoriaId]);

  const estrutura = useMemo<PrincipioDirecionador[]>(() => {
    const indicadorMap = new Map(indicadores.map((item) => [item.id, item]));
    const criterioMap = new Map(criterios.map((item) => [item.id, item]));
    const principioMap = new Map(principios.map((item) => [item.id, item]));

    const demandasFiltradas = mostrarApenasAtivas
      ? demandas.filter((item) => item.status_andamento !== 'concluida')
      : demandas;
    const demandasPorAvaliacao = new Map<number, Demanda[]>();
    for (const demanda of demandasFiltradas) {
      const lista = demandasPorAvaliacao.get(demanda.avaliacao_id) || [];
      lista.push(demanda);
      demandasPorAvaliacao.set(demanda.avaliacao_id, lista);
    }

    const porPrincipio = new Map<number, PrincipioDirecionador & { criterioMapInterno: Map<number, CriterioDirecionador> }>();

    for (const avaliacao of avaliacoesNc) {
      const indicador = indicadorMap.get(avaliacao.indicator_id);
      if (!indicador) continue;
      const criterio = criterioMap.get(indicador.criterio_id);
      if (!criterio) continue;
      const principio = principioMap.get(criterio.principio_id);
      if (!principio) continue;

      let principioNode = porPrincipio.get(principio.id);
      if (!principioNode) {
        principioNode = {
          id: principio.id,
          codigo: principio.codigo || '',
          titulo: principio.titulo,
          totalAvaliacoes: 0,
          totalIdeias: 0,
          criterios: [],
          criterioMapInterno: new Map<number, CriterioDirecionador>(),
        };
        porPrincipio.set(principio.id, principioNode);
      }

      let criterioNode = principioNode.criterioMapInterno.get(criterio.id);
      if (!criterioNode) {
        criterioNode = {
          id: criterio.id,
          codigo: criterio.codigo || '',
          titulo: criterio.titulo,
          avaliacaoIds: [],
          totalAvaliacoes: 0,
          ideias: [],
        };
        principioNode.criterioMapInterno.set(criterio.id, criterioNode);
        principioNode.criterios.push(criterioNode);
      }

      if (!criterioNode.avaliacaoIds.includes(avaliacao.id)) {
        criterioNode.avaliacaoIds.push(avaliacao.id);
        criterioNode.totalAvaliacoes += 1;
        principioNode.totalAvaliacoes += 1;
      }
    }

    const resultado = Array.from(porPrincipio.values()).map((principioNode) => {
      for (const criterioNode of principioNode.criterios) {
        const ideiasMap = new Map<number, Demanda>();
        for (const avaliacaoId of criterioNode.avaliacaoIds) {
          const ideias = demandasPorAvaliacao.get(avaliacaoId) || [];
          for (const ideia of ideias) {
            ideiasMap.set(ideia.id, ideia);
          }
        }
        criterioNode.ideias = Array.from(ideiasMap.values()).sort((a, b) => {
          const prioridade = a.prioridade.localeCompare(b.prioridade);
          if (prioridade !== 0) return prioridade;
          return b.id - a.id;
        });
        principioNode.totalIdeias += criterioNode.ideias.length;
      }

      principioNode.criterios.sort((a, b) => ordenarCodigoOuTitulo(a.codigo, a.titulo, b.codigo, b.titulo));
      return principioNode;
    });

    resultado.sort((a, b) => ordenarCodigoOuTitulo(a.codigo, a.titulo, b.codigo, b.titulo));
    return resultado;
  }, [avaliacoesNc, indicadores, criterios, principios, demandas, mostrarApenasAtivas]);

  const statusPorAvaliacao = useMemo(
    () => new Map(avaliacoesNc.map((item) => [item.id, item.status_conformidade])),
    [avaliacoesNc]
  );

  const resumo = useMemo(() => {
    const primarios = estrutura.length;
    const secundarios = estrutura.reduce((acc, item) => acc + item.criterios.length, 0);
    const ideias = estrutura.reduce((acc, item) => acc + item.totalIdeias, 0);
    const criteriosSemIdeias = estrutura.reduce(
      (acc, item) => acc + item.criterios.filter((criterio) => criterio.ideias.length === 0).length,
      0
    );
    return {
      primarios,
      secundarios,
      ideias,
      avaliacoesNc: avaliacoesNc.length,
      criteriosSemIdeias,
    };
  }, [estrutura, avaliacoesNc.length]);

  if (!programaId || !auditoriaId) {
    return <div className="card">Selecione Programa e Auditoria (Ano) para visualizar o diagrama de direcionadores.</div>;
  }

  return (
    <div className="grid gap-16">
      <div className="between">
        <h2>Diagrama de Direcionadores para Nao Conformidades</h2>
        <div className="drivers-toolbar-actions">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={mostrarApenasAtivas}
              onChange={(e) => setMostrarApenasAtivas(e.target.checked)}
            />
            <span>Mostrar apenas ativas</span>
          </label>
          <button type="button" className="btn-secondary" onClick={() => setMostrarResumo((state) => !state)}>
            {mostrarResumo ? 'Ocultar resumo' : 'Relatorio de resumo'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => window.print()}>
            Imprimir diagrama
          </button>
        </div>
      </div>

      {erro && <div className="error">{erro}</div>}

      {mostrarResumo && (
        <div className="card drivers-summary">
          <div>
            <span>Direcionadores primarios</span>
            <strong>{resumo.primarios}</strong>
          </div>
          <div>
            <span>Direcionadores secundarios</span>
            <strong>{resumo.secundarios}</strong>
          </div>
          <div>
            <span>Ideias de mudanca</span>
            <strong>{resumo.ideias}</strong>
          </div>
          <div>
            <span>Avaliacoes NC/OM</span>
            <strong>{resumo.avaliacoesNc}</strong>
          </div>
          <div>
            <span>Secundarios sem ideias</span>
            <strong>{resumo.criteriosSemIdeias}</strong>
          </div>
        </div>
      )}

      <div className="card drivers-board">
        {estrutura.length === 0 ? (
          <p>Nao ha avaliacoes em NC Maior, NC Menor ou Oportunidade de Melhoria para este contexto.</p>
        ) : (
          <>
            <div className="drivers-columns-header">
              <h3>Direcionador primario</h3>
              <h3>Direcionador secundario</h3>
              <h3>Ideias de mudancas</h3>
            </div>

            <div className="drivers-rows">
              {estrutura.map((principioNode) => (
                <div key={principioNode.id} className="drivers-row">
                  <div className="drivers-col">
                    <article className="driver-card driver-card-primary">
                      <span className="driver-code">
                        {principioNode.codigo ? `P ${principioNode.codigo}` : 'Principio'}
                      </span>
                      <p>{principioNode.titulo}</p>
                      <div className="driver-card-footer">
                        <span>{principioNode.totalAvaliacoes} avaliacoes NC</span>
                        <span>{principioNode.totalIdeias} ideias</span>
                      </div>
                    </article>
                  </div>

                  <div className="drivers-col">
                    {principioNode.criterios.map((criterioNode) => (
                      <article key={criterioNode.id} className="driver-card driver-card-secondary">
                        <span className="driver-code">
                          {criterioNode.codigo ? `C ${criterioNode.codigo}` : 'Criterio'}
                        </span>
                        <p>{criterioNode.titulo}</p>
                        <div className="driver-card-footer">
                          <span>{criterioNode.totalAvaliacoes} avaliacoes NC</span>
                          <span>{criterioNode.ideias.length} ideias</span>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="drivers-col">
                    {principioNode.criterios.map((criterioNode) => (
                      <div key={`ideias-${criterioNode.id}`} className="driver-idea-group">
                        {criterioNode.ideias.length === 0 ? (
                          <article className="driver-idea-card driver-idea-empty">
                            <p>Sem ideia de mudanca para este direcionador.</p>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => {
                                if (criterioNode.avaliacaoIds[0]) {
                                  navigate(`/avaliacoes/${criterioNode.avaliacaoIds[0]}`);
                                }
                              }}
                            >
                              Adicione ideia e teste
                            </button>
                          </article>
                        ) : (
                          criterioNode.ideias.map((demanda) => {
                            const statusConformidade =
                              statusPorAvaliacao.get(demanda.avaliacao_id) || 'oportunidade_melhoria';
                            return (
                              <article
                                key={demanda.id}
                                className={`driver-idea-card ${CLASSE_IDEIA_POR_STATUS[statusConformidade]}`}
                              >
                                <div className="driver-idea-head">
                                  <strong>{demanda.titulo}</strong>
                                  <span>{STATUS_ANDAMENTO_LABELS[demanda.status_andamento]}</span>
                                </div>
                                <p>{demanda.descricao || 'Sem descricao cadastrada.'}</p>
                                <div className="driver-idea-footer">
                                  <small>{STATUS_CONFORMIDADE_LABELS[statusConformidade]}</small>
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => navigate(`/avaliacoes/${demanda.avaliacao_id}`)}
                                  >
                                    Abrir avaliacao
                                  </button>
                                </div>
                              </article>
                            );
                          })
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
