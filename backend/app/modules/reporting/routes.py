from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.reporting.service import ReportingService
from app.modules.reporting.schemas import ReportingOverviewResponse

router = APIRouter(prefix="/reporting", tags=["reporting"])


@router.get("/overview", response_model=ReportingOverviewResponse)
def get_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ReportingService(db).get_overview(current_user.org_id)


@router.get("/contracts/export")
def export_contracts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    csv_content = ReportingService(db).export_contracts_csv(current_user.org_id)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=contracts.csv"},
    )
