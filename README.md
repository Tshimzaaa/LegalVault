# LegalHub

A multi-tenant SaaS platform for law firm practice management — working name "LegalHub" (product-positioned against lighthub.law). FastAPI backend + React frontend.

Three tiers of users, each with its own auth system and JWT token type:

1. **SaaS Owner** — onboards law firms onto the platform, activates/suspends firms
2. **Firm Staff** — lawyers, admins, paralegals, secretaries, receptionists who manage clients/matters
3. **Firm Clients** — the firm's own clients, who log into a restricted portal to view case status, documents, templates, intake forms, and the knowledge base

See [`backend/docs/architecture.md`](backend/docs/architecture.md) for the original design doc (staff/client auth, schema, RLS setup — note it predates several modules listed below and hasn't been kept current) and [`ROADMAP.md`](ROADMAP.md) for a feature-parity comparison against lighthub.law (also out of date as of this edit — treat both as historical context, not a live spec).

---

## Tech stack

**Backend**
- FastAPI (Python), SQLAlchemy ORM, Alembic migrations
- PostgreSQL (hosted on Neon, serverless), with row-level security as a defense-in-depth layer on top of application-level firm scoping
- Cloudflare R2 (S3-compatible object storage) for templates and matter/contract documents
- JWT auth (PyJWT) with argon2id password hashing (pwdlib), rate limiting via slowapi, refresh tokens for staff sessions
- ClamAV (`clamd`) for malware scanning on uploads
- Documenso (self-hosted, via `documenso_sdk`) for e-signature requests and signing webhooks
- pytest, run in CI against a real Postgres service container (including a restricted, non-`BYPASSRLS` role so row-level security is actually exercised)

**Frontend**
- React 19 + TypeScript, Vite
- vitest + Testing Library for tests, oxlint for linting

**CI** (`.github/workflows/ci.yml`): backend job runs Alembic migrations + pytest against Postgres; frontend job runs oxlint, vitest, and a production build — both on every PR and push to `main`.

---

## Project structure

```
backend/
  app/
    core/              config, security, storage, rate limiter, exception handlers
    database/          SQLAlchemy session/engine setup, row-level-security tenant context
    exceptions/        domain exceptions
    modules/
      auth/              staff register/login, refresh tokens, staff invites, password reset
      clients/           client companies, contact invites, client-portal auth
      matters/           matters (cases), assignments, tasks, messages, per-matter documents, calendar
      templates/         firm-wide document templates (upload/list/download)
      signed_contracts/  contract records (value, counterparty, expiry) separate from templates
      signatures/        e-signature requests via Documenso + webhook handling
      intake/            customizable client intake forms + submissions
      knowledge/         firm knowledge-base articles (staff-authored, client-readable)
      integrations/      firm-configured third-party integration connections
      support_requests/  client support ticket submission + staff triage
      announcements/     firm-wide announcements (staff-authored, client-visible)
      notifications/     in-app notifications
      audit/             audit log of who changed what, when
      search/            cross-entity search (clients, contacts, matters, documents)
      dashboard/         staff dashboard summary metrics
      client_dashboard/  client-portal dashboard summary
      reporting/         staff workload, status breakdown, task/deadline aggregates, CSV export
      monitoring/        request logging middleware + system-health/error metrics
      owner/             SaaS-owner console: firm management, activation
  alembic/             migrations
  tests/               pytest suite (auth, clients, matters, RLS, multi-tenant isolation, malware
                       scanning, force-logout, audit log, notifications, reporting/search, etc.)
  docs/                architecture.md (original design doc — see staleness note above)

frontend/
  src/
    api/               typed API clients, one per backend module
    components/        shared UI (login modal, footer, notification bell, icons)
    pages/              one folder per route — see below
```

### Frontend pages

| Area | Pages |
|---|---|
| Marketing | `Home`, `About`, `Blog`, `Resources`, `Contact` |
| Staff app | `Dashboard`, `Matters`, `MatterDetail`, `NewMatter`, `Clients`, `Templates`, `Staff`, `Workflow`, `Reporting`, `MatterAdmin`, `SignedContracts`, `ContractData`, `IntakeFormBuilder`, `IntakeSubmissions`, `KnowledgeArticles`, `Integrations`, `AuditLog`, `Calendar`, `Search`, `Settings`, `SupportRequests`, `LearnedFriend`, `LightHubGuide` |
| Client portal | `ClientPortal`, `ClientDashboard`, `ClientMatterDetail`, `ClientWorkflow`, `ClientTemplates`, `ClientReporting`, `ClientSignedContracts`, `ClientIntakeForms`, `ClientMyIntakeSubmissions`, `ClientKnowledgeBase`, `ClientAccountSettings`, `Workspace` |
| Auth / onboarding | `AuthPage`, `Register`, `AcceptInvite` (client), `AcceptStaffInvite`, `ResetPassword` |
| SaaS owner console | `OwnerLogin`, `OwnerPortal` |

Not every page here is necessarily wired to live data end-to-end — check the corresponding `frontend/src/api/*.ts` client and backend module before assuming a page is real or mock; the module list above reflects what the backend actually supports as of this edit.

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

**Supporting services** (`docker-compose.yml`, needed for malware scanning and e-signature): ClamAV and a self-hosted Documenso instance (+ its own Postgres). Run `docker compose up`, then see the comments in `docker-compose.yml` for the one-time Documenso API token / webhook setup.

**Tests**
```
cd backend && python -m pytest      # needs a Postgres instance — see .github/workflows/ci.yml for setup
cd frontend && npm test
```

---

## Known gaps

- **Real email sending** — invite links and notification emails are still stubbed (printed to the server console); no email provider is wired up yet (nothing email-related in `backend/requirements.txt`).
- **HTTPS / production deployment** — not yet addressed; `docker-compose.yml`'s Documenso config uses dev-only secrets that must be regenerated for any shared or production environment.
- Frontend automated test coverage is thin relative to the number of pages — most pages have no test file yet.
