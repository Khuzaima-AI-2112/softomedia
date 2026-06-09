# Sprint 15 — Monetization, Pricing Config & Billing

**Sprint:** 15
**Status:** 🔵 In Progress
**Grounded against:** commit `2e3c3bf` (2026-06-08)
**Cross-referenced with:** `client-app/src/App.jsx` (S14 confirmed), `ad-server/src/api/` (S14 confirmed)
**Guardrails authority:** [`docs/sprint8-sre-retro-consolidated.md`](../docs/sprint8-sre-retro-consolidated.md)
**Route authority:** [`docs/API_ROUTES.md`](../docs/API_ROUTES.md)
**Schema authority:** [`docs/DATABASE_SCHEMA.md`](../docs/DATABASE_SCHEMA.md)
**MVP reference:** [`docs/Digital Screen Network Management Platform (MVP).md`](<../docs/Digital Screen Network Management Platform (MVP).md>)
**Completion plan:** [`docs/MVP_COMPLETION_SPRINT_PLAN.md`](../docs/MVP_COMPLETION_SPRINT_PLAN.md)
**Pricing reference:** [`docs/CPM_PRICING_MODEL.md`](../docs/CPM_PRICING_MODEL.md)

---

## Step 1 Findings Summary

All pre-work greps run against commit `2e3c3bf` before any story was written.

| Item | Finding |
|---|---|
| `PricingService.js` | ❌ NOT ON DISK — `find . -path '*PricingService*'` → no match |
| `pricing.js` (API route) | ❌ NOT ON DISK — `grep -rn "pricing" ad-server/src/api/` → no match |
| `invoices.js` (API route) | ❌ NOT ON DISK — `grep -rn "invoice\|billing" ad-server/src/api/` → no match |
| `PricingConfig.jsx` | ❌ NOT ON DISK |
| `Invoices.jsx` | ❌ NOT ON DISK |
| `LoopGenerationService.js` priority | ✅ EXISTS — SHA `cf7c43fa`; `CAMPAIGN_PRIORITY` enum confirmed: `PAID:1, RETAILER:2, INTERNAL:3`; `prioritizeCampaigns()` live — **zero patch required** |
| `CampaignRepository.js` | ✅ EXISTS — confirmed in S14 |
| `App.jsx` | ✅ EXISTS — confirmed in S14 |
| `CPM_PRICING_MODEL.md` | ✅ EXISTS — SHA `7308d142` |
| ENUM-AUDIT-3 | ✅ CLOSED — `'PENDING'` at `LoopGenerationService.js` L110 is slot-init only; isolated from campaign state machine |

**Repo Grounding Score: 91%**
Remaining uncertainty: Firestore emulator availability in test env; `CampaignRepository.findById` method name not re-confirmed in S15 pre-work (confirmed in S14, low risk).

---

## 1. Risk Register

| ID | Description | Area | Status | Evidence |
|---|---|---|---|---|
| RISK-S15-1 | `PricingService.js` created from scratch — no existing interface to inherit | Backend service | 🔴 Active | find → no match at `2e3c3bf` |
| RISK-S15-2 | `invoices.js` created from scratch — no billing infra exists | Backend API | 🔴 Active | grep → no match |
| RISK-S15-3 | S11-1/2/4 persistence QA outstanding for 3 sprints — risk of blocking DoD | QA carry-over | 🟡 Watch | Re-carried from S13, S14 |
| RISK-S15-4 | GUARDRAIL-7 debt from S14 — `API_ROUTES.md` not updated for S14 campaign routes | Docs | 🟡 Active | Confirmed in S14 close-out |
| RISK-S15-5 | Firestore composite index on `campaigns.advertiser_id` not yet created | Infra | 🟡 Deferred | Required for production equality query |
| RISK-S15-6 | `App.jsx` lazy route registered before component file exists (GUARDRAIL-1/2) | Frontend | 🔴 Active | Standard risk for all new page creation |
| RISK-S15-7 | `invoices` collection schema not in `DATABASE_SCHEMA.md` before Firestore write | Docs/Schema | 🟡 Active | GUARDRAIL-8 trigger |

