# Sprint 14 — Advertiser Self-Service Portal

**Sprint:** 14
**Status:** 🔲 Step 1 — Repository Reality Check pending
**Cross-referenced with:** `client-app/src/App.jsx` @ `335f1c2`, `ad-server/src/api/` @ `294fd25`
**Guardrails authority:** [`docs/sprint8-sre-retro-consolidated.md`](./sprint8-sre-retro-consolidated.md)
**Route authority:** [`docs/API_ROUTES.md`](../docs/API_ROUTES.md)
**Schema authority:** [`docs/DATABASE_SCHEMA.md`](../docs/DATABASE_SCHEMA.md)
**MVP reference:** [`docs/Digital Screen Network Management Platform (MVP).md`](<../docs/Digital Screen Network Management Platform (MVP).md>)
**Completion plan:** [`docs/MVP_COMPLETION_SPRINT_PLAN.md`](../docs/MVP_COMPLETION_SPRINT_PLAN.md)

---

## Sprint 13 Carry-Overs

These items were not closeable from source alone and must be resolved before or during Sprint 14.

| Item | Type | Priority | Gate |
|---|---|---|---|
| **DECISION-1** — NODE_ENV guard `!== 'production'` vs `!== 'test'` in `telemetry.js` L49 | Decision | High | Must close this sprint — deferred twice already (GUARDRAIL-10). No production regression. |
| **S11-1** — Super Admin CRUD Users & Retailers persistence test | Manual QA gate | Critical | Hard-refresh `UserManagement` form in browser; confirm data survives. |
| **S11-2** — Super Admin CRUD Advertisers persistence test | Manual QA gate | Critical | Hard-refresh `AdvertiserManagement` form in browser; confirm data survives. |
| **S11-4** — Add Location persistence test | Manual QA gate | High | Hard-refresh Add Location form in browser; confirm data survives. |
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
- **Option A (code fix):** Change L49 to `!== 'test'`. One-line change. Closes the gap between spec and live code. Recommended.
- **Option B (doc decision):** Document that `!== 'production'` is the intentional behaviour. Update spec to match. If chosen, add DECISION-1-RESOLVED note below.

**DECISION-1-RESOLVED:** _(fill in before sprint close)_

---

## 🚨 Sprint 14 New Scope

**MVP Requirement:** §3.4 — Advertisers can upload creatives, create campaign requests, select
preferred locations, track status, view basic performance metrics, access invoices.

### Scoping rationale

Sprint 13 closed four back-end wiring gaps (audit log, loop reject/approve-all, DELETE guard doc,
impression persistence). Sprint 14 now opens the **Advertiser Self-Service Portal** — the
largest unimplemented user-facing surface in the MVP. Four stories cover the full §3.4 surface:

1. **S14-1** — Advertiser role + JWT guard confirmation and `requireRole('advertiser')` wiring
2. **S14-2** — Campaign CRUD API (`POST`, `GET`, `PATCH /api/campaigns`) — scope-isolated per advertiser
3. **S14-3** — Advertiser portal UI: `AdvertiserDashboard.jsx`, `CampaignRequest.jsx`, `CampaignDetail.jsx`
4. **S14-4** — `App.jsx` route registration for all `/dashboard/advertiser/*` routes with role guard

---

## Step 1 — Repository Reality Check (mandatory before writing code)

Run ALL blocks below before estimating effort or writing a line of implementation code.

### Pre-work discovery greps

