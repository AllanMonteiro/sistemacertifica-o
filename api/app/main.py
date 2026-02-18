import time
from contextlib import asynccontextmanager
from datetime import date

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.fsc import AuditoriaAno, ConfiguracaoSistema, Criterio, EvidenceType, Indicador, ProgramaCertificacao
from app.models.user import RoleEnum, User
from app.routers import auth, fsc, reports
from app.services.s3_storage import ensure_bucket_exists

settings = get_settings()


def _seed_programas_certificacao() -> None:
    programas_padrao = [
        ('FSC', 'FSC', 'Forest Stewardship Council'),
        ('PFC', 'PFC', 'Programa de Certificação Florestal'),
        ('ONCA_PINTADA', 'Onça Pintada', 'Certificação e monitoramento para onça pintada'),
        ('CARBONO', 'Carbono', 'Programas e auditorias para carbono florestal'),
    ]

    with SessionLocal() as db:
        existentes = {codigo for codigo in db.scalars(select(ProgramaCertificacao.codigo)).all()}
        for codigo, nome, descricao in programas_padrao:
            if codigo in existentes:
                continue
            db.add(ProgramaCertificacao(codigo=codigo, nome=nome, descricao=descricao))
        db.commit()


def _normalizar_programas_certificacao() -> None:
    padrao_por_codigo = {
        'FSC': ('FSC', 'Forest Stewardship Council'),
        'PFC': ('PFC', 'Programa de Certificação Florestal'),
        'ONCA_PINTADA': ('Onça Pintada', 'Certificação e monitoramento para onça pintada'),
        'CARBONO': ('Carbono', 'Programas e auditorias para carbono florestal'),
    }

    with SessionLocal() as db:
        programas = list(db.scalars(select(ProgramaCertificacao)).all())
        alterou = False
        for programa in programas:
            padrao = padrao_por_codigo.get(programa.codigo)
            if not padrao:
                continue

            nome, descricao = padrao
            if programa.nome != nome:
                programa.nome = nome
                alterou = True
            if programa.descricao != descricao:
                programa.descricao = descricao
                alterou = True

        if alterou:
            db.commit()


def _seed_auditorias_iniciais() -> None:
    ano_atual = date.today().year
    with SessionLocal() as db:
        programas = list(db.scalars(select(ProgramaCertificacao)).all())
        alterou = False
        for programa in programas:
            possui_auditoria = db.scalar(
                select(AuditoriaAno.id).where(AuditoriaAno.programa_id == programa.id).limit(1)
            )
            if possui_auditoria:
                continue
            db.add(
                AuditoriaAno(
                    programa_id=programa.id,
                    year=ano_atual,
                    tipo='Certificação',
                )
            )
            alterou = True

        if alterou:
            db.commit()


def _seed_evidence_types() -> None:
    tipos_padrao = [
        ('Foto', 'Registro fotográfico de campo.'),
        ('Mapa', 'Mapas temáticos e georreferenciados.'),
        ('Licença/Autorização', 'Licenças, autorizações e documentos legais.'),
        ('Procedimento', 'Procedimentos operacionais e instruções de trabalho.'),
        ('Relatório', 'Relatórios técnicos e de auditoria.'),
        ('Registro', 'Registros operacionais e evidências documentais.'),
        ('Ata/Consulta', 'Atas de reunião e consultas a partes interessadas.'),
        ('Monitoramento', 'Dados e relatórios de monitoramento.'),
    ]

    with SessionLocal() as db:
        indicadores = list(db.scalars(select(Indicador).order_by(Indicador.id)).all())
        if not indicadores:
            return
        existentes = {
            (int(programa_id), int(criterio_id), int(indicador_id), str(nome).lower())
            for programa_id, criterio_id, indicador_id, nome in db.execute(
                select(
                    EvidenceType.programa_id,
                    EvidenceType.criterio_id,
                    EvidenceType.indicador_id,
                    EvidenceType.nome,
                ).where(
                    EvidenceType.programa_id.is_not(None),
                    EvidenceType.criterio_id.is_not(None),
                    EvidenceType.indicador_id.is_not(None),
                )
            ).all()
        }
        alterou = False

        criterio_por_id = {
            criterio.id: criterio
            for criterio in db.scalars(select(Criterio).where(Criterio.id.in_([i.criterio_id for i in indicadores]))).all()
        }
        for nome, descricao in tipos_padrao:
            for indicador in indicadores:
                criterio = criterio_por_id.get(indicador.criterio_id)
                if not criterio:
                    continue
                chave = (indicador.programa_id, criterio.id, indicador.id, nome.lower())
                if chave in existentes:
                    continue
                db.add(
                    EvidenceType(
                        programa_id=indicador.programa_id,
                        criterio_id=criterio.id,
                        indicador_id=indicador.id,
                        nome=nome,
                        descricao=descricao,
                    )
                )
                existentes.add(chave)
                alterou = True
        if alterou:
            db.commit()


def _seed_admin_user() -> None:
    with SessionLocal() as db:
        admin = db.scalar(select(User).where(User.email == 'admin@local'))
        if admin:
            return
        db.add(
            User(
                nome='Administrador',
                email='admin@local',
                role=RoleEnum.ADMIN,
                password_hash=hash_password('admin123'),
            )
        )
        db.commit()


def _seed_configuracao_sistema() -> None:
    with SessionLocal() as db:
        existente = db.scalar(select(ConfiguracaoSistema).limit(1))
        if existente:
            return
        db.add(ConfiguracaoSistema(nome_empresa='Empresa'))
        db.commit()


def _setup_storage_with_retry() -> None:
    tentativas = 10
    for tentativa in range(1, tentativas + 1):
        try:
            ensure_bucket_exists()
            return
        except Exception as exc:
            if tentativa == tentativas:
                if settings.S3_STRICT_STARTUP:
                    raise
                print(
                    'Aviso: não foi possível validar/criar bucket de evidências no startup. '
                    f'O upload de arquivos pode falhar até ajustar S3. Erro: {exc}'
                )
                return
            time.sleep(2)


@asynccontextmanager
async def lifespan(_: FastAPI):
    _setup_storage_with_retry()
    _seed_programas_certificacao()
    _normalizar_programas_certificacao()
    _seed_auditorias_iniciais()
    _seed_evidence_types()
    _seed_admin_user()
    _seed_configuracao_sistema()
    yield


app = FastAPI(title=settings.APP_NAME, version='1.0.0', lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins(),
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(auth.router)
app.include_router(fsc.router)
app.include_router(reports.router)


@app.get('/')
def root() -> dict[str, str]:
    return {'mensagem': 'API de certificações em execução. Acesse /docs para documentação.'}


@app.get('/api/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}