---

## 2. Security Register

| ID | Vector | File(s) | Mitigation | Environment Impact |
|---|---|---|---|---|
| SEC-S15-1 | Advertiser A reads Advertiser B invoices via `GET /api/invoices/:id` | `invoices.js` | Ownership check: `invoice.advertiser_id !== req.user.linked_entity_id → 403` | All envs |
| SEC-S15-2 | `advertiser_id` spoofing on invoice generation | `invoices.js` | `advertiser_id` stamped server-side from campaign record, not from request body | All envs |
| SEC-S15-3 | Unauthorised CPM config write | `pricing.js` | `requireRole('admin')` on `PATCH /api/pricing/config` — advertiser/retailer → 403 | All envs |
| SEC-S15-4 | Allocation bypass — floating-point sum | `PricingService.js` | Validate `paid + retailer + internal === 100` (integer math) before persist | All envs |

---

## 3. Task Map

| Task | Files Touched | Change Type | Estimated Effort | Outcome Probability | Biggest Risk |
|---|---|---|---|---|---|
| S15-1 · Pricing Service + Config API | `PricingService.js` (NEW), `pricing.js` (NEW), server router (PATCH) | Additive | 3 pts | 88% | PricingService created from scratch; Firestore singleton doc pattern untested in this codebase |
| S15-2 · Invoice Generation + Access API | `invoices.js` (NEW), server router (PATCH) | Additive | 3 pts | 86% | `CampaignRepository.findById` method name assumed from S14 (not re-confirmed in S15 pre-work) |
| S15-3 · PricingConfig.jsx | `PricingConfig.jsx` (NEW), `App.jsx` (PATCH) | Additive | 2 pts | 90% | Must not register route before file exists (GUARDRAIL-1) |
| S15-4 · Invoices.jsx | `Invoices.jsx` (NEW), `App.jsx` (PATCH) | Additive | 2 pts | 90% | Must not register route before file exists (GUARDRAIL-1) |
| S15-5 · API_ROUTES.md Update | `docs/API_ROUTES.md` (EDIT) | Docs | 1 pt | 99% | Manual omission |
| S15-6 · DATABASE_SCHEMA.md Update | `docs/DATABASE_SCHEMA.md` (EDIT) | Docs | 1 pt | 99% | Manual omission |
| S15-7 · pricing_billing.spec.js | `pricing_billing.spec.js` (NEW) | Additive | 2 pts | 87% | Firestore emulator availability in test env |

---

## 4. Full Task Details

---

### S15-1 · Pricing Service + Config API

**Pre-checks**
```bash
# Confirm PricingService.js still absent
find ad-server/src/services -name "PricingService.js"
# Expect: no output

# Confirm CPM_PRICING_MODEL.md exists
ls docs/CPM_PRICING_MODEL.md
# Expect: docs/CPM_PRICING_MODEL.md

# Confirm server router entry point
find ad-server/src -name "index.js" -o -name "server.js" -o -name "app.js" | head -5
# Identify where app.use() calls are registered
```

**Files to create / edit**

**`ad-server/src/services/PricingService.js`** — CREATE
- `getConfig()` → reads singleton `pricing_config` doc (id = `'default'`) from Firestore; returns `{ cpm_rates: { [screenType]: number }, allocation: { paid, retailer, internal } }`
- `updateConfig(patch)` → if `patch.allocation` present, validates `patch.allocation.paid + patch.allocation.retailer + patch.allocation.internal === 100`; throws `{ status: 400, message: 'Allocation must sum to 100' }` on violation; merges patch; persists; returns updated config
- `estimateCost({ slots, cpm })` → returns `{ estimatedCost: (slots * cpm / 1000).toFixed(4) }`
- Config collection: `pricing_config`, document id: `'default'`

