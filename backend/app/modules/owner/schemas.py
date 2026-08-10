from pydantic import BaseModel
from uuid import UUID
from datetime import date, datetime

from app.modules.auth.models.role import UserRole
from app.modules.matters.models import MatterStatus, MatterRole, TaskStatus
from app.modules.audit.schemas import AuditLogResponse
from app.modules.monitoring.schemas import (
    RequestMetrics,
    ServiceHealthEntry,
    DependencyHealth,
    EndpointStat,
    RequestTimeseriesPoint,
)


class FirmSummary(BaseModel):
    id: UUID
    name: str
    email: str
    is_active: bool

    class Config:
        from_attributes = True

class FirmDetail(BaseModel):
    id: UUID
    name: str
    email: str
    phone: str | None
    website: str | None
    address: str | None
    is_active: bool
    staff_count: int
    client_count: int
    matter_count: int

class UpdateFirmStatusRequest(BaseModel):
    is_active: bool
class OwnerLoginRequest(BaseModel):
    secret: str

class OwnerTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class FirmExportProfile(BaseModel):
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


class FirmExportStaff(BaseModel):
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


class FirmExportContact(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    email: str
    is_active: bool
    invitation_status: str
    last_login: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class FirmExportClient(BaseModel):
    id: UUID
    company_name: str
    is_active: bool
    created_at: datetime
    contacts: list[FirmExportContact]


class FirmExportAssignment(BaseModel):
    user_id: UUID
    role_on_matter: MatterRole


class FirmExportTask(BaseModel):
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


class FirmExportDocument(BaseModel):
    id: UUID
    title: str
    version: int
    original_filename: str
    content_type: str
    uploaded_by: UUID | None
    uploaded_by_contact_id: UUID | None
    created_at: datetime
    download_url: str | None


class FirmExportMatter(BaseModel):
    id: UUID
    client_id: UUID
    title: str
    description: str | None
    status: MatterStatus
    is_visible_to_client: bool
    created_at: datetime
    updated_at: datetime
    assignments: list[FirmExportAssignment]
    tasks: list[FirmExportTask]
    documents: list[FirmExportDocument]


class FirmExportResponse(BaseModel):
    exported_at: datetime
    firm: FirmExportProfile
    staff: list[FirmExportStaff]
    clients: list[FirmExportClient]
    matters: list[FirmExportMatter]
    audit_log: list[AuditLogResponse]


class UsageMetrics(BaseModel):
    total_firms: int
    active_firms: int
    inactive_firms: int
    total_staff: int
    total_clients: int
    total_matters: int
    matters_by_status: dict[str, int]
    new_firms_last_7_days: int
    new_firms_last_30_days: int


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
    online_firms: int
    dependencies: list[DependencyHealth]
    services: list[ServiceHealthEntry]
    worst_endpoints: list[EndpointStat]
    timeseries: list[RequestTimeseriesPoint]