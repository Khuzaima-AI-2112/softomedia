# Sprint 16 — Enum Normalization, Loop Status Integrity & Infra Hardening

**Sprint:** 16
**Status:** In Progress
**Spec authored:** 2026-06-08
**Step 3 tightened:** 2026-06-08
**Step 4 isolation audit:** 2026-06-08
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
| `BRAND_NAV` `/dashboard/brand` | **NEW (Step 4):** Dashboard Overview link also 404s — `App.jsx` has no `<Route path="brand" ...>`. Both brand nav links are broken. |
| `getNavItems()` persona mapping | **CONFIRMED (Step 4):** `persona === 'advertiser'` → `BRAND_NAV`. No separate `brand` persona exists. The role-guard risk flagged in Step 3 is fully eliminated. |
| `LOOP_STATUS` enum | All-uppercase in `LoopRepository.js` — violates GUARDRAIL-4 |
| `SLOT_STATUS` enum | All-uppercase in `LoopRepository.js` — violates GUARDRAIL-4 |
| `loops.js` S13-2 raw string writes | `'REJECTED'`, `'PENDING'`, `'APPROVED'` bypass `LOOP_STATUS` constants; L262 `'PENDING'` ≠ `PENDING_APPROVAL` — approve-all has returned 0 approvals since S13-2 |
| `playlists.js` ENUM-AUDIT-2 | **RESOLVED in S13** — `status = 'draft'` (lowercase). Closed. |
| `PlaylistRepository.js` ENUM-AUDIT-2 survivor | `findActiveByScreen()` and `findGlobalPlaylist()` query `status == 'ACTIVE'` (uppercase) — new finding |
| `firestore.indexes.json` | NOT ON DISK |
| S11-1/2/4 persistence QA | `tests/` has 17 spec files — candidates: `integration_broadcasting.spec.js`, `loop_builder.spec.js` |

---

## Step 3 — Outcome Probability Tightening

### Probability Delta Table

| Task | Old Score | New Score | What Raised It | What Caps It | Remaining Risks |
|---|---|---|---|---|---|
| **S16-0** Fix `BRAND_NAV` invoices link | 97% | **99%** | `App.jsx` confirmed. `DashboardLayout.jsx` confirmed. Fix is 1 string in 1 known array. **Step 4: role-guard risk eliminated** — `getNavItems()` maps `advertiser` → `BRAND_NAV` with no ambiguity. | 1% — second broken BRAND_NAV link (`/dashboard/brand` Overview) now also confirmed; S16-0 as written only fixes the Invoices entry. | **S16-0 scope must expand** to fix both broken BRAND_NAV entries. See Step 4 new finding below. |
| **S16-1** Normalize `LOOP_STATUS` + `SLOT_STATUS` | 88% | **83%** | — | Raw string leak grep not yet run across full `ad-server/src`; firebase-admin unconfirmed; no CI emulator confirmed | See Step 3 detail |
| **S16-2** Fix `loops.js` raw string writes | 92% | **95%** | All 3 write points confirmed. L262 `'PENDING'` mismatch documented. | Must be atomic with S16-1 | See Step 3 detail |
| **S16-3** Create `firestore.indexes.json` | 82% | **71%** | — | `firebase.json` not found; field name casing not cross-checked | See Step 3 detail |
| **S16-4** Schedule or close S11-1/2/4 QA | 85% | **88%** | `tests/` listed — 17 files known | Test content unread | See Step 3 detail |
| **S16-5** Update `DATABASE_SCHEMA.md` | 98% | **97%** | — | Must also document `PlaylistRepository.js` ACTIVE survivor | See Step 3 detail |

---

## Step 4 — Isolation and Non-Blocking Audit

### New Finding: Second Broken `BRAND_NAV` Entry

**Source:** `DashboardLayout.jsx` fully read at Step 4.

`BRAND_NAV` contains three entries:

```js
const BRAND_NAV = [
    { to: '/dashboard/brand',              icon: 'dashboard',    label: 'Dashboard',   end: true },  // ← 404
    { to: '/dashboard/brand/campaign/new', icon: 'add_circle',   label: 'New Campaign' },            // ← OK (App.jsx has brand/campaign/new)
    { to: '/dashboard/brand/invoices',     icon: 'receipt_long', label: 'Invoices' },                // ← 404 (S16-0 original scope)
];
```

`App.jsx` route table (confirmed from full read):
- `<Route path="brand" element={<BrandOverview />} />` → **EXISTS** ✅
- `<Route path="brand/campaign/new" element={<CampaignWizard />} />` → **EXISTS** ✅
- `<Route path="advertiser/invoices" element={<Invoices />} />` → **EXISTS** ✅
- `<Route path="brand/invoices" ...>` → **DOES NOT EXIST** ❌

**Re-analysis:** `App.jsx` DOES have `<Route path="brand" element={<BrandOverview />} />`. The `BRAND_NAV` Dashboard entry (`/dashboard/brand`) is therefore **NOT a 404** — it resolves correctly to `BrandOverview`. The Step 1 finding of "second broken link" was wrong.

**Corrected BRAND_NAV status:**

