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
from app.modules.auth.schemas.register import RegisterLawFirmRequest, RegisterAdminRequest
from app.modules.auth.services.register import RegisterService
from app.modules.owner.dependencies import get_current_owner
from pydantic import BaseModel
from app.modules.auth.repository import AuthRepository
from app.modules.clients.repository import ClientRepository
from app.modules.matters.repository import MatterRepository
from app.modules.owner.schemas import (
    FirmSummary,
    FirmDetail,
    UpdateFirmStatusRequest,
    FirmExportResponse,
    FirmExportProfile,
    FirmExportStaff,
    FirmExportContact,
    FirmExportClient,
    FirmExportAssignment,
    FirmExportTask,
    FirmExportDocument,
    FirmExportMatter,
    UsageMetrics,
    PlatformMetricsResponse,
    SystemHealthResponse,
)
from app.modules.monitoring.schemas import RequestErrorEntry, DependencyHealth
from app.exceptions.auth import LawFirmAlreadyExists  # reuse or add a FirmNotFound exception
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
from app.modules.intake.repository import IntakeRepository
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

class OwnerCreateFirmRequest(BaseModel):
    law_firm: RegisterLawFirmRequest
    admin: RegisterAdminRequest


@router.post("/firms", status_code=201)
def create_firm(
    request: OwnerCreateFirmRequest,
    db: Session = Depends(get_db),
    _owner=Depends(get_current_owner),
):
    service = RegisterService(db)
    # reuse existing register logic, but skip the admin_secret check since owner auth already covers it
    return service.register_as_owner(request.law_firm, request.admin)

@router.post("/login", response_model=OwnerTokenResponse)
def owner_login(request: OwnerLoginRequest):
    if request.secret != settings.OWNER_SECRET:
        raise HTTPException(status_code=401, detail="Invalid secret.")

    token = create_access_token(
        subject="owner",
        extra_claims={"type": "owner"},
    )
    return OwnerTokenResponse(access_token=token)
@router.get("/firms", response_model=list[FirmSummary])
def list_firms(db: Session = Depends(get_db), _owner=Depends(get_current_owner)):
    repo = AuthRepository(db)
    return repo.list_all_firms()


@router.get("/firms/audit-log", response_model=list[AuditLogResponse])
def list_audit_log(
    firm_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _owner=Depends(get_current_owner),
):
    repo = AuditLogRepository(db)
    return repo.list_all(limit, offset, firm_id=firm_id)


