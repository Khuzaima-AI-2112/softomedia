# Sprint 14 — Advertiser Self-Service Portal

**Sprint:** 14
**Status:** ✅ Step 4 — Isolation audit complete; Grep 6 closed; Grep 9 raised
**Cross-referenced with:** `client-app/src/App.jsx` @ `335f1c2`, `ad-server/src/api/` @ `3393144`
**Guardrails authority:** [`docs/sprint8-sre-retro-consolidated.md`](./sprint8-sre-retro-consolidated.md)
**Route authority:** [`docs/API_ROUTES.md`](../docs/API_ROUTES.md)
**Schema authority:** [`docs/DATABASE_SCHEMA.md`](../docs/DATABASE_SCHEMA.md)
**MVP reference:** [`docs/Digital Screen Network Management Platform (MVP).md`](<../docs/Digital Screen Network Management Platform (MVP).md>)
**Completion plan:** [`docs/MVP_COMPLETION_SPRINT_PLAN.md`](../docs/MVP_COMPLETION_SPRINT_PLAN.md)

---

## Step 3 — Outcome Probability Tightening

### Files read in Step 3

| File | SHA | Size | Why read |
|---|---|---|---|
| `ad-server/src/services/AuthService.js` | `de215c1` | 1 381 B | Confirm JWT payload fields — specifically whether `advertiserId` or `linked_entity_id` is embedded |
| `ad-server/src/repositories/CampaignRepository.js` | `4e3585d` | 232 B | Confirm `findAll` scoping support (Grep 4 close) |
| `ad-server/src/repositories/BaseRepository.js` | `6e3338e` | 6 264 B | Confirm `findAll({ where })` implementation in both Firestore and memory branches |
| `ad-server/src/services/CampaignService.js` | `4cb64bb` | 1 882 B | Confirm no ownership logic exists in service layer |
| `ad-server/src/api/auth.js` | `e53a73f` | 937 B | Confirm login handler delegates to `authService.login()` (Grep 5 close) |

### Step 3 Score Table

| Task | Old Score | New Score | Eliminations | Remaining Risks |
|---|---|---|---|---|
| **S14-1** · Advertiser role + JWT guard | 85% | **95%** | ✅ JWT payload confirmed: `{ id, email, role, linked_entity_id }` — `role` is present. ✅ `auth.js` delegates to `authService.login()` with no hardcoding. ✅ Grep 5 closed. | DECISION-2 (guard type) must be recorded before merge. |
| **S14-2** · Campaign CRUD API patch | 82% | **92%** | ✅ `CampaignRepository` is a thin `BaseRepository` wrapper — no custom methods, no scoping gaps. ✅ `BaseRepository.findAll({ where })` supports Firestore + in-memory via identical filter logic. ✅ Grep 4 closed. ✅ **Critical correction:** JWT uses `linked_entity_id`, not `advertiserId` — Patches 1 & 2 pseudocode corrected below. ✅ `CampaignService` has no ownership logic — all patches stay in `campaigns.js` only. | Firestore composite index may be needed for `advertiser_id ==` query in production. |
| **S14-3** · Advertiser portal UI | 68% | **72%** | Minor: `ApiService.js` campaign methods still unconfirmed (Grep 8). Advertiser pages directory still unconfirmed (Grep 7). | Greps 7 + 8 still required before implementation. |
| **S14-4** · App.jsx route registration | 90% | **92%** | ✅ Pattern confirmed from prior sprints — additive only. | Grep 6 still required to confirm no conflicting advertiser routes already exist. |

### Tasks That Cannot Realistically Exceed 90% Yet

- **S14-3 (72%)** — Two file-existence unknowns remain (Greps 7 + 8). Cannot exceed 90% until both greps run and results are incorporated. If `AdvertiserDashboard.jsx` exists as a stub, effort estimate changes from L to M.
- **S14-1 (95%)** — One decision gate (DECISION-2) must be recorded before merge. Technically could block completion if the guard type discussion reveals scope expansion.

---

## Step 2 — Source Reality (confirmed before any code is written)

All findings below are from direct file reads at commit `3393144`. No guessing.

### `ad-server/src/middleware/requireRole.js`

✅ **`'advertiser': 0`** is already present in `ROLE_HIERARCHY`:

```js
export const ROLE_HIERARCHY = {
    superadmin:     5,
    admin:          4,
    contentmanager: 3,
    techoperator:   2,
    retaileradmin:  1,
    advertiser:     0,   // ← CONFIRMED
};
```

**S14-1 advertiser role gate: CLEARED.** No role hierarchy change needed.
The `normalizeRole()` helper passes non-`superadmin` roles through unchanged — advertiser tokens will pass through correctly.

**CCR-4 gate pre-check:** 6 entries in block confirmed. That count must not decrease after any S14-1 work.

---

### `ad-server/src/services/AuthService.js` ← Step 3 read

✅ **JWT payload confirmed (Grep 5 CLOSED):**

```js
const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, linked_entity_id: user.linked_entity_id },
    JWT_SECRET,
    { expiresIn: '24h' }
);
```

**Key findings:**
- `role` is embedded from the user record → `req.user.role === 'advertiser'` works as expected
- The FK to the advertiser's entity is **`linked_entity_id`**, NOT `advertiserId`
- **All Patch 1 and Patch 2 pseudocode in S14-2 must use `req.user.linked_entity_id`** — any reference to `req.user.advertiserId` is incorrect
- `auth.js` is a thin router that delegates to `authService.login(email)` — no hardcoding of role or entity ID

**Grep 5: CLOSED ✅**

---

### `ad-server/src/repositories/CampaignRepository.js` ← Step 3 read

✅ **Grep 4 CLOSED:**

```js
import { BaseRepository } from './BaseRepository.js';

export class CampaignRepository extends BaseRepository {
    constructor() {
        super('campaigns');
    }
}

export const campaignRepository = new CampaignRepository();
```

**Key findings:**
- 6 lines — no custom methods, no overrides
- ALL persistence (findAll, findById, update, delete) flows through `BaseRepository`
- No `CampaignRepository`-specific changes needed for S14-2

---

### `ad-server/src/repositories/BaseRepository.js` ← Step 3 read

✅ **`findAll({ where })` fully confirmed in both Firestore and memory paths:**

Firestore path:
```js
if (options.where) {
    options.where.forEach(([field, op, value]) => {
        query = query.where(field, op, value);
    });
}
```

Memory fallback path:
```js
if (options.where) {
    results = results.filter(item => {
        return options.where.every(([field, op, value]) => {
            if (op === '==') return item[field] === value;
            if (op === 'array-contains') return Array.isArray(item[field]) && item[field].includes(value);
            return true;
        });
    });
}
```

**Supported operators confirmed:** `==`, `array-contains` (memory fallback), plus full Firestore query operators in the Firestore path.

**S14-2 Patch 1 call is confirmed safe:**
```js
campaignRepository.findAll({ where: [['advertiser_id', '==', req.user.linked_entity_id]] })
```

