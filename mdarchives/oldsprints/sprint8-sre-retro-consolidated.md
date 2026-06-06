# Sprint 6, 7 & 8 — SRE/QA Retrospective & Guardrails (Consolidated)

**Sprints reviewed:** 6, 7, 8  
**Date:** 2026-06-05  
**Reviewer:** SRE/QA Lead (AI-assisted)  
**Source of truth:** Live commit history on `main`, `docs/sprint7and8.md`, commit messages PR1–PR4 + Sprint 7 + Sprint 8 (S8-1..S8-7)

---

## Executive Summary

Across three sprints the same categories of failure recurred: **missing or mis-named artefacts** (methods, routes, components), **implicit contracts** between producer and consumer that were never written down (status enums, route shapes, body keys), and **non-falsifiable acceptance criteria** that said what a feature should *feel like* rather than what it must *verify*. Each category is documented below with its sprint-specific instances and a permanent guardrail rule.

---

## Sprint 6 — Failure Modes

Sprint 6 delivered `ScheduleHistory`, `ScheduleManager`, and `TechOpsDashboard`. Evidence sourced from PR2, PR3, PR4 commit messages and post-hoc orphansFIX4/5 remediation docs.

### S6-FM-1 · Orphaned component referenced before it existed — `Step3ReviewDistribution.jsx`

**What happened:** `BrandCampaignWizard.jsx` had no import of `Step3ReviewDistribution.jsx`, yet the file existed at `pages/brand/`. It was written as if it were the distribution preview step but was never wired. This was only caught during the orphansFIX4/5 sweep and required a separate chore commit to delete it.  
**Root cause:** A component was created in one session and never added to the wizard's step router. No "file-to-route" verification step existed at story completion.  
**Blast radius:** Dead code with stale service imports — risk of silent import-time errors in some bundlers. Deleted in PR1.

### S6-FM-2 · ScheduleHistory hardcoded `retailers[0]` — no auth scope

**What happened:** `ScheduleHistory.jsx` loaded retailer data by calling `getRetailers()` and using `retailers[0]` — the first retailer in the system — rather than the authenticated user's retailer ID. Any retailer logging in would see another retailer's schedule history.  
**Root cause:** The AC for the story said "shows schedule history for the retailer" but never required the data to be scoped to `authedRetailerId` from `AuthContext`. The fix (Task 2.3) required introducing `useAuth()` and replacing the hardcode — work that should have been in the original story.  
**Blast radius:** Privacy regression. Every retailer saw the same (wrong) data.

### S6-FM-3 · Bulk-approve and per-slot-reject backend endpoints unconfirmed at story write time

**What happened:** `ScheduleManager.jsx` called `POST /api/locations/:id/loops/approve-all` and `POST /api/loops/:loopId/reject` — both endpoints were marked `// FIXME: unconfirmed` in the commit message. The frontend was written against assumed endpoints, not verified ones.  
**Root cause:** Stories 3.4 and 3.5 specified the frontend behaviour and the assumed endpoint path, but neither task had a paired backend sub-task to confirm or create the route before the frontend consumed it. This is the same pattern as Sprint 8's FM-2.  
**Blast radius:** Bulk approval and per-slot rejection silently 404 in production until backend routes are confirmed.

### S6-FM-4 · TechOpsDashboard posts `user_id` from `localStorage` — known broken pattern

**What happened:** Task 4.3 (audit logging for screen restart) reads `user_id` from `localStorage` to include in the audit log. The commit message itself flags this: `FIXME: localStorage is blocked in sandboxed iframes`. The pattern was committed anyway.  
**Root cause:** The AC for audit logging said "include user_id" without specifying the source. The implementer defaulted to `localStorage`, which is the only available option without an AuthContext integration — but it was known to be unreliable in the target environment.  
**Blast radius:** Audit log entries have null/undefined `user_id` in all sandboxed environments. Compliance risk for operations that require attributable audit trails.

### S6-FM-5 · Timezone field assumed on backend location schema — no verification

**What happened:** Task 3.2 (timezone display in ScheduleManager) resolves timezone from `location.timezone`. The commit message flags: `FIXME: backend location schema may lack timezone field`. The field was used without confirming it existed in the DB schema. A null-safe fallback (`Intl.DateTimeFormat().resolvedOptions().timeZone`) was added, but this produces the *server's* timezone, not the screen's location timezone — silently wrong data for remote screens.  
**Root cause:** The story assumed the schema had a `timezone` field because the UI needed it. `docs/DATABASE_SCHEMA.md` was never consulted.  
**Blast radius:** All screens outside the server's local timezone show incorrect approval cutoff times.

---

## Sprint 7 — Failure Modes

Sprint 7 addressed Player resilience and content compliance. Evidence sourced from `docs/sprint7and8.md` SRE risk register (R1–R7) and the Sprint 7 commit (`71464c7`).

