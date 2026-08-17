from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.modules.signatures.models import SignatureRequest, SignatureRecipient


class SignatureRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(self, signature_request: SignatureRequest) -> SignatureRequest:
        self.db.add(signature_request)
        self.db.flush()
        return signature_request

    def create_recipients(self, recipients: list[SignatureRecipient]) -> list[SignatureRecipient]:
        self.db.add_all(recipients)
        self.db.flush()
        return recipients

    def get_by_id(self, signature_request_id) -> SignatureRequest | None:
        statement = (
            select(SignatureRequest)
            .options(selectinload(SignatureRequest.recipients))
            .where(SignatureRequest.id == signature_request_id)
        )
        return self.db.scalar(statement)

    def get_by_documenso_document_id(self, documenso_document_id: str) -> SignatureRequest | None:
        statement = (
            select(SignatureRequest)
            .options(selectinload(SignatureRequest.recipients))
            .where(SignatureRequest.documenso_document_id == documenso_document_id)
        )
        return self.db.scalar(statement)

    def list_by_matter(self, matter_id) -> list[SignatureRequest]:
        statement = (
            select(SignatureRequest)
            .options(selectinload(SignatureRequest.recipients))
            .where(SignatureRequest.matter_id == matter_id)
            .order_by(SignatureRequest.created_at.desc())
        )
        return list(self.db.scalars(statement))

    def list_pending_for_recipient(self, recipient_type, recipient_id) -> list[SignatureRequest]:
        statement = (
            select(SignatureRequest)
            .join(SignatureRecipient, SignatureRecipient.signature_request_id == SignatureRequest.id)
            .options(selectinload(SignatureRequest.recipients))
            .where(
                SignatureRecipient.recipient_type == recipient_type,
                SignatureRecipient.recipient_id == recipient_id,
            )
            .order_by(SignatureRequest.created_at.desc())
        )
        return list(self.db.scalars(statement))
