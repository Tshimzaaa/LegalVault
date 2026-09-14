from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.auth.dependencies import require_role
from app.modules.auth.models import User
from app.modules.auth.models.role import UserRole
from app.modules.integrations.models import IntegrationProvider
from app.modules.integrations.schemas import ConfigureIntegrationRequest, IntegrationStatusResponse
from app.modules.integrations.service import IntegrationService

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("", response_model=list[IntegrationStatusResponse])
def list_integrations(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    service = IntegrationService(db)
    return service.list_for_org(current_user.org_id)


@router.put("/{provider}", response_model=IntegrationStatusResponse)
def configure_integration(
    provider: IntegrationProvider,
    request: ConfigureIntegrationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    service = IntegrationService(db)
    return service.configure(current_user.org_id, current_user.id, provider, request)


@router.post("/{provider}/disable", response_model=IntegrationStatusResponse)
def disable_integration(
    provider: IntegrationProvider,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    service = IntegrationService(db)
    return service.disable(current_user.org_id, current_user.id, provider)


@router.delete("/{provider}", response_model=IntegrationStatusResponse)
def disconnect_integration(
    provider: IntegrationProvider,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    service = IntegrationService(db)
    return service.disconnect(current_user.org_id, current_user.id, provider)
