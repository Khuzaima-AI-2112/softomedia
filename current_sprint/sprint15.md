# Sprint 15 — Monetization, Pricing Config & Billing

**Sprint:** 15
**Status:** 🔵 In Progress — Step 4 audit complete; Step 3 build pending
**Grounded against:** HEAD `7c1737a` (2026-06-08)
**Step 4 audit grounded against:**
- `ad-server/index.js` SHA `7d76dcc2` — server entry point confirmed
- `ad-server/src/api/index.js` SHA `7d5eeb80` — aggregated API router confirmed
- `ad-server/src/api/pricing.js` SHA `bcb2566d` — existing file read in full
**Guardrails authority:** [`docs/sprint8-sre-retro-consolidated.md`](../docs/sprint8-sre-retro-consolidated.md)
**Route authority:** [`docs/API_ROUTES.md`](../docs/API_ROUTES.md)
**Schema authority:** [`docs/DATABASE_SCHEMA.md`](../docs/DATABASE_SCHEMA.md)
**MVP reference:** [`docs/Digital Screen Network Management Platform (MVP).md`](<../docs/Digital Screen Network Management Platform (MVP).md>)
**Completion plan:** [`docs/MVP_COMPLETION_SPRINT_PLAN.md`](../docs/MVP_COMPLETION_SPRINT_PLAN.md)
**Pricing reference:** [`docs/CPM_PRICING_MODEL.md`](../docs/CPM_PRICING_MODEL.md)

---

## Step 4 Audit Corrections (applied 2026-06-08)

The following corrections were made to the Step 2 spec based on reading live source files.
All changes are evidence-grounded with confirmed SHAs.

| Item | Step 2 Spec Said | Corrected To | Evidence |
|---|---|---|---|
| S15-1 `pricing.js` operation | CREATE | **EDIT** | `pricing.js` already imported + mounted in `src/api/index.js` SHA `7d5eeb80` |
| S15-1 `pricing.js` registration target | `app.use('/api/pricing', ...)` in `ad-server/index.js` | **Add handlers inside existing `src/api/pricing.js`**; no `index.js` change for S15-1 | All domain routes aggregate via `src/api/index.js`; `ad-server/index.js` mounts only `app.use('/api', apiRouter)` |
| S15-1 HTTP method for config update | `PATCH /api/pricing/config` | **`PUT /api/pricing/config`** | Live file has `router.put('/config', ...)` at `pricing.js` line 41 |
| S15-1 `GET /config` auth posture | `requireAuth + requireRole('admin')` — new endpoint | **EDIT existing `GET /config`** — currently public, add `authenticate + requireRole('admin')` guard | `pricing.js` L33: `router.get('/config', async (req, res) => {` — no auth middleware |
| S15-1 `PUT /config` auth posture | `requireAuth + requireRole('admin')` | **EDIT existing `PUT /config`** — currently has `authenticate` but no `requireRole`; add `requireRole('admin')` | `pricing.js` L44: `router.put('/config', authenticate, ...)` — missing role check |
| S15-1 `PricingService.js` | CREATE as intermediary | **Optional** — existing pattern calls `PricingRepository` directly; `PricingService.js` may be created as a thin wrapper or skipped; `PricingRepository` already handles `getConfig()` and `updateConfig()` | `pricing.js` imports `PricingRepository` directly; no service layer in this file |
| S15-1 `GET /estimate` | New endpoint, any auth | **ADD new handler** `GET /estimate` inside `pricing.js` with `authenticate` guard | Endpoint does not exist in live file; additive |
| S15-2 `invoices.js` registration target | `app.use('/api/invoices', ...)` in `ad-server/index.js` | **Append `router.use('/invoices', authenticate, invoicesRouter)` to `src/api/index.js`** | `src/api/index.js` is the aggregated router; `ad-server/index.js` is not touched |
| S15-7 test file location | "place alongside existing spec files" (ambiguous) | **`ad-server/tests/pricing_billing.spec.js`** | `ad-server/tests/` dir confirmed on disk; `ad-server/jest.config.js` confirmed |

### Security Gap Discovered in Step 4

| ID | Gap | File | Finding | Fix |
|---|---|---|---|---|
| SEC-S15-5 | `GET /api/pricing/config` publicly accessible — no auth | `pricing.js` L33 | `router.get('/config', ...)` has no `authenticate` middleware | Add `authenticate, requireRole('admin')` to existing handler |
| SEC-S15-6 | `PUT /api/pricing/config` has auth but no role check | `pricing.js` L44 | `router.put('/config', authenticate, ...)` — any authenticated user can update CPM config | Add `requireRole('admin')` to existing handler |

---

## Step 3 Status — Build (2026-06-08)

Step 3 not yet executed. All 9 file operations remain pending.

**Confirmed file states at HEAD `7c1737a`:**