> ⚠️ **Production Firestore note:** A composite index on `campaigns.advertiser_id` may be required for the Firestore `==` query to work without a full-collection scan. This is a deployment-time concern, not a code concern, but must be verified when testing against a live Firestore instance.

---

### `ad-server/src/services/CampaignService.js` ← Step 3 read

✅ **No ownership logic in service layer:**
- `updateStatus(id, status)` — only updates status + triggers `generateAdsFromCampaign()` on `approved`
- `generateAdsFromCampaign(campaign)` — creates `Ad` records from `campaign.selectedSlots`
- No `findAll`, no scoping, no ownership checks

**Key finding:** All S14-2 patches (scoping, ownership, transition state machine) go exclusively in `campaigns.js`. No `CampaignService` changes needed.

---

### `ad-server/src/api/campaigns.js`

Full handler inventory (all confirmed, not stubs):

| Method | Path | Auth middleware | Body / Notes |
|---|---|---|---|
| `GET` | `/` | ❌ **none** | `?status=` or `?advertiserId=` — currently returns ALL campaigns regardless of caller role |
| `GET` | `/:id` | ❌ **none** | No ownership check — any caller can read any campaign |
| `POST` | `/` | `authenticate` only | Defaults `status` to `'pending_approval'`; no `requireRole` |
| `POST` | `/:id/book` | `authenticate` only | Slot booking; `advertiser_id` taken from campaign record |
| `PATCH` | `/:id/status` | `requireRole('retaileradmin')` | Status normalised to lowercase; ALLOWED: `approved`, `rejected`, `pending_approval` |
| `PUT` | `/:id` | `authenticate` only | Full replacement; no ownership check |
| `DELETE` | `/:id` | `authenticate` + `requireRole('superadmin')` | ✅ CCR-3 guard confirmed |

**Critical gaps for §3.4 advertiser self-service:**

1. **`GET /` has no role scoping** — an advertiser calling `GET /api/campaigns` currently gets every campaign in the system.
2. **`GET /:id` has no ownership check** — any authenticated user can read any campaign.
3. **`POST /` has no `requireRole('advertiser')`** — any authenticated user can create campaigns.
4. **`PATCH /:id/status` valid transitions are only `approved` / `rejected` / `pending_approval`** — `live`, `completed`, `paused` transitions are missing from the allowlist and will return `400`.

**S14-2 is a _patch_, not a create.** The file exists at 6 323 B with all route skeletons live.

---

### `ad-server/src/api/` directory

22 route files confirmed at `3393144`. **No `advertiser-campaigns.js` exists.** All advertiser campaign work routes through the existing `campaigns.js`. No new route file is needed for S14-2.

Files relevant to this sprint:
- `campaigns.js` ✅ (6 323 B) — patch target for S14-2
- `advertisers.js` ✅ (5 268 B) — exists; advertiser user management
- `auth.js` ✅ (937 B) — JWT role + `linked_entity_id` claim **confirmed Step 3** ✅
- `telemetry.js` ✅ (5 135 B) — DECISION-1 guard at L49 must close this sprint

---

## Sprint 13 Carry-Overs

| Item | Type | Priority | Gate |
|---|---|---|---|
| **DECISION-1** — NODE_ENV guard `!== 'production'` vs `!== 'test'` in `telemetry.js` L49 | Decision | **Critical** | Must close this sprint — deferred twice (GUARDRAIL-10). No third deferral. |
| **S11-1** — Super Admin CRUD Users & Retailers persistence test | Manual QA | Critical | Hard-refresh `UserManagement` form; confirm data survives. |
| **S11-2** — Super Admin CRUD Advertisers persistence test | Manual QA | Critical | Hard-refresh `AdvertiserManagement` form; confirm data survives. |
| **S11-4** — Add Location persistence test | Manual QA | High | Hard-refresh Add Location form; confirm data survives. |
| **`docs/MVP_SPRINT_PLAN.md`** Sprint 13 entry | Docs | Low | Add link to `current_sprint/sprint13.md`. |

> **GUARDRAIL-10 enforced:** DECISION-1 has been deferred for two consecutive sprints. It must be
> resolved (code change or documented intent) before Sprint 14 is marked Done.

---

## ⚠️ Open Decisions

### DECISION-1 — NODE_ENV Guard Logic in `telemetry.js`

**File:** `ad-server/src/api/telemetry.js` Line 49
**Live code:** `if (process.env.NODE_ENV !== 'production') {`
**Spec expected:** `if (process.env.NODE_ENV !== 'test') {`

| Guard | Rate limiter in dev? | Rate limiter in test? | Rate limiter in prod? |
|---|---|---|---|
| `!== 'production'` (live) | ❌ Bypassed | ❌ Bypassed | ✅ Active |
| `!== 'test'` (spec intent) | ✅ Active | ❌ Bypassed | ✅ Active |

**Resolution required this sprint.** Two options:
- **Option A (code fix):** Change L49 to `!== 'test'`. One-line change. Recommended.
- **Option B (doc decision):** Document that `!== 'production'` is intentional. Update spec to match.

**DECISION-1-RESOLVED:** _(fill in before sprint close)_

---

### DECISION-2 — `POST /api/campaigns` role guard: hierarchical vs. exclusive

**File:** `ad-server/src/api/campaigns.js` — `POST /` handler

`requireRole('advertiser')` is hierarchical — it allows any role ≥ level 0, meaning `retaileradmin`, `admin`, and `superadmin` can also create campaigns. If campaign creation should be advertiser-type users only, a role equality check (`req.user.role === 'advertiser'`) is needed instead.

| Option | Who can create campaigns | Recommended? |
|---|---|---|
| `requireRole('advertiser')` (hierarchical) | advertiser + all higher roles | ✅ Default — admin oversight preserved |
| `req.user.role === 'advertiser'` (exclusive) | advertiser only | Use if §3.4 explicitly prohibits admin campaign creation |

**Record choice before S14-1 merge.**

**DECISION-2-RESOLVED:** _(fill in before implementation)_

---

## 🚨 Sprint 14 New Scope

**MVP Requirement:** §3.4 — Advertisers can upload creatives, create campaign requests, select
preferred locations, track status, view basic performance metrics, access invoices.

### Scoping rationale (updated from Step 3 findings)

Sprint 13 closed four back-end wiring gaps. Sprint 14 opens the **Advertiser Self-Service Portal**.
Step 3 source reads further sharpen the picture:
- `advertiser` role is already in `ROLE_HIERARCHY` → S14-1 is JWT-confirm only (no changes needed to `requireRole.js` or `AuthService.js`)
- JWT payload uses **`linked_entity_id`** for the advertiser FK — all ownership checks must use `req.user.linked_entity_id`, not `req.user.advertiserId`
- `CampaignRepository` is a 6-line thin wrapper — `BaseRepository.findAll({ where })` handles all scoping natively
- `CampaignService` has no ownership logic — all S14-2 patches are isolated to `campaigns.js`

