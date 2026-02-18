
from datetime import UTC, date, datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.rbac import require_roles
from app.core.security import get_current_user, hash_password
from app.db.session import get_db
from app.models.auditlog import AcaoAuditEnum, AuditLog
from app.models.fsc import (
    AuditoriaAno,
    AvaliacaoIndicador,
    ConfiguracaoSistema,
    Criterio,
    Demanda,
    EvidenceType,
    Evidencia,
    EvidenciaKindEnum,
    Indicador,
    ProgramaCertificacao,
    Principio,
    StatusAndamentoEnum,
    StatusConformidadeEnum,
)
from app.models.user import RoleEnum, User
from app.schemas.fsc import (
    AuditLogOut,
    AuditoriaCreate,
    AuditoriaOut,
    AuditoriaUpdate,
    AvaliacaoCreate,
    AvaliacaoDetalheOut,
    AvaliacaoOut,
    AvaliacaoPatch,
    AvaliacaoUpdate,
    ConfiguracaoSistemaOut,
    ConfiguracaoSistemaUpdate,
    CriterioCreate,
    CriterioOut,
    CriterioUpdate,
    DemandaCreate,
    DemandaOut,
    DemandaPatch,
    DemandaUpdate,
    EvidenceTypeCreate,
    EvidenceTypeOut,
    EvidenceTypeUpdate,
    EvidenciaCreate,
    EvidenciaOut,
    IndicadorCreate,
    IndicadorOut,
    IndicadorUpdate,
    MensagemOut,
    ProgramaCertificacaoCreate,
    ProgramaCertificacaoOut,
    ProgramaCertificacaoUpdate,
    PrincipioCreate,
    PrincipioOut,
    PrincipioUpdate,
    ResponsavelCreate,
)
from app.schemas.user import UserOut
from app.services.audit_logger import registrar_log
from app.services.s3_storage import baixar_arquivo_s3, upload_fileobj

router = APIRouter(prefix='/api', tags=['Certificações'])

STATUS_DEMANDA_ATIVA = (
    StatusAndamentoEnum.aberta,
    StatusAndamentoEnum.em_andamento,
    StatusAndamentoEnum.em_validacao,
)

STATUS_AVALIACAO_CRONOGRAMA = (
    StatusConformidadeEnum.nc_menor,
    StatusConformidadeEnum.nc_maior,
    StatusConformidadeEnum.oportunidade_melhoria,
)


def _dump_model(model) -> dict:
    return jsonable_encoder({column.name: getattr(model, column.name) for column in model.__table__.columns})


def _texto_preenchido(valor: str | None) -> bool:
    return bool(valor and valor.strip())


def _validar_datas_auditoria(data_inicio: date | None, data_fim: date | None) -> None:
    if data_inicio and data_fim and data_fim < data_inicio:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='A data_fim não pode ser anterior à data_início.',
        )


def _validar_datas_demanda(data_inicio: date | None, data_fim: date | None) -> None:
    if data_inicio and data_fim and data_fim < data_inicio:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='A data_fim da demanda não pode ser anterior à data_início.',
        )


def _normalizar_datas_demanda(data_inicio: date | None, data_fim: date | None) -> tuple[date | None, date | None]:
    if data_inicio and not data_fim:
        return data_inicio, data_inicio
    if data_fim and not data_inicio:
        return data_fim, data_fim
    return data_inicio, data_fim


def _validar_exigencia_cronograma(
    status_conformidade: StatusConformidadeEnum,
    data_inicio: date | None,
    data_fim: date | None,
) -> None:
    if status_conformidade in STATUS_AVALIACAO_CRONOGRAMA and (not data_inicio or not data_fim):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Para NC Menor, NC Maior ou Oportunidade de Melhoria, informe data_início e data_fim da demanda.',
        )


def _contar_demandas_ativas(db: Session, avaliacao_id: int) -> int:
    count = db.scalar(
        select(func.count(Demanda.id)).where(
            Demanda.avaliacao_id == avaliacao_id,
            Demanda.status_andamento.in_(STATUS_DEMANDA_ATIVA),
        )
    )
    return int(count or 0)


def _validar_regras_avaliacao(
    db: Session,
    status_conformidade: StatusConformidadeEnum,
    observacoes: str | None,
    avaliacao_id: int | None = None,
) -> None:
    obs_preenchida = _texto_preenchido(observacoes)

    if status_conformidade == StatusConformidadeEnum.nao_se_aplica and not obs_preenchida:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Para status "Não se Aplica", observacoes/justificativa é obrigatório.',
        )

    if status_conformidade in (StatusConformidadeEnum.nc_menor, StatusConformidadeEnum.nc_maior) and not obs_preenchida:
        if not avaliacao_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    'Para NC Menor ou NC Maior, informe observacoes/justificativa '
                    'ou crie ao menos uma Demanda ativa.'
                ),
            )
        if _contar_demandas_ativas(db, avaliacao_id) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    'Para NC Menor ou NC Maior, deve existir ao menos uma Demanda '
                    'ativa (aberta/em_andamento/em_validacao) ou observacoes/justificativa.'
                ),
            )


def _validar_regra_b_pos_demanda(db: Session, avaliacao: AvaliacaoIndicador) -> None:
    obs_preenchida = _texto_preenchido(avaliacao.observacoes)
    if avaliacao.status_conformidade in (StatusConformidadeEnum.nc_menor, StatusConformidadeEnum.nc_maior) and not obs_preenchida:
        if _contar_demandas_ativas(db, avaliacao.id) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Esta ação deixaria a avaliação em NC sem Demanda ativa e sem justificativa.',
            )


def _buscar_principio(db: Session, principio_id: int) -> Principio:
    principio = db.get(Principio, principio_id)
    if not principio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Princípio não encontrado.')
    return principio


def _buscar_criterio(db: Session, criterio_id: int) -> Criterio:
    criterio = db.get(Criterio, criterio_id)
    if not criterio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Critério não encontrado.')
    return criterio


def _buscar_indicador(db: Session, indicador_id: int) -> Indicador:
    indicador = db.get(Indicador, indicador_id)
    if not indicador:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Indicador não encontrado.')
    return indicador


def _buscar_auditoria(db: Session, auditoria_id: int) -> AuditoriaAno:
    auditoria = db.get(AuditoriaAno, auditoria_id)
    if not auditoria:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Auditoria não encontrada.')
    return auditoria


def _buscar_avaliacao(db: Session, avaliacao_id: int) -> AvaliacaoIndicador:
    avaliacao = db.get(AvaliacaoIndicador, avaliacao_id)
    if not avaliacao:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Avaliação não encontrada.')
    return avaliacao


def _buscar_tipo_evidencia(db: Session, tipo_id: int) -> EvidenceType:
    tipo = db.get(EvidenceType, tipo_id)
    if not tipo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Tipo de evidência não encontrado.')
    return tipo


def _buscar_demanda(db: Session, demanda_id: int) -> Demanda:
    demanda = db.get(Demanda, demanda_id)
    if not demanda:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Demanda não encontrada.')
    return demanda