| File | Operation | Status |
|---|---|---|
| `ad-server/src/api/pricing.js` | **EDIT** | ✅ Exists — SHA `bcb2566d`; 3 handlers need changes (see S15-1) |
| `ad-server/src/services/PricingService.js` | CREATE (optional thin wrapper) | ❌ Absent |
| `ad-server/src/api/invoices.js` | CREATE | ❌ Absent |
| `ad-server/src/api/index.js` | EDIT (append invoices line) | ✅ Exists — SHA `7d5eeb80` |
| `client-app/src/pages/admin/PricingConfig.jsx` | CREATE | ❌ Absent |
| `client-app/src/pages/advertiser/Invoices.jsx` | CREATE | ❌ Absent |
| `ad-server/tests/pricing_billing.spec.js` | CREATE | ❌ Absent |
| `client-app/src/App.jsx` | EDIT | ✅ Exists — SHA `e3cb9643` |
| `docs/API_ROUTES.md` | EDIT | ✅ Exists |
| `docs/DATABASE_SCHEMA.md` | EDIT | ✅ Exists |

**Build order for Step 3:**
1. Edit `pricing.js` — harden existing `GET /config` and `PUT /config`; add `GET /estimate`
2. Create `invoices.js`
3. Edit `src/api/index.js` — append `router.use('/invoices', authenticate, invoicesRouter)`
4. Create `PricingConfig.jsx` → GUARDRAIL-1/2 gate → edit `App.jsx`
5. Create `Invoices.jsx` → GUARDRAIL-1/2 gate → edit `App.jsx`
6. Create `ad-server/tests/pricing_billing.spec.js`
7. Edit `docs/API_ROUTES.md`
8. Edit `docs/DATABASE_SCHEMA.md`

---

## Step 1 Findings Summary

All pre-work greps run against commit `2e3c3bf` before any story was written.

| Item | Finding |
|---|---|
| `PricingService.js` | ❌ NOT ON DISK — `find . -path '*PricingService*'` → no match |
| `pricing.js` (API route) | ⚠️ MISREAD — file EXISTS at `ad-server/src/api/pricing.js`; Step 4 audit confirmed SHA `bcb2566d` |
| `invoices.js` (API route) | ❌ NOT ON DISK — confirmed absent |
| `PricingConfig.jsx` | ❌ NOT ON DISK |
| `Invoices.jsx` | ❌ NOT ON DISK |
| `LoopGenerationService.js` priority | ✅ EXISTS — SHA `cf7c43fa`; `CAMPAIGN_PRIORITY` enum confirmed: `PAID:1, RETAILER:2, INTERNAL:3`; `prioritizeCampaigns()` live — **zero patch required** |
| `CampaignRepository.js` | ✅ EXISTS — confirmed in S14 |
| `App.jsx` | ✅ EXISTS — SHA `e3cb9643` |
| `CPM_PRICING_MODEL.md` | ✅ EXISTS — SHA `7308d142` |
| ENUM-AUDIT-3 | ✅ CLOSED — `'PENDING'` at `LoopGenerationService.js` L110 is slot-init only; isolated from campaign state machine |

**Repo Grounding Score (post Step 4): 97%**
Remaining uncertainty: `CampaignRepository.findById` method name not re-confirmed in S15 pre-work (confirmed in S14, low risk); Firestore emulator availability in test env.

---

## 1. Risk Register

| ID | Description | Area | Status | Evidence |
|---|---|---|---|---|
| RISK-S15-1 | `pricing.js` EDIT must not break existing public `GET /` and `GET /calculate` handlers | Backend API | 🟡 Watch | Existing handlers confirmed at `pricing.js`; additive changes only to new/existing named routes |
| RISK-S15-2 | `invoices.js` created from scratch — no billing infra exists | Backend API | 🔴 Active | Confirmed absent |
| RISK-S15-3 | S11-1/2/4 persistence QA outstanding for 3 sprints — risk of blocking DoD | QA carry-over | 🟡 Watch | Re-carried from S13, S14 |
| RISK-S15-4 | GUARDRAIL-7 debt from S14 — `API_ROUTES.md` not updated for S14 campaign routes | Docs | 🟡 Active | Confirmed in S14 close-out |
| RISK-S15-5 | Firestore composite index on `campaigns.advertiser_id` not yet created | Infra | 🟡 Deferred | Required for production equality query |
| RISK-S15-6 | `App.jsx` lazy route registered before component file exists (GUARDRAIL-1/2) | Frontend | 🔴 Active | Standard risk for all new page creation |
| RISK-S15-7 | `invoices` collection schema not in `DATABASE_SCHEMA.md` before Firestore write | Docs/Schema | 🟡 Active | GUARDRAIL-8 trigger |
| RISK-S15-8 | `GET /api/pricing/config` currently public — hardening may break `CPMCalendar.jsx` if it calls this endpoint without a token | Frontend/Backend | 🔴 Active | SEC-S15-5 discovery; must grep `CPMCalendar.jsx` before hardening |

---

## 2. Security Register

