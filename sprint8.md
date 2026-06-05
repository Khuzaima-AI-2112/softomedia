# Sprint 8 — Campaign Handoff + Retailer Gating + Analytics Live Data

**Repo:** `cfroszte/softomedia-live2026`  
**Branch:** `main`  
**Generated:** 2026-06-05  
**Revised:** 2026-06-05 (risk-reduction pass — composite lifted from ~74% → ~88%)  
**Duration estimate:** 3 days  
**Risk level:** 🟡 MEDIUM  
**Depends on:** Sprint 7 complete (specifically Tasks 7.1, 7.3, 7.6)  
**Source audits:** `sprint7.md`, `TASKS.md`, `tasks.md`, `TASK_PLAN20260527.md`, `sre-integration-report-sprints1to4.md`, `changelog.md`, live repo file listing + live repo file reads (2026-06-05)

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
2. **`sprint7.md` Task 7.3** — the `ghost-api.js` conditional query pattern. Sprint 8 adds a new campaign status endpoint; use the same conditional param pattern. Note: all ad-server routes live in **`ad-server/routes/ghost-api.js`** (monolithic, ~19KB) — there is no `server/routes/` subdirectory.
3. **`sprint7.md` Task 7.6** — `StatusBadge` component. Sprint 8 reuses it in the retailer validation queue. Before importing, run: `ls client-app/src/components/ | grep StatusBadge` to confirm it was extracted to `src/components/StatusBadge.jsx`.
4. **Status casing convention** — `CampaignService.updateStatus()` currently uses lowercase `'approved'`/`'rejected'`. This sprint introduces `'PENDING_VALIDATION'` (uppercase). **Before writing any new status transition, decide on one casing convention and update all existing references** — do not mix `'approved'` and `'APPROVED'` in the same service.

---

## Pre-Sprint Checklist (Complete Before Any Code)

These five actions each take under 15 minutes and resolve the largest remaining unknowns:

- [ ] **8.1 — Status casing:** Search for all `status` writes in `CampaignService.js` and `ghost-api.js`. Standardize to either all-uppercase (`'PENDING_VALIDATION'`, `'APPROVED'`, `'REJECTED'`, `'DRAFT'`) or all-lowercase before writing any new transition logic.
- [ ] **8.2 — StatusBadge exists:** `ls client-app/src/components/ | grep StatusBadge` — must return a result before starting Task 8.2. If missing, complete Sprint 7.6 first.
- [ ] **8.3 — Exclusion field name:** `grep -rn "exclusion\|exclude\|category" client-app/src --include="*.jsx" | grep -i "set\|post\|patch\|update"` — find the exact field name the UI writes to Firestore when saving retailer exclusions. Then add `getExclusions(retailerId)` to `RetailerRepository.js` (see Task 8.3).
- [ ] **8.4 — Telemetry schema:** In `client-app/src/pages/Player.jsx`, find lines matching `addDoc\|setDoc\|collection` to confirm the telemetry collection name and all field names written at play time. Then add the required Firestore composite indexes to `firestore.indexes.json` (see Task 8.4) before any deployment.
- [ ] **8.5 — Route file:** `grep -n "approve-all" ad-server/routes/ghost-api.js` — confirms whether the endpoint exists in the correct file.

---

## SRE Risk Register (Sprint 8)

| ID | Severity | File | Risk |
|----|----------|------|------|
| R8-1 | 🟡 MEDIUM | `CampaignBuilder.jsx` | Status transition (`DRAFT` → `PENDING_VALIDATION`) triggers Firestore write — must use `BaseRepository.update()` not raw `docRef.update()` |
| R8-2 | 🟡 MEDIUM | `LoopGenerationService.js` | Enforcing category exclusions changes the shape of generated loops — existing loops already in `APPROVED` state are unaffected, but any re-generation will differ |
| R8-3 | 🟡 MEDIUM | `LoopAnalytics.jsx` | Replacing mock data with live Firestore aggregation queries — `firestore.indexes.json` has **no analytics/telemetry indexes** — queries will throw `FAILED_PRECONDITION` at runtime without them (see Task 8.4 for required index definitions) |
| R8-4 | 🟢 LOW | `RetailerDashboard.jsx` | New validation queue renders campaigns scoped to the authenticated retailer — must use `retailerId` from auth context, not `localStorage` |
| R8-5 | 🟢 LOW | `ad-server/routes/ghost-api.js` | New PATCH endpoint for campaign status — role names in `requireRole.js` ROLE_HIERARCHY are `advertiser` (not `brand`) and `retaileradmin` (not `retailer`) — using the wrong names returns 403 on every call |
| R8-6 | 🟡 MEDIUM | `RetailerRepository.js` | **No `getExclusions` method exists** — Task 8.3 is blocked until this method is added (see pre-work in Task 8.3) |

