from pydantic import BaseModel
from uuid import UUID
from datetime import date, datetime

from app.modules.auth.models.role import UserRole
from app.modules.contracts.models import ContractStage, ContractRole, TaskStatus
from app.modules.audit.schemas import AuditLogResponse
from app.modules.monitoring.schemas import (
    RequestMetrics,
    ServiceHealthEntry,
    DependencyHealth,
    EndpointStat,
    RequestTimeseriesPoint,
)


class OrganizationSummary(BaseModel):
    id: UUID
    name: str
    email: str
    is_active: bool

    class Config:
        from_attributes = True

class OrganizationDetail(BaseModel):
    id: UUID
    name: str
    email: str
    phone: str | None
    website: str | None
    address: str | None
    is_active: bool
    staff_count: int
    contract_count: int

class UpdateOrganizationStatusRequest(BaseModel):
    is_active: bool
class OwnerLoginRequest(BaseModel):
    secret: str

class OwnerTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class OrganizationExportProfile(BaseModel):
    id: UUID
    name: str
    email: str
    phone: str | None
    website: str | None
    address: str | None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class OrganizationExportStaff(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    email: str
    role: UserRole
    is_active: bool
    invitation_status: str
    last_login: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class OrganizationExportAssignment(BaseModel):
    user_id: UUID
    role_on_contract: ContractRole


class OrganizationExportTask(BaseModel):
    id: UUID
    title: str
    description: str | None
    assigned_to: UUID | None
    due_date: date | None
    status: TaskStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrganizationExportDocument(BaseModel):
    id: UUID
    title: str
    version: int
    original_filename: str
    content_type: str
    uploaded_by: UUID | None
    created_at: datetime
    download_url: str | None


class OrganizationExportContract(BaseModel):
    id: UUID
    title: str
    description: str | None
    status: ContractStage
    created_at: datetime
    updated_at: datetime
    assignments: list[OrganizationExportAssignment]
    tasks: list[OrganizationExportTask]
    documents: list[OrganizationExportDocument]


class OrganizationExportResponse(BaseModel):
    exported_at: datetime
    org: OrganizationExportProfile
    staff: list[OrganizationExportStaff]
    contracts: list[OrganizationExportContract]
    audit_log: list[AuditLogResponse]


class UsageMetrics(BaseModel):
    total_orgs: int
    active_orgs: int
    inactive_orgs: int
    total_staff: int
    total_contracts: int
    contracts_by_status: dict[str, int]
    new_orgs_last_7_days: int
    new_orgs_last_30_days: int


class PlatformMetricsResponse(BaseModel):
    generated_at: datetime
    usage: UsageMetrics
    requests: RequestMetrics


class SystemHealthResponse(BaseModel):
    generated_at: datetime
    status: str  # "operational" | "degraded" | "down"
    uptime_seconds: float
    window_hours: int
    requests: RequestMetrics
    active_users: int
    online_orgs: int
    dependencies: list[DependencyHealth]
    services: list[ServiceHealthEntry]
    worst_endpoints: list[EndpointStat]
    timeseries: list[RequestTimeseriesPoint]