| ID | Vector | File(s) | Mitigation | Environment Impact |
|---|---|---|---|---|
| SEC-S15-1 | Advertiser A reads Advertiser B invoices via `GET /api/invoices/:id` | `invoices.js` | Ownership check: `invoice.advertiser_id !== req.user.linked_entity_id → 403` | All envs |
| SEC-S15-2 | `advertiser_id` spoofing on invoice generation | `invoices.js` | `advertiser_id` stamped server-side from campaign record, not from request body | All envs |
| SEC-S15-3 | Unauthorised CPM config write | `pricing.js` | `requireRole('admin')` added to existing `PUT /config` handler | All envs |
| SEC-S15-4 | Allocation bypass — floating-point sum | `pricing.js` / `PricingRepository.js` | Validate `paid + retailer + internal === 100` (integer math) before persist | All envs |
| SEC-S15-5 | `GET /api/pricing/config` publicly readable — no auth | `pricing.js` L33 | Add `authenticate, requireRole('admin')` to existing `GET /config` handler; pre-check `CPMCalendar.jsx` for anonymous calls first | All envs |
| SEC-S15-6 | `PUT /api/pricing/config` has `authenticate` but no role guard — any logged-in user can overwrite CPM rates | `pricing.js` L44 | Add `requireRole('admin')` to existing `PUT /config` handler | All envs |

---

## 3. Task Map

| Task | Files Touched | Change Type | Estimated Effort | Outcome Probability | Biggest Risk |
|---|---|---|---|---|---|
| S15-1 · Pricing Config API hardening + estimate endpoint | `pricing.js` (EDIT), `PricingRepository.js` (read-only confirm), optional `PricingService.js` (CREATE) | Additive + security hardening of existing handlers | 2 pts | 91% | `GET /config` hardening may break `CPMCalendar.jsx` — grep required first |
| S15-2 · Invoice Generation + Access API | `invoices.js` (CREATE), `src/api/index.js` (EDIT — append one line) | Additive | 3 pts | 86% | `CampaignRepository.findById` method name — confirm before coding |
| S15-3 · PricingConfig.jsx | `PricingConfig.jsx` (CREATE), `App.jsx` (EDIT) | Additive | 2 pts | 90% | GUARDRAIL-1/2; `apiClient` import path |
| S15-4 · Invoices.jsx | `Invoices.jsx` (CREATE), `App.jsx` (EDIT) | Additive | 2 pts | 90% | GUARDRAIL-1/2; role guard pattern |
| S15-5 · API_ROUTES.md Update | `docs/API_ROUTES.md` (EDIT) | Docs | 1 pt | 99% | Manual omission |
| S15-6 · DATABASE_SCHEMA.md Update | `docs/DATABASE_SCHEMA.md` (EDIT) | Docs | 1 pt | 99% | Manual omission |
| S15-7 · pricing_billing.spec.js | `ad-server/tests/pricing_billing.spec.js` (CREATE) | Additive | 2 pts | 87% | Firestore emulator availability in test env |

---

## 4. Full Task Details

---

### S15-1 · Pricing Config API Hardening + Estimate Endpoint

**Pre-checks (MANDATORY before any edit)**
```bash
# 1. Confirm CPMCalendar.jsx does not call GET /config anonymously
grep -n "pricing/config\|api/pricing" client-app/src/pages/admin/CPMCalendar.jsx
# If result shows a call without an auth header/token — STOP; coordinate before hardening.

# 2. Confirm requireRole middleware exists and export name
grep -n "requireRole\|export" ad-server/src/middleware/auth.js
# Expected: a named export called requireRole (or similar)

# 3. Confirm PricingRepository methods available
grep -n "^export\|async " ad-server/src/repositories/PricingRepository.js
# Confirm getConfig(), updateConfig() exist; note exact method names

# 4. Confirm existing pricing.js handlers (belt-and-suspenders)
grep -n "router\.(get\|put\|post\|patch\|delete)" ad-server/src/api/pricing.js
# Expected: GET /, GET /config, PUT /config, POST /overrides, GET /overrides/:date, GET /calculate
```

**Edits to `ad-server/src/api/pricing.js`**

