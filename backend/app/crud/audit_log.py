import json
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog, AuditSeverity


def _snapshot_model(model_obj) -> dict | None:
    if not model_obj:
        return None
    data = {}
    for col in model_obj.__table__.columns:
        # Never persist password hashes in audit snapshots.
        if col.name == "hashed_pw":
            continue
        data[col.name] = getattr(model_obj, col.name)
    return data


def log_audit_event(
    db: Session,
    *,
    actor_user_id: int | None,
    action: str,
    entity_type: str,
    entity_id: str,
    before_obj=None,
    after_obj=None,
    ip_address: str | None = None,
    severity: AuditSeverity = AuditSeverity.info,
) -> None:
    payload = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        before_json=json.dumps(_snapshot_model(before_obj), default=str, ensure_ascii=False),
        after_json=json.dumps(_snapshot_model(after_obj), default=str, ensure_ascii=False),
        ip_address=ip_address,
        severity=severity.value,
    )

    # Best effort: business action is already committed; audit should not break UX.
    try:
        db.add(payload)
        db.commit()
    except Exception:
        db.rollback()

