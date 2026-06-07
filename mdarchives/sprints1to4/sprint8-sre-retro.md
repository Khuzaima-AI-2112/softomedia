# Sprint 8 — SRE/QA Retrospective &amp; Guardrails

**Sprint:** 8  
**Date:** 2026-06-05  
**Reviewer:** SRE/QA Lead (AI-assisted)  
**Source of truth:** commit history `796768..a68621`, `docs/sprint7and8.md`, live file map in `App.jsx`

---

## 1. Failure Mode Narrative

The following issues either blocked a story from being written cleanly or required a corrective commit during the same sprint.

### FM-1 · Missing API method — `updateCampaignStatus` not in `ApiService.js`
**Story:** S8-1  
**Root cause:** `CampaignApprovalList.jsx` was written to call `apiService.updateCampaignStatus(id, status)` in an earlier sprint, but the method was never added to `ApiService.js`. The sprint planning doc described the *behaviour* of the call but never verified the method existed.  
**Impact:** Any retailer admin visiting the approval queue would receive a runtime `TypeError: apiService.updateCampaignStatus is not a function` on first button click — silent in planning, crash in QA.

### FM-2 · Wrong route + wrong request body shape — `bookSlots()` misaligned with backend
**Story:** S8-2  
**Root cause:** The frontend called `POST /campaigns/:id/slots` with `{ slot_ids: [...] }`. The actual Express route registered in `campaigns.js` is `POST /:id/book` and expects `{ slots: [...] }`. Two independent mismatches (path segment *and* body key) coexisted because no "route contract" document existed to cross-check against.  
**Impact:** Every slot-booking attempt would return 404. Neither the frontend task nor the backend task for this feature pointed at a shared route definition — each was written from memory.

### FM-3 · Missing auth guard on a state-mutation route — `PATCH /:id/status` was public
**Story:** S8-3  
**Root cause:** When the status-change endpoint was scaffolded, `requireRole(...)` was not added. The AC for the original story said "only retailers can approve campaigns" but never stated which middleware call must be present, making the requirement non-falsifiable at code review.  
**Impact:** Any unauthenticated or wrong-role request could flip a campaign's status. Security regression existed in-tree for at least one sprint before S8-3 caught it.

### FM-4 · Status string case mismatch — writer used `'APPROVED'`, reader filtered for `'approved'`
**Story:** S8-4  
**Root cause:** The approval handler wrote status values to Firestore in uppercase (`'APPROVED'`, `'REJECTED'`). The `getAvailableCampaigns()` query filtered for lowercase `'approved'`. Neither the schema doc nor the AC ever specified a canonical case.  
**Impact:** Approved campaigns never appeared in the Player's available-campaign list. A silent data integrity bug — no runtime error, just an always-empty feed.

### FM-5 · Wizard submitted `'pending'`; queue filtered for `'pending_approval'`
**Story:** S8-6  
**Root cause:** `BrandCampaignWizard.jsx` set `status: 'pending'` on form submission. The approval queue component (`CampaignApprovalList.jsx`) and the backend `PATCH` whitelist both expected `'pending_approval'`. Three independent files used three different string literals for the same logical state — never reconciled in any AC.  
**Impact:** Newly submitted campaigns never appeared in the retailer's approval queue. The wizard appeared to succeed (no error), but the campaign was invisible to the approver.

### FM-6 · `sprint8.md` placed at repo root, not `docs/`
**Observation:** The sprint planning commit message says "docs: add MVP_SPRINT_PLAN.md and sprint8.md" but the actual sprint doc that accumulated risk scores (`sprint7and8.md`) lives in `docs/`. A standalone `sprint8.md` was not found at `docs/sprint8.md` — suggesting the canonical sprint doc was `docs/sprint7and8.md`. Future readers following a `docs/sprintN.md` convention would not find it.  
**Impact:** Low severity for this sprint, but sets a precedent for inconsistent doc placement that makes retroactive review harder.

---

## 2. Failure Mode Classification

| ID | Category | Where it was detected | Cost |
|---|---|---|---|
| FM-1 | Missing file / method | Runtime crash (not caught in planning) | 1 story corrective commit |
| FM-2 | Route + body contract mismatch | Runtime 404 (not caught in planning) | 1 story corrective commit |
| FM-3 | Vague / non-falsifiable AC | Security regression undetected for ≥1 sprint | Security fix + corrective commit |
| FM-4 | Implicit enum contract | Silent data loss, no error surfaced | Corrective commit + data audit needed |
| FM-5 | Implicit enum contract | Silent empty queue, no error surfaced | Corrective commit |
| FM-6 | File placement convention | Doc discoverability | Low — no corrective commit needed |

---

## 3. Guardrail Rules (Mandatory for Sprint N+1 and beyond)

> **These rules are authoritative.** Every sprint planning doc (sprintN.md) must include a `## Guardrails` section that links to or reproduces this table. Any story that touches a guarded category must satisfy the relevant rule before the story is considered "Ready for implementation."

---

### GUARDRAIL-1 · No method call without a verified source location

**Rule:** Before any story may call a service method (e.g., `apiService.X()`), the method's *exact name and signature* must be confirmed to exist in the source file. If it doesn't exist, add a sub-task: "Add `X()` to `ApiService.js`."