---

## Task Map

| Task | Type | Files Touched | Estimated Effort | Outcome Likelihood |
|------|------|---------------|-----------------|-------------------|
| 8.1 | Feature | `CampaignBuilder.jsx`, `ad-server/routes/ghost-api.js` | 3–4 hrs | 🟢 90% |
| 8.2 | Feature | `RetailerDashboard.jsx`, `StatusBadge.jsx` (import) | 2–3 hrs | 🟢 88% |
| 8.3 | Feature | `LoopGenerationService.js`, `RetailerRepository.js` (pre-work) | 3–5 hrs | 🟡 82% |
| 8.4 | Feature | `LoopAnalytics.jsx`, `ad-server/routes/ghost-api.js`, `firestore.indexes.json` | 4–6 hrs | 🟢 85% |
| 8.5 | Fix | `ad-server/routes/ghost-api.js`, `RetailerDashboard.jsx` | 1–2 hrs | 🟢 88% |
| 8.6 | Documentation | `changelog.md`, `MVP_SPRINT_PLAN.md` | 30 min | 🟢 97% |

---

## Task Detail

### Task 8.1 — Campaign Submit-for-Validation Transition

**Type:** Feature  
**Files edited:**
- `client-app/src/pages/brand/CampaignBuilder.jsx` *(locate exact path via `grep -r "CampaignBuilder" client-app/src/App.jsx`)*
- `ad-server/routes/ghost-api.js` *(all ad-server routes are here — not `server/routes/campaigns.js`)*

**Problem in plain terms:**  
Brand users complete the campaign wizard and click a final "Submit" button, but the campaign status stays `DRAFT` — it never becomes `PENDING_VALIDATION`. Retailers therefore never see it in their approval queue. The entire approval workflow from Sprint 6 has no entry point.

**⚠️ Role name correction (was wrong in previous spec):**  
`requireRole.js` ROLE_HIERARCHY uses `advertiser` (not `brand`) and `retaileradmin` (not `retailer`). Using the wrong names causes a 403 on every guarded call. Confirmed by reading `ad-server/src/middleware/requireRole.js` on 2026-06-05.

**⚠️ Status casing — must standardize first:**  
`CampaignService.updateStatus()` uses lowercase `'approved'`/`'rejected'`. Decide on one casing convention (recommend all-uppercase: `'DRAFT'`, `'PENDING_VALIDATION'`, `'APPROVED'`, `'REJECTED'`) and update `CampaignService.js` before writing any new transition logic.

**Exact fix — frontend (`CampaignBuilder.jsx`):**
1. On the final wizard step, change the "Submit" button label to **"Submit for Retailer Approval"**.
2. On click, call:
   ```js
   await api.patch(`/api/campaigns/${campaignId}/status`, { status: 'PENDING_VALIDATION' });
   ```
3. On success: show inline confirmation `"Campaign submitted — awaiting retailer approval"` and disable the button to prevent double-submit.
4. On error: show inline error. Do NOT use a toast — the user must see the failure before leaving the wizard.
5. Use `BaseRepository.update()` path (through the API, not a direct Firestore write from the client).

**Exact fix — backend (`ghost-api.js`):**
1. Add `PATCH /api/campaigns/:id/status` endpoint.
2. Import and use `requireRole` from `ad-server/src/middleware/requireRole.js` (already used elsewhere in the codebase).
3. Role guards — use the correct role names from ROLE_HIERARCHY:
   ```js
   import { requireRole } from '../src/middleware/requireRole.js';

   router.patch('/campaigns/:id/status',
     async (req, res) => {
       const { status } = req.body;
       const callerRole = req.user.role; // Set by auth middleware
       const allowed = {
         advertiser:    ['PENDING_VALIDATION'],   // brand users
         retaileradmin: ['APPROVED', 'REJECTED'], // retailer users
       };
       if (!allowed[callerRole]?.includes(status)) {
         return res.status(403).json({ error: 'Invalid status transition for role' });
       }
       // Use CampaignService.updateStatus() — already exists, do not re-implement
       const updated = await campaignService.updateStatus(req.params.id, status);
       res.json(updated);
     }
   );
   ```
