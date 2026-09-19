# Deployment checklist

Everything below reflects the actual state of the codebase as of this writing, not aspirational
setup. Items marked **[manual]** need a real account/host/credential and can't be done from a
repo checkout alone. The rest is code/config already in place or scripted for you.

## 1. Secrets

Run this and paste the output into your production secret store (not into git, not into chat):

```
python backend/scripts/generate_secrets.py
```

Generates `SECRET_KEY`, `REGISTER_SECRET`, `OWNER_SECRET`, `ENCRYPTION_KEY`, and
`DOCUMENSO_WEBHOOK_SECRET`. `DOCUMENSO_API_KEY` has to come from the Documenso admin UI once
that instance exists (see §3).

`backend/.env.example` and `frontend/.env.example` document every variable the app reads.
Copy them to `.env` and fill in.

## 2. Production database **[manual: needs your Supabase account]**

Host chosen: **Supabase** (plain Postgres; nothing in the app is provider-specific).

1. Create a Supabase project on the **Pro plan**. The free tier pauses the database after a week
   of inactivity, which is the same failure mode that made Neon feel slow. Pick the region
   closest to the Render services (Render's default is Oregon or Frankfurt; match it).
2. Get the connection strings from **Project Settings -> Database -> Connection string**.
   Use the **pooler** hosts, not the direct host. The direct host is IPv6-only unless you buy
   the IPv4 add-on, and Render can't reach it.
   - **Session pooler** (port 5432): use for `DATABASE_URL`, i.e. migrations and owner tasks.
   - **Transaction pooler** (port 6543): use for `RUNTIME_DATABASE_URL`, i.e. the running API
     and worker. `SET LOCAL` in `app/database/rls.py` is transaction-scoped, so RLS context is
     safe through this pooler, and psycopg2 doesn't use server-side prepared statements.
   - Pooler usernames are suffixed with the project ref, e.g. `postgres.<project-ref>` and
     `app_runtime.<project-ref>`.
3. Create the restricted `app_runtime` role RLS depends on:
   ```
   python backend/scripts/print_runtime_role_sql.py --database postgres --owner-role postgres
   ```
   Run the printed SQL in the Supabase SQL editor, then build `RUNTIME_DATABASE_URL` from the
   transaction-pooler host with the `app_runtime.<project-ref>` username. **Without this,
   `ENVIRONMENT=production` refuses to start at all.** See `app/core/config.py`'s startup checks.
4. Run migrations against it, using the session-pooler `DATABASE_URL`:
   `cd backend && alembic upgrade head`.
5. Supabase's own Data API (PostgREST) is not used by this app. In **Project Settings -> Data API**
   turn it off, so the tables aren't exposed over an extra public endpoint.
6. Confirm backups in **Database -> Backups** (daily on Pro; point-in-time recovery is a paid add-on).

## 3. Documenso + ClamAV **[manual: needs a persistent host]**

`docker-compose.yml` is dev-only: its Documenso secrets are literally named "dev-only-...".
For production these need:
- Their own persistent host (both are stateful: Documenso has its own Postgres, ClamAV needs
  its virus-definition volume to survive restarts).
- Real generated secrets for `NEXTAUTH_SECRET`, `NEXT_PRIVATE_ENCRYPTION_KEY`,
  `NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY` (`openssl rand -hex 32` each).
- A real outbound SMTP relay configured on Documenso if you want its own signing-invite emails
  to send (separate from this app's own email gap, see README's Known Gaps).
- Once Documenso is reachable: create an API token (Settings -> API Tokens) for
  `DOCUMENSO_API_KEY`, and a webhook (Settings -> Webhooks) pointed at
  `https://<backend-host>/webhooks/documenso` using `DOCUMENSO_WEBHOOK_SECRET` from §1.
- ClamAV: see "ClamAV on Render" below. Until it is running, every upload is refused with HTTP
  503 ("File security scanning is temporarily unavailable"), which is deliberate: an unscanned
  upload is never accepted. Documents, templates, signed contracts, intake attachments and
  e-signature requests all depend on uploads, so none of them work without it.

### ClamAV on Render

`render.yaml` defines it as the private service `legalvault-clamav` (image
`docker.io/clamav/clamav:stable`, **standard plan**: clamd needs about 1.5 GB of RAM, so the
starter plan will crash-loop; a 2 GB disk at `/var/lib/clamav` keeps the virus definitions
across restarts) and wires the API to it. If your services were created by hand in the dashboard
instead of from the Blueprint, do the same manually:

1. **New -> Private Service -> Existing image**, image `docker.io/clamav/clamav:stable`, name
   `legalvault-clamav`, region the same as the API, plan **Standard**.
2. **Disks -> Add disk**: name `clamav-db`, mount path `/var/lib/clamav`, 2 GB.
3. Deploy it and wait for the first boot to finish downloading the definitions (several minutes;
   the logs end with `Self checking every 600 seconds`).
4. On `legalvault-api` set `CLAMD_HOST` to the private service's internal hostname (shown at the
   top of its page, for example `legalvault-clamav`) and `CLAMD_PORT` to `3310`, then redeploy
   the API.