```powershell
# 1. Confirm advertiser role value used in requireRole()
Select-String -Path "ad-server/src/middleware/requireRole.js" -Pattern "advertiser|ROLE_HIERARCHY" -Context 3,3

# 2. Does campaigns.js already exist?
Get-ChildItem -Path "ad-server/src/api" -Filter "campaigns.js"

# 3. What's in campaigns.js if it exists? (read before touching)
Select-String -Path "ad-server/src/api/campaigns.js" -Pattern "router\.|requireRole|status" -Context 2,2

# 4. Does CampaignRepository.js exist?
Get-ChildItem -Path "ad-server/src/repositories" -Filter "*.js" | Select-Object Name

# 5. Does advertiser login produce a JWT with role='advertiser'?
Select-String -Path "ad-server/src/api/auth.js" -Pattern "role|advertiser" -Context 2,2

# 6. Which /dashboard/advertiser/* routes (if any) are already in App.jsx?
Select-String -Path "client-app/src/App.jsx" -Pattern "advertiser" -Context 1,1

# 7. Do AdvertiserDashboard, CampaignRequest, or CampaignDetail already exist on disk?
Get-ChildItem -Path "client-app/src/pages/advertiser" -ErrorAction SilentlyContinue

# 8. Does ApiService.js have campaign or advertiser methods?
Select-String -Path "client-app/src/services/ApiService.js" -Pattern "campaign|advertiser" -Context 1,1

# 9. One-pass API_ROUTES.md vs live code for all campaign routes (GUARDRAIL-9)
Select-String -Path "ad-server/src/api/campaigns.js" -Pattern "requireRole|router\.(get|post|patch|delete|put)" -Context 1,1

# 10. FIXME count in any advertiser-related files already on disk (GUARDRAIL-6)
Select-String -Path "client-app/src" -Recurse -Include "*.jsx","*.js" -Pattern "FIXME.*advertiser|advertiser.*FIXME"
```

### What the greps will determine

| Finding | Action |
|---|---|
| `'advertiser'` in `ROLE_HIERARCHY` | Role confirmed — proceed |
| `'advertiser'` not in `ROLE_HIERARCHY` | S14-1 must add it before any role guard can fire — effort +M |
| `campaigns.js` already exists with handlers | Read fully before writing — S14-2 may be a patch, not a create |
| `campaigns.js` exists but is a stub | Implement handlers only |
| `campaigns.js` absent | Create full file — effort M as planned |
| `CampaignRepository.js` exists | Read before creating — may only need extension |
| `advertiser` routes already in `App.jsx` | Confirm they work; S14-4 scope reduces |
| `advertiser/` directory exists with JSX files | Read each before planning S14-3 |
| `ApiService.js` already has campaign methods | S14-3 can wire directly — saves 1 sub-task |
| Auth JWT does not include `role='advertiser'` | S14-1 must patch `auth.js` — adds blast radius |

---

## 🛡️ S14-1 · Advertiser Role Confirmation + JWT Guard

**Priority:** Critical (gate for all other stories)
**Effort:** XS–S (depends on grep 1 and grep 5)
**Confidence:** 75% (unknown whether `'advertiser'` is already in `ROLE_HIERARCHY` and JWT payload)
**MVP section:** §3.4

### Context

All S14 stories depend on `requireRole('advertiser')` being a valid, callable guard. If
`'advertiser'` is absent from `ROLE_HIERARCHY` in `requireRole.js`, or if the JWT issued
by `auth.js` does not set `role: 'advertiser'` for advertiser-type users, every downstream
story will silently fail with `403` regardless of the implementation.

### Pre-implementation Step 1 (mandatory — run greps 1 and 5 above first)

**Decision tree:**

| Finding | Action |
|---|---|
| `'advertiser'` in `ROLE_HIERARCHY` AND JWT sets `role: 'advertiser'` | S14-1 is a confirmation-only task — XS effort |
| `'advertiser'` in `ROLE_HIERARCHY` but JWT does not include it | Patch `auth.js` to include role in token payload — S effort |
| `'advertiser'` absent from `ROLE_HIERARCHY` | Add to hierarchy, add to JWT — M effort; open DECISION-2 |

### Acceptance Criteria

| # | Criterion | Guardrail |
|---|---|---|
| AC-1 | `Select-String -Path "ad-server/src/middleware/requireRole.js" -Pattern "'advertiser'"` returns a match. | GUARDRAIL-3 |
| AC-2 | Login request for an advertiser-type user returns a JWT where `role === 'advertiser'`. Verified: `curl -X POST /api/auth/login -d '{"email":"advertiser@test.com","password":"..."}' \| jq '.token' \| jwt-decode \| grep role`. | GUARDRAIL-3 |
| AC-3 | `requireRole('advertiser')` on any route returns `403` for a valid `retaileradmin` token. | GUARDRAIL-3 |
| AC-4 | If `ROLE_HIERARCHY` is changed, `Select-String -Path "ad-server/src/middleware/requireRole.js" -Pattern "ROLE_HIERARCHY"` block count is unchanged (no existing role removed). | GUARDRAIL-3 |

