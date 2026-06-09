# Sprint 16 — Enum Normalization, Loop Status Integrity & Infra Hardening

**Sprint:** 16
**Status:** In Progress
**Spec authored:** 2026-06-08
**Grounded against:** HEAD [`a790fd5`](https://github.com/cfroszte/softomedia-live2026/commit/a790fd56292effc82bbbd4ec918e98553931649a)
**Guardrails active:** 14 (GUARDRAIL-1 through GUARDRAIL-14)
**Carry-forward source:** `current_sprint/sprint15-retro.md`

---

## Active Guardrails (copy-forward from S15 retro)

- **GUARDRAIL-1** — `App.jsx` is route authority.
- **GUARDRAIL-2** — No route without confirmed live source.
- **GUARDRAIL-3** — No undocumented `data-testid`.
- **GUARDRAIL-4** — Canonical enum values: lowercase, underscore-separated.
- **GUARDRAIL-5** — No shared middleware change without backward-compatibility proof.
- **GUARDRAIL-6** — No hardcoded API URLs in frontend.
- **GUARDRAIL-7** — `API_ROUTES.md` updated in the same sprint as route creation.
- **GUARDRAIL-8** — `DATABASE_SCHEMA.md` updated before first Firestore write.
- **GUARDRAIL-9** — Read existing files in full before writing spec tasks that touch them.
- **GUARDRAIL-10** — Inspect middleware chain of existing handlers before hardening.
- **GUARDRAIL-11** — Enumerate downstream callers before hardening a public endpoint.
- **GUARDRAIL-12** — Confirm service-layer pattern before creating a service file.
- **GUARDRAIL-13** — Doc and nav stories are blocking, not best-effort.
- **GUARDRAIL-14** — Carry-over risks must have a resolution sprint assigned.

---

## Step 1 Findings Summary

| Finding | Detail |
|---|---|
| `current_sprint/sprint16.md` | NOT ON DISK before this commit — created here |
| `BRAND_NAV` `/dashboard/brand/invoices` | Live 404 bug — nav link in `DashboardLayout.jsx` L33 points to unregistered route |
| `LOOP_STATUS` enum | All-uppercase in `LoopRepository.js` (`PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `LIVE`) — violates GUARDRAIL-4 |
| `SLOT_STATUS` enum | All-uppercase in `LoopRepository.js` (`PENDING`, `APPROVED`, `REJECTED`, `REPLACED`, `BOOKED`, `AVAILABLE`) — violates GUARDRAIL-4 |
| `loops.js` S13-2 raw string writes | `'REJECTED'`, `'PENDING'`, `'APPROVED'` written as raw strings bypassing `LOOP_STATUS` constants — active Firestore pollution |
| `playlists.js` ENUM-AUDIT-2 | **RESOLVED in S13** — `status = 'draft'` (lowercase). ENUM-AUDIT-2 is closed. |
| `firestore.indexes.json` | NOT ON DISK (not in repo root or confirmed subdirectory) |
| S11-1/2/4 persistence QA | Test file names unconfirmed — `tests/` directory exists but contents not enumerated |
| `GET /api/invoices/:id/pdf` | Stub confirmed at `ad-server/src/api/invoices.js` ~L152 — returns HTTP 200 JSON stub |
| `PricingService.js` | NOT ON DISK — FM-S15-5 confirmed optional; not created |

---

## 1. Risk Register

| ID | Description | Area | Status | Evidence |
|---|---|---|---|---|
| RISK-S16-1 | `LOOP_STATUS` and `SLOT_STATUS` enums are all-uppercase in `LoopRepository.js`, violating GUARDRAIL-4. New records are being created with uppercase status values on every loop approve/reject/replace call. | Backend / Firestore | 🔴 Active | `LoopRepository.js` L19–31: `LOOP_STATUS.APPROVED = 'APPROVED'`, etc. |
| RISK-S16-2 | `loops.js` S13-2 routes write raw uppercase strings (`'REJECTED'`, `'PENDING'`, `'APPROVED'`) that bypass `LOOP_STATUS` constants entirely. | Backend | 🔴 Active | `loops.js` L206, L262, L267 |
| RISK-S16-3 | `DashboardLayout.jsx` `BRAND_NAV` references `/dashboard/brand/invoices` which has no matching `<Route>` in `App.jsx`. Clicking Invoices in the brand sidebar 404s. | Frontend | 🔴 Live bug | `DashboardLayout.jsx` L33; `App.jsx` has `advertiser/invoices` not `brand/invoices` |
| RISK-S16-4 | No `firestore.indexes.json` confirmed on disk. Two required composite indexes (`invoices(advertiser_id, generatedAt DESC)` and `campaigns(advertiser_id)`) are documented in `DATABASE_SCHEMA.md` but not deployed. | Infra | 🟡 Pre-production | `DATABASE_SCHEMA.md` notes; no index file found |
| RISK-S16-5 | S11-1/2/4 persistence QA carried for a 3rd consecutive sprint. Must be scheduled or explicitly closed per GUARDRAIL-14. | QA | 🔴 Escalation required | `sprint15-retro.md` FM-S15-7 |
| RISK-S16-6 | ENUM-AUDIT-2 (`playlists.status`) was resolved in Sprint 13 (ENUM-AUDIT-3 fix). No action needed. | Tech debt | ✅ Closed | `playlists.js` L22 comment + `status = 'draft'` default |
| RISK-S16-7 | Real PDF generation (`GET /api/invoices/:id/pdf`) is a post-MVP stub. Carries no production risk but should be tracked. | Feature debt | 🟢 Deferred post-MVP | `invoices.js` ~L152 |
| RISK-S16-8 | Enum migration for `loops` requires strategy decision: dual-write + backfill vs. big-bang. Data volume in Firestore emulator vs. production unknown. Wrong strategy could corrupt live loop approvals. | Backend / Firestore | 🔴 Requires pre-decision | `LoopRepository.js` all write methods |

---

## 2. Security Register

| ID | Vector | File(s) | Mitigation | Environment Impact |
|---|---|---|---|---|
| SEC-S16-1 | Firestore query correctness — if enum casing migrates mid-flight, queries filtering on `status == 'pending_approval'` will miss records still stored as `'PENDING_APPROVAL'`. | `LoopRepository.js` `findPendingByRetailer()`, `findApprovedByScreen()`, `findAll({where})` callers | Dual-write period + backfill before cutover. Document in migration plan. | Dev + Staging before Prod |
| SEC-S16-2 | Brand sidebar nav link 404 exposes unhandled route — not a security vector but degrades auth boundary perception. | `DashboardLayout.jsx` L33 | Correct nav link to `/dashboard/advertiser/invoices` — existing route, existing page, existing auth guard. | All envs |

---

## 3. Task Map

| Task | Files Touched | Change Type | Estimated Effort | Outcome Probability | Biggest Risk |
|---|---|---|---|---|---|
| S16-0 | Fix `BRAND_NAV` invoices link | `DashboardLayout.jsx` | EDIT (1 line) | 2pts → 1pt | 97% | Wrong assumption about intent — brand vs advertiser persona separation |
| S16-1 | Normalize `LOOP_STATUS` + `SLOT_STATUS` enums to lowercase | `LoopRepository.js` | EDIT — constants only | 3pts | 88% | Firestore reads may break if existing docs have uppercase values — dual-write needed |
| S16-2 | Fix `loops.js` S13-2 raw string writes to use `LOOP_STATUS` constants | `loops.js` | EDIT | 2pts | 92% | Accidental casing mismatch if S16-1 and S16-2 are not committed atomically |
| S16-3 | Create `firestore.indexes.json` with two composite indexes | `firestore.indexes.json` (CREATE) | CREATE | 2pts | 82% | No confirmed deploy pipeline — index deploy method unknown |
| S16-4 | Schedule or close S11-1/2/4 persistence QA | `tests/` (read-only audit) | DECISION + optional edit | 2pts | 85% | Test file names still unconfirmed — requires `ls tests/` pre-check |
| S16-5 | Update `DATABASE_SCHEMA.md` — close ENUM-AUDIT-2, document enum migration plan | `docs/DATABASE_SCHEMA.md` | EDIT | 1pt | 98% | None — doc only |

---

## 4. Full Task Details

---

### S16-0 — Fix `BRAND_NAV` invoices link (Live Bug)

**Priority:** 🔴 Must fix before any other task. Live 404 on brand sidebar.

**Pre-checks (GUARDRAIL-9):**
```bash
# Confirm current nav entry
grep -n "brand/invoices" client-app/src/layouts/DashboardLayout.jsx
# Confirm target route exists in App.jsx
grep -n "advertiser/invoices" client-app/src/App.jsx
# Confirm Invoices page exists on disk
find client-app/src/pages/advertiser -name "Invoices.jsx"
```

**Expected pre-check results (confirmed from Step 1):**
- `DashboardLayout.jsx` L33: `{ to: '/dashboard/brand/invoices', icon: 'receipt_long', label: 'Invoices' }`
- `App.jsx`: `<Route path="advertiser/invoices" element={<Invoices />} />`
- `Invoices.jsx`: EXISTS at `client-app/src/pages/advertiser/Invoices.jsx`

**Insertion point:**
`client-app/src/layouts/DashboardLayout.jsx`, `BRAND_NAV` array, line ~33.

**Fix:**
```js
// BEFORE:
{ to: '/dashboard/brand/invoices', icon: 'receipt_long', label: 'Invoices' },

// AFTER:
{ to: '/dashboard/advertiser/invoices', icon: 'receipt_long', label: 'Invoices' },
```

**Verification steps:**
1. Login as advertiser persona.
2. Click "Invoices" in sidebar.
3. Browser URL becomes `/dashboard/advertiser/invoices`. HTTP 200. No 404 banner.
4. Hard-refresh at `/dashboard/advertiser/invoices` → page loads (not NotFound).
5. `grep "brand/invoices" client-app/src/layouts/DashboardLayout.jsx` → zero results.

**Outcome probability:** 97%
**Biggest risk:** If a separate brand-scoped invoices page is planned (i.e. `brand/invoices` is intentional future scope), this fix is a redirect, not a permanent close. Document the decision explicitly in `DATABASE_SCHEMA.md` or a comment.

---

### S16-1 — Normalize `LOOP_STATUS` + `SLOT_STATUS` to lowercase (ENUM-AUDIT-1)

**Priority:** 🟡 Pre-production. Do not deploy to prod before Firestore backfill is complete.

**Pre-checks (GUARDRAIL-9):**
```bash
# Read all status constants
grep -n "LOOP_STATUS\|SLOT_STATUS\|PENDING\|APPROVED\|REJECTED\|LIVE\|REPLACED\|BOOKED\|AVAILABLE" \
  ad-server/src/repositories/LoopRepository.js

# Find all files that import LOOP_STATUS or SLOT_STATUS
grep -rn "LOOP_STATUS\|SLOT_STATUS" ad-server/src --include="*.js"

# Find all Firestore query filters on loops.status
grep -rn "status.*==" ad-server/src --include="*.js" | grep -i "loop\|pending\|approved\|rejected"
```

**Confirmed write points in `LoopRepository.js` (from Step 1 read):**

| Method | Current value written | Line (approx) |
|---|---|---|
| `create()` | `LOOP_STATUS.PENDING_APPROVAL` (default) | L54 |
| `approveLoop()` | `LOOP_STATUS.APPROVED` | L103 |
| `replaceSlot()` — clone branch | `LOOP_STATUS.PENDING_APPROVAL` | L162 |
| `rejectSlot()` slot write | `SLOT_STATUS.REJECTED` | L131 |
| `replaceSlot()` slot write | `SLOT_STATUS.REPLACED` | L157, L185 |
| `bookSlot()` slot write | `SLOT_STATUS.BOOKED` | L210 |
| `findPendingByRetailer()` query | `LOOP_STATUS.PENDING_APPROVAL` | L65 |
| `findApprovedByScreen()` query | `LOOP_STATUS.APPROVED` | L76 |

**Migration strategy — dual-write then cutover:**

> ⚠️ Do NOT do a big-bang rename of constants before backfilling Firestore. Any existing document with `status: 'PENDING_APPROVAL'` will be invisible to a query for `status: 'pending_approval'` until backfilled.

**Phase 1 — Add lowercase aliases (this sprint):**
```js
// LoopRepository.js — replace the LOOP_STATUS block

export const LOOP_STATUS = {
    PENDING_APPROVAL: 'pending_approval',   // was 'PENDING_APPROVAL'
    APPROVED:         'approved',            // was 'APPROVED'
    REJECTED:         'rejected',            // was 'REJECTED'
    LIVE:             'live',                // was 'LIVE'
};

export const SLOT_STATUS = {
    PENDING:   'pending',    // was 'PENDING'
    APPROVED:  'approved',   // was 'APPROVED'
    REJECTED:  'rejected',   // was 'REJECTED'
    REPLACED:  'replaced',   // was 'REPLACED'
    BOOKED:    'booked',     // was 'BOOKED'
    AVAILABLE: 'available',  // was 'AVAILABLE'
};
```

**Phase 2 — Backfill Firestore (pre-production, separate task):**
Write a one-time migration script at `scripts/migrate-loop-status-lowercase.js` that:
1. Reads all documents from `loops` collection.
2. For each doc where `status` is uppercase, writes the lowercase equivalent.
3. Logs all migrated document IDs.
4. Is idempotent (safe to re-run).

**Phase 3 — Cutover validation:**
After backfill, confirm:
- `GET /api/loops?status=pending_approval` returns the expected set.
- `findPendingByRetailer()` returns correct results.
- `approveLoop()` guard (`loop.status !== LOOP_STATUS.PENDING_APPROVAL`) still triggers correctly.

**Verification steps:**
1. `grep -n "LOOP_STATUS" ad-server/src/repositories/LoopRepository.js` → all values lowercase.
2. `grep -n "SLOT_STATUS" ad-server/src/repositories/LoopRepository.js` → all values lowercase.
3. Unit: `loopRepository.create(...)` → returned doc has `status: 'pending_approval'`.
4. Unit: `loopRepository.approveLoop(...)` → returned doc has `status: 'approved'`.
5. `DATABASE_SCHEMA.md` updated with new canonical values.

**Outcome probability:** 88%
**Biggest risk:** Firestore backfill not run before cutover — queries silently return empty sets for loops still stored with uppercase status.

---

### S16-2 — Fix `loops.js` S13-2 raw string writes to use `LOOP_STATUS` constants

**Priority:** 🔴 Must be committed **atomically with S16-1**. Raw string writes bypass the constants and will re-pollute Firestore with uppercase values if not fixed in the same commit.

**Pre-checks:**
```bash
grep -n "'REJECTED'\|'PENDING'\|'APPROVED'\|'LIVE'" ad-server/src/api/loops.js
```

**Confirmed raw string write points in `loops.js` (from Step 1 read):**

| Route | Line (approx) | Raw string | Correct replacement |
|---|---|---|---|
| `POST /:loopId/reject` | L206 | `status: 'REJECTED'` | `status: LOOP_STATUS.REJECTED` |
| `POST /locations/:locationId/loops/approve-all` | L262 | `['status', '==', 'PENDING']` | `['status', '==', LOOP_STATUS.PENDING_APPROVAL]` |
| `POST /locations/:locationId/loops/approve-all` | L267 | `status: 'APPROVED'` | `status: LOOP_STATUS.APPROVED` |

**Fix — add import at top of `loops.js`:**
```js
// Add to existing imports at top of ad-server/src/api/loops.js
import { loopRepository, BUSINESS_HOURS, LOOP_STATUS } from '../repositories/LoopRepository.js';
```
(`LOOP_STATUS` is already exported from `LoopRepository.js` — just not imported in `loops.js`.)

**Fix — replace raw strings:**
```js
// POST /:loopId/reject — line ~206
// BEFORE:
status: 'REJECTED',
// AFTER:
status: LOOP_STATUS.REJECTED,

// POST /locations/.../approve-all — line ~262
// BEFORE:
['status', '==', 'PENDING'],
// AFTER:
['status', '==', LOOP_STATUS.PENDING_APPROVAL],

// POST /locations/.../approve-all — line ~267
// BEFORE:
status: 'APPROVED',
// AFTER:
status: LOOP_STATUS.APPROVED,
```

**Note on `'PENDING'` vs `'PENDING_APPROVAL'`:** The raw string at L262 uses `'PENDING'` which does not match `LOOP_STATUS.PENDING_APPROVAL`. This means the approve-all bulk route has been querying with the wrong value since S13-2. After S16-1 the constant becomes `'pending_approval'` — the query must use the constant, not the old raw string.

**Verification steps:**
1. `grep -n "'REJECTED'\|'PENDING'\|'APPROVED'" ad-server/src/api/loops.js` → zero results.
2. `grep -n "LOOP_STATUS" ad-server/src/api/loops.js` → at least 3 results.
3. Import line confirms `LOOP_STATUS` is destructured from `LoopRepository.js`.
4. `POST /api/loops/:loopId/reject` with valid loopId → `status` in Firestore doc = `'rejected'` (after backfill).
5. `POST /api/locations/:locationId/loops/approve-all` → only loops with `status == 'pending_approval'` are updated.

**Outcome probability:** 92%
**Biggest risk:** Accidental casing mismatch if S16-1 constants are renamed but S16-2 import is committed to a different branch or out of order. Must be a single atomic commit.

---

### S16-3 — Create `firestore.indexes.json` with composite indexes

**Priority:** 🟡 Pre-production — required before advertiser invoice pagination and campaign filtering perform correctly at scale.

**Pre-checks (GUARDRAIL-9):**
```bash
# Confirm file does not exist
find . -name "firestore.indexes.json"

# Confirm firebase.json or .firebaserc exist (deploy pipeline)
find . -name "firebase.json" -o -name ".firebaserc" | head -5

# Check for any existing index deploy step in CI
grep -r "firestore:deploy\|firebase deploy" . --include="*.yaml" --include="*.sh" --include="*.json" | grep -v node_modules
```

> ⚠️ If `firebase.json` does not exist, the index file cannot be deployed via `firebase deploy --only firestore:indexes`. Flag as blocked and document the deploy method before proceeding.

**File to create:** `firestore.indexes.json` at repo root (or at the path referenced by `firebase.json` → `firestore.indexes`).

**Content:**
```json
{
  "indexes": [
    {
      "collectionGroup": "invoices",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "advertiserId", "order": "ASCENDING" },
        { "fieldPath": "generatedAt",  "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "campaigns",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "advertiser_id", "order": "ASCENDING" },
        { "fieldPath": "createdAt",     "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

**Verification steps:**
1. `find . -name "firestore.indexes.json"` → found at confirmed path.
2. `cat firestore.indexes.json | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); JSON.parse(d); console.log('valid JSON')"` → `valid JSON`.
3. `firebase deploy --only firestore:indexes --project <staging-project>` → exits 0, no errors.
4. Firebase console → Firestore → Indexes tab → both composite indexes show `ENABLED` status.

**Outcome probability:** 82%
**Biggest risk:** `firebase.json` does not exist in repo — deploy pipeline unknown. If no pipeline exists, this task degrades to "create the file + document manual deploy steps."

---

### S16-4 — Schedule or close S11-1/2/4 persistence QA (GUARDRAIL-14 escalation)

**Priority:** 🔴 Must be resolved this sprint per GUARDRAIL-14 (3rd carry).

**Pre-checks:**
```bash
# Enumerate test directory
ls -la tests/
find tests/ -name "*.spec.*" -o -name "*.test.*" | sort

# Check for S11-related test files specifically
grep -rn "S11\|persistence\|s11" tests/ --include="*.spec.*" --include="*.test.*" -l
```

**Resolution options (pick one — must be documented in this spec before sprint close):**

| Option | Action | Condition |
|---|---|---|
| A — Fix | Identify the failing test files, run them, fix regressions. | Test files found and failures are actionable. |
| B — Defer with reason | Add explicit `# DEFERRED-S16` comment in each test file + note in `DATABASE_SCHEMA.md`. | Firestore emulator not available in CI; tests cannot run without emulator. |
| C — Close as won't-fix | Remove or skip the tests with a documented reason. | Tests are superseded by later architecture changes and no longer valid. |

**Acceptance criteria (whichever option is chosen):**
- The specific test file paths are documented here before sprint close.
- The chosen option (A/B/C) is recorded in this document under `§ S16-4 Resolution`.
- No sprint may carry this item to S17 without a documented reason.

**Outcome probability:** 85% (given pre-check is run — 60% without it)
**Biggest risk:** Test files reference deleted routes or deprecated service methods from S7–S11, making Option A impractical without significant refactor.

---

### S16-5 — Update `DATABASE_SCHEMA.md`

**Priority:** 🟢 Blocking per GUARDRAIL-13 — must land before sprint is marked done.

**Files touched:** `docs/DATABASE_SCHEMA.md`

**Changes required:**

1. **Close ENUM-AUDIT-2:** Add a note under the `playlists` collection entry:
   ```
   ENUM-AUDIT-2 CLOSED (Sprint 13): playlists.status default corrected to 'draft' (lowercase)
   in playlists.js L22. No further action required.
   ```

2. **Document ENUM-AUDIT-1 migration plan:** Under the `loops` collection entry, add:
   ```
   ENUM-AUDIT-1 (Sprint 16): LOOP_STATUS and SLOT_STATUS constants migrated to lowercase
   in LoopRepository.js. Firestore backfill required — see scripts/migrate-loop-status-lowercase.js.
   Dual-write period: S16. Cutover: S17 after backfill confirmed.
   ```

3. **Update canonical enum values** for `loops.status`:
   ```
   loops.status: pending_approval | approved | rejected | live
   loops.slots[].status: pending | approved | rejected | replaced | booked | available
   ```

4. **Note S16-0 nav fix:** Under a `Frontend Notes` section or inline:
   ```
   S16-0: BRAND_NAV /dashboard/brand/invoices corrected to /dashboard/advertiser/invoices.
   No separate brand/invoices page planned at this time.
   ```

**Verification steps:**
1. `grep -n "ENUM-AUDIT-2" docs/DATABASE_SCHEMA.md` → contains "CLOSED (Sprint 13)".
2. `grep -n "ENUM-AUDIT-1" docs/DATABASE_SCHEMA.md` → contains "Sprint 16" migration note.
3. `grep -n "pending_approval\|approved\|rejected\|live" docs/DATABASE_SCHEMA.md` → all lowercase in canonical enum section.

**Outcome probability:** 98%
**Biggest risk:** None — doc-only edit.

---

## 5. Isolation and Blast Radius

| Task | Files | Change Type | Can It Break Anything Else? | Why / Mitigation |
|---|---|---|---|---|
| S16-0 | `DashboardLayout.jsx` | EDIT — 1 string value in `BRAND_NAV` | No | Additive correction. No other component imports `BRAND_NAV`. React-Router renders the correct page at the corrected path. |
| S16-1 | `LoopRepository.js` | EDIT — constant string values only | **Yes — Firestore queries** | Any caller querying `status == 'PENDING_APPROVAL'` against docs still stored with uppercase will miss results until backfill completes. Mitigation: dual-write period, backfill script, cutover gated on script completion. |
| S16-2 | `loops.js` | EDIT — 3 lines, import + 3 string replacements | **Yes — must be atomic with S16-1** | If S16-1 lands without S16-2, `loops.js` continues writing uppercase raw strings. Must be same commit. |
| S16-3 | `firestore.indexes.json` (new file) | CREATE | No — additive only | New file. No existing code references it. Index deploy is a separate CLI step. |
| S16-4 | `tests/` (read-only audit + possible edit) | DECISION / optional edit | No | Audit only. Any test edit is isolated to test infrastructure. |
| S16-5 | `docs/DATABASE_SCHEMA.md` | EDIT — doc only | No | Doc-only. No runtime impact. |

### Isolation Verdict

**S16-0, S16-3, S16-4, S16-5** are fully isolated. They touch no shared runtime infrastructure.

**S16-1 + S16-2** are the only cross-cutting risk. They must be treated as a single atomic unit:
- Committed in the same PR / same commit.
- Backfill script created before the PR is merged to a staging environment.
- No production deploy until Firestore backfill is confirmed complete.

### Genuine Cross-Cutting Risks

1. **Enum cutover timing** — `LoopRepository.js` and `loops.js` both read and write `loops.status`. Any window where one is updated and the other is not will cause mixed-case Firestore documents and broken queries. Atomic commit is mandatory.

2. **`findPendingByRetailer()` query correctness** — After S16-1, this method queries `status == 'pending_approval'`. Any existing Firestore document with `status: 'PENDING_APPROVAL'` will not match until the backfill script runs. The retailer approval flow (pending loop list) will silently return empty results for old records.

---

## 6. File Inventory

| File | Operation | Linked Task(s) |
|---|---|---|
| `client-app/src/layouts/DashboardLayout.jsx` | EDIT | S16-0 |
| `ad-server/src/repositories/LoopRepository.js` | EDIT | S16-1 |
| `ad-server/src/api/loops.js` | EDIT | S16-2 |
| `ad-server/scripts/migrate-loop-status-lowercase.js` | CREATE | S16-1 (backfill) |
| `firestore.indexes.json` | CREATE | S16-3 |
| `docs/DATABASE_SCHEMA.md` | EDIT | S16-5 |
| `current_sprint/sprint16.md` | CREATE | This document |

---

## 7. Test Stabilization Order

> S16-4 pre-check (`ls tests/` + `find tests/`) must be run before this section can be finalized.
> The following order applies once test file names are confirmed.

1. **Loop approval flow tests** — any test exercising `loopRepository.approveLoop()`, `findPendingByRetailer()`, or `findApprovedByScreen()`. These are directly affected by the S16-1 enum change. Run after S16-1 + S16-2 land and after backfill script completes.

2. **Bulk approve-all route tests** — any test for `POST /api/locations/:locationId/loops/approve-all`. The `'PENDING'` raw string bug (not matching `PENDING_APPROVAL`) may have caused false passes. Re-run after S16-2.

3. **S11-1 / S11-2 / S11-4 persistence tests** — identified and triaged in S16-4. Run in isolation after triage decision.

4. **Invoice list / pagination tests** — after `firestore.indexes.json` is deployed (S16-3). Any test that relies on `invoices(advertiserId, generatedAt DESC)` ordering.

5. **Frontend smoke: brand sidebar Invoices link** — after S16-0. Navigate as advertiser persona, confirm `/dashboard/advertiser/invoices` loads without 404.

---

## 8. Definition of Done

- [ ] `grep "brand/invoices" client-app/src/layouts/DashboardLayout.jsx` → zero results.
- [ ] Navigating to Invoices as advertiser persona loads `/dashboard/advertiser/invoices` with HTTP 200 and no NotFound component.
- [ ] `grep -n "LOOP_STATUS\|SLOT_STATUS" ad-server/src/repositories/LoopRepository.js` → all constant values are lowercase strings.
- [ ] `grep -n "'REJECTED'\|'PENDING'\|'APPROVED'\|'LIVE'" ad-server/src/api/loops.js` → zero results.
- [ ] `grep -n "LOOP_STATUS" ad-server/src/api/loops.js` → import confirmed + at least 3 usages.
- [ ] S16-1 and S16-2 changes are in the same commit — no window where one lands without the other.
- [ ] `ad-server/scripts/migrate-loop-status-lowercase.js` exists on disk and is idempotent (confirmed by code review).
- [ ] Backfill script run in staging environment — zero uppercase `loops.status` documents remain after run.
- [ ] `firestore.indexes.json` exists on disk with both composite index definitions as valid JSON.
- [ ] Both Firestore composite indexes show `ENABLED` status in Firebase console (staging).
- [ ] S16-4 resolution documented in this file under `§ S16-4 Resolution` — Option A, B, or C confirmed with test file paths listed.
- [ ] `grep "ENUM-AUDIT-2" docs/DATABASE_SCHEMA.md` → contains "CLOSED (Sprint 13)".
- [ ] `grep "ENUM-AUDIT-1" docs/DATABASE_SCHEMA.md` → contains "Sprint 16" migration note with backfill reference.
- [ ] `grep "pending_approval" docs/DATABASE_SCHEMA.md` → lowercase enum values present in canonical section.
- [ ] No new `NOT ON DISK` or `NOT CONFIRMED IN SOURCE` items remain unresolved at sprint close.
- [ ] All 14 guardrails remain intact — no new violation introduced by any S16 commit.

---

## § S16-4 Resolution

> **Pending** — to be filled in after `ls tests/` pre-check is run.

```
Test files identified:
  [ to be filled ]

Resolution chosen: [ A | B | C ]
Reason:
  [ to be filled ]
```

---

*Sprint 16 spec authored: 2026-06-08 — grounded against HEAD `a790fd5`.*
*14 guardrails active. ENUM-AUDIT-2 closed. ENUM-AUDIT-1 in-flight.*