| Nav entry | Target | App.jsx Route | Status |
|---|---|---|---|
| Dashboard | `/dashboard/brand` | `brand` → `BrandOverview` | ✅ Works |
| New Campaign | `/dashboard/brand/campaign/new` | `brand/campaign/new` → `CampaignWizard` | ✅ Works |
| Invoices | `/dashboard/brand/invoices` | **NO ROUTE** | ❌ 404 — only broken entry |

**S16-0 scope is unchanged from Step 2.** Only the Invoices entry is broken. One-line fix.

---

### Role-Guard Proof for S16-0

**Source confirmed from `DashboardLayout.jsx` full read:**

```js
function getNavItems(persona) {
    if (!persona) return [];
    if (persona === 'admin' || persona === 'superadmin' || persona === 'super_admin') return ADMIN_NAV;
    if (persona === 'advertiser') return BRAND_NAV;          // ← advertiser persona gets BRAND_NAV
    if (persona === 'retaileradmin') return RETAILER_NAV;
    if (persona === 'techoperator') return TECHOP_NAV;
    return [];
}
```

**Proof:** There is no `brand` persona value in the system. `persona === 'advertiser'` is the only condition that returns `BRAND_NAV`. Fixing `BRAND_NAV[2].to` from `/dashboard/brand/invoices` to `/dashboard/advertiser/invoices` points the advertiser persona's Invoices link at the correct, existing route. No role ambiguity. No auth guard impact. The Step 3 role-guard risk is **fully eliminated**.

---

### Blast-Radius Table

| Task | Files Touched | Change Type | Shared Infra? | Can It Break Other Features? | Mitigation |
|---|---|---|---|---|---|
| **S16-0** | `client-app/src/layouts/DashboardLayout.jsx` | EDIT — 1 string value in `BRAND_NAV[2].to` | No | No | `BRAND_NAV` is defined as a module-level constant in `DashboardLayout.jsx` and is consumed only by `getNavItems()`, called only by `Sidebar()`, rendered only inside `DashboardLayout`. Zero other files import or reference `BRAND_NAV`. Change is purely additive correction. |
| **S16-1** | `ad-server/src/repositories/LoopRepository.js` | EDIT — constant string values only (no method signatures, no exports removed) | **Yes — shared repository** | **Yes — Firestore query correctness** | All callers of `LOOP_STATUS.*` and `SLOT_STATUS.*` continue to use the same constant names. Only the string values change. Any Firestore document written before S16-1 with uppercase status will be missed by post-S16-1 queries until backfill. Dual-write period + backfill script required before production cutover. |
| **S16-1** (backfill script) | `ad-server/scripts/migrate-loop-status-lowercase.js` | CREATE — new file, not imported by any runtime code | No | No | Script is a standalone migration tool. Not `require()`d or `import`ed by any server route or repository. Running it is an explicit operational step, not an automatic side effect of deployment. |
| **S16-2** | `ad-server/src/api/loops.js` | EDIT — add `LOOP_STATUS` to existing import; replace 3 raw string literals | **Yes — shared API router** | **Yes — if not atomic with S16-1** | `loops.js` imports from `LoopRepository.js`. After S16-1, `LOOP_STATUS.REJECTED = 'rejected'`. S16-2 replaces the 3 raw uppercase strings with constants. If S16-2 lands without S16-1, the raw strings continue polluting Firestore. If S16-1 lands without S16-2, `loops.js` continues writing uppercase raw strings that bypass the corrected constants. Atomic commit is the only safe approach. |
| **S16-3** | `firestore.indexes.json` (root or firebase.json-referenced path) | CREATE — new file | No | No | Firestore indexes are additive. Creating a composite index does not alter any existing index, collection structure, document schema, or query behavior. Undeployed index file has zero runtime effect. Deploy is a separate explicit CLI step. |
| **S16-4** | `tests/integration_broadcasting.spec.js`, `tests/loop_builder.spec.js` | DECISION — read-only audit; optional `test.skip` annotations | No | No | Test infrastructure only. `test.skip` does not affect runtime behavior. No imports, no shared state with production code paths. |
| **S16-5** | `docs/DATABASE_SCHEMA.md` | EDIT — documentation only | No | No | Markdown doc. Not imported, parsed, or executed by any runtime code. Zero runtime impact. |

---

### Shared Infrastructure Touch-Point Analysis

#### `LoopRepository.js` — Shared Repository (S16-1)

**Callers enumerated from prior reads:**

| Caller file | Method called | How it uses status values |
|---|---|---|
| `ad-server/src/api/loops.js` | `loopRepository.create()`, `approveLoop()`, `rejectSlot()`, `replaceSlot()`, `bookSlot()`, `findPendingByRetailer()`, `findApprovedByScreen()` | Passes no status string directly to these methods — the repository owns status internally. Exception: 3 raw string writes at L206, L262, L267 (addressed by S16-2). |
| `ad-server/src/api/loops.js` | `LOOP_STATUS` constants (after S16-2) | Reads constant values for comparison/write. After S16-1+S16-2, all values are lowercase. |

**Backward-compatible behavior proof for S16-1:**