**`ad-server/src/api/pricing.js`** — CREATE
```
GET  /api/pricing/config    requireAuth + requireRole('admin')   → 200 { cpm_rates, allocation } | 403
PATCH /api/pricing/config   requireAuth + requireRole('admin')   → 200 | 400 | 403
GET  /api/pricing/estimate  requireAuth (any role)               → 200 { estimatedCost } | 400
```
- `GET /config`: calls `PricingService.getConfig()`
- `PATCH /config`: calls `PricingService.updateConfig(req.body)`; surfaces 400 from service
- `GET /estimate`: validates `req.query.slots` and `req.query.cpm` present; returns `400 { error: 'slots and cpm are required' }` if either missing; calls `PricingService.estimateCost()`

**Register in server router:**
```js
import pricingRouter from './api/pricing.js';
app.use('/api/pricing', pricingRouter);
```

**Acceptance criteria (all falsifiable)**
- `PATCH /api/pricing/config` `{ allocation: { paid: 60, retailer: 30, internal: 20 } }` → `400 { error: 'Allocation must sum to 100' }`
- `PATCH /api/pricing/config` `{ allocation: { paid: 60, retailer: 30, internal: 10 } }` → `200`
- `GET /api/pricing/config` as role `retailer` → `403`
- `GET /api/pricing/config` as role `advertiser` → `403`
- `GET /api/pricing/estimate?slots=12&cpm=5` → `200 { estimatedCost: '0.0600' }`
- `GET /api/pricing/estimate` (no params) → `400`

**Post-implementation verification**
```bash
grep -n "requireRole\|requireAuth" ad-server/src/api/pricing.js
# Expected: requireRole('admin') on GET /config + PATCH /config; requireAuth on GET /estimate
```

**Outcome probability:** 88%
**Biggest risk:** Firestore singleton doc pattern — confirm `db.collection('pricing_config').doc('default').set(data, { merge: true })` works with the existing Firestore client initialisation before writing.

---

### S15-2 · Invoice Generation + Access API

**Pre-checks**
```bash
# Confirm invoices.js absent
find ad-server/src/api -name "invoices.js"
# Expect: no output

# Confirm CampaignRepository method name
grep -n "findById\|findByPk\|getById" ad-server/src/repositories/CampaignRepository.js
# Confirm exact method name before coding the generate handler

# Confirm JWT payload shape (linked_entity_id present)
grep -n "linked_entity_id" ad-server/src/services/AuthService.js
```

**`ad-server/src/api/invoices.js`** — CREATE
```
POST /api/invoices/generate    requireAuth + requireRole('admin')   → 201 | 400 | 403
GET  /api/invoices             requireAuth                          → 200 { invoices, total, page }
GET  /api/invoices/:id         requireAuth                          → 200 | 403 | 404
GET  /api/invoices/:id/pdf     requireAuth                          → 200 (JSON stub) | 403
```

**`POST /api/invoices/generate` logic:**
1. `requireRole('admin')` — non-admin → `403`
2. Validate `req.body.campaignId` present → `400 { error: 'campaignId is required' }` if absent
3. `campaign = await CampaignRepository.findById(req.body.campaignId)` → `404` if not found
4. `if (campaign.status !== 'completed') return res.status(400).json({ error: 'Campaign must be completed' })`
5. `amount = (campaign.impressionsDelivered ?? 0) * cpmRate / 1000` — fetch `cpmRate` from `PricingService.getConfig()` using campaign screen type
6. Persist to `invoices` Firestore collection
7. Return `201 { invoiceId, campaignId, impressionsDelivered, cpmRate, amount, generatedAt }`

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

**Register in server router:**
```js
import invoicesRouter from './api/invoices.js';
app.use('/api/invoices', invoicesRouter);
```

**Acceptance criteria**
- `POST /api/invoices/generate` as role `advertiser` → `403`
- `POST /api/invoices/generate` with `campaignId` of a `live` campaign → `400 { error: 'Campaign must be completed' }`
- `POST /api/invoices/generate` with `campaignId` of a `completed` campaign → `201 { invoiceId }`
- `GET /api/invoices` as advertiser A → does NOT include invoices for advertiser B
- `GET /api/invoices/:id` as wrong advertiser → `403`
- `GET /api/invoices/:id/pdf` as wrong advertiser → `403`

