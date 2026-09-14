# LegalVault → LightHub-class Product Roadmap

**Prepared:** 2026-07-23
**Purpose:** Compare the current state of this project (backend `FastAPI` + frontend `React`, working name "LegalVault"/"LightHub") against the live product at lighthub.law, and lay out what backend and frontend work is required to reach (and exceed) that level of functionality.

---

## 1. Where we stand today

### Backend (real, working, manually tested: see `backend/docs/architecture.md`)

| Domain | Status |
|---|---|
| Staff auth (register/login/me/list users) | ✅ Working. JWT, rate-limited, firm-scoped. |
| Client-portal auth (invite → accept → login) | ✅ Working. Separate JWT type, 48h invite expiry, resend. |
| Clients (companies + contacts) | ✅ Working. Create client, invite contact, list. |
| Matters (cases) | ✅ Working. Create/list/get/status/visibility/staff assignments. |
| Templates (documents) | ✅ Working. Upload to Cloudflare R2, list, signed download URLs, staff + client access. |
| Dashboard summary | ✅ Partially working (added this session): real active-case and status-breakdown counts derived from Matters; deadlines/billing/documents/tasks/comms sections intentionally return empty (no backing data yet). |
| Email delivery | ❌ Stubbed: invite links print to console, no SendGrid integration yet. |
| Refresh tokens | ❌ None: 24h access token, re-login required after expiry. |
| Automated tests | ❌ None: all testing so far is manual (curl/Swagger). |
| HTTPS / prod hardening | ❌ Not yet addressed (local dev only). |

### Frontend (React, ~20 pages)

Only four domains are wired to real data: **Templates, Client Templates, New Matter (create), and the Dashboard's case/status numbers.** Everything else is static/local mock data with **no backing backend model at all**: Workflow (kanban), Signed Contracts, Reporting (revenue/billable-hours charts), Contract Data, Matter Admin (permissions table), Request Support, Resources, Learned Friend (AI assistant), LightHub Guide, and Integrations. These aren't half-built; they're UI mockups for domains the backend hasn't been designed for yet.

### What this means

The core "system of record" (firms → clients → matters → templates, with proper multi-tenant isolation) is solid and genuinely production-shaped. Everything LightHub advertises *beyond* that currently exists only as frontend set-dressing: contract lifecycle analytics, workflow/permission controls, spend data, capacity planning, a knowledge repository, and integrations.

---

## 2. Feature-by-feature comparison vs. lighthub.law

lighthub.law positions itself as "the single access point to a comprehensive suite of legal products," covering the contract lifecycle "from intake, through contract generation and negotiations, to execution," plus Enterprise Legal Management (team capacity) and a knowledge repository. Their advertised modules, mapped against us:

| LightHub feature | What they claim | Our equivalent today | Gap |
|---|---|---|---|
| **Streamlined intake** | Customizable intake forms, "new contracts created in one easy intake process" | `NewMatter` form → real `POST /matters`, but fields are fixed, not customizable, and only captures title/description/client | Form customization; intake → contract generation handoff |
| **Workflow controls** | "Detailed reports and controls on information sharing, workflow process, and user permissions" | `Workflow`/`ClientWorkflow` kanban boards (100% mock, not backed by matter status at all) | Needs real workflow engine + a permissions model |
| **Contract storage** | "Safely store and access documents on a secure document management system" | `Templates` (firm-wide reference docs only), no per-matter document storage/versioning | Needs a Documents module scoped to matters, not just templates |
| **Data insights** | "Monitor and analyze contract spend-data and terms" | `Reporting`/`ClientReporting`: fully fabricated charts (revenue, billable hours, case outcomes) | Needs real billing/time-tracking data to report on |
| **Enterprise (capacity) management** | "Understand your team resource and capacity requirements" | Nothing: no staff workload/capacity concept exists | New domain entirely |
| **Knowledge repository** | "Easy access to contracting know-how" | `Resources`, `LightHubGuide`: static mock content | Needs real CMS-backed content, or is fine as static if scope stays small |
| **Real-time dashboard** | Live contract-landscape view | `Dashboard`: now partially real (case counts/status), rest still empty | Needs deadlines/tasks/documents/comms data sources |
| **Integrations** | "Integrate software you already use," modular adoption | `Integrations` page: mock list, no real connectors | Needs an actual integrations/webhooks layer |

**Where we already differ favorably:** we have genuine multi-tenant firm isolation, a real client-invite security model, and signed-URL document downloads. LightHub's marketing doesn't detail their security model at all, so this is a point we can lead with rather than catch up on.

---

## 3. Backend roadmap

Ordered by dependency: later phases build on earlier ones.

### Phase 1: Finish exposing what the backend can already do
No new domains, just closing existing gaps (small, high-value):
- `GET /matters` list + `GET /matters/{id}` detail: already built, has zero frontend surface (see §4)
- `PATCH /matters/{id}/status` and `/visibility`, `POST /matters/{id}/assignments`: same, backend-complete, frontend-absent
- Real email sending (SendGrid) for client invites, replacing the console-stub
- Refresh tokens / session renewal so staff aren't logged out every 24h

