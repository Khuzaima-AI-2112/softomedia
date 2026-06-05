# Sprint 8 — Campaign Handoff + Retailer Gating + Analytics Live Data

**Repo:** `cfroszte/softomedia-live2026`  
**Branch:** `main`  
**Generated:** 2026-06-05  
**Duration estimate:** 3 days  
**Risk level:** 🟡 MEDIUM  
**Depends on:** Sprint 7 complete (specifically Tasks 7.1, 7.3, 7.6)
**Source audits:** `sprint7.md`, `TASKS.md`, `tasks.md`, `TASK_PLAN20260527.md`, `sre-integration-report-sprints1to4.md`, `changelog.md`, live repo file listing (2026-06-05)

---

## Sprint Goal

Close the three largest functional gaps blocking MVP handoff:

1. **Campaign workflow gap** — campaigns are created by brands but never formally transition to `PENDING_VALIDATION`. Retailers have no queue to review and approve incoming brand content. The approval workflow built in Sprint 6 has no entry point from the brand side.
2. **Retailer category gating** — retailers can configure content exclusions in the UI, but `LoopGenerationService` does not enforce them. Any excluded category can still appear in a generated loop.
3. **Analytics live data** — `LoopAnalytics.jsx` still renders mock/hardcoded data. The admin dashboard cannot be used for real operational decisions until live Firestore aggregation is wired.

> **Dependency note:** Sprint 8 should not begin until Sprint 7 Tasks 7.1, 7.3, and 7.6 are merged. Task 7.3 fixes the `status` filter on loop fetch (which Sprint 8 depends on for the validation queue), and Task 7.6 establishes the `StatusBadge` component reused in Sprint 8.

---

## Pre-Sprint Read Requirements

Before editing any file in this sprint, read:

1. **`BUG_FIX_LAN20260527.md`** — all repository layer edits must use `.set({ merge: true })`, not `.update()`. Any new Firestore write must go through `BaseRepository` methods.
2. **`sprint7.md` Task 7.3** — the `server/routes/loops.js` conditional query pattern. Sprint 8 adds a new campaign status endpoint; use the same conditional param pattern.
3. **`sprint7.md` Task 7.6** — `StatusBadge` component. Sprint 8 reuses it in the retailer validation queue. Confirm it was extracted to `src/components/StatusBadge.jsx` or is exported from `LoopBuilder.jsx` before importing.

---

## SRE Risk Register (Sprint 8)

| ID | Severity | File | Risk |
|----|----------|------|------|
| R8-1 | 🟡 MEDIUM | `CampaignBuilder.jsx` | Status transition (`DRAFT` → `PENDING_VALIDATION`) triggers Firestore write — must use `BaseRepository.update()` not raw `docRef.update()` |
| R8-2 | 🟡 MEDIUM | `LoopGenerationService.js` | Enforcing category exclusions changes the shape of generated loops — existing loops already in `APPROVED` state are unaffected, but any re-generation will differ |
| R8-3 | 🟡 MEDIUM | `LoopAnalytics.jsx` | Replacing mock data with live Firestore aggregation queries — if aggregation indexes are not set in Firestore, queries will throw `FAILED_PRECONDITION` at runtime |
| R8-4 | 🟢 LOW | `RetailerDashboard.jsx` | New validation queue renders campaigns scoped to the authenticated retailer — must use `retailerId` from auth context, not `localStorage` |
| R8-5 | 🟢 LOW | `server/routes/campaigns.js` | New PATCH endpoint for campaign status — must validate that only `brand` role can call `SUBMIT_FOR_VALIDATION`, and only `retailer` role can call `APPROVE` / `REJECT` |

---

## Task Map

| Task | Type | Files Touched | Estimated Effort | Outcome Likelihood |
|------|------|---------------|-----------------|-------------------|
| 8.1 | Feature | `CampaignBuilder.jsx`, `server/routes/campaigns.js` | 3–4 hrs | 🟡 70% |
| 8.2 | Feature | `RetailerDashboard.jsx`, `StatusBadge.jsx` (import) | 2–3 hrs | 🟢 80% |
| 8.3 | Feature | `LoopGenerationService.js`, `LoopRepository.js` | 3–5 hrs | 🟡 65% |
| 8.4 | Feature | `LoopAnalytics.jsx`, `server/routes/analytics.js` (new or edit) | 4–6 hrs | 🟡 60% |
| 8.5 | Fix | `RetailerDashboard.jsx` (bulk-approve endpoint) | 1–2 hrs | 🟢 75% |
| 8.6 | Documentation | `changelog.md`, `MVP_SPRINT_PLAN.md` | 30 min | 🟢 95% |

