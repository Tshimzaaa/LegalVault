# LegalVault Backend: Architecture & Feature Documentation

> **Stale — historical context only.** This doc predates the "corporate pivot" (see
> git history) that removed the Firm Clients tier entirely and renamed matters to
> contracts. The three-tier model, client portal, and `matters`/`clients` modules
> described below no longer exist in the codebase. See the top-level
> [`README.md`](../../README.md) for the current two-tier design and module list.

## Overview

LegalVault is a multi-tenant SaaS platform for law firm practice management. 
The system has three tiers of users:

1. **SaaS Owner (you)**: onboards law firms onto the platform
2. **Firm Staff**: lawyers, admins, paralegals, secretaries who work at a 
   registered law firm and manage cases/clients
3. **Firm Clients**: the law firm's own clients (e.g. a company like 
   "Mike Motors") who log into a restricted client portal to view case 
   status and download templates

Each tier has its own authentication system, its own JWT token type, and 
strict data isolation: a firm cannot see another firm's data, and a 
client cannot access staff-only endpoints or vice versa.

---

## Tech Stack

- **Backend:** FastAPI (Python)
- **Database:** PostgreSQL, hosted on Neon (serverless Postgres)
- **ORM:** SQLAlchemy
- **Migrations:** Alembic
- **File Storage:** Cloudflare R2 (S3-compatible object storage)
- **Auth:** JWT (PyJWT), password hashing via pwdlib (argon2id)
- **Rate limiting:** slowapi

---

## Database Schema

### `law_firms`
The paying tenant. Represents one law firm (e.g. "Pearson Attorneys").

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | string | |
| email | string | Unique |
| phone | string | Nullable |
| website | string | Nullable |
| address | string | Nullable |
| is_active | boolean | |
| created_at / updated_at | timestamp | |

### `users`
Firm staff: lawyers, admins, paralegals, secretaries, receptionists.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| firm_id | UUID | FK → law_firms.id |
| first_name / last_name | string | |
| email | string | Unique |
| password_hash | string | argon2id |
| role | enum | admin, lawyer, paralegal, secretary, receptionist |
| is_active | boolean | |
| last_login | timestamp | Nullable |
| created_at / updated_at | timestamp | |

### `clients`
A law firm's own client company (e.g. "Mike Motors").

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| firm_id | UUID | FK → law_firms.id |
| company_name | string | |
| is_active | boolean | |
| created_at / updated_at | timestamp | |

### `client_contacts`
Individual people who can log into the client portal on behalf of a client 
company. One client can have multiple contacts, each with separate login 
credentials (for audit purposes: separate logins allow tracking who did what).

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| client_id | UUID | FK → clients.id |
| first_name / last_name | string | |
| email | string | Unique |
| password_hash | string | Nullable until invite accepted |
| is_active | boolean | |
| invitation_status | string | "pending" or "accepted" |
| invitation_token | string | Nullable, unique, cleared after acceptance |
| invitation_expires_at | timestamp | 48-hour expiry from invite/resend |
| last_login | timestamp | Nullable |
| created_at / updated_at | timestamp | |

### `matters`
A case/contract the firm is handling for a client.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| firm_id | UUID | FK → law_firms.id |
| client_id | UUID | FK → clients.id |
| title | string | |
| description | text | Nullable |
| status | enum | intake, in_progress, closed |
| is_visible_to_client | boolean | Default false: staff toggles this on when ready to share with the client |
| created_at / updated_at | timestamp | |

### `matter_assignments`
Many-to-many junction: multiple staff members can be assigned to one matter, 
each with their own role.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| matter_id | UUID | FK → matters.id |
| user_id | UUID | FK → users.id |
| role_on_matter | enum | lead_lawyer, paralegal, secretary, reviewer |
| created_at / updated_at | timestamp | |

### `templates`
Document templates (NDAs, contracts, etc.) that firm staff upload and 
clients can download.

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| firm_id | UUID | FK → law_firms.id |
| title | string | |
| description | string | Nullable |
| category | string | e.g. "NDA", "Employment Contract" |
| file_key | string | Internal R2 storage path (never exposed to frontend) |
| original_filename | string | |
| content_type | string | Validated on upload (PDF, Word, plain text) |
| created_at / updated_at | timestamp | |

---

## Authentication System

### Two separate JWT token types

