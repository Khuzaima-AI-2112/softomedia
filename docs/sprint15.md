# Sprint 15 — Monetization, Pricing Config & Billing

**MVP Requirement**: §3.1 monetization rules; §4.2 campaign priority rules (paid vs retailer vs
internal); `CPM_PRICING_MODEL.md` pricing logic surfaced in UI; §3.4 advertiser invoice access.

**Duration**: 3 days
**Status**: 🔵 In Progress
**Grounded against**: commit `2e3c3bf` (2026-06-08)

---

## Pre-Work Discovery Results

> All findings below were verified against the live repo at `2e3c3bf` before writing a single
> story. No file is assumed to exist unless confirmed here.

### `PricingService.js`

```
find . -path '*PricingService*' | grep -v node_modules
→ NO MATCH — PricingService.js does NOT exist on disk
```

**Impact**: `pricing.js` API route cannot import a pre-existing service. S15-1 must create
`PricingService.js` from scratch alongside `pricing.js`.

### `LoopGenerationService.js` — Priority Order

```
SHA: cf7c43fa6b7b35509ac590c0e6c7f8249a2669cb  (7119 B)
```

Priority already enforced — **no patch required**:

```js
// Line 21–25
export const CAMPAIGN_PRIORITY = {
    PAID: 1,        // Paid advertiser campaigns
    RETAILER: 2,    // Retailer-owned promotions
    INTERNAL: 3     // Softomedia internal/filler
};
// Line 98–103 — prioritizeCampaigns() sorts by CAMPAIGN_PRIORITY[a.type.toUpperCase()]
```

`paid > retailer > internal` is live. S15 has zero work to do on `LoopGenerationService.js`.

### Invoice / Billing Routes

```
grep -rn "invoice|billing|payment" ad-server/src/api/ --include="*.js"
→ NO MATCH — invoices.js does NOT exist on disk
```

`invoices.js` must be created from scratch.

### ENUM-AUDIT-3 — CLOSED HERE

```
grep -rn "'APPROVED'|'PENDING'" (equivalent search across services/)
```

Found in `LoopGenerationService.js` → `buildSlots()` L110:
```js
status: 'PENDING'   // uppercase string literal
```

This is a **slot-level status** (not campaign status). It is cosmetically uppercase but
semantically distinct from campaign `APPROVED`/`PENDING_APPROVAL`. No collision with
`CampaignRepository` status transitions confirmed in S14. ENUM-AUDIT-3 is **CLOSED**:
the uppercase `'PENDING'` string is intentional (slot initialisation only) and isolated
from the campaign state machine.

---

## Known File Inventory (S15 scope)

| File | Status | SHA / Evidence |
|------|--------|----------------|
| `ad-server/src/services/LoopGenerationService.js` | ✅ EXISTS | `cf7c43fa` — priority confirmed |
| `ad-server/src/services/PricingService.js` | ❌ NOT ON DISK | find → no match → CREATE |
| `ad-server/src/api/pricing.js` | ❌ NOT ON DISK | grep → no match → CREATE |
| `ad-server/src/api/invoices.js` | ❌ NOT ON DISK | grep → no match → CREATE |
| `ad-server/src/repositories/CampaignRepository.js` | ✅ EXISTS | confirmed S14 |
| `client-app/src/pages/admin/PricingConfig.jsx` | ❌ NOT ON DISK | CREATE |
| `client-app/src/pages/advertiser/Invoices.jsx` | ❌ NOT ON DISK | CREATE |
| `client-app/src/App.jsx` | ✅ EXISTS | confirmed S14 |
| `docs/API_ROUTES.md` | ✅ EXISTS | `fcbd5a48` — needs S14+S15 updates (GUARDRAIL-7) |
| `docs/CPM_PRICING_MODEL.md` | ✅ EXISTS | `7308d142` |

---

## Carry-Over Pre-Conditions

These must be verified/closed before S15 code is merged:

- [ ] **S11-1/2/4 Persistence QA** — Manual hard-refresh test on 3 forms (retailer loop creation,
      schedule form, add location form). Outstanding since S13.
- [x] **ENUM-AUDIT-3** — CLOSED above. `'PENDING'` in `LoopGenerationService.js` L110 is
      intentional slot-init string, isolated from campaign state machine.
- [ ] **GUARDRAIL-7 S14 debt** — `API_ROUTES.md` was not updated in S14 for `POST/GET/PATCH
      /api/campaigns`. Must be updated in this sprint alongside S15 routes.