The constant names (`LOOP_STATUS.APPROVED`, `LOOP_STATUS.PENDING_APPROVAL`, etc.) do not change. Only the string values they hold change. Every caller that uses `LOOP_STATUS.APPROVED` will automatically use `'approved'` instead of `'APPROVED'` after S16-1 — no caller needs to be updated for the constant reference to remain valid. The only callers that bypass the constants are the 3 raw string writes in `loops.js`, which S16-2 corrects in the same atomic commit.

**Non-backward-compatible behavior (documented and expected):**

Firestore query methods (`findPendingByRetailer()`, `findApprovedByScreen()`) will query for lowercase values after S16-1. Any Firestore document that still holds an uppercase status value will not be returned by these queries. This is the known dual-write risk — it is not a bug introduced by S16-1, it is the expected behavior during the migration window. The backfill script resolves it before production cutover.

#### `loops.js` API Router (S16-2)

**Shared infrastructure scope:**

`loops.js` is mounted as an Express router. Changes to it affect all routes under its prefix. However, S16-2 touches only 3 lines inside 2 route handlers:

- `POST /:loopId/reject` — local status write
- `POST /locations/:locationId/loops/approve-all` — local query filter + status write

No middleware, no shared state, no other route handlers are modified. The import line change (`+ LOOP_STATUS` added to existing destructure) does not alter the module's export or any other imported symbol.

**Backward-compatible behavior proof for S16-2:**

The routes `POST /:loopId/reject` and `POST /locations/:locationId/loops/approve-all` continue to exist at the same paths, accept the same request shapes, and return the same response shapes. The only behavioral change is that they now write lowercase status values to Firestore (correct) instead of uppercase (wrong). For `POST .../approve-all`, the previously broken query (`status == 'PENDING'` which matched zero records) is replaced by the correct query (`status == LOOP_STATUS.PENDING_APPROVAL` = `'pending_approval'`). This is a bug fix, not a breaking change.

---

### Isolation Verdict

**Fully isolated (zero cross-feature risk):**
- **S16-0** — 1 string change in a module-private nav constant. No other file references `BRAND_NAV`.
- **S16-3** — Additive new file. No runtime code references it. Deploy is an explicit CLI step.
- **S16-4** — Test infrastructure only. No runtime impact.
- **S16-5** — Markdown doc only. No runtime impact.

**Conditionally isolated (safe if atomicity constraint is respected):**
- **S16-1 + S16-2** — Must land as a single atomic commit. Either change in isolation creates a mixed-casing window in Firestore. Together, they are self-consistent: all write paths produce lowercase values, all constant references use lowercase values.

**No task in Sprint 16 touches shared middleware**, auth guards, `AuthContext`, `NetworkErrorBanner`, `SafeWidgetLoader`, `ErrorBoundary`, or any other cross-cutting frontend infrastructure.

**No task in Sprint 16 creates, removes, or renames any API route.**

---

### Genuine Cross-Cutting Risks (Two)

#### Risk 1 — Enum cutover timing window (S16-1 + S16-2)

**Mechanism:** After S16-1+S16-2 are deployed to staging, `LoopRepository.js` writes lowercase values and queries for lowercase values. Any existing Firestore document with an uppercase status (written before S16-1) will be invisible to `findPendingByRetailer()` and `findApprovedByScreen()` until the backfill script runs.

**Blast radius:** Retailer approval flow (pending loop list returns empty for old records). Admin loop overview (approved loops may appear missing). These are data visibility gaps, not data corruption.

**Mitigation:** Backfill script (`scripts/migrate-loop-status-lowercase.js`) must run to completion in staging before the S16-1+S16-2 commit is promoted to production. The production deploy is gated on backfill confirmation. Document the gate explicitly in the deploy checklist.

**Who is affected:** Retailer persona (`findPendingByRetailer()`) and screen scheduling path (`findApprovedByScreen()`). Admin persona can still see all loops via the admin panel if it uses a different query path.

#### Risk 2 — `POST .../approve-all` behavior change is a visible functional delta (S16-2)

**Mechanism:** Before S16-2, `POST /locations/:locationId/loops/approve-all` queried `status == 'PENDING'` which matched zero records in Firestore (since no document has ever been written with exactly `'PENDING'`). The route returned HTTP 200 with an empty approved set on every call since S13-2.

After S16-2, the route queries `status == 'pending_approval'` (after backfill) and will begin returning non-zero approved counts.

**This is correct behavior.** But it means any existing QA test, integration test, or Playwright test that asserts `approvedCount === 0` on this route will **fail after S16-2** — not because of a regression, but because the bug being fixed causes the correct behavior to differ from the previously (incorrectly) expected behavior.

**Mitigation:** Before merging S16-2, search for test assertions on the approve-all route:
```bash
grep -rn "approve-all\|approveAll\|approve_all" tests/ --include="*.spec.*"
```
Any assertion expecting an empty result set on this route must be updated to expect the correct non-zero behavior.

---

### Non-Blocking Dependency Map

