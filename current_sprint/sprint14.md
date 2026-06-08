# Sprint 14 — Advertiser Self-Service Portal

**Sprint:** 14
**Status:** ✅ Step 2 — Full AC written from live source
**Cross-referenced with:** `client-app/src/App.jsx` @ `335f1c2`, `ad-server/src/api/` @ `3393144`
**Guardrails authority:** [`docs/sprint8-sre-retro-consolidated.md`](./sprint8-sre-retro-consolidated.md)
**Route authority:** [`docs/API_ROUTES.md`](../docs/API_ROUTES.md)
**Schema authority:** [`docs/DATABASE_SCHEMA.md`](../docs/DATABASE_SCHEMA.md)
**MVP reference:** [`docs/Digital Screen Network Management Platform (MVP).md`](<../docs/Digital Screen Network Management Platform (MVP).md>)
**Completion plan:** [`docs/MVP_COMPLETION_SPRINT_PLAN.md`](../docs/MVP_COMPLETION_SPRINT_PLAN.md)

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
- `auth.js` ✅ (937 B) — JWT source; role claim must be confirmed (grep 5 still required)
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

## 🚨 Sprint 14 New Scope

**MVP Requirement:** §3.4 — Advertisers can upload creatives, create campaign requests, select
preferred locations, track status, view basic performance metrics, access invoices.

### Scoping rationale (updated from Step 2 findings)

Sprint 13 closed four back-end wiring gaps. Sprint 14 opens the **Advertiser Self-Service Portal**.
Step 2 source reads reveal that:
- `advertiser` role is already in `ROLE_HIERARCHY` → S14-1 is a JWT-confirmation + route-guard wiring task only
- `campaigns.js` exists with all route skeletons → S14-2 is a **targeted patch** (auth scoping + transition rules), not a create
- S14-3 and S14-4 remain fully new work

**Updated story order and effort:**
1. **S14-1 (XS)** — Confirm JWT `role: 'advertiser'` claim in `auth.js` + add `requireRole('advertiser')` to `POST /api/campaigns`
2. **S14-2 (S–M)** — Patch `campaigns.js`: scope `GET /` and `GET /:id` to caller ownership, add `requireRole('advertiser')` to `POST /`, extend valid transition list
3. **S14-3 (L)** — Three advertiser portal pages (directory + component existence still unconfirmed — grep 7 required)
4. **S14-4 (XS)** — `App.jsx` route registration (advertiser route existence still unconfirmed — grep 6 required)

---

## 🛡️ S14-1 · Advertiser Role Confirmation + JWT Guard

**Priority:** Critical (gate for all other stories)
**Effort:** XS _(downgraded from XS–S: `'advertiser'` already in `ROLE_HIERARCHY`)_
**Confidence:** 85% _(upgraded from 75%: role hierarchy confirmed; JWT claim still unverified)_
**MVP section:** §3.4

### Step 2 findings

✅ `'advertiser': 0` confirmed in `requireRole.js` `ROLE_HIERARCHY`.
❓ JWT role claim in `auth.js` (937 B) — **not yet read; grep 5 required before implementation.**

### Remaining pre-implementation gate (grep 5 only)

```powershell
# 5. Does advertiser login produce a JWT with role='advertiser'?
Select-String -Path "ad-server/src/api/auth.js" -Pattern "role|advertiser" -Context 2,2
```

**Decision tree (updated):**

| Finding | Action |
|---|---|
| JWT payload includes `role` field set from user record | Confirm user record has `role: 'advertiser'` → S14-1 is XS |
| JWT payload does not include `role` field | Patch `auth.js` to include role in token — effort stays XS |
| `auth.js` hardcodes role | Must patch to use user record role value |

### What S14-1 must wire