### S7-FM-1 · `fetchCurrentLoop` duplicated inline — two divergent implementations

**What happened:** `Player.jsx` had `fetchCurrentLoop` defined as a `useCallback` at L39, AND the same logic duplicated inline inside `initializePlayer` at L103–L116. The sprint planning doc explicitly warned "do not assume they are identical — they are NOT." The inline version did not call the outer `fetchCurrentLoop`; it duplicated and potentially diverged from the logic.  
**Root cause:** When `initializePlayer` was originally written, the author copy-pasted loop-fetch logic rather than calling the existing `useCallback`. No PR review caught the duplication. Future edits to one copy did not propagate to the other.  
**Blast radius:** Any bug fix touching only `fetchCurrentLoop` silently left `initializePlayer`'s inline copy broken.

### S7-FM-2 · Loop fetch returned full day dataset — no server-side scope

**What happened:** `Player.jsx` called `GET /api/loops?date=...` and filtered client-side for current hour and APPROVED status. At scale, 100 screens × full daily dataset per hour = N×full-dataset unscoped queries. Logged as SRE Risk R2 (HIGH) before Sprint 7.  
**Root cause:** The original story AC said "fetch today's loops" — not "fetch only the current hour's approved loops." The server-side filter was a Sprint 7 remediation, not an original requirement.  
**Blast radius:** Performance degradation at scale. Each screen downloads 24 hours of data when it needs 1.

### S7-FM-3 · `initializePlayer` had no retry — permanent dark screen on startup blip

**What happened:** Any single network failure during startup set `status='error'` with no recovery. Logged as SRE Risk R3 (HIGH). A screen that booted during a brief API outage stayed dark permanently.  
**Root cause:** The original AC said "display error state on failure" — implemented literally. No AC required retry on transient failure. Discovered through SRE risk analysis, not the original story.  
**Blast radius:** Screens in unreliable startup environments go permanently dark without self-healing.

### S7-FM-4 · Status string `'APPROVED'` case mismatch — flagged but not resolved

**What happened:** SRE Risk R4 flagged `Player.jsx` filters for `l.status === 'APPROVED'` (uppercase) while `LoopRepository.js` uses mixed-case. Task 7.3 added a `// FIXME` comment but did NOT resolve the mismatch. The same class of bug independently manifested in Sprint 8 (FM-4, FM-5).  
**Root cause:** Identified as a risk, deferred without creating a story to own the fix. No canonical enum definition existed.  
**Blast radius:** Player silently skips all approved loops if LoopRepository persists lowercase `'approved'`. Screens go dark with no error.

### S7-FM-5 · Upload component path unknown at story write time

**What happened:** Task 7.5 (upload validation) was written with the note: "the upload component path is UNKNOWN — it must be located via grep before editing."  
**Root cause:** No component map existed. The story was scoped to a feature area, not a file. Implementers required an unplanned discovery step.  
**Blast radius:** Story cannot be executed without investigation; risk of editing the wrong file.

---

## Sprint 8 — Failure Modes (Summary)

See [`docs/sprint8-sre-retro.md`](./sprint8-sre-retro.md) for full detail.

| ID | Description |
|---|---|
| S8-FM-1 | `updateCampaignStatus()` missing from `ApiService.js` — runtime crash |
| S8-FM-2 | `bookSlots()` wrong route (`/slots` vs `/book`) + wrong body key |
| S8-FM-3 | `PATCH /:id/status` had no `requireRole` guard — security regression |
| S8-FM-4 | Status written `'APPROVED'` (uppercase), read `'approved'` (lowercase) — silent data loss |
| S8-FM-5 | Wizard submitted `'pending'`; queue expected `'pending_approval'` — silent empty queue |
| S8-FM-6 | Sprint doc at `docs/sprint7and8.md` — not canonical `docs/sprint8.md` |

---

## Cross-Sprint Pattern Analysis

| Category | Sprint 6 | Sprint 7 | Sprint 8 |
|---|---|---|---|
| **Missing / mis-named artefact** | FM-1 (orphan), FM-3 (unconfirmed endpoints) | FM-5 (unknown upload component) | FM-1 (missing method), FM-2 (wrong route) |
| **Implicit shared contract** | FM-2 (hardcoded scope), FM-5 (assumed schema field) | FM-1 (duplicated fn), FM-2 (unscoped query), FM-4 (case mismatch) | FM-4 (uppercase status), FM-5 (wrong status string) |
| **Non-falsifiable AC** | FM-4 (localStorage for user_id), FM-3 (endpoint assumed) | FM-3 (no retry in original AC) | FM-3 (no requireRole in AC) |

Every sprint had at least one instance of each category.

---

## Consolidated Guardrail Rules

> **Authoritative for Sprint 9 and all future sprints.** Every `docs/sprintN.md` must include the `## Guardrails` section (template below).

### GUARDRAIL-1 · No method call without verified source location
Before any story calls a service method, the method's exact name and signature must be confirmed in the source file. If absent, add a sub-task to create it.
*Addresses: S8-FM-1, S6-FM-3*