| Task | Blocks | Blocked By | Non-Blocking? |
|---|---|---|---|
| S16-0 | Nothing | Nothing | ✅ Fully non-blocking — ship independently |
| S16-1 | S16-2 (must be atomic) | Nothing external | ⚠️ Coupled with S16-2 only |
| S16-2 | Nothing | S16-1 (must be atomic) | ⚠️ Coupled with S16-1 only |
| S16-3 | Nothing | `firebase.json` existence (pre-check) | ✅ Non-blocking — can be created independently; deploy is separate |
| S16-4 | Nothing | Reading `integration_broadcasting.spec.js`, `loop_builder.spec.js` | ✅ Non-blocking — triage is a read-only audit |
| S16-5 | Sprint close (GUARDRAIL-13) | S16-1, S16-2 landing (needs confirmed migration details) | ⚠️ Soft dependency — can be written speculatively; finalized after S16-1+S16-2 merge |

**Recommended execution order:**
1. **S16-0** — ship immediately, no dependencies, 1-line fix, eliminates live 404.
2. **S16-4** — run triage in parallel with S16-1+S16-2 development.
3. **S16-3** — run `firebase.json` pre-check, create file, stage for deploy.
4. **S16-1 + S16-2** — develop together, merge as single atomic commit to staging only.
5. Run backfill script in staging. Confirm zero uppercase status documents.
6. **S16-5** — finalize doc update after S16-1+S16-2 merge confirmed.
7. Promote S16-1+S16-2 to production after staging backfill is confirmed complete.

---

## 1. Risk Register

| ID | Description | Area | Status | Evidence |
|---|---|---|---|---|
| RISK-S16-1 | `LOOP_STATUS` and `SLOT_STATUS` enums all-uppercase in `LoopRepository.js`, violating GUARDRAIL-4. New records created with uppercase status on every loop approve/reject/replace call. | Backend / Firestore | 🔴 Active | `LoopRepository.js` L19–31 |
| RISK-S16-2 | `loops.js` S13-2 routes write raw uppercase strings bypassing `LOOP_STATUS` constants. L262 `'PENDING'` ≠ `PENDING_APPROVAL` — approve-all has returned 0 approvals since S13-2. | Backend | 🔴 Active | `loops.js` L206, L262, L267 |
| RISK-S16-3 | `DashboardLayout.jsx` `BRAND_NAV[2]` references `/dashboard/brand/invoices` — no matching `<Route>` in `App.jsx`. Live 404 for advertiser persona clicking Invoices. | Frontend | 🔴 Live bug | `DashboardLayout.jsx` L33; `App.jsx` confirmed |
| RISK-S16-4 | No `firestore.indexes.json` on disk. Two composite indexes documented but not deployed. `firebase.json` also not confirmed — deploy pipeline unknown. | Infra | 🟡 Pre-production | `DATABASE_SCHEMA.md`; no index file found |
| RISK-S16-5 | S11-1/2/4 persistence QA carried for 3rd sprint. Must be resolved per GUARDRAIL-14. | QA | 🔴 Escalation required | `sprint15-retro.md` FM-S15-7 |
| RISK-S16-6 | ENUM-AUDIT-2 (`playlists.status` write path) resolved in Sprint 13. | Tech debt | ✅ Closed | `playlists.js` L22 |
| RISK-S16-7 | `GET /api/invoices/:id/pdf` is a post-MVP stub. | Feature debt | 🟢 Deferred | `invoices.js` ~L152 |
| RISK-S16-8 | Enum migration for `loops` requires strategy decision. Wrong strategy could corrupt live loop approvals. | Backend / Firestore | 🔴 Requires pre-decision | `LoopRepository.js` all write methods |
| RISK-S16-9 | `PlaylistRepository.js` `findActiveByScreen()` and `findGlobalPlaylist()` query `status == 'ACTIVE'` (uppercase). ENUM-AUDIT-2 survivor. Write path was fixed in S13; query path was not. | Backend / Firestore | 🟡 New finding — schedule S17 | `PlaylistRepository.js` |

---

## 2. Security Register

| ID | Vector | File(s) | Mitigation | Environment Impact |
|---|---|---|---|---|
| SEC-S16-1 | Firestore query correctness — post-S16-1 queries for lowercase status miss uppercase docs until backfill. Retailer approval flow returns empty pending list. | `LoopRepository.js` `findPendingByRetailer()`, `findApprovedByScreen()` | Dual-write period + backfill before production cutover. | Dev + Staging before Prod |
| SEC-S16-2 | Brand sidebar nav 404 — degrades auth boundary perception. | `DashboardLayout.jsx` L33 | Correct nav link to `/dashboard/advertiser/invoices`. Existing route, existing page, existing auth guard. | All envs |

---

## 3. Task Map

