from time import perf_counter

from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from app.modules.owner.schemas import OwnerLoginRequest, OwnerTokenResponse
from app.core.security import create_access_token
from app.core.config import settings
from app.core.storage import get_download_url, get_r2_client
from app.core.uptime import STARTED_AT
from datetime import datetime, UTC

from fastapi import Depends, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.modules.auth.schemas.register import RegisterOrganizationRequest, RegisterAdminRequest
from app.modules.auth.services.register import RegisterService
from app.modules.owner.dependencies import get_current_owner
from pydantic import BaseModel
from app.modules.auth.repository import AuthRepository
from app.modules.matters.repository import MatterRepository
from app.modules.owner.schemas import (
    OrganizationSummary,
    OrganizationDetail,
    UpdateOrganizationStatusRequest,
    OrganizationExportResponse,
    OrganizationExportProfile,
    OrganizationExportStaff,
    OrganizationExportAssignment,
    OrganizationExportTask,
    OrganizationExportDocument,
    OrganizationExportMatter,
    UsageMetrics,
    PlatformMetricsResponse,
    SystemHealthResponse,
)
from app.modules.monitoring.schemas import RequestErrorEntry, DependencyHealth
from app.exceptions.auth import OrganizationAlreadyExists  # reuse or add a OrganizationNotFound exception
from app.modules.audit.service import AuditService
from app.modules.audit.repository import AuditLogRepository
from app.modules.audit.models import ActorType
from app.modules.audit.schemas import AuditLogResponse
from app.modules.audit import actions as audit_actions
from app.modules.monitoring.service import MonitoringService
from app.modules.notifications.repository import NotificationRepository
from app.modules.notifications.models import RecipientType
from app.modules.signed_contracts.repository import SignedContractRepository
from app.modules.templates.repository import TemplateRepository
from app.modules.auth.refresh_token_repository import RefreshTokenRepository
from app.modules.auth.models.refresh_token import RefreshTokenActorType
from app.modules.knowledge.repository import KnowledgeRepository
from app.modules.integrations.repository import IntegrationRepository
from datetime import timedelta


router = APIRouter(prefix="/owner", tags=["owner"])

# Latency above which a reachable dependency is still flagged "degraded" rather than "healthy".
DB_LATENCY_DEGRADED_MS = 500.0
STORAGE_LATENCY_DEGRADED_MS = 1000.0


def _check_database(db: Session) -> DependencyHealth:
    start = perf_counter()
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        return DependencyHealth(name="Database", status="down", latency_ms=None)
    latency_ms = (perf_counter() - start) * 1000
    status = "degraded" if latency_ms > DB_LATENCY_DEGRADED_MS else "healthy"
    return DependencyHealth(name="Database", status=status, latency_ms=round(latency_ms, 1))


def _check_storage() -> DependencyHealth:
    start = perf_counter()
    try:
        get_r2_client().head_bucket(Bucket=settings.R2_BUCKET_NAME)
    except Exception:
        return DependencyHealth(name="Storage", status="down", latency_ms=None)
    latency_ms = (perf_counter() - start) * 1000
    status = "degraded" if latency_ms > STORAGE_LATENCY_DEGRADED_MS else "healthy"
    return DependencyHealth(name="Storage", status=status, latency_ms=round(latency_ms, 1))


def _overall_status(dependencies: list[DependencyHealth], error_rate_percent: float) -> str:
    if any(d.status == "down" for d in dependencies):
        return "down"
    if any(d.status == "degraded" for d in dependencies) or error_rate_percent > 5:
        return "degraded"
    return "operational"

class OwnerCreateOrganizationRequest(BaseModel):
    organization: RegisterOrganizationRequest
    admin: RegisterAdminRequest


@router.post("/orgs", status_code=201)
def create_org(
    request: OwnerCreateOrganizationRequest,
    db: Session = Depends(get_db),
    _owner=Depends(get_current_owner),
):
    service = RegisterService(db)
    # separate from the public self-serve /auth/register — attributes the audit-log entry
    # to the owner console rather than the org's own new admin (see register_as_owner)
    return service.register_as_owner(request.organization, request.admin)

@router.post("/login", response_model=OwnerTokenResponse)
def owner_login(request: OwnerLoginRequest):
    if request.secret != settings.OWNER_SECRET:
        raise HTTPException(status_code=401, detail="Invalid secret.")

    token = create_access_token(
        subject="owner",
        extra_claims={"type": "owner"},
    )
    return OwnerTokenResponse(access_token=token)