**Updated story order and effort:**
1. **S14-1 (XS)** — Add `requireRole('advertiser')` to `POST /api/campaigns`; confirm JWT `role` + `linked_entity_id` claim ✅
2. **S14-2 (S)** — Patch `campaigns.js`: scope `GET /` and `GET /:id` to `req.user.linked_entity_id`, extend transition allowlist
3. **S14-3 (L)** — Three advertiser portal pages (directory existence still unconfirmed — Grep 7 required)
4. **S14-4 (XS)** — `App.jsx` route registration (Grep 6 **CLOSED** — zero collision confirmed)

---

## 🛡️ S14-1 · Advertiser Role Confirmation + JWT Guard

**Priority:** Critical (gate for all other stories)
**Effort:** XS
**Confidence:** **95%** _(upgraded from 85%: JWT payload confirmed; role + linked_entity_id both present)_
**MVP section:** §3.4

### Step 3 findings

✅ `'advertiser': 0` confirmed in `requireRole.js` `ROLE_HIERARCHY`.
✅ JWT payload confirmed: `{ id, email, role, linked_entity_id }` — `role` is set from user record, `linked_entity_id` is the advertiser FK.
✅ `auth.js` delegates to `authService.login(email)` — no hardcoded role, no hardcoded entity ID.
✅ **Grep 5: CLOSED.**

**No changes needed to `AuthService.js`, `requireRole.js`, or `auth.js`.**
S14-1 is purely: add `requireRole('advertiser')` to the `POST /api/campaigns` route line in `campaigns.js`.

### Remaining pre-implementation gate

Only DECISION-2 remains before implementation. No greps outstanding.

```
DECISION-2: Use requireRole('advertiser') [hierarchical] or req.user.role === 'advertiser' [exclusive]?
Record in DECISION-2-RESOLVED before merge.
```

### Acceptance Criteria

| # | Criterion | Guardrail |
|---|---|---|
| AC-1 | `Select-String -Path "ad-server/src/middleware/requireRole.js" -Pattern "'advertiser'"` returns a match. ✅ Already confirmed. | GUARDRAIL-3 |
| AC-2 | `POST /api/auth/login` for an advertiser-type user returns JWT where decoded payload contains `"role":"advertiser"` and `"linked_entity_id":"<advertiser-id>"`. Verify: decode the JWT and inspect both fields. | GUARDRAIL-3 |
| AC-3 | `POST /api/campaigns` with a valid `retaileradmin` token → `403` (if role-exclusive guard chosen) OR `201` (if hierarchical guard chosen). DECISION-2 must be recorded before this criterion is finalised. | GUARDRAIL-3 |
| AC-4 | `Select-String -Path "ad-server/src/api/campaigns.js" -Pattern "requireRole.*advertiser"` returns a match after S14-1 merge. | GUARDRAIL-3 |
| AC-5 | `ROLE_HIERARCHY` block entry count in `requireRole.js` unchanged at 6 entries after S14-1 merge. CCR-4 gate passed. | GUARDRAIL-3 |

### Files touched

- `ad-server/src/api/campaigns.js` — add `requireRole('advertiser')` to `POST /` handler line
- No other files

---

## 🛡️ S14-2 · Campaign CRUD API Patch

**Priority:** High
**Effort:** S _(downgraded from S–M: `CampaignRepository` is a thin wrapper; `BaseRepository.findAll({ where })` works out of the box; no repository changes needed)_
**Confidence:** **92%** _(upgraded from 82%: `findAll({ where })` confirmed in both Firestore and memory paths; JWT field name corrected to `linked_entity_id`)_
**MVP section:** §3.4

### Step 3 findings

✅ `CampaignRepository` is a 6-line thin wrapper — no custom methods. No repository changes needed.
✅ `BaseRepository.findAll({ where: [['advertiser_id', '==', value]] })` works natively in both Firestore and memory.
✅ JWT field for advertiser FK is **`linked_entity_id`** (not `advertiserId`) — all patches corrected.
✅ `CampaignService` has no ownership logic — all patches stay in `campaigns.js` only.
✅ **Grep 4: CLOSED.**

> ⚠️ **Remaining risk (8%):** Firestore may require a composite index on `campaigns.advertiser_id` for the `==` query to perform without a full-collection scan. This is a deployment-time concern. If Firestore query fails in production, the `BaseRepository` circuit breaker will fall back to the memory store, which filters correctly. Monitor logs on first production deployment.

### ⚠️ Step 4 blocker — `GET /` and `GET /:id` have no `authenticate` middleware

`campaigns.js` @ `3dd8cd2` confirms both `GET /` and `GET /:id` have **no auth middleware**.
`req.user` will be `undefined` for unauthenticated callers. Accessing `req.user.role` directly will throw a runtime `TypeError`.

**Required fix — use optional chaining:**
```js
// Safe — preserves backward compatibility for unauthenticated callers
if (req.user?.role === 'advertiser') {
    // scoped path
} else {
    // existing unscoped logic — unchanged
}
```

If explicit auth is preferred, add `authenticate` to both GET routes and confirm all existing callers (e.g., `CampaignManagement.jsx`) pass a token.

### Patches required in `campaigns.js`

#### Patch 1 — `GET /` ownership scoping
```js
// Before (current — returns all campaigns):
campaigns = await campaignRepository.findAll();

// After — scope to caller's linked_entity_id unless admin+:
if (req.user?.role === 'advertiser') {
    campaigns = await campaignRepository.findAll({
        where: [['advertiser_id', '==', req.user.linked_entity_id]]
    });
} else {
    // admin and above see all — existing filter/query logic preserved
    campaigns = await campaignRepository.findAll( /* existing options */ );
}
```

#### Patch 2 — `GET /:id` ownership check
```js
// After fetching campaign by ID, add ownership guard:
if (req.user?.role === 'advertiser' && campaign.advertiser_id !== req.user.linked_entity_id) {
    return res.status(403).json({ error: 'Forbidden' });
}
```

#### Patch 3 — `PATCH /:id/status` valid transition state machine

Current allowlist (flat): `['approved', 'rejected', 'pending_approval']`

Replace with ordered transition map:
```js
const VALID_TRANSITIONS = {
    pending_approval: ['approved', 'rejected'],
    approved:         ['live'],
    live:             ['completed', 'paused'],
    paused:           ['live'],
    completed:        [],
    rejected:         [],
};

const current = campaign.status;
const allowed = VALID_TRANSITIONS[current] || [];
if (!allowed.includes(requestedStatus)) {
    return res.status(400).json({
        error: 'Invalid status transition',
        from: current,
        to: requestedStatus,
        allowed,
    });
}
```

All status values remain lowercase. No new enum values — these were already present in MVP spec §3.4.

### Route contract (canonical — must match `API_ROUTES.md` after close)