**Enforcement:**  
- Sprint doc must list: `ApiService.js → updateCampaignStatus(id, status)` (or equivalent) as a pre-condition for any story that calls it.  
- No story is marked "Done" if it calls a method that wasn't present in the file before the sprint started and no add-method sub-task was completed.

**Root cause addressed:** FM-1

---

### GUARDRAIL-2 · Every API route must be declared in a route contract before use

**Rule:** Any story that introduces a frontend call to a backend route must cite the *exact* HTTP method, path, and request body shape — and that shape must match what is registered in the Express router file (`campaigns.js`, `telemetry.js`, etc.). If the route doesn't exist yet, it must be created in the same sprint as a sibling sub-task.

**Enforcement:**  
- Sprint doc entry format (required): `PATCH /api/campaigns/:id/status → { status: string }` — confirmed in `campaigns.js`.  
- A story whose `curl` or Postman example doesn't match the router registration fails acceptance.

**Root cause addressed:** FM-2

---

### GUARDRAIL-3 · Every state-mutation route must name its auth guard in AC

**Rule:** Acceptance criteria for any route that writes, updates, or deletes data must include an explicit statement of the required role and the middleware function call. "Only admins can do X" is not sufficient — the AC must say "`requireRole('retaileradmin')` present on the route."

**Enforcement:**  
- Stories touching `POST`, `PUT`, `PATCH`, or `DELETE` routes must have an AC line: `Auth: requireRole('[role]') confirmed`.  
- A route missing its guard fails review regardless of whether the business logic is correct.

**Root cause addressed:** FM-3

---

### GUARDRAIL-4 · All status/enum values must be declared canonical in the schema doc before use

**Rule:** Any string that flows from a writer (wizard, API handler) to a reader (filter query, queue component) is an **enum contract**. Before a story uses such a string, the canonical value must be documented in `docs/DATABASE_SCHEMA.md` (or equivalent) and all existing usages reconciled. Canonical values are **always lowercase, underscore-separated**.

**Enforcement:**  
- Sprint planning must list: `Campaign.status enum: pending_approval | approved | rejected | active | paused` (or current agreed set).  
- A story that introduces or reads a status string must cite which line of the schema doc it is conforming to.  
- A find-in-repo grep for all string literals matching the enum values must return zero uppercase variants before the story is closed.

**Root cause addressed:** FM-4, FM-5

---

### GUARDRAIL-5 · Sprint docs live at `docs/sprintN.md` — no exceptions

**Rule:** Sprint planning and retrospective documents are placed at `docs/sprintN.md` (e.g., `docs/sprint9.md`). Combined docs (e.g., `sprint7and8.md`) are permitted only when explicitly noted in `docs/MVP_SPRINT_PLAN.md`. Docs at the repo root or with non-standard filenames must be moved before the sprint is considered closed.

**Enforcement:**  
- Sprint close checklist: confirm `docs/sprintN.md` exists and `docs/MVP_SPRINT_PLAN.md` links to it.

**Root cause addressed:** FM-6

---

## 4. Sprint Doc Template — Required `## Guardrails` Section

Copy this block verbatim into every `docs/sprintN.md`:

```markdown
## Guardrails

This sprint conforms to the Softomedia SRE/QA Guardrail Rules established in
[`docs/sprint8-sre-retro.md`](./sprint8-sre-retro.md). Before any story is
marked Ready, confirm:

| Rule | Check |
|---|---|
| **GUARDRAIL-1** Method existence | Every `apiService.X()` call verified in `ApiService.js` |
| **GUARDRAIL-2** Route contract | HTTP method + path + body shape confirmed in Express router |
| **GUARDRAIL-3** Auth guard named in AC | `requireRole('X')` explicitly stated for all mutation routes |
| **GUARDRAIL-4** Enum values canonical | Status strings match `docs/DATABASE_SCHEMA.md`; lowercase only |
| **GUARDRAIL-5** Doc placement | This file is at `docs/sprintN.md` |
```

---

## 5. Immediate Actions (Sprint 9 Pre-conditions)

- [ ] **ENUM AUDIT** — grep entire codebase for `'APPROVED'`, `'REJECTED'`, `'PENDING'`, `'pending'` and replace with canonical values per GUARDRAIL-4. Assign to backend lead.
- [ ] **ROUTE CONTRACT DOC** — add a `docs/API_ROUTES.md` listing every registered Express route, method, path, body shape, and auth guard. This is the authoritative reference for GUARDRAIL-2.
- [ ] **SCHEMA UPDATE** — add `Campaign.status` enum definition to `docs/DATABASE_SCHEMA.md`.
- [ ] **SPRINT DOC** — create `docs/sprint9.md` (not a combined file) with the Guardrails section from §4 above included.
- [ ] **IMPRESSION ENDPOINT PHASE 2** — `telemetry.js:POST /impression` currently logs only. Add Firestore persistence sub-task to Sprint 9 backlog. Track as `// TODO Phase 2` already in the file.

---

*Retrospective authored from live commit history `796768..a68621` on `main`, 2026-06-05.*