@router.get("/orgs", response_model=list[OrganizationSummary])
def list_orgs(db: Session = Depends(get_db), _owner=Depends(get_current_owner)):
    repo = AuthRepository(db)
    return repo.list_all_orgs()


@router.get("/orgs/audit-log", response_model=list[AuditLogResponse])
def list_audit_log(
    org_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _owner=Depends(get_current_owner),
):
    repo = AuditLogRepository(db)
    return repo.list_all(limit, offset, org_id=org_id)


@router.get("/metrics", response_model=PlatformMetricsResponse)
def get_platform_metrics(
    hours: int = Query(default=24, ge=1, le=720),
    db: Session = Depends(get_db),
    _owner=Depends(get_current_owner),
):
    auth_repo = AuthRepository(db)
    matter_repo = MatterRepository(db)

    total_orgs = auth_repo.count_all_orgs()
    active_orgs = auth_repo.count_active_orgs()

    usage = UsageMetrics(
        total_orgs=total_orgs,
        active_orgs=active_orgs,
        inactive_orgs=total_orgs - active_orgs,
        total_staff=auth_repo.count_all_users(),
        total_matters=matter_repo.count_all_matters(),
        matters_by_status=matter_repo.count_all_matters_by_status(),
        new_orgs_last_7_days=auth_repo.count_orgs_created_since(datetime.now(UTC) - timedelta(days=7)),
        new_orgs_last_30_days=auth_repo.count_orgs_created_since(datetime.now(UTC) - timedelta(days=30)),
    )

    requests = MonitoringService(db).get_request_metrics(hours)

    return PlatformMetricsResponse(
        generated_at=datetime.now(UTC),
        usage=usage,
        requests=requests,
    )


@router.get("/errors", response_model=list[RequestErrorEntry])
def list_recent_errors(
    hours: int = Query(default=24, ge=1, le=720),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _owner=Depends(get_current_owner),
):
    return MonitoringService(db).list_recent_errors(hours, limit, offset)


@router.get("/system-health", response_model=SystemHealthResponse)
def get_system_health(
    hours: int = Query(default=24, ge=1, le=720),
    db: Session = Depends(get_db),
    _owner=Depends(get_current_owner),
):
    monitoring = MonitoringService(db)
    requests = monitoring.get_request_metrics(hours)
    active_users, online_orgs = monitoring.get_active_usage(hours)

    dependencies = [_check_database(db), _check_storage()]

    return SystemHealthResponse(
        generated_at=datetime.now(UTC),
        status=_overall_status(dependencies, requests.error_rate_percent),
        uptime_seconds=(datetime.now(UTC) - STARTED_AT).total_seconds(),
        window_hours=hours,
        requests=requests,
        active_users=active_users,
        online_orgs=online_orgs,
        dependencies=dependencies,
        services=monitoring.get_service_health(hours),
        worst_endpoints=monitoring.get_worst_endpoints(hours),
        timeseries=monitoring.get_request_timeseries(hours),
    )


