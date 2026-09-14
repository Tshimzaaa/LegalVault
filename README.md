# LegalVault

A multi-tenant SaaS platform for law firm practice management, working name "LegalVault" (product-positioned against lighthub.law). FastAPI backend + React frontend.

Three tiers of users, each with its own auth system and JWT token type:

1. **SaaS Owner**: onboards law firms onto the platform, activates/suspends firms
2. **Firm Staff**: lawyers, admins, paralegals, secretaries, receptionists who manage clients/matters
3. **Firm Clients**: the firm's own clients, who log into a restricted portal to view case status, documents, templates, intake forms, and the knowledge base

See [`backend/docs/architecture.md`](backend/docs/architecture.md) for the original design doc (staff/client auth, schema, RLS setup; note it predates several modules listed below and hasn't been kept current) and [`ROADMAP.md`](ROADMAP.md) for a feature-parity comparison against lighthub.law (also out of date as of this edit; treat both as historical context, not a live spec). See [`DEPLOYMENT.md`](DEPLOYMENT.md) before deploying anywhere beyond local dev.

---

## Tech stack

**Backend**
- FastAPI (Python), SQLAlchemy ORM, Alembic migrations
- PostgreSQL (hosted on Neon, serverless), with row-level security as a defense-in-depth layer on top of application-level firm scoping
- Cloudflare R2 (S3-compatible object storage) for templates and matter/contract documents
- JWT auth (PyJWT) with argon2id password hashing (pwdlib), rate limiting via slowapi, refresh tokens for staff sessions
- ClamAV (`clamd`) for malware scanning on uploads
- Documenso (self-hosted, via `documenso_sdk`) for e-signature requests and signing webhooks
- Celery + Redis for scheduled background jobs (matter due-date and contract expiry reminders; see `app/tasks/`)
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
    tasks/             Celery app + scheduled reminder jobs (matter due-date, contract expiry)
    modules/
      auth/              staff register/login, refresh tokens, staff invites, password reset
      clients/           client companies, contact invites, client-portal auth
      matters/           matters (cases), assignments, tasks, messages, per-matter documents, calendar,
                         status transition rules + an approval gate on the two sensitive transitions
      templates/         firm-wide document templates (upload/list/download); a template can also
                         carry an editable {{placeholder}} body used to generate a draft matter
                         document from an intake submission's answers
      signed_contracts/  contract records (value, counterparty, expiry) separate from templates
      signatures/        e-signature requests via Documenso + webhook handling
      intake/            customizable client intake forms + submissions
      knowledge/         firm knowledge-base articles (staff-authored, client-readable)
      integrations/      firm-configured third-party integration connections
      support_requests/  client support ticket submission + staff triage
      announcements/     firm-wide announcements (staff-authored, client-visible)
      notifications/     in-app notifications
      audit/             audit log of who changed what, when
      search/            cross-entity search (clients, contacts, matters, documents) — real Postgres
                         full-text (tsvector + GIN expression indexes), not substring matching
      dashboard/         staff dashboard summary metrics
      client_dashboard/  client-portal dashboard summary
      reporting/         staff workload, status breakdown, task/deadline aggregates, CSV export
      monitoring/        request logging middleware + system-health/error metrics
      owner/             SaaS-owner console: firm management, activation
  alembic/             migrations
  tests/               pytest suite (auth, clients, matters, RLS, multi-tenant isolation, malware
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
| Marketing | `Home`, `About`, `Blog`, `Resources`, `Contact` |
| Staff app | `Dashboard`, `Matters`, `MatterDetail`, `NewMatter`, `Clients`, `Templates`, `Staff`, `Workflow`, `Reporting`, `MatterAdmin`, `SignedContracts`, `ContractData`, `IntakeFormBuilder`, `IntakeSubmissions`, `KnowledgeArticles`, `Integrations`, `AuditLog`, `Calendar`, `Search`, `Settings`, `SupportRequests`, `LearnedFriend`, `LegalVaultGuide` |
| Client portal | `ClientPortal`, `ClientDashboard`, `ClientMatterDetail`, `ClientWorkflow`, `ClientTemplates`, `ClientReporting`, `ClientSignedContracts`, `ClientIntakeForms`, `ClientMyIntakeSubmissions`, `ClientKnowledgeBase`, `ClientAccountSettings`, `Workspace` |
| Auth / onboarding | `AuthPage`, `Register`, `AcceptInvite` (client), `AcceptStaffInvite`, `ResetPassword` |
| SaaS owner console | `OwnerLogin`, `OwnerPortal` |

Not every page here is necessarily wired to live data end-to-end. Check the corresponding `frontend/src/api/*.ts` client and backend module before assuming a page is real or mock; the module list above reflects what the backend actually supports as of this edit.

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

**Background jobs**: matter due-date and contract expiry reminders run as scheduled Celery tasks (`backend/app/tasks/`) against the Redis broker started above. Run a combined worker + beat process locally:
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
