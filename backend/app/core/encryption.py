from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings
from app.exceptions.encryption import DecryptionFailed

_fernet = Fernet(settings.ENCRYPTION_KEY.encode())


def encrypt(plaintext: str) -> str:
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    try:
        return _fernet.decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise DecryptionFailed() from exc
