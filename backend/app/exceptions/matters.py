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