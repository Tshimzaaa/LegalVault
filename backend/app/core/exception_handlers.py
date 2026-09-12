from fastapi import FastAPI, HTTPException
from app.exceptions.templates import TemplateNotFound, UnsupportedFileType, TemplateHasNoBody
from app.exceptions.auth import InvalidOrExpiredResetToken as StaffInvalidResetToken
from app.exceptions.clients import InvalidOrExpiredResetToken as ClientInvalidResetToken


from app.exceptions.auth import (
    InvalidCredentials,
    LawFirmAlreadyExists,
    UserAlreadyExists,
    InactiveUser,
    InsufficientPermissions,
    InvalidOrExpiredInvite as StaffInvalidOrExpiredInvite,
    InviteAlreadyAccepted as StaffInviteAlreadyAccepted,
    StaffNotFound,
    CannotDeactivateSelf,
    InvalidRefreshToken as StaffInvalidRefreshToken,
)
from app.exceptions.clients import (
    ClientNotFound,
    ContactAlreadyExists,
    InvalidOrExpiredInvite as ClientInvalidOrExpiredInvite,
    InviteAlreadyAccepted as ClientInviteAlreadyAccepted,
    InvalidClientCredentials,
    InactiveContact,
    ContactNotFound,
    ClientHasMatters,
    InvalidRefreshToken as ClientInvalidRefreshToken,
    IncorrectPassword as ClientIncorrectPassword,
)

from app.exceptions.matters import (
    MatterNotFound,
    ClientNotFoundForMatter,
    StaffAlreadyAssigned,
    MatterDocumentNotFound,
    UserNotFoundForAssignment,
    MatterTaskNotFound,
    MatterMessageNotFound,
    CannotDeleteOthersMessage,
    MatterContactPermissionNotFound,
    ContactNotFoundForMatterPermission,
    InvalidStatusTransition,
    ApprovalRequiredForTransition,
    ApprovalAlreadyPending,
    MatterApprovalNotFound,
    ApprovalAlreadyDecided,
    IntakeSubmissionClientMismatch,
)
from app.exceptions.announcements import AnnouncementNotFound
from app.exceptions.notifications import NotificationNotFound
from app.exceptions.signed_contracts import SignedContractNotFound
from app.exceptions.fallback_clauses import FallbackClauseNotFound
from app.exceptions.storage import StorageUnavailable
from app.exceptions.malware import MalwareDetected, ScannerUnavailable
from app.exceptions.intake import (
    IntakeFormNotFound,
    IntakeSubmissionNotFound,
    IntakeAnswerNotFound,
    IntakeFormNotPublished,
    MissingRequiredIntakeAnswer,
    UnsupportedIntakeFileType,
)
from app.exceptions.knowledge import KnowledgeArticleNotFound
from app.exceptions.signatures import SignatureRequestNotFound, InvalidSignatureRecipient, SigningProviderUnavailable

