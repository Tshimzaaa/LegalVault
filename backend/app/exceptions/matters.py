class MatterNotFound(Exception):
    pass

class ClientNotFoundForMatter(Exception):
    pass

class StaffAlreadyAssigned(Exception):
    pass

class UserNotFoundForAssignment(Exception):
    pass

class MatterDocumentNotFound(Exception):
    pass

class MatterTaskNotFound(Exception):
    pass

class MatterMessageNotFound(Exception):
    pass

class CannotDeleteOthersMessage(Exception):
    pass

class MatterContactPermissionNotFound(Exception):
    pass

class ContactNotFoundForMatterPermission(Exception):
    pass

class InvalidStatusTransition(Exception):
    pass

class ApprovalRequiredForTransition(Exception):
    pass

class ApprovalAlreadyPending(Exception):
    pass

class MatterApprovalNotFound(Exception):
    pass

class ApprovalAlreadyDecided(Exception):
    pass

class IntakeSubmissionClientMismatch(Exception):
    pass