### Files expected to touch

- `ad-server/src/middleware/requireRole.js` — confirm or add `'advertiser'`
- `ad-server/src/api/auth.js` — confirm or patch JWT role claim
- No frontend changes in this story

---

## 🛡️ S14-2 · Campaign CRUD API

**Priority:** High
**Effort:** M
**Confidence:** 72% (handler state in `campaigns.js` unknown until grep 3)
**MVP section:** §3.4

### Context

`campaigns.js` may already exist (it was referenced in Sprint 13 S13-3 for the DELETE guard).
That sprint confirmed `requireRole('superadmin')` at L187 — meaning the file has at least
`DELETE /:id`. The `POST`, `GET`, and `PATCH /status` handlers needed for §3.4 advertiser
workflow must be confirmed before any implementation.

### Pre-implementation Step 1 (mandatory — run grep 3 and grep 9 above first)

**Decision tree:**

| Finding | Action |
|---|---|
| `POST /`, `GET /`, `GET /:id`, `PATCH /:id/status` all have handler bodies | Confirm + wire frontend only — S effort |
| Some handlers exist as stubs | Implement bodies only — M effort |
| `POST /` and `PATCH /:id/status` absent | Create handlers — M effort as planned |
| `CampaignRepository.js` absent | Create it as part of this story |

### Route contract (canonical — must match `API_ROUTES.md` after close)

| Method | Path | Auth | Body / Params | Response |
|---|---|---|---|---|
| `POST` | `/api/campaigns` | `requireRole('advertiser')` | `{ name, advertiserId, budget, startDate, endDate, targetLocationIds[], creativeAssetIds[] }` | `201 { campaignId, status: 'pending_approval' }` |
| `GET` | `/api/campaigns` | `requireAuth` | `?status=`, `?advertiserId=` (admin only) | `200 [{ campaignId, name, status, … }]` |
| `GET` | `/api/campaigns/:id` | `requireAuth` | — | `200 { … }` or `403` if wrong advertiser |
| `PATCH` | `/api/campaigns/:id/status` | `requireRole('admin')` | `{ status }` | `200 { campaignId, status }` or `400` on invalid transition |
| `DELETE` | `/api/campaigns/:id` | `requireRole('superadmin')` | — | `204` _(confirmed L187 @ Sprint 13)_ |

### Status transition rules (canonical)

Valid transitions only:
- `pending_approval` → `approved`
- `approved` → `live`
- `live` → `completed`
- any → `paused`

All other transitions → `400 { error: 'Invalid status transition' }`.

> **Enum note:** `campaigns.status` is **lowercase** (`pending_approval`, `approved`, `live`,
> `completed`, `paused`). Do not use uppercase. See Sprint 13 Enum Bug Log.

### Acceptance Criteria

| # | Criterion | Guardrail |
|---|---|---|
| AC-1 | `POST /api/campaigns` as role `advertiser` → `201 { campaignId, status: 'pending_approval' }`. | GUARDRAIL-2, GUARDRAIL-3 |
| AC-2 | `GET /api/campaigns` as role `advertiser` → returns only that advertiser's own campaigns (verified: response array contains no `advertiserId` other than the token's). | GUARDRAIL-3 |
| AC-3 | `GET /api/campaigns/:id` as a different advertiser → `403`. | GUARDRAIL-3 |
| AC-4 | `PATCH /api/campaigns/:id/status` with `{ status: 'live' }` when current status is `pending_approval` → `400 { error: 'Invalid status transition' }`. | GUARDRAIL-2 |
| AC-5 | `PATCH /api/campaigns/:id/status` with `{ status: 'approved' }` when current status is `pending_approval` → `200 { campaignId, status: 'approved' }`. | GUARDRAIL-2 |
| AC-6 | `DELETE /api/campaigns/:id` as role `retaileradmin` → `403`. _(Guard confirmed L187; do not change.)_ | GUARDRAIL-3 |
| AC-7 | `Select-String -Path "ad-server/src/api/campaigns.js" -Pattern "'pending_approval'\|'approved'\|'live'\|'completed'\|'paused'"` returns matches only — no uppercase status values. | GUARDRAIL-4 |
| AC-8 | `API_ROUTES.md` campaign section updated with all five routes, correct auth guards, and body shapes. | GUARDRAIL-2 |

