class ClientNotFound(Exception):
    pass

class ContactAlreadyExists(Exception):
    pass

class InvalidOrExpiredInvite(Exception):
    pass

class InviteAlreadyAccepted(Exception):
    pass

class InvalidClientCredentials(Exception):
    pass

class InactiveContact(Exception):
    pass
class ContactNotFound(Exception):
    pass
class InvalidOrExpiredResetToken(Exception):
    pass