4. Reuse `CampaignService.updateStatus()` — **do not write a new Firestore call**. Add a `PENDING_VALIDATION` branch to that method if it does not already handle it.
5. On successful transition to `PENDING_VALIDATION`, trigger a notification record in Firestore (`/notifications/{retailerId}`) so the retailer dashboard badge can poll it.

**Verification:**
- Submit a campaign as a brand user → status changes to `PENDING_VALIDATION` → persists after hard-refresh.
- Confirm button is disabled after submit (no double-submit).
- Call `PATCH /api/campaigns/:id/status` with role `retaileradmin` and body `{ status: 'PENDING_VALIDATION' }` → must return `403`.
- Call with role `advertiser` and body `{ status: 'APPROVED' }` → must return `403`.

**Outcome likelihood: 🟢 90%** *(was 70%)*  
`requireRole.js` confirmed in live codebase — `req.user.role` is set by auth middleware. Role name correction (`advertiser` not `brand`, `retaileradmin` not `retailer`) eliminates the 403-on-every-call failure mode. `CampaignService.updateStatus()` exists and can be reused. Remaining risk: status casing must be standardized first.

---

### Task 8.2 — Retailer Validation Queue

**Type:** Feature  
**Files edited:**
- `client-app/src/pages/retailer/RetailerDashboard.jsx`
- `client-app/src/components/StatusBadge.jsx` *(import — must exist post Sprint 7.6)*

**Problem in plain terms:**  
Retailers have no UI to see campaigns awaiting their approval. Even after Task 8.1 transitions a campaign to `PENDING_VALIDATION`, the retailer has nowhere to view, approve, or reject it.

**Pre-edit check (required):**
```bash
ls client-app/src/components/ | grep StatusBadge
```
If this returns nothing, complete Sprint 7.6 before starting this task. Do not create a local inline StatusBadge — it will drift from the canonical component.

**Firestore index confirmed:** The `campaigns(retailer_id, status)` composite index **already exists** in `firestore.indexes.json` — the retailer queue fetch will not throw `FAILED_PRECONDITION`. No index work needed for this task.

**Exact fix:**
1. Add a **"Pending Approval"** section to `RetailerDashboard.jsx` — rendered above the existing schedule section.
2. Fetch campaigns via:
   ```js
   GET /api/campaigns?retailerId={retailerId}&status=PENDING_VALIDATION
   ```
   Use `retailerId` from `AuthContext` — **not** `localStorage` (SRE R8-4).
3. Render a card per campaign showing: campaign name, brand name, submitted date, content thumbnail (if available), and two action buttons: **Approve** / **Reject**.
4. Approve → `PATCH /api/campaigns/:id/status { status: 'APPROVED' }`  
   Reject → `PATCH /api/campaigns/:id/status { status: 'REJECTED' }` with a required `rejectionReason` text input (inline `<textarea>` that expands on "Reject" click — do not use a modal).
5. After approve/reject: optimistically remove the card from the queue. On error: restore the card and show inline error.
6. Show `StatusBadge` (from Sprint 7.6) next to each campaign name: amber for `PENDING_VALIDATION`, green for `APPROVED`, red for `REJECTED`.
7. If queue is empty: render an empty state — `"No campaigns awaiting approval"` — not a blank section.

**Verification:**
- Log in as a retailer. Confirm `PENDING_VALIDATION` campaigns appear in the queue.
- Approve one → card disappears from queue → status persists after hard-refresh.
- Reject one with a reason → card disappears → rejection reason stored and visible to brand on campaign detail.
- Empty state renders correctly when queue is empty.
- Queue shows only campaigns belonging to the authenticated retailer's `retailerId` (not all tenants).

**Outcome likelihood: 🟢 88%** *(was 80%)*  
`campaigns(retailer_id, status)` Firestore index confirmed — no `FAILED_PRECONDITION` risk. `StatusBadge` dependency is the only open check (run pre-edit grep above). Budget 30–45 extra minutes for `rejectionReason` inline layout testing.

---