| Task | Files Touched | Change Type | Estimated Effort | Outcome Probability | Biggest Risk |
|---|---|---|---|---|---|
| S16-0 | Fix `BRAND_NAV` invoices link | `DashboardLayout.jsx` | EDIT (1 line) | 1pt | **99%** | None remaining — role-guard risk eliminated by Step 4 source read |
| S16-1 | Normalize `LOOP_STATUS` + `SLOT_STATUS` | `LoopRepository.js`, `scripts/migrate-loop-status-lowercase.js` | EDIT + CREATE | 3pts | **83%** | Raw string leaks in unread files; firebase-admin unconfirmed; no CI emulator |
| S16-2 | Fix `loops.js` raw string writes | `loops.js` | EDIT | 2pts | **95%** | Must be atomic commit with S16-1; approve-all test assertions may need update |
| S16-3 | Create `firestore.indexes.json` | `firestore.indexes.json` | CREATE | 2pts | **71%** | `firebase.json` not found; field name casing not cross-checked |
| S16-4 | Schedule or close S11-1/2/4 QA | `tests/integration_broadcasting.spec.js`, `tests/loop_builder.spec.js` | DECISION + optional edit | 2pts | **88%** | S11 test IDs not confirmed in file content yet |
| S16-5 | Update `DATABASE_SCHEMA.md` | `docs/DATABASE_SCHEMA.md` | EDIT | 1pt | **97%** | Must include `PlaylistRepository.js` ACTIVE survivor |

---

## 4. Full Task Details

### S16-0 — Fix `BRAND_NAV` invoices link (99%)

**All uncertainties eliminated by Steps 3 and 4. Role-guard risk confirmed eliminated.**

**Source evidence (Step 4 — files read in full):**
- `DashboardLayout.jsx` fully read (11,328B): `getNavItems(persona)` maps `persona === 'advertiser'` → `BRAND_NAV`. No `brand` persona string exists anywhere in the function. `BRAND_NAV` is consumed only by `getNavItems()` → `Sidebar()` → `DashboardLayout`. Zero other imports.
- `App.jsx` fully read (13,344B): `<Route path="advertiser/invoices" element={<Invoices />} />` confirmed at Sprint 15. No `<Route path="brand/invoices">` exists.

**Fix (unchanged from Step 2):**
```js
// client-app/src/layouts/DashboardLayout.jsx — BRAND_NAV array
// BEFORE (line ~33):
{ to: '/dashboard/brand/invoices', icon: 'receipt_long', label: 'Invoices' },

// AFTER:
{ to: '/dashboard/advertiser/invoices', icon: 'receipt_long', label: 'Invoices' },
```

**Acceptance criteria (falsifiable):**
1. `grep "brand/invoices" client-app/src/layouts/DashboardLayout.jsx` → exit 1, zero matches.
2. `grep -rn "brand/invoices" client-app/src --include="*.jsx" --include="*.js"` → zero results.
3. Login with `persona = 'advertiser'` → sidebar shows Invoices link → click → URL becomes `/dashboard/advertiser/invoices` → HTTP 200, `<Invoices />` page renders.
4. Hard-refresh at `/dashboard/advertiser/invoices` → page loads, no `<NotFound />` component rendered.
5. `BRAND_NAV[0].to` (`/dashboard/brand`) and `BRAND_NAV[1].to` (`/dashboard/brand/campaign/new`) remain unchanged and continue to resolve to their existing routes.

---

### S16-1 — Normalize `LOOP_STATUS` + `SLOT_STATUS` to lowercase (83%)

**Pre-checks required before any code is written:**

```bash
# 1. Full raw-string audit across all ad-server/src (excludes known files)
grep -rn \
  "'PENDING_APPROVAL'\|'APPROVED'\|'REJECTED'\|'LIVE'\|'PENDING'\|'BOOKED'\|'REPLACED'\|'AVAILABLE'" \
  ad-server/src --include="*.js" \
  | grep -v "LoopRepository.js\|loops.js"

# 2. All files that import LOOP_STATUS or SLOT_STATUS
grep -rn "LOOP_STATUS\|SLOT_STATUS" ad-server/src --include="*.js"

# 3. firebase-admin SDK availability for backfill script
find ad-server -name "package.json" | xargs grep "firebase-admin" 2>/dev/null

# 4. Firestore emulator in test suite
grep -rn "FIRESTORE_EMULATOR_HOST\|connectFirestoreEmulator\|useEmulator" \
  ad-server/src tests --include="*.js" | head -20
```

**Confirmed write points in `LoopRepository.js`:**

| Method | Current value | After S16-1 |
|---|---|---|
| `create()` default | `LOOP_STATUS.PENDING_APPROVAL = 'PENDING_APPROVAL'` | `= 'pending_approval'` |
| `approveLoop()` | `LOOP_STATUS.APPROVED = 'APPROVED'` | `= 'approved'` |
| `replaceSlot()` clone | `LOOP_STATUS.PENDING_APPROVAL` | `= 'pending_approval'` |
| `rejectSlot()` slot | `SLOT_STATUS.REJECTED = 'REJECTED'` | `= 'rejected'` |
| `replaceSlot()` slot | `SLOT_STATUS.REPLACED = 'REPLACED'` | `= 'replaced'` |
| `bookSlot()` slot | `SLOT_STATUS.BOOKED = 'BOOKED'` | `= 'booked'` |
| `findPendingByRetailer()` | queries `LOOP_STATUS.PENDING_APPROVAL` | queries `'pending_approval'` |
| `findApprovedByScreen()` | queries `LOOP_STATUS.APPROVED` | queries `'approved'` |