**Post-implementation verification**
```bash
grep -n "requireRole\|requireAuth\|linked_entity_id" ad-server/src/api/invoices.js
# Expected: requireRole('admin') on POST /generate; linked_entity_id ownership check on GET routes
```

**Outcome probability:** 86%
**Biggest risk:** `CampaignRepository` method name — confirm via pre-check grep before writing handler. Do not assume `findById` without confirming.

---

### S15-3 · PricingConfig.jsx (Admin UI)

**Pre-checks**
```bash
# Confirm S15-1 back end is live before writing UI
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/pricing/config \
  -H "Authorization: Bearer <admin-token>"
# Expected: 200

# Confirm admin pages directory
ls client-app/src/pages/admin/
```

**`client-app/src/pages/admin/PricingConfig.jsx`** — CREATE
- On mount: `GET /api/pricing/config` via `apiClient` → populates form state
- CPM rate inputs: one `<input type="number" step="0.01">` per screen type returned by API
- Allocation inputs: three number inputs (`paid`, `retailer`, `internal`), range 0–100
- Live sum badge: shows `paid + retailer + internal`; badge class `error` when sum ≠ 100
- Save button: `data-testid="pricing-save-btn"` — `disabled` attribute set when sum ≠ 100
- Submit: `PATCH /api/pricing/config` → success toast (inline, no page reload) / inline error on 400
- Skeleton loader during initial fetch
- `data-testid="pricing-config-form"` on the `<form>` element
- No hardcoded URLs — uses `apiClient` (GUARDRAIL-6)

**Register in `App.jsx`** — only after `PricingConfig.jsx` confirmed on disk:
```jsx
// Under // ── Admin pages
const PricingConfig = lazy(() => import('./pages/admin/PricingConfig'));
// Route:
<Route path="/dashboard/admin/pricing" element={<PricingConfig />} />
```

**Acceptance criteria**
- `data-testid="pricing-save-btn"` has `disabled` attribute when `paid + retailer + internal ≠ 100`
- `data-testid="pricing-save-btn"` does NOT have `disabled` when sum equals exactly `100`
- `data-testid="pricing-config-form"` present in DOM on `/dashboard/admin/pricing`
- Skeleton renders before API responds on initial load
- Successful save shows confirmation feedback without full page reload

**GUARDRAIL-1/2 gate**
```bash
find client-app/src/pages/admin -name "PricingConfig.jsx"
# Must return a result before App.jsx lazy import is written
```

**Outcome probability:** 90%
**Biggest risk:** `apiClient` import path — confirm it matches the pattern used in `AdvertiserDashboard.jsx` (S14).

---

### S15-4 · Invoices.jsx (Advertiser UI)

**Pre-checks**
```bash
# Confirm S15-2 back end is live
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/invoices \
  -H "Authorization: Bearer <advertiser-token>"
# Expected: 200

# Confirm advertiser pages directory
ls client-app/src/pages/advertiser/
```

**`client-app/src/pages/advertiser/Invoices.jsx`** — CREATE
- On mount: `GET /api/invoices` via `apiClient` → advertiser-scoped server-side
- Table columns: Campaign Name, Period, Impressions Delivered, CPM Rate, Total Amount, Actions
- Per-row download button: `data-testid="invoice-download-btn"` — calls `GET /api/invoices/:id/pdf`
- Empty state: "No invoices yet. Invoices are generated by the admin after your campaign completes."
- Skeleton loader during initial fetch
- No hardcoded URLs — uses `apiClient` (GUARDRAIL-6)

**Register in `App.jsx`** — only after `Invoices.jsx` confirmed on disk:
```jsx
// Under // ── Advertiser pages
const Invoices = lazy(() => import('./pages/advertiser/Invoices'));
// Route:
<Route path="/dashboard/advertiser/invoices" element={<Invoices />} />
```

**Acceptance criteria**
- `data-testid="invoice-download-btn"` present on each invoice row
- Empty state message renders when `invoices` array is empty
- Skeleton renders on initial load before API responds
- Route `/dashboard/advertiser/invoices` unreachable for role `admin` (guard redirects)

