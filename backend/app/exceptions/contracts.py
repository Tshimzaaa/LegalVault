class ContractNotFound(Exception):
    pass

class StaffAlreadyAssigned(Exception):
    pass

class UserNotFoundForAssignment(Exception):
    pass

class ContractDocumentNotFound(Exception):
    pass

class ContractTaskNotFound(Exception):
    pass

class ContractMessageNotFound(Exception):
    pass

class CannotDeleteOthersMessage(Exception):
    pass

class InvalidStatusTransition(Exception):
    pass

class ApprovalRequiredForTransition(Exception):
    pass

class ApprovalAlreadyPending(Exception):
    pass

class ContractApprovalNotFound(Exception):
    pass

class ApprovalAlreadyDecided(Exception):
    pass