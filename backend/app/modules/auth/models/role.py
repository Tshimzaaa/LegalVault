from enum import Enum

class UserRole(str, Enum):
    ADMIN = "admin"
    LAWYER = "lawyer"
    PARALEGAL = "paralegal"
    SECRETARY = "secretary"
    RECEPTIONIST = "receptionist"