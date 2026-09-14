-- Runs once, on first boot of the `db` container (empty data dir), as the POSTGRES_USER
-- superuser against POSTGRES_DB. Creates the restricted role the app connects as for
-- normal request traffic (RUNTIME_DATABASE_URL in backend/.env) — a Postgres superuser or
-- table owner always bypasses row-level security, so RLS only means anything if the app
-- runs as a separate, unprivileged role. Mirrors the role the CI workflow creates
-- (.github/workflows/ci.yml), except default privileges are used here instead of a
-- one-off GRANT, so tables Alembic creates later are automatically covered.

CREATE ROLE app_runtime WITH LOGIN PASSWORD 'app_runtime_dev_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

GRANT CONNECT ON DATABASE legalvault TO app_runtime;
GRANT USAGE ON SCHEMA public TO app_runtime;

ALTER DEFAULT PRIVILEGES FOR ROLE legalvault IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE legalvault IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;