### Phase 2: Documents & Contracts (closes the biggest LightHub gap)
- New `documents` module: per-matter file uploads (not just firm-wide templates), versioning, who-uploaded/when, R2 storage reusing the existing `app/core/storage.py` pattern
- New `contracts` concept layered on `matters`: signed date, contract value, expiry/renewal date, counterparty, status (active/expiring/archived). This is what `SignedContracts` and `ContractData` are currently faking
- Expiry notifications (needs a scheduled job, see Phase 5 notifications)

### Phase 3: Workflow & Permissions engine
- Configurable workflow stages per firm (today `MatterStatus` is a fixed 3-value enum: intake/in_progress/closed); either extend the enum or introduce a `workflow_stages` table per firm so the kanban board in `Workflow`/`ClientWorkflow` reflects real, persisted, draggable state
- Real per-matter permission levels (Owner/Editor/Viewer) and team-member counts (what `MatterAdmin` currently fakes)
- Task/deadline model (`tasks` table: title, due date, assignee, matter link); backs `keyDeadlines` and `tasks` on the Dashboard, and `RequestSupport`

### Phase 4: Billing & Reporting
- Time entries / billable hours per user per matter
- Invoicing basics (rate, hours, amount, status), or at minimum revenue rollups
- Reporting endpoints that aggregate real time/contract/matter data (revenue trend, case outcomes, billable hours by attorney), replacing every fabricated chart in `Reporting`/`ClientReporting`

### Phase 5: Enterprise features & AI
- Enterprise Legal Management: staff capacity/workload aggregation (matters assigned per user vs. some configurable capacity), a genuinely new analytics domain, lowest priority since it's the least differentiating
- Knowledge repository: either keep `Resources`/`LightHubGuide` static (cheapest, and fine for a v1) or back it with a simple CMS if firms need to customize their own content
- "Learned Friend" AI assistant: wire to the Claude API (Messages API) scoped to a firm's own matters/documents so it can answer questions grounded in real firm data. This is a strong differentiator that LightHub doesn't appear to advertise at all
- Integrations module: API keys/webhooks for e-signature (DocuSign/SignRequest style), calendar sync, and outbound notifications
- Notifications: email + in-app, for invite reminders, deadline approaching, contract expiring

### Phase 6: Production hardening
- Automated test suite (currently zero automated coverage)
- HTTPS + real domain deployment
- Audit log (who changed what, when), a natural extension of the firm-isolation work already done
- Pagination on list endpoints as data volume grows

---

## 4. Frontend roadmap

Mirrors the backend phases: a page should only go from mock to real once its backend phase lands.

**Immediate (Phase 1, no new backend work needed):**
- New **staff Matters list page** (the single biggest missing piece): staff can currently only *create* matters, never see them. Backed by the already-built `GET /matters`.
- **Matter detail view**: status update, visibility toggle, staff assignment UI, all against already-built endpoints.
- **Client invite flow UI**: a staff-side "invite a contact" form (`POST /clients/{id}/contacts`) and a client-side "accept invite" page (`POST /client-auth/accept-invite`). Currently no route exists for either.
- **Forgot/reset password UI** (staff + client): endpoints exist, no UI.
- **Template upload form** (staff): `POST /templates` exists, unused.
- Wire the "Use Template" download buttons on `Templates`/`ClientTemplates` to the existing signed-download endpoints.

**Phase 2+ (as backend phases land):**
- `SignedContracts`/`ContractData` → real contract records instead of the fabricated Meridian/Vantage/Kaya rows
- `Workflow`/`ClientWorkflow` → drag-and-drop persists real status via `PATCH /matters/{id}/status`
- `MatterAdmin` → real permission levels and team-member counts
- `Reporting`/`ClientReporting` → real charts once billing/time data exists
- `RequestSupport` → real support-ticket submission tied to the task model
- `LearnedFriend` → a real chat UI wired to the AI assistant backend
- `Integrations` → real connection/status state instead of a static list

---

## 5. Suggested sequencing

1. **Phase 1 backend + frontend together** (1-2 sprints): closes every "built but invisible" gap. Highest ROI, lowest risk: no new data modeling required.
2. **Documents & Contracts** (Phase 2): the single feature most directly matching LightHub's core pitch ("contract lifecycle, storage, execution").
3. **Workflow & Permissions** (Phase 3): makes the existing kanban UI genuinely functional.
4. **Billing & Reporting** (Phase 4): unlocks "data insights," LightHub's other headline feature.
5. **AI assistant + integrations + ELM** (Phase 5): differentiators, done once the core is solid. The AI assistant in particular is something LightHub's own marketing doesn't claim to have.
6. **Hardening** (Phase 6): required before any real firm goes live in production, but doesn't block earlier feature work.

---

## 6. Bottom line

We're not behind LightHub on architecture: the multi-tenant auth/isolation model here is more rigorous than anything LightHub's marketing describes. We're behind on **breadth of connected features**: contracts, billing, workflow, and reporting are all real, working concepts in their product and are currently mockups in ours. Closing Phases 1-4 above would bring this to feature parity; Phase 5 (a grounded AI assistant) is a genuine opportunity to exceed it.