### Task 8.3 — LoopGenerationService Category Exclusion Enforcement

**Type:** Feature  
**Files edited:**
- `ad-server/src/repositories/RetailerRepository.js` *(pre-work: add `getExclusions` method — required before any other edit)*
- `ad-server/src/services/LoopGenerationService.js` *(read before editing — see structure below)*

**Problem in plain terms:**  
Retailers can configure content category exclusions in the UI, but `LoopGenerationService` ignores them when building a loop. Excluded category content silently appears on screens.

**⚠️ Pre-work required — `RetailerRepository.js` is missing `getExclusions`:**  
Live read of `RetailerRepository.js` on 2026-06-05 confirms it has only `createNew()`, `softDelete()`, and `updateStatus()`. There is no `getExclusions` method and no `excluded_categories` field in any visible retailer schema. This task is **blocked** until the pre-work below is done.

**Pre-work step 1 — find the field name the UI uses:**
```bash
grep -rn "exclusion\|exclude\|category" client-app/src --include="*.jsx" | grep -i "set\|post\|patch\|update" | head -20
```
This tells you what field name is written to Firestore when a retailer saves exclusions. Use that exact field name in the repository method.

**Pre-work step 2 — add `getExclusions` to `RetailerRepository.js`:**
```js
/**
 * Get the list of excluded content categories for a retailer.
 * @param {string} retailerId
 * @returns {Promise<string[]>} Array of excluded category strings, e.g. ['alcohol', 'competitor']
 */
async getExclusions(retailerId) {
    const retailer = await this.findById(retailerId);
    if (!retailer) return [];
    return retailer.excluded_categories ?? [];  // adjust field name from pre-work step 1
}
```

**`LoopGenerationService` structure (confirmed by live read):**  
The entry point is `generateDailyLoops(targetDate, retailerId, locationId)`. Campaign filtering happens in `getAvailableCampaigns()`. The exact insertion point for exclusion enforcement is inside the `.filter()` call in `getAvailableCampaigns()`.

**⚠️ Silent-catch warning:**  
`getAvailableCampaigns` has a `catch (error) { return []; }` pattern — if the exclusion fetch throws, exclusions are silently skipped. Add a **separate** try/catch for the exclusion fetch so it cannot suppress campaign fetch errors.

**Exact fix — `LoopGenerationService.js`:**
```js
// In getAvailableCampaigns(), before the existing .filter():
let exclusions = [];
try {
    exclusions = await retailerRepository.getExclusions(retailerId);
} catch (err) {
    console.warn(`WARN: Could not fetch exclusions for retailerId=${retailerId}:`, err.message);
    // Proceed without exclusion filtering — do not suppress the campaign fetch
}

return campaigns.filter(c => {
    const matchesRetailer = !c.retailer_id || c.retailer_id === retailerId;
    const matchesLocation = !c.location_id || c.location_id === locationId || c.location_id === 'ALL';
    const inDateRange = this.isDateInRange(targetDate, c.start_date, c.end_date);
    const notExcluded = !exclusions.includes(c.category);
    return matchesRetailer && matchesLocation && inDateRange && notExcluded;
});
```

If `eligible` is empty after filtering: do **not** fall back to excluded content. Fill with offline fallback slots (same `FALLBACK_SLOTS` pattern as Sprint 7 Task 7.4). Log a warning:
```
WARN: No eligible slots after exclusion filter for retailerId=${retailerId}
```

**Verification:**
- Set a retailer exclusion for category `alcohol`.
- Trigger loop generation for that retailer.
- Confirm no `alcohol` category slots appear in the generated loop.
- Confirm exclusion persists after hard-refresh (verifies `BaseRepository` is in the call chain).
- Remove all eligible slots (set all to excluded categories) → confirm loop uses fallback content, not excluded content.
- Confirm that a failure in `getExclusions` does not cause `getAvailableCampaigns` to return an empty array.

**Outcome likelihood: 🟡 82%** *(was 65%)*  
Service structure fully known. Pre-work (`getExclusions` method) is a low-risk ~30-minute addition. Remaining uncertainty: the campaign `category` field must exist and be populated in Firestore documents — confirm it is written on campaign creation before filtering on it.

---

### Task 8.4 — LoopAnalytics Live Firestore Aggregation