---

## Task Detail

### Task 8.1 — Campaign Submit-for-Validation Transition

**Type:** Feature  
**Files edited:**
- `client-app/src/pages/brand/CampaignBuilder.jsx` *(locate exact path via `grep -r "CampaignBuilder" client-app/src/App.jsx`)*
- `server/routes/campaigns.js` *(read before editing — ORM pattern unknown)*

**Problem in plain terms:**  
Brand users complete the campaign wizard and click a final "Submit" button, but the campaign status stays `DRAFT` — it never becomes `PENDING_VALIDATION`. Retailers therefore never see it in their approval queue. The entire approval workflow from Sprint 6 has no entry point.

**Exact fix — frontend (`CampaignBuilder.jsx`):**
1. On the final wizard step, change the "Submit" button label to **"Submit for Retailer Approval"**.
2. On click, call:
   ```js
   await api.patch(`/api/campaigns/${campaignId}/status`, { status: 'PENDING_VALIDATION' });
   ```
3. On success: show inline confirmation `"Campaign submitted — awaiting retailer approval"` and disable the button to prevent double-submit.
4. On error: show inline error. Do NOT use a toast — the user must see the failure before leaving the wizard.
5. Use `BaseRepository.update()` path (through the API, not a direct Firestore write from the client).

**Exact fix — backend (`server/routes/campaigns.js`):**
1. Add `PATCH /api/campaigns/:id/status` endpoint.
2. Validate:
   - Caller must have role `brand` to transition to `PENDING_VALIDATION`.
   - Caller must have role `retailer` to transition to `APPROVED` or `REJECTED`.
   - Illegal transitions (e.g., `APPROVED` → `DRAFT`) must return `400`.
3. Write status via `BaseRepository.update()` — **not** `docRef.update()` directly. See `BUG_FIX_LAN20260527.md`.
4. On successful transition to `PENDING_VALIDATION`, trigger a notification record in Firestore (`/notifications/{retailerId}`) so the retailer dashboard badge can poll it.

**Verification:**
- Submit a campaign as a brand user → status changes to `PENDING_VALIDATION` → persists after hard-refresh.
- Confirm button is disabled after submit (no double-submit).
- Confirm retailer can see the campaign in their queue (Task 8.2 must be done to verify end-to-end).
- Call `PATCH /api/campaigns/:id/status` as a `retailer` role with body `{ status: 'PENDING_VALIDATION' }` → must return `403`.

**Outcome likelihood: 🟡 70%**  
Frontend change is straightforward. Backend risk: role validation requires the auth middleware to expose the caller's role on `req.user.role` — confirm this is present before writing the guard. If not, the guard cannot be implemented without a Sprint 7 V2-style fix to the auth flow.

---

### Task 8.2 — Retailer Validation Queue

**Type:** Feature  
**Files edited:**
- `client-app/src/pages/retailer/RetailerDashboard.jsx`
- `client-app/src/components/StatusBadge.jsx` *(import — must exist post Sprint 7.6)*

**Problem in plain terms:**  
Retailers have no UI to see campaigns awaiting their approval. Even after Task 8.1 transitions a campaign to `PENDING_VALIDATION`, the retailer has nowhere to view, approve, or reject it.

**Exact fix:**
1. Add a **"Pending Approval"** section to `RetailerDashboard.jsx` — rendered above the existing schedule section.
2. Fetch campaigns via:
   ```js
   GET /api/campaigns?retailerId={retailerId}&status=PENDING_VALIDATION
   ```
   Use `retailerId` from `AuthContext` — **not** `localStorage` (SRE R8-4).
3. Render a card per campaign showing: campaign name, brand name, submitted date, content thumbnail (if available), and two action buttons: **Approve** / **Reject**.
4. Approve → `PATCH /api/campaigns/:id/status { status: 'APPROVED' }`
   Reject → `PATCH /api/campaigns/:id/status { status: 'REJECTED' }` with a required `rejectionReason` text input (inline, not a modal).
5. After approve/reject: optimistically remove the card from the queue. On error: restore the card and show inline error.
6. Show `StatusBadge` (from Sprint 7.6) next to each campaign name: amber for `PENDING_VALIDATION`, green for `APPROVED`, red for `REJECTED`.
7. If queue is empty: render an empty state — `"No campaigns awaiting approval"` — not a blank section.

**Verification:**
- Log in as a retailer. Confirm `PENDING_VALIDATION` campaigns appear in the queue.
- Approve one → card disappears from queue → status persists after hard-refresh.
- Reject one with a reason → card disappears → rejection reason stored and visible to brand on campaign detail.
- Empty state renders correctly when queue is empty.
- Queue shows only campaigns belonging to the authenticated retailer's `retailerId` (not all tenants).