- [ ] **Firestore composite index** — `campaigns.advertiser_id` index (deployment-time item,
      flag for ops).

---

## Guardrail Gates Active This Sprint

| # | Rule | S15 trigger |
|---|------|-------------|
| GUARDRAIL-1 | Every `lazy()` in `App.jsx` needs a verified file on disk | `PricingConfig.jsx` and `Invoices.jsx` must exist before route registration |
| GUARDRAIL-2 | No route without component file | Same as above |
| GUARDRAIL-3 | `requireRole` grep after every auth-adjacent change | After `pricing.js` and `invoices.js` are created |
| GUARDRAIL-6 | No hardcoded `localhost` URLs | `PricingConfig.jsx` and `Invoices.jsx` must use `apiClient` |
| GUARDRAIL-7 | `API_ROUTES.md` updated same sprint as new routes | **Mandatory** — S14 debt + S15 new routes both close here |
| GUARDRAIL-8 | `DATABASE_SCHEMA.md` updated if new fields added | `pricing_config` collection and `invoices` collection need schema entries |
| GUARDRAIL-10 | No decision deferred > 2 consecutive sprints | ENUM-AUDIT-3 **closed above**. Watch for any new deferrals. |

---

## Dependency Map

```
CPM_PRICING_MODEL.md
        │
        ▼
PricingService.js (NEW)
        │
        ├──▶ pricing.js (NEW)  ──▶  PricingConfig.jsx (NEW)  ──▶  App.jsx (PATCH)
        │
CampaignRepository.js (EXISTS, S14)
        │
        ▼
invoices.js (NEW)  ──▶  Invoices.jsx (NEW)  ──▶  App.jsx (PATCH)
```

---

## Stories

---

### S15-1 · Pricing Service + Config API

**Scope**: Create `PricingService.js` and `pricing.js`. Expose CPM config read/write and
cost estimation.

**Pre-condition**: `CPM_PRICING_MODEL.md` exists (`7308d142`). `PricingService.js` not on disk.

#### Server deliverables

**`ad-server/src/services/PricingService.js`** — NEW
- `getConfig()` → returns `{ cpm_rates: { [screenType]: number }, allocation: { paid, retailer, internal } }`
- `updateConfig(patch)` → validates that `patch.allocation.paid + retailer + internal === 100`;
  throws `ValidationError` if not; persists and returns updated config
- `estimateCost({ slots, cpm })` → returns `{ estimatedCost: (slots * cpm / 1000).toFixed(4) }`
- Config persisted in a `pricing_config` Firestore document (singleton doc, id = `'default'`)

**`ad-server/src/api/pricing.js`** — NEW
- `GET /api/pricing/config`
  - Guard: `requireAuth` + `requireRole('admin')`
  - Returns `200 { cpm_rates, allocation }`
  - Returns `403` for all other roles
- `PATCH /api/pricing/config`
  - Guard: `requireAuth` + `requireRole('admin')`
  - Body: `{ cpm_rates?: { [screenType]: number }, allocation?: { paid, retailer, internal } }`
  - Validation: if `allocation` present, `paid + retailer + internal` must equal `100`
  - Returns `400 { error: 'Allocation must sum to 100' }` on violation
  - Returns `200 { cpm_rates, allocation }` on success
- `GET /api/pricing/estimate`
  - Guard: `requireAuth` (advertiser + admin both allowed)
  - Query params: `?slots=N&cpm=X`
  - Returns `200 { estimatedCost: number }`
  - Returns `400 { error: 'slots and cpm are required' }` if params missing

**Register in server router**: `import pricingRouter from './api/pricing.js'` +
`app.use('/api/pricing', pricingRouter)`

#### Acceptance Criteria

- `PATCH /api/pricing/config` body `{ allocation: { paid: 60, retailer: 30, internal: 20 } }` → `400 { error: 'Allocation must sum to 100' }`
- `PATCH /api/pricing/config` body `{ allocation: { paid: 60, retailer: 30, internal: 10 } }` → `200`
- `GET /api/pricing/config` as role `retailer` → `403`
- `GET /api/pricing/config` as role `advertiser` → `403`
- `GET /api/pricing/estimate?slots=12&cpm=5` → `200 { estimatedCost: '0.0600' }`
- `GET /api/pricing/estimate` (no params) → `400`

#### Post-implementation grep
```bash
grep -n "requireRole\|requireAuth" ad-server/src/api/pricing.js
# Expected: requireRole('admin') on GET+PATCH /config; requireAuth on /estimate
```

