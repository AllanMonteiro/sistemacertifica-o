from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.core.rbac import require_roles
from app.db.session import get_db
from app.models.fsc import (
    AuditoriaAno,
    AvaliacaoIndicador,
    Criterio,
    Demanda,
    Evidencia,
    Indicador,
    ProgramaCertificacao,
    Principio,
    StatusAndamentoEnum,
    StatusConformidadeEnum,
)
from app.models.user import RoleEnum, User
from app.schemas.fsc import (
    AvaliacaoSemEvidenciaOut,
    CronogramaGanttItem,
    DemandaOut,
    NcPorPrincipioItem,
    ResumoConformidadeCertificacaoItem,
    ResumoStatusItem,
    STATUS_CONFORMIDADE_LABELS,
)

router = APIRouter(prefix='/api/reports', tags=['Relatórios'])

STATUS_CRONOGRAMA = (
    StatusConformidadeEnum.nc_menor,
    StatusConformidadeEnum.nc_maior,
    StatusConformidadeEnum.oportunidade_melhoria,
)


def _buscar_auditoria(db: Session, auditoria_id: int) -> AuditoriaAno:
    auditoria = db.get(AuditoriaAno, auditoria_id)
    if not auditoria:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Auditoria não encontrada.')
    return auditoria


@router.get('/resumo-status', response_model=list[ResumoStatusItem])
def resumo_status(
    auditoria_id: int = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.AUDITOR)),
) -> list[ResumoStatusItem]:
    _buscar_auditoria(db, auditoria_id)

    rows = db.execute(
        select(AvaliacaoIndicador.status_conformidade, func.count(AvaliacaoIndicador.id))
        .where(AvaliacaoIndicador.auditoria_ano_id == auditoria_id)
        .group_by(AvaliacaoIndicador.status_conformidade)
    ).all()

    count_by_status = {status_value: int(qtd) for status_value, qtd in rows}
    result: list[ResumoStatusItem] = []
    for status_value in StatusConformidadeEnum:
        result.append(
            ResumoStatusItem(
                status_conformidade=status_value,
                label=STATUS_CONFORMIDADE_LABELS[status_value],
                quantidade=count_by_status.get(status_value, 0),
            )
        )
    return result


@router.get('/avaliacoes-sem-evidencias', response_model=list[AvaliacaoSemEvidenciaOut])
def avaliacoes_sem_evidencias(
    auditoria_id: int = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.AUDITOR)),
) -> list[AvaliacaoSemEvidenciaOut]:
    _buscar_auditoria(db, auditoria_id)

    evidencias_subq = (
        select(Evidencia.avaliacao_id.label('avaliacao_id'), func.count(Evidencia.id).label('qtd'))
        .group_by(Evidencia.avaliacao_id)
        .subquery()
    )

    rows = db.execute(
        select(
            AvaliacaoIndicador.id,
            AvaliacaoIndicador.indicator_id,
            Indicador.titulo,
            AvaliacaoIndicador.status_conformidade,
        )
        .join(Indicador, Indicador.id == AvaliacaoIndicador.indicator_id)
        .outerjoin(evidencias_subq, evidencias_subq.c.avaliacao_id == AvaliacaoIndicador.id)
        .where(
            AvaliacaoIndicador.auditoria_ano_id == auditoria_id,
            func.coalesce(evidencias_subq.c.qtd, 0) == 0,
        )
        .order_by(Indicador.titulo)
    ).all()

    return [
        AvaliacaoSemEvidenciaOut(
            avaliacao_id=int(row[0]),
            indicator_id=int(row[1]),
            indicador_titulo=str(row[2]),
            status_conformidade=row[3],
        )
        for row in rows
    ]