| Method | Path | Auth | Scoping | Response |
|---|---|---|---|---|
| `POST` | `/api/campaigns` | `authenticate` + `requireRole('advertiser')` | `advertiser_id` from `req.user.linked_entity_id` | `201 { campaignId, status: 'pending_approval' }` |
| `GET` | `/api/campaigns` | none (optional chaining guard) | Advertiser: `where advertiser_id == linked_entity_id`. All others: unscoped. | `200 [{ … }]` |
| `GET` | `/api/campaigns/:id` | none (optional chaining guard) | Advertiser: `403` if `campaign.advertiser_id !== linked_entity_id`. All others: any. | `200 { … }` or `403` |
| `PATCH` | `/api/campaigns/:id/status` | `requireRole('retaileradmin')` | No change — admin gate preserved | `200 { campaignId, status }` or `400 { error, from, to, allowed }` |
| `DELETE` | `/api/campaigns/:id` | `authenticate` + `requireRole('superadmin')` | ✅ CCR-3 confirmed — do not touch | `204` |

### Acceptance Criteria

| # | Criterion | Guardrail |
|---|---|---|
| AC-1 | `GET /api/campaigns` as role `advertiser` → response array contains only campaigns where `advertiser_id === req.user.linked_entity_id`. No foreign advertiser campaigns in response. | GUARDRAIL-3 |
| AC-2 | `GET /api/campaigns/:id` as a different advertiser (mismatched `linked_entity_id`) → `403 { error: 'Forbidden' }`. | GUARDRAIL-3 |
| AC-3 | `GET /api/campaigns/:id` as `admin` for any campaign → `200`. | GUARDRAIL-3 |
| AC-4 | `PATCH /api/campaigns/:id/status` with `{ status: 'live' }` when current status is `pending_approval` → `400 { error: 'Invalid status transition', from: 'pending_approval', to: 'live', allowed: ['approved','rejected'] }`. | GUARDRAIL-2 |
| AC-5 | `PATCH /api/campaigns/:id/status` with `{ status: 'approved' }` when current status is `pending_approval` → `200 { campaignId, status: 'approved' }`. | GUARDRAIL-2 |
| AC-6 | `PATCH /api/campaigns/:id/status` with `{ status: 'live' }` when current status is `approved` → `200 { campaignId, status: 'live' }`. | GUARDRAIL-2 |
| AC-7 | `PATCH /api/campaigns/:id/status` with `{ status: 'paused' }` when current status is `live` → `200 { campaignId, status: 'paused' }`. | GUARDRAIL-2 |
| AC-8 | `PATCH /api/campaigns/:id/status` with `{ status: 'live' }` when current status is `paused` → `200 { campaignId, status: 'live' }` (resume). | GUARDRAIL-2 |
| AC-9 | `DELETE /api/campaigns/:id` as `retaileradmin` → `403`. CCR-3 guard unchanged. | GUARDRAIL-3 |
| AC-10 | `Select-String -Path "ad-server/src/api/campaigns.js" -Pattern "requireRole.*superadmin"` returns match after S14-2 merge. **CCR-3 hard gate.** | GUARDRAIL-3 |
| AC-11 | `Select-String -Path "ad-server/src/api/campaigns.js" -Pattern "'pending_approval'\|'approved'\|'live'\|'completed'\|'paused'"` returns matches — no uppercase status values. | GUARDRAIL-4 |
| AC-12 | `docs/API_ROUTES.md` campaigns section updated with all five routes, correct auth guards, scoping rules, and body shapes. | GUARDRAIL-2 |

### Files touched

- `ad-server/src/api/campaigns.js` — Patch 1 (GET scoping), Patch 2 (ownership check), Patch 3 (transition state machine)
- `docs/API_ROUTES.md` — update campaigns section
- `ad-server/src/repositories/CampaignRepository.js` — **no changes needed** (confirmed Step 3)

### CCR-3 — `campaigns.js` DELETE guard must survive S14-2

After S14-2 merge:
```powershell
Select-String -Path "ad-server/src/api/campaigns.js" -Pattern "requireRole.*superadmin"
```
Must return a match. **Hard merge gate — story cannot be marked Done without this match.**

---

## 🛡️ S14-3 · Advertiser Portal UI

**Priority:** High
**Effort:** L
**Confidence:** **72%** _(upgraded from 68%: minor — `ApiService.js` campaign methods still unconfirmed, pages directory still unconfirmed)_
**MVP section:** §3.4

### Remaining pre-implementation gates (Greps 7 + 8 still required)

```powershell
# 7. Do advertiser pages exist on disk?
Get-ChildItem -Path "client-app/src/pages/advertiser" -ErrorAction SilentlyContinue

# 8. Does ApiService.js have campaign or advertiser methods?
Select-String -Path "client-app/src/services/ApiService.js" -Pattern "campaign|advertiser" -Context 1,1
```

**Decision tree:**

| Finding | Action |
|---|---|
| `advertiser/` directory absent | Create directory + all three files — L effort as planned |
| `AdvertiserDashboard.jsx` exists | Read before planning — may be stub or partial |
| `ApiService.js` already has `getCampaigns()` | Wire directly — skip ApiService sub-task |
| `ApiService.js` missing campaign methods | Add `createCampaign(payload)`, `getCampaigns(params)`, `getCampaign(id)`, `updateCampaignStatus(id, status)` |

### Pages to create (or confirm + extend)

#### `AdvertiserDashboard.jsx`
- Route: `/dashboard/advertiser`
- KPI row: active campaigns, total impressions, total spend
  - `data-testid="kpi-active-campaigns"`, `data-testid="kpi-total-impressions"`, `data-testid="kpi-total-spend"`
- Campaign list table with status chips
  - `data-testid="campaign-list-table"`, `data-testid="campaign-status-chip-{id}"`
- Empty state: `"No campaigns yet — create your first campaign."` (not blank)
- Loading skeleton while data fetches

#### `CampaignRequest.jsx`
- Route: `/dashboard/advertiser/campaigns/new`
- Multi-step form: (1) Campaign details, (2) Select locations, (3) Attach creatives, (4) Review + submit
- `data-testid="campaign-request-form"`, `data-testid="submit-campaign-btn"`
- `submit-campaign-btn` disabled until all required fields filled
- On success: redirect to `CampaignDetail` for the new `campaignId`
- On error: inline error message (not toast); `data-testid="campaign-form-error"`
- Submission payload must include `advertiser_id: req.user.linked_entity_id` (set server-side from token — do not rely on client to send this)

#### `CampaignDetail.jsx`
- Route: `/dashboard/advertiser/campaigns/:id`
- Status timeline showing all past transitions
- Delivery metrics: impressions count, delivery rate (from `GET /api/telemetry/impressions?campaign_id=X`)
- `data-testid="campaign-status-badge"`, `data-testid="campaign-impressions-count"`
- Loading skeleton while data fetches

### Acceptance Criteria

| # | Criterion | Guardrail |
|---|---|---|
| AC-1 | `data-testid="campaign-request-form"` present in `CampaignRequest.jsx` DOM. | GUARDRAIL-1 |
| AC-2 | `data-testid="submit-campaign-btn"` is `disabled` when required fields empty. | — |
| AC-3 | Submit with valid payload → `POST /api/campaigns` called → redirects to `/dashboard/advertiser/campaigns/:newId`. | GUARDRAIL-1 |
| AC-4 | `data-testid="campaign-status-badge"` shows `pending_approval` immediately after submit. | GUARDRAIL-4 |
| AC-5 | `data-testid="campaign-impressions-count"` renders on `CampaignDetail.jsx` (value may be `0` for a new campaign). | GUARDRAIL-1 |
| AC-6 | `AdvertiserDashboard.jsx` renders empty state `"No campaigns yet"` when campaign list is empty (not a blank panel). | — |
| AC-7 | Loading skeletons present in `AdvertiserDashboard.jsx` and `CampaignDetail.jsx` while data fetches. | — |
| AC-8 | All `ApiService` campaign methods confirmed in `client-app/src/services/ApiService.js` source before use (Grep 8 gate). | GUARDRAIL-1 |

