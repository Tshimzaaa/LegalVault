class InvalidCredentials(Exception):
    pass


class OrganizationAlreadyExists(Exception):
    pass


class UserAlreadyExists(Exception):
    pass


class InactiveUser(Exception):
    pass

class InsufficientPermissions(Exception):
    pass
class InvalidOrExpiredResetToken(Exception):
    pass

class InvalidOrExpiredInvite(Exception):
    pass

class InviteAlreadyAccepted(Exception):
    pass
class StaffNotFound(Exception):
    pass

class CannotDeactivateSelf(Exception):
    pass

class InvalidRefreshToken(Exception):
    pass