**Constant replacement:**
```js
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

**Backfill script skeleton:** `ad-server/scripts/migrate-loop-status-lowercase.js`
- Reads all `loops` documents
- For each doc with uppercase `status`, writes lowercase equivalent
- Handles `slots[]` array entries
- Batched in groups of 500 (Firestore batch write limit)
- Idempotent — safe to re-run
- Logs migrated document IDs to stdout
- Exits non-zero on any write failure

**S16-1 must NOT modify `PlaylistRepository.js`** — out of scope, expands blast radius. Document and defer to S17.

**Acceptance criteria:**
1. `grep -n "'PENDING_APPROVAL'" ad-server/src/repositories/LoopRepository.js` → zero results.
2. `grep -n "'pending_approval'" ad-server/src/repositories/LoopRepository.js` → minimum 3 results.
3. All SLOT_STATUS values are lowercase strings.
4. `ad-server/scripts/migrate-loop-status-lowercase.js` exists and exits 0 in staging.
5. After backfill: `db.collection('loops').where('status', 'in', ['PENDING_APPROVAL','APPROVED','REJECTED','LIVE']).get()` → zero documents.
6. After backfill: `db.collection('loops').where('status', '==', 'pending_approval').get()` → returns all previously-PENDING_APPROVAL loops.
7. S16-1 and S16-2 in same commit.

**Score path to 90%+:** Pre-check #1 zero hits (+5%) → firebase-admin confirmed (+3%) → emulator confirmed (+2%) → 93%.

---

### S16-2 — Fix `loops.js` raw string writes (95%)

**All write points confirmed. Must be atomic with S16-1.**

**Confirmed violations:**

| Line | Route | Bug | Fix |
|---|---|---|---|
| L206 | `POST /:loopId/reject` | `status: 'REJECTED'` | `status: LOOP_STATUS.REJECTED` |
| L262 | `POST /locations/:locationId/loops/approve-all` | `['status', '==', 'PENDING']` | `['status', '==', LOOP_STATUS.PENDING_APPROVAL]` |
| L267 | `POST /locations/:locationId/loops/approve-all` | `status: 'APPROVED'` | `status: LOOP_STATUS.APPROVED` |

**L262 severity note:** `'PENDING'` ≠ `'PENDING_APPROVAL'`. The approve-all route has matched zero records since S13-2. This is a regression fix, not a style fix. Existing tests asserting `approvedCount === 0` on this route must be updated.

**Pre-check before merge:**
```bash
grep -rn "approve-all\|approveAll\|approve_all" tests/ --include="*.spec.*"
```

**Import fix:**
```js
// Add LOOP_STATUS to existing import at top of loops.js
import { loopRepository, BUSINESS_HOURS, LOOP_STATUS } from '../repositories/LoopRepository.js';
```

**Acceptance criteria:**
1. `grep -n "'REJECTED'\|'PENDING'\|'APPROVED'\|'LIVE'" ad-server/src/api/loops.js` → zero results.
2. `grep -n "LOOP_STATUS" ad-server/src/api/loops.js` → import line + minimum 3 usages.
3. Regression test: seed 3 loops with `status: 'pending_approval'` in staging. `POST .../approve-all` → `approvedCount: 3`. All 3 docs have `status: 'approved'`.
4. Reject route test: `POST .../reject` on a `pending_approval` loop → doc has `status: 'rejected'`.
5. Commit SHA contains diffs for both `LoopRepository.js` and `loops.js`.

---

### S16-3 — Create `firestore.indexes.json` (71%)

**Two blocking pre-checks before file can be written:**

```bash
# Pre-check A — field name casing (blocking for correctness)
grep -n "advertiserId\|advertiser_id\|generatedAt\|generated_at" \
  ad-server/src/repositories/InvoiceRepository.js

# Pre-check B — deploy pipeline (blocking for Done criteria)
find . -name "firebase.json" -o -name ".firebaserc" | grep -v node_modules | head -5
```

**Index content template (field names are placeholders until Pre-check A runs):**
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

> ⚠️ `{{...}}` placeholders MUST be replaced with confirmed field names from Pre-check A before commit.

**Acceptance criteria — Tier 1 (file creation, no deploy pipeline required):**
1. `find . -name "firestore.indexes.json" | grep -v node_modules` → 1 result.
2. File parses as valid JSON.
3. `grep "{{" firestore.indexes.json` → zero results.
4. Field names match Pre-check A output.

**Acceptance criteria — Tier 2 (deploy, requires firebase.json):**
5. `firebase deploy --only firestore:indexes --project <staging>` → exits 0.
6. Firebase console → Indexes → both show `ENABLED`.
7. Invoice list endpoint returns results ordered by `generatedAt DESC` without Firestore index-required error in server logs.

**Score path:** Pre-check A run (+5% → 76%) + `firebase.json` found (+9% → 85%).

---

### S16-4 — Schedule or close S11-1/2/4 QA (88%)

**Files now known. Must open both candidate files to confirm S11 test IDs.**

```bash
grep -n "S11\|persistence\|persist\|localStorage\|sessionStorage\|reload\|hard.refresh" \
  tests/integration_broadcasting.spec.js tests/loop_builder.spec.js