def _buscar_usuario(db: Session, usuario_id: int) -> User:
    user = db.get(User, usuario_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Usuário responsável não encontrado.')
    return user


def _buscar_programa(db: Session, programa_id: int) -> ProgramaCertificacao:
    programa = db.get(ProgramaCertificacao, programa_id)
    if not programa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Programa de certificação não encontrado.')
    return programa


def _obter_ou_criar_configuracao(db: Session) -> ConfiguracaoSistema:
    configuracao = db.scalar(select(ConfiguracaoSistema).order_by(ConfiguracaoSistema.id).limit(1))
    if configuracao:
        return configuracao
    configuracao = ConfiguracaoSistema(nome_empresa='Empresa')
    db.add(configuracao)
    db.flush()
    return configuracao


def _montar_logo_preview_url(configuracao: ConfiguracaoSistema, request: Request) -> str | None:
    if not configuracao.logo_url:
        return None
    if not configuracao.logo_url.startswith('s3://'):
        return configuracao.logo_url

    base_url = str(request.base_url).rstrip('/')
    versao = int(configuracao.updated_at.timestamp()) if configuracao.updated_at else configuracao.id
    return f'{base_url}/api/configuracoes/logo?v={versao}'


def _configuracao_out(configuracao: ConfiguracaoSistema, request: Request) -> ConfiguracaoSistemaOut:
    return ConfiguracaoSistemaOut(
        id=configuracao.id,
        nome_empresa=configuracao.nome_empresa,
        logo_url=configuracao.logo_url,
        logo_preview_url=_montar_logo_preview_url(configuracao, request),
        updated_by=configuracao.updated_by,
        created_at=configuracao.created_at,
        updated_at=configuracao.updated_at,
    )


def _validar_mesmo_programa(programa_a: int, programa_b: int, contexto: str) -> None:
    if programa_a != programa_b:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Inconsistência de programa de certificação em {contexto}.',
        )


@router.get('/configuracoes', response_model=ConfiguracaoSistemaOut)
def obter_configuracoes_sistema(
    request: Request,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ConfiguracaoSistemaOut:
    configuracao = _obter_ou_criar_configuracao(db)
    db.commit()
    db.refresh(configuracao)
    return _configuracao_out(configuracao, request)


@router.put('/configuracoes', response_model=ConfiguracaoSistemaOut)
def atualizar_configuracoes_sistema(
    request: Request,
    payload: ConfiguracaoSistemaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR)),
) -> ConfiguracaoSistemaOut:
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Nenhum campo foi informado para atualização.')

    configuracao = _obter_ou_criar_configuracao(db)
    old_value = _dump_model(configuracao)

    if 'nome_empresa' in data:
        nome = data['nome_empresa']
        if not _texto_preenchido(nome):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='O nome da empresa não pode ser vazio.',
            )
        configuracao.nome_empresa = str(nome).strip()

    if 'logo_url' in data:
        configuracao.logo_url = data['logo_url']

    configuracao.updated_by = current_user.id
    registrar_log(
        db,
        entidade='configuracao_sistema',
        entidade_id=configuracao.id,
        acao=AcaoAuditEnum.UPDATE,
        created_by=current_user.id,
        old_value=old_value,
        new_value=_dump_model(configuracao),
    )
    db.commit()
    db.refresh(configuracao)
    return _configuracao_out(configuracao, request)


@router.get('/configuracoes/logo')
def obter_logo_empresa(
    db: Session = Depends(get_db),
) -> Response:
    configuracao = _obter_ou_criar_configuracao(db)
    if not configuracao.logo_url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Logo da empresa não cadastrada.')
    if not configuracao.logo_url.startswith('s3://'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Logo cadastrada não está em armazenamento interno.',
        )

    try:
        conteudo, content_type = baixar_arquivo_s3(configuracao.logo_url)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Não foi possível carregar a logo.') from exc

    return Response(
        content=conteudo,
        media_type=content_type or 'application/octet-stream',
        headers={'Cache-Control': 'no-store'},
    )


@router.post('/configuracoes/logo-upload', response_model=ConfiguracaoSistemaOut)
def upload_logo_empresa(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR)),
) -> ConfiguracaoSistemaOut:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Arquivo de logo inválido.')
    if file.content_type and not file.content_type.startswith('image/'):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Envie um arquivo de imagem para a logo.')

    configuracao = _obter_ou_criar_configuracao(db)
    old_value = _dump_model(configuracao)

    suffix = Path(file.filename).suffix
    key = f'configuracoes/logo_empresa_{uuid4().hex}{suffix}'
    configuracao.logo_url = upload_fileobj(file.file, key, file.content_type)
    configuracao.updated_by = current_user.id

    registrar_log(
        db,
        entidade='configuracao_sistema',
        entidade_id=configuracao.id,
        acao=AcaoAuditEnum.UPDATE,
        created_by=current_user.id,
        old_value=old_value,
        new_value=_dump_model(configuracao),
    )
    db.commit()
    db.refresh(configuracao)
    return _configuracao_out(configuracao, request)


@router.get('/programas-certificacao', response_model=list[ProgramaCertificacaoOut])
def listar_programas_certificacao(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ProgramaCertificacaoOut]:
    return list(db.scalars(select(ProgramaCertificacao).order_by(ProgramaCertificacao.id)).all())


@router.post('/programas-certificacao', response_model=ProgramaCertificacaoOut, status_code=status.HTTP_201_CREATED)
def criar_programa_certificacao(
    payload: ProgramaCertificacaoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN)),
) -> ProgramaCertificacaoOut:
    existente_codigo = db.scalar(
        select(ProgramaCertificacao).where(func.lower(ProgramaCertificacao.codigo) == payload.codigo.lower())
    )
    if existente_codigo:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Já existe programa com este código.')
    existente_nome = db.scalar(
        select(ProgramaCertificacao).where(func.lower(ProgramaCertificacao.nome) == payload.nome.lower())
    )
    if existente_nome:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Já existe programa com este nome.')

    programa = ProgramaCertificacao(**payload.model_dump())
    db.add(programa)
    db.flush()
    registrar_log(
        db,
        entidade='programa_certificacao',
        entidade_id=programa.id,
        acao=AcaoAuditEnum.CREATE,
        created_by=current_user.id,
        new_value=_dump_model(programa),
        programa_id=programa.id,
    )
    db.commit()
    db.refresh(programa)
    return programa