### Files expected to touch

- `ad-server/src/api/campaigns.js` — implement `POST`, scoped `GET`, `PATCH /status` handlers
- `ad-server/src/repositories/CampaignRepository.js` — create if absent: `create()`, `findAll({ advertiserId })`, `findById()`, `updateStatus()`
- `docs/API_ROUTES.md` — update campaigns section

### CCR-3 — `campaigns.js` DELETE guard must survive S14-2

The `requireRole('superadmin')` guard on `DELETE /:id` was confirmed in Sprint 13 and is a
security requirement. S14-2 must not restructure the route file in a way that drops this guard.

**Gate:** After S14-2 merge, run:
```powershell
Select-String -Path "ad-server/src/api/campaigns.js" -Pattern "requireRole.*superadmin"
```
Must return a match. Hard merge gate.

---

## 🛡️ S14-3 · Advertiser Portal UI

**Priority:** High
**Effort:** L
**Confidence:** 68% (unknown whether any advertiser JSX files exist on disk — grep 7 resolves)
**MVP section:** §3.4

### Context

Three new pages are required. If `client-app/src/pages/advertiser/` does not exist yet, all
three are new files. If the directory exists with stubs, read each before planning work.
S14-3 depends on S14-2 being complete (API methods must exist before wiring).

### Pre-implementation Step 1 (mandatory — run grep 7 and grep 8 above first)

**Decision tree:**

| Finding | Action |
|---|---|
| `advertiser/` directory absent | Create directory + all three files — L effort as planned |
| `AdvertiserDashboard.jsx` exists | Read before planning — may be a stub or partial |
| `ApiService.js` already has `getCampaigns()` | Wire directly — skip ApiService sub-task |
| `ApiService.js` missing campaign methods | Add `createCampaign(payload)`, `getCampaigns(params)`, `getCampaign(id)`, `updateCampaignStatus(id, status)` before building pages |

### Pages to create (or confirm + extend)

#### `AdvertiserDashboard.jsx`
- Route: `/dashboard/advertiser`
- KPI row: active campaigns, total impressions, total spend
  - `data-testid="kpi-active-campaigns"`, `data-testid="kpi-total-impressions"`, `data-testid="kpi-total-spend"`
- Campaign list table with status chips
  - `data-testid="campaign-list-table"`, `data-testid="campaign-status-chip-{id}"`
- Empty state: `"No campaigns yet — create your first campaign."` (not blank)

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
- Loading skeleton while data fetches (see Sprint 13 guardrails — empty states are designed states)

### Acceptance Criteria

| # | Criterion | Guardrail |
|---|---|---|
| AC-1 | `data-testid="campaign-request-form"` present in `CampaignRequest.jsx` DOM. | GUARDRAIL-1 |
| AC-2 | `data-testid="submit-campaign-btn"` is `disabled` when required fields empty. | — |
| AC-3 | Submit with valid payload → `POST /api/campaigns` called → redirects to `/dashboard/advertiser/campaigns/:newId`. | GUARDRAIL-1 |
| AC-4 | `data-testid="campaign-status-badge"` shows `pending_approval` immediately after submit. | GUARDRAIL-4 |
| AC-5 | `data-testid="campaign-impressions-count"` renders on `CampaignDetail.jsx` (value may be `0` for a new campaign). | GUARDRAIL-1 |
| AC-6 | `AdvertiserDashboard.jsx` renders empty state `"No campaigns yet"` (not a blank panel) when campaign list is empty. | — |
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
**Confidence:** 90% (pure App.jsx edit; only unknowns are whether routes already exist)
**MVP section:** §3.4

### Context

All three advertiser pages need routes in `App.jsx` with a `requireRole('advertiser')` guard.
If any routes are already registered (grep 6 above), confirm the guard before the story closes.

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

## 📊 Probability Table