- Add `requireRole('advertiser')` to `POST /api/campaigns` in `campaigns.js`
  - Currently guarded by `authenticate` only → any authenticated user can create campaigns
  - After patch: only `advertiser` role (level 0) and above can create
  - ⚠️ **`requireRole` is hierarchical** — `advertiser: 0` means every role ≥ 0 passes. This means `retaileradmin`, `admin`, and `superadmin` will also pass. If campaign creation should be advertiser-exclusive, a role equality check is needed instead of `requireRole`. Raise as sub-decision before implementation.

### Acceptance Criteria

| # | Criterion | Guardrail |
|---|---|---|
| AC-1 | `Select-String -Path "ad-server/src/middleware/requireRole.js" -Pattern "'advertiser'"` returns a match. ✅ Already confirmed. | GUARDRAIL-3 |
| AC-2 | Login request for an advertiser-type user returns a JWT where `role === 'advertiser'`. Verify: `curl -X POST /api/auth/login -d '{"email":"advertiser@test.com","password":"..."}' \| jq '.token'` decoded contains `"role":"advertiser"`. | GUARDRAIL-3 |
| AC-3 | `POST /api/campaigns` with a valid `retaileradmin` token → `403` (if role-exclusive guard chosen) OR `201` (if hierarchical guard chosen). Decision must be recorded before implementation. | GUARDRAIL-3 |
| AC-4 | `requireRole('advertiser')` middleware added to `POST /api/campaigns` route line in `campaigns.js`. `Select-String -Path "ad-server/src/api/campaigns.js" -Pattern "requireRole.*advertiser"` returns a match. | GUARDRAIL-3 |
| AC-5 | `ROLE_HIERARCHY` block entry count in `requireRole.js` unchanged (6 entries). `CCR-4` gate passed. | GUARDRAIL-3 |

### Files expected to touch

- `ad-server/src/api/campaigns.js` — add `requireRole('advertiser')` to `POST /` handler
- `ad-server/src/api/auth.js` — confirm or patch JWT role claim
- No frontend changes in this story

---

## 🛡️ S14-2 · Campaign CRUD API Patch

**Priority:** High
**Effort:** S–M _(downgraded from M: file exists with all skeletons; work is targeted patching)_
**Confidence:** 82% _(upgraded from 72%: handler map confirmed; `CampaignRepository` existence still unknown)_
**MVP section:** §3.4

### Step 2 findings

**Confirmed handlers (all have real bodies, not stubs):**
- `GET /` — ✅ exists; ⚠️ returns all campaigns regardless of caller; needs ownership scoping
- `GET /:id` — ✅ exists; ⚠️ no ownership check; any caller can read any campaign
- `POST /` — ✅ exists; ⚠️ only `authenticate`, no `requireRole`; needs advertiser guard (S14-1)
- `POST /:id/book` — ✅ exists; slot booking; out of scope for this story
- `PATCH /:id/status` — ✅ exists; `requireRole('retaileradmin')`; allowlist is `['approved', 'rejected', 'pending_approval']` only — `live`, `completed`, `paused` missing
- `PUT /:id` — ✅ exists; `authenticate` only; no ownership check
- `DELETE /:id` — ✅ `authenticate` + `requireRole('superadmin')` confirmed ✅ CCR-3

**Remaining unknown:** `CampaignRepository.js` — whether `findAll()` supports `advertiserId` scoping filter. Grep 4 required.

```powershell
# 4. Does CampaignRepository.js exist and support advertiserId filter?
Get-ChildItem -Path "ad-server/src/repositories" -Filter "*.js" | Select-Object Name
Select-String -Path "ad-server/src/repositories/CampaignRepository.js" -Pattern "advertiserId|findAll|where" -Context 2,2
```

### Patches required in `campaigns.js`

#### Patch 1 — `GET /` ownership scoping
```js
// Before (current — returns all campaigns):
campaigns = await campaignRepository.findAll();

// After — scope to caller's advertiserId unless admin+:
if (req.user.role === 'advertiser') {
    campaigns = await campaignRepository.findAll({
        where: [['advertiser_id', '==', req.user.advertiserId]]
    });
} else {
    // admin and above see all (existing behaviour preserved)
    campaigns = await campaignRepository.findAll( /* existing filter logic */ );
}
```