@router.put('/programas-certificacao/{programa_id}', response_model=ProgramaCertificacaoOut)
def atualizar_programa_certificacao(
    programa_id: int,
    payload: ProgramaCertificacaoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN)),
) -> ProgramaCertificacaoOut:
    programa = _buscar_programa(db, programa_id)
    data = payload.model_dump(exclude_unset=True)
    if 'codigo' in data and data['codigo']:
        existe = db.scalar(
            select(ProgramaCertificacao).where(
                func.lower(ProgramaCertificacao.codigo) == data['codigo'].lower(),
                ProgramaCertificacao.id != programa_id,
            )
        )
        if existe:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Já existe programa com este código.')
    if 'nome' in data and data['nome']:
        existe = db.scalar(
            select(ProgramaCertificacao).where(
                func.lower(ProgramaCertificacao.nome) == data['nome'].lower(),
                ProgramaCertificacao.id != programa_id,
            )
        )
        if existe:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Já existe programa com este nome.')

    old_value = _dump_model(programa)
    for field, value in data.items():
        setattr(programa, field, value)
    registrar_log(
        db,
        entidade='programa_certificacao',
        entidade_id=programa.id,
        acao=AcaoAuditEnum.UPDATE,
        created_by=current_user.id,
        old_value=old_value,
        new_value=_dump_model(programa),
        programa_id=programa.id,
    )
    db.commit()
    db.refresh(programa)
    return programa


@router.delete('/programas-certificacao/{programa_id}', response_model=MensagemOut)
def remover_programa_certificacao(
    programa_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN)),
) -> MensagemOut:
    programa = _buscar_programa(db, programa_id)
    uso = db.scalar(
        select(func.count(AuditoriaAno.id)).where(AuditoriaAno.programa_id == programa_id)
    ) or 0
    if uso > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Não é possível excluir programa com auditorias vinculadas.',
        )
    old_value = _dump_model(programa)
    db.delete(programa)
    registrar_log(
        db,
        entidade='programa_certificacao',
        entidade_id=programa_id,
        acao=AcaoAuditEnum.DELETE,
        created_by=current_user.id,
        old_value=old_value,
        programa_id=programa_id,
    )
    db.commit()
    return MensagemOut(mensagem='Programa de certificação removido com sucesso.')


@router.get('/principios', response_model=list[PrincipioOut])
def listar_principios(
    programa_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[PrincipioOut]:
    query = select(Principio).order_by(Principio.id)
    if programa_id:
        query = query.where(Principio.programa_id == programa_id)
    return list(db.scalars(query).all())


@router.post('/principios', response_model=PrincipioOut, status_code=status.HTTP_201_CREATED)
def criar_principio(
    payload: PrincipioCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR)),
) -> PrincipioOut:
    _buscar_programa(db, payload.programa_id)
    principio = Principio(**payload.model_dump())
    db.add(principio)
    db.flush()
    registrar_log(
        db,
        entidade='principio',
        entidade_id=principio.id,
        acao=AcaoAuditEnum.CREATE,
        created_by=current_user.id,
        new_value=_dump_model(principio),
        programa_id=principio.programa_id,
    )
    db.commit()
    db.refresh(principio)
    return principio


@router.get('/principios/{principio_id}', response_model=PrincipioOut)
def obter_principio(
    principio_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> PrincipioOut:
    return _buscar_principio(db, principio_id)


@router.put('/principios/{principio_id}', response_model=PrincipioOut)
def atualizar_principio(
    principio_id: int,
    payload: PrincipioUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR)),
) -> PrincipioOut:
    principio = _buscar_principio(db, principio_id)
    data = payload.model_dump(exclude_unset=True)
    if 'programa_id' in data and data['programa_id'] is not None:
        _buscar_programa(db, data['programa_id'])

    old_value = _dump_model(principio)
    for field, value in data.items():
        setattr(principio, field, value)

    registrar_log(
        db,
        entidade='principio',
        entidade_id=principio.id,
        acao=AcaoAuditEnum.UPDATE,
        created_by=current_user.id,
        old_value=old_value,
        new_value=_dump_model(principio),
        programa_id=principio.programa_id,
    )
    db.commit()
    db.refresh(principio)
    return principio


@router.delete('/principios/{principio_id}', response_model=MensagemOut)
def remover_principio(
    principio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR)),
) -> MensagemOut:
    principio = _buscar_principio(db, principio_id)
    old_value = _dump_model(principio)
    db.delete(principio)
    registrar_log(
        db,
        entidade='principio',
        entidade_id=principio_id,
        acao=AcaoAuditEnum.DELETE,
        created_by=current_user.id,
        old_value=old_value,
        programa_id=principio.programa_id,
    )
    db.commit()
    return MensagemOut(mensagem='Princípio removido com sucesso.')


@router.get('/criterios', response_model=list[CriterioOut])
def listar_criterios(
    programa_id: int | None = Query(default=None),
    principio_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[CriterioOut]:
    query = select(Criterio).order_by(Criterio.id)
    if programa_id:
        query = query.where(Criterio.programa_id == programa_id)
    if principio_id:
        query = query.where(Criterio.principio_id == principio_id)
    return list(db.scalars(query).all())


@router.post('/criterios', response_model=CriterioOut, status_code=status.HTTP_201_CREATED)
def criar_criterio(
    payload: CriterioCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR)),
) -> CriterioOut:
    _buscar_programa(db, payload.programa_id)
    principio = _buscar_principio(db, payload.principio_id)
    _validar_mesmo_programa(payload.programa_id, principio.programa_id, 'criação de critério')
    criterio = Criterio(**payload.model_dump())
    db.add(criterio)
    db.flush()
    registrar_log(
        db,
        entidade='criterio',
        entidade_id=criterio.id,
        acao=AcaoAuditEnum.CREATE,
        created_by=current_user.id,
        new_value=_dump_model(criterio),
        programa_id=criterio.programa_id,
    )
    db.commit()
    db.refresh(criterio)
    return criterio


@router.get('/criterios/{criterio_id}', response_model=CriterioOut)
def obter_criterio(
    criterio_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> CriterioOut:
    return _buscar_criterio(db, criterio_id)


@router.put('/criterios/{criterio_id}', response_model=CriterioOut)
def atualizar_criterio(
    criterio_id: int,
    payload: CriterioUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR)),
) -> CriterioOut:
    criterio = _buscar_criterio(db, criterio_id)
    data = payload.model_dump(exclude_unset=True)
    programa_id = data.get('programa_id', criterio.programa_id)
    _buscar_programa(db, programa_id)
    principio_id = data.get('principio_id', criterio.principio_id)
    principio = _buscar_principio(db, principio_id)
    _validar_mesmo_programa(programa_id, principio.programa_id, 'atualização de critério')
    old_value = _dump_model(criterio)
    for field, value in data.items():
        setattr(criterio, field, value)
    registrar_log(
        db,
        entidade='criterio',
        entidade_id=criterio.id,
        acao=AcaoAuditEnum.UPDATE,
        created_by=current_user.id,
        old_value=old_value,
        new_value=_dump_model(criterio),
        programa_id=criterio.programa_id,
    )
    db.commit()
    db.refresh(criterio)
    return criterio