| Story | Confidence | What is keeping it below 100% | Resolved by |
|---|---|---|---|
| S14-1 · Advertiser role + JWT guard | 75% | `'advertiser'` role in `ROLE_HIERARCHY` unconfirmed; JWT claim unconfirmed | Greps 1 + 5 |
| S14-2 · Campaign CRUD API | 72% | `campaigns.js` handler state unknown; `CampaignRepository.js` existence unknown | Greps 3 + 4 |
| S14-3 · Advertiser portal UI | 68% | Advertiser pages directory existence unknown; `ApiService` campaign methods unconfirmed | Greps 7 + 8 |
| S14-4 · App.jsx route registration | 90% | Route may already be partially registered | Grep 6 |

### Tasks that cannot exceed 90% yet

**S14-1, S14-2, S14-3** cannot exceed 90% until their mandatory Step 1 greps return. All three
have unknown file/handler states. Scores jump to 90%+ immediately after greps run.

---

## 🛡️ Step 4 — Isolation Audit

### Blast-Radius Table

| Story | Files Touched | Change Type | Shared Infra? | Can It Break Other Features? | Verdict |
|---|---|---|---|---|---|
| **S14-1** · Advertiser role + JWT | `requireRole.js`, `auth.js` | Additive (new role value) | `requireRole.js` consumed by every protected route. `auth.js` used by all login flows. | ⚠️ Partial — `requireRole.js` is shared | ✅ **Safe if additive only.** Adding `'advertiser'` to `ROLE_HIERARCHY` does not affect existing role checks. JWT patch adds a field — existing token consumers are unaffected. |
| **S14-2** · Campaign CRUD API | `campaigns.js`, `CampaignRepository.js`, `API_ROUTES.md` | Additive (new handlers) or stub-fill | `campaigns.js` already has DELETE handler (Sprint 13). New POST/GET/PATCH are new path+method combos. | ⚠️ Partial — `campaigns.js` shared | ✅ **Safe.** New routes are distinct path/method pairs. Existing DELETE at L187 is untouched. CCR-3 gate enforced. |
| **S14-3** · Advertiser portal UI | New JSX files, `ApiService.js` | New files + additive methods | `ApiService.js` shared across all pages. | ⚠️ Partial — `ApiService.js` shared | ✅ **Safe.** New methods are additive exports. No existing method signatures changed. |
| **S14-4** · App.jsx routes | `App.jsx` | Additive (new route entries) | `App.jsx` is the client route authority. | ⚠️ Partial — `App.jsx` shared | ✅ **Safe if additive only.** Adding routes cannot affect existing route matches. Verify no existing route is overwritten. |

### Isolation Verdict

All four stories are **additive-only changes**. No existing handler, route, method, or component
is removed or restructured. The only shared-file risks are:

#### CCR-3 — `campaigns.js` DELETE guard survival (S14-2)

`requireRole('superadmin')` at `campaigns.js` L187 must survive all S14-2 changes.
Run after merge:
```powershell
Select-String -Path "ad-server/src/api/campaigns.js" -Pattern "requireRole.*superadmin"
```
Hard merge gate — story cannot be marked Done without this match.

#### CCR-4 — `requireRole.js` existing role hierarchy integrity (S14-1)

Adding `'advertiser'` to `ROLE_HIERARCHY` must not remove or reorder any existing role entry.
Run before and after:
```powershell
Select-String -Path "ad-server/src/middleware/requireRole.js" -Pattern "ROLE_HIERARCHY" -Context 10,10
```
Line count of the block must not decrease.

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
| **GUARDRAIL-4** Enum values canonical | Status strings match schema; `campaigns.status` = lowercase; `loops.status` = UPPERCASE | ☐ |
| **GUARDRAIL-5** Doc placement | This file at `current_sprint/sprint14.md`; linked from `docs/MVP_SPRINT_PLAN.md` | ☐ |
| **GUARDRAIL-6** FIXME count at scoping | FIXME grep run for all files in scope during Step 2, not at implementation time | ☐ |
| **GUARDRAIL-7** Route mount points confirmed | Any route under a new prefix confirmed in `app.js`/`index.js` before effort estimate set | ☐ |
| **GUARDRAIL-8** Persistence layer confirmed | `CampaignRepository.js` existence checked via `Get-ChildItem` at scoping | ☐ |
| **GUARDRAIL-9** API_ROUTES.md vs live code audit | One-pass check of campaign route auth guards vs live `campaigns.js` before Step 2 | ☐ |
| **GUARDRAIL-10** Open decisions close within one sprint | DECISION-1 must resolve this sprint — no third deferral | ☐ |