@router.get("/metrics", response_model=PlatformMetricsResponse)
def get_platform_metrics(
    hours: int = Query(default=24, ge=1, le=720),
    db: Session = Depends(get_db),
    _owner=Depends(get_current_owner),
):
    auth_repo = AuthRepository(db)
    client_repo = ClientRepository(db)
    matter_repo = MatterRepository(db)

    total_firms = auth_repo.count_all_firms()
    active_firms = auth_repo.count_active_firms()

    usage = UsageMetrics(
        total_firms=total_firms,
        active_firms=active_firms,
        inactive_firms=total_firms - active_firms,
        total_staff=auth_repo.count_all_users(),
        total_clients=client_repo.count_all_clients(),
        total_matters=matter_repo.count_all_matters(),
        matters_by_status=matter_repo.count_all_matters_by_status(),
        new_firms_last_7_days=auth_repo.count_firms_created_since(datetime.now(UTC) - timedelta(days=7)),
        new_firms_last_30_days=auth_repo.count_firms_created_since(datetime.now(UTC) - timedelta(days=30)),
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
    active_users, online_firms = monitoring.get_active_usage(hours)

    dependencies = [_check_database(db), _check_storage()]

    return SystemHealthResponse(
        generated_at=datetime.now(UTC),
        status=_overall_status(dependencies, requests.error_rate_percent),
        uptime_seconds=(datetime.now(UTC) - STARTED_AT).total_seconds(),
        window_hours=hours,
        requests=requests,
        active_users=active_users,
        online_firms=online_firms,
        dependencies=dependencies,
        services=monitoring.get_service_health(hours),
        worst_endpoints=monitoring.get_worst_endpoints(hours),
        timeseries=monitoring.get_request_timeseries(hours),
    )


@router.get("/firms/{firm_id}", response_model=FirmDetail)
def get_firm(firm_id: str, db: Session = Depends(get_db), _owner=Depends(get_current_owner)):
    auth_repo = AuthRepository(db)
    firm = auth_repo.get_firm_by_id(firm_id)
    if not firm:
        raise HTTPException(status_code=404, detail="Firm not found.")

    client_repo = ClientRepository(db)
    matter_repo = MatterRepository(db)

    return FirmDetail(
        id=firm.id,
        name=firm.name,
        email=firm.email,
        phone=firm.phone,
        website=firm.website,
        address=firm.address,
        is_active=firm.is_active,
        staff_count=auth_repo.count_users_for_firm(firm.id),
        client_count=client_repo.count_clients_for_firm(firm.id),
        matter_count=matter_repo.count_matters_for_firm(firm.id),
    )


@router.get("/firms/{firm_id}/export", response_model=FirmExportResponse)
def export_firm_data(firm_id: str, db: Session = Depends(get_db), _owner=Depends(get_current_owner)):
    auth_repo = AuthRepository(db)
    firm = auth_repo.get_firm_by_id(firm_id)
    if not firm:
        raise HTTPException(status_code=404, detail="Firm not found.")

    client_repo = ClientRepository(db)
    matter_repo = MatterRepository(db)
    audit_repo = AuditLogRepository(db)

    staff = [FirmExportStaff.model_validate(u) for u in auth_repo.list_by_firm(firm.id)]

    clients = []
    for c in client_repo.list_by_firm(firm.id):
        contacts = [FirmExportContact.model_validate(ct) for ct in client_repo.list_contacts_for_client(c.id)]
        clients.append(
            FirmExportClient(
                id=c.id,
                company_name=c.company_name,
                is_active=c.is_active,
                created_at=c.created_at,
                contacts=contacts,
            )
        )

    matters = []
    for m in matter_repo.list_by_firm(firm.id):
        assignments = [
            FirmExportAssignment(user_id=a.user_id, role_on_matter=a.role_on_matter)
            for a in matter_repo.list_assignments_for_matter(m.id)
        ]
        tasks = [FirmExportTask.model_validate(t) for t in matter_repo.list_tasks_for_matter(m.id)]
        documents = [
            FirmExportDocument(
                id=d.id,
                title=d.title,
                version=d.version,
                original_filename=d.original_filename,
                content_type=d.content_type,
                uploaded_by=d.uploaded_by,
                uploaded_by_contact_id=d.uploaded_by_contact_id,
                created_at=d.created_at,
                download_url=get_download_url(d.file_key),
            )
            for d in matter_repo.list_documents_for_matter(m.id)
        ]
        matters.append(
            FirmExportMatter(
                id=m.id,
                client_id=m.client_id,
                title=m.title,
                description=m.description,
                status=m.status,
                is_visible_to_client=m.is_visible_to_client,
                created_at=m.created_at,
                updated_at=m.updated_at,
                assignments=assignments,
                tasks=tasks,
                documents=documents,
            )
        )

    audit_log = [
        AuditLogResponse.model_validate(e) for e in audit_repo.list_for_firm(firm.id, limit=1_000_000, offset=0)
    ]

    AuditService(db).log(
        actor_type=ActorType.OWNER,
        actor_id=None,
        firm_id=firm.id,
        action=audit_actions.FIRM_DATA_EXPORTED,
        target_type="law_firm",
        target_id=firm.id,
        details={"name": firm.name},
    )
    db.commit()

    return FirmExportResponse(
        exported_at=datetime.now(UTC),
        firm=FirmExportProfile.model_validate(firm),
        staff=staff,
        clients=clients,
        matters=matters,
        audit_log=audit_log,
    )


@router.patch("/firms/{firm_id}/status", response_model=FirmSummary)
def update_firm_status(
    firm_id: str,
    request: UpdateFirmStatusRequest,
    db: Session = Depends(get_db),
    _owner=Depends(get_current_owner),
):
    auth_repo = AuthRepository(db)
    firm = auth_repo.get_firm_by_id(firm_id)
    if not firm:
        raise HTTPException(status_code=404, detail="Firm not found.")

    firm.is_active = request.is_active

    AuditService(db).log(
        actor_type=ActorType.OWNER,
        actor_id=None,
        firm_id=firm.id,
        action=audit_actions.FIRM_STATUS_UPDATED,
        target_type="law_firm",
        target_id=firm.id,
        details={"name": firm.name, "is_active": request.is_active},
    )
    db.commit()
    return firm


@router.delete("/firms/{firm_id}", status_code=204)
def delete_firm(
    firm_id: str,
    db: Session = Depends(get_db),
    _owner=Depends(get_current_owner),
):
    auth_repo = AuthRepository(db)
    firm = auth_repo.get_firm_by_id(firm_id)
    if not firm:
        raise HTTPException(status_code=404, detail="Firm not found.")

    if firm.is_active:
        raise HTTPException(status_code=409, detail="Deactivate the firm before deleting it.")

    AuditService(db).log(
        actor_type=ActorType.OWNER,
        actor_id=None,
        firm_id=firm.id,
        action=audit_actions.FIRM_DELETED,
        target_type="law_firm",
        target_id=firm.id,
        details={"name": firm.name, "email": firm.email},
    )

    client_repo = ClientRepository(db)
    matter_repo = MatterRepository(db)
    notification_repo = NotificationRepository(db)
    signed_contract_repo = SignedContractRepository(db)
    template_repo = TemplateRepository(db)
    refresh_token_repo = RefreshTokenRepository(db)
    intake_repo = IntakeRepository(db)
    knowledge_repo = KnowledgeRepository(db)
    integration_repo = IntegrationRepository(db)

    # Signed contracts hold their own FKs into matters/clients/contacts, so they must go
    # before those rows are deleted below or the delete fails with an IntegrityError (this
    # was the bug — firm delete 500'd for any firm with real usage data).
    for contract in signed_contract_repo.list_plain_by_firm(firm.id):
        signed_contract_repo.delete(contract)

    for template in template_repo.list_by_firm(firm.id):
        template_repo.delete(template)

    # Intake submissions carry their own FKs into matters/clients/contacts (same class of bug
    # as above), so their answers and the submissions themselves must go before those rows —
    # and before the fields/forms they reference.
    for submission in intake_repo.list_submissions_by_firm(firm.id):
        for answer in submission.answers:
            intake_repo.delete_answer(answer)
        intake_repo.delete_submission(submission)

    for form in intake_repo.list_forms_by_firm(firm.id):
        for field in form.fields:
            intake_repo.delete_field(field)
        intake_repo.delete_form(form)

    for article in knowledge_repo.list_by_firm(firm.id):
        knowledge_repo.delete(article)

    for integration in integration_repo.list_by_firm(firm.id):
        integration_repo.delete(integration)

    for matter in matter_repo.list_by_firm(firm.id):
        for document in matter_repo.list_documents_for_matter(matter.id):
            matter_repo.delete_document(document)
        for assignment in matter_repo.list_assignments_for_matter(matter.id):
            matter_repo.delete_assignment(assignment)
        for task in matter_repo.list_tasks_for_matter(matter.id):
            matter_repo.delete_task(task)
        for message in matter_repo.list_messages_for_matter(matter.id):
            matter_repo.delete_message(message)
        matter_repo.delete_matter(matter)

    for client in client_repo.list_by_firm(firm.id):
        for contact in client_repo.list_contacts_for_client(client.id):
            notification_repo.delete_for_recipient(RecipientType.CLIENT_CONTACT, contact.id)
            refresh_token_repo.delete_all_for_actor(RefreshTokenActorType.CLIENT, contact.id)
            client_repo.delete_contact(contact)
        client_repo.delete_client(client)

    for user in auth_repo.list_by_firm(firm.id):
        notification_repo.delete_for_recipient(RecipientType.STAFF, user.id)
        refresh_token_repo.delete_all_for_actor(RefreshTokenActorType.STAFF, user.id)
        auth_repo.delete_user(user)

    auth_repo.delete_firm(firm)
    db.commit()