@router.delete('/criterios/{criterio_id}', response_model=MensagemOut)
def remover_criterio(
    criterio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR)),
) -> MensagemOut:
    criterio = _buscar_criterio(db, criterio_id)
    old_value = _dump_model(criterio)
    db.delete(criterio)
    registrar_log(
        db,
        entidade='criterio',
        entidade_id=criterio_id,
        acao=AcaoAuditEnum.DELETE,
        created_by=current_user.id,
        old_value=old_value,
        programa_id=criterio.programa_id,
    )
    db.commit()
    return MensagemOut(mensagem='Critério removido com sucesso.')

@router.get('/indicadores', response_model=list[IndicadorOut])
def listar_indicadores(
    programa_id: int | None = Query(default=None),
    criterio_id: int | None = Query(default=None),
    q: str | None = Query(default=None, description='Busca por código/título/descrição'),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[IndicadorOut]:
    query = select(Indicador).order_by(Indicador.id)
    if programa_id:
        query = query.where(Indicador.programa_id == programa_id)
    if criterio_id:
        query = query.where(Indicador.criterio_id == criterio_id)
    if q and q.strip():
        termo = f"%{q.strip()}%"
        query = query.where(
            or_(
                Indicador.codigo.ilike(termo),
                Indicador.titulo.ilike(termo),
                Indicador.descricao.ilike(termo),
            )
        )
    return list(db.scalars(query).all())


@router.post('/indicadores', response_model=IndicadorOut, status_code=status.HTTP_201_CREATED)
def criar_indicador(
    payload: IndicadorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR)),
) -> IndicadorOut:
    _buscar_programa(db, payload.programa_id)
    criterio = _buscar_criterio(db, payload.criterio_id)
    _validar_mesmo_programa(payload.programa_id, criterio.programa_id, 'criação de indicador')
    indicador = Indicador(**payload.model_dump())
    db.add(indicador)
    db.flush()
    registrar_log(
        db,
        entidade='indicador',
        entidade_id=indicador.id,
        acao=AcaoAuditEnum.CREATE,
        created_by=current_user.id,
        new_value=_dump_model(indicador),
        programa_id=indicador.programa_id,
    )
    db.commit()
    db.refresh(indicador)
    return indicador


@router.get('/indicadores/{indicador_id}', response_model=IndicadorOut)
def obter_indicador(
    indicador_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> IndicadorOut:
    return _buscar_indicador(db, indicador_id)


@router.put('/indicadores/{indicador_id}', response_model=IndicadorOut)
def atualizar_indicador(
    indicador_id: int,
    payload: IndicadorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR)),
) -> IndicadorOut:
    indicador = _buscar_indicador(db, indicador_id)
    data = payload.model_dump(exclude_unset=True)
    programa_id = data.get('programa_id', indicador.programa_id)
    _buscar_programa(db, programa_id)
    criterio_id = data.get('criterio_id', indicador.criterio_id)
    criterio = _buscar_criterio(db, criterio_id)
    _validar_mesmo_programa(programa_id, criterio.programa_id, 'atualização de indicador')
    old_value = _dump_model(indicador)
    for field, value in data.items():
        setattr(indicador, field, value)
    registrar_log(
        db,
        entidade='indicador',
        entidade_id=indicador.id,
        acao=AcaoAuditEnum.UPDATE,
        created_by=current_user.id,
        old_value=old_value,
        new_value=_dump_model(indicador),
        programa_id=indicador.programa_id,
    )
    db.commit()
    db.refresh(indicador)
    return indicador


@router.delete('/indicadores/{indicador_id}', response_model=MensagemOut)
def remover_indicador(
    indicador_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR)),
) -> MensagemOut:
    indicador = _buscar_indicador(db, indicador_id)
    old_value = _dump_model(indicador)
    db.delete(indicador)
    registrar_log(
        db,
        entidade='indicador',
        entidade_id=indicador_id,
        acao=AcaoAuditEnum.DELETE,
        created_by=current_user.id,
        old_value=old_value,
        programa_id=indicador.programa_id,
    )
    db.commit()
    return MensagemOut(mensagem='Indicador removido com sucesso.')


@router.get('/auditorias', response_model=list[AuditoriaOut])
def listar_auditorias(
    programa_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[AuditoriaOut]:
    query = select(AuditoriaAno).order_by(AuditoriaAno.year.desc())
    if programa_id:
        query = query.where(AuditoriaAno.programa_id == programa_id)
    return list(db.scalars(query).all())


@router.post('/auditorias', response_model=AuditoriaOut, status_code=status.HTTP_201_CREATED)
def criar_auditoria(
    payload: AuditoriaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR)),
) -> AuditoriaOut:
    _buscar_programa(db, payload.programa_id)
    _validar_datas_auditoria(payload.data_inicio, payload.data_fim)
    existente = db.scalar(
        select(AuditoriaAno).where(
            AuditoriaAno.programa_id == payload.programa_id,
            AuditoriaAno.year == payload.year,
        )
    )
    if existente:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Já existe auditoria deste programa para este ano.')

    auditoria = AuditoriaAno(**payload.model_dump())
    db.add(auditoria)
    db.flush()
    registrar_log(
        db,
        entidade='auditoria',
        entidade_id=auditoria.id,
        acao=AcaoAuditEnum.CREATE,
        created_by=current_user.id,
        new_value=_dump_model(auditoria),
        programa_id=auditoria.programa_id,
        auditoria_ano_id=auditoria.id,
    )
    db.commit()
    db.refresh(auditoria)
    return auditoria


@router.get('/auditorias/{auditoria_id}', response_model=AuditoriaOut)
def obter_auditoria(
    auditoria_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> AuditoriaOut:
    return _buscar_auditoria(db, auditoria_id)


@router.put('/auditorias/{auditoria_id}', response_model=AuditoriaOut)
def atualizar_auditoria(
    auditoria_id: int,
    payload: AuditoriaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR)),
) -> AuditoriaOut:
    auditoria = _buscar_auditoria(db, auditoria_id)
    data = payload.model_dump(exclude_unset=True)

    data_inicio = data.get('data_inicio', auditoria.data_inicio)
    data_fim = data.get('data_fim', auditoria.data_fim)
    _validar_datas_auditoria(data_inicio, data_fim)

    programa_id = data.get('programa_id', auditoria.programa_id)
    _buscar_programa(db, programa_id)

    if 'year' in data or 'programa_id' in data:
        year = data.get('year', auditoria.year)
        existente = db.scalar(
            select(AuditoriaAno).where(
                AuditoriaAno.programa_id == programa_id,
                AuditoriaAno.year == year,
                AuditoriaAno.id != auditoria.id,
            )
        )
        if existente:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Já existe auditoria deste programa para este ano.')

    old_value = _dump_model(auditoria)
    for field, value in data.items():
        setattr(auditoria, field, value)
    registrar_log(
        db,
        entidade='auditoria',
        entidade_id=auditoria.id,
        acao=AcaoAuditEnum.UPDATE,
        created_by=current_user.id,
        old_value=old_value,
        new_value=_dump_model(auditoria),
        programa_id=auditoria.programa_id,
        auditoria_ano_id=auditoria.id,
    )
    db.commit()
    db.refresh(auditoria)
    return auditoria