#### Patch 2 — `GET /:id` ownership check
```js
// After fetching campaign, add ownership guard:
if (req.user.role === 'advertiser' && campaign.advertiser_id !== req.user.advertiserId) {
    return res.status(403).json({ error: 'Forbidden' });
}
```

#### Patch 3 — `PATCH /:id/status` valid transition extension
Current allowlist: `['approved', 'rejected', 'pending_approval']`
Required allowlist: `['approved', 'rejected', 'pending_approval', 'live', 'completed', 'paused']`

Ordered transition rules (state machine — replace current flat allowlist):
```
pending_approval → approved
pending_approval → rejected
approved         → live
live             → completed
live             → paused
paused           → live   (resume)
```

All other transitions → `400 { error: 'Invalid status transition', from: current, to: requested }`.

### Route contract (canonical — must match `API_ROUTES.md` after close)

| Method | Path | Auth | Ownership scoping | Response |
|---|---|---|---|---|
| `POST` | `/api/campaigns` | `authenticate` + `requireRole('advertiser')` | `advertiser_id` from token | `201 { campaignId, status: 'pending_approval' }` |
| `GET` | `/api/campaigns` | `authenticate` | Advertiser: own campaigns only. Admin+: all. | `200 [{ … }]` |
| `GET` | `/api/campaigns/:id` | `authenticate` | Advertiser: 403 if `advertiser_id` mismatch. Admin+: any. | `200 { … }` or `403` |
| `PATCH` | `/api/campaigns/:id/status` | `requireRole('retaileradmin')` | No change — admin gate preserved | `200 { campaignId, status }` or `400` on invalid transition |
| `DELETE` | `/api/campaigns/:id` | `authenticate` + `requireRole('superadmin')` | ✅ CCR-3 confirmed — do not touch | `204` |

### Acceptance Criteria

| # | Criterion | Guardrail |
|---|---|---|
| AC-1 | `GET /api/campaigns` as role `advertiser` → response array contains only campaigns where `advertiser_id === token.advertiserId`. Verified: no foreign `advertiserId` in response. | GUARDRAIL-3 |
| AC-2 | `GET /api/campaigns/:id` as a different advertiser → `403`. | GUARDRAIL-3 |
| AC-3 | `GET /api/campaigns/:id` as `admin` for any campaign → `200`. | GUARDRAIL-3 |
| AC-4 | `PATCH /api/campaigns/:id/status` with `{ status: 'live' }` when current status is `pending_approval` → `400 { error: 'Invalid status transition' }`. | GUARDRAIL-2 |
| AC-5 | `PATCH /api/campaigns/:id/status` with `{ status: 'approved' }` when current status is `pending_approval` → `200 { campaignId, status: 'approved' }`. | GUARDRAIL-2 |
| AC-6 | `PATCH /api/campaigns/:id/status` with `{ status: 'live' }` when current status is `approved` → `200 { campaignId, status: 'live' }`. | GUARDRAIL-2 |
| AC-7 | `DELETE /api/campaigns/:id` as `retaileradmin` → `403`. _(CCR-3 guard unchanged.)_ | GUARDRAIL-3 |
| AC-8 | `Select-String -Path "ad-server/src/api/campaigns.js" -Pattern "requireRole.*superadmin"` returns match after S14-2 merge. **CCR-3 hard gate.** | GUARDRAIL-3 |
| AC-9 | `Select-String -Path "ad-server/src/api/campaigns.js" -Pattern "'pending_approval'\|'approved'\|'live'\|'completed'\|'paused'"` returns matches only — no uppercase status values. | GUARDRAIL-4 |
| AC-10 | `docs/API_ROUTES.md` campaigns section updated with all five routes, correct auth guards, scoping rules, and body shapes. | GUARDRAIL-2 |

### Files expected to touch

