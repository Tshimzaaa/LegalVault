import uuid
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.modules.signatures.repository import SignatureRepository
from app.modules.signatures.models import (
    SignatureRequest,
    SignatureRecipient,
    SignatureRequestStatus,
    SignatureRecipientStatus,
)
from app.modules.signatures.schemas import CreateSignatureRequestRequest, SignatureRequestResponse
from app.modules.matters.repository import MatterRepository
from app.modules.clients.repository import ClientRepository
from app.modules.auth.repository import AuthRepository
from app.modules.notifications.service import NotificationService
from app.modules.notifications.models import RecipientType
from app.modules.signed_contracts.repository import SignedContractRepository
from app.modules.signed_contracts.models import SignedContract, ContractType
from app.modules.audit.service import AuditService
from app.modules.audit.models import ActorType
from app.modules.audit import actions as audit_actions
from app.exceptions.matters import MatterNotFound, MatterDocumentNotFound
from app.exceptions.signatures import SignatureRequestNotFound, InvalidSignatureRecipient
from app.core import documenso_client
from app.core.storage import download_file, upload_file


class SignatureService:

    def __init__(self, db: Session):
        self.db = db
        self.repository = SignatureRepository(db)
        self.matter_repository = MatterRepository(db)
        self.client_repository = ClientRepository(db)
        self.auth_repository = AuthRepository(db)
        self.signed_contract_repository = SignedContractRepository(db)
        self.audit = AuditService(db)
        self.notifications = NotificationService(db)

    def _resolve_recipients(self, recipients_input, org_id, client_id) -> list[dict]:
        resolved = []
        for entry in recipients_input:
            if entry.recipient_type == RecipientType.STAFF:
                user = self.auth_repository.get_user_by_id(entry.recipient_id)
                if not user or str(user.org_id) != str(org_id):
                    raise InvalidSignatureRecipient()
                resolved.append(
                    {
                        "recipient_type": RecipientType.STAFF,
                        "recipient_id": user.id,
                        "name": f"{user.first_name} {user.last_name}",
                        "email": user.email,
                    }
                )
            else:
                contact = self.client_repository.get_contact_by_id(entry.recipient_id)
                if not contact or str(contact.client_id) != str(client_id):
                    raise InvalidSignatureRecipient()
                resolved.append(
                    {
                        "recipient_type": RecipientType.CLIENT_CONTACT,
                        "recipient_id": contact.id,
                        "name": f"{contact.first_name} {contact.last_name}",
                        "email": contact.email,
                    }
                )
        return resolved

    def create_and_send(
        self, matter_id, org_id, actor_id, request: CreateSignatureRequestRequest
    ) -> SignatureRequestResponse:
        matter = self.matter_repository.get_by_id(matter_id)
        if not matter or str(matter.org_id) != str(org_id):
            raise MatterNotFound()

        document = self.matter_repository.get_document_by_id(request.source_document_id)
        if not document or str(document.matter_id) != str(matter_id):
            raise MatterDocumentNotFound()

        recipients_input = self._resolve_recipients(request.recipients, org_id, matter.client_id)

        file_bytes = download_file(document.file_key)
        sent = documenso_client.create_and_send_document(
            title=request.title,
            file_bytes=file_bytes,
            recipients=[{"name": r["name"], "email": r["email"]} for r in recipients_input],
        )

        signature_request = SignatureRequest(
            org_id=org_id,
            matter_id=matter_id,
            client_id=matter.client_id,
            source_document_id=document.id,
            requested_by=actor_id,
            title=request.title,
            documenso_document_id=sent["documenso_document_id"],
        )
        self.repository.create(signature_request)

        sent_by_email = {r["email"]: r for r in sent["recipients"]}
        recipients = [
            SignatureRecipient(
                signature_request_id=signature_request.id,
                recipient_type=r["recipient_type"],
                recipient_id=r["recipient_id"],
                name=r["name"],
                email=r["email"],
                signing_order=index + 1,
                documenso_recipient_id=sent_by_email[r["email"]]["documenso_recipient_id"],
                signing_url=sent_by_email[r["email"]]["signing_url"],
            )
            for index, r in enumerate(recipients_input)
        ]
        self.repository.create_recipients(recipients)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.SIGNATURE_REQUEST_SENT,
            target_type="signature_request",
            target_id=signature_request.id,
            details={"title": request.title, "matter_id": str(matter_id), "recipient_count": len(recipients)},
        )
        self.notifications.notify_many(
            [
                {
                    "recipient_type": r.recipient_type,
                    "recipient_id": r.recipient_id,
                    "type": "signature.requested",
                    "title": f'Signature requested: "{request.title}"',
                    "body": f"{matter.title}: you have a document waiting for your signature.",
                    "target_type": "signature_request",
                    "target_id": signature_request.id,
                }
                for r in recipients
            ]
        )
        self.db.commit()

        return self._to_response(self.repository.get_by_id(signature_request.id))

    def _to_response(self, signature_request: SignatureRequest) -> SignatureRequestResponse:
        return SignatureRequestResponse.model_validate(signature_request)

    def list_for_matter(self, matter_id, org_id) -> list[SignatureRequestResponse]:
        matter = self.matter_repository.get_by_id(matter_id)
        if not matter or str(matter.org_id) != str(org_id):
            raise MatterNotFound()
        return [self._to_response(sr) for sr in self.repository.list_by_matter(matter_id)]

    def get(self, signature_request_id, org_id) -> SignatureRequestResponse:
        signature_request = self.repository.get_by_id(signature_request_id)
        if not signature_request or str(signature_request.org_id) != str(org_id):
            raise SignatureRequestNotFound()
        return self._to_response(signature_request)

    def void(self, signature_request_id, org_id, actor_id) -> SignatureRequestResponse:
        signature_request = self.repository.get_by_id(signature_request_id)
        if not signature_request or str(signature_request.org_id) != str(org_id):
            raise SignatureRequestNotFound()

        documenso_client.void_document(signature_request.documenso_document_id)
        signature_request.status = SignatureRequestStatus.VOIDED

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.SIGNATURE_REQUEST_VOIDED,
            target_type="signature_request",
            target_id=signature_request.id,
            details={"title": signature_request.title},
        )
        self.db.commit()
        return self._to_response(self.repository.get_by_id(signature_request_id))

    def list_pending_for_contact(self, contact_id) -> list[SignatureRequestResponse]:
        requests = self.repository.list_pending_for_recipient(RecipientType.CLIENT_CONTACT, contact_id)
        return [self._to_response(sr) for sr in requests]

    def list_pending_for_user(self, user_id) -> list[SignatureRequestResponse]:
        requests = self.repository.list_pending_for_recipient(RecipientType.STAFF, user_id)
        return [self._to_response(sr) for sr in requests]

    # --- Webhook handling -------------------------------------------------
    # Called from app/modules/signatures/routes.py's webhook endpoint, which has
    # already verified the request came from Documenso before reaching this point.

    def handle_recipient_signed(self, documenso_document_id: str, documenso_recipient_id: str) -> None:
        signature_request = self.repository.get_by_documenso_document_id(documenso_document_id)
        if not signature_request:
            return

        recipient = next(
            (r for r in signature_request.recipients if r.documenso_recipient_id == documenso_recipient_id),
            None,
        )
        if not recipient:
            return

        recipient.status = SignatureRecipientStatus.SIGNED
        recipient.signed_at = datetime.now(timezone.utc)
        self.db.commit()

    def handle_recipient_declined(self, documenso_document_id: str, documenso_recipient_id: str) -> None:
        signature_request = self.repository.get_by_documenso_document_id(documenso_document_id)
        if not signature_request:
            return

        recipient = next(
            (r for r in signature_request.recipients if r.documenso_recipient_id == documenso_recipient_id),
            None,
        )
        if recipient:
            recipient.status = SignatureRecipientStatus.DECLINED

        signature_request.status = SignatureRequestStatus.DECLINED

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=signature_request.requested_by,
            org_id=signature_request.org_id,
            action=audit_actions.SIGNATURE_REQUEST_DECLINED,
            target_type="signature_request",
            target_id=signature_request.id,
            details={"title": signature_request.title},
        )
        self._notify_requester(signature_request, "declined signing")
        self.db.commit()

    def handle_document_completed(self, documenso_document_id: str) -> None:
        signature_request = self.repository.get_by_documenso_document_id(documenso_document_id)
        if not signature_request or signature_request.status == SignatureRequestStatus.COMPLETED:
            return

        signed_pdf = documenso_client.download_completed_document(documenso_document_id)

        source_document = self.matter_repository.get_document_by_id(signature_request.source_document_id)
        client = self.client_repository.get_client_by_id(signature_request.client_id)

        file_key = f"signed_contracts/{signature_request.org_id}/{uuid.uuid4()}-{signature_request.title}.pdf"
        upload_file(signed_pdf, file_key, "application/pdf")

        signed_contract = SignedContract(
            org_id=signature_request.org_id,
            client_id=signature_request.client_id,
            matter_id=signature_request.matter_id,
            uploaded_by=signature_request.requested_by,
            title=signature_request.title,
            description="Signed electronically via the built-in e-signature flow.",
            agreement_type=ContractType.GENERAL,
            signed_date=date.today(),
            integration_source="documenso",
            file_key=file_key,
            original_filename=(source_document.original_filename if source_document else f"{signature_request.title}.pdf"),
            content_type="application/pdf",
        )
        self.signed_contract_repository.create(signed_contract)

        signature_request.status = SignatureRequestStatus.COMPLETED
        signature_request.completed_at = datetime.now(timezone.utc)
        signature_request.signed_contract_id = signed_contract.id

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=signature_request.requested_by,
            org_id=signature_request.org_id,
            action=audit_actions.SIGNATURE_COMPLETED,
            target_type="signature_request",
            target_id=signature_request.id,
            details={"title": signature_request.title, "signed_contract_id": str(signed_contract.id)},
        )
        self._notify_requester(signature_request, "was fully signed by everyone")
        self.db.commit()

    def _notify_requester(self, signature_request: SignatureRequest, verb: str) -> None:
        self.notifications.notify(
            recipient_type=RecipientType.STAFF,
            recipient_id=signature_request.requested_by,
            type="signature.updated",
            title=f'Signature request "{signature_request.title}" {verb}',
            body="",
            target_type="signature_request",
            target_id=signature_request.id,
        )