**Outcome likelihood: 🟢 80%**  
Well-scoped. Main risks: (1) `StatusBadge` export — must be confirmed post Sprint 7.6 before importing. (2) The `rejectionReason` inline input may complicate the card layout. Keep it as a simple `<textarea>` that expands on "Reject" click — don't reach for a modal.

---

### Task 8.3 — LoopGenerationService Category Exclusion Enforcement

**Type:** Feature  
**Files edited:**
- `ad-server/src/services/LoopGenerationService.js` *(read before editing — service structure unknown)*
- `ad-server/src/repositories/LoopRepository.js` *(audit for silent-catch pattern per LAN-20260527 — see sprint7.md Task 7.3 note)*

**Problem in plain terms:**  
Retailers can configure content category exclusions (e.g., "no alcohol ads", "no competing brands") in the UI, but `LoopGenerationService` ignores them when building a loop. Excluded category content silently appears on screens.

**Pre-edit grep (run before editing):**
```bash
# Confirm LoopGenerationService structure
grep -n "function\|async\|export\|module.exports" ad-server/src/services/LoopGenerationService.js

# Confirm where retailer exclusions are stored
grep -rn "exclusion\|category\|exclude" ad-server/src --include="*.js" | head -30

# Audit LoopRepository for silent-catch
grep -n "catch\|\.update(" ad-server/src/repositories/LoopRepository.js
```

**Exact fix:**
1. In `LoopGenerationService.generateLoop(screenId, hour)` (or equivalent entry point — confirm via grep above):
   - Before filtering eligible ad slots, fetch the retailer's exclusion list:
     ```js
     const exclusions = await RetailerRepository.getExclusions(retailerId);
     // Returns: [{ category: 'alcohol' }, { category: 'competitor_brand' }, ...]
     ```
   - Filter out any ad slot where `slot.category` is in `exclusions`:
     ```js
     const eligible = slots.filter(s => !exclusions.some(e => e.category === s.category));
     ```
2. If `eligible` is empty after filtering:
   - Do **not** fall back to excluded content.
   - Fill with the offline fallback slots (same pattern as Sprint 7 Task 7.4 `FALLBACK_SLOTS`).
   - Log a warning: `WARN: No eligible slots after exclusion filter for retailerId=${retailerId}, hour=${hour}`.
3. If `LoopRepository` has the silent-catch pattern (found in grep above): fix it using the same `.set({ merge: true })` pattern from `BUG_FIX_LAN20260527.md` before proceeding. Do not write new loop records through a broken repository.

**Verification:**
- Set a retailer exclusion for category `alcohol`.
- Trigger loop generation for that retailer.
- Confirm no `alcohol` category slots appear in the generated loop.
- Confirm exclusion persists after hard-refresh (verifies `BaseRepository` is in the call chain).
- Remove all eligible slots (set all to excluded categories) → confirm loop uses fallback content, not excluded content.

**Outcome likelihood: 🟡 65%**  
`LoopGenerationService` structure is unknown until read. The exclusion data model location (Firestore collection vs. retailer document field) is unknown — must be confirmed via grep. If exclusions are stored as a subcollection, the fetch pattern differs from a simple document field read. This is the highest-uncertainty backend task in Sprint 8.

---

### Task 8.4 — LoopAnalytics Live Firestore Aggregation

**Type:** Feature  
**Files edited:**
- `client-app/src/pages/admin/LoopAnalytics.jsx` *(replace mock data — file size unknown, read first)*
- `server/routes/analytics.js` *(new file or edit — confirm via `ls server/routes/`)*

**Problem in plain terms:**  
`LoopAnalytics.jsx` renders hardcoded/mock data. Admins cannot use it for real operational decisions. This was carried from Sprint 5 as a known gap.

**Pre-edit check:**
```bash
# Confirm analytics route exists
ls server/routes/ | grep analytic

# Find mock data in LoopAnalytics
grep -n "mock\|dummy\|hardcoded\|const data\|const stats" client-app/src/pages/admin/LoopAnalytics.jsx | head -20

# Confirm Firestore indexes for aggregation queries
# Check firestore.indexes.json if it exists
ls | grep firestore
```

**Exact fix — backend:**
1. If `server/routes/analytics.js` does not exist: create it.
2. Add `GET /api/analytics/loops?date=YYYY-MM-DD&retailerId=X` endpoint.
3. Query Firestore for:
   - Total loop plays for the date (count of telemetry events with `type='loop_play'`)
   - Plays by hour (group by `hour` field)
   - Plays by screen (group by `screenId`)
   - Approval rate: count `APPROVED` / count `total` loops for the date