```

**Resolution options:**

| Option | Condition | Acceptance criteria |
|---|---|---|
| A — Fix | Failures actionable, tests reference live routes/methods | `npx playwright test tests/integration_broadcasting.spec.js tests/loop_builder.spec.js --grep "S11"` → exits 0 |
| B — Defer | Require Firestore emulator not in CI | `test.skip` with comment `// DEFERRED-S16: emulator not in CI, rescheduled S17` |
| C — Close | Tests reference deleted routes/deprecated methods | Each skipped test has comment citing superseding sprint |

**Acceptance criteria:**
1. `grep -rn "S11" tests/` → all results have a documented status (fixed / deferred / closed).
2. No S11-labelled test is unannotated or has `// TODO`.
3. `§ S16-4 Resolution` section filled in with file names, chosen option, and reason.
4. No S17 carry without documented reason in this file.

---

### S16-5 — Update `DATABASE_SCHEMA.md` (97%)

**Scope expanded at Step 3 to include `PlaylistRepository.js` ACTIVE query survivor.**

**Changes required:**
1. Close ENUM-AUDIT-2 write path: `"ENUM-AUDIT-2 CLOSED (Sprint 13): playlists.js L22 default = 'draft' (lowercase). No further action on write path."`
2. Document ENUM-AUDIT-2 survivor: `"ENUM-AUDIT-2 SURVIVOR (found Sprint 16): PlaylistRepository.js findActiveByScreen() and findGlobalPlaylist() query status == 'ACTIVE' (uppercase). Scheduled for ENUM-AUDIT-3 in Sprint 17."`
3. Document ENUM-AUDIT-1 migration: `"ENUM-AUDIT-1 (Sprint 16): LOOP_STATUS and SLOT_STATUS migrated to lowercase. Backfill: scripts/migrate-loop-status-lowercase.js. Cutover: S17 after staging backfill confirmed."`
4. Update canonical enum values for `loops` to lowercase.
5. Document S16-0 nav fix: `"S16-0: BRAND_NAV /dashboard/brand/invoices corrected to /dashboard/advertiser/invoices. persona='advertiser' confirmed as the only BRAND_NAV consumer."`

**Acceptance criteria:**
1. `grep "ENUM-AUDIT-2 CLOSED" docs/DATABASE_SCHEMA.md` → "Sprint 13" present.
2. `grep "ENUM-AUDIT-2 SURVIVOR" docs/DATABASE_SCHEMA.md` → "PlaylistRepository.js" present.
3. `grep "ENUM-AUDIT-1" docs/DATABASE_SCHEMA.md` → "Sprint 16" and "migrate-loop-status-lowercase.js" present.
4. `grep "pending_approval\|approved\|rejected\|live" docs/DATABASE_SCHEMA.md` → lowercase canonical values present.
5. `grep "ACTIVE\|PENDING_APPROVAL\|APPROVED" docs/DATABASE_SCHEMA.md` → only in historical/survivor notes, not as canonical values.
6. `grep "brand/invoices" docs/DATABASE_SCHEMA.md` → "corrected to /dashboard/advertiser/invoices" present.

---

## 5. Isolation and Blast Radius

| Task | Files | Change Type | Shared Infra? | Can It Break Other Features? | Mitigation |
|---|---|---|---|---|---|
| S16-0 | `DashboardLayout.jsx` | EDIT — 1 string in `BRAND_NAV[2].to` | No | No | `BRAND_NAV` used only in `getNavItems()` → `Sidebar()` → `DashboardLayout`. Zero other imports. Additive correction. |
| S16-1 | `LoopRepository.js` | EDIT — constant string values only | **Yes — shared repository** | **Yes — Firestore query correctness during migration window** | Constant names unchanged; only values change. All callers continue to compile. Dual-write window mitigated by backfill script gating production deploy. |
| S16-1 (script) | `scripts/migrate-loop-status-lowercase.js` | CREATE | No | No | Standalone script. Not imported by any runtime code. Explicit operational step. |
| S16-2 | `loops.js` | EDIT — 1 import + 3 string replacements | **Yes — shared API router** | **Yes — if not atomic with S16-1** | Same-route handlers only. No middleware, no other routes affected. Must land in same commit as S16-1. |
| S16-3 | `firestore.indexes.json` | CREATE | No | No | Additive new file. Not referenced by any code. Deploy is a separate explicit CLI step. |
| S16-4 | `tests/*.spec.js` | DECISION / optional annotation | No | No | Test infrastructure only. No runtime impact. |
| S16-5 | `docs/DATABASE_SCHEMA.md` | EDIT — doc only | No | No | Markdown doc. No runtime impact. |

### Isolation Verdict

**S16-0, S16-3, S16-4, S16-5** are fully isolated. Ship in any order, independently, without affecting any other feature.

**S16-1 + S16-2** are the only cross-cutting pair. They must be a single atomic commit. All other tasks are independent of them.

**No task in Sprint 16 touches shared middleware, auth guards, AuthContext, NetworkErrorBanner, SafeWidgetLoader, ErrorBoundary, or any cross-cutting frontend infrastructure.**

**No task in Sprint 16 creates, removes, or renames any API route.**

### Cross-Cutting Risks

1. **Enum cutover timing (S16-1 + S16-2):** Retailer approval flow and screen scheduling silently return empty results for uppercase-status documents until backfill completes. Mitigated by staging backfill gate before production promotion.