**Type:** Feature  
**Files edited:**
- `client-app/src/pages/admin/LoopAnalytics.jsx` *(replace mock data)*
- `ad-server/routes/ghost-api.js` *(new analytics endpoint — not `server/routes/analytics.js`)*
- `ad-server/firestore.indexes.json` *(required new indexes — see below)*

**Problem in plain terms:**  
`LoopAnalytics.jsx` renders hardcoded/mock data. Admins cannot use it for real operational decisions.

**⚠️ Route file correction:**  
`server/routes/analytics.js` does not exist. All ad-server routes are in `ad-server/routes/ghost-api.js`. Any new analytics endpoint must be added there and registered in `ad-server/index.js`. Confirm the registration pattern:
```bash
grep -n "ghost-api\|require\|import" ad-server/index.js
```

**⚠️ Firestore indexes are missing — deploy blocker:**  
`firestore.indexes.json` currently has only 2 indexes (`ads` and `campaigns`). There are **no analytics/telemetry/impression indexes**. Any aggregation query will throw `FAILED_PRECONDITION` in production. Add the following to `firestore.indexes.json` before deploying:

```json
{
  "collectionGroup": "impressions",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "date", "order": "ASCENDING" },
    { "fieldPath": "retailer_id", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "impressions",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "date", "order": "ASCENDING" },
    { "fieldPath": "screen_id", "order": "ASCENDING" }
  ]
}
```

> **Adjust field names** after reading `Player.jsx` lines matching `addDoc|setDoc|collection` to confirm the actual telemetry collection name and field names written at play time. `ImpressionRepository.js` exists in `ad-server/src/repositories/` — read it to confirm queryable fields.

**Pre-edit check:**
```bash
# Find telemetry writes in Player.jsx
grep -n "addDoc\|setDoc\|collection" client-app/src/pages/Player.jsx | head -20

# Confirm ImpressionRepository queryable fields
grep -n "where\|orderBy\|query" ad-server/src/repositories/ImpressionRepository.js
```

**Exact fix — backend (new endpoint in `ghost-api.js`):**
1. Add `GET /api/analytics/loops?date=YYYY-MM-DD&retailerId=X` endpoint.
2. Query Firestore (via `ImpressionRepository`) for:
   - Total plays for the date
   - Plays by hour (group by `hour` field)
   - Plays by screen (group by `screenId`)
   - Approval rate: count `APPROVED` / total loops for the date
3. Register the new route in `ad-server/index.js` using the same pattern as existing routes.

**Exact fix — frontend (`LoopAnalytics.jsx`):**
1. Replace all hardcoded `const data = [...]` or `const stats = {...}` with a `useEffect` fetching:
   ```js
   GET /api/analytics/loops?date={selectedDate}&retailerId={selectedRetailerId}
   ```
2. Add a loading state — skeleton cards while data fetches (not a blank screen).
3. Add an error state — if fetch fails, show `"Analytics unavailable — data could not be loaded"` with a retry button.
4. Date picker: default to today. Selectable range: last 30 days.
5. RetailerId filter: default to `All Retailers` (admin sees aggregate).

**Verification:**
- Load `LoopAnalytics.jsx` → charts render with real data, not hardcoded values.
- Change date → charts re-fetch and update.
- Block network in DevTools → error state renders with retry button.
- Call `/api/analytics/loops?date=TODAY` → response matches today's actual play counts in Firestore.
- Deploy with new indexes in `firestore.indexes.json` → no `FAILED_PRECONDITION` errors in Cloud Logging.

**Outcome likelihood: 🟢 85%** *(was 60%)*  
Required Firestore indexes are now explicitly specified. Correct route file (`ghost-api.js`) identified. Remaining uncertainty: telemetry schema field names (resolved by pre-edit grep on `Player.jsx`). Once the pre-sprint checklist items for 8.4 are done, this is a well-bounded implementation task.

---

### Task 8.5 — Fix Bulk-Approve Endpoint Verification (SRE R5)

**Type:** Bug fix  
**Files edited:**
- `ad-server/routes/ghost-api.js` *(confirm/create `/api/locations/:id/loops/approve-all` — not `server/routes/`)*
- `client-app/src/pages/retailer/ScheduleManager.jsx` *(error surfacing)*

**Problem in plain terms:**  
SRE R5 from Sprint 7: `ScheduleManager.jsx` calls `POST /api/locations/:id/loops/approve-all` but this endpoint has a `// FIXME: unconfirmed` comment. If it returns 404, the UI silently does nothing.