4. ⚠️ **Firestore aggregation indexes:** Firestore requires composite indexes for multi-field queries. Before deploying, confirm `firestore.indexes.json` includes indexes for `(date, type)` and `(date, screenId)`. If not, the query will throw `FAILED_PRECONDITION` in production.

**Exact fix — frontend (`LoopAnalytics.jsx`):**
1. Replace all hardcoded `const data = [...]` or `const stats = {...}` with a `useEffect` that fetches:
   ```js
   GET /api/analytics/loops?date={selectedDate}&retailerId={selectedRetailerId}
   ```
2. Add a loading state — show skeleton cards while data is fetching (not a blank screen).
3. Add an error state — if the fetch fails, show `"Analytics unavailable — data could not be loaded"` with a retry button.
4. Date picker: default to today. Allow selecting any date within the last 30 days.
5. RetailerId filter: default to `All Retailers` (admin sees aggregate). If a specific retailer is selected, scoped view.

**Verification:**
- Load `LoopAnalytics.jsx` → confirm charts render with real data, not hardcoded values.
- Change date → confirm charts re-fetch and update.
- Block network in DevTools → confirm error state renders with retry button.
- Call `/api/analytics/loops?date=TODAY` → confirm response matches today's actual play counts in Firestore.

**Outcome likelihood: 🟡 60%**  
Highest-risk task in Sprint 8. Risk factors: (1) Firestore aggregation indexes may not exist — deployment will fail silently in production without them. (2) Telemetry event schema (written from `Player.jsx` in Sprint 5) may not match the query field names. Read the telemetry write in `Player.jsx` to confirm field names before writing the aggregation query. (3) If `server/routes/analytics.js` does not exist and must be created, it needs to be registered in `server/app.js` (or equivalent entry point).

---

### Task 8.5 — Fix Bulk-Approve Endpoint Verification (SRE R5)

**Type:** Bug fix  
**Files edited:**
- `server/routes/` *(confirm `/api/locations/:id/loops/approve-all` exists)*
- `client-app/src/pages/retailer/ScheduleManager.jsx` *(error surfacing)*

**Problem in plain terms:**  
SRE R5 from Sprint 7: `ScheduleManager.jsx` calls `POST /api/locations/:id/loops/approve-all` but this endpoint has a `// FIXME: unconfirmed` comment in the commit. If the endpoint returns 404, the UI silently does nothing — the retailer thinks bulk-approve worked but loops remain `PENDING`.

**Exact fix:**
1. Confirm endpoint existence:
   ```bash
   grep -rn "approve-all\|approve_all" server/routes/ --include="*.js"
   ```
2. **If endpoint exists:** remove the FIXME comment. Verify it uses `BaseRepository.update()` (not raw `.update()`). Add the missing error response to `ScheduleManager.jsx` — if the fetch throws or returns non-2xx, show an inline error banner: `"Bulk approval failed — please try again or approve individually."`
3. **If endpoint does not exist:** create it. Iterate over all `PENDING` loops for `locationId` in the date range, call `BaseRepository.update({ status: 'APPROVED' })` on each. Return `{ approved: N }` in the response body.
4. In `ScheduleManager.jsx`: replace the silent catch with an inline error state. Disable the "Approve All" button while the request is in flight (prevent double-submit).

**Verification:**
- Click "Approve All" for a schedule with 3 `PENDING` loops → all 3 transition to `APPROVED` → persist after hard-refresh.
- Simulate a 500 from the endpoint → inline error banner appears in `ScheduleManager.jsx`.

**Outcome likelihood: 🟢 75%**  
Straightforward fix once the endpoint is located. The main unknown is whether the endpoint exists at all — the grep resolves this in under a minute.

---

### Task 8.6 — Documentation

**Type:** Documentation  
**Files edited:**
- `changelog.md` *(repo root — confirmed at 35,165 bytes)*
- `MVP_SPRINT_PLAN.md` *(repo root — created this sprint)*

**`changelog.md` additions:**

```markdown
## Sprint 8 — Campaign Handoff + Retailer Gating + Analytics Live Data
- Campaign submit-for-validation transition added (8.1) — PENDING_VALIDATION status now gated by PATCH /api/campaigns/:id/status
- Retailer validation queue added to RetailerDashboard.jsx (8.2)
- LoopGenerationService category exclusion enforcement wired (8.3)
- LoopAnalytics.jsx replaced mock data with live Firestore aggregation (8.4)
- Bulk-approve endpoint verified/created; silent failure surfaced in ScheduleManager.jsx (8.5)
- SRE R5 (bulk-approve FIXME) resolved
```