@router.delete('/auditorias/{auditoria_id}', response_model=MensagemOut)
def remover_auditoria(
    auditoria_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR)),
) -> MensagemOut:
    auditoria = _buscar_auditoria(db, auditoria_id)
    old_value = _dump_model(auditoria)
    db.delete(auditoria)
    registrar_log(
        db,
        entidade='auditoria',
        entidade_id=auditoria_id,
        acao=AcaoAuditEnum.DELETE,
        created_by=current_user.id,
        old_value=old_value,
        programa_id=auditoria.programa_id,
        auditoria_ano_id=auditoria_id,
    )
    db.commit()
    return MensagemOut(mensagem='Auditoria removida com sucesso.')


@router.post('/auditorias/{auditoria_id}/gerar-avaliacoes', response_model=MensagemOut)
def gerar_avaliacoes_para_auditoria(
    auditoria_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR)),
) -> MensagemOut:
    auditoria = _buscar_auditoria(db, auditoria_id)
    indicadores = list(
        db.scalars(select(Indicador).where(Indicador.programa_id == auditoria.programa_id)).all()
    )
    criadas = 0
    for indicador in indicadores:
        existente = db.scalar(
            select(AvaliacaoIndicador).where(
                AvaliacaoIndicador.indicator_id == indicador.id,
                AvaliacaoIndicador.auditoria_ano_id == auditoria.id,
            )
        )
        if existente:
            continue
        avaliacao = AvaliacaoIndicador(
            programa_id=auditoria.programa_id,
            indicator_id=indicador.id,
            auditoria_ano_id=auditoria.id,
            status_conformidade=StatusConformidadeEnum.conforme,
            observacoes=None,
            assessed_at=datetime.now(UTC),
        )
        db.add(avaliacao)
        db.flush()
        registrar_log(
            db,
            entidade='avaliacao',
            entidade_id=avaliacao.id,
            acao=AcaoAuditEnum.CREATE,
            created_by=current_user.id,
            new_value=_dump_model(avaliacao),
            programa_id=auditoria.programa_id,
            auditoria_ano_id=auditoria.id,
        )
        criadas += 1
    db.commit()
    return MensagemOut(
        mensagem=f'Avaliações geradas para Auditoria {auditoria.year}. Total de novas avaliações: {criadas}.'
    )

@router.get('/avaliacoes', response_model=list[AvaliacaoOut])
def listar_avaliacoes(
    programa_id: int | None = Query(default=None),
    auditoria_id: int | None = Query(default=None, alias='auditoria_id'),
    indicator_id: int | None = Query(default=None),
    status_conformidade: StatusConformidadeEnum | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[AvaliacaoOut]:
    query = select(AvaliacaoIndicador).order_by(AvaliacaoIndicador.id)
    if programa_id:
        query = query.where(AvaliacaoIndicador.programa_id == programa_id)
    if auditoria_id:
        query = query.where(AvaliacaoIndicador.auditoria_ano_id == auditoria_id)
    if indicator_id:
        query = query.where(AvaliacaoIndicador.indicator_id == indicator_id)
    if status_conformidade:
        query = query.where(AvaliacaoIndicador.status_conformidade == status_conformidade)
    return list(db.scalars(query).all())


@router.post('/avaliacoes', response_model=AvaliacaoOut, status_code=status.HTTP_201_CREATED)
def criar_avaliacao(
    payload: AvaliacaoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.AUDITOR)),
) -> AvaliacaoOut:
    indicador = _buscar_indicador(db, payload.indicator_id)
    auditoria = _buscar_auditoria(db, payload.auditoria_ano_id)
    _validar_mesmo_programa(indicador.programa_id, auditoria.programa_id, 'criação de avaliação')
    _validar_regras_avaliacao(db, payload.status_conformidade, payload.observacoes, None)

    existente = db.scalar(
        select(AvaliacaoIndicador).where(
            AvaliacaoIndicador.indicator_id == payload.indicator_id,
            AvaliacaoIndicador.auditoria_ano_id == payload.auditoria_ano_id,
        )
    )
    if existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Já existe avaliação deste indicador para esta Auditoria.',
        )

    avaliacao = AvaliacaoIndicador(
        **payload.model_dump(),
        programa_id=auditoria.programa_id,
        assessed_at=datetime.now(UTC),
    )
    db.add(avaliacao)
    db.flush()
    registrar_log(
        db,
        entidade='avaliacao',
        entidade_id=avaliacao.id,
        acao=AcaoAuditEnum.CREATE,
        created_by=current_user.id,
        new_value=_dump_model(avaliacao),
        programa_id=auditoria.programa_id,
        auditoria_ano_id=auditoria.id,
    )
    db.commit()
    db.refresh(avaliacao)
    return avaliacao


@router.get('/avaliacoes/{avaliacao_id}', response_model=AvaliacaoOut)
def obter_avaliacao(
    avaliacao_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> AvaliacaoOut:
    return _buscar_avaliacao(db, avaliacao_id)


@router.put('/avaliacoes/{avaliacao_id}', response_model=AvaliacaoOut)
def atualizar_avaliacao(
    avaliacao_id: int,
    payload: AvaliacaoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.AUDITOR)),
) -> AvaliacaoOut:
    avaliacao = _buscar_avaliacao(db, avaliacao_id)
    data = payload.model_dump(exclude_unset=True)

    indicator_id = data.get('indicator_id', avaliacao.indicator_id)
    auditoria_ano_id = data.get('auditoria_ano_id', avaliacao.auditoria_ano_id)
    status_conformidade = data.get('status_conformidade', avaliacao.status_conformidade)
    observacoes = data.get('observacoes', avaliacao.observacoes)

    indicador = _buscar_indicador(db, indicator_id)
    auditoria = _buscar_auditoria(db, auditoria_ano_id)
    _validar_mesmo_programa(indicador.programa_id, auditoria.programa_id, 'atualização de avaliação')
    _validar_regras_avaliacao(db, status_conformidade, observacoes, avaliacao.id)

    if indicator_id != avaliacao.indicator_id or auditoria_ano_id != avaliacao.auditoria_ano_id:
        existente = db.scalar(
            select(AvaliacaoIndicador).where(
                AvaliacaoIndicador.indicator_id == indicator_id,
                AvaliacaoIndicador.auditoria_ano_id == auditoria_ano_id,
                AvaliacaoIndicador.id != avaliacao.id,
            )
        )
        if existente:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Já existe avaliação deste indicador para esta Auditoria.',
            )

    old_value = _dump_model(avaliacao)
    status_anterior = avaliacao.status_conformidade
    avaliacao.programa_id = auditoria.programa_id
    for field, value in data.items():
        setattr(avaliacao, field, value)

    acao = AcaoAuditEnum.STATUS_CHANGE if status_anterior != avaliacao.status_conformidade else AcaoAuditEnum.UPDATE
    registrar_log(
        db,
        entidade='avaliacao',
        entidade_id=avaliacao.id,
        acao=acao,
        created_by=current_user.id,
        old_value=old_value,
        new_value=_dump_model(avaliacao),
        programa_id=auditoria.programa_id,
        auditoria_ano_id=auditoria_ano_id,
    )
    db.commit()
    db.refresh(avaliacao)
    return avaliacao