**⚠️ Route file correction:**  
The grep in the previous spec targeted `server/routes/` which does not exist. The correct command is:
```bash
grep -n "approve-all\|approve_all" ad-server/routes/ghost-api.js
```

**Exact fix:**
1. Run the corrected grep above.
2. **If endpoint exists:** remove the FIXME comment. Verify it uses `BaseRepository.update()` (not raw `.update()`). Add missing error response to `ScheduleManager.jsx`.
3. **If endpoint does not exist:** create it in `ghost-api.js`:
   ```js
   router.post('/locations/:id/loops/approve-all', async (req, res) => {
       const { id: locationId } = req.params;
       const { date } = req.query;
       // Fetch all PENDING loops for locationId + date, update each to APPROVED
       // Use BaseRepository.update() — not docRef.update()
       const updated = await loopRepository.approveAllForLocation(locationId, date);
       res.json({ approved: updated.length });
   });
   ```
   Register in `ad-server/index.js` using the same pattern as existing routes.
4. In `ScheduleManager.jsx`: replace the silent catch with an inline error banner: `"Bulk approval failed — please try again or approve individually."` Disable the "Approve All" button while the request is in flight.

**Verification:**
- Click "Approve All" for a schedule with 3 `PENDING` loops → all 3 transition to `APPROVED` → persist after hard-refresh.
- Simulate a 500 from the endpoint → inline error banner appears in `ScheduleManager.jsx`.

**Outcome likelihood: 🟢 88%** *(was 75%)*  
Correct grep target identified (`ghost-api.js` not `server/routes/`). Resolution is deterministic once the grep runs.

---

### Task 8.6 — Documentation

**Type:** Documentation  
**Files edited:**
- `changelog.md` *(repo root — confirmed at 35,165 bytes)*
- `MVP_SPRINT_PLAN.md` *(repo root)*

**`changelog.md` additions:**

```markdown
## Sprint 8 — Campaign Handoff + Retailer Gating + Analytics Live Data
- Campaign submit-for-validation transition added (8.1) — PENDING_VALIDATION status now gated by PATCH /api/campaigns/:id/status
- Role name correction applied: advertiser (not 'brand'), retaileradmin (not 'retailer') per requireRole.js ROLE_HIERARCHY
- Retailer validation queue added to RetailerDashboard.jsx (8.2)
- RetailerRepository.getExclusions() added (8.3 pre-work)
- LoopGenerationService category exclusion enforcement wired (8.3)
- Firestore composite indexes added for impressions collection (8.4)
- LoopAnalytics.jsx replaced mock data with live Firestore aggregation via ghost-api.js (8.4)
- Bulk-approve endpoint confirmed/created in ghost-api.js; silent failure surfaced in ScheduleManager.jsx (8.5)
- SRE R5 (bulk-approve FIXME) resolved
```

**`MVP_SPRINT_PLAN.md` updates:**
- Mark Sprint 8 status as ✅ Complete
- Update Sprint 9 status to 🔄 In Progress
- Resolve SRE R5 in the Open Cross-Sprint Risks table

**Outcome likelihood: 🟢 97%** *(was 95%)*

---

## Test Coverage Requirements

| Task | New Test Required | Spec File |
|------|------------------|-----------|
| 8.1 | Campaign status transition integration test; role guard returns 403 for wrong role | `campaign_workflow.spec.js` (new or existing) |
| 8.2 | Retailer queue renders PENDING campaigns; approve/reject actions persist | `retailer_dashboard.spec.js` |
| 8.3 | Excluded categories do not appear in generated loop; exclusion fetch failure does not suppress campaign fetch | `loop_generation.spec.js` (new or existing) |
| 8.4 | Analytics endpoint returns real data; frontend renders it; error state on fetch failure | `analytics.spec.js` (new or existing) |
| 8.5 | Bulk-approve transitions all PENDING → APPROVED; error state renders on failure | `schedule_manager.spec.js` |

All new spec files must be registered in `playwright.config.js` if using Playwright, or the appropriate test runner config.

---

## Full File Inventory

