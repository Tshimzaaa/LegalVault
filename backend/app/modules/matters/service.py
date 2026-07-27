import uuid
from sqlalchemy.orm import Session

from app.modules.matters.repository import MatterRepository
from app.modules.matters.models import Matter, MatterAssignment, MatterDocument
from app.modules.matters.schemas import (
    CreateMatterRequest,
    UpdateMatterStatusRequest,
    UpdateMatterVisibilityRequest,
    AssignStaffRequest,
)
from app.exceptions.matters import (
    MatterNotFound,
    ClientNotFoundForMatter,
    StaffAlreadyAssigned,
    MatterDocumentNotFound,
)
from app.modules.clients.repository import ClientRepository
from app.modules.auth.repository import AuthRepository
from app.core.storage import upload_file, get_download_url


ALLOWED_DOCUMENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
}
class MatterService:

    def __init__(self, db: Session):
        self.db = db
        self.repository = MatterRepository(db)
        self.client_repository = ClientRepository(db)
        self.auth_repository = AuthRepository(db)

    def create_matter(self, firm_id, request: CreateMatterRequest) -> Matter:
        client = self.client_repository.get_client_by_id(request.client_id)
        if not client or str(client.firm_id) != str(firm_id):
            raise ClientNotFoundForMatter()

        matter = Matter(
            firm_id=firm_id,
            client_id=request.client_id,
            title=request.title,
            description=request.description,
        )
        self.repository.create(matter)
        self.db.commit()
        return matter

    def get_matter(self, matter_id, firm_id) -> Matter:
        matter = self.repository.get_by_id(matter_id)
        if not matter or str(matter.firm_id) != str(firm_id):
            raise MatterNotFound()
        return matter

    def list_matters_for_firm(self, firm_id) -> list[Matter]:
        return self.repository.list_by_firm(firm_id)

    def update_status(self, matter_id, firm_id, request: UpdateMatterStatusRequest) -> Matter:
        matter = self.get_matter(matter_id, firm_id)
        matter.status = request.status
        self.db.commit()
        return matter

    def update_visibility(self, matter_id, firm_id, request: UpdateMatterVisibilityRequest) -> Matter:
        matter = self.get_matter(matter_id, firm_id)
        matter.is_visible_to_client = request.is_visible_to_client
        self.db.commit()
        return matter

    def assign_staff(self, matter_id, firm_id, request: AssignStaffRequest) -> MatterAssignment:
        matter = self.get_matter(matter_id, firm_id)  # also validates firm ownership

        existing = self.repository.get_assignment(matter_id, request.user_id, request.role_on_matter)
        if existing:
            raise StaffAlreadyAssigned()

        assignment = MatterAssignment(
            matter_id=matter.id,
            user_id=request.user_id,
            role_on_matter=request.role_on_matter,
        )
        self.repository.create_assignment(assignment)
        self.db.commit()
        return assignment

    def list_visible_matters_for_client(self, client_id) -> list[Matter]:
        matters = self.repository.list_by_client(client_id)
        return [m for m in matters if m.is_visible_to_client]
    def list_assignments(self, matter_id, firm_id):
        self.get_matter(matter_id, firm_id)  # validates ownership, raises 404 if not found/wrong firm
        return self.repository.list_assignments_for_matter(matter_id)
    def upload_matter_document(
        self,
        matter_id,
        firm_id,
        uploaded_by,
        title: str,
        file_bytes: bytes,
        original_filename: str,
        content_type: str,
    ) -> MatterDocument:
        matter = self.get_matter(matter_id, firm_id)  # validates ownership, raises MatterNotFound if wrong firm

        if content_type not in ALLOWED_DOCUMENT_TYPES:
            from app.exceptions.templates import UnsupportedFileType
            raise UnsupportedFileType()

        latest = self.repository.get_latest_version(matter.id, title)
        next_version = (latest.version + 1) if latest else 1

        file_key = f"matter_documents/{matter.id}/{uuid.uuid4()}-{original_filename}"
        upload_file(file_bytes, file_key, content_type)

        document = MatterDocument(
            matter_id=matter.id,
            uploaded_by=uploaded_by,
            title=title,
            version=next_version,
            file_key=file_key,
            original_filename=original_filename,
            content_type=content_type,
        )
        self.repository.create_document(document)
        self.db.commit()
        return document


    def list_matter_documents(self, matter_id, firm_id) -> list[MatterDocument]:
        self.get_matter(matter_id, firm_id)  # ownership check
        return self.repository.list_documents_for_matter(matter_id)


    def get_matter_document_download(self, matter_id, document_id, firm_id) -> str:
        self.get_matter(matter_id, firm_id)  # ownership check
        document = self.repository.get_document_by_id(document_id)
        if not document or str(document.matter_id) != str(matter_id):
            raise MatterDocumentNotFound()
        return get_download_url(document.file_key)