@router.get("/orgs/{org_id}", response_model=OrganizationDetail)
def get_org(org_id: str, db: Session = Depends(get_db), _owner=Depends(get_current_owner)):
    auth_repo = AuthRepository(db)
    org = auth_repo.get_org_by_id(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")

    matter_repo = MatterRepository(db)

    return OrganizationDetail(
        id=org.id,
        name=org.name,
        email=org.email,
        phone=org.phone,
        website=org.website,
        address=org.address,
        is_active=org.is_active,
        staff_count=auth_repo.count_users_for_org(org.id),
        matter_count=matter_repo.count_matters_for_org(org.id),
    )


@router.get("/orgs/{org_id}/export", response_model=OrganizationExportResponse)
def export_org_data(org_id: str, db: Session = Depends(get_db), _owner=Depends(get_current_owner)):
    auth_repo = AuthRepository(db)
    org = auth_repo.get_org_by_id(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")

    matter_repo = MatterRepository(db)
    audit_repo = AuditLogRepository(db)

    staff = [OrganizationExportStaff.model_validate(u) for u in auth_repo.list_by_org(org.id)]

    matters = []
    for m in matter_repo.list_by_org(org.id):
        assignments = [
            OrganizationExportAssignment(user_id=a.user_id, role_on_matter=a.role_on_matter)
            for a in matter_repo.list_assignments_for_matter(m.id)
        ]
        tasks = [OrganizationExportTask.model_validate(t) for t in matter_repo.list_tasks_for_matter(m.id)]
        documents = [
            OrganizationExportDocument(
                id=d.id,
                title=d.title,
                version=d.version,
                original_filename=d.original_filename,
                content_type=d.content_type,
                uploaded_by=d.uploaded_by,
                created_at=d.created_at,
                download_url=get_download_url(d.file_key),
            )
            for d in matter_repo.list_documents_for_matter(m.id)
        ]
        matters.append(
            OrganizationExportMatter(
                id=m.id,
                title=m.title,
                description=m.description,
                status=m.status,
                created_at=m.created_at,
                updated_at=m.updated_at,
                assignments=assignments,
                tasks=tasks,
                documents=documents,
            )
        )

    audit_log = [
        AuditLogResponse.model_validate(e) for e in audit_repo.list_for_org(org.id, limit=1_000_000, offset=0)
    ]

    AuditService(db).log(
        actor_type=ActorType.OWNER,
        actor_id=None,
        org_id=org.id,
        action=audit_actions.ORG_DATA_EXPORTED,
        target_type="organization",
        target_id=org.id,
        details={"name": org.name},
    )
    db.commit()

    return OrganizationExportResponse(
        exported_at=datetime.now(UTC),
        org=OrganizationExportProfile.model_validate(org),
        staff=staff,
        matters=matters,
        audit_log=audit_log,
    )


@router.patch("/orgs/{org_id}/status", response_model=OrganizationSummary)
def update_org_status(
    org_id: str,
    request: UpdateOrganizationStatusRequest,
    db: Session = Depends(get_db),
    _owner=Depends(get_current_owner),
):
    auth_repo = AuthRepository(db)
    org = auth_repo.get_org_by_id(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")

    org.is_active = request.is_active

    AuditService(db).log(
        actor_type=ActorType.OWNER,
        actor_id=None,
        org_id=org.id,
        action=audit_actions.ORG_STATUS_UPDATED,
        target_type="organization",
        target_id=org.id,
        details={"name": org.name, "is_active": request.is_active},
    )
    db.commit()
    return org


@router.delete("/orgs/{org_id}", status_code=204)
def delete_org(
    org_id: str,
    db: Session = Depends(get_db),
    _owner=Depends(get_current_owner),
):
    auth_repo = AuthRepository(db)
    org = auth_repo.get_org_by_id(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")

    if org.is_active:
        raise HTTPException(status_code=409, detail="Deactivate the org before deleting it.")

    AuditService(db).log(
        actor_type=ActorType.OWNER,
        actor_id=None,
        org_id=org.id,
        action=audit_actions.ORG_DELETED,
        target_type="organization",
        target_id=org.id,
        details={"name": org.name, "email": org.email},
    )

    matter_repo = MatterRepository(db)
    notification_repo = NotificationRepository(db)
    signed_contract_repo = SignedContractRepository(db)
    template_repo = TemplateRepository(db)
    refresh_token_repo = RefreshTokenRepository(db)
    knowledge_repo = KnowledgeRepository(db)
    integration_repo = IntegrationRepository(db)

    for contract in signed_contract_repo.list_plain_by_org(org.id):
        signed_contract_repo.delete(contract)

    for template in template_repo.list_by_org(org.id):
        template_repo.delete(template)

    for article in knowledge_repo.list_by_org(org.id):
        knowledge_repo.delete(article)

    for integration in integration_repo.list_by_org(org.id):
        integration_repo.delete(integration)

    for matter in matter_repo.list_by_org(org.id):
        for document in matter_repo.list_documents_for_matter(matter.id):
            matter_repo.delete_document(document)
        for assignment in matter_repo.list_assignments_for_matter(matter.id):
            matter_repo.delete_assignment(assignment)
        for task in matter_repo.list_tasks_for_matter(matter.id):
            matter_repo.delete_task(task)
        for message in matter_repo.list_messages_for_matter(matter.id):
            matter_repo.delete_message(message)
        matter_repo.delete_matter(matter)

    for user in auth_repo.list_by_org(org.id):
        notification_repo.delete_for_recipient(RecipientType.STAFF, user.id)
        refresh_token_repo.delete_all_for_actor(RefreshTokenActorType.STAFF, user.id)
        auth_repo.delete_user(user)

    auth_repo.delete_org(org)
    db.commit()