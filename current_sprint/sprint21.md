# Sprint 21 — Retailer & Advertiser Integrity, Soft-Delete Correctness, and Campaign Flow Stabilization

**Sprint:** 21
**Status:** Planned
**Spec authored:** 2026-06-16
**Grounded against:** HEAD [`3246fd8`](https://github.com/cfroszte/softomedia-live2026/commit/3246fd81de9b1008029dbeade080e50a55daedf3)
**Guardrails active:** 15 (GUARDRAIL-1 through GUARDRAIL-15)
**Carry-forward sources:** `current_sprint/sprint17.md` (S17-1 through S17-7), `current_sprint/sprint-20-plan.md` (Workstreams 1–5), S16 RISK-S16-9

---

## Active Guardrails

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
- **GUARDRAIL-15** — Soft-delete semantics: any soft-delete must write a `deleted_at` marker. List and detail endpoints must filter on `deleted_at`. Status field alone is not a deletion signal.

---

## Step 1 — Findings Summary (Source-Verified)

> All findings below are grounded against actual file reads at HEAD `3246fd8`.

| Finding | File | Detail | Status |
|---|---|---|---|
| `RetailerRepository.softDelete()` | `RetailerRepository.js` | ✅ Writes `status: 'inactive'`, `deleted_at`, `updated_at` via `set({merge:true})`. Separate `updateStatus()` method does NOT write `deleted_at` — deactivate vs delete are cleanly separated. | **DONE — no action needed** |
| `AdvertiserRepository.softDelete()` | `AdvertiserRepository.js` | ✅ Writes `status: 'suspended'`, `deleted_at`, `updated_at`. Has structured logger on failure path. MOCK_STORAGE kept in sync via `this.update()`. | **DONE — no action needed** |
| `GET /api/retailers` | `retailers.js` L17 | ✅ `findAll({ where: [['deleted_at', '==', null]] })`. Soft-deleted records excluded. Inactive-but-not-deleted records still returned (correct). | **DONE — no action needed** |
| `GET /api/retailers/:id` | `retailers.js` L30 | ✅ Guards on `retailer.deleted_at` — returns 404 if set. | **DONE — no action needed** |
| `GET /api/advertisers` | `advertisers.js` L17 | ✅ `findAll({ where: [['deleted_at', '==', null]] })`. | **DONE — no action needed** |
| `GET /api/advertisers/:id` | `advertisers.js` L30 | ✅ Guards on `advertiser.deleted_at` — returns 404 if set. | **DONE — no action needed** |
| `DELETE /api/retailers/:id` | `retailers.js` L128 | ✅ Calls `retailerRepository.softDelete()`. Role guard: `requireRole('admin')`. Not `requireRole('superadmin')` — see RISK-S21-1. | **FLAG — role mismatch vs S20 spec** |
| `DELETE /api/advertisers/:id` | `advertisers.js` L150 | ✅ Calls `advertiserRepository.softDelete()`. Role guard: `requireRole('admin')`. Same flag as above. | **FLAG — role mismatch vs S20 spec** |
| `POST /api/retailers` | `retailers.js` L44 | ✅ `requireRole('admin')`. Validates name, contact_email, contract_start. Defaults `status: 'active'`. | **DONE — no action needed** |
| `POST /api/advertisers` | `advertisers.js` L52 | ✅ `requireRole('admin')`. Validates name, logo, industry, contactemail, budget. Defaults `status: 'active'`. | **DONE — no action needed** |
| `BaseRepository.findAll()` memory comparator | `BaseRepository.js` L74 | ✅ Uses `(item[field] ?? null) === value` for `==` ops. S17-3 fix is already in place. | **DONE — no action needed** |
| `PlaylistRepository.findActiveByScreen()` | `PlaylistRepository.js` L18 | ✅ Queries `status == 'active'` (lowercase). S17-6 fix is in place. | **DONE — no action needed** |
| `PlaylistRepository.findGlobalPlaylist()` | `PlaylistRepository.js` L34 | ✅ Queries `status == 'active'` (lowercase). S17-6 fix is in place. | **DONE — no action needed** |
| Backfill scripts | `ad-server/scripts/` | ❓ Not confirmed on disk. `backfill-deleted-retailers.js`, `backfill-deleted-advertisers.js`, `backfill-playlist-status.js` must be verified or created. Pre-existing ghost records may exist if entities were soft-deleted before S17-1/S17-2 writes were deployed. | **OPEN — verify scripts exist** |
| `POST /api/campaigns` | `campaigns.js` L96 | ✅ `requireRole('advertiser')` (hierarchical — allows advertiser + higher roles). Stamps `advertiser_id` from JWT. Defaults `status: 'pending_approval'`. | **DONE** |
| Campaign scheduler retailer source | `campaigns.js` / `retailers.js` | ❓ No dedicated `GET /api/retailers?for=campaign` or equivalent scheduler-scoped endpoint. The generic `GET /api/retailers` (which correctly filters `deleted_at == null`) is the only source. No `status: 'active'` filter applied for the scheduler. Deleted retailers are excluded, but INACTIVE-but-not-deleted retailers are still included in scheduler list. | **OPEN — S21-7 required** |
| Campaign wizard confirm step | `campaigns.js` L96 | ⚠️ `POST /api/campaigns` exists and is correctly guarded. Date binding and frontend validation state unknown — requires `CampaignWizard.jsx` read. | **OPEN — S21-8 frontend read required** |
| `PATCH /api/retailers/:id` | `retailers.js` L144 | ✅ Calls `retailerRepository.updateStatus()`, validates `['active', 'inactive']`. Does NOT set `deleted_at`. Clean separation confirmed. | **DONE** |
| `PATCH /api/advertisers/:id` | `advertisers.js` L118 | ⚠️ Calls generic `advertiserRepository.update()` — allows arbitrary field overwrite including `deleted_at` and `status`. No allowlist on patch fields. | **FLAG — RISK-S21-2** |
| Role: admin vs superadmin on mutation routes | `retailers.js`, `advertisers.js` | S20 spec requires `requireRole('superadmin')` on all retailer/advertiser mutations. Current code uses `requireRole('admin')`. This is either a spec drift or an intentional decision. Must be resolved before S21 closes. | **FLAG — RISK-S21-1** |
| Seed script for Test Retailer A | `ad-server/scripts/` | ❓ Not confirmed. QA smoke flows require a canonical test fixture. | **OPEN — S21-9** |

---

## Root Cause Summary

The ghost-reappearance bug (S17) is **already fixed in the codebase** at HEAD. `RetailerRepository`, `AdvertiserRepository`, `BaseRepository`, both API list routes, both API detail routes, and both `PlaylistRepository` query methods are correct. The fixes from S17-1 through S17-6 are already deployed in source.

This means **Sprint 21's remaining scope is not re-implementing S17** — it is:

1. **Confirming backfill scripts exist and are runnable** — pre-existing ghost records in Firestore are not resolved by code fixes alone.
2. **Tightening the scheduler retailer list** — the campaign wizard's retailer source currently includes inactive-but-not-deleted retailers. S20 requires only `status='active'` retailers with stores/screens to appear for scheduling.
3. **Investigating the campaign wizard frontend** — `POST /api/campaigns` backend is correct; wizard confirm step issues are unconfirmed in frontend source.
4. **Resolving the admin vs superadmin role question** on mutation endpoints.
5. **Guarding `PATCH /api/advertisers/:id`** against arbitrary `deleted_at` overwrites.
6. **Seeding Test Retailer A** for QA smoke flows.

---

## Step 3 — Outcome Probability Table

| Task | Description | Source | Score | What Raises It | What Caps It | Remaining Risk |
|---|---|---|---|---|---|---|
| **S21-1** | Verify/create backfill scripts for pre-existing soft-deleted retailers, advertisers, playlists | S17-5, S17-6 | 85% | Script pattern confirmed from S16 precedent | Pre-existing data unknown; conservative vs aggressive strategy decision required | Must not false-positive on intentionally-inactive records |
| **S21-2** | Guard `PATCH /api/advertisers/:id` against `deleted_at` overwrite | New finding | 97% | Route confirmed, fix is a field allowlist addition | 3% — must confirm no downstream caller sends `deleted_at` via PATCH | Additive guard only |
| **S21-3** | Resolve admin vs superadmin role on mutation routes | RISK-S21-1 | 90% | Both routes confirmed; `requireRole` pattern confirmed from S11 | Changing role breaks any admin-level caller currently relying on `requireRole('admin')` — requires caller audit | Must enumerate all admin callers before changing |
| **S21-4** | Add `status='active'` filter to scheduler retailer source | S20 Workstream 3, S21-7 | 91% | `findAll()` `options.where` confirmed working; `deleted_at` filter already in place | Adding second `where` clause is additive; Firestore compound query may require composite index | Pre-check: does `retailers` collection need a composite index for `deleted_at == null AND status == 'active'`? |
| **S21-5** | Read `CampaignWizard.jsx` and stabilize confirm step | S20 Workstream 4 | 88% | `POST /api/campaigns` backend confirmed correct | Frontend source unread — date binding and validation state unknown | Requires full read before scoring improves |
| **S21-6** | Seed Test Retailer A + observability logs + E2E tests | S20 Workstream 5 | 92% | Seed script pattern confirmed from S16 backfill precedent; logger already used in `AdvertiserRepository.js` | Test runner and E2E framework not confirmed; campaign wizard E2E depends on S21-5 | QA environment access required for seed run |
| **S21-7** | Update `DATABASE_SCHEMA.md` to document current state | S17-7, S20 | 98% | Doc-only; all findings now source-confirmed | Must accurately reflect the DONE items to avoid re-litigating in S22 | Blocking for sprint close (GUARDRAIL-8, GUARDRAIL-13) |

---

## Step 4 — Isolation and Blast-Radius Audit

### Blast-Radius Table

| Task | Files Touched | Change Type | Shared Infra? | Can It Break Other Features? | Mitigation |
|---|---|---|---|---|---|
| **S21-1** | `ad-server/scripts/backfill-deleted-*.js` | CREATE — standalone scripts | No | No | Not imported by runtime code. Explicit operational step. |
| **S21-2** | `ad-server/src/api/advertisers.js` PATCH handler | EDIT — add field allowlist to PATCH | Yes — shared router | Low — only restricts `deleted_at` overwrite via PATCH | Callers sending `deleted_at` via PATCH would be misusing the API. Audit first with grep. |
| **S21-3** | `ad-server/src/api/retailers.js`, `advertisers.js` mutation routes | EDIT — `requireRole('admin')` → `requireRole('superadmin')` IF decision is to tighten | Yes — auth middleware | **Yes — breaks admin-role callers** | Pre-check: `grep -rn "api/retailers\|api/advertisers" client-app/src --include="*.js" --include="*.jsx"` to enumerate all callers. Do NOT change without audit. |
| **S21-4** | `ad-server/src/api/retailers.js` GET / | EDIT — add `status == 'active'` to scheduler where clause | Yes — shared API router | **Yes — changes retailer list returned to scheduler** | Distinct scheduler endpoint (`?for=campaign`) preferred to avoid changing the admin management list. If same endpoint, admin UI must be unaffected. |
| **S21-5** | `client-app/src/pages/CampaignWizard.jsx` (path TBC) | EDIT — frontend | Yes — campaign flow | Medium — wizard confirm step; regression risk | Read full file before writing. Confirm `POST /api/campaigns` payload shape matches backend expectation. |
| **S21-6** | `ad-server/scripts/seed-test-retailer.js`, test files, logger additions | CREATE + EDIT | No | No | Seeds are idempotent. Logger additions are additive. |
| **S21-7** | `docs/DATABASE_SCHEMA.md` | EDIT — doc only | No | No | Must be done before sprint close (GUARDRAIL-8, GUARDRAIL-13). |

### Pre-Checks Required Before Any Code Is Written

```bash
# S21-1: Confirm backfill scripts on disk
find ad-server/scripts -name "backfill-*" 2>/dev/null

# S21-2: Confirm no caller sends deleted_at via PATCH /api/advertisers
grep -rn "deleted_at" client-app/src --include="*.js" --include="*.jsx"

# S21-3: Enumerate all admin-role callers of retailer/advertiser mutation routes
grep -rn "deleteRetailer\|deleteAdvertiser\|updateRetailer\|updateAdvertiser\|createRetailer\|createAdvertiser" \
  client-app/src --include="*.js" --include="*.jsx"

# S21-4: Check if compound index exists for retailers: deleted_at + status
cat firestore.indexes.json 2>/dev/null || echo "NOT ON DISK"

# S21-5: Find CampaignWizard component
find client-app/src -name "CampaignWizard*" -o -name "campaign-wizard*" 2>/dev/null
```

### Isolation Verdict

**Fully isolated (zero cross-feature risk):**
- **S21-1** — Standalone scripts. No runtime impact.
- **S21-6** — Seed + logs + tests. Additive only.
- **S21-7** — Markdown doc. No runtime impact.

**Conditionally isolated (safe with pre-check respected):**
- **S21-2** — Additive PATCH guard. Safe after confirming no caller sends `deleted_at` in PATCH body.
- **S21-4** — Additive `where` clause. Preferred implementation: separate `?for=campaign` query param handled server-side, so admin management GET / is unchanged.
- **S21-5** — Frontend only. Backend is already correct. No shared infra outside campaign wizard component tree.

**Requires caller audit before touching:**
- **S21-3** — Role change on mutation routes. Do not proceed without full caller enumeration.

**No task in Sprint 21 touches shared middleware, auth guards, `AuthContext`, `NetworkErrorBanner`, `SafeWidgetLoader`, `ErrorBoundary`, or any other cross-cutting frontend infrastructure.**

**No task in Sprint 21 creates, removes, or renames any API route** (S21-4 adds a query-param branch to an existing route, not a new route).

---

## 1. Risk Register

| ID | Description | Area | Status | Evidence |
|---|---|---|---|---|
| RISK-S21-1 | S20 spec requires `requireRole('superadmin')` on all retailer/advertiser mutation routes. Current code uses `requireRole('admin')`. If the intent is `superadmin`-only, any admin-level UI caller currently relying on this will break. Must resolve: intentional design decision or spec drift? | Auth / Backend | 🔴 Must resolve before sprint close | `retailers.js` POST/PUT/DELETE/PATCH; `advertisers.js` POST/PUT/DELETE/PATCH |
| RISK-S21-2 | `PATCH /api/advertisers/:id` calls generic `advertiserRepository.update()` with full `req.body`. A caller could overwrite `deleted_at: null` on a soft-deleted advertiser, resurrecting it. | Backend | 🔴 Active — must fix | `advertisers.js` PATCH handler |
| RISK-S21-3 | Backfill scripts not confirmed on disk. Pre-existing soft-deleted retailers/advertisers (deleted before S17 deploy) have no `deleted_at` field and will reappear from the memory fallback and continue to be visible in Firestore until backfill runs. | Backend / Data | 🟡 Open — confirm existence | `ad-server/scripts/` |
| RISK-S21-4 | Scheduler retailer list has no `status='active'` filter. Brand persona's campaign wizard can select inactive (deactivated) retailers. | Backend / Campaign flow | 🟡 Open — S21-4 | `retailers.js` GET / |
| RISK-S21-5 | Campaign wizard frontend confirm step has known issues per S20 spec (date binding, silent confirm button disable). Backend `POST /api/campaigns` is correct. Frontend source not yet read. | Frontend | 🟡 Open — requires S21-5 source read | `CampaignWizard.jsx` (path TBC) |
| RISK-S21-6 | No `Test Retailer A` seed confirmed. QA cannot complete the Admin → Scheduler → Campaign smoke flow reliably. | QA | 🟡 Open — S21-6 | `ad-server/scripts/` |

---

## 2. Security Register

| ID | Vector | File(s) | Mitigation |
|---|---|---|---|
| SEC-S21-1 | `PATCH /api/advertisers` accepts `req.body` wholesale — a caller with `admin` role could overwrite `deleted_at: null` to silently resurrect a soft-deleted advertiser. | `advertisers.js` PATCH handler | Add explicit field allowlist; block `deleted_at` in PATCH. |
| SEC-S21-2 | If `requireRole('admin')` is correct (not `superadmin`), a user with admin role can create and delete retailers/advertisers. Ensure this aligns with the intended access model. | `retailers.js`, `advertisers.js` mutation routes | Resolve RISK-S21-1 by product decision, then enforce consistently. |

---

## 3. Task Map

| Task | Files Touched | Change Type | Effort | Score | Biggest Risk |
|---|---|---|---|---|---|
| S21-1 | `scripts/backfill-deleted-retailers.js`, `backfill-deleted-advertisers.js`, `backfill-playlist-status.js` | CREATE or VERIFY | 2pts | 85% | Conservative vs aggressive strategy for pre-existing inactive records |
| S21-2 | `ad-server/src/api/advertisers.js` | EDIT — PATCH field allowlist | 1pt | 97% | Confirm no caller sends `deleted_at` via PATCH first |
| S21-3 | `ad-server/src/api/retailers.js`, `advertisers.js` | EDIT — role decision | 1pt | 90% | Requires full caller enumeration before change |
| S21-4 | `ad-server/src/api/retailers.js` | EDIT — add `?for=campaign` branch | 2pts | 91% | May require new Firestore composite index |
| S21-5 | `client-app/src/…/CampaignWizard.jsx` | EDIT — frontend wizard | 3pts | 88% | Source unread; score provisional |
| S21-6 | `scripts/seed-test-retailer.js`, test files | CREATE + EDIT | 2pts | 92% | E2E framework not confirmed |
| S21-7 | `docs/DATABASE_SCHEMA.md` | EDIT — doc | 1pt | 98% | Must be last — capture all S21 outcomes |

---

## 4. Full Task Details

### S21-1 — Verify/Create Backfill Scripts (85%)

**Context:** S17-1 and S17-2 fixes are live in source. Any retailer or advertiser soft-deleted BEFORE that deploy will have no `deleted_at` field. The `GET /` list filter (`deleted_at == null`) relies on Firestore's behaviour that documents without `deleted_at` are returned (field absent ≠ field equals null). This means pre-S17 ghosts DO continue to reappear in Firestore. Backfill scripts are the only resolution.

**Pre-check:**
```bash
find ad-server/scripts -name "backfill-*"
```

**If scripts are missing, create them following S16 `migrate-loop-status-lowercase.js` pattern:**
- Read all docs in `retailers` / `advertisers` / `playlists` collections.
- For `retailers` and `advertisers`: any doc with no `deleted_at` field AND `status` matching a known deletion value (see strategy decision below) → write `deleted_at = <doc.updated_at or Date.now()>`.
- Idempotent: skip docs that already have a non-null `deleted_at`.
- Batched in groups of ≤500 (Firestore write limit).
- Logs each doc ID updated to stdout.
- Exits non-zero on any error.

**Strategy decision (must be documented in script header):**

| Option | Rule | Risk |
|---|---|---|
| A — Aggressive | All `status='inactive'` retailers with no `deleted_at` → backfill `deleted_at` | May falsely backfill intentionally deactivated (not deleted) retailers |
| B — Conservative | Only backfill records where `status='inactive'` AND record has no associated active stores/screens | Safer; leaves ambiguous records visible until manually reviewed |

Document the chosen option and reason in the script header. **Option B is preferred** unless data audit confirms all `inactive` + no-`deleted_at` records are confirmed deletions.

**Acceptance criteria:**
1. `find ad-server/scripts -name "backfill-*"` → 3 results (retailers, advertisers, playlists).
2. Each script is idempotent (run twice, second run changes 0 documents).
3. After staging run: `db.collection('retailers').where('deleted_at', '==', null).where('status', '==', 'inactive').get()` → zero results (or all survivors are confirmed intentional deactivations).
4. Scripts exit 0 in staging.

---

### S21-2 — Guard PATCH /api/advertisers Against `deleted_at` Overwrite (97%)

**Confirmed bug:** `advertisers.js` PATCH handler passes `req.body` directly to `advertiserRepository.update()`. A caller sending `{ deleted_at: null }` would overwrite a soft-deleted advertiser's `deleted_at` field, silently resurrecting it.

**Pre-check:**
```bash
# Confirm no caller currently sends deleted_at via PATCH
grep -rn "deleted_at" client-app/src --include="*.js" --include="*.jsx"
```

**Fix:**
```js
// advertisers.js PATCH handler — add field allowlist
router.patch('/:id', authenticate, requireRole('admin'), async (req, res) => {
    try {
        // Allowlist: only permit non-sensitive fields via PATCH.
        // deleted_at is managed exclusively by softDelete().
        // status is managed exclusively by the dedicated status-toggle path.
        const ALLOWED_PATCH_FIELDS = ['name', 'logo', 'industry', 'contactemail', 'budget'];
        const patch = {};
        for (const field of ALLOWED_PATCH_FIELDS) {
            if (req.body[field] !== undefined) patch[field] = req.body[field];
        }
        if (Object.keys(patch).length === 0) {
            return res.status(400).json({ error: 'No patchable fields provided' });
        }
        const advertiser = await advertiserRepository.update(req.params.id, patch);
        res.json(advertiser);
    } catch (error) {
        logger.error('Failed to patch advertiser:', error);
        res.status(500).json({ error: 'Failed to patch advertiser' });
    }
});
```

> Note: `retailers.js` PATCH already uses `retailerRepository.updateStatus()` which only accepts `status` — it does not have this vulnerability. No change needed there.

**Acceptance criteria:**
1. `PATCH /api/advertisers/:id` with `{ deleted_at: null }` → 400 or silently ignores `deleted_at` (field not in allowlist).
2. `PATCH /api/advertisers/:id` with `{ name: 'New Name' }` → 200, name updated, `deleted_at` unchanged.
3. A soft-deleted advertiser (`deleted_at` set) cannot be resurrected via PATCH.
4. `GET /api/advertisers/:id` on a soft-deleted record still returns 404 after PATCH attempt.

---

### S21-3 — Resolve admin vs superadmin Role on Mutation Routes (90%)

**Current state:** All retailer and advertiser mutation routes use `requireRole('admin')`. S20 spec says `requireRole('superadmin')`. This is a product/architecture decision, not a bug.

**Pre-check (blocking — do not change roles without this):**
```bash
# Find all places in the frontend that call retailer/advertiser mutation endpoints
grep -rn "deleteRetailer\|deleteAdvertiser\|createRetailer\|createAdvertiser\|updateRetailer\|updateAdvertiser\|apiService\." \
  client-app/src --include="*.js" --include="*.jsx"

# Find any test that calls these routes
grep -rn "POST.*retailers\|PUT.*retailers\|DELETE.*retailers\|PATCH.*retailers\|\nPOST.*advertisers\|PUT.*advertisers\|DELETE.*advertisers\|PATCH.*advertisers" \
  tests/ --include="*.spec.*"
```

**Decision matrix:**

| Choice | Implication |
|---|---|
| Keep `requireRole('admin')` | Admin users can manage retailers and advertisers. Simpler — aligns with current S11 intent. |
| Change to `requireRole('superadmin')` | Only superadmin can mutate. Admin users lose access. Any admin-role caller in the frontend will receive 403 after change. |

**Recommended path:** Document the decision here and in `DATABASE_SCHEMA.md`. If the product intent is `superadmin`-only, enumerate and update all frontend callers before shipping. If `admin` is correct, close S20 spec drift by annotating `retailers.js` and `advertisers.js` with an explicit note explaining the choice.

**Acceptance criteria:**
1. A written decision is recorded in this file under `§ S21-3 Resolution` below.
2. If changing to `superadmin`: all frontend callers updated, all tests updated, no 403s in QA smoke.
3. If keeping `admin`: `retailers.js` and `advertisers.js` contain a JSDoc comment confirming the intent.
4. `DATABASE_SCHEMA.md` updated with the authoritative role rule.

---

### S21-4 — Add `status='active'` Filter to Scheduler Retailer Source (91%)

**Context:** The campaign wizard currently uses the generic `GET /api/retailers` list, which returns all non-deleted retailers regardless of status. This means deactivated (`status='inactive'`, no `deleted_at`) retailers appear in the scheduler's retailer picker. S20 requires the scheduler to show only `status='active'` retailers with at least one associated store or screen.

**Preferred implementation — query parameter branch (avoids changing admin management list):**

```js
// retailers.js GET / — add ?for=campaign branch
router.get('/', async (req, res) => {
    try {
        if (req.query.for === 'campaign') {
            // Scheduler view: active, non-deleted retailers only.
            // TODO S21-4: also filter by has_stores / has_screens once
            // store/screen association is queryable from this endpoint.
            const retailers = await retailerRepository.findAll({
                where: [
                    ['deleted_at', '==', null],
                    ['status',     '==', 'active']
                ]
            });
            return res.json(retailers);
        }

        // Default admin management view: all non-deleted (includes inactive)
        const retailers = await retailerRepository.findAll({
            where: [['deleted_at', '==', null]]
        });
        res.json(retailers);
    } catch (error) {
        logger.error('Failed to fetch retailers:', error);
        res.status(500).json({ error: 'Failed to fetch retailers' });
    }
});
```

> ⚠️ **Firestore compound query caveat:** `where('deleted_at', '==', null)` + `where('status', '==', 'active')` is a compound query. Firestore requires a composite index for compound queries on different fields. Pre-check: does `firestore.indexes.json` have a composite index for `retailers: [deleted_at ASC, status ASC]`? If not, add it (see S16-3 pattern).

**Acceptance criteria:**
1. `GET /api/retailers?for=campaign` → returns only `status='active'`, `deleted_at==null` retailers.
2. `GET /api/retailers` (no param) → unchanged behaviour; returns all non-deleted retailers (active + inactive).
3. Admin management UI is unaffected.
4. Campaign wizard retailer picker uses `?for=campaign` query param.
5. If composite index added: `firestore.indexes.json` updated and `DATABASE_SCHEMA.md` reflects it.

---

### S21-5 — CampaignWizard Frontend Stabilization (88% — provisional)

**Context:** `POST /api/campaigns` backend is correct and guarded. S20 flags confirm step issues (date binding mismatch, silent button disable, validation errors not surfaced). Frontend source not yet read.

**Required pre-read before any code is written (GUARDRAIL-9):**
```bash
find client-app/src -name "CampaignWizard*" -o -name "*campaign*wizard*" 2>/dev/null
```

Once path is confirmed, read the file in full. Then assess:

| Check | What to Look For |
|---|---|
| Confirm step payload | Does the wizard call `POST /api/campaigns` with correct body shape matching `campaigns.js` L96? |
| Date binding | Are `start_date` / `end_date` (or equivalent) fields bound to the same value that gets submitted? |
| Validation display | Does the wizard surface API 400/500 errors in the UI, or are they swallowed? |
| Retailer source | Does the wizard fetch from `GET /api/retailers?for=campaign` (after S21-4) or bare `GET /api/retailers`? |
| Silent disable | Is the confirm button disabled by frontend validation state that doesn't surface an error message? |

**Score will be updated after source read.** Score cap at 88% until file is read.

**Acceptance criteria (post-read):**
1. Wizard calls `POST /api/campaigns` with correct payload shape.
2. Date range selected in wizard matches what is submitted to the API and displayed in campaign list.
3. API validation errors (400) are displayed to the user — confirm button is not silently disabled without explanation.
4. Wizard retailer picker uses `?for=campaign` endpoint.
5. E2E happy path: select Test Retailer A → pick valid date range → confirm → campaign appears in list.

---

### S21-6 — Seed Test Retailer A + Observability + E2E Tests (92%)

**Seed script:** `ad-server/scripts/seed-test-retailer.js`
- Creates `Test Retailer A` with `status='active'`, `deleted_at` absent, at least one store, at least one screen.
- Idempotent: checks if `Test Retailer A` already exists before writing.
- Safe to run in dev and QA.
- Documents the canonical test fixture ID in script output.

**Structured logging (already partially in place — `AdvertiserRepository.js` has `logger.error`):**

Add `logger.info` on:
- Retailer / advertiser creation: `{ event: 'retailer_created', retailer_id, status, origin_route }`
- Soft-delete: `{ event: 'retailer_soft_deleted', retailer_id, deleted_at }`
- Scheduler retailer query: `{ event: 'scheduler_retailers_fetched', count, role, query_type: 'campaign' }`

**E2E test coverage:**
1. Soft-delete lifecycle test:
   - Create retailer via `POST /api/retailers`.
   - Confirm it appears in `GET /api/retailers`.
   - `DELETE /api/retailers/:id`.
   - Confirm it does NOT appear in `GET /api/retailers`.
   - Confirm `GET /api/retailers/:id` returns 404.
   - PATCH deactivate a different retailer (`status='inactive'`).
   - Confirm it STILL appears in `GET /api/retailers` (deactivated ≠ deleted).
2. Admin → Scheduler → Campaign flow test:
   - Seed Test Retailer A (if not present).
   - Confirm it appears in `GET /api/retailers?for=campaign`.
   - `POST /api/campaigns` with Test Retailer A → 201.
   - `GET /api/campaigns/:id` → confirms campaign exists with correct advertiser_id and status.

**Acceptance criteria:**
1. `node ad-server/scripts/seed-test-retailer.js` exits 0; `Test Retailer A` appears in `GET /api/retailers?for=campaign`.
2. Structured log entries appear for retailer create, soft-delete, and scheduler query events.
3. Both E2E test scenarios pass.
4. No test relies on hardcoded document IDs.

---

### S21-7 — Update `DATABASE_SCHEMA.md` (98%)

**Must be the final task — captures all sprint outcomes.**

Update to document:
1. **Soft-delete semantics (authoritative):**
   - `deleted_at` (ISO timestamp | absent) is the canonical deletion marker for `retailers` and `advertisers`.
   - `status='inactive'` alone = intentionally deactivated, still visible in admin UI.
   - `status='inactive'` + non-null `deleted_at` = soft-deleted, excluded from all list and detail endpoints.
   - `status='suspended'` + non-null `deleted_at` = soft-deleted advertiser.
2. **Playlist status:** lowercase `'active'` is canonical. S17-6 closed RISK-S16-9.
3. **Backfill scripts:** list filenames, run date (to be filled after execution), and strategy chosen.
4. **Retailer role authority:** document the S21-3 role decision (admin vs superadmin) as authoritative.
5. **Scheduler retailer query:** document `GET /api/retailers?for=campaign` as the scheduler's canonical source.
6. **Composite index:** if added for S21-4, document field paths and collectionGroup.

**Acceptance criteria:**
1. `grep "deleted_at" docs/DATABASE_SCHEMA.md` → semantic definition present.
2. `grep "GUARDRAIL-15" docs/DATABASE_SCHEMA.md` → cross-reference present.
3. `grep "backfill" docs/DATABASE_SCHEMA.md` → script names and run date present.
4. `grep "for=campaign" docs/DATABASE_SCHEMA.md` → scheduler endpoint documented.
5. Role authority for retailer/advertiser mutations documented.

---

## 5. File Inventory

| File | Operation | Task(s) |
|---|---|---|
| `ad-server/scripts/backfill-deleted-retailers.js` | CREATE or VERIFY | S21-1 |
| `ad-server/scripts/backfill-deleted-advertisers.js` | CREATE or VERIFY | S21-1 |
| `ad-server/scripts/backfill-playlist-status.js` | CREATE or VERIFY | S21-1 |
| `ad-server/src/api/advertisers.js` | EDIT — PATCH allowlist | S21-2 |
| `ad-server/src/api/retailers.js` | EDIT — role decision + `?for=campaign` branch | S21-3, S21-4 |
| `ad-server/src/api/advertisers.js` | EDIT — role decision | S21-3 |
| `client-app/src/…/CampaignWizard.jsx` | EDIT — wizard confirm step | S21-5 |
| `ad-server/scripts/seed-test-retailer.js` | CREATE | S21-6 |
| Test files (path TBC) | EDIT/CREATE | S21-6 |
| `docs/DATABASE_SCHEMA.md` | EDIT — doc | S21-7 |

**Already confirmed DONE — no action required:**
- `RetailerRepository.js` — softDelete + updateStatus correct.
- `AdvertiserRepository.js` — softDelete correct.
- `BaseRepository.js` — memory comparator `?? null` fix in place.
- `retailers.js` GET /, GET /:id — filters and guards in place.
- `advertisers.js` GET /, GET /:id — filters and guards in place.
- `PlaylistRepository.js` — both query methods use lowercase `'active'`.

---

## 6. Non-Blocking Dependency Map

| Task | Blocks | Blocked By | Non-Blocking? |
|---|---|---|---|
| S21-7 | Sprint close (GUARDRAIL-13) | All other tasks | ⚠️ Last — author after all others complete |
| S21-1 | Production data safety | Nothing | ✅ First — confirm scripts before any deploy |
| S21-2 | Nothing | Pre-check grep | ✅ Ship independently after pre-check |
| S21-3 | S21-7 doc | Pre-check caller audit | ⚠️ Block on audit; ship after decision |
| S21-4 | S21-5 (wizard must use `?for=campaign`), S21-6 E2E test | S21-3 role decision (soft dep) | ⚠️ Depends on composite index pre-check |
| S21-5 | S21-6 E2E | CampaignWizard source read (GUARDRAIL-9) | ⚠️ Read first, then implement |
| S21-6 | Sprint close | S21-4 (scheduler endpoint), S21-5 (wizard E2E) | ⚠️ Last integration step before S21-7 |

**Recommended execution order:**
1. **S21-1** — run `find ad-server/scripts` pre-check; create missing backfill scripts.
2. **S21-2** — run grep pre-check; add PATCH allowlist to `advertisers.js`.
3. **S21-3** — run caller audit; record decision; apply role change or annotate with justification.
4. **S21-4** — add `?for=campaign` branch; check/add composite index.
5. **S21-5** — read `CampaignWizard.jsx`; stabilize confirm step and date binding.
6. **S21-6** — seed script; logging additions; E2E tests.
7. **S21-7** — update `DATABASE_SCHEMA.md` to capture all outcomes.

---

## 7. Test Stabilization Order

1. **Soft-delete lifecycle** — after S21-1 backfill runs in staging. Confirms no ghost records return on refresh.
2. **PATCH advertiser guard** — after S21-2. Confirms `deleted_at` cannot be overwritten via PATCH.
3. **Scheduler retailer filter** — after S21-4. `GET /api/retailers?for=campaign` returns active-only.
4. **Campaign wizard E2E** — after S21-5 frontend fix and S21-4 scheduler endpoint. Test Retailer A end-to-end.
5. **Full smoke** — Admin creates retailer → Scheduler picks it up → Campaign wizard confirm → Campaign appears in list.

---

## 8. Definition of Done

### Soft-delete integrity
- [ ] `find ad-server/scripts -name "backfill-*"` → 3 results; all exit 0 in staging.
- [ ] Backfill strategy (Option A or B) documented in each script header.
- [ ] After staging backfill: no ghost retailer or advertiser reappears on page refresh.
- [ ] `GET /api/advertisers/:id` on a soft-deleted record returns 404 after `PATCH { deleted_at: null }` attempt.
- [ ] A retailer with `status='inactive'` but no `deleted_at` still appears in `GET /api/retailers` (deactivate ≠ delete confirmed in QA).

### Campaign flow
- [ ] `GET /api/retailers?for=campaign` returns only `status='active'`, `deleted_at==null` retailers.
- [ ] `GET /api/retailers` (no param) unchanged — returns all non-deleted retailers.
- [ ] `CampaignWizard.jsx` confirm step calls `POST /api/campaigns` with correct payload; API errors are visible to user.
- [ ] Date range selected in wizard matches what is submitted and displayed in campaign list.
- [ ] QA can complete Admin → Scheduler → Campaign flow for Test Retailer A without database edits.

### Role authority
- [ ] S21-3 decision documented under `§ S21-3 Resolution`.
- [ ] Role rule annotated in `retailers.js` and `advertisers.js`.

### Documentation
- [ ] `DATABASE_SCHEMA.md` updated with soft-delete semantics, role authority, scheduler endpoint, composite index (if added), backfill script names and run dates.
- [ ] All 15 guardrails intact; no new violation introduced by any S21 commit.
- [ ] No carry-over risk left without a resolution sprint assigned (GUARDRAIL-14).

---

## § S21-3 Resolution

> **Pending** — to be filled after caller audit (`grep` pre-check) and product decision.

```
Caller audit run: [ YES / NO ]
Callers found referencing retailer/advertiser mutations:
  [ list files ]

Decision: [ Keep requireRole('admin') | Change to requireRole('superadmin') ]
Reason:
  [ fill after audit ]

Files updated:
  [ list ]
```

---

*Sprint 21 spec — authored 2026-06-16.*
*Grounded against HEAD `3246fd8`. Source files read in full: `RetailerRepository.js`, `AdvertiserRepository.js`, `BaseRepository.js`, `PlaylistRepository.js`, `retailers.js`, `advertisers.js`, `campaigns.js`.*
*S17-1 through S17-6 confirmed DONE in source. S20 workstreams 1–5 partially done; open items are S21-1 through S21-7.*
*15 guardrails active — GUARDRAIL-15 introduced this sprint.*