### Files expected to touch

- `client-app/src/pages/advertiser/AdvertiserDashboard.jsx` — create (or extend if stub found)
- `client-app/src/pages/advertiser/CampaignRequest.jsx` — create (or extend if stub found)
- `client-app/src/pages/advertiser/CampaignDetail.jsx` — create (or extend if stub found)
- `client-app/src/services/ApiService.js` — add campaign methods if absent (Grep 8 gate)

---

## 🛡️ S14-4 · App.jsx Route Registration

**Priority:** High
**Effort:** XS
**Confidence:** **95%** _(upgraded from 92%: Grep 6 CLOSED — zero `/dashboard/advertiser/*` routes in App.jsx confirmed from Step 4 live read)_
**MVP section:** §3.4

### ✅ Grep 6 — CLOSED (Step 4 live read)

`App.jsx` @ `335f1c2` contains zero `/dashboard/advertiser/*` routes.
The word "advertiser" appears only in Admin section imports and routes (`admin/advertisers`, `AdvertiserManagement`).
**No route collision. S14-4 is additive with no conflicts.**

### Remaining pre-implementation gate (Grep 9 — NEW from Step 4)

```powershell
# 9. Does DashboardLayout enforce per-route role gating?
Select-String -Path "client-app/src/layouts/DashboardLayout.jsx" -Pattern "role|requireRole|ProtectedRoute" -Context 2,2
```

**Decision tree:**

| Finding | Action |
|---|---|
| `DashboardLayout` checks route role | Use existing pattern — no wrapper needed |
| `DashboardLayout` does NOT gate by role | Add `<ProtectedRoute role="advertiser">` wrapper around the three new routes |
| `ProtectedRoute` component exists | Use it |
| `ProtectedRoute` component absent | Create it (15-line HOC) |

### Routes to register

| Route | Component | Role Guard |
|---|---|---|
| `/dashboard/advertiser` | `AdvertiserDashboard.jsx` | `requireRole('advertiser')` or `<ProtectedRoute role="advertiser">` |
| `/dashboard/advertiser/campaigns/new` | `CampaignRequest.jsx` | `requireRole('advertiser')` or `<ProtectedRoute role="advertiser">` |
| `/dashboard/advertiser/campaigns/:id` | `CampaignDetail.jsx` | `requireRole('advertiser')` or `<ProtectedRoute role="advertiser">` |

### Acceptance Criteria

| # | Criterion | Guardrail |
|---|---|---|
| AC-1 | `GET /dashboard/advertiser` as role `admin` → `403` (route guard fires). | GUARDRAIL-3 |
| AC-2 | `GET /dashboard/advertiser` as role `advertiser` → renders `AdvertiserDashboard.jsx`. | GUARDRAIL-1 |
| AC-3 | `Select-String -Path "client-app/src/App.jsx" -Pattern "advertiser"` returns matches for all three routes after S14-4 merge. | GUARDRAIL-1 |
| AC-4 | No existing non-advertiser routes are moved or removed from `App.jsx`. | — |
| AC-5 | `App.jsx` line count delta is ≤ 20 lines. If larger, flag for review — scope may have crept. | — |
| AC-6 | Grep 9 result logged before implementation — role enforcement mechanism confirmed or `<ProtectedRoute>` wrapper added. | GUARDRAIL-3 |

### Files touched

- `client-app/src/App.jsx` — add three route entries with role guard
- `client-app/src/layouts/DashboardLayout.jsx` or new `client-app/src/components/ProtectedRoute.jsx` — if role guard pattern requires a new component (Grep 9 gate)

---

## 🔬 Step 4 — Isolation and Non-Blocking Audit

**Performed against live source:** `campaigns.js` @ `3dd8cd2`, `App.jsx` @ `335f1c2`
**Date:** 2026-06-08

---

### ✅ Grep 6 — CLOSED (from App.jsx live read)

```powershell
Select-String -Path "client-app/src/App.jsx" -Pattern "advertiser" -Context 1,1
```

**Live findings:**

| Match | Line content | Type |
|---|---|---|
| `pages/admin/AdvertiserManagement.jsx` | lazy import | Admin page — NOT an advertiser portal route |
| `admin/advertisers` | `<Route path="admin/advertisers"` | Admin route — NOT an advertiser self-service route |

**Verdict:** Zero `/dashboard/advertiser/*` routes exist in `App.jsx`. **No route collision risk.**
The word "advertiser" appears only in the Admin section (superadmin managing advertiser records).
S14-4 is additive with no conflicts.

**Grep 6: CLOSED ✅**

---

### Blast-Radius Table

| Story | Files Touched | Change Type | Shared Infra? | Can It Break Other Features? | Mitigation |
|---|---|---|---|---|---|
| **S14-1** · Advertiser role + `POST /` guard | `ad-server/src/api/campaigns.js` — one line added to `router.post('/', ...)` | **Additive** — adds `requireRole('advertiser')` middleware argument | `campaigns.js` is shared across all callers | **Low.** Only affects unauthenticated or low-privilege callers of `POST /api/campaigns`. Any caller already holding `authenticate` + a role ≥ `advertiser` (level 0) is unaffected. Admin and superadmin continue to create campaigns. | CCR-4 grep confirms `ROLE_HIERARCHY` count unchanged. DECISION-2 must be recorded before merge to confirm hierarchical vs exclusive guard. |
| **S14-2** · Campaign CRUD patch | `ad-server/src/api/campaigns.js` — patches to `GET /`, `GET /:id`, `PATCH /:id/status`. `docs/API_ROUTES.md` — updated. | **Targeted patch** — adds conditional branches; no handler removal | `campaigns.js` shared by admin, retaileradmin, brand, advertiser callers | **Medium.** Three handlers modified. Non-advertiser callers (`admin`, `retaileradmin`) must continue to receive unscoped `GET /` responses and unrestricted `GET /:id` access — both ensured by the `if (req.user?.role === 'advertiser')` optional-chaining branch. `PATCH /:id/status` allowlist expansion cannot break any caller passing a transition already in the old allowlist. CCR-3 `requireRole('superadmin')` on `DELETE` must survive. | Ownership branch is role-conditional and uses optional chaining — non-advertiser code path is identical to today's code. Old valid transitions all remain valid in new map. CCR-3 hard merge gate. |
| **S14-3** · Advertiser portal UI | New JSX files, `ApiService.js` (additive only) | **New files + additive** | `ApiService.js` shared across all portal pages | **Low.** Three new JSX files touch no existing components. `ApiService.js` receives new methods only — no existing method signatures are modified. Existing callers are unaffected. | Grep 8 must confirm no method name collision before implementation. New methods must follow existing naming convention. |
| **S14-4** · App.jsx routes | `client-app/src/App.jsx` (additive) | **Additive** | Route authority | **Low. Grep 6 confirmed zero existing advertiser routes** — no collision possible. Additive entries cannot alter existing route matching. | Line count delta must stay ≤ 20 lines (AC-5). No existing route moves or deletions. Grep 9 closes frontend role enforcement question. |