@router.get('/demandas-atrasadas', response_model=list[DemandaOut])
def demandas_atrasadas(
    auditoria_id: int = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.AUDITOR)),
) -> list[DemandaOut]:
    _buscar_auditoria(db, auditoria_id)

    demandas = db.scalars(
        select(Demanda)
        .join(AvaliacaoIndicador, AvaliacaoIndicador.id == Demanda.avaliacao_id)
        .where(
            AvaliacaoIndicador.auditoria_ano_id == auditoria_id,
            Demanda.due_date.is_not(None),
            Demanda.due_date < date.today(),
            Demanda.status_andamento != StatusAndamentoEnum.concluida,
        )
        .order_by(Demanda.due_date.asc(), Demanda.id.desc())
    ).all()
    return list(demandas)


@router.get('/nc-por-principio', response_model=list[NcPorPrincipioItem])
def nc_por_principio(
    auditoria_id: int = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.AUDITOR)),
) -> list[NcPorPrincipioItem]:
    _buscar_auditoria(db, auditoria_id)

    nc_menor_case = case((AvaliacaoIndicador.status_conformidade == StatusConformidadeEnum.nc_menor, 1), else_=0)
    nc_maior_case = case((AvaliacaoIndicador.status_conformidade == StatusConformidadeEnum.nc_maior, 1), else_=0)

    rows = db.execute(
        select(
            Principio.id,
            Principio.titulo,
            func.sum(nc_menor_case).label('nc_menor'),
            func.sum(nc_maior_case).label('nc_maior'),
        )
        .join(Criterio, Criterio.principio_id == Principio.id)
        .join(Indicador, Indicador.criterio_id == Criterio.id)
        .join(AvaliacaoIndicador, AvaliacaoIndicador.indicator_id == Indicador.id)
        .where(
            AvaliacaoIndicador.auditoria_ano_id == auditoria_id,
            AvaliacaoIndicador.status_conformidade.in_(
                (StatusConformidadeEnum.nc_menor, StatusConformidadeEnum.nc_maior)
            ),
        )
        .group_by(Principio.id, Principio.titulo)
        .order_by(Principio.titulo)
    ).all()

    result: list[NcPorPrincipioItem] = []
    for row in rows:
        menor = int(row[2] or 0)
        maior = int(row[3] or 0)
        result.append(
            NcPorPrincipioItem(
                principio_id=int(row[0]),
                principio_titulo=str(row[1]),
                nc_menor=menor,
                nc_maior=maior,
                total_nc=menor + maior,
            )
        )
    return result


@router.get('/resumo-conformidade-por-certificacao', response_model=list[ResumoConformidadeCertificacaoItem])
def resumo_conformidade_por_certificacao(
    year: int = Query(..., ge=2000, le=2100),
    programa_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.AUDITOR)),
) -> list[ResumoConformidadeCertificacaoItem]:
    query = (
        select(
            ProgramaCertificacao.id.label('programa_id'),
            ProgramaCertificacao.nome.label('programa_nome'),
            AuditoriaAno.year.label('year'),
            func.sum(case((AvaliacaoIndicador.status_conformidade == StatusConformidadeEnum.conforme, 1), else_=0)).label('conformes'),
            func.sum(
                case(
                    (
                        AvaliacaoIndicador.status_conformidade.in_(
                            (StatusConformidadeEnum.nc_menor, StatusConformidadeEnum.nc_maior)
                        ),
                        1,
                    ),
                    else_=0,
                )
            ).label('nao_conformes'),
            func.sum(
                case((AvaliacaoIndicador.status_conformidade == StatusConformidadeEnum.oportunidade_melhoria, 1), else_=0)
            ).label('oportunidades_melhoria'),
            func.sum(
                case((AvaliacaoIndicador.status_conformidade == StatusConformidadeEnum.nao_se_aplica, 1), else_=0)
            ).label('nao_se_aplica'),
            func.count(AvaliacaoIndicador.id).label('total_avaliacoes'),
        )
        .join(AuditoriaAno, AuditoriaAno.programa_id == ProgramaCertificacao.id)
        .join(AvaliacaoIndicador, AvaliacaoIndicador.auditoria_ano_id == AuditoriaAno.id)
        .where(AuditoriaAno.year == year)
        .group_by(ProgramaCertificacao.id, ProgramaCertificacao.nome, AuditoriaAno.year)
        .order_by(ProgramaCertificacao.nome)
    )

    if programa_id:
        query = query.where(ProgramaCertificacao.id == programa_id)

    rows = db.execute(query).all()
    return [
        ResumoConformidadeCertificacaoItem(
            programa_id=int(row.programa_id),
            programa_nome=str(row.programa_nome),
            year=int(row.year),
            conformes=int(row.conformes or 0),
            nao_conformes=int(row.nao_conformes or 0),
            oportunidades_melhoria=int(row.oportunidades_melhoria or 0),
            nao_se_aplica=int(row.nao_se_aplica or 0),
            total_avaliacoes=int(row.total_avaliacoes or 0),
        )
        for row in rows
    ]