- `ad-server/src/api/campaigns.js` — Patch 1 (GET scoping), Patch 2 (ownership check), Patch 3 (transition state machine)
- `ad-server/src/repositories/CampaignRepository.js` — confirm `findAll({ where })` supports `advertiser_id` filter; extend if absent
- `docs/API_ROUTES.md` — update campaigns section

### CCR-3 — `campaigns.js` DELETE guard must survive S14-2

`requireRole('superadmin')` on `DELETE /:id` confirmed at `3393144`. Must survive all S14-2 changes.

**Gate:** After S14-2 merge, run:
```powershell
Select-String -Path "ad-server/src/api/campaigns.js" -Pattern "requireRole.*superadmin"
```
Must return a match. Hard merge gate — story cannot be marked Done without this match.

---

## 🛡️ S14-3 · Advertiser Portal UI

**Priority:** High
**Effort:** L
**Confidence:** 68% _(unchanged — advertiser JSX directory existence still unconfirmed; grep 7 required)_
**MVP section:** §3.4

### Remaining pre-implementation gates (greps 7 + 8)

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
| AC-8 | All `ApiService` campaign methods used are confirmed in `client-app/src/services/ApiService.js` before use. | GUARDRAIL-1 |

### Files expected to touch

- `client-app/src/pages/advertiser/AdvertiserDashboard.jsx` — create (or extend)
- `client-app/src/pages/advertiser/CampaignRequest.jsx` — create (or extend)
- `client-app/src/pages/advertiser/CampaignDetail.jsx` — create (or extend)
- `client-app/src/services/ApiService.js` — add campaign methods if absent

---

## 🛡️ S14-4 · App.jsx Route Registration

**Priority:** High
**Effort:** XS
**Confidence:** 90% _(unchanged — route existence still unconfirmed; grep 6 required)_
**MVP section:** §3.4

### Remaining pre-implementation gate (grep 6)

```powershell
# 6. Which /dashboard/advertiser/* routes (if any) are already in App.jsx?
Select-String -Path "client-app/src/App.jsx" -Pattern "advertiser" -Context 1,1
```

### Routes to register

| Route | Component | Role Guard |
|---|---|---|
| `/dashboard/advertiser` | `AdvertiserDashboard.jsx` | `requireRole('advertiser')` |
| `/dashboard/advertiser/campaigns/new` | `CampaignRequest.jsx` | `requireRole('advertiser')` |
| `/dashboard/advertiser/campaigns/:id` | `CampaignDetail.jsx` | `requireRole('advertiser')` |

### Acceptance Criteria

| # | Criterion | Guardrail |
|---|---|---|
| AC-1 | `GET /dashboard/advertiser` as role `admin` → `403` (route guard fires). | GUARDRAIL-3 |
| AC-2 | `GET /dashboard/advertiser` as role `advertiser` → renders `AdvertiserDashboard.jsx`. | GUARDRAIL-1 |
| AC-3 | `Select-String -Path "client-app/src/App.jsx" -Pattern "advertiser"` returns matches for all three routes. | GUARDRAIL-1 |
| AC-4 | No existing non-advertiser routes are moved or removed from `App.jsx`. | — |
| AC-5 | `App.jsx` line count delta is ≤ 20 lines. If larger, flag for review — scope may have crept. | — |

### Files expected to touch

- `client-app/src/App.jsx` — add three route entries with `requireRole('advertiser')` guard
- No backend changes in this story

---

## 📊 Confidence Scores (Step 2 updated)

| Story | Step 1 | Step 2 | What is still below 100% | Resolved by |
|---|---|---|---|---|
| S14-1 · Advertiser role + JWT guard | 75% | **85%** | JWT claim in `auth.js` unread | Grep 5 |
| S14-2 · Campaign CRUD API | 72% | **82%** | `CampaignRepository` scoping support unknown | Grep 4 |
| S14-3 · Advertiser portal UI | 68% | **68%** | Pages directory + ApiService campaign methods unconfirmed | Greps 7 + 8 |
| S14-4 · App.jsx route registration | 90% | **90%** | Existing advertiser routes unknown | Grep 6 |

