import uuid
from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.modules.signed_contracts.repository import SignedContractRepository
from app.modules.signed_contracts.models import SignedContract, ContractStatus, ContractType
from app.modules.signed_contracts.schemas import (
    SignedContractResponse,
    SignedContractsSummaryResponse,
)
from app.exceptions.signed_contracts import SignedContractNotFound
from app.exceptions.clients import ClientNotFound
from app.exceptions.matters import MatterNotFound
from app.modules.clients.repository import ClientRepository
from app.modules.matters.repository import MatterRepository
from app.exceptions.malware import MalwareDetected
from app.core.storage import upload_file, get_download_url
from app.core.malware_scan import scan_file
from app.modules.audit.service import AuditService
from app.modules.audit.models import ActorType
from app.modules.audit import actions as audit_actions

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
    "application/msword",  # .doc
    "text/plain",  # .txt
}

EXPIRING_SOON_WINDOW_DAYS = 30


def _effective_status(contract: SignedContract, today: date) -> str:
    if contract.status == ContractStatus.ARCHIVED:
        return "archived"
    if contract.expiry_date is not None and contract.expiry_date <= today + timedelta(days=EXPIRING_SOON_WINDOW_DAYS):
        return "expiring"
    return "active"


class SignedContractService:

    def __init__(self, db: Session):
        self.db = db
        self.repository = SignedContractRepository(db)
        self.client_repository = ClientRepository(db)
        self.matter_repository = MatterRepository(db)
        self.audit = AuditService(db)

    def upload_contract(
        self,
        org_id,
        actor_id,
        client_id,
        title: str,
        agreement_type: ContractType,
        signed_date: date,
        file_bytes: bytes,
        original_filename: str,
        content_type: str,
        description: str | None = None,
        expiry_date: date | None = None,
        integration_source: str = "manual",
        matter_id=None,
    ) -> SignedContractResponse:
        client = self.client_repository.get_client_by_id(client_id)
        if not client or str(client.org_id) != str(org_id):
            raise ClientNotFound()

        if matter_id is not None:
            matter = self.matter_repository.get_by_id(matter_id)
            if not matter or str(matter.org_id) != str(org_id) or str(matter.client_id) != str(client_id):
                raise MatterNotFound()

        from app.exceptions.templates import UnsupportedFileType
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise UnsupportedFileType()

        try:
            scan_file(file_bytes)
        except MalwareDetected:
            self.audit.log(
                actor_type=ActorType.STAFF,
                actor_id=actor_id,
                org_id=org_id,
                action=audit_actions.FILE_UPLOAD_BLOCKED_MALWARE,
                target_type="signed_contract",
                target_id=None,
                details={"title": title, "original_filename": original_filename},
            )
            self.db.commit()
            raise

        file_key = f"signed_contracts/{org_id}/{uuid.uuid4()}-{original_filename}"
        upload_file(file_bytes, file_key, content_type)

        contract = SignedContract(
            org_id=org_id,
            client_id=client_id,
            matter_id=matter_id,
            uploaded_by=actor_id,
            title=title,
            description=description,
            agreement_type=agreement_type,
            signed_date=signed_date,
            expiry_date=expiry_date,
            integration_source=integration_source or "manual",
            file_key=file_key,
            original_filename=original_filename,
            content_type=content_type,
        )
        self.repository.create(contract)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.SIGNED_CONTRACT_UPLOADED,
            target_type="signed_contract",
            target_id=contract.id,
            details={"title": contract.title, "agreement_type": contract.agreement_type.value},
        )
        self.db.commit()
        return self._to_response(contract, client.company_name)

    def _to_response(self, contract: SignedContract, client_name: str) -> SignedContractResponse:
        return SignedContractResponse(
            id=contract.id,
            org_id=contract.org_id,
            client_id=contract.client_id,
            client_name=client_name,
            matter_id=contract.matter_id,
            title=contract.title,
            description=contract.description,
            agreement_type=contract.agreement_type,
            signed_date=contract.signed_date,
            expiry_date=contract.expiry_date,
            integration_source=contract.integration_source,
            status=_effective_status(contract, date.today()),
            original_filename=contract.original_filename,
            content_type=contract.content_type,
            created_at=contract.created_at,
        )

    def list_for_org(self, org_id) -> list[SignedContractResponse]:
        return [self._to_response(c, client.company_name) for c, client in self.repository.list_by_org(org_id)]

    def list_for_client(self, client_id) -> list[SignedContractResponse]:
        return [self._to_response(c, client.company_name) for c, client in self.repository.list_by_client(client_id)]

    def _summary(self, contracts: list[SignedContract]) -> SignedContractsSummaryResponse:
        today = date.today()
        statuses = [_effective_status(c, today) for c in contracts]
        return SignedContractsSummaryResponse(
            total=len(contracts),
            active=sum(1 for s in statuses if s == "active"),
            expiring_soon=sum(1 for s in statuses if s == "expiring"),
        )

    def get_summary_for_org(self, org_id) -> SignedContractsSummaryResponse:
        return self._summary([c for c, _ in self.repository.list_by_org(org_id)])

    def get_summary_for_client(self, client_id) -> SignedContractsSummaryResponse:
        return self._summary([c for c, _ in self.repository.list_by_client(client_id)])

    def get_download_link(self, contract_id, org_id) -> str:
        contract = self.repository.get_by_id(contract_id)
        if not contract or str(contract.org_id) != str(org_id):
            raise SignedContractNotFound()
        return get_download_url(contract.file_key)

    def get_client_download_link(self, contract_id, client_id) -> str:
        contract = self.repository.get_by_id(contract_id)
        if not contract or str(contract.client_id) != str(client_id):
            raise SignedContractNotFound()
        return get_download_url(contract.file_key)

    def update_status(self, contract_id, org_id, actor_id, status: ContractStatus) -> SignedContractResponse:
        contract = self.repository.get_by_id(contract_id)
        if not contract or str(contract.org_id) != str(org_id):
            raise SignedContractNotFound()

        contract.status = status

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.SIGNED_CONTRACT_STATUS_UPDATED,
            target_type="signed_contract",
            target_id=contract.id,
            details={"status": status.value},
        )
        self.db.commit()

        client = self.client_repository.get_client_by_id(contract.client_id)
        return self._to_response(contract, client.company_name if client else "")