**GUARDRAIL-1/2 gate**
```bash
find client-app/src/pages/advertiser -name "Invoices.jsx"
# Must return a result before App.jsx lazy import is written
```

**Outcome probability:** 90%
**Biggest risk:** Role guard pattern — confirm how `AdvertiserDashboard.jsx` (S14) enforces role redirect; replicate identically.

---

### S15-5 · API_ROUTES.md Update (GUARDRAIL-7 closure)

**Pre-checks**
```bash
# Confirm current state of API_ROUTES.md
grep -n "campaigns\|pricing\|invoices" docs/API_ROUTES.md
# Establish what is already documented vs. what is missing
```

**Exact rows to add to `docs/API_ROUTES.md`:**

| Method | Path | Auth | Role | File | Sprint |
|---|---|---|---|---|---|
| POST | `/api/campaigns` | ✅ | `advertiser` | `campaigns.js` | S14 |
| GET | `/api/campaigns` | ✅ | `advertiser` (scoped), `admin` (all) | `campaigns.js` | S14 |
| GET | `/api/campaigns/:id` | ✅ | ownership check | `campaigns.js` | S14 |
| PATCH | `/api/campaigns/:id/status` | ✅ | `admin` | `campaigns.js` | S14 |
| GET | `/api/pricing/config` | ✅ | `admin` | `pricing.js` | S15 |
| PATCH | `/api/pricing/config` | ✅ | `admin` | `pricing.js` | S15 |
| GET | `/api/pricing/estimate` | ✅ | any authenticated | `pricing.js` | S15 |
| POST | `/api/invoices/generate` | ✅ | `admin` | `invoices.js` | S15 |
| GET | `/api/invoices` | ✅ | `advertiser` (scoped), `admin` (all) | `invoices.js` | S15 |
| GET | `/api/invoices/:id` | ✅ | ownership check | `invoices.js` | S15 |
| GET | `/api/invoices/:id/pdf` | ✅ | ownership check | `invoices.js` | S15 |

**Acceptance criteria:** All 11 rows present in `docs/API_ROUTES.md` before sprint closes.

**Outcome probability:** 99%
**Biggest risk:** Manual omission of one row.

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

**Acceptance criteria:** Both collections present in `docs/DATABASE_SCHEMA.md` before sprint closes.

**Outcome probability:** 99%
**Biggest risk:** Manual omission.

---

### S15-7 · pricing_billing.spec.js

**Pre-checks**
```bash
# Confirm test runner and config
find . -name "jest.config*" -o -name "vitest.config*" | grep -v node_modules
# Confirm test file naming convention
ls ad-server/tests/ 2>/dev/null || ls ad-server/src/__tests__/ 2>/dev/null
```

**`pricing_billing.spec.js`** — CREATE (place alongside existing spec files)

Minimum 10 tests:

| # | Test | Expected |
|---|---|---|
| 1 | `GET /api/pricing/config` as admin | `200 { cpm_rates, allocation }` |
| 2 | `GET /api/pricing/config` as retailer | `403` |
| 3 | `GET /api/pricing/config` as advertiser | `403` |
| 4 | `PATCH /api/pricing/config` with `allocation` summing to 110 | `400 { error: 'Allocation must sum to 100' }` |
| 5 | `PATCH /api/pricing/config` with `allocation` summing to 100 | `200` |
| 6 | `GET /api/pricing/estimate?slots=12&cpm=5` | `200 { estimatedCost: '0.0600' }` |
| 7 | `GET /api/pricing/estimate` (no params) | `400` |
| 8 | `POST /api/invoices/generate` as advertiser | `403` |
| 9 | `POST /api/invoices/generate` with a `live` campaign | `400 { error: 'Campaign must be completed' }` |
| 10 | `GET /api/invoices` as advertiser A — response does not include advertiser B invoices | `200`, array scoped |

**Outcome probability:** 87%
**Biggest risk:** Firestore emulator availability in test environment; mock it if emulator not available.

---

## 5. Isolation and Blast Radius

