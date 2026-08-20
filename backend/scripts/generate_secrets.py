"""
Generates real values for every secret-shaped setting in app/core/config.py, so a production
deploy never reuses a dev .env's "change-me" placeholders. Prints .env-format lines to stdout —
review them, then paste into your actual secret store (not into git).

Usage: python backend/scripts/generate_secrets.py
"""
import secrets

from cryptography.fernet import Fernet


def main() -> None:
    print("# Generated secrets -- copy into your production .env / secret manager, don't commit them.")
    print(f"SECRET_KEY={secrets.token_urlsafe(48)}")
    print(f"REGISTER_SECRET={secrets.token_urlsafe(32)}")
    print(f"OWNER_SECRET={secrets.token_urlsafe(32)}")
    print(f"ENCRYPTION_KEY={Fernet.generate_key().decode()}")
    print(f"DOCUMENSO_WEBHOOK_SECRET={secrets.token_urlsafe(32)}")
    print()
    print("# DOCUMENSO_API_KEY is NOT generated here -- create it in the Documenso admin UI")
    print("# (Settings -> API Tokens) once that instance is running, per docker-compose.yml.")
    print("# RUNTIME_DATABASE_URL's password: see scripts/print_runtime_role_sql.py.")


if __name__ == "__main__":
    main()