---

### campaigns.js Import Graph (S14-1 / S14-2)

From live source read (`3dd8cd2`):

```
campaigns.js imports:
  express                               — router only
  ../repositories/index.js              — campaignRepository, loopRepository
  ../services/CampaignService.js        — campaignService (used only in PATCH /:id/status)
  ../middleware/auth.js                 — authenticate
  ../middleware/requireRole.js          — requireRole
```

**What S14-1 touches:** adds `requireRole('advertiser')` to the `router.post('/', authenticate, ...)` line.
- `requireRole` is already imported — **no new import needed.**
- `authenticate` is already on that route — **no existing middleware removed.**
- Change is: `router.post('/', authenticate, async` → `router.post('/', authenticate, requireRole('advertiser'), async`
- One token insertion. No other handler is touched.

**What S14-2 touches:**
- `GET /` handler — adds `if (req.user?.role === 'advertiser')` optional-chaining branch. Safe for unauthenticated callers.
- `GET /:id` handler — adds ownership guard with optional chaining. Safe for unauthenticated callers.
- `PATCH /:id/status` handler — replaces flat `ALLOWED_STATUSES` array with `VALID_TRANSITIONS` map. All old valid values remain valid in new map.

> ⚠️ **Step 4 finding — do NOT use `req.user.role` (without optional chaining) in GET handlers:**
> `GET /` and `GET /:id` have no `authenticate` middleware. `req.user` is `undefined` for unauthenticated
> callers. Use `req.user?.role === 'advertiser'` throughout both patches to preserve backward compatibility.

---

### App.jsx Import Graph (S14-4)

From live source read (`335f1c2`):

```
App.jsx structure:
  - lazy imports: 35 total page components
  - route groups: admin (13), brand (2), retailer (6), tickets (2), techoperator (2), standalone (3)
  - /dashboard/advertiser/* namespace: EMPTY ← confirmed by Grep 6
```

**S14-4 adds to App.jsx:**
1. Three `lazy(() => import('./pages/advertiser/AdvertiserDashboard'))` etc. import lines
2. Three `<Route>` entries inside the `/dashboard` nest under `advertiser` path segment

No existing route is modified. The `advertiser` path segment does not collide with any existing segment (`admin`, `brand`, `retailer`, `tickets`, `techoperator`).

---

### Isolation Verdict

**All four stories are safe to implement in the planned order with two caveats:**

1. **S14-2 Patch 1 + Patch 2 — `req.user` optional chaining required** (raised in Step 4): `GET /` and `GET /:id` have no `authenticate` middleware. Use `req.user?.role === 'advertiser'` — not `req.user.role` — throughout both patches to prevent `TypeError` for unauthenticated callers.

2. **S14-4 frontend role guard — Grep 9 required** (raised in Step 4): Confirm `DashboardLayout` enforces per-route role restriction, or add a `<ProtectedRoute role="advertiser">` wrapper. Without this, any logged-in user who knows the URL can access advertiser pages.

---

### Genuine Cross-Cutting Risks

**Risk A — `GET /api/campaigns` unauthenticated caller contract (S14-2)**
`GET /` currently has no auth middleware and is accessible to anonymous callers. The optional-chaining mitigation (`req.user?.role`) preserves this contract while safely scoping authenticated advertiser callers. If `authenticate` is added instead, all existing callers of this endpoint must be confirmed to send a JWT — check `CampaignManagement.jsx`, `RetailerDashboard.jsx`, and any analytics widgets.

**Risk B — `App.jsx` advertiser role enforcement (S14-4)**
React Router matches paths only — it does not enforce roles. `DashboardLayout` may or may not gate by role. Grep 9 closes this. If no role gate exists, any authenticated user can access `/dashboard/advertiser` by URL. Add `<ProtectedRoute>` wrapper before S14-4 merge.

---

### New Grep Raised by Step 4

| ID | Command | Closes what |
|---|---|---|
| **Grep 9** | `Select-String -Path "client-app/src/layouts/DashboardLayout.jsx" -Pattern "role\|requireRole\|ProtectedRoute" -Context 2,2` | S14-4 frontend role guard — confirm DashboardLayout enforces role restriction per route, or add `<ProtectedRoute>` wrapper |

---

### Backward-Compatible Behaviour — All Shared Touch Points

| Route | Before S14 | After S14 | Admin caller impact |
|---|---|---|---|
| `POST /api/campaigns` | `authenticate` only | `authenticate` + `requireRole('advertiser')` (hierarchical = level ≥ 0) | ✅ Admin (level 4) passes `requireRole('advertiser')`; no change in behaviour |
| `GET /api/campaigns` | No auth, returns all | Optional-chaining guard; advertiser role gets scoped result; all other callers (incl. unauthenticated) get full result | ✅ Admin callers still receive all campaigns; `CampaignManagement.jsx` unaffected |
| `GET /api/campaigns/:id` | No auth, returns any | Ownership check conditional on `req.user?.role === 'advertiser'`; all other callers unaffected | ✅ Admin callers still receive any campaign |
| `PATCH /api/campaigns/:id/status` | `pending_approval→approved/rejected` only | Transition map adds `live`, `paused`, `completed` paths | ✅ Old valid transitions still pass; no existing caller receives a new error |
| `DELETE /api/campaigns/:id` | `authenticate` + `requireRole('superadmin')` | **Unchanged** — CCR-3 hard gate | ✅ No change |

---

## 📊 Confidence Scores (Step 4 updated)

| Story | Step 1 | Step 2 | Step 3 | Step 4 | What is still below 100% | Resolved by |
|---|---|---|---|---|---|---|
| S14-1 · Advertiser role + JWT guard | 75% | 85% | **95%** | **95%** | DECISION-2 (guard type) must be recorded before merge | Record DECISION-2 |
| S14-2 · Campaign CRUD patch | 72% | 82% | **92%** | **92%** | Firestore composite index may be needed in prod; `req.user?.role` optional chaining required in GET handlers | Deploy + verify index; apply optional chaining |
| S14-3 · Advertiser portal UI | 68% | 68% | **72%** | **72%** | Pages directory + ApiService campaign methods unconfirmed | Greps 7 + 8 |
| S14-4 · App.jsx route registration | 90% | 90% | **92%** | **95%** | Frontend role enforcement unconfirmed (Grep 9) | Grep 9 |

---

## Four SRE/QA Rules

