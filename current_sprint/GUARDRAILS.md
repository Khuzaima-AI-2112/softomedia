# GUARDRAILS.md

Sprint operator guardrails for the `softomedia-live2026` repo.
Maintained by the SRE/QA lead. Updated each sprint retrospective (Step 8).

> **Last updated:** MVP Demo Remediation
> Append new entries at the bottom of each section. Never delete existing rules — mark superseded rules `[SUPERSEDED by S{N}]` and add the replacement inline.

---

## Anti-Hallucination

- No filename without a confirmed on-disk path (`grep` / `find` / directory listing).
- No route without a confirmed live route source (`App.jsx` for client; repo tree for server).
- No create/delete recommendation unless references are confirmed or orphan status is proven.
- Any shared backend change must include backward compatibility protection.
- No undocumented `data-testid` — every new testid must appear in the sprint spec before coding begins.
- No "works correctly" acceptance criteria — every criterion must be falsifiable with exact paths, query params, HTTP status codes, `data-testid`s, or persistence checks.
- Do not assume a file exists because a class or concept exists. The class may be inlined in an API file. The file you expect may not exist.

---

## Repository Lookup Rules

- When a sprint spec references a "repository" class by name (e.g. `InvoiceRepository`), ALWAYS confirm both:
  - (a) a dedicated file at `*/repositories/{Name}.js`, AND
  - (b) an inline class definition in the API file (`*/api/{resource}.js`)

  before treating field names or method signatures as known. The class may be inlined — the file you expect may not exist.

  > *Added S16: `InvoiceRepository.js` did not exist on disk. The class is inlined inside `ad-server/src/api/invoices.js`.*

- When a spec says "update `{doc file}`", read the **full content** of that doc file during Step 1 — not just confirm the path exists. A section may be missing entirely.

  > *Added S16: `DATABASE_SCHEMA.md` had no `invoices` collection section prior to this sprint.*

- `App.jsx` is the authority for all client-side routes unless live source proves otherwise.
- Server routing must be confirmed from the repo tree — not assumed from naming conventions.

---

## Deploy & Environment Gates

- Any task whose acceptance criterion requires a CLI deploy tool (`firebase`, `gcloud`, `kubectl`, etc.) MUST confirm the config file that tool requires exists on disk:
  - Firebase CLI → `firebase.json` + `.firebaserc`
  - gcloud → `app.yaml` or equivalent

  If the config file is absent, the acceptance criterion must be marked `ENVIRONMENT-GATED` and the task must include an explicit resolution: create the config file, or document the manual CLI alternative with the exact flag sequence.

  > *Added S16: `firebase.json` absent from repo root. S16-3 Tier 2 deploy left partially open.*

- Firestore index deploys that have no `firebase.json` must document three deploy paths in the spec:
  - **Option A** — add `firebase.json`, then `firebase deploy --only firestore:indexes --project <id>`
  - **Option B** — firebase-tools direct (no `firebase.json` required): `firebase firestore:indexes --project <id>`
  - **Option C** — Google Cloud Console: Firestore → Indexes → Add composite index manually

- Any acceptance criterion that requires a deployed external service (Firebase, Stripe, etc.) must be marked `ENVIRONMENT-GATED` and assigned an owner who can run it manually before the DoD checkbox is considered closeable.

---

## Scope & Atomicity

- Status enum migrations (uppercase → lowercase, or any rename) require:
  1. A backfill migration script confirmed **on disk** before the API change lands.
  2. The API change and backfill script in a **single atomic commit** or same-session push.
  3. A staging run of the backfill script with `{"scanned": N, "updated": M}` verified `M > 0` before production promotion.
  4. The migration script must be idempotent — running it twice on a clean database must output `{"updated": 0}`.

- Never widen the blast radius of a shared backend change mid-sprint without re-running Step 4.

---

## Pre-Check Protocol

Every pre-check listed in a sprint spec must:

1. Name the **exact file path** to read or grep.
2. Name the **exact field, method, or pattern** being confirmed.
3. Include a **deterministic discovery command** — `grep -n`, `find`, `cat`, or a repo read — that produces a binary yes/no answer.
4. Be executed **before any code is written** that depends on its output.
5. If the pre-check returns a negative result (file not found, field not present), the task it blocks must be flagged `BLOCKED` and not coded until the blocker is resolved.

