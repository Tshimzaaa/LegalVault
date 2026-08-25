# Deployment checklist

Everything below reflects the actual state of the codebase as of this writing, not aspirational
setup. Items marked **[manual]** need a real account/host/credential and can't be done from a
repo checkout alone — the rest is code/config already in place or scripted for you.

## 1. Secrets

Run this and paste the output into your production secret store (not into git, not into chat):

```
python backend/scripts/generate_secrets.py
```

Generates `SECRET_KEY`, `REGISTER_SECRET`, `OWNER_SECRET`, `ENCRYPTION_KEY`, and
`DOCUMENSO_WEBHOOK_SECRET`. `DOCUMENSO_API_KEY` has to come from the Documenso admin UI once
that instance exists (see §3).

`backend/.env.example` and `frontend/.env.example` document every variable the app reads —
copy them to `.env` and fill in.

## 2. Production database **[manual — needs your Neon account]**

1. Create (or pick) the production Neon project/branch. This is `DATABASE_URL`.
2. Create the restricted `app_runtime` role RLS depends on:
   ```
   python backend/scripts/print_runtime_role_sql.py --database <dbname> --owner-role <ownerrole>
   ```
   Run the printed SQL against the database as the owner role, then set `RUNTIME_DATABASE_URL`
   to the connection string it prints. **Without this, `ENVIRONMENT=production` refuses to
   start at all** — see `app/core/config.py`'s startup checks.
3. Run migrations against it: `cd backend && alembic upgrade head`.
4. **Check compute size/autoscaling before launch.** The current dev branch has been
   consistently taking 3–8s per API call in manual testing — plausibly a free-tier/minimum
   compute size cold-starting on every request rather than anything in the app code. Confirm
   the production branch's compute tier (and autoscaling settings) in the Neon dashboard
   before assuming this won't recur for real users; this checklist can't verify that for you.

## 3. Documenso + ClamAV **[manual — needs a persistent host]**

`docker-compose.yml` is dev-only — its Documenso secrets are literally named "dev-only-...".
For production these need:
- Their own persistent host (both are stateful: Documenso has its own Postgres, ClamAV needs
  its virus-definition volume to survive restarts).
- Real generated secrets for `NEXTAUTH_SECRET`, `NEXT_PRIVATE_ENCRYPTION_KEY`,
  `NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY` (`openssl rand -hex 32` each).
- A real outbound SMTP relay configured on Documenso if you want its own signing-invite emails
  to send (separate from this app's own email gap — see README's Known Gaps).
- Once Documenso is reachable: create an API token (Settings -> API Tokens) for
  `DOCUMENSO_API_KEY`, and a webhook (Settings -> Webhooks) pointed at
  `https://<backend-host>/webhooks/documenso` using `DOCUMENSO_WEBHOOK_SECRET` from §1.
- Point `CLAMD_HOST`/`CLAMD_PORT` at ClamAV's private-network address (not a public one).

## 4. Redis (Celery broker) **[manual — needs a persistent host]**

Matter due-date and contract expiry reminders run as scheduled Celery tasks (`backend/app/tasks/`)
against a Redis broker. Unlike Documenso/ClamAV, it's stateless from the app's perspective — job
state lives in Postgres via `Notification` rows, so it's safe to lose a queued job on restart
(worst case, a scheduled reminder run is skipped once and picks back up on the next schedule tick).
Any managed Redis (Upstash, a hosting provider's add-on, etc.) works — set `REDIS_URL` from §1.
**Without this, `ENVIRONMENT=production` refuses to start at all** — see `app/core/config.py`'s
startup checks.

## 5. Backend deploy **[manual — needs a host; no host chosen yet]**

`ci.yml` has no deploy step — it only runs tests/lint/build. Once you pick a host (Render,
Fly.io, Railway, a VPS, etc.), a deploy job can be added to `ci.yml`; ask for that whenever
the host is decided. Wherever it runs, set `ENVIRONMENT=production` plus every var from
`backend/.env.example`. The app will refuse to boot if any secret is still a placeholder,
`FRONTEND_URL` is still the localhost default, or `RUNTIME_DATABASE_URL`/`REDIS_URL` is unset —
that's intentional, not a bug to work around.

The deploy also needs a second long-running process alongside `web`: `backend/Procfile`'s
`worker` line (`celery -A app.tasks.celery_app worker --beat --loglevel=info`) runs both the
Celery worker and the beat scheduler in one process, which is fine at this scale. Whichever host
is chosen must support running both `Procfile` process types, and **only one `worker` instance
should run** — running more than one duplicates every scheduled reminder, since each would run
its own beat scheduler.

## 6. Frontend deploy **[manual — needs a host]**

- Set `VITE_API_BASE_URL` to the real backend origin before `npm run build` (see
  `frontend/.env.example`).
- Set `FRONTEND_URL` on the backend to this frontend's real origin — CORS will reject it
  otherwise.
- `npm run build` output in `frontend/dist/` is a static site — any static host works.

## 7. Already handled — verify, don't rebuild

- **Production safety checks** (`backend/app/core/config.py`): fails loudly at startup if
  secrets are placeholders, `FRONTEND_URL` is unset, or `RUNTIME_DATABASE_URL`/`REDIS_URL` is
  missing.
- **CORS / HSTS**: already gated on `ENVIRONMENT` in `backend/app/main.py` — no localhost
  fallback once `ENVIRONMENT=production`.
- **RLS session-context bug**: fixed — tenant context now survives every `db.commit()` within a
  request (see `app/database/rls.py`), verified against a real Postgres instance.
- **Migrations**: `alembic upgrade head` is the only step needed; no manual schema fixes.
- **Frontend bundle**: route-level code-splitting is in place (`App.tsx`) — `Workspace`,
  `ClientPortal`, `OwnerPortal`, and the auth-flow pages load on demand instead of upfront.

## 8. Known gaps this checklist doesn't fix

- **Real email delivery** — invite links and notification emails are still console-stubbed.
  Out of scope here by request; see README's Known Gaps.
- **Neon backup/PITR** — confirm your production branch's retention settings in the Neon
  dashboard; not something the app or this checklist can configure for you.
- **External uptime/error alerting** — the app has its own internal system-health view
  (`OwnerPortal`), but nothing pages anyone if the process itself goes down. No provider chosen.
- **Frontend automated test coverage** is thin relative to the number of pages — a real risk
  for regressions, not a hard blocker.
