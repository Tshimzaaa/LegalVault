from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.signatures.schemas import CreateSignatureRequestRequest, SignatureRequestResponse
from app.modules.signatures.service import SignatureService

from app.modules.auth.dependencies import get_current_user, require_role
from app.modules.auth.models import User
from app.modules.auth.models.role import UserRole
from app.modules.clients.dependencies import get_current_contact
from app.modules.clients.models import ClientContact
from app.core.documenso_client import verify_webhook_secret, WEBHOOK_SECRET_HEADER
from app.database.rls import set_tenant_context

_CASE_WORK = [UserRole.ADMIN, UserRole.LAWYER, UserRole.PARALEGAL]

router = APIRouter(prefix="/matters", tags=["signatures"])
my_signatures_router = APIRouter(prefix="/signatures", tags=["signatures"])
client_signatures_router = APIRouter(prefix="/client-signatures", tags=["client-signatures"])
webhook_router = APIRouter(tags=["webhooks"])


@router.post("/{matter_id}/signatures", response_model=SignatureRequestResponse, status_code=201)
def send_for_signature(
    matter_id: str,
    request: CreateSignatureRequestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    service = SignatureService(db)
    return service.create_and_send(matter_id, current_user.firm_id, current_user.id, request)


@router.get("/{matter_id}/signatures", response_model=list[SignatureRequestResponse])
def list_signature_requests(
    matter_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SignatureService(db)
    return service.list_for_matter(matter_id, current_user.firm_id)


@router.post("/{matter_id}/signatures/{signature_request_id}/void", response_model=SignatureRequestResponse)
def void_signature_request(
    matter_id: str,
    signature_request_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    service = SignatureService(db)
    return service.void(signature_request_id, current_user.firm_id, current_user.id)


@my_signatures_router.get("/mine", response_model=list[SignatureRequestResponse])
def list_my_pending_staff_signatures(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SignatureService(db)
    return service.list_pending_for_user(current_user.id)


@client_signatures_router.get("", response_model=list[SignatureRequestResponse])
def list_my_pending_signatures(
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    service = SignatureService(db)
    return service.list_pending_for_contact(current_contact.id)


# --- Documenso webhook --------------------------------------------------
# Unauthenticated by design (Documenso, not a logged-in user, calls this) — verified
# instead via a shared secret header. Header name, event names, and payload shape
# below were confirmed against a real running self-hosted instance's build output
# (docker exec into the documenso container and read its compiled webhook-sending
# code) on 2026-09-09 — see app/core/documenso_client.py's module docstring for
# background on why the pinned documenso_sdk package can't be trusted for this kind
# of detail. Re-verify if the pulled "documenso/documenso:latest" image changes.
_EVENT_RECIPIENT_SIGNED = "DOCUMENT_SIGNED"
_EVENT_RECIPIENT_COMPLETED = "DOCUMENT_RECIPIENT_COMPLETED"
_EVENT_DOCUMENT_REJECTED = "DOCUMENT_REJECTED"
_EVENT_DOCUMENT_COMPLETED = "DOCUMENT_COMPLETED"


@webhook_router.post("/webhooks/documenso", status_code=200)
async def documenso_webhook(request: Request, db: Session = Depends(get_db)):
    if not verify_webhook_secret(request.headers.get(WEBHOOK_SECRET_HEADER)):
        raise HTTPException(status_code=401, detail="Invalid webhook secret.")

    body = await request.json()
    event = body.get("event")
    data = body.get("payload", {})
    documenso_document_id = str(data.get("id") or data.get("documentId") or "")
    if not documenso_document_id:
        return {"received": True}

    # A verified webhook is a trusted, cross-firm system call — same rationale as the
    # owner console (see app/modules/owner/dependencies.py) for bypassing per-firm RLS.
    set_tenant_context(db, firm_id=None, is_owner=True)

    service = SignatureService(db)
    if event in (_EVENT_RECIPIENT_SIGNED, _EVENT_RECIPIENT_COMPLETED):
        # DOCUMENT_SIGNED / DOCUMENT_RECIPIENT_COMPLETED both carry the *whole*
        # document, with every recipient's own signingStatus — there's no top-level
        # "recipient" object naming just the one who signed. Reconcile every
        # recipient the payload says is SIGNED; handle_recipient_signed is a no-op
        # for ones we've already recorded, so this is safe to call repeatedly.
        for recipient in data.get("recipients") or data.get("Recipient") or []:
            if recipient.get("signingStatus") == "SIGNED":
                documenso_recipient_id = str(recipient.get("id", ""))
                if documenso_recipient_id:
                    service.handle_recipient_signed(documenso_document_id, documenso_recipient_id)
    elif event == _EVENT_DOCUMENT_REJECTED:
        # Same whole-document payload shape — the rejecting recipient is whichever
        # one has signingStatus REJECTED.
        for recipient in data.get("recipients") or data.get("Recipient") or []:
            if recipient.get("signingStatus") == "REJECTED":
                documenso_recipient_id = str(recipient.get("id", ""))
                if documenso_recipient_id:
                    service.handle_recipient_declined(documenso_document_id, documenso_recipient_id)
    elif event == _EVENT_DOCUMENT_COMPLETED:
        service.handle_document_completed(documenso_document_id)

    return {"received": True}