| Task | Files | Change Type | Can It Break Anything Else? | Why / Mitigation |
|---|---|---|---|---|
| S15-1 | `PricingService.js` (NEW), `pricing.js` (NEW), server router (PATCH) | Additive | No — new service and route; router patch is append-only | Existing routes unaffected; no shared service mutation |
| S15-2 | `invoices.js` (NEW), server router (PATCH) | Additive | No — new route; reads `CampaignRepository` read-only in GET; write only to new `invoices` collection | `CampaignRepository` not modified; `campaigns` collection not written |
| S15-3 | `PricingConfig.jsx` (NEW), `App.jsx` (PATCH) | Additive | Low — `App.jsx` patch adds 1 lazy import + 1 route; no existing routes modified | GUARDRAIL-1/2: file must exist before route registered |
| S15-4 | `Invoices.jsx` (NEW), `App.jsx` (PATCH) | Additive | Low — same as S15-3 | GUARDRAIL-1/2: file must exist before route registered |
| S15-5 | `docs/API_ROUTES.md` (EDIT) | Docs only | No | Documentation change only |
| S15-6 | `docs/DATABASE_SCHEMA.md` (EDIT) | Docs only | No | Documentation change only |
| S15-7 | `pricing_billing.spec.js` (NEW) | Additive | No | Test file only; no production code touched |

**Shared infrastructure touched:**
- `App.jsx` — two patches (S15-3, S15-4). Each is an append-only lazy import + route. No existing route modified. Blast radius: if a lazy import path is wrong, only the new route 404s; no existing routes affected.
- `CampaignRepository.js` — read-only usage in S15-2 (`findById`). No writes. No schema change.

**Isolation Verdict:** Sprint 15 is fully additive. No existing routes, services, or components are modified. The only shared-infrastructure touch is two append-only additions to `App.jsx`. Risk of cross-feature regression is minimal, gated by GUARDRAIL-1/2 file-existence checks.

---

## 6. File Inventory

| File | Operation | Linked Task(s) |
|---|---|---|
| `ad-server/src/services/PricingService.js` | CREATE | S15-1 |
| `ad-server/src/api/pricing.js` | CREATE | S15-1 |
| `ad-server/src/api/invoices.js` | CREATE | S15-2 |
| `client-app/src/pages/admin/PricingConfig.jsx` | CREATE | S15-3 |
| `client-app/src/pages/advertiser/Invoices.jsx` | CREATE | S15-4 |
| `pricing_billing.spec.js` | CREATE | S15-7 |
| `client-app/src/App.jsx` | EDIT | S15-3, S15-4 |
| `docs/API_ROUTES.md` | EDIT | S15-5 |
| `docs/DATABASE_SCHEMA.md` | EDIT | S15-6 |

**No files deleted this sprint.**

---

## 7. Test Stabilization Order

1. **`pricing_billing.spec.js`** — new file; write and pass before marking S15-1 and S15-2 done
2. Run existing campaign-related specs after `App.jsx` patch to confirm no regression
3. Manual QA: **S11-1** — hard-refresh `UserManagement` form; confirm data persists
4. Manual QA: **S11-2** — hard-refresh `AdvertiserManagement` form; confirm data persists
5. Manual QA: **S11-4** — hard-refresh Add Location form; confirm data persists
6. Manual QA: **PricingConfig.jsx** — verify `disabled` state on save button when sum ≠ 100
7. Manual QA: **Invoices.jsx** — verify empty state and skeleton render; verify wrong-advertiser 403 via direct URL

---

## 8. Definition of Done

