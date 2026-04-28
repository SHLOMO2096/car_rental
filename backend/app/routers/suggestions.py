# ══════════════════════════════════════════════════════════════════════════════
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.permissions import Permissions
from app.core.security import require_permission
from app.schemas.suggestion import SuggestionRequest, SuggestionResult
from app.engine.suggestions import search_suggestions

router = APIRouter()


@router.post("/search", response_model=list[SuggestionResult])
def suggestions_search(
    data: SuggestionRequest,
    db: Session = Depends(get_db),
    _=Depends(require_permission(Permissions.SUGGESTIONS_VIEW)),
):
    """
    Search for vehicle alternatives / reassignment opportunities.

    Returns a ranked list of suggestions:
    - **Type A** – requested car is directly available.
    - **Type B** – a similar car (same or adjacent group) is free.
    - **Type C** – a one-step reassignment can free the requested car.
    """
    return search_suggestions(db, data)

# ══════════════════════════════════════════════════════════════════════════════