@router.patch('/avaliacoes/{avaliacao_id}', response_model=AvaliacaoOut)
def patch_avaliacao(
    avaliacao_id: int,
    payload: AvaliacaoPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.AUDITOR)),
) -> AvaliacaoOut:
    avaliacao = _buscar_avaliacao(db, avaliacao_id)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Nenhum campo foi informado para atualização.')

    status_conformidade = data.get('status_conformidade', avaliacao.status_conformidade)
    observacoes = data.get('observacoes', avaliacao.observacoes)
    _validar_regras_avaliacao(db, status_conformidade, observacoes, avaliacao.id)

    old_value = _dump_model(avaliacao)
    status_anterior = avaliacao.status_conformidade
    for field, value in data.items():
        setattr(avaliacao, field, value)
    acao = AcaoAuditEnum.STATUS_CHANGE if status_anterior != avaliacao.status_conformidade else AcaoAuditEnum.UPDATE
    registrar_log(
        db,
        entidade='avaliacao',
        entidade_id=avaliacao.id,
        acao=acao,
        created_by=current_user.id,
        old_value=old_value,
        new_value=_dump_model(avaliacao),
        programa_id=avaliacao.programa_id,
        auditoria_ano_id=avaliacao.auditoria_ano_id,
    )
    db.commit()
    db.refresh(avaliacao)
    return avaliacao


@router.delete('/avaliacoes/{avaliacao_id}', response_model=MensagemOut)
def remover_avaliacao(
    avaliacao_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.AUDITOR)),
) -> MensagemOut:
    avaliacao = _buscar_avaliacao(db, avaliacao_id)
    old_value = _dump_model(avaliacao)
    auditoria_id = avaliacao.auditoria_ano_id
    db.delete(avaliacao)
    registrar_log(
        db,
        entidade='avaliacao',
        entidade_id=avaliacao_id,
        acao=AcaoAuditEnum.DELETE,
        created_by=current_user.id,
        old_value=old_value,
        programa_id=avaliacao.programa_id,
        auditoria_ano_id=auditoria_id,
    )
    db.commit()
    return MensagemOut(mensagem='Avaliação removida com sucesso.')


@router.get('/avaliacoes/{avaliacao_id}/detalhe', response_model=AvaliacaoDetalheOut)
def detalhar_avaliacao(
    avaliacao_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> AvaliacaoDetalheOut:
    avaliacao = db.scalar(
        select(AvaliacaoIndicador)
        .where(AvaliacaoIndicador.id == avaliacao_id)
        .options(
            joinedload(AvaliacaoIndicador.indicador).joinedload(Indicador.criterio).joinedload(Criterio.principio),
            joinedload(AvaliacaoIndicador.evidencias),
            joinedload(AvaliacaoIndicador.demandas),
        )
    )
    if not avaliacao:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Avaliação não encontrada.')

    logs = list(
        db.scalars(
            select(AuditLog)
            .where(
                AuditLog.auditoria_ano_id == avaliacao.auditoria_ano_id,
                AuditLog.programa_id == avaliacao.programa_id,
            )
            .order_by(AuditLog.created_at.desc())
            .limit(30)
        ).all()
    )
    indicador = avaliacao.indicador
    criterio = indicador.criterio
    principio = criterio.principio
    return AvaliacaoDetalheOut(
        avaliacao=avaliacao,
        indicador=indicador,
        criterio=criterio,
        principio=principio,
        evidencias=avaliacao.evidencias,
        demandas=avaliacao.demandas,
        logs=logs,
    )

@router.get('/tipos-evidencia', response_model=list[EvidenceTypeOut])
def listar_tipos_evidencia(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[EvidenceTypeOut]:
    return list(db.scalars(select(EvidenceType).order_by(EvidenceType.nome)).all())


@router.post('/tipos-evidencia', response_model=EvidenceTypeOut, status_code=status.HTTP_201_CREATED)
def criar_tipo_evidencia(
    payload: EvidenceTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR)),
) -> EvidenceTypeOut:
    existente = db.scalar(select(EvidenceType).where(func.lower(EvidenceType.nome) == payload.nome.lower()))
    if existente:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Já existe tipo de evidência com este nome.')

    tipo = EvidenceType(**payload.model_dump())
    db.add(tipo)
    db.flush()
    registrar_log(
        db,
        entidade='tipo_evidencia',
        entidade_id=tipo.id,
        acao=AcaoAuditEnum.CREATE,
        created_by=current_user.id,
        new_value=_dump_model(tipo),
    )
    db.commit()
    db.refresh(tipo)
    return tipo


@router.get('/tipos-evidencia/{tipo_id}', response_model=EvidenceTypeOut)
def obter_tipo_evidencia(
    tipo_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> EvidenceTypeOut:
    return _buscar_tipo_evidencia(db, tipo_id)


@router.put('/tipos-evidencia/{tipo_id}', response_model=EvidenceTypeOut)
def atualizar_tipo_evidencia(
    tipo_id: int,
    payload: EvidenceTypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR)),
) -> EvidenceTypeOut:
    tipo = _buscar_tipo_evidencia(db, tipo_id)
    data = payload.model_dump(exclude_unset=True)
    if 'nome' in data and data['nome']:
        existente = db.scalar(
            select(EvidenceType).where(
                func.lower(EvidenceType.nome) == data['nome'].lower(),
                EvidenceType.id != tipo_id,
            )
        )
        if existente:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Já existe tipo de evidência com este nome.')

    old_value = _dump_model(tipo)
    for field, value in data.items():
        setattr(tipo, field, value)
    registrar_log(
        db,
        entidade='tipo_evidencia',
        entidade_id=tipo.id,
        acao=AcaoAuditEnum.UPDATE,
        created_by=current_user.id,
        old_value=old_value,
        new_value=_dump_model(tipo),
    )
    db.commit()
    db.refresh(tipo)
    return tipo


@router.delete('/tipos-evidencia/{tipo_id}', response_model=MensagemOut)
def remover_tipo_evidencia(
    tipo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR)),
) -> MensagemOut:
    tipo = _buscar_tipo_evidencia(db, tipo_id)
    old_value = _dump_model(tipo)
    db.delete(tipo)
    registrar_log(
        db,
        entidade='tipo_evidencia',
        entidade_id=tipo_id,
        acao=AcaoAuditEnum.DELETE,
        created_by=current_user.id,
        old_value=old_value,
    )
    db.commit()
    return MensagemOut(mensagem='Tipo de evidência removido com sucesso.')


