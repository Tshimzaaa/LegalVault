"""
Prints the exact SQL to create the restricted `app_runtime` Postgres role that
RUNTIME_DATABASE_URL must point at in production (see backend/docs/architecture.md's
"Row-level security" section for the full explanation of why this role has to exist
separately from the migration-owner role).

Run the printed SQL against your production database as the owner role (the same role
DATABASE_URL uses), then set RUNTIME_DATABASE_URL to a connection string using the
app_runtime user/password instead.

Usage:
    python backend/scripts/print_runtime_role_sql.py --database neondb --owner-role neondb_owner
"""
import argparse
import secrets


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True, help="The Postgres database name (e.g. from your Neon connection string).")
    parser.add_argument(
        "--owner-role",
        required=True,
        help="The owner role DATABASE_URL connects as (e.g. Neon's '<project>_owner') — the role that will own future migrations.",
    )
    parser.add_argument(
        "--password",
        default=None,
        help="Password for the new app_runtime role. Omit to generate a random one.",
    )
    args = parser.parse_args()

    password = args.password or secrets.token_urlsafe(24)

    print(f"""-- Run as {args.owner_role} against the "{args.database}" database.
CREATE ROLE app_runtime WITH LOGIN PASSWORD '{password}'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

GRANT CONNECT ON DATABASE {args.database} TO app_runtime;
GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;

-- So tables added by future migrations (run as {args.owner_role}) are automatically
-- usable by app_runtime without a manual grant each time.
ALTER DEFAULT PRIVILEGES FOR ROLE {args.owner_role} IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE {args.owner_role} IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;
""")
    print(f"# RUNTIME_DATABASE_URL=postgresql://app_runtime:{password}@<host>/{args.database}")


if __name__ == "__main__":
    main()