1. **No service call without source verification** — every `apiService.X()` call must name the exact existing file and method signature.
2. **Router file is the API authority** — every API story must list the exact `METHOD /path → body shape` as confirmed in `docs/API_ROUTES.md` and the Express router source.
3. **Mutation auth must be falsifiable** — every `POST`, `PUT`, `PATCH`, or `DELETE` AC must explicitly state the required middleware guard.
4. **Enums and sprint docs must be canonical** — `campaigns.status` is **lowercase** (`pending_approval`, `approved`, `live`, `completed`, `paused`). `loops.status` is **UPPERCASE**. Do not conflate.

---

## Guardrails Checklist

| Rule | Required check | ✓ |
|---|---|---|
| **GUARDRAIL-1** Service method exists | Every `apiService.X()` call verified in `ApiService.js` source | ☐ (Grep 8 required for S14-3) |
| **GUARDRAIL-2** Route contract exists | HTTP method, path, body shape confirmed in `docs/API_ROUTES.md` AND Express router source. Doc and code must match. | ☐ |
| **GUARDRAIL-3** Auth guard named in AC | Mutation routes explicitly state `requireRole('X') confirmed` | ☐ |
| **GUARDRAIL-4** Enum values canonical | `campaigns.status` = lowercase; `loops.status` = UPPERCASE | ✅ Confirmed Step 3 |
| **GUARDRAIL-5** Doc placement | This file at `current_sprint/sprint14.md`; linked from `docs/MVP_SPRINT_PLAN.md` | ☐ |
| **GUARDRAIL-6** FIXME count at scoping | FIXME grep run for all files in scope during Step 2, not at implementation time | ☐ |
| **GUARDRAIL-7** Route mount points confirmed | Campaign routes confirmed mounted in `index.js` at `/api/campaigns` before effort estimate set | ☐ |
| **GUARDRAIL-8** Persistence layer confirmed | `CampaignRepository.js` `findAll({ where })` scoping support confirmed ✅ **Step 3 CLOSED** | ✅ |
| **GUARDRAIL-9** API_ROUTES.md vs live code audit | Campaign route auth guards vs live `campaigns.js` confirmed Step 2 | ✅ Done |
| **GUARDRAIL-10** Open decisions close within one sprint | DECISION-1 must resolve this sprint — no third deferral | ☐ |

---

## Pre-Sprint Checklist (remaining after Step 4)

- [x] `'advertiser'` role confirmed in `requireRole.js` ROLE_HIERARCHY
- [x] `campaigns.js` handler map fully read and confirmed (all handlers have real bodies)
- [x] `DELETE /:id` `requireRole('superadmin')` guard confirmed (CCR-3 pre-check)
- [x] **Grep 4 CLOSED** — `CampaignRepository.js` exists (232 B thin wrapper); `BaseRepository.findAll({ where })` confirmed in Firestore + memory paths
- [x] **Grep 5 CLOSED** — `auth.js` JWT payload confirmed: `{ id, email, role, linked_entity_id }` — `role` present, advertiser FK is `linked_entity_id`
- [x] **Grep 6 CLOSED** — Zero `/dashboard/advertiser/*` routes in `App.jsx`. No collision. (Step 4 live read @ `335f1c2`)
- [ ] Grep 7 — `client-app/src/pages/advertiser/` directory scan
- [ ] Grep 8 — `ApiService.js` campaign methods
- [ ] **Grep 9 (NEW — Step 4)** — `DashboardLayout.jsx` role enforcement pattern
- [ ] DECISION-1 resolved (`telemetry.js` L49 guard intent documented or corrected)
- [ ] DECISION-2 resolved (`POST /api/campaigns` hierarchical vs. exclusive guard)
- [ ] S11-1, S11-2, S11-4 persistence tests run in browser
- [ ] `docs/MVP_SPRINT_PLAN.md` Sprint 13 entry added

---

## Known File Inventory (Step 4 updated)

| File | Size / Status | Notes |
|---|---|---|
| `client-app/src/App.jsx` | 11 214 B ✅ | Route authority. **Grep 6 CLOSED** — zero `/dashboard/advertiser/*` routes exist; additive-only. Read @ `335f1c2`. |
| `client-app/src/services/ApiService.js` | ❓ | Campaign methods unconfirmed — Grep 8 required before S14-3. |
| `client-app/src/layouts/DashboardLayout.jsx` | ❓ | Role enforcement pattern unconfirmed — **Grep 9 required before S14-4** (Step 4 finding). |
| `ad-server/src/api/campaigns.js` | 6 323 B ✅ | **Fully read at `3dd8cd2`.** All 7 handlers confirmed. `GET /` and `GET /:id` have NO `authenticate` middleware — use `req.user?.role` optional chaining in S14-2 patches. |
| `ad-server/src/api/telemetry.js` | 5 135 B ✅ | DECISION-1 must resolve L49 this sprint. |
| `ad-server/src/middleware/requireRole.js` | ✅ | `'advertiser': 0` confirmed. No changes needed. |
| `ad-server/src/api/auth.js` | 937 B ✅ | Delegates to `authService.login()`. **JWT payload confirmed Step 3.** ✅ |
| `ad-server/src/services/AuthService.js` | 1 381 B ✅ | JWT: `{ id, email, role, linked_entity_id }`. **`linked_entity_id` is the advertiser FK** — not `advertiserId`. |
| `ad-server/src/repositories/CampaignRepository.js` | 232 B ✅ | **Confirmed Step 3.** 6-line thin wrapper — no custom methods. All persistence via `BaseRepository`. |
| `ad-server/src/repositories/BaseRepository.js` | 6 264 B ✅ | **Confirmed Step 3.** `findAll({ where: [['field', '==', value]] })` works in Firestore + memory. |
| `ad-server/src/services/CampaignService.js` | 1 882 B ✅ | **Confirmed Step 3.** Status update + ad generation only. No ownership logic. |
| `client-app/src/pages/advertiser/AdvertiserDashboard.jsx` | ❓ UNKNOWN | May not exist — Grep 7 required. |
| `client-app/src/pages/advertiser/CampaignRequest.jsx` | ❓ UNKNOWN | May not exist — Grep 7 required. |
| `client-app/src/pages/advertiser/CampaignDetail.jsx` | ❓ UNKNOWN | May not exist — Grep 7 required. |
| `ad-server/src/api/audit.js` | ✅ NEW (Sprint 13) | `POST /api/audit` live @ `dfbeb65`. |
| `ad-server/src/api/impressions.js` | ✅ NEW (Sprint 13) | `GET /api/impressions` live @ `dfbeb65`. |

---

## Cross-Story Dependency Map