@router.get('/evidencias', response_model=list[EvidenciaOut])
def listar_evidencias(
    programa_id: int | None = Query(default=None),
    avaliacao_id: int = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[EvidenciaOut]:
    query = select(Evidencia).where(Evidencia.avaliacao_id == avaliacao_id)
    if programa_id:
        query = query.where(Evidencia.programa_id == programa_id)
    return list(db.scalars(query.order_by(Evidencia.created_at.desc())).all())


@router.post('/evidencias', response_model=EvidenciaOut, status_code=status.HTTP_201_CREATED)
def criar_evidencia(
    payload: EvidenciaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.AUDITOR, RoleEnum.RESPONSAVEL)),
) -> EvidenciaOut:
    if payload.kind == EvidenciaKindEnum.arquivo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Para kind "arquivo", utilize o endpoint /api/evidencias/upload.',
        )
    avaliacao = _buscar_avaliacao(db, payload.avaliacao_id)
    if payload.tipo_evidencia_id is not None:
        _buscar_tipo_evidencia(db, payload.tipo_evidencia_id)

    evidencia = Evidencia(**payload.model_dump(), created_by=current_user.id)
    db.add(evidencia)
    evidencia.programa_id = avaliacao.programa_id
    db.flush()
    registrar_log(
        db,
        entidade='evidencia',
        entidade_id=evidencia.id,
        acao=AcaoAuditEnum.CREATE,
        created_by=current_user.id,
        new_value=_dump_model(evidencia),
        programa_id=avaliacao.programa_id,
        auditoria_ano_id=avaliacao.auditoria_ano_id,
    )
    db.commit()
    db.refresh(evidencia)
    return evidencia


@router.post('/evidencias/upload', response_model=EvidenciaOut, status_code=status.HTTP_201_CREATED)
def upload_evidencia(
    avaliacao_id: int = Form(...),
    tipo_evidencia_id: int | None = Form(default=None),
    observacoes: str | None = Form(default=None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.AUDITOR, RoleEnum.RESPONSAVEL)),
) -> EvidenciaOut:
    avaliacao = _buscar_avaliacao(db, avaliacao_id)
    if tipo_evidencia_id is not None:
        _buscar_tipo_evidencia(db, tipo_evidencia_id)

    suffix = Path(file.filename or 'arquivo').suffix
    key = f'auditoria_{avaliacao.auditoria_ano_id}/avaliacao_{avaliacao.id}/{uuid4().hex}{suffix}'
    url_or_path = upload_fileobj(file.file, key, file.content_type)

    evidencia = Evidencia(
        programa_id=avaliacao.programa_id,
        avaliacao_id=avaliacao.id,
        tipo_evidencia_id=tipo_evidencia_id,
        kind=EvidenciaKindEnum.arquivo,
        url_or_path=url_or_path,
        observacoes=observacoes,
        created_by=current_user.id,
    )
    db.add(evidencia)
    db.flush()
    registrar_log(
        db,
        entidade='evidencia',
        entidade_id=evidencia.id,
        acao=AcaoAuditEnum.CREATE,
        created_by=current_user.id,
        new_value=_dump_model(evidencia),
        programa_id=avaliacao.programa_id,
        auditoria_ano_id=avaliacao.auditoria_ano_id,
    )
    db.commit()
    db.refresh(evidencia)
    return evidencia


@router.get('/evidencias/{evidencia_id}', response_model=EvidenciaOut)
def obter_evidencia(
    evidencia_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> EvidenciaOut:
    evidencia = db.get(Evidencia, evidencia_id)
    if not evidencia:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Evidência não encontrada.')
    return evidencia


@router.delete('/evidencias/{evidencia_id}', response_model=MensagemOut)
def remover_evidencia(
    evidencia_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MensagemOut:
    evidencia = db.get(Evidencia, evidencia_id)
    if not evidencia:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Evidência não encontrada.')
    if current_user.role == RoleEnum.RESPONSAVEL and evidencia.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Você só pode remover suas próprias evidências.')
    if current_user.role not in (RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.AUDITOR, RoleEnum.RESPONSAVEL):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Você não possui permissão para esta ação.')

    old_value = _dump_model(evidencia)
    avaliacao = _buscar_avaliacao(db, evidencia.avaliacao_id)
    db.delete(evidencia)
    registrar_log(
        db,
        entidade='evidencia',
        entidade_id=evidencia_id,
        acao=AcaoAuditEnum.DELETE,
        created_by=current_user.id,
        old_value=old_value,
        programa_id=avaliacao.programa_id,
        auditoria_ano_id=avaliacao.auditoria_ano_id,
    )
    db.commit()
    return MensagemOut(mensagem='Evidência removida com sucesso.')

@router.get('/demandas', response_model=list[DemandaOut])
def listar_demandas(
    programa_id: int | None = Query(default=None),
    auditoria_id: int | None = Query(default=None),
    avaliacao_id: int | None = Query(default=None),
    status_andamento: StatusAndamentoEnum | None = Query(default=None),
    responsavel_id: int | None = Query(default=None),
    atrasadas: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DemandaOut]:
    query = select(Demanda).join(AvaliacaoIndicador, Demanda.avaliacao_id == AvaliacaoIndicador.id)
    if programa_id:
        query = query.where(Demanda.programa_id == programa_id)
    if auditoria_id:
        query = query.where(AvaliacaoIndicador.auditoria_ano_id == auditoria_id)
    if avaliacao_id:
        query = query.where(Demanda.avaliacao_id == avaliacao_id)
    if status_andamento:
        query = query.where(Demanda.status_andamento == status_andamento)
    if responsavel_id:
        query = query.where(Demanda.responsavel_id == responsavel_id)
    if current_user.role == RoleEnum.RESPONSAVEL:
        query = query.where(Demanda.responsavel_id == current_user.id)
    if atrasadas:
        query = query.where(
            Demanda.due_date.is_not(None),
            Demanda.due_date < date.today(),
            Demanda.status_andamento != StatusAndamentoEnum.concluida,
        )
    query = query.order_by(Demanda.start_date.asc().nulls_last(), Demanda.due_date.asc().nulls_last(), Demanda.id.desc())
    return list(db.scalars(query).all())


@router.post('/demandas', response_model=DemandaOut, status_code=status.HTTP_201_CREATED)
def criar_demanda(
    payload: DemandaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.AUDITOR)),
) -> DemandaOut:
    avaliacao = _buscar_avaliacao(db, payload.avaliacao_id)
    if payload.responsavel_id is not None:
        _buscar_usuario(db, payload.responsavel_id)
    start_date_value, due_date_value = _normalizar_datas_demanda(payload.start_date, payload.due_date)
    _validar_datas_demanda(start_date_value, due_date_value)
    _validar_exigencia_cronograma(avaliacao.status_conformidade, start_date_value, due_date_value)

    demanda = Demanda(
        **payload.model_dump(exclude={'start_date', 'due_date'}),
        start_date=start_date_value,
        due_date=due_date_value,
        programa_id=avaliacao.programa_id,
    )
    db.add(demanda)
    db.flush()
    registrar_log(
        db,
        entidade='demanda',
        entidade_id=demanda.id,
        acao=AcaoAuditEnum.CREATE,
        created_by=current_user.id,
        new_value=_dump_model(demanda),
        programa_id=avaliacao.programa_id,
        auditoria_ano_id=avaliacao.auditoria_ano_id,
    )
    db.commit()
    db.refresh(demanda)
    return demanda


