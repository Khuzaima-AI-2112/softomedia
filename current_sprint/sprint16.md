# Sprint 16 — Enum Normalization, Loop Status Integrity & Infra Hardening

**Sprint:** 16
**Status:** In Progress
**Spec authored:** 2026-06-08
**Step 3 tightened:** 2026-06-08
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
| `current_sprint/sprint16.md` | Created at Step 2 |
| `BRAND_NAV` `/dashboard/brand/invoices` | Live 404 bug — nav link in `DashboardLayout.jsx` L33 points to unregistered route |
| `LOOP_STATUS` enum | All-uppercase in `LoopRepository.js` (`PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `LIVE`) — violates GUARDRAIL-4 |
| `SLOT_STATUS` enum | All-uppercase in `LoopRepository.js` (`PENDING`, `APPROVED`, `REJECTED`, `REPLACED`, `BOOKED`, `AVAILABLE`) — violates GUARDRAIL-4 |
| `loops.js` S13-2 raw string writes | `'REJECTED'`, `'PENDING'`, `'APPROVED'` written as raw strings bypassing `LOOP_STATUS` constants — active Firestore pollution |
| `playlists.js` ENUM-AUDIT-2 | **RESOLVED in S13** — `status = 'draft'` (lowercase). ENUM-AUDIT-2 is closed. |
| `PlaylistRepository.js` ENUM-AUDIT-2 survivor | `findActiveByScreen()` and `findGlobalPlaylist()` both query `status == 'ACTIVE'` (uppercase) — **new finding, not in S15 retro** |
| `firestore.indexes.json` | NOT ON DISK |
| S11-1/2/4 persistence QA | `tests/` has 17 spec files — `integration_broadcasting.spec.js` (11,254B) and `loop_builder.spec.js` (7,291B) are the most likely candidates |
| `GET /api/invoices/:id/pdf` | Stub confirmed at `ad-server/src/api/invoices.js` ~L152 — returns HTTP 200 JSON stub |
| `PricingService.js` | NOT ON DISK — FM-S15-5 confirmed optional; not created |

---

## Step 3 — Outcome Probability Tightening

### Probability Delta Table

| Task | Old Score | New Score | What Raised It | What Caps It | Remaining Risks |
|---|---|---|---|---|---|
| **S16-0** Fix `BRAND_NAV` invoices link | 97% | **99%** | `App.jsx` confirmed live at `client-app/src/App.jsx` (13,344B). `DashboardLayout.jsx` confirmed in `client-app/src/layouts/`. `client-app/src/pages/advertiser/` tree confirmed. Fix is 1 string change in 1 known array. | 1% — if brand persona has a separate auth guard or role check that wraps BRAND_NAV differently, the link change may display for wrong role. | Role-based nav guard behavior around `BRAND_NAV` vs `RETAILER_NAV` not read. |
| **S16-1** Normalize `LOOP_STATUS` + `SLOT_STATUS` to lowercase | 88% | **83%** | **Lowered.** `PlaylistRepository.js` finding proves there is at least one more enum survivor not in the S15 retro. The same pattern likely exists in other repositories not yet read. The blast radius of enum migration is wider than Step 2 assumed. | Capped by: unread repo files that may import `LOOP_STATUS` constants; Firestore document volume in prod unknown; no CI Firestore emulator confirmed. | 1) Other repository files may reference `LOOP_STATUS` / `SLOT_STATUS` by string literal rather than constant — full grep not yet run across all `ad-server/src`. 2) Migration strategy (dual-write vs big-bang) not decided. 3) Backfill script does not exist on disk yet. |
| **S16-2** Fix `loops.js` S13-2 raw string writes | 92% | **95%** | All 3 raw string write points confirmed in `loops.js` at L206, L262, L267. Import path for `LOOP_STATUS` from `LoopRepository.js` confirmed. The `'PENDING'` vs `'PENDING_APPROVAL'` mismatch is now documented — the fix is unambiguous. | 5% — if S16-1 and S16-2 are not committed atomically, a window of mixed-case writes opens. | Atomicity with S16-1 is the only remaining risk. |
| **S16-3** Create `firestore.indexes.json` | 82% | **71%** | **Lowered.** `firebase.json` and `.firebaserc` existence is NOT confirmed on disk. `client-app/src/` listing shows no firebase config reference. Without a deploy pipeline, the index file is inert. | Capped by: deploy pipeline entirely unknown; no CI step for `firebase deploy --only firestore:indexes` confirmed; Firestore collection field names in the spec (`advertiserId` vs `advertiser_id`) not yet cross-checked against `InvoiceRepository.js`. | 1) `firebase.json` NOT CONFIRMED — index deploy may require manual CLI step or a separate infra workflow. 2) Field name casing mismatch risk (`advertiserId` vs `advertiser_id`) — must grep `InvoiceRepository.js` before writing the index. |
| **S16-4** Schedule or close S11-1/2/4 persistence QA | 85% | **88%** | `tests/` directory listed — 17 spec files now known. `integration_broadcasting.spec.js` (11,254B) and `loop_builder.spec.js` (7,291B) are the highest-probability candidates for S11-1/2/4 coverage. Decision can now be made with file names in hand. | 12% — S11 task IDs not explicitly labelled in test file content yet — must open the two candidate files to confirm which tests correspond to S11-1, S11-2, S11-4 before Option A/B/C can be formally chosen. | Test file content unread. Cannot confirm S11 task IDs without opening the files. |
| **S16-5** Update `DATABASE_SCHEMA.md` | 98% | **97%** | **Marginally lowered.** `PlaylistRepository.js` finding introduces a new item (`ACTIVE` uppercase query survivor) that was not in the Step 2 doc update scope. Schema doc must now also capture this survivor. | 3% — scope of doc update is slightly larger than Step 2 assumed; risk of incomplete update if writer misses the `PlaylistRepository.js` survivor. | Must document `PlaylistRepository.js` `ACTIVE` query survivor under a new `ENUM-AUDIT-2 SURVIVOR` note. |

---

### Tasks That Cannot Realistically Exceed 90% Yet

#### S16-1 — Normalize `LOOP_STATUS` + `SLOT_STATUS` (capped at 83%)

**Three unresolved factors, each independently capable of causing a partial failure:**

**Factor 1 — Full grep across `ad-server/src` not run**

The Step 1 read confirmed `LoopRepository.js` and `loops.js`. It did not grep all files in `ad-server/src` for string literals matching `'PENDING_APPROVAL'`, `'APPROVED'`, `'REJECTED'`, `'LIVE'`, `'BOOKED'`, `'REPLACED'`, `'AVAILABLE'`. The `PlaylistRepository.js` finding proves this pattern recurs. There may be additional raw-string references in:
- `ad-server/src/api/scheduling.js` or similar — not listed in tree yet
- Any middleware that inspects `loop.status` directly
- Any `where` clause that uses a hardcoded string in a non-repository file

**Required pre-work before S16-1 can exceed 90%:**
```bash
grep -rn \
  "'PENDING_APPROVAL'\|'APPROVED'\|'REJECTED'\|'LIVE'\|'PENDING'\|'BOOKED'\|'REPLACED'\|'AVAILABLE'" \
  ad-server/src --include="*.js" \
  | grep -v "LoopRepository.js\|loops.js\|node_modules"
```
If the output is empty → S16-1 rises to ~92%.
If the output has hits → those files must be added to the blast radius before the sprint can proceed.

**Factor 2 — Firestore document volume in production unknown**

The dual-write + backfill strategy is correct in principle. But the backfill script cannot be validated without knowing approximately how many `loops` documents exist in production. If the collection is large (>10,000 documents), a naive `getDocs(collection(db, 'loops'))` backfill will hit Firestore read quota limits and time out.

**Required pre-work before S16-1 backfill script can be written safely:**
```bash
# Check if there is a Firestore admin SDK script pattern in the repo
find ad-server -name "*.js" -path "*/scripts/*" | head -10
find ad-server -name "firebase-admin*" | head -5
grep -rn "firebase-admin\|getFirestore\|admin.firestore" ad-server --include="*.js" | head -10
```
If `firebase-admin` is already used in the codebase → backfill script can use the admin SDK with batched writes (500 docs per batch), raising the score.
If `firebase-admin` is NOT in the codebase → backfill requires either adding a new dependency or using the Firebase CLI's Firestore import/export path, which has different operational risk.

**Factor 3 — No CI Firestore emulator confirmed**

The test files in `tests/` may or may not use the Firestore emulator. If enum migration tests run against a live Firestore project (not an emulator), the test environment itself becomes a risk vector during the S16-1 validation phase.

**Required pre-work:**
```bash
grep -rn "FIRESTORE_EMULATOR_HOST\|useEmulator\|connectFirestoreEmulator" \
  ad-server/src tests --include="*.js" | head -20
```

---

#### S16-3 — Create `firestore.indexes.json` (capped at 71%)

**Two unresolved factors:**

**Factor 1 — `firebase.json` and deploy pipeline not confirmed on disk**

The index file is inert without a deploy mechanism. `firebase deploy --only firestore:indexes` requires `firebase.json` to reference the index file path. Without this:
- The file can be created
- It cannot be deployed
- The Firestore queries remain unoptimized
- The task cannot be marked Done

**Required pre-work:**
```bash
find . -name "firebase.json" -o -name ".firebaserc" | grep -v node_modules
```
- **If found** → read `firebase.json` to confirm `"firestore": { "indexes": "firestore.indexes.json" }` key exists. Score rises to ~88%.
- **If not found** → task degrades to "create the file + document that manual deploy is required." Score stays at 71% because Done criteria require Firebase console confirmation of `ENABLED` status, which is blocked.

**Factor 2 — Field name casing not cross-checked against `InvoiceRepository.js`**

The Step 2 spec writes `advertiserId` (camelCase) for the `invoices` composite index. Firestore field paths are case-sensitive. If `InvoiceRepository.js` writes `advertiser_id` (snake_case), the index will never be used.

**Required pre-work before writing the index file:**
```bash
grep -n "advertiserId\|advertiser_id\|generatedAt\|generated_at" \
  ad-server/src/repositories/InvoiceRepository.js
```
This single grep eliminates the field-name casing risk entirely. Score rises to ~85% after this pre-check.

---

### Revised Task Details (Step 3 Tightened)

---

#### S16-0 — Fix `BRAND_NAV` invoices link (99%)

**All uncertainties eliminated from Step 2. No new pre-checks required.**

**Confirmed sources:**
- `client-app/src/layouts/` — confirmed on disk (directory listed)
- `client-app/src/App.jsx` — confirmed on disk (13,344B)
- `client-app/src/pages/` — confirmed on disk (directory listed)

**One remaining 1% risk — document it explicitly:**

Before committing, confirm `BRAND_NAV` is not role-gated differently from `ADVERTISER_NAV`. If `DashboardLayout.jsx` renders `BRAND_NAV` only for a `brand` role and `ADVERTISER_NAV` only for an `advertiser` role, and these are separate personas with separate auth guards, then pointing `BRAND_NAV` at `/dashboard/advertiser/invoices` may render the nav link for the wrong persona's UI context.

**Additional pre-check (new for Step 3):**
```bash
grep -n "BRAND_NAV\|ADVERTISER_NAV\|role\|persona\|userRole\|brand\|advertiser" \
  client-app/src/layouts/DashboardLayout.jsx | head -30
```

**Acceptance criteria (falsifiable):**
1. `grep "brand/invoices" client-app/src/layouts/DashboardLayout.jsx` → exit 1, zero matches.
2. Login as advertiser/brand persona → click "Invoices" in sidebar → URL is `/dashboard/advertiser/invoices`.
3. HTTP 200 on `/dashboard/advertiser/invoices`. No `<NotFound>` component rendered.
4. Hard-refresh at `/dashboard/advertiser/invoices` → page loads without redirect.
5. No other component in `client-app/src/` references `/dashboard/brand/invoices`:
   ```bash
   grep -rn "brand/invoices" client-app/src --include="*.jsx" --include="*.js"
   ```
   → zero results.

---

#### S16-1 — Normalize `LOOP_STATUS` + `SLOT_STATUS` to lowercase (83%)

**New pre-checks added by Step 3 (must run before any code is written):**

```bash
# 1. Full raw-string audit across all ad-server/src files except known ones
grep -rn \
  "'PENDING_APPROVAL'\|'APPROVED'\|'REJECTED'\|'LIVE'\|'PENDING'\|'BOOKED'\|'REPLACED'\|'AVAILABLE'" \
  ad-server/src --include="*.js" \
  | grep -v "LoopRepository.js\|loops.js"

# 2. Confirm all files that import LOOP_STATUS or SLOT_STATUS
grep -rn "LOOP_STATUS\|SLOT_STATUS" ad-server/src --include="*.js"

# 3. Confirm firebase-admin SDK availability for backfill script
grep -rn "firebase-admin\|getFirestore\|admin\.firestore" ad-server/src --include="*.js" | head -10
find ad-server -name "package.json" | xargs grep "firebase-admin" 2>/dev/null

# 4. Confirm Firestore emulator usage in tests
grep -rn "FIRESTORE_EMULATOR_HOST\|connectFirestoreEmulator\|useEmulator" \
  ad-server/src tests --include="*.js" | head -20
```

**Confirmed write points in `LoopRepository.js` (from Step 1 read — already confirmed, not re-checked):**

| Method | Current value written | After S16-1 |
|---|---|---|
| `create()` default | `LOOP_STATUS.PENDING_APPROVAL` = `'PENDING_APPROVAL'` | `= 'pending_approval'` |
| `approveLoop()` | `LOOP_STATUS.APPROVED` = `'APPROVED'` | `= 'approved'` |
| `replaceSlot()` clone | `LOOP_STATUS.PENDING_APPROVAL` | `= 'pending_approval'` |
| `rejectSlot()` slot | `SLOT_STATUS.REJECTED` = `'REJECTED'` | `= 'rejected'` |
| `replaceSlot()` slot | `SLOT_STATUS.REPLACED` = `'REPLACED'` | `= 'replaced'` |
| `bookSlot()` slot | `SLOT_STATUS.BOOKED` = `'BOOKED'` | `= 'booked'` |
| `findPendingByRetailer()` query | `LOOP_STATUS.PENDING_APPROVAL` | `= 'pending_approval'` |
| `findApprovedByScreen()` query | `LOOP_STATUS.APPROVED` | `= 'approved'` |

**New finding from Step 3 — `PlaylistRepository.js` ENUM-AUDIT-2 survivor:**

`PlaylistRepository.js` queries `status == 'ACTIVE'` in at least two methods (`findActiveByScreen()`, `findGlobalPlaylist()`). This is outside S16-1's scope (it is a `playlists` collection issue, not `loops`) but must be:
1. Added to the Risk Register as RISK-S16-9.
2. Documented in `DATABASE_SCHEMA.md` under S16-5.
3. Scheduled for S17 if not addressed in S16.

**S16-1 must NOT silently fix `PlaylistRepository.js`** — it is out of scope and touching it expands blast radius. Document and defer.

**Enum constant replacement (unchanged from Step 2, confirmed correct):**
```js
// LoopRepository.js
export const LOOP_STATUS = {
    PENDING_APPROVAL: 'pending_approval',
    APPROVED:         'approved',
    REJECTED:         'rejected',
    LIVE:             'live',
};

export const SLOT_STATUS = {
    PENDING:   'pending',
    APPROVED:  'approved',
    REJECTED:  'rejected',
    REPLACED:  'replaced',
    BOOKED:    'booked',
    AVAILABLE: 'available',
};
```

**Backfill script skeleton (to be completed after firebase-admin availability confirmed):**

File: `ad-server/scripts/migrate-loop-status-lowercase.js`

```js
/**
 * One-time migration: normalize loops.status and loops.slots[].status to lowercase.
 * Idempotent — safe to re-run.
 * Run AFTER S16-1 constants are deployed to staging.
 * Run BEFORE S16-1 is deployed to production.
 */

const UPPERCASE_TO_LOWER = {
    'PENDING_APPROVAL': 'pending_approval',
    'APPROVED':         'approved',
    'REJECTED':         'rejected',
    'LIVE':             'live',
};

const SLOT_UPPER_TO_LOWER = {
    'PENDING':   'pending',
    'APPROVED':  'approved',
    'REJECTED':  'rejected',
    'REPLACED':  'replaced',
    'BOOKED':    'booked',
    'AVAILABLE': 'available',
};

// TODO: import firebase-admin and initialize — confirm SDK availability via pre-check #3 above
// TODO: batch writes in groups of 500 to respect Firestore batch limit
// TODO: log migrated document IDs to stdout
// TODO: exit non-zero if any write fails
```

**Acceptance criteria (falsifiable):**
1. `grep -n "PENDING_APPROVAL.*=.*'PENDING_APPROVAL'" ad-server/src/repositories/LoopRepository.js` → zero results.
2. `grep -n "'pending_approval'" ad-server/src/repositories/LoopRepository.js` → at least 3 results (create, approveLoop, findPending).
3. All SLOT_STATUS values in `LoopRepository.js` are lowercase strings.
4. `ad-server/scripts/migrate-loop-status-lowercase.js` exists and is runnable in staging with exit 0.
5. After backfill script run in staging: `db.collection('loops').where('status', 'in', ['PENDING_APPROVAL','APPROVED','REJECTED','LIVE']).get()` → zero documents.
6. After backfill: `db.collection('loops').where('status', '==', 'pending_approval').get()` → returns all previously-PENDING_APPROVAL loops.
7. `DATABASE_SCHEMA.md` canonical enum section updated to lowercase values.
8. S16-1 and S16-2 land in the same commit (verified by commit SHA containing diffs for both files).

**Score path to 90%+:**
- Run pre-check #1 (raw string grep) → zero hits → +5% (88%)
- Confirm firebase-admin in package.json → +3% (91%)
- Confirm emulator in test suite → +2% (93%)

---

#### S16-2 — Fix `loops.js` raw string writes (95%)

**All write points confirmed. No new pre-checks required.**

**Confirmed raw string violations (from Step 1 read):**

| Line | Route | Bug | Fix |
|---|---|---|---|
| L206 | `POST /:loopId/reject` | `status: 'REJECTED'` | `status: LOOP_STATUS.REJECTED` |
| L262 | `POST /locations/:locationId/loops/approve-all` | `['status', '==', 'PENDING']` | `['status', '==', LOOP_STATUS.PENDING_APPROVAL]` |
| L267 | `POST /locations/:locationId/loops/approve-all` | `status: 'APPROVED'` | `status: LOOP_STATUS.APPROVED` |

**Step 3 note on L262 bug severity:**
The `'PENDING'` string at L262 is not just a casing violation — it is a **wrong value**. `LOOP_STATUS.PENDING_APPROVAL` = `'PENDING_APPROVAL'` (not `'PENDING'`). The bulk approve-all route has been silently querying with a value that matches zero records since S13-2. This means:
- `POST /locations/:locationId/loops/approve-all` has returned HTTP 200 with 0 approvals since S13-2.
- Any QA test that passed on this route was not exercising real approval.
- After S16-2, this route will begin working correctly for the first time since S13-2.

This is a regression fix, not just a style fix. The acceptance criteria must explicitly verify that approve-all now approves real pending loops.

**Acceptance criteria (falsifiable):**
1. `grep -n "'REJECTED'\|'PENDING'\|'APPROVED'\|'LIVE'" ad-server/src/api/loops.js` → zero results.
2. `grep -n "LOOP_STATUS" ad-server/src/api/loops.js` → minimum 4 results (import line + 3 usages).
3. Import line: `import { ..., LOOP_STATUS } from '../repositories/LoopRepository.js'` present in `loops.js` top-level imports.
4. **Regression test for approve-all:** Seed staging Firestore with 3 loops at `status: 'pending_approval'` (lowercase, after S16-1 backfill). `POST /api/locations/:locationId/loops/approve-all` → response body contains `approvedCount: 3` (or equivalent). All 3 docs in Firestore now have `status: 'approved'`.
5. **Reject route test:** Seed staging Firestore with 1 loop at `status: 'pending_approval'`. `POST /api/loops/:loopId/reject` → doc in Firestore has `status: 'rejected'`.
6. Commit SHA is shared with S16-1 (single atomic commit).

**Remaining 5% risk:** Atomicity enforcement. If a developer merges S16-1 and S16-2 in separate PRs with any window between merges, Firestore will receive mixed-case writes during the gap. Enforce via PR policy: both files must appear in the same commit diff.

---

#### S16-3 — Create `firestore.indexes.json` (71%)

**Two pre-checks added by Step 3 that are blocking before the file can be written:**

**Pre-check A — Field name casing in `InvoiceRepository.js` (blocking):**
```bash
grep -n "advertiserId\|advertiser_id\|generatedAt\|generated_at" \
  ad-server/src/repositories/InvoiceRepository.js
```
- If `advertiser_id` (snake_case) → write index with `"fieldPath": "advertiser_id"`.
- If `advertiserId` (camelCase) → write index with `"fieldPath": "advertiserId"`.
- Writing the wrong casing creates a valid JSON file that deploys successfully but is never used by Firestore.

**Pre-check B — Deploy pipeline (blocking for Done criteria):**
```bash
find . -name "firebase.json" -o -name ".firebaserc" | grep -v node_modules | head -5
```
- **If found:** Read `firebase.json` → confirm `"firestore": { "indexes": "<path>" }` key. Update the path in the new file accordingly.
- **If not found:** Task scope narrows to CREATE FILE ONLY. Done criteria drop to: file exists with valid JSON and correct field names. The Firebase console `ENABLED` check cannot be a Done criterion without a deploy pipeline.

**Index content (field names TBD pending Pre-check A — camelCase placeholders used below, must be corrected after grep):**
```json
{
  "indexes": [
    {
      "collectionGroup": "invoices",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "{{advertiser_id_OR_advertiserId}}", "order": "ASCENDING" },
        { "fieldPath": "{{generatedAt_OR_generated_at}}",  "order": "DESCENDING" }
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

> ⚠️ The `{{...}}` placeholders above MUST be replaced with confirmed field names from Pre-check A before the file is committed. Committing placeholder text will break Firestore index deployment.

**Acceptance criteria (falsifiable — two tiers):**

*Tier 1 — File creation (achievable without deploy pipeline):*
1. `find . -name "firestore.indexes.json" | grep -v node_modules` → returns exactly 1 result.
2. `node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8')); console.log('valid')"` → prints `valid`.
3. `grep "{{" firestore.indexes.json` → zero results (no unresolved placeholders).
4. Field names in the file match the output of Pre-check A.

*Tier 2 — Deploy confirmation (requires firebase.json + deploy pipeline):*
5. `firebase deploy --only firestore:indexes --project <staging>` → exits 0.
6. Firebase console → Firestore → Indexes → both composite indexes show `ENABLED` status.
7. `GET /api/invoices?advertiserId=<id>` (or equivalent paginated endpoint) returns results ordered by `generatedAt DESC` without a Firestore "index required" error in server logs.

**Score path to 85%+:**
- Run Pre-check A → field names confirmed → +5% (76%)
- `firebase.json` found on disk → +9% (85%)

---

#### S16-4 — Schedule or close S11-1/2/4 persistence QA (88%)

**Test files now known from Step 3 `tests/` listing.**

**Candidate files for S11-1, S11-2, S11-4 (by size — larger files more likely to contain integration/persistence tests):**

| File | Size | Likelihood for S11-1/2/4 |
|---|---|---|
| `tests/integration_broadcasting.spec.js` | 11,254B | 🔴 High — broadcasting/scheduling tests most likely to contain persistence assertions from S11 |
| `tests/loop_builder.spec.js` | 7,291B | 🟡 Medium — loop builder workflow, may include S11 slot persistence tests |
| `tests/analytics_loop.spec.js` | 4,044B | 🟢 Low — analytics scope |
| `tests/ad_player.spec.js` | 2,421B | 🟢 Low — ad player scope |

**Required pre-work (must open both candidate files):**
```bash
grep -n "S11\|persistence\|persist\|localStorage\|sessionStorage\|reload\|hard.refresh\|hard_refresh" \
  tests/integration_broadcasting.spec.js tests/loop_builder.spec.js
```

**Resolution options (unchanged from Step 2 — now made falsifiable):**

| Option | Condition | Acceptance criteria |
|---|---|---|
| **A — Fix** | Test failures are actionable and tests reference live routes/methods | All S11-labelled tests pass: `npx playwright test tests/integration_broadcasting.spec.js tests/loop_builder.spec.js --grep "S11"` exits 0 |
| **B — Defer with reason** | Tests require Firestore emulator not available in CI | `grep -c "FIRESTORE_EMULATOR_HOST\|connectFirestoreEmulator" tests/integration_broadcasting.spec.js` > 0 AND CI config confirms emulator is not provisioned. Add `test.skip` with comment `// DEFERRED-S16: emulator not in CI, rescheduled S17` |
| **C — Close as won't-fix** | Tests reference deleted routes or deprecated service methods from S7-S11 | Each skipped test has a comment citing the superseding sprint and the reason the test is no longer valid. `grep -c "won't-fix\|superseded" tests/integration_broadcasting.spec.js` > 0 |

**§ S16-4 Resolution** *(to be filled in after candidate files are read):*
```
Test files identified:
  [ ] tests/integration_broadcasting.spec.js — S11 coverage TBD
  [ ] tests/loop_builder.spec.js — S11 coverage TBD

Resolution chosen: [ A | B | C ]
Reason:
  [ to be filled after grep output reviewed ]
```

**Acceptance criteria (falsifiable):**
1. `grep -rn "S11" tests/` → all results accounted for with a status (fixed / deferred with reason / closed with reason).
2. No S11-labelled test has the status `// TODO` or is unannotated.
3. This section (`§ S16-4 Resolution`) is filled in before sprint is marked Done.
4. GUARDRAIL-14: no S17 carry without a documented reason in this file.

---

#### S16-5 — Update `DATABASE_SCHEMA.md` (97%)

**Scope expanded by Step 3 — `PlaylistRepository.js` ACTIVE query survivor must be documented.**

**Changes required (updated from Step 2):**

1. Close ENUM-AUDIT-2 for `playlists.js`:
   ```
   ENUM-AUDIT-2 CLOSED (Sprint 13): playlists.js L22 default corrected to status = 'draft' (lowercase). No further action on write path.
   ```

2. **New — document `PlaylistRepository.js` ACTIVE query survivor (ENUM-AUDIT-2 survivor):**
   ```
   ENUM-AUDIT-2 SURVIVOR (found Sprint 16 Step 3): PlaylistRepository.js
   findActiveByScreen() and findGlobalPlaylist() query status == 'ACTIVE' (uppercase).
   Write path in playlists.js is correct (lowercase 'draft').
   Query path has NOT been corrected. Scheduled for ENUM-AUDIT-3 in Sprint 17.
   Risk: findActiveByScreen() returns zero results for any playlist written after playlists.js
   was corrected in S13, if the active-status write path also moved to lowercase.
   Pre-check required before S17: grep -n "status.*active\|status.*ACTIVE" ad-server/src/api/playlists.js
   ```

3. Document ENUM-AUDIT-1 migration plan for `loops`:
   ```
   ENUM-AUDIT-1 (Sprint 16): LOOP_STATUS and SLOT_STATUS constants migrated to lowercase
   in LoopRepository.js. Raw string writes in loops.js corrected to use constants (S16-2).
   Firestore backfill required before production cutover — see scripts/migrate-loop-status-lowercase.js.
   Dual-write period: S16 staging. Production cutover: after backfill confirmed in staging.
   ```

4. Update canonical enum values for `loops`:
   ```
   loops.status (canonical): pending_approval | approved | rejected | live
   loops.slots[].status (canonical): pending | approved | rejected | replaced | booked | available
   ```

5. Document S16-0 nav fix:
   ```
   S16-0 (Sprint 16): BRAND_NAV /dashboard/brand/invoices corrected to /dashboard/advertiser/invoices
   in DashboardLayout.jsx. No separate brand/invoices page planned at this time.
   If brand and advertiser personas are split in a future sprint, this nav entry must be re-evaluated.
   ```

**Acceptance criteria (falsifiable):**
1. `grep "ENUM-AUDIT-2 CLOSED" docs/DATABASE_SCHEMA.md` → contains "Sprint 13".
2. `grep "ENUM-AUDIT-2 SURVIVOR" docs/DATABASE_SCHEMA.md` → contains "PlaylistRepository.js".
3. `grep "ENUM-AUDIT-1" docs/DATABASE_SCHEMA.md` → contains "Sprint 16" and "migrate-loop-status-lowercase.js".
4. `grep "pending_approval\|approved\|rejected\|live" docs/DATABASE_SCHEMA.md` → lowercase canonical values present.
5. `grep "ACTIVE\|PENDING_APPROVAL\|APPROVED\|REJECTED\|LIVE" docs/DATABASE_SCHEMA.md` → if present, only in historical/survivor notes, not as canonical values.
6. `grep "brand/invoices" docs/DATABASE_SCHEMA.md` → contains "corrected to /dashboard/advertiser/invoices".

---

## 1. Risk Register

| ID | Description | Area | Status | Evidence |
|---|---|---|---|---|
| RISK-S16-1 | `LOOP_STATUS` and `SLOT_STATUS` enums are all-uppercase in `LoopRepository.js`, violating GUARDRAIL-4. New records are being created with uppercase status values on every loop approve/reject/replace call. | Backend / Firestore | 🔴 Active | `LoopRepository.js` L19–31: `LOOP_STATUS.APPROVED = 'APPROVED'`, etc. |
| RISK-S16-2 | `loops.js` S13-2 routes write raw uppercase strings (`'REJECTED'`, `'PENDING'`, `'APPROVED'`) that bypass `LOOP_STATUS` constants entirely. L262 uses `'PENDING'` which does not match `LOOP_STATUS.PENDING_APPROVAL` — approve-all route has returned 0 approvals since S13-2. | Backend | 🔴 Active | `loops.js` L206, L262, L267 |
| RISK-S16-3 | `DashboardLayout.jsx` `BRAND_NAV` references `/dashboard/brand/invoices` which has no matching `<Route>` in `App.jsx`. Clicking Invoices in the brand sidebar 404s. | Frontend | 🔴 Live bug | `DashboardLayout.jsx` L33; `App.jsx` has `advertiser/invoices` not `brand/invoices` |
| RISK-S16-4 | No `firestore.indexes.json` confirmed on disk. Two required composite indexes documented in `DATABASE_SCHEMA.md` but not deployed. `firebase.json` also not confirmed — deploy pipeline unknown. | Infra | 🟡 Pre-production | `DATABASE_SCHEMA.md` notes; no index file or firebase.json found |
| RISK-S16-5 | S11-1/2/4 persistence QA carried for a 3rd consecutive sprint. Must be scheduled or explicitly closed per GUARDRAIL-14. | QA | 🔴 Escalation required | `sprint15-retro.md` FM-S15-7 |
| RISK-S16-6 | ENUM-AUDIT-2 (`playlists.status` write path) was resolved in Sprint 13. Closed. | Tech debt | ✅ Closed | `playlists.js` L22 `status = 'draft'` |
| RISK-S16-7 | Real PDF generation (`GET /api/invoices/:id/pdf`) is a post-MVP stub. No production risk. | Feature debt | 🟢 Deferred post-MVP | `invoices.js` ~L152 |
| RISK-S16-8 | Enum migration for `loops` requires strategy decision. Wrong strategy could corrupt live loop approvals. | Backend / Firestore | 🔴 Requires pre-decision | `LoopRepository.js` all write methods |
| RISK-S16-9 | **NEW (Step 3):** `PlaylistRepository.js` `findActiveByScreen()` and `findGlobalPlaylist()` query `status == 'ACTIVE'` (uppercase). This is an ENUM-AUDIT-2 survivor not caught in S13. Write path was fixed; query path was not. Any playlists written with lowercase `'draft'` → `'active'` transition (if it exists) will be invisible to these queries. | Backend / Firestore | 🟡 New finding — schedule S17 | `PlaylistRepository.js` `findActiveByScreen()`, `findGlobalPlaylist()` |

---

## 2. Security Register

| ID | Vector | File(s) | Mitigation | Environment Impact |
|---|---|---|---|---|
| SEC-S16-1 | Firestore query correctness — if enum casing migrates mid-flight, queries filtering on `status == 'pending_approval'` will miss records still stored as `'PENDING_APPROVAL'`. | `LoopRepository.js` `findPendingByRetailer()`, `findApprovedByScreen()` | Dual-write period + backfill before cutover. Backfill script must complete in staging before production deploy. | Dev + Staging before Prod |
| SEC-S16-2 | Brand sidebar nav link 404 exposes unhandled route — degrades auth boundary perception. | `DashboardLayout.jsx` L33 | Correct nav link to `/dashboard/advertiser/invoices`. Existing route, existing page, existing auth guard. | All envs |

---

## 3. Task Map

| Task | Files Touched | Change Type | Estimated Effort | Outcome Probability | Biggest Risk |
|---|---|---|---|---|---|
| S16-0 | Fix `BRAND_NAV` invoices link | `DashboardLayout.jsx` | EDIT (1 line) | 1pt | **99%** | Role-guard behavior around BRAND_NAV not yet read |
| S16-1 | Normalize `LOOP_STATUS` + `SLOT_STATUS` to lowercase | `LoopRepository.js`, `scripts/migrate-loop-status-lowercase.js` (CREATE) | EDIT + CREATE | 3pts | **83%** | Unknown raw string leaks in unread files; firebase-admin availability; no CI emulator confirmed |
| S16-2 | Fix `loops.js` raw string writes | `loops.js` | EDIT | 2pts | **95%** | Must be atomic commit with S16-1 |
| S16-3 | Create `firestore.indexes.json` | `firestore.indexes.json` (CREATE) | CREATE | 2pts | **71%** | `firebase.json` not found; field name casing not cross-checked against `InvoiceRepository.js` |
| S16-4 | Schedule or close S11-1/2/4 persistence QA | `tests/integration_broadcasting.spec.js`, `tests/loop_builder.spec.js` | DECISION + optional edit | 2pts | **88%** | Test file content unread — S11 test IDs not yet confirmed in source |
| S16-5 | Update `DATABASE_SCHEMA.md` | `docs/DATABASE_SCHEMA.md` | EDIT | 1pt | **97%** | Scope expanded: must also document `PlaylistRepository.js` ACTIVE query survivor |

---

## 4. Full Task Details

*(Full task details updated in-place above under § Step 3 — Revised Task Details. This section references those details.)*

See:
- **S16-0** → Step 3 tightened details above
- **S16-1** → Step 3 tightened details above
- **S16-2** → Step 3 tightened details above
- **S16-3** → Step 3 tightened details above
- **S16-4** → Step 3 tightened details above
- **S16-5** → Step 3 tightened details above

---

## 5. Isolation and Blast Radius

| Task | Files | Change Type | Can It Break Anything Else? | Why / Mitigation |
|---|---|---|---|---|
| S16-0 | `DashboardLayout.jsx` | EDIT — 1 string in `BRAND_NAV` | No (unless BRAND_NAV is role-gated separately from ADVERTISER_NAV — verify with pre-check) | Additive correction. React-Router renders the existing page at the corrected path. |
| S16-1 | `LoopRepository.js`, `scripts/migrate-loop-status-lowercase.js` | EDIT constants + CREATE script | **Yes — Firestore queries** | Any caller querying uppercase status values against newly-lowercase-written docs will miss results. Dual-write + backfill before cutover. |
| S16-2 | `loops.js` | EDIT — 1 import + 3 string replacements | **Yes — must be atomic with S16-1** | If S16-1 lands without S16-2, `loops.js` continues writing raw uppercase strings, bypassing the corrected constants. |
| S16-3 | `firestore.indexes.json` | CREATE | No — additive only | New file. No existing code references it. Index deploy is a separate CLI step. |
| S16-4 | `tests/` (read + optional edit) | DECISION / optional skip annotation | No | Test infrastructure only. No runtime impact. |
| S16-5 | `docs/DATABASE_SCHEMA.md` | EDIT — doc only | No | Doc-only. No runtime impact. |

### Isolation Verdict

**S16-0, S16-3, S16-4, S16-5** are fully isolated. They touch no shared runtime infrastructure.

**S16-1 + S16-2** are the only cross-cutting risk and must be treated as a single atomic unit:
- Committed in the same PR.
- Backfill script created before merge to staging.
- No production deploy until Firestore backfill confirmed complete in staging.

### Genuine Cross-Cutting Risks

1. **Enum cutover timing** — `LoopRepository.js` and `loops.js` both read and write `loops.status`. Any window where one is updated without the other creates mixed-case Firestore documents and broken queries. Atomic commit is mandatory.

2. **`findPendingByRetailer()` silent empty set** — After S16-1, any existing Firestore document with `status: 'PENDING_APPROVAL'` (uppercase) will not match the new query for `status == 'pending_approval'` until the backfill script runs. The retailer approval flow will silently return empty results for old records during the dual-write window. This is expected and documented — backfill gates the production deploy.

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
| `current_sprint/sprint16.md` | EDIT | This document |

---

## 7. Test Stabilization Order

1. **Loop approval flow tests** — any test exercising `loopRepository.approveLoop()`, `findPendingByRetailer()`, or `findApprovedByScreen()`. Run after S16-1 + S16-2 land and after backfill script completes in staging.

2. **Approve-all route regression** — `POST /api/locations/:locationId/loops/approve-all`. The `'PENDING'` raw string bug may have caused false passes in existing tests (route returned 200 with 0 approvals). Re-run after S16-2 confirms the query now uses `LOOP_STATUS.PENDING_APPROVAL`.

3. **S11-1 / S11-2 / S11-4 persistence tests** — `tests/integration_broadcasting.spec.js` and `tests/loop_builder.spec.js`. Read both files, identify S11-labelled tests, apply Option A/B/C per S16-4.

4. **Invoice list / pagination tests** — after `firestore.indexes.json` is deployed (S16-3). Any test relying on `invoices` ordered by `generatedAt DESC`.

5. **Frontend smoke — brand sidebar Invoices link** — after S16-0. Navigate as advertiser persona, confirm `/dashboard/advertiser/invoices` loads without 404. Hard-refresh at that URL → page loads.

---

## 8. Definition of Done

- [ ] `grep "brand/invoices" client-app/src/layouts/DashboardLayout.jsx` → exit 1, zero matches.
- [ ] `grep -rn "brand/invoices" client-app/src --include="*.jsx" --include="*.js"` → zero results.
- [ ] Navigating to Invoices as advertiser persona loads `/dashboard/advertiser/invoices` with HTTP 200. Hard-refresh at that URL → page loads.
- [ ] `grep -n "PENDING_APPROVAL.*'PENDING_APPROVAL'" ad-server/src/repositories/LoopRepository.js` → zero results (all values lowercase).
- [ ] `grep -n "SLOT_STATUS" ad-server/src/repositories/LoopRepository.js` → all constant values are lowercase strings.
- [ ] `grep -n "'REJECTED'\|'PENDING'\|'APPROVED'\|'LIVE'" ad-server/src/api/loops.js` → zero results.
- [ ] `grep -n "LOOP_STATUS" ad-server/src/api/loops.js` → import confirmed + minimum 3 usages.
- [ ] S16-1 and S16-2 changes are in the **same commit** — verified by checking the diff contains both `LoopRepository.js` and `loops.js`.
- [ ] `ad-server/scripts/migrate-loop-status-lowercase.js` exists on disk and passes code review for idempotency and batch safety.
- [ ] Backfill script run in staging. `db.collection('loops').where('status', 'in', ['PENDING_APPROVAL','APPROVED','REJECTED','LIVE']).get()` → zero documents after run.
- [ ] `find . -name "firestore.indexes.json" | grep -v node_modules` → returns 1 result with no `{{` placeholder text.
- [ ] `firestore.indexes.json` field names match `InvoiceRepository.js` confirmed field names (Pre-check A run and documented).
- [ ] `§ S16-4 Resolution` section filled in with test file names, chosen option (A/B/C), and reason.
- [ ] `grep "ENUM-AUDIT-2 CLOSED" docs/DATABASE_SCHEMA.md` → "Sprint 13" present.
- [ ] `grep "ENUM-AUDIT-2 SURVIVOR" docs/DATABASE_SCHEMA.md` → "PlaylistRepository.js" present.
- [ ] `grep "ENUM-AUDIT-1" docs/DATABASE_SCHEMA.md` → "Sprint 16" and "migrate-loop-status-lowercase.js" present.
- [ ] Canonical enum values in `DATABASE_SCHEMA.md` for `loops.status` and `loops.slots[].status` are all lowercase.
- [ ] No new `NOT ON DISK` or `NOT CONFIRMED IN SOURCE` items remain unresolved at sprint close.
- [ ] All 14 guardrails remain intact — no new violation introduced by any S16 commit.
- [ ] RISK-S16-9 (`PlaylistRepository.js` ACTIVE query survivor) is either fixed in S16 or formally scheduled for S17 with a documented reason.

---

## § S16-4 Resolution

> **Pending** — to be filled in after `tests/integration_broadcasting.spec.js` and `tests/loop_builder.spec.js` are read and S11 test IDs are confirmed.

```
Test files identified:
  [ ] tests/integration_broadcasting.spec.js (11,254B) — S11 coverage TBD
  [ ] tests/loop_builder.spec.js (7,291B) — S11 coverage TBD

Resolution chosen: [ A | B | C ]
Reason:
  [ to be filled after grep output reviewed ]
```

---

*Sprint 16 spec — Step 3 tightened: 2026-06-08.*
*Grounded against HEAD `a790fd5`. 14 guardrails active.*
*ENUM-AUDIT-2 write path closed (S13). ENUM-AUDIT-2 query survivor found in PlaylistRepository.js (schedule S17).*
*ENUM-AUDIT-1 in-flight. Approve-all route bug (L262 `'PENDING'` mismatch) confirmed and scheduled for S16-2.*
