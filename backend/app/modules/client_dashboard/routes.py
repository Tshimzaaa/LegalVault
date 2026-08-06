from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.clients.dependencies import get_current_contact
from app.modules.clients.models import ClientContact
from app.modules.client_dashboard.schemas import ClientDashboardSummaryResponse
from app.modules.client_dashboard.service import ClientDashboardService

router = APIRouter(prefix="/client-dashboard", tags=["client-dashboard"])


@router.get("/summary", response_model=ClientDashboardSummaryResponse)
def get_client_dashboard_summary(
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    return ClientDashboardService(db).get_summary(current_contact.client_id)