---

### S15-2 · Invoice Generation + Access API

**Scope**: Create `invoices.js`. Admin generates invoices for completed campaigns; advertisers
view their own.

**Pre-condition**: `CampaignRepository.js` exists (S14). `invoices.js` not on disk.

#### Server deliverables

**`ad-server/src/api/invoices.js`** — NEW
- `POST /api/invoices/generate`
  - Guard: `requireAuth` + `requireRole('admin')`
  - Body: `{ campaignId }`
  - Fetches campaign from `CampaignRepository.findById(campaignId)`
  - Validates campaign `status === 'completed'`; returns `400 { error: 'Campaign must be completed' }` if not
  - Calculates `amount = impressionsDelivered * cpmRate / 1000`
  - Persists invoice doc to `invoices` Firestore collection
  - Returns `201 { invoiceId, campaignId, impressionsDelivered, cpmRate, amount, generatedAt }`
- `GET /api/invoices`
  - Guard: `requireAuth`
  - If role `advertiser`: returns only invoices where `advertiser_id === req.user.linked_entity_id`
  - If role `admin` or `superadmin`: returns all invoices (paginated, `?page=&limit=`)
  - Returns `200 { invoices: [], total, page }`
- `GET /api/invoices/:id`
  - Guard: `requireAuth`
  - If role `advertiser` and invoice `advertiser_id !== req.user.linked_entity_id` → `403`
  - Returns `200 { invoice }` or `404`
- `GET /api/invoices/:id/pdf`
  - Guard: `requireAuth`
  - Same ownership check as above
  - Returns a JSON summary (PDF generation is out of scope for MVP; returns `200 { message: 'PDF generation not yet available', invoiceData: {...} }`)
  - **Note**: Real PDF blob deferred to post-MVP. This endpoint establishes the contract.

**Register in server router**: `import invoicesRouter from './api/invoices.js'` +
`app.use('/api/invoices', invoicesRouter)`

#### Acceptance Criteria

- `POST /api/invoices/generate` as role `advertiser` → `403`
- `POST /api/invoices/generate` with `campaignId` of a `live` campaign → `400 { error: 'Campaign must be completed' }`
- `POST /api/invoices/generate` with `campaignId` of a `completed` campaign → `201 { invoiceId }`
- `GET /api/invoices` as advertiser A → does NOT include invoices for advertiser B
- `GET /api/invoices/:id` as wrong advertiser → `403`
- `GET /api/invoices/:id/pdf` as wrong advertiser → `403`

#### Post-implementation grep
```bash
grep -n "requireRole\|requireAuth\|linked_entity_id" ad-server/src/api/invoices.js
# Expected: requireRole('admin') on POST /generate; ownership check using linked_entity_id
```

---

### S15-3 · PricingConfig.jsx (Admin UI)

**Scope**: Admin page to read and update CPM rates and allocation percentages.

**Pre-condition**: `GET/PATCH /api/pricing/config` live (S15-1). File not on disk.

**`client-app/src/pages/admin/PricingConfig.jsx`** — NEW
- On mount: `GET /api/pricing/config` → populates form
- CPM rate inputs per screen type (one `<input type="number">` per type returned by API)
- Allocation sliders for `paid`, `retailer`, `internal` (0–100)
- Live validation: sum of three sliders shown as badge; badge turns red when sum ≠ 100
- `data-testid="pricing-save-btn"` — `disabled` attribute present when sum ≠ 100
- On submit: `PATCH /api/pricing/config` → success toast / inline error
- Skeleton loader while fetching
- `data-testid="pricing-config-form"`
- Uses `apiClient` (no hardcoded URLs — GUARDRAIL-6)

**Register in `App.jsx`**:
```jsx
const PricingConfig = lazy(() => import('./pages/admin/PricingConfig'));
// Route: /dashboard/admin/pricing  — requireRole('admin') guard
```

#### Acceptance Criteria

- `data-testid="pricing-save-btn"` is `disabled` when `paid + retailer + internal ≠ 100`
- `data-testid="pricing-save-btn"` is **enabled** when sum equals exactly `100`
- `data-testid="pricing-config-form"` present in DOM
- Skeleton renders on initial load before API responds
- Successful save shows toast/confirmation without full page reload

#### GUARDRAIL-1/2 check
```bash
find client-app/src/pages/admin -name "PricingConfig.jsx"
# Must return a match before App.jsx route is registered
```

---

### S15-4 · Invoices.jsx (Advertiser UI)