**`MVP_SPRINT_PLAN.md` updates:**
- Mark Sprint 8 status as ✅ Complete
- Update Sprint 9 status to 🔄 In Progress
- Resolve SRE R5 in the Open Cross-Sprint Risks table

**Outcome likelihood: 🟢 95%**

---

## Test Coverage Requirements

| Task | New Test Required | Spec File |
|------|------------------|-----------|
| 8.1 | Campaign status transition integration test | `campaign_workflow.spec.js` (new or existing) |
| 8.2 | Retailer queue renders PENDING campaigns; approve/reject actions persist | `retailer_dashboard.spec.js` |
| 8.3 | Excluded categories do not appear in generated loop | `loop_generation.spec.js` (new or existing) |
| 8.4 | Analytics endpoint returns real data; frontend renders it | `analytics.spec.js` (new or existing) |
| 8.5 | Bulk-approve transitions all PENDING → APPROVED; error state renders on failure | `schedule_manager.spec.js` |

All new spec files must be registered in `playwright.config.js` if using Playwright, or the appropriate test runner config.

---

## Full File Inventory

| File | Size | Operation | Task(s) |
|------|------|-----------|--------|
| `client-app/src/pages/brand/CampaignBuilder.jsx` | Unknown | **Edit** | 8.1 |
| `server/routes/campaigns.js` | Unknown | **Edit** | 8.1 |
| `client-app/src/pages/retailer/RetailerDashboard.jsx` | Unknown | **Edit** | 8.2, 8.5 |
| `client-app/src/components/StatusBadge.jsx` | Sprint 7.6 output | **Import** | 8.2 |
| `ad-server/src/services/LoopGenerationService.js` | Unknown | **Edit** | 8.3 |
| `ad-server/src/repositories/LoopRepository.js` | Unknown | **Audit + possibly edit** | 8.3 |
| `client-app/src/pages/admin/LoopAnalytics.jsx` | Unknown | **Edit** | 8.4 |
| `server/routes/analytics.js` | Unknown / new | **Create or edit** | 8.4 |
| `client-app/src/pages/retailer/ScheduleManager.jsx` | Unknown | **Edit** | 8.5 |
| `changelog.md` | 35,165 bytes | **Append** | 8.6 |
| `MVP_SPRINT_PLAN.md` | New | **Update** | 8.6 |

---

## Outcome Likelihood Summary

| Task | Score | Confidence Basis |
|------|-------|------------------|
| 8.6 — Docs | **95%** | Pure markdown. No code changes. |
| 8.2 — Retailer validation queue | **80%** | Well-scoped. Risk: StatusBadge export assumption; rejectionReason layout. |
| 8.5 — Fix bulk-approve | **75%** | Depends on whether endpoint exists — grep resolves immediately. |
| 8.1 — Campaign status transition | **70%** | Frontend clear. Backend risk: role field on `req.user` must exist. |
| 8.3 — Category exclusion enforcement | **65%** | Service structure unknown. Exclusion data model location unknown. |
| 8.4 — Analytics live data | **60%** | Firestore index requirement may cause silent production failure. Telemetry schema must be verified. |

**Sprint-level composite outcome: ~74%**

The most likely slip scenario is 8.4 (analytics) overrunning due to Firestore index discovery, and 8.3 (LoopGenerationService) requiring a LoopRepository silent-catch fix before the exclusion logic can be safely written.

---

## Definition of Done

- [ ] Campaign status transitions `DRAFT` → `PENDING_VALIDATION` on brand submit — persists after hard-refresh
- [ ] Retailer validation queue shows all `PENDING_VALIDATION` campaigns scoped to authenticated retailer
- [ ] Retailer can approve → campaign status → `APPROVED`; reject with reason → `REJECTED` — both persist
- [ ] `LoopGenerationService` does not include excluded-category slots in any generated loop
- [ ] Empty eligible slots after exclusion → fallback content used, not excluded content
- [ ] `LoopAnalytics.jsx` renders live Firestore data, not mock values
- [ ] Bulk-approve endpoint confirmed live; 404/500 surfaced as inline error in `ScheduleManager.jsx`
- [ ] All new test specs pass
- [ ] Firestore composite indexes verified in `firestore.indexes.json` (or equivalent)
- [ ] `changelog.md` updated with Sprint 8 entries
- [ ] `MVP_SPRINT_PLAN.md` Sprint 8 marked complete
- [ ] `npm run build` in `client-app/` exits with zero errors