@router.get('/demandas/{demanda_id}', response_model=DemandaOut)
def obter_demanda(
    demanda_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DemandaOut:
    demanda = _buscar_demanda(db, demanda_id)
    if current_user.role == RoleEnum.RESPONSAVEL and demanda.responsavel_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Você só pode visualizar demandas atribuídas a você.')
    return demanda


@router.put('/demandas/{demanda_id}', response_model=DemandaOut)
def atualizar_demanda(
    demanda_id: int,
    payload: DemandaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.AUDITOR)),
) -> DemandaOut:
    demanda = _buscar_demanda(db, demanda_id)
    data = payload.model_dump(exclude_unset=True)
    if 'responsavel_id' in data and data['responsavel_id'] is not None:
        _buscar_usuario(db, data['responsavel_id'])
    start_date_value = data.get('start_date', demanda.start_date)
    due_date_value = data.get('due_date', demanda.due_date)
    start_date_value, due_date_value = _normalizar_datas_demanda(start_date_value, due_date_value)
    _validar_datas_demanda(start_date_value, due_date_value)
    _validar_exigencia_cronograma(demanda.avaliacao.status_conformidade, start_date_value, due_date_value)
    data['start_date'] = start_date_value
    data['due_date'] = due_date_value

    old_value = _dump_model(demanda)
    status_anterior = demanda.status_andamento
    for field, value in data.items():
        setattr(demanda, field, value)
    _validar_regra_b_pos_demanda(db, demanda.avaliacao)
    acao = AcaoAuditEnum.STATUS_CHANGE if status_anterior != demanda.status_andamento else AcaoAuditEnum.UPDATE
    registrar_log(
        db,
        entidade='demanda',
        entidade_id=demanda.id,
        acao=acao,
        created_by=current_user.id,
        old_value=old_value,
        new_value=_dump_model(demanda),
        programa_id=demanda.programa_id,
        auditoria_ano_id=demanda.avaliacao.auditoria_ano_id,
    )
    db.commit()
    db.refresh(demanda)
    return demanda


@router.patch('/demandas/{demanda_id}', response_model=DemandaOut)
def patch_demanda(
    demanda_id: int,
    payload: DemandaPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DemandaOut:
    demanda = _buscar_demanda(db, demanda_id)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Nenhum campo foi informado para atualização.')

    if current_user.role == RoleEnum.RESPONSAVEL:
        if demanda.responsavel_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Você só pode atualizar demandas atribuídas a você.')
        campos_invalidos = {'padrao', 'responsavel_id', 'start_date', 'due_date'} & set(data.keys())
        if campos_invalidos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail='Responsável só pode atualizar o status_andamento da demanda.',
            )
    elif current_user.role not in (RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.AUDITOR):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Você não possui permissão para esta ação.')

    if 'responsavel_id' in data and data['responsavel_id'] is not None:
        _buscar_usuario(db, data['responsavel_id'])
    start_date_value = data.get('start_date', demanda.start_date)
    due_date_value = data.get('due_date', demanda.due_date)
    start_date_value, due_date_value = _normalizar_datas_demanda(start_date_value, due_date_value)
    _validar_datas_demanda(start_date_value, due_date_value)
    _validar_exigencia_cronograma(demanda.avaliacao.status_conformidade, start_date_value, due_date_value)
    data['start_date'] = start_date_value
    data['due_date'] = due_date_value

    old_value = _dump_model(demanda)
    status_anterior = demanda.status_andamento
    for field, value in data.items():
        setattr(demanda, field, value)
    _validar_regra_b_pos_demanda(db, demanda.avaliacao)
    acao = AcaoAuditEnum.STATUS_CHANGE if status_anterior != demanda.status_andamento else AcaoAuditEnum.UPDATE
    registrar_log(
        db,
        entidade='demanda',
        entidade_id=demanda.id,
        acao=acao,
        created_by=current_user.id,
        old_value=old_value,
        new_value=_dump_model(demanda),
        programa_id=demanda.programa_id,
        auditoria_ano_id=demanda.avaliacao.auditoria_ano_id,
    )
    db.commit()
    db.refresh(demanda)
    return demanda


@router.delete('/demandas/{demanda_id}', response_model=MensagemOut)
def remover_demanda(
    demanda_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.AUDITOR)),
) -> MensagemOut:
    demanda = _buscar_demanda(db, demanda_id)
    avaliacao = demanda.avaliacao
    old_value = _dump_model(demanda)
    auditoria_id = avaliacao.auditoria_ano_id

    db.delete(demanda)
    db.flush()
    _validar_regra_b_pos_demanda(db, avaliacao)
    registrar_log(
        db,
        entidade='demanda',
        entidade_id=demanda_id,
        acao=AcaoAuditEnum.DELETE,
        created_by=current_user.id,
        old_value=old_value,
        programa_id=demanda.programa_id,
        auditoria_ano_id=auditoria_id,
    )
    db.commit()
    return MensagemOut(mensagem='Demanda removida com sucesso.')


@router.get('/logs', response_model=list[AuditLogOut])
def listar_logs(
    entidade: str | None = Query(default=None),
    entidade_id: int | None = Query(default=None),
    programa_id: int | None = Query(default=None),
    auditoria_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.AUDITOR)),
) -> list[AuditLogOut]:
    query = select(AuditLog).order_by(AuditLog.created_at.desc())
    if entidade:
        query = query.where(AuditLog.entidade == entidade)
    if entidade_id:
        query = query.where(AuditLog.entidade_id == entidade_id)
    if programa_id:
        query = query.where(AuditLog.programa_id == programa_id)
    if auditoria_id:
        query = query.where(AuditLog.auditoria_ano_id == auditoria_id)
    return list(db.scalars(query).all())


@router.get('/usuarios', response_model=list[UserOut])
def listar_usuarios(
    role: RoleEnum | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR, RoleEnum.AUDITOR)),
) -> list[UserOut]:
    query = select(User).order_by(User.nome)
    if role:
        query = query.where(User.role == role)
    return list(db.scalars(query).all())


@router.post('/usuarios/responsaveis', response_model=UserOut, status_code=status.HTTP_201_CREATED)
def criar_responsavel(
    payload: ResponsavelCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(RoleEnum.ADMIN, RoleEnum.GESTOR)),
) -> UserOut:
    existente = db.scalar(select(User).where(func.lower(User.email) == payload.email.lower()))
    if existente:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Já existe usuário com este email.')

    responsavel = User(
        nome=payload.nome.strip(),
        email=payload.email.strip().lower(),
        role=RoleEnum.RESPONSAVEL,
        password_hash=hash_password(payload.senha),
    )
    db.add(responsavel)
    db.commit()
    db.refresh(responsavel)
    return responsavel