### GUARDRAIL-2 · Every API call requires a route contract before story is Ready
Cite exact HTTP method, path, and body shape confirmed in the Express router. If the route doesn't exist, a paired backend sub-task must create it in the same sprint.  
Format: `PATCH /api/campaigns/:id/status → { status: string } — confirmed in campaigns.js`  
*Addresses: S8-FM-2, S6-FM-3, S7-FM-5*

### GUARDRAIL-3 · Every mutation route AC must name its auth guard
AC for any `POST/PUT/PATCH/DELETE` route must include: `Auth: requireRole('[role]') confirmed on route`. Prose is not sufficient.  
*Addresses: S8-FM-3*

### GUARDRAIL-4 · All status/enum values declared canonical before use
Canonical values are **always lowercase, underscore-separated**, in `docs/DATABASE_SCHEMA.md`. A grep for uppercase variants must return zero before story close.  
**Current canonical sets:**
- `Campaign.status`: `pending_approval | approved | rejected | active | paused`
- `Loop.status`: `draft | pending | approved | rejected`  
*Addresses: S8-FM-4, S8-FM-5, S7-FM-4*

### GUARDRAIL-5 · Sprint docs live at `docs/sprintN.md`
No combined files, no root-level placement, without an explicit note in `MVP_SPRINT_PLAN.md`.  
*Addresses: S8-FM-6*

### GUARDRAIL-6 · No component created without a verified import in its parent
Every new `.jsx` file must be imported and rendered before the story is Done. If not yet consumed, list it as a TODO sub-task. `App.jsx` file map comment must be updated in the same commit.  
*Addresses: S6-FM-1*

### GUARDRAIL-7 · Auth-scoped data must use `useAuth()` — `localStorage` banned for identity
Any component loading data filtered by authenticated identity must source the ID from `useAuth()`. `localStorage` is blocked in sandboxed iframes and is banned for identity data.  
*Addresses: S6-FM-2, S6-FM-4*

### GUARDRAIL-8 · Schema field usage requires schema doc confirmation
Before reading a field from an API response, that field must exist in `docs/DATABASE_SCHEMA.md`. If absent, a migration sub-task is required in the same sprint.  
*Addresses: S6-FM-5*

---

## Sprint Doc Template — Required `## Guardrails` Section

Copy this block verbatim into every `docs/sprintN.md`:

```markdown
## Guardrails

This sprint conforms to the Softomedia SRE/QA Guardrail Rules in
[`docs/sprint8-sre-retro-consolidated.md`](./sprint8-sre-retro-consolidated.md).

Before any story is marked **Ready**, confirm all applicable rows:

| Rule | Category | Check |
|---|---|---|
| **G-1** Method existence | Artefact | Every `service.X()` call verified in the source file |
| **G-2** Route contract | Artefact | `METHOD /path → { body }` cited and confirmed in Express router |
| **G-3** Auth guard in AC | AC falsifiability | `requireRole('X')` explicitly stated for all mutation routes |
| **G-4** Enum canonical | Implicit contract | Status strings match `DATABASE_SCHEMA.md`; lowercase only; grep clean |
| **G-5** Doc placement | Process | This file is at `docs/sprintN.md` |
| **G-6** Component imported | Artefact | New `.jsx` files imported + `App.jsx` file map updated in same commit |
| **G-7** Auth from `useAuth()` | Implicit contract | No `localStorage` for user/retailer/brand identity |
| **G-8** Schema field confirmed | Implicit contract | API response fields cited in `DATABASE_SCHEMA.md` before use |
```

---

## Immediate Actions Before Sprint 9

- [ ] **ENUM AUDIT** — grep for uppercase status strings (`'APPROVED'`, `'REJECTED'`, `'PENDING'`, `'PENDING_VALIDATION'`) and canonicalise.
- [ ] **`docs/API_ROUTES.md`** — create route contract reference for all registered Express routes.
- [ ] **`docs/DATABASE_SCHEMA.md`** — add `Campaign.status` and `Loop.status` enum definitions; document `location.timezone` field status.
- [ ] **`approve-all` endpoint** — confirm or create `POST /api/locations/:id/loops/approve-all` (S6-FM-3).
- [ ] **`rejection_reason` persistence** — confirm `POST /api/loops/:loopId/reject` stores reason; verify retrievable in ScheduleHistory (S6-FM-3 companion).
- [ ] **`Player.jsx` status case** — resolve `'APPROVED'` vs `'approved'` mismatch (S7-FM-4 FIXME).
- [ ] **Upload component map** — grep and document the upload component path so S7-FM-5 cannot recur.
- [ ] **`docs/sprint9.md`** — new file with Guardrails section included.

---

*Consolidated retrospective covering Sprints 6, 7, and 8. Authored from live commit history on `main`, 2026-06-05.*