---

## Test & CI

- Every new test file must be listed in the sprint spec **File Inventory** before coding begins.
- Integration tests that reference status enums must be updated in the **same commit** as the enum change — not in a follow-up task.
- Any acceptance criterion that requires a deployed external service must be marked `ENVIRONMENT-GATED` and assigned an owner.
- Test IDs referenced in sprint specs must be confirmed from the actual test file content — not inferred from test description text.

---

## Acceptance Criteria Standards

All acceptance criteria must be **falsifiable**. Accepted forms:

| Type | Example |
|---|---|
| HTTP status | `POST /api/loops/:id/approve` returns `200` with `{status: "approved"}` |
| Route existence | `App.jsx` contains `<Route path="advertiser/invoices">` |
| Field value | `loop.status === 'approved'` (lowercase) after migration script |
| Persistence | Hard-refresh at `/advertiser/invoices` does not 404 |
| Test assertion | `integration_broadcasting.spec.js` — all 3 S11 tests pass with exit code 0 |
| CLI exit code | `firebase deploy --only firestore:indexes` exits `0` on staging |
| Script output | `migrate-loop-status-lowercase.js` outputs `{"scanned": N, "updated": M}` where `M > 0` on first staging run |

**Banned phrases** in acceptance criteria:
- "works correctly"
- "functions as expected"
- "displays properly"
- "no errors"
- "loads successfully"

---

## State Validation

- **No Ghost UI Components:** Never generate fake IDs or ephemeral UI components (e.g., `loop_screen01_fake`) when the backend returns empty or missing inventory. A lack of inventory must visibly block the UI flow (e.g., disable calendar dates, disable checkout button, display a warning banner) instead of hiding the absence.
- **Fail Loudly on Mutation:** Any API route that commits a booking, payment, or schedule change must perform an all-or-nothing check *before* writing to the database. If any required dependency returns `null/undefined` (e.g., `loopRepository.findById(id)`), the transaction must instantly abort and throw a `400 Bad Request`. Never `continue` or ignore the failure silently.
- **Descriptive Fallbacks:** Always return the explicit reason for engaging a generic fallback mode if the optimal state is missing. (e.g., A physical Player failing to an offline banner must be able to log or return `{ fallback_mode: true, reason: "UNAPPROVED_INVENTORY" }` instead of quietly failing).

---

## Changelog

| Sprint | Section Updated | Rule Added |
|---|---|---|
| S16 | Repository Lookup Rules | Inline class rule (`InvoiceRepository` pattern) |
| S16 | Repository Lookup Rules | Read full doc content in Step 1 |
| S16 | Deploy & Environment Gates | `firebase.json` absence → `ENVIRONMENT-GATED` label |
| S16 | Deploy & Environment Gates | Three-path Firestore index deploy options |
| S16 | Anti-Hallucination | "Class may be inlined" rule |
| MVP | State Validation | Establish Loud API mutations and disable Ghost UI |

---

## Strict API Smoke Testing Alignment
- **Mandatory Variable Enforcement:** Test automation frameworks and smoke tests must respect backend input validation layers. Attempting to hit `/api/impressions` without a scope (e.g., `date` and `campaign_id`) will accurately fail. Test payloads must mirror actual production security and efficiency guardrails.
- **Method Specificity:** Endpoints restricted to ingestion (e.g. Telemetry/Monitoring) use POST inherently. Automated verification tests must use the correct HTTP methods and provide structural mock payloads to truly verify "liveness".

## Rules for Playwright POM Intregation
**Rule 11: Anti-Ghosting Checklist Enforcement**
Implementation checklists (e.g., mapping data-testid properties) must **never** be manually checked off based on "eyes-on-code" confidence. If you inject a test property, you must guarantee it functions by explicitly compiling the project (
pm run build) and confirming the test suite executes successfully (
px playwright test). Trusting visual confirmation leads to broken syntax hooks and mismatched strings (e.g. calendar vs calendar-container).