**Scope**: Advertiser page to view their invoices and access invoice detail.

**Pre-condition**: `GET /api/invoices` scoped by advertiser (S15-2). File not on disk.

**`client-app/src/pages/advertiser/Invoices.jsx`** — NEW
- On mount: `GET /api/invoices` → populates table (advertiser-scoped automatically by server)
- Table columns: Campaign Name, Period, Impressions, CPM Rate, Total Amount, Actions
- `data-testid="invoice-download-btn"` per row — triggers `GET /api/invoices/:id/pdf`
- Empty state: "No invoices yet. Invoices are generated by the admin after your campaign completes."
- Skeleton loader on initial fetch
- Uses `apiClient` (no hardcoded URLs — GUARDRAIL-6)

**Register in `App.jsx`**:
```jsx
const Invoices = lazy(() => import('./pages/advertiser/Invoices'));
// Route: /dashboard/advertiser/invoices  — requireRole('advertiser') guard
```

#### Acceptance Criteria

- `data-testid="invoice-download-btn"` present per invoice row
- Empty state renders when `invoices` array is empty
- Skeleton renders on initial load
- Page unreachable for role `admin` (route guard fires → redirect)

#### GUARDRAIL-1/2 check
```bash
find client-app/src/pages/advertiser -name "Invoices.jsx"
# Must return a match before App.jsx route is registered
```

---

### S15-5 · API_ROUTES.md Update (GUARDRAIL-7 closure)

**Scope**: Update `docs/API_ROUTES.md` to include S14 campaign routes and all S15 routes.
This is a GUARDRAIL-7 mandatory item — cannot be deferred.

**Routes to add**:

| Method | Path | Auth | Role | File | Sprint |
|--------|------|------|------|------|--------|
| POST | `/api/campaigns` | ✅ | `advertiser` | `campaigns.js` | S14 |
| GET | `/api/campaigns` | ✅ | `advertiser` (scoped), `admin` (all) | `campaigns.js` | S14 |
| GET | `/api/campaigns/:id` | ✅ | ownership check | `campaigns.js` | S14 |
| PATCH | `/api/campaigns/:id/status` | ✅ | `admin` | `campaigns.js` | S14 |
| GET | `/api/pricing/config` | ✅ | `admin` | `pricing.js` | S15 |
| PATCH | `/api/pricing/config` | ✅ | `admin` | `pricing.js` | S15 |
| GET | `/api/pricing/estimate` | ✅ | any authenticated | `pricing.js` | S15 |
| POST | `/api/invoices/generate` | ✅ | `admin` | `invoices.js` | S15 |
| GET | `/api/invoices` | ✅ | advertiser (scoped), admin (all) | `invoices.js` | S15 |
| GET | `/api/invoices/:id` | ✅ | ownership check | `invoices.js` | S15 |
| GET | `/api/invoices/:id/pdf` | ✅ | ownership check | `invoices.js` | S15 |

**Acceptance Criteria**: `API_ROUTES.md` contains all 11 rows above before sprint closes.

---

### S15-6 · DATABASE_SCHEMA.md Update (GUARDRAIL-8 closure)

**Scope**: Document two new Firestore collections introduced in S15.

**Collections to document**:

**`pricing_config`** (singleton, doc id = `'default'`):
```
{
  cpm_rates: { [screenType: string]: number },
  allocation: { paid: number, retailer: number, internal: number },
  updated_at: Timestamp,
  updated_by: string  // userId
}
```

**`invoices`**:
```
{
  invoiceId: string,
  campaignId: string,
  advertiserId: string,
  impressionsDelivered: number,
  cpmRate: number,
  amount: number,
  generatedAt: Timestamp,
  generatedBy: string  // userId (admin)
}
```

**Acceptance Criteria**: Both collections present in `docs/DATABASE_SCHEMA.md` before sprint closes.

---

### S15-7 · pricing_billing.spec.js

**Scope**: Test file covering S15-1 and S15-2 server logic.

**`pricing_billing.spec.js`** — minimum 8 tests:

| # | Test | Expected |
|---|------|----------|
| 1 | `GET /api/pricing/config` as admin | `200 { cpm_rates, allocation }` |
| 2 | `GET /api/pricing/config` as retailer | `403` |
| 3 | `GET /api/pricing/config` as advertiser | `403` |
| 4 | `PATCH /api/pricing/config` allocation sums to 110 | `400 { error: 'Allocation must sum to 100' }` |
| 5 | `PATCH /api/pricing/config` allocation sums to 100 | `200` |
| 6 | `GET /api/pricing/estimate?slots=12&cpm=5` | `200 { estimatedCost: '0.0600' }` |
| 7 | `GET /api/pricing/estimate` (no params) | `400` |
| 8 | `POST /api/invoices/generate` as advertiser | `403` |
| 9 | `POST /api/invoices/generate` with live campaign | `400` |
| 10 | `GET /api/invoices` as advertiser A excludes advertiser B invoices | `200` array scoped |

---

## Sprint 15 Close-Out Checklist

### New Files to Create

| File | Story | Status |
|------|-------|--------|
| `ad-server/src/services/PricingService.js` | S15-1 | ⬜ |
| `ad-server/src/api/pricing.js` | S15-1 | ⬜ |
| `ad-server/src/api/invoices.js` | S15-2 | ⬜ |
| `client-app/src/pages/admin/PricingConfig.jsx` | S15-3 | ⬜ |
| `client-app/src/pages/advertiser/Invoices.jsx` | S15-4 | ⬜ |
| `pricing_billing.spec.js` | S15-7 | ⬜ |

### Files to Patch

| File | Story | Change | Status |
|------|-------|--------|--------|
| `client-app/src/App.jsx` | S15-3, S15-4 | 2 lazy imports + 2 routes | ⬜ |
| `docs/API_ROUTES.md` | S15-5 | 11 new route rows (S14+S15 debt) | ⬜ |
| `docs/DATABASE_SCHEMA.md` | S15-6 | 2 new collection definitions | ⬜ |

### LoopGenerationService.js

| Check | Result |
|-------|--------|
| `paid > retailer > internal` priority order | ✅ CONFIRMED — no patch needed |

### Guardrail Sign-Off

| Guardrail | Check | Status |
|-----------|-------|--------|
| GUARDRAIL-1 | `PricingConfig.jsx` on disk before `App.jsx` route | ⬜ |
| GUARDRAIL-1 | `Invoices.jsx` on disk before `App.jsx` route | ⬜ |
| GUARDRAIL-2 | Same as above (twin check) | ⬜ |
| GUARDRAIL-3 | `requireRole` grep on `pricing.js` + `invoices.js` | ⬜ |
| GUARDRAIL-6 | No `localhost` in `PricingConfig.jsx` or `Invoices.jsx` | ⬜ |
| GUARDRAIL-7 | `API_ROUTES.md` updated (S14 debt + S15 routes) | ⬜ |
| GUARDRAIL-8 | `DATABASE_SCHEMA.md` updated (2 new collections) | ⬜ |
| GUARDRAIL-10 | ENUM-AUDIT-3 CLOSED this sprint | ✅ |

### Carry-Overs to Sprint 16

- [ ] **S11-1/2/4 persistence QA** — hard-refresh tests on 3 forms (now 3 sprints outstanding)
- [ ] **Firestore composite index** on `campaigns.advertiser_id` (deployment-time)
- [ ] **`CampaignDetail.jsx`** — `data-testid="campaign-impressions-count"` wiring to real
      telemetry data (currently static, per S14 scope)
- [ ] **PDF generation** — `GET /api/invoices/:id/pdf` returns JSON stub; real PDF deferred post-MVP

---

## Story Point Summary

| Story | Points | Scope |
|-------|--------|-------|
| S15-1 · Pricing Service + API | 3 | `PricingService.js` + `pricing.js` (3 endpoints) |
| S15-2 · Invoice API | 3 | `invoices.js` (4 endpoints) |
| S15-3 · PricingConfig.jsx | 2 | Admin UI + App.jsx registration |
| S15-4 · Invoices.jsx | 2 | Advertiser UI + App.jsx registration |
| S15-5 · API_ROUTES.md | 1 | Doc update (S14 debt + S15) |
| S15-6 · DATABASE_SCHEMA.md | 1 | Doc update (2 collections) |
| S15-7 · pricing_billing.spec.js | 2 | 10 tests |
| **Total** | **14** | |

---

*Generated: 2026-06-08. Grounded against commit `2e3c3bf`.*
*Pre-work greps run and documented above before any story was written.*
*`LoopGenerationService.js` SHA `cf7c43fa` — priority order confirmed live, no patch.*
*`PricingService.js` — not on disk, create from scratch.*
*`invoices.js` — not on disk, create from scratch.*
*ENUM-AUDIT-3 CLOSED: `'PENDING'` in `LoopGenerationService.js` L110 is slot-init only.*