---

## 🛡️ Step 4 — Isolation Audit

### Blast-Radius Table (Step 2 updated)

| Story | Files Touched | Change Type | Shared Infra? | Risk | Verdict |
|---|---|---|---|---|---|
| **S14-1** · Advertiser role + JWT | `campaigns.js` (add guard), `auth.js` (confirm claim) | Additive | `campaigns.js` shared | Low | ✅ Safe — adding middleware to one route doesn't affect other routes |
| **S14-2** · Campaign CRUD patch | `campaigns.js` (patch 3 handlers), `CampaignRepository.js` | Targeted patch | `campaigns.js` shared across all callers | ⚠️ Medium | ✅ Safe **if** existing handler response shapes are preserved. Scoping adds a branch — must not change response shape for admin callers. |
| **S14-3** · Advertiser portal UI | New JSX files, `ApiService.js` | New files + additive | `ApiService.js` shared | Low | ✅ Safe — additive methods only |
| **S14-4** · App.jsx routes | `App.jsx` | Additive | Route authority | Low | ✅ Safe if additive only |

### CCR-3 — `campaigns.js` DELETE guard survival (S14-2)

After S14-2 merge:
```powershell
Select-String -Path "ad-server/src/api/campaigns.js" -Pattern "requireRole.*superadmin"
```
Must return a match. **Hard merge gate.**

### CCR-4 — `requireRole.js` ROLE_HIERARCHY integrity (S14-1)

`ROLE_HIERARCHY` has 6 entries at `3393144`. Count must not decrease after S14-1.
```powershell
Select-String -Path "ad-server/src/middleware/requireRole.js" -Pattern "ROLE_HIERARCHY" -Context 10,10
```

### New sub-decision required before S14-1 implementation

**DECISION-2 — `POST /api/campaigns` role guard: hierarchical vs. exclusive?**

`requireRole('advertiser')` is hierarchical — it allows any role ≥ level 0, meaning `retaileradmin`,
`admin`, and `superadmin` can also create campaigns. If campaign creation should be
advertiser-type users only, a role equality check (`req.user.role === 'advertiser'`) is needed instead.

| Option | Who can create campaigns | Recommended? |
|---|---|---|
| `requireRole('advertiser')` (hierarchical) | advertiser + all higher roles | ✅ Default — admin oversight preserved |
| `req.user.role === 'advertiser'` (exclusive) | advertiser only | Use if §3.4 explicitly prohibits admin campaign creation |

**Record choice in DECISION-2-RESOLVED below before S14-1 merge.**

**DECISION-2-RESOLVED:** _(fill in before implementation)_

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
| **GUARDRAIL-1** Service method exists | Every `apiService.X()` call verified in `ApiService.js` source | ☐ |
| **GUARDRAIL-2** Route contract exists | HTTP method, path, body shape confirmed in `docs/API_ROUTES.md` AND Express router source. Doc and code must match. | ☐ |
| **GUARDRAIL-3** Auth guard named in AC | Mutation routes explicitly state `requireRole('X') confirmed` | ☐ |
| **GUARDRAIL-4** Enum values canonical | `campaigns.status` = lowercase; `loops.status` = UPPERCASE | ☐ |
| **GUARDRAIL-5** Doc placement | This file at `current_sprint/sprint14.md`; linked from `docs/MVP_SPRINT_PLAN.md` | ☐ |
| **GUARDRAIL-6** FIXME count at scoping | FIXME grep run for all files in scope during Step 2, not at implementation time | ☐ |
| **GUARDRAIL-7** Route mount points confirmed | Campaign routes confirmed mounted in `index.js` at `/api/campaigns` before effort estimate set | ☐ |
| **GUARDRAIL-8** Persistence layer confirmed | `CampaignRepository.js` `findAll({ where })` scoping support confirmed via grep 4 | ☐ |
| **GUARDRAIL-9** API_ROUTES.md vs live code audit | Campaign route auth guards vs live `campaigns.js` confirmed above | ✅ Done (Step 2) |
| **GUARDRAIL-10** Open decisions close within one sprint | DECISION-1 must resolve this sprint — no third deferral | ☐ |

