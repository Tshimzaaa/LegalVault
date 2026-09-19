# LegalVault

A multi-tenant SaaS platform for law firm practice management, working name "LegalVault" (product-positioned against lighthub.law). FastAPI backend + React frontend.

Two tiers of users, each with its own auth system and JWT token type:

1. **SaaS Owner**: onboards law firms onto the platform, activates/suspends firms
2. **Firm Staff**: admins, lawyers, paralegals, secretaries, receptionists who manage contracts and firm operations

A third tier, **Firm Clients** (a restricted client-facing portal), existed earlier in the project but was deliberately removed as part of a "corporate pivot" (see git history: "Phase 3 of corporate pivot: drop the client tier, merge portals"). Anything below that still references clients/matters as a live concept is describing the pre-pivot design, not the current app.

See [`backend/docs/architecture.md`](backend/docs/architecture.md) for the original design doc (staff/client auth, schema, RLS setup; it predates the pivot and several modules listed below, and hasn't been kept current) and [`ROADMAP.md`](ROADMAP.md) for a feature-parity comparison against lighthub.law (also out of date as of this edit; treat both as historical context, not a live spec). See [`DEPLOYMENT.md`](DEPLOYMENT.md) before deploying anywhere beyond local dev.

---

## Tech stack

**Backend**
- FastAPI (Python), SQLAlchemy ORM, Alembic migrations
- PostgreSQL, local via Docker (`docker-compose.yml`) for dev — moved off Neon as part of the corporate pivot, see the `db` service comments — with row-level security as a defense-in-depth layer on top of application-level firm scoping
- Cloudflare R2 (S3-compatible object storage) for templates and contract documents
- JWT auth (PyJWT) with argon2id password hashing (pwdlib), rate limiting via slowapi, refresh tokens for staff sessions
- ClamAV (`clamd`) for malware scanning on uploads
- Documenso (self-hosted, via `documenso_sdk`) for e-signature requests and signing webhooks
- Celery + Redis for scheduled background jobs (contract due-date and expiry reminders; see `app/tasks/`)
- `xhtml2pdf` for generating draft documents from a template body + intake-submission answers (pure-Python HTML→PDF: WeasyPrint was tried first per the original tech plan, but its native Pango/GObject dependency doesn't install on Windows dev machines)
- `sentry-sdk` for error tracking (optional, no-op unless `SENTRY_DSN` is set; see `app/main.py`)
- pytest, run in CI against a real Postgres service container (including a restricted, non-`BYPASSRLS` role so row-level security is actually exercised)

**Frontend**
- React 19 + TypeScript, Vite
- `@sentry/react` for error tracking (optional, no-op unless `VITE_SENTRY_DSN` is set; see `main.tsx`)
- vitest + Testing Library for tests, oxlint for linting

**CI/CD** (`.github/workflows/ci.yml`): backend job runs Alembic migrations + pytest against Postgres; frontend job runs oxlint, vitest, and a production build. Both run on every PR and push to `main`. On `main`, once both pass, a `deploy` job triggers Render deploy hooks for the API, Celery worker, and frontend static site (see `render.yaml` and `DEPLOYMENT.md` §5/§6). Nothing deploys on a push that doesn't pass CI first.

---

## Project structure

```
backend/
  app/
    core/              config, security, storage, rate limiter, exception handlers
    database/          SQLAlchemy session/engine setup, row-level-security tenant context
    exceptions/        domain exceptions
    tasks/             Celery app + scheduled reminder jobs (contract due-date, expiry)
    modules/
      auth/              staff register/login, refresh tokens, staff invites, password reset
      contracts/         contracts, staff assignments, tasks, messages, per-contract documents,
                         status transition rules + an approval gate on the two sensitive transitions
                         (awaiting_signature -> signed, signed -> closed)
      templates/         firm-wide document templates (upload/list/download); a template can also
                         carry an editable {{placeholder}} body used to generate a draft contract
                         document from an intake submission's answers
      signed_contracts/  contract records (value, counterparty, expiry) separate from templates
      signatures/        e-signature requests via Documenso + webhook handling
      intake/            customizable intake forms + submissions (staff-facing only — any staff
                         member can submit, e.g. on behalf of a walk-in or over the phone; only
                         admin/lawyer can build/edit forms)
      knowledge/         firm knowledge-base articles (staff-authored)
      integrations/      firm-configured third-party integration connections
      announcements/     firm-wide announcements (staff-authored)
      notifications/     in-app notifications
      audit/             audit log of who changed what, when
      search/            cross-entity search — real Postgres full-text (tsvector + GIN expression
                         indexes), not substring matching
      dashboard/         staff dashboard summary metrics
      reporting/         staff workload, status breakdown, task/deadline aggregates, CSV export
      monitoring/        request logging middleware + system-health/error metrics
      owner/             SaaS-owner console: firm management, activation
      ai_assistant/      "Learned Friend" AI assistant conversations (Ollama-backed, see backend/.env)
  alembic/             migrations
  tests/               pytest suite (auth, contracts, RLS, multi-tenant isolation, malware
                       scanning, force-logout, audit log, notifications, reporting/search, etc.)
  docs/                architecture.md (original design doc, see staleness note above)

frontend/
  src/
    api/               typed API clients, one per backend module
    components/        shared UI (login modal, footer, notification bell, icons)
    pages/              one folder per route (see below)
```

### Frontend pages

| Area | Pages |
|---|---|
| Marketing | `Home`, `About`, `Blog`, `Pricing`, `Contact` |
| Staff app | `Dashboard`, `Contracts`, `ContractDetail`, `NewContract`, `Templates`, `Staff`, `Workflow`, `Reporting`, `SignedContracts`, `IntakeFormBuilder`, `IntakeSubmissions`, `KnowledgeArticles`, `FallbackClauses`, `Integrations`, `AuditLog`, `Calendar`, `Search`, `Settings`, `LearnedFriend`, `Workspace` |
| Auth / onboarding | `Register`, `AcceptStaffInvite`, `ResetPassword` |
| SaaS owner console | `OwnerLogin`, `OwnerPortal` |
| Legal | `legal/` (terms, privacy, etc.) |

There is no client-portal page tier in the frontend anymore, matching the backend's removal of the client-tier modules. (Two leftover empty backend directories, `app/modules/clients/` and `app/modules/client_dashboard/`, still exist on disk — only stale `__pycache__` inside, no source, no router registered in `app/main.py` — dead weight from that removal, safe to delete.) Not every page here is necessarily wired to live data end-to-end. Check the corresponding `frontend/src/api/*.ts` client and backend module before assuming a page is real or mock; the module list above reflects what the backend actually supports as of this edit.

---

## Running locally

**Backend**
```
cd backend
pip install -r requirements.txt
# configure .env — see app/core/config.py for required vars (DB URL, SECRET_KEY, REGISTER_SECRET,
# OWNER_SECRET, R2 credentials, RUNTIME_DATABASE_URL for RLS, CLAMD_HOST/PORT, DOCUMENSO_API_KEY, etc.)
alembic upgrade head
uvicorn app.main:app --reload
```

**Frontend**
```
cd frontend
npm install
npm run dev
```

The frontend dev server expects the API at the CORS origin configured in `backend/app/main.py` (`http://localhost:5173` by default).

**Supporting services** (`docker-compose.yml`, needed for malware scanning, e-signature, and background jobs): ClamAV, a self-hosted Documenso instance (+ its own Postgres), and Redis. Run `docker compose up`, then see the comments in `docker-compose.yml` for the one-time Documenso API token / webhook setup.

**Background jobs**: contract due-date and expiry reminders run as scheduled Celery tasks (`backend/app/tasks/`) against the Redis broker started above. Run a combined worker + beat process locally:
```
cd backend && celery -A app.tasks.celery_app worker --beat --loglevel=info
```
Production should run the worker and beat scheduler as separate long-running processes instead. See `DEPLOYMENT.md`. Only one beat scheduler should ever run at a time; running more than one duplicates every scheduled job.

**Tests**
```
cd backend && python -m pytest      # needs a Postgres instance — see .github/workflows/ci.yml for setup
cd frontend && npm test
```

---

## Known gaps

- **Real email sending**: invite links and notification emails are still stubbed (printed to the server console); no email provider is wired up yet (nothing email-related in `backend/requirements.txt`).
- **Deploy pipeline defined but not yet run for real**: host is Render (`render.yaml`), and `ci.yml`'s `deploy` job is CI-gated and ready, but the Blueprint hasn't been created in an actual Render account (no credentials available to do that from here) and `render.yaml` hasn't been validated by a real Blueprint sync. See [`DEPLOYMENT.md`](DEPLOYMENT.md) §5/§6 for the remaining manual setup steps.
- Frontend automated test coverage is thin relative to the number of pages: most pages have no test file yet.