Staff tokens and client tokens are cryptographically distinguishable. 
Client tokens carry an explicit `"type": "client"` claim; staff tokens do 
not. Each side's auth dependency (`get_current_user` for staff, 
`get_current_contact` for clients) checks for this and rejects tokens that 
don't match. This was confirmed via testing that neither token type can be used 
on the other's protected routes.

### Staff auth flow
- `POST /auth/register`: creates a law firm + its first admin user in one 
  call. **Gated** behind a shared secret (`admin_secret` in the request 
  body, checked against `REGISTER_SECRET` in environment config) since 
  only the SaaS owner should be able to onboard new firms. `REGISTER_SECRET` 
  is deliberately a *different* value from `OWNER_SECRET` (below). This 
  secret only unlocks "create one new firm," so it can be handed to an 
  onboarding flow without also handing out full owner access to every 
  existing firm's data.
- `POST /auth/login`: email + password → JWT. Rate limited to 5 
  attempts/minute per IP.
- `GET /auth/me`: returns the logged-in staff member's own profile.
- `GET /auth/users`: lists all staff at the logged-in user's own firm 
  (used to populate "assign staff" dropdowns).

### Client (portal) auth flow: invitation-based, not self-registration
Clients cannot sign up on their own. The flow is:
1. Firm staff creates a `Client` record (the company).
2. Firm staff invites a `ClientContact` (an individual person) via 
   `POST /clients/{client_id}/contacts`. This generates a unique 
   `invitation_token` (48-hour expiry) and, currently, prints a stub 
   invite link to the server console (real email sending via SendGrid is 
   not yet integrated).
3. The contact visits the invite link and submits a password via 
   `POST /client-auth/accept-invite`, which sets their password and 
   flips `invitation_status` to "accepted".
4. From then on, the contact logs in normally via `POST /client-auth/login` 
   (also rate limited to 5/minute).
5. If an invite expires before being accepted, staff can resend it via 
   `POST /clients/contacts/resend-invite`, which generates a fresh token 
   and 48-hour window.

### Firm-scoping and cross-tenant isolation
Every staff-facing endpoint pulls `firm_id` from the authenticated user's 
own token, never from a client-supplied parameter. This was specifically 
fixed after an early version allowed `firm_id` to be passed as an open 
query parameter (a real vulnerability, caught and corrected before any 
real use).

Cross-firm isolation has been manually tested with two independent real 
firms (Okafor Legal and Delacroix & Partners): staff at one firm 
consistently receive `404 Not Found` (not `403`) when attempting to 
access another firm's clients or matters. This is deliberate, so the 
system never confirms that another firm's resource even exists.

---

## Matters Feature

Staff can create matters, list them, view details, update status, toggle 
client visibility, and assign multiple staff members with distinct roles.

**Key endpoints:**
- `POST /matters`: create (client_id must belong to the caller's own firm)
- `GET /matters`: list all matters for the caller's firm
- `GET /matters/{id}`: get one (404 if not found or wrong firm)
- `PATCH /matters/{id}/status`: update status
- `PATCH /matters/{id}/visibility`: toggle client visibility
- `POST /matters/{id}/assignments`: assign a staff member with a role
- `GET /matters/{id}/assignments`: list who's assigned

The `is_visible_to_client` flag is the bridge to the client portal: when 
true, the matter is intended to become visible to the client (client-side 
matter viewing is not yet built as of this writing; the flag exists and 
is toggleable, but no client-facing "list my matters" endpoint has been 
built yet).

---

## Templates Feature

Firm staff upload document templates (PDF, Word, or plain text, max 10MB) 
which are stored in Cloudflare R2. Both staff and clients can list and 
download templates belonging to their own firm.

**Staff endpoints:**
- `POST /templates`: upload (multipart form: title, description, 
  category, file)
- `GET /templates`: list firm's templates
- `GET /templates/{id}/download`: get a signed, time-limited (1 hour) 
  download URL

**Client-facing endpoints:**
- `GET /client-templates`: list templates belonging to the client's own firm
- `GET /client-templates/{id}/download`: signed download URL

Files are never made public directly: R2 bucket public access is 
disabled, and all downloads go through signed URLs generated per-request, 
scoped to the requester's own firm.

---

## Infrastructure

### Database: Neon (PostgreSQL)
Originally developed against a local Postgres instance, tunneled between 
two developers' machines via ngrok for testing. Migrated to Neon (a 
managed, always-on Postgres provider) to remove the dependency on either 
developer's laptop staying online, and to avoid the security exposure of 
a public database tunnel.

