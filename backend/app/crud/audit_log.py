import json
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog, AuditSeverity
from app.models.user import User


def _snapshot_model(model_obj) -> dict | None:
    if model_obj is None:
        return None
    if isinstance(model_obj, dict):
        return model_obj
    data = {}
    for col in model_obj.__table__.columns:
        # Never persist password hashes in audit snapshots.
        if col.name == "hashed_pw":
            continue
        data[col.name] = getattr(model_obj, col.name)
    return data


def _loads_snapshot(raw: str | None) -> dict | None:
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


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


def list_entity_audit_events(
    db: Session,
    *,
    entity_type: str,
    entity_id: str,
    limit: int = 20,
) -> list[dict]:
    rows = (
        db.query(AuditLog, User.full_name)
        .outerjoin(User, User.id == AuditLog.actor_user_id)
        .filter(AuditLog.entity_type == entity_type, AuditLog.entity_id == entity_id)
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": audit.id,
            "actor_user_id": audit.actor_user_id,
            "actor_user_name": actor_name,
            "action": audit.action,
            "entity_type": audit.entity_type,
            "entity_id": audit.entity_id,
            "before_json": _loads_snapshot(audit.before_json),
            "after_json": _loads_snapshot(audit.after_json),
            "ip_address": audit.ip_address,
            "severity": audit.severity,
            "created_at": audit.created_at,
        }
        for audit, actor_name in rows
    ]

