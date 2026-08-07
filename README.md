# LegalHub

A multi-tenant SaaS platform for law firm practice management — working name "LegalHub" (product-positioned against lighthub.law). FastAPI backend + React frontend.

Three tiers of users, each with its own auth system and JWT token type:

1. **SaaS Owner** — onboards law firms onto the platform, activates/suspends firms
2. **Firm Staff** — lawyers, admins, paralegals, secretaries, receptionists who manage clients/matters
3. **Firm Clients** — the firm's own clients, who log into a restricted portal to view case status, documents, and templates

See [`ROADMAP.md`](ROADMAP.md) for the full feature-parity comparison against lighthub.law and phased build-out plan, and [`backend/docs/architecture.md`](backend/docs/architecture.md) for the detailed backend design (schema, auth flows, infra decisions).

---

## Tech stack

**Backend**
- FastAPI (Python), SQLAlchemy ORM, Alembic migrations
- PostgreSQL (hosted on Neon, serverless)
- Cloudflare R2 (S3-compatible object storage) for template and matter-document files
- JWT auth (PyJWT) with argon2id password hashing (pwdlib), rate limiting via slowapi

**Frontend**
- React + TypeScript, Vite

---

## Project structure

```
backend/
  app/
    core/            config, security, storage, rate limiter, exception handlers
    database/         SQLAlchemy session/engine setup
    exceptions/       domain exceptions
    modules/
      auth/            staff register/login, staff invites, password reset
      clients/          client companies, contact invites, client-portal auth
      matters/          matters (cases), assignments, matter documents
      templates/         firm-wide document templates (upload/list/download)
      dashboard/        summary metrics (active cases, status breakdown)
      owner/            SaaS-owner console: firm management, activation
      support_requests/  client support ticket submission + staff triage
  alembic/            migrations
  docs/               architecture.md (detailed design doc)

frontend/
  src/
    api/              typed API clients per domain
    components/       shared UI (login modal, footer, icons)
    pages/            one folder per route — see below
```

### Frontend pages

| Area | Pages |
|---|---|
| Marketing | `Home`, `About`, `Pricing`, `Blog`, `Resources`, `Integrations`, `Contact`, `RequestSupport` |
| Staff app | `Dashboard`, `Matters`, `MatterDetail`, `NewMatter`, `Clients`, `Templates`, `Staff`, `Workflow`, `Reporting`, `MatterAdmin`, `SignedContracts`, `ContractData`, `LearnedFriend`, `LightHubGuide` |
| Client portal | `ClientPortal`, `ClientDashboard`, `ClientMatterDetail`, `ClientWorkflow`, `ClientTemplates`, `ClientReporting`, `ClientSignedContracts` |
| Auth / onboarding | `AuthPage`, `Register`, `AcceptInvite` (client), `AcceptStaffInvite`, `ResetPassword` |
| SaaS owner console | `OwnerLogin`, `OwnerPortal` |

Only pages backed by real endpoints (see below) use live data; the rest are UI mockups pending backend work — tracked in `ROADMAP.md` §4.

---

## What's actually working (backend-verified)

- **Staff auth** — register (firm + first admin, secret-gated), login, `me`, list users, forgot/reset password, staff invite → accept flow, staff deactivate/reactivate (admin-only)
- **Client-portal auth** — invite → accept → login, resend invite, forgot/reset password, separate JWT type from staff tokens
- **Clients** — create client company, invite contacts, list clients (firm-scoped)
- **Matters** — create/list/get, status updates, client-visibility toggle, staff assignments with per-matter roles
- **Matter documents** — per-matter file upload/list/download (versioned, R2-backed), staff and client access, respects the visibility toggle
- **Templates** — firm-wide document upload to R2, list, signed time-limited download URLs, staff + client access
- **Dashboard summary** — real active-case counts and status breakdown derived from matters
- **Support requests** — clients submit tickets, staff list/triage and update status
- **SaaS owner console** — owner login, create/list/view firms, activate/suspend a firm

Multi-tenant isolation (firm-scoped queries, cross-firm access returns 404 not 403) and token-type isolation (staff vs. client vs. owner tokens) are enforced throughout and manually verified — see `backend/docs/architecture.md` for the testing approach.

**Known gaps:** no automated test suite (all testing manual via curl/Swagger), real email delivery not yet wired (invite links are console-stubbed), no refresh tokens (24h staff sessions), not yet deployed behind HTTPS.

---

## Running locally

**Backend**
```
cd backend
pip install -r requirements.txt
# configure .env — see app/core/config.py for required vars (DB URL, SECRET_KEY, REGISTER_SECRET, OWNER_SECRET, R2 credentials, etc.)
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