5. Check it: upload a small file to a contract. A 503 means the API still cannot reach the
   scanner; check the host name and that both services are in the same region.


## 4. Redis (Celery broker) **[manual: needs a persistent host]**

Matter due-date and contract expiry reminders run as scheduled Celery tasks (`backend/app/tasks/`)
against a Redis broker. Unlike Documenso/ClamAV, it's stateless from the app's perspective: job
state lives in Postgres via `Notification` rows, so it's safe to lose a queued job on restart
(worst case, a scheduled reminder run is skipped once and picks back up on the next schedule tick).
Provisioned via `render.yaml` (§5) as `legalvault-redis`, a Render "Key Value" managed instance.
`REDIS_URL` is wired automatically (`fromService`), nothing to set by hand. **Without this,
`ENVIRONMENT=production` refuses to start at all.** See `app/core/config.py`'s startup checks.

## 5. Backend deploy: Render **[manual: needs your Render account]**

Host chosen: **Render**, via the `render.yaml` Blueprint at the repo root. It defines the API
(`legalvault-api`), the Celery worker+beat process (`legalvault-worker`), and a managed Redis
(`legalvault-redis`, Render's "Key Value" service) as one unit, reusing `backend/Procfile`'s two
process types (`preDeployCommand`/`startCommand` map to `release`/`web`; the worker service maps
to `worker`). **Not validated against a live Render account** (no credentials available to create
one from here): the first Blueprint sync in the Render dashboard is the real syntax check;
fix anything it flags before relying on this.

Setup:
1. In the Render dashboard: **New → Blueprint**, connect this repo. Render reads `render.yaml`
   and proposes all the backend-side services (API, worker, Redis and the ClamAV scanner) (plus the frontend static site, see §6).
2. Fill in every `sync: false` variable Render prompts for during Blueprint creation:
   `ENCRYPTION_KEY` (must be a real Fernet key: `python backend/scripts/generate_secrets.py`),
   `DATABASE_URL`/`RUNTIME_DATABASE_URL` (§2), `R2_*` (§1), and
   `DOCUMENSO_*` (§3, still needs its own host, unresolved by this Blueprint), `SENTRY_DSN`
   (§8, optional, leave blank to skip). `SECRET_KEY`/`REGISTER_SECRET`/`OWNER_SECRET` are
   auto-generated by Render (`generateValue: true`), nothing to paste for those three.
3. Once the Blueprint is live, open each of `legalvault-api`/`legalvault-worker`/`legalvault-frontend`'s
   **Settings → Deploy Hook**, copy its URL, and add it to this GitHub repo as a secret:
   `RENDER_API_DEPLOY_HOOK_URL`, `RENDER_WORKER_DEPLOY_HOOK_URL`,
   `RENDER_FRONTEND_DEPLOY_HOOK_URL`. `.github/workflows/ci.yml`'s `deploy` job calls these
   only after the `backend`/`frontend` test jobs pass on a push to `main`, instead of relying on
   Render's own deploy-on-push, which doesn't know or care whether tests are green
   (`autoDeploy: false` is set on all three services for exactly this reason).
4. **Only one `legalvault-worker` instance should ever run.** A second would duplicate every
   scheduled reminder, since each runs its own Celery Beat scheduler.

## 6. Frontend deploy: Render **[manual: needs your Render account]**

Also defined in `render.yaml`, as `legalvault-frontend` (a Render Static Site: `runtime: static`,
built from `frontend/` via `npm ci && npm run build`, served from `dist/`). Created and deployed
alongside the backend services in the same Blueprint (§5's steps 1 through 3 cover it). Also has a
`routes` rewrite rule (falls back to `index.html` for any non-asset path) so client-side routes
survive a hard refresh or a shared link. Without it, `/about`, `/staff/dashboard`, etc. 404 at
the host level before React Router ever runs.

That rule is only applied to a service Render manages from the Blueprint. If the static site was
created by hand in the dashboard, add it there instead: **Redirects/Rewrites**, source `/*`,
destination `/index.html`, action **Rewrite**. As a backup, the build also writes `dist/404.html`
(a copy of `index.html`, see `frontend/scripts/copy-404.mjs`), which Render serves for unknown
paths, so deep links still load the app even if the rewrite rule is missing. That path answers
with HTTP 404 rather than 200, so the rewrite rule is still the proper fix.

**Custom domain checklist**: a real domain isn't set up anywhere yet; the whole app currently
uses placeholder domains (`legalvault.example.com` in `frontend/src/constants/site.ts`,
`public/robots.txt`, `public/sitemap.xml`, `public/llms.txt`, and `index.html`'s static OG tags
+ Organization JSON-LD; `*.onrender.com` in `render.yaml`). Once a real domain is bought:
1. In the Render dashboard, `legalvault-frontend` → Settings → Custom Domain: add it, and add the
   CNAME/A record it gives you at your DNS registrar.
2. Update `SITE_URL` in `frontend/src/constants/site.ts` to the real domain.
3. Update the placeholder domain in `public/robots.txt`, `public/sitemap.xml`, `public/llms.txt`,
   and `index.html`'s `og:url`/`og:image`/Organization `url`/`logo` fields to match.
4. Update `render.yaml`: `legalvault-api`'s `FRONTEND_URL` and `legalvault-frontend`'s
   `VITE_API_BASE_URL`, if the API also gets its own custom domain (or leave `VITE_API_BASE_URL`
   pointing at the API's `.onrender.com` URL if only the frontend gets a custom domain).
5. Generate a real `og-image.png` (1200×630) to replace the placeholder in `public/`. The
   current one is a generated placeholder with a visible "replace before launch" watermark.

## 7. Already handled: verify, don't rebuild

- **Production safety checks** (`backend/app/core/config.py`): fails loudly at startup if
  secrets are placeholders, `FRONTEND_URL` is unset, or `RUNTIME_DATABASE_URL`/`REDIS_URL` is
  missing.
- **CORS / HSTS**: already gated on `ENVIRONMENT` in `backend/app/main.py`. No localhost
  fallback once `ENVIRONMENT=production`.
- **RLS session-context bug**: fixed. Tenant context now survives every `db.commit()` within a
  request (see `app/database/rls.py`), verified against a real Postgres instance.
- **Migrations**: `alembic upgrade head` is the only step needed; no manual schema fixes.
- **Frontend bundle**: route-level code-splitting is in place (`App.tsx`). `Workspace`,
  `ClientPortal`, `OwnerPortal`, and the auth-flow pages load on demand instead of upfront.

## 8. Observability (optional)

Sentry error tracking is wired up on both sides but **entirely opt-in**: nobody is required to
have a Sentry account to run this app, in dev or in production. Set `SENTRY_DSN` (backend, see
§1/`backend/.env.example`) and/or `VITE_SENTRY_DSN` (frontend, see `frontend/.env.example`) to
turn it on; leave either unset and that side just skips initialization, no error, no missing-secret
failure at startup. Not part of the required-secrets checklist in §5/§6 above.

## 9. Known gaps this checklist doesn't fix

- **Real email delivery**: invite links and notification emails are still console-stubbed.
  Out of scope here by request; see README's Known Gaps.
- **Supabase backup/PITR**: confirm your project's backup retention in the Supabase
  dashboard; not something the app or this checklist can configure for you.
- **External uptime alerting**: Sentry (§8, once configured) covers application errors, but
  nothing pages anyone if the process itself goes down entirely (a true uptime/ping check, not
  an error-tracking concern). No provider chosen for that specifically.
- **Frontend automated test coverage** is thin relative to the number of pages. This is a real risk
  for regressions, not a hard blocker.