---

## Pre-Sprint Checklist (remaining after Step 2)

- [x] `'advertiser'` role confirmed in `requireRole.js` ROLE_HIERARCHY
- [x] `campaigns.js` handler map fully read and confirmed (all handlers have real bodies)
- [x] `DELETE /:id` `requireRole('superadmin')` guard confirmed (CCR-3 pre-check)
- [ ] Grep 4 — `CampaignRepository.js` existence + `findAll` scoping support
- [ ] Grep 5 — `auth.js` JWT role claim for advertiser login
- [ ] Grep 6 — `App.jsx` existing advertiser routes
- [ ] Grep 7 — `client-app/src/pages/advertiser/` directory scan
- [ ] Grep 8 — `ApiService.js` campaign methods
- [ ] DECISION-1 resolved (`telemetry.js` L49 guard intent documented or corrected)
- [ ] DECISION-2 resolved (`POST /api/campaigns` hierarchical vs. exclusive guard)
- [ ] S11-1, S11-2, S11-4 persistence tests run in browser
- [ ] `docs/MVP_SPRINT_PLAN.md` Sprint 13 entry added

---

## Known File Inventory (Step 2 confirmed)

| File | Size / Status | Notes |
|---|---|---|
| `client-app/src/App.jsx` | 11 214 B ✅ | Route authority. Add three advertiser routes in S14-4. |
| `client-app/src/services/ApiService.js` | ❓ | Campaign methods unconfirmed — grep 8 required before S14-3. |
| `ad-server/src/api/campaigns.js` | 6 323 B ✅ | **Fully read at `3393144`.** All 7 handlers confirmed with real bodies. Patch target for S14-1 + S14-2. |
| `ad-server/src/api/telemetry.js` | 5 135 B ✅ | DECISION-1 must resolve L49 this sprint. |
| `ad-server/src/middleware/requireRole.js` | ✅ | `'advertiser': 0` confirmed in ROLE_HIERARCHY. No changes needed for role itself. |
| `ad-server/src/api/auth.js` | 937 B ✅ | JWT role claim for advertiser login must be confirmed (grep 5). |
| `ad-server/src/repositories/CampaignRepository.js` | ❓ UNKNOWN | Existence unconfirmed — grep 4 required. `findAll({ where: [['advertiser_id', '==', id]] })` pattern needed for S14-2 Patch 1. |
| `client-app/src/pages/advertiser/AdvertiserDashboard.jsx` | ❓ UNKNOWN | May not exist — grep 7 required. |
| `client-app/src/pages/advertiser/CampaignRequest.jsx` | ❓ UNKNOWN | May not exist — grep 7 required. |
| `client-app/src/pages/advertiser/CampaignDetail.jsx` | ❓ UNKNOWN | May not exist — grep 7 required. |
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
  └─► gates S14-3 (UI must not call ungarded endpoints)
  └─► gates S14-4 (routes cannot fire correctly without role guard)

S14-2 · Campaign CRUD patch
  └─► gates S14-3 (UI depends on scoped GET + transition state machine)

S14-3 · Advertiser portal UI
  └─► gates S14-4 (routes cannot be registered before components exist)

S14-4 · App.jsx route registration
  └─► final step; no stories depend on it