@router.get('/cronograma-nc', response_model=list[CronogramaGanttItem])
def cronograma_nc(
    programa_id: int = Query(...),
    auditoria_id: int = Query(...),
    incluir_concluidas: bool = Query(default=True),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.AUDITOR, RoleEnum.RESPONSAVEL)),
) -> list[CronogramaGanttItem]:
    auditoria = _buscar_auditoria(db, auditoria_id)
    if auditoria.programa_id != programa_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='A auditoria informada não pertence ao programa selecionado.',
        )

    query = (
        select(
            Demanda.id.label('demanda_id'),
            AvaliacaoIndicador.id.label('avaliacao_id'),
            AuditoriaAno.id.label('auditoria_id'),
            Demanda.programa_id.label('programa_id'),
            Indicador.titulo.label('indicador_titulo'),
            Demanda.titulo.label('titulo'),
            User.nome.label('responsavel_nome'),
            Demanda.prioridade.label('prioridade'),
            Demanda.status_andamento.label('status_andamento'),
            AvaliacaoIndicador.status_conformidade.label('status_conformidade'),
            func.coalesce(Demanda.start_date, Demanda.due_date, AuditoriaAno.data_inicio).label('data_inicio'),
            func.coalesce(Demanda.due_date, Demanda.start_date, AuditoriaAno.data_fim).label('data_fim'),
        )
        .join(AvaliacaoIndicador, AvaliacaoIndicador.id == Demanda.avaliacao_id)
        .join(AuditoriaAno, AuditoriaAno.id == AvaliacaoIndicador.auditoria_ano_id)
        .join(Indicador, Indicador.id == AvaliacaoIndicador.indicator_id)
        .outerjoin(User, User.id == Demanda.responsavel_id)
        .where(
            Demanda.programa_id == programa_id,
            AvaliacaoIndicador.auditoria_ano_id == auditoria_id,
            AvaliacaoIndicador.status_conformidade.in_(STATUS_CRONOGRAMA),
            or_(Demanda.start_date.is_not(None), Demanda.due_date.is_not(None)),
        )
        .order_by(
            Demanda.start_date.asc().nulls_last(),
            Demanda.due_date.asc().nulls_last(),
            Demanda.id.desc(),
        )
    )

    if not incluir_concluidas:
        query = query.where(Demanda.status_andamento != StatusAndamentoEnum.concluida)

    rows = db.execute(query).all()
    resultado: list[CronogramaGanttItem] = []
    for row in rows:
        data_inicio = row.data_inicio
        data_fim = row.data_fim
        if data_inicio is None or data_fim is None:
            continue
        if data_fim < data_inicio:
            data_inicio, data_fim = data_fim, data_inicio
        resultado.append(
            CronogramaGanttItem(
                demanda_id=int(row.demanda_id),
                avaliacao_id=int(row.avaliacao_id),
                auditoria_id=int(row.auditoria_id),
                programa_id=int(row.programa_id),
                indicador_titulo=str(row.indicador_titulo),
                titulo=str(row.titulo),
                responsavel_nome=str(row.responsavel_nome) if row.responsavel_nome else None,
                prioridade=row.prioridade,
                status_andamento=row.status_andamento,
                status_conformidade=row.status_conformidade,
                data_inicio=data_inicio,
                data_fim=data_fim,
            )
        )
    return resultado