---

## Pre-Sprint Checklist

- [ ] All Step 1 greps (1–10) executed and results logged
- [ ] `'advertiser'` role confirmed or added in `requireRole.js`
- [ ] JWT `role` claim confirmed for advertiser login
- [ ] `campaigns.js` handler state confirmed (existing vs stub vs absent)
- [ ] `CampaignRepository.js` existence confirmed
- [ ] `client-app/src/pages/advertiser/` directory scanned
- [ ] `ApiService.js` campaign methods confirmed or added
- [ ] DECISION-1 resolved (Option A or Option B — no further deferral)
- [ ] S11-1, S11-2, S11-4 persistence tests run in browser
- [ ] `docs/MVP_SPRINT_PLAN.md` Sprint 13 entry added

---

## Known File Inventory (carry-over from Sprint 13 + new)

| File | Size / Status | Notes |
|---|---|---|
| `client-app/src/App.jsx` | 11 214 B ✅ | Route authority. Add three advertiser routes in S14-4. |
| `client-app/src/services/ApiService.js` | ✅ | Confirm campaign methods before S14-3. |
| `ad-server/src/api/campaigns.js` | 6 323 B ✅ | Guards confirmed Sprint 13. Handler state for POST/GET/PATCH unknown — grep 3 required. |
| `ad-server/src/api/telemetry.js` | ✅ LIVE | DECISION-1 must resolve L49 this sprint. |
| `ad-server/src/middleware/requireRole.js` | ✅ | `'advertiser'` role confirmation required (grep 1). |
| `ad-server/src/api/auth.js` | ✅ | JWT role claim for advertiser login must be confirmed (grep 5). |
| `ad-server/src/repositories/CampaignRepository.js` | ❓ UNKNOWN | Existence unconfirmed — grep 4 required. |
| `client-app/src/pages/advertiser/AdvertiserDashboard.jsx` | ❓ UNKNOWN | May not exist — grep 7 required. |
| `client-app/src/pages/advertiser/CampaignRequest.jsx` | ❓ UNKNOWN | May not exist — grep 7 required. |
| `client-app/src/pages/advertiser/CampaignDetail.jsx` | ❓ UNKNOWN | May not exist — grep 7 required. |
| `ad-server/src/api/audit.js` | ✅ NEW (Sprint 13) | `POST /api/audit` live @ `dfbeb65`. |
| `ad-server/src/api/impressions.js` | ✅ NEW (Sprint 13) | `GET /api/impressions` live @ `dfbeb65`. |

---

## Confidence Scores

| Story | Score | Remaining gate |
|---|---|---|
| S14-4 · App.jsx route registration | 🟢 90% | Grep 6 — confirm no routes pre-exist |
| S14-2 · Campaign CRUD API | 🟡 72% | Greps 3 + 4 — handler state + repository existence |
| S14-1 · Advertiser role + JWT guard | 🟡 75% | Greps 1 + 5 — role hierarchy + JWT claim |
| S14-3 · Advertiser portal UI | 🟡 68% | Greps 7 + 8 — directory + ApiService methods |

---

## Cross-Story Dependency Map

```
DECISION-1 (carry-over) ──► must resolve this sprint (GUARDRAIL-10)
S11-1 / S11-2 / S11-4 persistence tests ──► manual browser tests, carry-over

S14-1 · Advertiser role + JWT
  └─► gates S14-2, S14-3, S14-4 (all role guards depend on this)

S14-2 · Campaign CRUD API
  └─► gates S14-3 (UI depends on API endpoints being live)

S14-3 · Advertiser portal UI
  └─► gates S14-4 (routes cannot be registered before components exist)

S14-4 · App.jsx route registration
  └─► final step; no stories depend on it

CCR-3: campaigns.js DELETE guard survival ──► hard merge gate on S14-2
CCR-4: requireRole.js ROLE_HIERARCHY integrity ──► hard merge gate on S14-1
```