**Edit 1 — Harden `GET /config` (currently public):**
```js
// BEFORE (line ~33):
router.get('/config', async (req, res) => {

// AFTER — add authenticate + requireRole:
router.get('/config', authenticate, requireRole('admin'), async (req, res) => {
```
- Import `requireRole` at top of file alongside `authenticate` (confirm export name in pre-check #2)

**Edit 2 — Harden `PUT /config` (missing role guard):**
```js
// BEFORE (line ~44):
router.put('/config', authenticate, async (req, res) => {

// AFTER:
router.put('/config', authenticate, requireRole('admin'), async (req, res) => {
```
- Also add allocation sum validation inside the handler:
```js
if (req.body.allocation) {
  const { paid = 0, retailer = 0, internal = 0 } = req.body.allocation;
  if (paid + retailer + internal !== 100) {
    return res.status(400).json({ error: 'Allocation must sum to 100' });
  }
}
```

**Edit 3 — ADD new `GET /estimate` handler (additive):**
```js
/**
 * GET /api/pricing/estimate
 * Estimate cost for a given slot count and CPM rate
 * Query params: slots (number), cpm (number)
 */
router.get('/estimate', authenticate, async (req, res) => {
  const slots = parseFloat(req.query.slots);
  const cpm   = parseFloat(req.query.cpm);
  if (isNaN(slots) || isNaN(cpm)) {
    return res.status(400).json({ error: 'slots and cpm are required' });
  }
  return res.json({ estimatedCost: (slots * cpm / 1000).toFixed(4) });
});
```
- Place before `export default router`
- No Firestore call — pure calculation; no PricingRepository dependency

**Optional: `ad-server/src/services/PricingService.js`** — CREATE only if the team wants a service layer. `PricingRepository` is already injected directly in `pricing.js` and handles persistence. If created, it is a thin wrapper; do not duplicate `PricingRepository` logic.

**Acceptance criteria (all falsifiable)**
- `GET /api/pricing/config` with no token → `401`
- `GET /api/pricing/config` with valid `retailer` token → `403`
- `GET /api/pricing/config` with valid `admin` token → `200 { ...config }`
- `PUT /api/pricing/config` `{ allocation: { paid: 60, retailer: 30, internal: 20 } }` as admin → `400 { error: 'Allocation must sum to 100' }`
- `PUT /api/pricing/config` `{ allocation: { paid: 60, retailer: 30, internal: 10 } }` as admin → `200`
- `PUT /api/pricing/config` as role `advertiser` → `403`
- `GET /api/pricing/estimate?slots=12&cpm=5` with valid token → `200 { estimatedCost: '0.0600' }`
- `GET /api/pricing/estimate` (no params) with valid token → `400`
- `GET /api/pricing/` (existing root handler) — still returns `200` after edits (no regression)
- `GET /api/pricing/calculate?hour=14` (existing handler) — still returns `200` after edits (no regression)

**Post-implementation verification**
```bash
grep -n "requireRole\|requireAuth\|authenticate" ad-server/src/api/pricing.js
# Expected: authenticate + requireRole on GET /config and PUT /config; authenticate on GET /estimate
```

**Outcome probability:** 91%
**Biggest risk:** `CPMCalendar.jsx` calling `GET /config` without a token — mandatory pre-check #1 must clear before this edit lands.

---

### S15-2 · Invoice Generation + Access API

**Pre-checks**
```bash
# 1. Confirm invoices.js absent
find ad-server/src/api -name "invoices.js"
# Expect: no output

# 2. Confirm CampaignRepository method name
grep -n "findById\|findByPk\|getById" ad-server/src/repositories/CampaignRepository.js
# Confirm exact method name before coding the generate handler

# 3. Confirm JWT payload shape (linked_entity_id present)
grep -n "linked_entity_id" ad-server/src/services/AuthService.js

# 4. Confirm src/api/index.js SHA before editing
# SHA at Step 4 audit: 7d5eeb807ed0b21376fee3bd41a7091926bcda11
# Re-read file before append to avoid stale-SHA push
```

**`ad-server/src/api/invoices.js`** — CREATE
```
POST /api/invoices/generate    authenticate + requireRole('admin')   → 201 | 400 | 403
GET  /api/invoices             authenticate                          → 200 { invoices, total, page }
GET  /api/invoices/:id         authenticate                          → 200 | 403 | 404
GET  /api/invoices/:id/pdf     authenticate                          → 200 (JSON stub) | 403
```

**`POST /api/invoices/generate` logic:**
1. `requireRole('admin')` — non-admin → `403`
2. Validate `req.body.campaignId` present → `400 { error: 'campaignId is required' }` if absent
3. `campaign = await CampaignRepository.[confirmedMethodName](req.body.campaignId)` → `404` if not found
4. `if (campaign.status !== 'completed') return res.status(400).json({ error: 'Campaign must be completed' })`
5. Fetch `cpmRate` via `PricingRepository.getConfig()` using campaign screen type
6. `amount = (campaign.impressionsDelivered ?? 0) * cpmRate / 1000`
7. Persist to `invoices` Firestore collection
8. Return `201 { invoiceId, campaignId, impressionsDelivered, cpmRate, amount, generatedAt }`

**`GET /api/invoices` logic:**
- Role `advertiser` → `where advertiser_id == req.user.linked_entity_id`
- Role `admin` / `superadmin` → all invoices, paginated (`?page=1&limit=20` default)
- Returns `200 { invoices: [], total, page }`

**`GET /api/invoices/:id` logic:**
- Fetch by id → `404` if not found
- Role `advertiser` + `invoice.advertiser_id !== req.user.linked_entity_id` → `403`
- Otherwise `200 { invoice }`

**`GET /api/invoices/:id/pdf` logic:**
- Same ownership check as `GET /:id`
- Returns `200 { message: 'PDF generation not yet available', invoiceData: { ...invoice } }`
- Real PDF deferred to post-MVP; this endpoint establishes the contract

**Edit `ad-server/src/api/index.js`** — append ONE line in the protected routes block:
```js
// After the last existing router.use('/impressions', authenticate, impressionsRouter); line:
import invoicesRouter from './invoices.js';
// ...
router.use('/invoices', authenticate, invoicesRouter);
```
- Import must be added at the top of the file with all other imports
- `router.use` line appended at the bottom of the protected block
- **Do not reorder or modify any existing `router.use(...)` lines**

**Acceptance criteria**
- `POST /api/invoices/generate` as role `advertiser` → `403`
- `POST /api/invoices/generate` with `campaignId` of a `live` campaign → `400 { error: 'Campaign must be completed' }`
- `POST /api/invoices/generate` with `campaignId` of a `completed` campaign → `201 { invoiceId }`
- `GET /api/invoices` as advertiser A → does NOT include invoices for advertiser B
- `GET /api/invoices/:id` as wrong advertiser → `403`
- `GET /api/invoices/:id/pdf` as wrong advertiser → `403`
- All existing routes in `src/api/index.js` respond identically after the edit (regression check)

**Post-implementation verification**
```bash
grep -n "invoices" ad-server/src/api/index.js
# Expected: import line + router.use line

grep -n "requireRole\|linked_entity_id" ad-server/src/api/invoices.js
# Expected: requireRole('admin') on POST; linked_entity_id ownership check on GET routes
```

**Outcome probability:** 86%
**Biggest risk:** `CampaignRepository` method name — confirm via pre-check #2 before writing handler.

---

### S15-3 · PricingConfig.jsx (Admin UI)

**Pre-checks**
```bash
# 1. Confirm S15-1 back end is live
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/pricing/config \
  -H "Authorization: Bearer <admin-token>"
# Expected: 200

# 2. Confirm apiClient import path used in S14 advertiser pages
grep -n "apiClient\|import.*api" client-app/src/pages/advertiser/AdvertiserDashboard.jsx | head -5

# 3. Confirm /dashboard/admin/pricing-config route is unoccupied in App.jsx
grep -n "pricing-config\|pricing" client-app/src/App.jsx
# Expected: CPMCalendar at /pricing only; pricing-config absent
```

**`client-app/src/pages/admin/PricingConfig.jsx`** — CREATE
- On mount: `GET /api/pricing/config` via `apiClient` → populates form state
- CPM rate inputs: one `<input type="number" step="0.01">` per screen type returned by API
- Allocation inputs: three number inputs (`paid`, `retailer`, `internal`), range 0–100
- Live sum badge: shows `paid + retailer + internal`; badge class `error` when sum ≠ 100
- Save button: `data-testid="pricing-save-btn"` — `disabled` when sum ≠ 100
- Submit: `PUT /api/pricing/config` → success toast (inline, no page reload) / inline error on 400
- Skeleton loader during initial fetch
- `data-testid="pricing-config-form"` on the `<form>` element
- No hardcoded URLs — uses `apiClient` (GUARDRAIL-6)

**Register in `App.jsx`** — ONLY after `PricingConfig.jsx` confirmed on disk:
```jsx
// Under // ── Admin pages (with existing admin lazy imports)
const PricingConfig = lazy(() => import('./pages/admin/PricingConfig'));
// Route (add alongside existing admin routes):
<Route path="pricing-config" element={<PricingConfig />} />
```

**GUARDRAIL-1/2 gate**
```bash
find client-app/src/pages/admin -name "PricingConfig.jsx"
# Must return a path before App.jsx lazy import is written
```

**Acceptance criteria**
- `data-testid="pricing-save-btn"` has `disabled` when `paid + retailer + internal ≠ 100`
- `data-testid="pricing-save-btn"` does NOT have `disabled` when sum === `100`
- `data-testid="pricing-config-form"` present in DOM on `/dashboard/admin/pricing-config`
- Skeleton renders before API responds on initial load
- Successful save shows confirmation without full page reload
- Submit fires `PUT` not `PATCH` (matches live `pricing.js` method)

**Outcome probability:** 90%
**Biggest risk:** `apiClient` import path — confirm from `AdvertiserDashboard.jsx` before writing.

---

### S15-4 · Invoices.jsx (Advertiser UI)

**Pre-checks**
```bash
# 1. Confirm S15-2 back end is live
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/invoices \
  -H "Authorization: Bearer <advertiser-token>"
# Expected: 200

# 2. Confirm role guard pattern in S14 advertiser pages
grep -n "role\|redirect\|navigate" client-app/src/pages/advertiser/AdvertiserDashboard.jsx | head -10

# 3. Confirm /dashboard/advertiser/invoices route is unoccupied
grep -n "invoices" client-app/src/App.jsx
# Expected: no match
```

**`client-app/src/pages/advertiser/Invoices.jsx`** — CREATE
- On mount: `GET /api/invoices` via `apiClient` → advertiser-scoped server-side
- Table columns: Campaign Name, Period, Impressions Delivered, CPM Rate, Total Amount, Actions
- Per-row download button: `data-testid="invoice-download-btn"` — calls `GET /api/invoices/:id/pdf`
- Empty state: "No invoices yet. Invoices are generated by the admin after your campaign completes."
- Skeleton loader during initial fetch
- No hardcoded URLs — uses `apiClient` (GUARDRAIL-6)

**Register in `App.jsx`** — ONLY after `Invoices.jsx` confirmed on disk:
```jsx
// Under // ── Advertiser pages
const Invoices = lazy(() => import('./pages/advertiser/Invoices'));
// Route:
<Route path="invoices" element={<Invoices />} />
```

**GUARDRAIL-1/2 gate**
```bash
find client-app/src/pages/advertiser -name "Invoices.jsx"
# Must return a path before App.jsx lazy import is written
```

**Acceptance criteria**
- `data-testid="invoice-download-btn"` present on each invoice row
- Empty state message renders when `invoices` array is empty
- Skeleton renders on initial load before API responds
- Route `/dashboard/advertiser/invoices` unreachable for role `admin` (guard redirects)

**Outcome probability:** 90%
**Biggest risk:** Role guard pattern — confirm from `AdvertiserDashboard.jsx` pre-check #2.

---

### S15-5 · API_ROUTES.md Update (GUARDRAIL-7 closure)

**Pre-checks**
```bash
grep -n "campaigns\|pricing\|invoices" docs/API_ROUTES.md
# Establish what is already documented vs. what is missing
```

**Rows to add:**

| Method | Path | Auth | Role | File | Sprint |
|---|---|---|---|---|---|
| POST | `/api/campaigns` | ✅ | `advertiser` | `campaigns.js` | S14 |
| GET | `/api/campaigns` | ✅ | `advertiser` (scoped), `admin` (all) | `campaigns.js` | S14 |
| GET | `/api/campaigns/:id` | ✅ | ownership check | `campaigns.js` | S14 |
| PATCH | `/api/campaigns/:id/status` | ✅ | `admin` | `campaigns.js` | S14 |
| GET | `/api/pricing/config` | ✅ | `admin` | `pricing.js` | S15 (hardened) |
| PUT | `/api/pricing/config` | ✅ | `admin` | `pricing.js` | S15 (hardened) |
| GET | `/api/pricing/estimate` | ✅ | any authenticated | `pricing.js` | S15 (new) |
| POST | `/api/invoices/generate` | ✅ | `admin` | `invoices.js` | S15 |
| GET | `/api/invoices` | ✅ | `advertiser` (scoped), `admin` (all) | `invoices.js` | S15 |
| GET | `/api/invoices/:id` | ✅ | ownership check | `invoices.js` | S15 |
| GET | `/api/invoices/:id/pdf` | ✅ | ownership check | `invoices.js` | S15 |

**Note:** method for config update is `PUT` (confirmed from live `pricing.js`), not `PATCH` as originally specced.

**Acceptance criteria:** All 11 rows present before sprint closes.

---

### S15-6 · DATABASE_SCHEMA.md Update (GUARDRAIL-8 closure)

**Add to `docs/DATABASE_SCHEMA.md`:**

**Collection: `pricing_config`** (singleton, doc id = `'default'`)
```
{
  cpm_rates: { [screenType: string]: number },
  allocation: {
    paid: number,      // integer, 0–100
    retailer: number,  // integer, 0–100
    internal: number   // integer, 0–100
    // invariant: paid + retailer + internal === 100
  },
  updated_at: Timestamp,
  updated_by: string   // userId of admin who last updated
}
```

**Collection: `invoices`**
```
{
  invoiceId: string,             // auto-generated
  campaignId: string,
  advertiserId: string,          // copied from campaign.advertiser_id
  impressionsDelivered: number,
  cpmRate: number,
  amount: number,                // impressionsDelivered * cpmRate / 1000
  generatedAt: Timestamp,
  generatedBy: string            // userId of admin who triggered generation
}
```

**Acceptance criteria:** Both collections present before sprint closes.

---

### S15-7 · pricing_billing.spec.js

**Confirmed location:** `ad-server/tests/pricing_billing.spec.js`
**Test runner:** Jest — `ad-server/jest.config.js` confirmed on disk

**Pre-checks**
```bash
# Confirm test directory and naming convention
ls ad-server/tests/
# Confirm jest config test match pattern
grep -n "testMatch\|testRegex" ad-server/jest.config.js
```

Minimum 10 tests:

| # | Test | Expected |
|---|---|---|
| 1 | `GET /api/pricing/config` as admin | `200 { cpm_rates, allocation }` |
| 2 | `GET /api/pricing/config` as retailer | `403` |
| 3 | `GET /api/pricing/config` as advertiser | `403` |
| 4 | `GET /api/pricing/config` with no token | `401` |
| 5 | `PUT /api/pricing/config` with `allocation` summing to 110 | `400 { error: 'Allocation must sum to 100' }` |
| 6 | `PUT /api/pricing/config` with `allocation` summing to 100 | `200` |
| 7 | `GET /api/pricing/estimate?slots=12&cpm=5` | `200 { estimatedCost: '0.0600' }` |
| 8 | `GET /api/pricing/estimate` (no params) | `400` |
| 9 | `POST /api/invoices/generate` as advertiser | `403` |
| 10 | `POST /api/invoices/generate` with a `live` campaign | `400 { error: 'Campaign must be completed' }` |
| 11 | `GET /api/invoices` as advertiser A — does not include advertiser B invoices | `200`, array scoped |
| 12 | `GET /api/pricing/` (existing root) — regression | `200` (stub or config) |
| 13 | `GET /api/pricing/calculate?hour=14` — regression | `200` |

**Outcome probability:** 87%
**Biggest risk:** Firestore emulator availability; mock if unavailable.

---

## 5. Isolation and Blast Radius

| Task | Files | Change Type | Shared Infra? | Can It Break Other Features? | Mitigation |
|---|---|---|---|---|---|
| S15-1 | `pricing.js` (EDIT), optional `PricingService.js` (CREATE) | Additive + security hardening | YES — `pricing.js` serves existing routes | Yes — hardening `GET /config` may break `CPMCalendar.jsx` | Pre-check #1 mandatory: grep `CPMCalendar.jsx` for anonymous calls before editing |
| S15-2 | `invoices.js` (CREATE), `src/api/index.js` (EDIT — one append) | Additive | YES — `index.js` is shared router | Low — append-only; existing routes unaffected | Do not reorder existing `router.use(...)` lines |
| S15-3 | `PricingConfig.jsx` (CREATE), `App.jsx` (EDIT) | Additive | YES — `App.jsx` is shared route table | Low — unoccupied path `/dashboard/admin/pricing-config` | GUARDRAIL-1/2 |
| S15-4 | `Invoices.jsx` (CREATE), `App.jsx` (EDIT) | Additive | YES — `App.jsx` is shared route table | Low — unoccupied path `/dashboard/advertiser/invoices` | GUARDRAIL-1/2 |
| S15-5 | `docs/API_ROUTES.md` | Docs only | No | No | — |
| S15-6 | `docs/DATABASE_SCHEMA.md` | Docs only | No | No | — |
| S15-7 | `ad-server/tests/pricing_billing.spec.js` | Additive | No | No | — |

**Shared infrastructure touched:**
- `ad-server/src/api/index.js` — one append-only `router.use` line for S15-2. No reorder, no removal.
- `ad-server/src/api/pricing.js` — security hardening of two existing handlers + one new handler. Existing `GET /`, `GET /calculate`, `GET /overrides/:date`, `POST /overrides` handlers are NOT touched.
- `client-app/src/App.jsx` — two lazy imports + two new `<Route>` elements appended. No existing route modified.

**Isolation Verdict:** Sprint 15 is predominantly additive. The only genuine cross-cutting risk is the `pricing.js` security hardening in S15-1, which changes the auth posture of `GET /config` and `PUT /config`. This is mitigated by a mandatory pre-check of `CPMCalendar.jsx` before any edit lands.

---

## 6. File Inventory

| File | Operation | Linked Task(s) | State |
|---|---|---|---|
| `ad-server/src/api/pricing.js` | **EDIT** | S15-1 | ✅ Exists — SHA `bcb2566d` |
| `ad-server/src/services/PricingService.js` | CREATE (optional) | S15-1 | ❌ Absent |
| `ad-server/src/api/invoices.js` | CREATE | S15-2 | ❌ Absent |
| `ad-server/src/api/index.js` | EDIT (append one line) | S15-2 | ✅ Exists — SHA `7d5eeb80` |
| `client-app/src/pages/admin/PricingConfig.jsx` | CREATE | S15-3 | ❌ Absent |
| `client-app/src/pages/advertiser/Invoices.jsx` | CREATE | S15-4 | ❌ Absent |
| `ad-server/tests/pricing_billing.spec.js` | CREATE | S15-7 | ❌ Absent |
| `client-app/src/App.jsx` | EDIT | S15-3, S15-4 | ✅ Exists — SHA `e3cb9643` |
| `docs/API_ROUTES.md` | EDIT | S15-5 | ✅ Exists |
| `docs/DATABASE_SCHEMA.md` | EDIT | S15-6 | ✅ Exists |

**No files deleted this sprint.**

---

## 7. Test Stabilization Order

1. Run regression: `GET /api/pricing/` and `GET /api/pricing/calculate` — confirm `200` after S15-1 edits
2. **`ad-server/tests/pricing_billing.spec.js`** — write and pass all 13 tests before marking S15-1 and S15-2 done
3. Run existing campaign-related specs after `src/api/index.js` edit to confirm no regression
4. Manual QA: **PricingConfig.jsx** — verify `disabled` state on save button when sum ≠ 100; verify `PUT` method in network tab
5. Manual QA: **Invoices.jsx** — verify empty state and skeleton; verify wrong-advertiser 403 via direct URL
6. Manual QA: **S11-1** — hard-refresh `UserManagement` form; confirm data persists
7. Manual QA: **S11-2** — hard-refresh `AdvertiserManagement` form; confirm data persists
8. Manual QA: **S11-4** — hard-refresh Add Location form; confirm data persists

---

## 8. Definition of Done

- [ ] Pre-check: `CPMCalendar.jsx` grep run; confirmed no anonymous calls to `GET /api/pricing/config`
- [ ] `GET /api/pricing/config` with no token returns `401`
- [ ] `GET /api/pricing/config` as `retailer` returns `403`
- [ ] `GET /api/pricing/config` as `admin` returns `200`
- [ ] `PUT /api/pricing/config` with allocation summing to 110 returns `400 { error: 'Allocation must sum to 100' }`
- [ ] `PUT /api/pricing/config` as `advertiser` returns `403`
- [ ] `GET /api/pricing/estimate?slots=12&cpm=5` returns `200 { estimatedCost: '0.0600' }`
- [ ] `GET /api/pricing/` regression — still returns `200` after S15-1 edits
- [ ] `ad-server/src/api/invoices.js` exists with `POST /generate`, `GET /`, `GET /:id`, `GET /:id/pdf`
- [ ] `POST /api/invoices/generate` as `advertiser` returns `403`
- [ ] `POST /api/invoices/generate` with a `live` campaign returns `400 { error: 'Campaign must be completed' }`
- [ ] `GET /api/invoices` as advertiser A does not include invoices for advertiser B
- [ ] `router.use('/invoices', authenticate, invoicesRouter)` line present in `src/api/index.js`
- [ ] `client-app/src/pages/admin/PricingConfig.jsx` exists; `data-testid="pricing-config-form"` in DOM
- [ ] `data-testid="pricing-save-btn"` is `disabled` when allocation sum ≠ 100
- [ ] PricingConfig.jsx submits via `PUT` (not `PATCH`) — confirmed in network tab
- [ ] `client-app/src/pages/advertiser/Invoices.jsx` exists; `data-testid="invoice-download-btn"` per row
- [ ] Empty state renders on `Invoices.jsx` when no invoices exist
- [ ] GUARDRAIL-1/2: both component files on disk before `App.jsx` lazy imports added
- [ ] GUARDRAIL-3: `requireRole` grep confirmed on `pricing.js` and `invoices.js`
- [ ] GUARDRAIL-6: no hardcoded `localhost` in `PricingConfig.jsx` or `Invoices.jsx`
- [ ] GUARDRAIL-7: `docs/API_ROUTES.md` updated with all 11 routes (4 S14 + 7 S15); method is `PUT` not `PATCH`
- [ ] GUARDRAIL-8: `docs/DATABASE_SCHEMA.md` updated with `pricing_config` and `invoices` collections
- [ ] `ad-server/tests/pricing_billing.spec.js` — all 13 tests pass

---

## Carry-Overs to Sprint 16

| Item | Type | Priority | Gate |
|---|---|---|---|
| **S11-1** — Super Admin CRUD Users & Retailers persistence test | Manual QA | Critical | Hard-refresh `UserManagement` form |
| **S11-2** — Super Admin CRUD Advertisers persistence test | Manual QA | Critical | Hard-refresh `AdvertiserManagement` form |
| **S11-4** — Add Location persistence test | Manual QA | High | Hard-refresh Add Location form |
| **Firestore composite index** — `campaigns.advertiser_id` | Infra | Medium | Required for `==` query in production |
| **PDF generation** — `GET /api/invoices/:id/pdf` | Feature | Low | Returns JSON stub in S15; real PDF deferred post-MVP |
| **`CampaignDetail.jsx`** impression count | UI | Low | Currently static; wire to real telemetry data post-S15 |
| **`docs/MVP_SPRINT_PLAN.md`** Sprint 13+14 entries | Docs | Low | Add links to sprint13.md and sprint14.md |

---

## Story Point Summary

| Story | Points | Scope |
|---|---|---|
| S15-1 · Pricing API hardening + estimate | 2 | `pricing.js` edits (3 handler changes) |
| S15-2 · Invoice API | 3 | `invoices.js` (4 endpoints) + `index.js` append |
| S15-3 · PricingConfig.jsx | 2 | Admin UI + `App.jsx` registration |
| S15-4 · Invoices.jsx | 2 | Advertiser UI + `App.jsx` registration |
| S15-5 · API_ROUTES.md | 1 | Doc update (S14 debt + S15 routes) |
| S15-6 · DATABASE_SCHEMA.md | 1 | Doc update (2 collections) |
| S15-7 · pricing_billing.spec.js | 2 | 13 tests |
| **Total** | **13** | |

---

*Step 2 spec written: 2026-06-08.*
*Step 4 audit completed: 2026-06-08. Corrections applied: `pricing.js` is EDIT not CREATE; `PUT` not `PATCH`; router target is `src/api/index.js` not `ad-server/index.js`; SEC-S15-5/6 security gaps added; test path confirmed as `ad-server/tests/`.*
*Grounded against: `ad-server/index.js` SHA `7d76dcc2`, `src/api/index.js` SHA `7d5eeb80`, `pricing.js` SHA `bcb2566d`.*
*`LoopGenerationService.js` SHA `cf7c43fa` — `paid > retailer > internal` priority confirmed live; zero patch required.*
*ENUM-AUDIT-3 CLOSED: `'PENDING'` in `LoopGenerationService.js` L110 is slot-init only.*
