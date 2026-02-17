from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app.models.auditlog import AcaoAuditEnum, AuditLog


def registrar_log(
    db: Session,
    entidade: str,
    entidade_id: int,
    acao: AcaoAuditEnum,
    created_by: int | None,
    old_value: dict | None = None,
    new_value: dict | None = None,
    programa_id: int | None = None,
    auditoria_ano_id: int | None = None,
) -> AuditLog:
    log = AuditLog(
        entidade=entidade,
        entidade_id=entidade_id,
        acao=acao,
        old_value=jsonable_encoder(old_value) if old_value is not None else None,
        new_value=jsonable_encoder(new_value) if new_value is not None else None,
        created_by=created_by,
        programa_id=programa_id,
        auditoria_ano_id=auditoria_ano_id,
    )
    db.add(log)
    return log