CCR-3: campaigns.js DELETE guard survival ──► hard merge gate on S14-2
CCR-4: requireRole.js ROLE_HIERARCHY integrity ──► hard merge gate on S14-1
```

**Recommended implementation order:** S14-1 (XS) → S14-2 (S–M) → S14-3 (L) → S14-4 (XS)

---

## Test Stabilisation Order

Per `docs/MVP_COMPLETION_SPRINT_PLAN.md`, Sprint 14 ships `advertiser_portal.spec.js` with
minimum 10 tests covering:

1. `POST /api/campaigns` as advertiser → `201 { status: 'pending_approval' }`
2. `GET /api/campaigns` as advertiser → own campaigns only
3. `GET /api/campaigns/:otherId` as different advertiser → `403`
4. `PATCH /api/campaigns/:id/status` invalid transition (`pending_approval` → `live`) → `400`
5. `PATCH /api/campaigns/:id/status` valid transition (`pending_approval` → `approved`) → `200`
6. `PATCH /api/campaigns/:id/status` valid transition (`approved` → `live`) → `200`
7. `DELETE /api/campaigns/:id` as `retaileradmin` → `403`
8. `GET /dashboard/advertiser` as `admin` → `403`
9. `data-testid="campaign-request-form"` present in DOM
10. `data-testid="submit-campaign-btn"` disabled when fields empty

---

## Story Point Summary (Step 2 updated)

| Story | Priority | Effort | Confidence | Status |
|---|---|---|---|---|
| S14-1 · Advertiser role + JWT guard | Critical | XS | 85% | 🔲 Pending greps 5 + DECISION-2 |
| S14-2 · Campaign CRUD patch | High | S–M | 82% | 🔲 Pending grep 4 + S14-1 |
| S14-3 · Advertiser portal UI | High | L | 68% | 🔲 Pending greps 7 + 8 + S14-2 |
| S14-4 · App.jsx route registration | High | XS | 90% | 🔲 Pending grep 6 + S14-3 |

---

## Definition of Done

- [ ] Greps 4, 5, 6, 7, 8 executed; results logged in this doc (greps 1–3, 9 ✅ resolved in Step 2)
- [ ] **DECISION-1** resolved — `telemetry.js` L49 guard intent documented or corrected. No third deferral.
- [ ] **DECISION-2** resolved — `POST /api/campaigns` guard type (hierarchical vs. exclusive) documented before S14-1 merge.
- [ ] S11-1 persistence test passed (hard-refresh `UserManagement`)
- [ ] S11-2 persistence test passed (hard-refresh `AdvertiserManagement`)
- [ ] S11-4 persistence test passed (hard-refresh Add Location form)
- [ ] **S14-1 DONE** — `requireRole('advertiser')` on `POST /api/campaigns`; JWT includes `role: 'advertiser'`; CCR-4 gate passed. Commit SHA: ___
- [ ] **S14-2 DONE** — `GET /` ownership scoped; `GET /:id` ownership check; `PATCH /status` transition state machine extended; `API_ROUTES.md` updated; lowercase enum confirmed; CCR-3 gate passed. Commit SHA: ___
- [ ] **CCR-3 gate passed** — `requireRole('superadmin')` grep returns match after S14-2 merge
- [ ] **CCR-4 gate passed** — `ROLE_HIERARCHY` block entry count unchanged after S14-1 merge
- [ ] **S14-3 DONE** — three advertiser pages created/confirmed; all `data-testid` attrs present; loading skeletons present; empty states designed; all `ApiService` methods confirmed before use. Commit SHA: ___
- [ ] **S14-4 DONE** — three routes registered in `App.jsx` with `requireRole('advertiser')` guard; admin token returns `403` on `/dashboard/advertiser`. Commit SHA: ___
- [ ] `advertiser_portal.spec.js` created with minimum 10 passing tests
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

*Sprint 14 doc — Step 2 written 2026-06-08.*
*Grounded against live reads: `requireRole.js` @ `3393144` (role hierarchy confirmed), `campaigns.js` @ `3393144` (all 7 handlers confirmed), `ad-server/src/api/` directory @ `3393144` (22 files inventoried).*
*Remaining unknowns: `CampaignRepository.js` (grep 4), `auth.js` JWT claim (grep 5), `App.jsx` advertiser routes (grep 6), advertiser pages directory (grep 7), `ApiService.js` campaign methods (grep 8).*
