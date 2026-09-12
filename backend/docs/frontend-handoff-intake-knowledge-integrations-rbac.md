# Frontend handoff: Intake Forms, Knowledge Repository, Integrations, RBAC

Backend-only build. No frontend code was touched. This is the API contract and
UI checklist for building the frontend against it. All new endpoints are live
on the running API and covered by the OpenAPI docs at `/docs`.

Auth: everything below uses the existing staff bearer token (`Authorization:
Bearer <token>` from `/auth/login`) or client-portal token (from
`/client-auth/login`), exactly like every other endpoint already wired up.

---

## 0. New error behavior: 403 vs 401

A logged-in staff user who lacks permission for an action now gets **403**
(`"You do not have permission to perform this action."`), not 401. This is a
new distinction: previously every staff-only route either worked or 401'd
(which frontends conventionally treat as "session expired, log out"). Now:

- **401** = not logged in / bad or expired token → log the user out / send to login.
- **403** = logged in, but their role doesn't allow this action → show an
  inline "you don't have permission" message, do **not** log them out.

**Note on an existing inconsistency you may notice**: routes that were
*already* admin-only before this build (client status/delete, contact
status/delete/force-logout: the `/clients/...` admin actions) still return
**401** on a permission failure, not 403. That's pre-existing behavior we
deliberately left alone rather than silently changing its contract. Everything
*newly* gated in this build (see the role matrix below) returns 403. If your
error handling special-cases 401 as "always log out," you'll want an exception
carve-out for those specific pre-existing admin routes, or accept that they'll
incorrectly log a non-admin user out today (same as before this build, not a
regression).

## 1. Role matrix: what to show/hide/disable per role

Roles: `admin`, `lawyer`, `paralegal`, `secretary`, `receptionist` (on the
logged-in user object, `role` field). Suggest hiding controls the current
user's role can't use (rather than showing them disabled), since attempting
the action now cleanly 403s instead of silently succeeding.

| Action | admin | lawyer | paralegal | secretary | receptionist |
|---|:-:|:-:|:-:|:-:|:-:|
| Create/edit matter, change status/visibility/deadline, assign staff | ✓ | ✓ | ✓ | | |
| Upload/delete matter document | ✓ | ✓ | ✓ | | |
| Create/edit matter task | ✓ | ✓ | ✓ | ✓ | |
| Delete matter task | ✓ | ✓ | ✓ | | |
| Post matter message / delete own message | ✓ | ✓ | ✓ | ✓ | |
| Create client / invite contact / resend invite | ✓ | | | | |
| Client status/delete/contact actions (unchanged, pre-existing) | ✓ | | | | |
| Upload/edit template | ✓ | ✓ | | | |
| Delete template | ✓ | | | | |
| Upload signed contract | ✓ | ✓ | ✓ | | |
| Update signed contract status | ✓ | ✓ | ✓ | ✓ | |
| Support request status update | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Build intake form** (create/edit/delete form, add/edit/delete/reorder fields, publish) | ✓ | | | | |
| **Triage intake submission** (view, change status) | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Convert intake submission → matter** | ✓ | ✓ | ✓ | | |
| **Create/edit/delete knowledge article** | ✓ | ✓ | | | |
| **View/configure integrations** (all actions, including just viewing the list) | ✓ | | | | |

Bold rows are new in this build. Everything else is unchanged behavior,
listed here so the matrix is complete in one place.

---

## 2. Intake Forms

Three route groups. All request/response bodies are JSON except the client
submit endpoint (multipart).

### 2a. Staff: form builder (`/intake-forms`, admin only for writes)