**Recommended implementation order:** S14-1 (XS, gate-clearing) → S14-2 (M, API) → S14-3 (L, UI) → S14-4 (XS, routing)

---

## Test Stabilisation Order

Per `docs/MVP_COMPLETION_SPRINT_PLAN.md`, Sprint 14 ships `advertiser_portal.spec.js` with
minimum 10 tests covering:

1. `POST /api/campaigns` as advertiser → `201 { status: 'pending_approval' }`
2. `GET /api/campaigns` as advertiser → own campaigns only
3. `GET /api/campaigns/:otherId` as different advertiser → `403`
4. `PATCH /api/campaigns/:id/status` invalid transition → `400`
5. `PATCH /api/campaigns/:id/status` valid transition → `200`
6. `DELETE /api/campaigns/:id` as `retaileradmin` → `403`
7. `GET /dashboard/advertiser` as `admin` → `403`
8. `data-testid="campaign-request-form"` present in DOM
9. `data-testid="submit-campaign-btn"` disabled when fields empty
10. `data-testid="campaign-status-badge"` shows `pending_approval` after submit

---

## Story Point Summary

| Story | Priority | Effort | Confidence | Status |
|---|---|---|---|---|
| S14-1 · Advertiser role + JWT guard | Critical | XS–S | 75% | 🔲 Pending Step 1 |
| S14-2 · Campaign CRUD API | High | M | 72% | 🔲 Pending Step 1 |
| S14-3 · Advertiser portal UI | High | L | 68% | 🔲 Pending S14-2 |
| S14-4 · App.jsx route registration | High | XS | 90% | 🔲 Pending S14-3 |

---

## Definition of Done

- [ ] All Step 1 greps (1–10) executed; results logged in this doc
- [ ] **DECISION-1** resolved — `telemetry.js` L49 guard intent documented or corrected. No third deferral.
- [ ] S11-1 persistence test passed (hard-refresh `UserManagement`)
- [ ] S11-2 persistence test passed (hard-refresh `AdvertiserManagement`)
- [ ] S11-4 persistence test passed (hard-refresh Add Location form)
- [ ] **S14-1 DONE** — `'advertiser'` in `ROLE_HIERARCHY`; JWT includes `role: 'advertiser'`; `requireRole('advertiser')` returns `403` for `retaileradmin` token. Commit SHA: ___
- [ ] **S14-2 DONE** — `POST`, scoped `GET`, `PATCH /status` handlers live; status transitions enforced; `API_ROUTES.md` updated; lowercase enum confirmed; CCR-3 merge gate passed. Commit SHA: ___
- [ ] **CCR-3 gate passed** — `requireRole('superadmin')` grep returns match after S14-2 merge
- [ ] **CCR-4 gate passed** — `ROLE_HIERARCHY` block line count unchanged after S14-1 merge
- [ ] **S14-3 DONE** — three advertiser pages created/confirmed; all `data-testid` attrs present; loading skeletons present; empty states designed; all `ApiService` methods confirmed before use. Commit SHA: ___
- [ ] **S14-4 DONE** — three routes registered in `App.jsx` with `requireRole('advertiser')` guard; admin token returns `403` on `/dashboard/advertiser`. Commit SHA: ___
- [ ] `advertiser_portal.spec.js` created with minimum 10 passing tests
- [ ] `docs/MVP_SPRINT_PLAN.md` Sprint 13 entry added (carry-over task, due this sprint)
- [ ] `docs/MVP_SPRINT_PLAN.md` Sprint 14 entry added
- [ ] `GUARDRAIL-5`: this file at `current_sprint/sprint14.md`
- [ ] No story marked Done without a commit SHA cited as evidence
- [ ] No vague acceptance criteria — all ACs have curl/grep/testid verification commands

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

*Sprint 14 doc created 2026-06-08.*
*Grounded against: `client-app/src/App.jsx` @ `335f1c2`, `ad-server/src/api/` @ `294fd25`, `docs/MVP_COMPLETION_SPRINT_PLAN.md`, Sprint 13 retrospective guardrails.*
*All Step 1 greps must be executed before implementation begins. Confidence scores update to 90%+ after greps return.*