**Known behavior:** Neon's free tier auto-suspends idle connections. 
The first query after a period of inactivity can fail with 
`OperationalError: server closed the connection unexpectedly`. Fixed by 
adding `pool_pre_ping=True` to the SQLAlchemy engine, which transparently 
tests and refreshes stale connections before use.

### File storage: Cloudflare R2
Chosen over AWS S3 for this project due to R2's more generous free tier 
and zero egress fees (relevant since clients will repeatedly download 
templates). Standard storage class is used (not Infrequent Access, which 
has no free tier and is meant for rarely-accessed archival data).

### Rate limiting
`slowapi` is used to limit login attempts to 5/minute per IP on both 
`/auth/login` and `/client-auth/login`, as basic brute-force protection.

### Environment-based safety checks
`app/core/config.py` checks `ENVIRONMENT` on startup. If set to 
`"production"`, the app refuses to start if `SECRET_KEY`, `REGISTER_SECRET`, 
or `OWNER_SECRET` are still set to placeholder values, or if `OWNER_SECRET` 
equals `REGISTER_SECRET`: these safeguard against accidentally deploying with 
default secrets or collapsing the owner/registration trust boundary back 
into one shared value. The same check also requires `RUNTIME_DATABASE_URL` 
to be set (see below). Without it, RLS is silently a no-op in production.

### Row-level security (defense in depth)
Every tenant-data table (`clients`, `matters`, `templates`, 
`signed_contracts`, `support_requests`, `audit_logs`, and the matter-child 
tables) has Postgres row-level security enabled as a second, DB-level 
enforcement layer on top of the application-level `firm_id` filtering that 
already exists in every repository (see the `add_row_level_security` 
Alembic migration for the exact policies). `users`, `law_firms`, and 
`client_contacts` are deliberately excluded (see that migration's docstring) 
since staff/client login and invite-acceptance have to look someone up with 
no firm context yet.

**This requires a second, restricted database role.** Postgres RLS, even 
with `FORCE ROW LEVEL SECURITY`, has no effect on a role with the 
`BYPASSRLS` attribute, and Neon's default project-owner role (e.g. 
`neondb_owner`) has it. That role stays the migration-time connection 
(`DATABASE_URL`, which needs to own the tables to run `ALTER TABLE`/
`CREATE POLICY`), while the app's actual request-serving connection 
(`RUNTIME_DATABASE_URL`) must be a separate role without `BYPASSRLS`. Set up 
once per database (dev/staging/production each need their own), run as the 
owner role:

```sql
CREATE ROLE app_runtime WITH LOGIN PASSWORD '<a real generated password>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

GRANT CONNECT ON DATABASE neondb TO app_runtime;
GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;

-- so tables added by future migrations (run as the owner role) are
-- automatically usable by app_runtime without a manual grant each time
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;
```

Then set `RUNTIME_DATABASE_URL` to a connection string using `app_runtime` 
instead of the owner role (same host/database, different user/password). 
Session-local tenant context (`app.current_firm_id`, `app.is_owner`) is set 
per-request by `app/database/rls.py`'s `set_tenant_context()`, called from 
`get_current_user`, `get_current_contact`, and `get_current_owner` once each 
has resolved who's making the request.

---

## Known Gaps / Not Yet Built

- **Real email sending**: SendGrid integration is planned but not yet 
  implemented; invitation emails are currently stubbed (printed to 
  server console).
- **Client-facing "view my matters" endpoint**: the `is_visible_to_client` 
  flag exists and works, but no endpoint yet lets a client actually 
  retrieve their own visible matters.
- **HTTPS**: not yet relevant since the system is still in local 
  development; must be addressed before any public deployment.
- **Refresh tokens**: access tokens currently expire after 24 hours 
  (staff) with no refresh mechanism; users must log in again after expiry.
- **No "list matter assignments" pagination**: fine at current scale, 
  would need revisiting if a firm has many staff/matters.

---

## Testing Approach

Every feature in this document was manually tested via curl/Swagger UI 
before being considered complete, including:
- Happy-path success cases
- Duplicate-prevention (e.g. duplicate firm/user emails on registration)
- Cross-tenant isolation (two independent real firms, confirmed neither 
  can access the other's data)
- Token-type isolation (staff tokens rejected on client routes and vice 
  versa)
- Rate limiting (confirmed 6th rapid login attempt returns 429)
- File upload/download round-trip (confirmed actual file content is 
  retrievable after upload)

No formal automated test suite exists yet. All testing to date has been 
manual, endpoint-by-endpoint.