- `POST /intake-forms`: `{title, description?}` → form object (no fields yet).
- `GET /intake-forms`: list all forms for the firm (draft + published). Any staff role can view.
- `GET /intake-forms/{form_id}`: single form **including its `fields` array**, ordered by `display_order`.
- `PATCH /intake-forms/{form_id}`: partial update `{title?, description?, is_published?}`. Setting `is_published: true` is how a form goes live to clients.
- `DELETE /intake-forms/{form_id}`: 409 if the form has any submissions (delete the form's build, not its history; this is intentional, not a bug to work around).

Fields (children of a form):

- `POST /intake-forms/{form_id}/fields`: `{label, field_type, is_required, help_text?, options?}`.
  `field_type` is one of `text | textarea | number | date | dropdown | checkbox | file`.
  `options` is a list of strings, only meaningful for `dropdown` (e.g. `["Yes", "No"]`); omit/null for every other type.
- `PATCH /intake-forms/{form_id}/fields/{field_id}`: partial update. **409** if you try to delete or change the `field_type` of a field that already has submissions referencing it (label/help_text edits still allowed). Surface this as "can't change this field's type: it already has responses" rather than a generic error.
- `DELETE /intake-forms/{form_id}/fields/{field_id}`: same 409 rule.
- `POST /intake-forms/{form_id}/fields/reorder`: `{field_ids: [uuid, uuid, ...]}`, full ordered list of every field's id. Use this for drag-to-reorder; send the complete new order each time.

**Suggested UI**: a form builder screen, with title/description fields at top,
a reorderable list of field rows (add/edit/delete/drag), and a publish toggle. Once
a form has submissions, gray out delete/type-change on existing fields (still
allow adding new ones) rather than letting the user hit the 409 and be confused.

### 2b. Staff: submission triage (`/intake-submissions`)

- `GET /intake-submissions`: all submissions for the firm, any staff role, newest first.
- `GET /intake-submissions/{submission_id}`: full detail including `answers` array (each answer has `field_id`, `value` for scalar answers, or `original_filename`/`content_type` for file answers with `value: null`).
- `PATCH /intake-submissions/{submission_id}/status`: `{status}`, one of `submitted | in_review | converted | declined`. Any staff role (this is intentionally the one triage action open to receptionists too, as first point of contact).
- `POST /intake-submissions/{submission_id}/convert`: `{matter_title?}` (optional override; defaults to `"{Client Name} – {Form Title}"`). Creates a real `Matter`, stamps `converted_matter_id` on the submission, sets status to `converted`. Admin/lawyer/paralegal only. **Suggest**: show this as a prominent "Convert to Matter" button on the submission detail view; once `converted_matter_id` is set, replace it with a link to the created matter instead.
- `GET /intake-submissions/{submission_id}/answers/{answer_id}/download` → `{download_url, expires_in_seconds}` for FILE-type answers (a presigned URL, same pattern as every other document download in the app; fetch this on click, don't cache the URL).

**Suggested UI**: a triage inbox (list + status filter/badges), and a detail view rendering each answer against its field's `label`/`field_type` (so a `checkbox` answer with `value: "true"` renders as a checkmark, a `file` answer renders as a download link, etc.). You'll need to join `submission.answers[].field_id` against `form.fields` (fetch the form once and index by field id) since the answer itself doesn't carry the field's label/type.

### 2c. Client portal (`/client-intake`)

- `GET /client-intake/forms`: published forms only, for the logged-in contact's firm.
- `GET /client-intake/forms/{form_id}`: single published form + fields (404 if draft or wrong firm; don't distinguish these cases in the UI, both just mean "not available").
- `POST /client-intake/forms/{form_id}/submit` uses **multipart/form-data**, not JSON:
  - `answers_json` (form field): a JSON string, `{"<field_id>": "<value>", ...}`. One entry per non-file field the user answered. Omit a field entirely if left blank (don't send empty strings for optional fields).
  - `file_field_ids` (form field, repeatable): the field_id each uploaded file corresponds to.
  - `files` (form field, repeatable): the actual file uploads.
  - **`file_field_ids` and `files` must be the same length and in the same order**. Index `i` of `file_field_ids` names which field `files[i]` answers. This is the explicit contract; there's no other way to associate an uploaded file with its field.
  - Required-field validation happens server-side (422 `"One or more required fields were not answered"` if you skip one); client-side validation is a UX nicety, not a substitute.
  - File constraints: 10MB max per file, allowed types are PDF/DOC/DOCX/TXT/JPEG/PNG (400 `"Unsupported or oversized file for this field"` otherwise); worth enforcing client-side too so users don't wait on an upload just to get rejected.
- `GET /client-intake/submissions`: the logged-in contact's own submissions (not other contacts at the same client).
- `GET /client-intake/submissions/{submission_id}`: own submission detail, same shape as the staff detail view, for a "track my request" screen.

**Suggested UI**: render the form dynamically from its `fields` array. This is
a real dynamic-form-renderer requirement, not a fixed template. A status page
showing the client's past submissions with their current `status` doubles
nicely as a lightweight "my requests" tracker.

---

## 3. Knowledge Repository

Much simpler: one resource, no files, no workflow states beyond publish.

### Staff (`/knowledge-articles`)

- `POST /knowledge-articles`: `{title, category, content, is_published?}`. `category` is a free-text string (firms define their own taxonomy, e.g. "Glossary", "NDAs"; don't hardcode a fixed list, consider a combobox that also lets you type a new one). `content` is markdown; render it as such wherever it's displayed. Admin/lawyer only.
- `GET /knowledge-articles`, `GET /knowledge-articles/{id}`: all articles including drafts, any staff role.
- `PATCH /knowledge-articles/{id}`: partial update, same fields. Admin/lawyer only.
- `DELETE /knowledge-articles/{id}`: admin/lawyer only.

### Client portal (`/client-knowledge-articles`)

- `GET /client-knowledge-articles`, `GET /client-knowledge-articles/{id}`: published only.

**Suggested UI**: a simple CMS-style list/editor for staff (title, category
picker, markdown editor, publish toggle), and a read-only browsable knowledge
base for clients. A category filter and full-text-in-browser search over the
already-fetched list is probably enough; there's no server-side search
endpoint for this yet.

---

## 4. Integrations (`/integrations`, admin-only, including just viewing)

This replaces the existing **mocked** Integrations page (SigningHub, Trackado,
Contract Express, cloud storage toggles that don't call anything today). The
new backend is real persistence with **no live connection to any provider
yet**. Configuring an integration here stores credentials encrypted and
tracks enabled/disabled state, but nothing is actually sent to SigningHub etc.
Please don't imply otherwise in the UI copy (e.g. avoid "Connected ✓" language
that suggests a live, verified connection; "Configured" is more accurate).

- `GET /integrations`: always returns exactly 4 entries (one per known provider: `signinghub`, `trackado`, `contract_express`, `cloud_storage`), each `{provider, is_enabled, is_configured, connected_at}`. A provider with no credentials ever set comes back `is_enabled: false, is_configured: false, connected_at: null`. There's no "not found" case to handle, the list is always complete.
- `PUT /integrations/{provider}`: `{credentials: {key: value, ...}, is_enabled}`. `credentials` is a free-form string map (e.g. `{"api_key": "..."}"); **the shape isn't validated per-provider yet** (this is a deliberate scope decision, not an oversight), so build the credentials form generically (label/value pairs, or a single API-key field) rather than assuming a fixed schema per provider.
- `POST /integrations/{provider}/disable`: flips `is_enabled` off, **keeps** stored credentials (re-enabling later doesn't require re-entering them).
- `DELETE /integrations/{provider}`: full disconnect, wipes stored credentials.

No response ever includes the credentials themselves (not even masked/partial).
Once set, there's no way to display or re-download them, only overwrite
(`PUT` again) or wipe (`DELETE`). Design the "configured" state as an opaque
status, not an editable-in-place secret field.

**Suggested UI**: same visual shape as the existing (currently fake) toggle
page is fine: a card per provider with a toggle and a "Configure" button
opening a credentials form. Just wire it to these real endpoints instead of
local state, and swap "Connected" for "Configured" per the note above.

---

## Quick reference: request/response field types

All `id` fields are UUIDs (strings in JSON). Timestamps are ISO 8601. Enums
are lowercase snake_case strings matching the values listed above. See
`/docs` (OpenAPI/Swagger UI on the running API) for the exact generated
schemas if anything here is ambiguous; that's the source of truth.