| File | Size | Operation | Task(s) |
|------|------|-----------|--------|
| `client-app/src/pages/brand/CampaignBuilder.jsx` | Unknown | **Edit** | 8.1 |
| `ad-server/routes/ghost-api.js` | ~19KB | **Edit** | 8.1, 8.4, 8.5 |
| `ad-server/src/services/CampaignService.js` | Unknown | **Edit** (add PENDING_VALIDATION branch) | 8.1 |
| `client-app/src/pages/retailer/RetailerDashboard.jsx` | Unknown | **Edit** | 8.2, 8.5 |
| `client-app/src/components/StatusBadge.jsx` | Sprint 7.6 output | **Import** | 8.2 |
| `ad-server/src/repositories/RetailerRepository.js` | ~3KB | **Edit** (add `getExclusions`) | 8.3 pre-work |
| `ad-server/src/services/LoopGenerationService.js` | Unknown | **Edit** | 8.3 |
| `client-app/src/pages/admin/LoopAnalytics.jsx` | Unknown | **Edit** | 8.4 |
| `ad-server/firestore.indexes.json` | Unknown | **Edit** (add impressions indexes) | 8.4 |
| `ad-server/index.js` | Unknown | **Edit** (register new routes if needed) | 8.4, 8.5 |
| `client-app/src/pages/retailer/ScheduleManager.jsx` | Unknown | **Edit** | 8.5 |
| `changelog.md` | 35,165 bytes | **Append** | 8.6 |
| `MVP_SPRINT_PLAN.md` | Unknown | **Update** | 8.6 |

---

## Outcome Likelihood Summary

| Task | Score | Confidence Basis |
|------|-------|-----------------|
| 8.6 — Docs | **97%** | Pure markdown. No code changes. |
| 8.1 — Campaign status transition | **90%** | `requireRole.js` confirmed. Role names corrected. `CampaignService.updateStatus()` exists and is reusable. Status casing must be standardized. |
| 8.2 — Retailer validation queue | **88%** | `campaigns(retailer_id, status)` Firestore index confirmed. Only dependency is Sprint 7.6 `StatusBadge` (pre-check grep provided). |
| 8.5 — Fix bulk-approve | **88%** | Correct grep target identified (`ghost-api.js`). Resolution is deterministic. |
| 8.4 — Analytics live data | **85%** | Required Firestore indexes now explicitly specified. Correct route file identified. Telemetry schema check remains (pre-sprint checklist item). |
| 8.3 — Category exclusion enforcement | **82%** | Service insertion point known. Pre-work (`getExclusions`) is low-risk ~30 min. Campaign `category` field population must be confirmed. |

**Sprint-level composite outcome: ~88%** *(was ~74%)*

The most likely remaining slip scenario is 8.4 index deployment timing (indexes take minutes to build in Firestore after `firebase deploy --only firestore:indexes` — run this step before running any live analytics queries) and 8.3 `category` field confirmation.

---

## Definition of Done

- [ ] Campaign status transitions `DRAFT` → `PENDING_VALIDATION` on brand submit — persists after hard-refresh
- [ ] Role guards use correct names: `advertiser` (brand) and `retaileradmin` (retailer)
- [ ] Status casing is consistent across all `CampaignService` methods and route handlers
- [ ] Retailer validation queue shows all `PENDING_VALIDATION` campaigns scoped to authenticated retailer
- [ ] Retailer can approve → campaign status → `APPROVED`; reject with reason → `REJECTED` — both persist
- [ ] `RetailerRepository.getExclusions(retailerId)` implemented and tested
- [ ] `LoopGenerationService` does not include excluded-category slots in any generated loop
- [ ] Empty eligible slots after exclusion → fallback content used, not excluded content
- [ ] Exclusion fetch failure does not suppress campaign fetch (separate try/catch verified)
- [ ] `firestore.indexes.json` updated with impressions composite indexes; `firebase deploy --only firestore:indexes` run before analytics queries
- [ ] `LoopAnalytics.jsx` renders live Firestore data, not mock values
- [ ] Analytics error state renders on fetch failure with retry button
- [ ] Bulk-approve endpoint confirmed live in `ghost-api.js`; 404/500 surfaced as inline error in `ScheduleManager.jsx`
- [ ] All new test specs pass
- [ ] `changelog.md` updated with Sprint 8 entries
- [ ] `MVP_SPRINT_PLAN.md` Sprint 8 marked complete
- [ ] `npm run build` in `client-app/` exits with zero errors