```
DECISION-1 (carry-over) ──► must resolve this sprint (GUARDRAIL-10)
DECISION-2 (new S14) ──► must resolve before S14-1 implementation starts
S11-1 / S11-2 / S11-4 persistence tests ──► manual browser tests, carry-over

S14-1 · Advertiser role + JWT + POST guard
  └─► gates S14-2 (POST /api/campaigns must have role guard before UI wires it)
  └─► gates S14-3 (UI must not call unguarded endpoints)
  └─► gates S14-4 (routes cannot fire correctly without role guard)

S14-2 · Campaign CRUD patch
  └─► gates S14-3 (UI depends on scoped GET + transition state machine)
  └─► Step 4 note: use req.user?.role optional chaining in GET handlers

S14-3 · Advertiser portal UI
  └─► gates S14-4 (routes cannot be registered before components exist)

S14-4 · App.jsx route registration
  └─► Grep 9 must close before merge (frontend role enforcement)
  └─► final step; no stories depend on it

CCR-3: campaigns.js DELETE guard survival ──► hard merge gate on S14-2
CCR-4: requireRole.js ROLE_HIERARCHY integrity ──► hard merge gate on S14-1
```

**Recommended implementation order:** S14-1 (XS) → S14-2 (S) → S14-3 (L) → S14-4 (XS)

---

## Test Stabilisation Order

Per `docs/MVP_COMPLETION_SPRINT_PLAN.md`, Sprint 14 ships `advertiser_portal.spec.js` with
minimum 10 tests covering:

1. `POST /api/campaigns` as advertiser → `201 { status: 'pending_approval' }`
2. `GET /api/campaigns` as advertiser → own campaigns only (scoped by `linked_entity_id`)
3. `GET /api/campaigns/:otherId` as different advertiser → `403`
4. `PATCH /api/campaigns/:id/status` invalid transition (`pending_approval` → `live`) → `400 { error, from, to, allowed }`
5. `PATCH /api/campaigns/:id/status` valid transition (`pending_approval` → `approved`) → `200`
6. `PATCH /api/campaigns/:id/status` valid transition (`approved` → `live`) → `200`
7. `PATCH /api/campaigns/:id/status` valid transition (`live` → `paused`) → `200`
8. `DELETE /api/campaigns/:id` as `retaileradmin` → `403`
9. `GET /dashboard/advertiser` as `admin` → `403`
10. `data-testid="campaign-request-form"` present in DOM
11. `data-testid="submit-campaign-btn"` disabled when fields empty

---

## Story Point Summary (Step 4 updated)

| Story | Priority | Effort | Confidence | Status |
|---|---|---|---|---|
| S14-1 · Advertiser role + JWT guard | Critical | XS | **95%** | 🔲 Pending DECISION-2 only |
| S14-2 · Campaign CRUD patch | High | **S** | **92%** | 🔲 Pending S14-1; `req.user?.role` optional chaining required |
| S14-3 · Advertiser portal UI | High | L | **72%** | 🔲 Pending Greps 7 + 8 + S14-2 |
| S14-4 · App.jsx route registration | High | XS | **95%** | 🔲 Pending Grep 9 + S14-3 |

---

## Definition of Done

- [x] **Grep 4 CLOSED** — `CampaignRepository.js` + `BaseRepository.findAll({ where })` confirmed
- [x] **Grep 5 CLOSED** — JWT payload confirmed: `role` + `linked_entity_id` present
- [x] **Grep 6 CLOSED** — Zero `/dashboard/advertiser/*` routes in `App.jsx` confirmed (Step 4)
- [ ] Grep 7 executed; results logged in this doc
- [ ] Grep 8 executed; results logged in this doc
- [ ] **Grep 9 executed** — `DashboardLayout.jsx` role enforcement confirmed or `<ProtectedRoute>` wrapper added (Step 4)
- [ ] **DECISION-1** resolved — `telemetry.js` L49 guard intent documented or corrected. No third deferral.
- [ ] **DECISION-2** resolved — `POST /api/campaigns` guard type (hierarchical vs. exclusive) documented before S14-1 merge.
- [ ] S11-1 persistence test passed (hard-refresh `UserManagement`)
- [ ] S11-2 persistence test passed (hard-refresh `AdvertiserManagement`)
- [ ] S11-4 persistence test passed (hard-refresh Add Location form)
- [ ] **S14-1 DONE** — `requireRole('advertiser')` on `POST /api/campaigns`; CCR-4 gate passed. Commit SHA: ___
- [ ] **S14-2 DONE** — `GET /` scoped by `linked_entity_id` (optional chaining); `GET /:id` ownership check (optional chaining); `PATCH /status` transition state machine; `API_ROUTES.md` updated; CCR-3 gate passed. Commit SHA: ___
- [ ] **CCR-3 gate passed** — `requireRole('superadmin')` grep returns match after S14-2 merge
- [ ] **CCR-4 gate passed** — `ROLE_HIERARCHY` block entry count unchanged after S14-1 merge
- [ ] **S14-3 DONE** — three advertiser pages created/confirmed; all `data-testid` attrs present; loading skeletons; empty states; all `ApiService` methods confirmed before use. Commit SHA: ___
- [ ] **S14-4 DONE** — three routes registered in `App.jsx` with role guard; admin token returns `403` on `/dashboard/advertiser`; Grep 9 closed. Commit SHA: ___
- [ ] `advertiser_portal.spec.js` created with minimum 11 passing tests
- [ ] `docs/MVP_SPRINT_PLAN.md` Sprint 13 entry added
- [ ] `docs/MVP_SPRINT_PLAN.md` Sprint 14 entry added
- [ ] `GUARDRAIL-5`: this file at `current_sprint/sprint14.md`
- [ ] No story marked Done without a commit SHA cited as evidence

---

## Deferred to Sprint 15

- Monetization rules + pricing config UI (`PricingConfig.jsx`, `pricing.js`)
- Invoice generation + advertiser invoice access (`invoices.js`, `Invoices.jsx`)
- `LoopGenerationService.js` priority order confirmation (paid > retailer > internal)

---

## Sprint 14 Carry-Over to Sprint 15 (pre-fill)

| Item | Type | Priority | Notes |
|---|---|---|---|
| S15-1 — Pricing config API + UI | Feature | High | `GET/PATCH /api/pricing/config`, `PricingConfig.jsx` |
| S15-2 — Invoice generation + access | Feature | High | `invoices.js`, `Invoices.jsx`, PDF download |
| S15-3 — Loop priority confirmation | Verification | Medium | Confirm paid > retailer > internal in `LoopGenerationService.js` |

---

*Sprint 14 doc — Step 3 written 2026-06-08. Step 4 written 2026-06-08.*
*Step 3 grounded against live reads: `AuthService.js` @ `de215c1`, `CampaignRepository.js` @ `4e3585d`, `BaseRepository.js` @ `6e3338e`, `CampaignService.js` @ `4cb64bb`, `auth.js` @ `e53a73f`.*
*Step 4 grounded against live reads: `campaigns.js` @ `3dd8cd2`, `App.jsx` @ `335f1c2`.*
*Greps 4 + 5 + 6 CLOSED. Remaining unknowns: advertiser pages directory (Grep 7), `ApiService.js` campaign methods (Grep 8), `DashboardLayout.jsx` role enforcement (Grep 9 — NEW Step 4).*
*Critical correction from Step 3 preserved: JWT advertiser FK field is `linked_entity_id`, not `advertiserId`. Step 4 correction: use `req.user?.role` optional chaining in GET handlers — no `authenticate` middleware on `GET /` or `GET /:id`.*