- [ ] `ad-server/src/services/PricingService.js` exists on disk with `getConfig`, `updateConfig`, `estimateCost` methods
- [ ] `ad-server/src/api/pricing.js` exists with `GET /config`, `PATCH /config`, `GET /estimate` endpoints
- [ ] `PATCH /api/pricing/config` with allocation summing to 110 returns `400 { error: 'Allocation must sum to 100' }`
- [ ] `GET /api/pricing/config` as role `advertiser` returns `403`
- [ ] `GET /api/pricing/estimate?slots=12&cpm=5` returns `200 { estimatedCost: '0.0600' }`
- [ ] `ad-server/src/api/invoices.js` exists with `POST /generate`, `GET /`, `GET /:id`, `GET /:id/pdf` endpoints
- [ ] `POST /api/invoices/generate` as role `advertiser` returns `403`
- [ ] `POST /api/invoices/generate` with a `live` campaign returns `400 { error: 'Campaign must be completed' }`
- [ ] `GET /api/invoices` as advertiser A does not include invoices for advertiser B
- [ ] `client-app/src/pages/admin/PricingConfig.jsx` exists; `data-testid="pricing-config-form"` present in DOM
- [ ] `data-testid="pricing-save-btn"` is `disabled` when allocation sum ≠ 100
- [ ] `client-app/src/pages/advertiser/Invoices.jsx` exists; `data-testid="invoice-download-btn"` present per row
- [ ] Empty state renders on `Invoices.jsx` when no invoices exist
- [ ] `App.jsx` has lazy imports and routes for `/dashboard/admin/pricing` and `/dashboard/advertiser/invoices`
- [ ] GUARDRAIL-1/2: both component files confirmed on disk before `App.jsx` routes registered
- [ ] GUARDRAIL-3: `requireRole` grep run and confirmed on `pricing.js` and `invoices.js`
- [ ] GUARDRAIL-6: no hardcoded `localhost` in `PricingConfig.jsx` or `Invoices.jsx`
- [ ] GUARDRAIL-7: `docs/API_ROUTES.md` updated with all 11 routes (4 S14 + 7 S15)
- [ ] GUARDRAIL-8: `docs/DATABASE_SCHEMA.md` updated with `pricing_config` and `invoices` collections
- [ ] `pricing_billing.spec.js` all 10 tests pass

---

## Carry-Overs to Sprint 16

| Item | Type | Priority | Gate |
|---|---|---|---|
| **S11-1** — Super Admin CRUD Users & Retailers persistence test | Manual QA | Critical | Hard-refresh `UserManagement` form; confirm data survives |
| **S11-2** — Super Admin CRUD Advertisers persistence test | Manual QA | Critical | Hard-refresh `AdvertiserManagement` form; confirm data survives |
| **S11-4** — Add Location persistence test | Manual QA | High | Hard-refresh Add Location form; confirm data survives |
| **Firestore composite index** — `campaigns.advertiser_id` | Infra | Medium | Required for `==` query in production; verify on first Firestore deployment |
| **PDF generation** — `GET /api/invoices/:id/pdf` | Feature | Low | Returns JSON stub in S15; real PDF deferred post-MVP |
| **`CampaignDetail.jsx`** impression count | UI | Low | Currently static; wire to real telemetry data post-S15 |
| **`docs/MVP_SPRINT_PLAN.md`** Sprint 13+14 entries | Docs | Low | Add links to `current_sprint/sprint13.md` and `current_sprint/sprint14.md` |

---

## Story Point Summary

| Story | Points | Scope |
|---|---|---|
| S15-1 · Pricing Service + API | 3 | `PricingService.js` + `pricing.js` (3 endpoints) |
| S15-2 · Invoice API | 3 | `invoices.js` (4 endpoints) |
| S15-3 · PricingConfig.jsx | 2 | Admin UI + `App.jsx` registration |
| S15-4 · Invoices.jsx | 2 | Advertiser UI + `App.jsx` registration |
| S15-5 · API_ROUTES.md | 1 | Doc update (S14 debt + S15 routes) |
| S15-6 · DATABASE_SCHEMA.md | 1 | Doc update (2 collections) |
| S15-7 · pricing_billing.spec.js | 2 | 10 tests |
| **Total** | **14** | |

---

*Step 2 spec written: 2026-06-08.*
*Grounded against commit `2e3c3bf`. All file existence confirmed via pre-work grep (see `docs/sprint15.md`).*
*`LoopGenerationService.js` SHA `cf7c43fa` — `paid > retailer > internal` priority confirmed live; zero patch required.*
*ENUM-AUDIT-3 CLOSED: `'PENDING'` in `LoopGenerationService.js` L110 is slot-init only.*