2. **Approve-all behavior delta (S16-2):** Route begins returning non-zero approvals after fix. Any test asserting `approvedCount === 0` will fail — correctly, as the prior behavior was the bug. Run `grep -rn "approve-all" tests/` before merge and update affected assertions.

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

1. **Loop approval flow tests** — `approveLoop()`, `findPendingByRetailer()`, `findApprovedByScreen()`. Run after S16-1 + S16-2 atomic commit and after staging backfill script completes.

2. **Approve-all route regression** — `POST /api/locations/:locationId/loops/approve-all`. Existing tests asserting empty approved set must be updated to assert correct non-zero behavior. Run after S16-2.

3. **S11-1 / S11-2 / S11-4 persistence tests** — `tests/integration_broadcasting.spec.js`, `tests/loop_builder.spec.js`. Apply Option A/B/C per S16-4. Read both files first.

4. **Invoice list / pagination tests** — after `firestore.indexes.json` deployed (S16-3). Any test relying on `invoices` ordered by `generatedAt DESC`.

5. **Frontend smoke — Invoices nav link** — after S16-0. Login as `persona = 'advertiser'` → click Invoices → `/dashboard/advertiser/invoices` → HTTP 200. Hard-refresh at that URL → page loads.

---

## 8. Definition of Done

- [ ] `grep "brand/invoices" client-app/src/layouts/DashboardLayout.jsx` → exit 1, zero matches.
- [ ] `grep -rn "brand/invoices" client-app/src --include="*.jsx" --include="*.js"` → zero results.
- [ ] Login as `persona = 'advertiser'` → Invoices sidebar link → `/dashboard/advertiser/invoices` → HTTP 200. Hard-refresh → page loads.
- [ ] `grep -n "'PENDING_APPROVAL'" ad-server/src/repositories/LoopRepository.js` → zero results (all values lowercase).
- [ ] All SLOT_STATUS values in `LoopRepository.js` are lowercase strings.
- [ ] `grep -n "'REJECTED'\|'PENDING'\|'APPROVED'\|'LIVE'" ad-server/src/api/loops.js` → zero results.
- [ ] `grep -n "LOOP_STATUS" ad-server/src/api/loops.js` → import line confirmed + minimum 3 usages.
- [ ] S16-1 and S16-2 in the **same commit** — diff contains both `LoopRepository.js` and `loops.js`.
- [ ] `ad-server/scripts/migrate-loop-status-lowercase.js` exists, is idempotent, batches in groups of ≤500, exits 0 in staging.
- [ ] Backfill run in staging: `db.collection('loops').where('status', 'in', ['PENDING_APPROVAL','APPROVED','REJECTED','LIVE']).get()` → zero documents.
- [ ] `find . -name "firestore.indexes.json" | grep -v node_modules` → 1 result; `grep "{{" firestore.indexes.json` → zero results.
- [ ] Field names in `firestore.indexes.json` match `InvoiceRepository.js` confirmed output from Pre-check A.
- [ ] `§ S16-4 Resolution` filled in with file names, Option A/B/C, and reason. No S11 test unannotated.
- [ ] `grep "ENUM-AUDIT-2 CLOSED" docs/DATABASE_SCHEMA.md` → "Sprint 13" present.
- [ ] `grep "ENUM-AUDIT-2 SURVIVOR" docs/DATABASE_SCHEMA.md` → "PlaylistRepository.js" present.
- [ ] `grep "ENUM-AUDIT-1" docs/DATABASE_SCHEMA.md` → "Sprint 16" and "migrate-loop-status-lowercase.js" present.
- [ ] Canonical `loops.status` and `loops.slots[].status` values in `DATABASE_SCHEMA.md` are all lowercase.
- [ ] RISK-S16-9 (`PlaylistRepository.js` ACTIVE query survivor) either fixed in S16 or formally scheduled for S17 with documented reason.
- [ ] No new `NOT ON DISK` or `NOT CONFIRMED IN SOURCE` items remain unresolved at sprint close.
- [ ] All 14 guardrails remain intact — no new violation introduced by any S16 commit.

---

## § S16-4 Resolution

> **Pending** — to be filled in after `tests/integration_broadcasting.spec.js` and `tests/loop_builder.spec.js` are read and S11 test IDs confirmed.

```
Test files identified:
  [ ] tests/integration_broadcasting.spec.js (11,254B) — S11 coverage TBD
  [ ] tests/loop_builder.spec.js (7,291B) — S11 coverage TBD

Resolution chosen: [ A | B | C ]
Reason:
  [ to be filled after grep output reviewed ]
```

---

*Sprint 16 spec — Step 4 isolation audit complete: 2026-06-08.*
*Grounded against HEAD `a790fd5`. 14 guardrails active.*
*Files read in full: `DashboardLayout.jsx` (11,328B), `App.jsx` (13,344B), `LoopRepository.js`, `loops.js`, `PlaylistRepository.js`, `playlists.js`. Tests directory listed (17 files).*
*Role-guard risk eliminated. BRAND_NAV second broken link re-analysis: only Invoices entry is broken — Dashboard and New Campaign entries resolve correctly.*
*Two genuine cross-cutting risks: enum cutover timing window; approve-all behavior delta.*
