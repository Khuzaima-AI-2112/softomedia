# Sprint 15 — Retrospective (Step 7)

**Sprint:** 15 — Monetization, Pricing Config & Billing
**Retro date:** 2026-06-08
**Grounded against:** HEAD [`1051b85`](https://github.com/cfroszte/softomedia-live2026/commit/1051b85dbe5f97abc78c95ccd3a73227a1045058)
**Commits in scope:** [`067b2f2`](https://github.com/cfroszte/softomedia-live2026/commit/067b2f2af2061d5135961436a4e9f618542a2645) → [`1051b85`](https://github.com/cfroszte/softomedia-live2026/commit/1051b85dbe5f97abc78c95ccd3a73227a1045058) (16 commits)

---

## 1. Failure Modes This Sprint

### FM-S15-1 — `pricing.js` misclassified as CREATE in Step 2

**What happened:** The Step 2 spec said to CREATE `ad-server/src/api/pricing.js`. The file already existed (SHA `bcb2566d`), was already imported into `src/api/index.js`, and had live handlers at `GET /config` (line 33) and `PUT /config` (line 44). Step 4 audit caught this before any code was written, but it required a corrective commit ([`3b4f031`](https://github.com/cfroszte/softomedia-live2026/commit/3b4f031b4880acc4f53ee05f0db182f1e1c5c6c2)) and delayed Step 3.

**Root cause:** Step 1 grep output for `pricing.js` was misread as “not on disk.” The file exists at `ad-server/src/api/pricing.js` — a path not searched with sufficient specificity.

**Guardrail added:** → **GUARDRAIL-9** (see below)

---

### FM-S15-2 — Security gaps discovered mid-sprint via Step 4, not Step 1

**What happened:** `GET /api/pricing/config` was publicly accessible (no auth) and `PUT /api/pricing/config` had `authenticate` but no `requireRole`. These were live security gaps (SEC-S15-5, SEC-S15-6) that Step 1 did not surface because Step 1 only checked file existence and route registration, not middleware composition on existing handlers.

**Root cause:** Step 1 reality-check protocol stops at “does the route exist?” It does not inspect the middleware chain of existing handlers.

**Guardrail added:** → **GUARDRAIL-10** (see below)

---

### FM-S15-3 — `PATCH /config` → `PUT /config` method correction required

**What happened:** Step 2 spec wrote `PATCH /api/pricing/config`. The live handler at `pricing.js` L44 uses `router.put(...)`. The mismatch would have caused 404s from the frontend had it not been caught in Step 4.

**Root cause:** HTTP method was assumed from convention rather than confirmed from live source. `pricing.js` was not read before Step 2 was written.

**Guardrail added:** → **GUARDRAIL-9** (reinforces read-before-spec rule)

---

### FM-S15-4 — `CPMCalendar.jsx` anonymous-call risk raised too late

**What happened:** After deciding to add `authenticate` to `GET /api/pricing/config`, RISK-S15-8 was raised: `CPMCalendar.jsx` might call that endpoint without a token. This risk was only identified during Step 4 audit — after the security hardening was already spec’d. It required a mandatory pre-check in S15-1 before the edit could safely land.

**Root cause:** When hardening an existing public endpoint, downstream callers of that endpoint were not enumerated in Step 1.

**Guardrail added:** → **GUARDRAIL-11** (see below)

---

### FM-S15-5 — `PricingService.js` planned as mandatory, demoted to optional mid-sprint

**What happened:** Step 2 spec created `PricingService.js` as a required intermediary service layer. Step 4 confirmed that the existing pattern (`pricing.js` calling `PricingRepository` directly) made a service layer redundant. The task was re-labelled optional and no `PricingService.js` was committed.

**Root cause:** Service-layer creation was assumed from architectural convention without confirming whether a service layer was already in use for this domain.

**Guardrail added:** → **GUARDRAIL-12** (see below)

---

### FM-S15-6 — Doc stories (S15-5 / S15-6) and sidebar nav carried to sprint close-out, not planned inline

**What happened:** `API_ROUTES.md` and `DATABASE_SCHEMA.md` updates were written as story tasks in the spec but not executed until after all code was committed. The sidebar nav links (`DashboardLayout.jsx`) were not in the original spec at all — they surfaced as an outstanding item during the DoD audit.

**Root cause:** Doc and nav tasks are low-drama 1pt items that get deprioritized when code tasks run long. No spec rule required doc stories to be committed before the code story they document is merged.

**Guardrail added:** → **GUARDRAIL-13** (see below)

---

### FM-S15-7 — S11-1/2/4 persistence QA carried for a third consecutive sprint

**What happened:** RISK-S15-3 (S11-1/2/4 persistence outstanding) was re-carried from S13 and S14 without resolution. No action was taken in S15.

**Root cause:** Carry-over risks with no owner or scheduled resolution slot drift indefinitely.

**Guardrail added:** → **GUARDRAIL-14** (see below)

---

## 2. What Went Well

- **Step 4 audit caught all spec errors before code was written.** All 8 corrections (pricing.js CREATE→EDIT, method PATCH→PUT, router target, auth gaps, etc.) were documented and applied before a single byte of production code landed.
- **Blast radius was fully additive.** No existing route, handler, or component was broken. `App.jsx` edits were GUARDRAIL-1/2 gated correctly. `src/api/index.js` append was isolated.
- **Security register was expanded mid-sprint.** SEC-S15-5 and SEC-S15-6 were discovered, documented, and fixed within the same sprint — not deferred.
- **All 9 planned file operations landed.** 16 commits, zero rollbacks, no regressions on existing routes.
- **Repo Grounding Score held at 97%** after Step 4 corrections. The 3% residual (Firestore emulator availability, `CampaignRepository.findById` name) was correctly flagged and pre-checked before coding.

---

## 3. Updated Guardrails

> Copy this section into the header of the next sprint spec. Supersedes any prior guardrails list.

### GUARDRAIL-1 — App.jsx is route authority
`App.jsx` is the single source of truth for client-side routes. No frontend page may be referenced in a sprint spec unless its route is confirmed present in `App.jsx`, OR the story explicitly registers the route as part of its own scope. Route registration must happen in the same commit as the page file — never before, never after.

### GUARDRAIL-2 — No route without confirmed live source
Server routes must be confirmed from the actual router file before any spec row is written. `API_ROUTES.md` is the documentation target, not the discovery source. Confirmation = `grep -n "router\.(get|post|put|patch|delete)"` on the live file.

### GUARDRAIL-3 — No undocumented data-testid
Every `data-testid` introduced in a sprint must be listed explicitly in the task’s acceptance criteria. `data-testid` values must be unique across the repo. No “works correctly” acceptance criteria — every criterion must be falsifiable with a status code, testid, persistence check, or grep.

### GUARDRAIL-4 — Canonical enum values (lowercase, underscore-separated)
All status and workflow string values must match `DATABASE_SCHEMA.md § Canonical Enum Values`. New enum values must be added to that section in the same commit that introduces the first write. No uppercase variants outside test fixtures.

### GUARDRAIL-5 — No shared middleware change without backward-compatibility proof
Any edit to shared middleware (`authenticate`, `requireRole`, `impressionLimiter`, etc.) must include a backward-compatibility statement: which existing routes use this middleware, and how the change affects each. If impact is non-zero, the task requires explicit regression tests.

### GUARDRAIL-6 — No hardcoded API URLs in frontend
All frontend API calls must go through `apiClient` (or the project’s equivalent service layer). No `fetch('/api/...')` literals. Base URL is environment-variable-driven. Confirmed by `grep -r "fetch\(" client-app/src --include="*.jsx" --include="*.js"` returning zero direct `/api` hits.

### GUARDRAIL-7 — API_ROUTES.md updated in the same sprint as route creation
Every new route registered in a router file must have a corresponding row added to `docs/API_ROUTES.md` in the same sprint. This is not a post-sprint cleanup task. The doc commit may be a separate commit but must land before the sprint is marked done.

### GUARDRAIL-8 — DATABASE_SCHEMA.md updated before first Firestore write
Any new Firestore collection must have its schema documented in `DATABASE_SCHEMA.md` before or in the same commit as the first write handler. Migrations or index notes must also appear here.

### GUARDRAIL-9 — Read existing files before writing spec tasks that touch them *(NEW S15)*
If a sprint story references a file as a target for CREATE, EDIT, or DELETE: the file **must be read in full** (not just searched for) before the story is spec’d. Confirming a file’s existence is not sufficient — the handler list, middleware chain, and import graph must be understood. A misclassified CREATE-vs-EDIT is a spec error that cascades into corrective commits.

### GUARDRAIL-10 — Inspect middleware chain of existing handlers before hardening *(NEW S15)*
When a sprint story proposes to harden an existing route (add auth, add role guard, add rate limit), the **full middleware chain of that handler must be read from source** before the spec is written.

### GUARDRAIL-11 — Enumerate downstream callers before hardening a public endpoint *(NEW S15)*
Before adding `authenticate` or `requireRole` to any route that is currently public or authenticate-only, grep all frontend callers and confirm each passes a valid auth token.

### GUARDRAIL-12 — Confirm service-layer pattern before creating a service file *(NEW S15)*
Before creating a new `*Service.js` file, check whether the domain’s router already calls its repository directly. If yes, a service layer is optional.

### GUARDRAIL-13 — Doc and nav stories are blocking, not best-effort *(NEW S15)*
`API_ROUTES.md`, `DATABASE_SCHEMA.md`, and sidebar nav link stories are blocking items in the Definition of Done.

### GUARDRAIL-14 — Carry-over risks must have a resolution sprint assigned *(NEW S15)*
Any risk carried from a prior sprint must have a scheduled resolution sprint or an explicit deferral decision with a reason.

---

## 4. Carry-Forwards to Sprint 16

| Item | Type | Source | Priority |
|---|---|---|---|
| S11-1/2/4 persistence QA | QA carry-over (3rd sprint) | RISK-S15-3 | 🔴 Must schedule or close |
| Firestore composite index on `invoices(advertiser_id, generatedAt DESC)` | Infra | DATABASE_SCHEMA.md note | 🟡 Pre-production |
| Firestore composite index on `campaigns.advertiser_id` | Infra | RISK-S15-5 | 🟡 Pre-production |
| Real PDF generation for `GET /api/invoices/:id/pdf` | Feature | S15-2 stub | 🟢 Post-MVP |
| `PricingService.js` — optional thin wrapper | Architecture | FM-S15-5 | 🟢 Optional |
| ENUM-AUDIT-1 (`loops.status` uppercase migration) | Tech debt | DATABASE_SCHEMA.md | 🟡 Schedule or close |
| ENUM-AUDIT-2 (`playlists.status` uppercase migration) | Tech debt | DATABASE_SCHEMA.md | 🟡 Schedule or close |

---

*Retro authored: 2026-06-08 — Sprint 15 complete. 14 guardrails active for S16.*