def register_exception_handlers(app: FastAPI):

    @app.exception_handler(LawFirmAlreadyExists)
    async def law_firm_exists(_, __):
        raise HTTPException(
            status_code=409,
            detail="A law firm with this email already exists.",
        )

    @app.exception_handler(UserAlreadyExists)
    async def user_exists(_, __):
        raise HTTPException(
            status_code=409,
            detail="A user with this email already exists.",
        )

    @app.exception_handler(InvalidCredentials)
    async def invalid_credentials(_, __):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    @app.exception_handler(InactiveUser)
    async def inactive_user(_, __):
        raise HTTPException(
            status_code=403,
            detail="This account has been deactivated.",
        )

    @app.exception_handler(InsufficientPermissions)
    async def insufficient_permissions(_, __):
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to perform this action.",
        )

    @app.exception_handler(ClientNotFound)
    async def client_not_found(_, __):
        raise HTTPException(
            status_code=404,
            detail="Client not found.",
        )

    @app.exception_handler(ContactAlreadyExists)
    async def contact_exists(_, __):
        raise HTTPException(
            status_code=409,
            detail="A contact with this email already exists.",
        )

    @app.exception_handler(ClientInvalidOrExpiredInvite)
    async def invalid_invite(_, __):
        raise HTTPException(
            status_code=400,
            detail="This invitation link is invalid or has expired.",
        )

    @app.exception_handler(ClientInviteAlreadyAccepted)
    async def invite_already_accepted(_, __):
        raise HTTPException(
            status_code=409,
            detail="This invitation has already been used.",
        )

    @app.exception_handler(InvalidClientCredentials)
    async def invalid_client_credentials(_, __):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    @app.exception_handler(InactiveContact)
    async def inactive_contact(_, __):
        raise HTTPException(
            status_code=403,
            detail="This account has been deactivated.",
        )
    @app.exception_handler(MatterNotFound)
    async def matter_not_found(_, __):
        raise HTTPException(status_code=404, detail="Matter not found.")

    @app.exception_handler(ClientNotFoundForMatter)
    async def client_not_found_for_matter(_, __):
        raise HTTPException(status_code=404, detail="Client not found.")

    @app.exception_handler(StaffAlreadyAssigned)
    async def staff_already_assigned(_, __):
        raise HTTPException(status_code=409, detail="This staff member is already assigned to this matter with that role.")

    @app.exception_handler(UserNotFoundForAssignment)
    async def user_not_found_for_assignment(_, __):
        raise HTTPException(status_code=404, detail="Staff member not found.")

    @app.exception_handler(MatterContactPermissionNotFound)
    async def matter_contact_permission_not_found(_, __):
        raise HTTPException(status_code=404, detail="This contact has no access level set on this matter.")

    @app.exception_handler(ContactNotFoundForMatterPermission)
    async def contact_not_found_for_matter_permission(_, __):
        raise HTTPException(status_code=404, detail="Contact not found for this matter's client.")

    @app.exception_handler(InvalidStatusTransition)
    async def invalid_status_transition(_, __):
        raise HTTPException(status_code=409, detail="This status change isn't allowed from the matter's current status.")

    @app.exception_handler(ApprovalRequiredForTransition)
    async def approval_required_for_transition(_, __):
        raise HTTPException(
            status_code=409,
            detail="This status change requires approval: request approval instead of setting it directly.",
        )

    @app.exception_handler(ApprovalAlreadyPending)
    async def approval_already_pending(_, __):
        raise HTTPException(status_code=409, detail="An approval is already pending for this matter.")

    @app.exception_handler(MatterApprovalNotFound)
    async def matter_approval_not_found(_, __):
        raise HTTPException(status_code=404, detail="Approval request not found.")

    @app.exception_handler(ApprovalAlreadyDecided)
    async def approval_already_decided(_, __):
        raise HTTPException(status_code=409, detail="This approval has already been decided.")

    @app.exception_handler(IntakeSubmissionClientMismatch)
    async def intake_submission_client_mismatch(_, __):
        raise HTTPException(status_code=400, detail="This intake submission doesn't belong to the matter's client.")
    @app.exception_handler(TemplateNotFound)
    async def template_not_found(_, __):
        raise HTTPException(status_code=404, detail="Template not found.")

    @app.exception_handler(UnsupportedFileType)
    async def unsupported_file_type(_, __):
        raise HTTPException(status_code=400, detail="Unsupported file type. Only PDF and Word documents are allowed.")

    @app.exception_handler(TemplateHasNoBody)
    async def template_has_no_body(_, __):
        raise HTTPException(status_code=409, detail="This template has no body to generate from, add one first.")
    @app.exception_handler(ContactNotFound)
    async def contact_not_found(_, __):
        raise HTTPException(status_code=404, detail="Contact not found.")
    @app.exception_handler(StaffInvalidResetToken)
    async def staff_invalid_reset_token(_, __):
        raise HTTPException(status_code=400, detail="This password reset link is invalid or has expired.")

    @app.exception_handler(ClientInvalidResetToken)
    async def client_invalid_reset_token(_, __):
        raise HTTPException(status_code=400, detail="This password reset link is invalid or has expired.")

    @app.exception_handler(MatterDocumentNotFound)
    async def matter_document_not_found(_, __):
        raise HTTPException(status_code=404, detail="Document not found.")  

    @app.exception_handler(StaffInvalidOrExpiredInvite)
    async def invalid_staff_invite(_, __):
        raise HTTPException(status_code=400, detail="This invitation link is invalid or has expired.")

    @app.exception_handler(StaffInviteAlreadyAccepted)
    async def staff_invite_already_accepted(_, __):
        raise HTTPException(status_code=409, detail="This invitation has already been used.")
    @app.exception_handler(StaffNotFound)
    async def staff_not_found(_, __):
        raise HTTPException(status_code=404, detail="Staff member not found.")

    @app.exception_handler(CannotDeactivateSelf)
    async def cannot_deactivate_self(_, __):
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account.")

    @app.exception_handler(ClientHasMatters)
    async def client_has_matters(_, __):
        raise HTTPException(status_code=409, detail="Cannot delete a client that has existing matters.")

    @app.exception_handler(MatterTaskNotFound)
    async def matter_task_not_found(_, __):
        raise HTTPException(status_code=404, detail="Task not found.")

    @app.exception_handler(MatterMessageNotFound)
    async def matter_message_not_found(_, __):
        raise HTTPException(status_code=404, detail="Message not found.")

    @app.exception_handler(CannotDeleteOthersMessage)
    async def cannot_delete_others_message(_, __):
        raise HTTPException(status_code=403, detail="You can only delete your own messages.")

    @app.exception_handler(AnnouncementNotFound)
    async def announcement_not_found(_, __):
        raise HTTPException(status_code=404, detail="Announcement not found.")

    @app.exception_handler(NotificationNotFound)
    async def notification_not_found(_, __):
        raise HTTPException(status_code=404, detail="Notification not found.")

    @app.exception_handler(SignedContractNotFound)
    async def signed_contract_not_found(_, __):
        raise HTTPException(status_code=404, detail="Signed contract not found.")

    @app.exception_handler(FallbackClauseNotFound)
    async def fallback_clause_not_found(_, __):
        raise HTTPException(status_code=404, detail="Fallback clause not found.")

    @app.exception_handler(StaffInvalidRefreshToken)
    async def staff_invalid_refresh_token(_, __):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token.")

    @app.exception_handler(ClientInvalidRefreshToken)
    async def client_invalid_refresh_token(_, __):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token.")

    @app.exception_handler(ClientIncorrectPassword)
    async def client_incorrect_password(_, __):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    @app.exception_handler(StorageUnavailable)
    async def storage_unavailable(_, __):
        raise HTTPException(status_code=503, detail="File storage is temporarily unavailable, please try again shortly.")

    @app.exception_handler(MalwareDetected)
    async def malware_detected(_, __):
        raise HTTPException(status_code=422, detail="This file failed a security scan and was not uploaded.")

    @app.exception_handler(ScannerUnavailable)
    async def scanner_unavailable(_, __):
        raise HTTPException(status_code=503, detail="File security scanning is temporarily unavailable, please try again shortly.")

    @app.exception_handler(IntakeFormNotFound)
    async def intake_form_not_found(_, __):
        raise HTTPException(status_code=404, detail="Intake form not found.")

    @app.exception_handler(IntakeSubmissionNotFound)
    async def intake_submission_not_found(_, __):
        raise HTTPException(status_code=404, detail="Intake submission not found.")

    @app.exception_handler(IntakeAnswerNotFound)
    async def intake_answer_not_found(_, __):
        raise HTTPException(status_code=404, detail="Intake submission answer not found.")

    @app.exception_handler(IntakeFormNotPublished)
    async def intake_form_not_published(_, __):
        raise HTTPException(status_code=404, detail="Intake form not found.")

    @app.exception_handler(MissingRequiredIntakeAnswer)
    async def missing_required_intake_answer(_, __):
        raise HTTPException(status_code=422, detail="One or more required fields were not answered.")

    @app.exception_handler(UnsupportedIntakeFileType)
    async def unsupported_intake_file_type(_, __):
        raise HTTPException(status_code=400, detail="Unsupported or oversized file for this field.")

    @app.exception_handler(KnowledgeArticleNotFound)
    async def knowledge_article_not_found(_, __):
        raise HTTPException(status_code=404, detail="Knowledge article not found.")

    @app.exception_handler(SignatureRequestNotFound)
    async def signature_request_not_found(_, __):
        raise HTTPException(status_code=404, detail="Signature request not found.")

    @app.exception_handler(InvalidSignatureRecipient)
    async def invalid_signature_recipient(_, __):
        raise HTTPException(status_code=400, detail="One or more recipients are invalid for this matter.")

    @app.exception_handler(SigningProviderUnavailable)
    async def signing_provider_unavailable(_, __):
        raise HTTPException(
            status_code=503,
            detail="The e-signature service is temporarily unavailable, please try again shortly.",
        )