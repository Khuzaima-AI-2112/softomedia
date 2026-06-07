# Sprint 11 — MVP Gap Closure

**Sprint:** 11
**Status:** Active — S11-3 ✅ S11-1 ✅ | S11-2 ⚠️ | S11-5 ❌ S11-6 ❌ S11-7 ❌
**Guardrails authority:** [`docs/sprint8-sre-retro-consolidated.md`](./sprint8-sre-retro-consolidated.md)
**Route authority:** [`docs/API_ROUTES.md`](./API_ROUTES.md)
**Schema authority:** [`docs/DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md)
**MVP reference:** [`docs/Digital Screen Network Management Platform (MVP).md`](<./Digital Screen Network Management Platform (MVP).md>)
**Gap source:** [`docs/sprintWRAPUP.md`](./sprintWRAPUP.md) — MVP analysis @ ~65% complete
**SRE/QA analysis:** [`current_sprint/sprint11-sre-qa-analysis.md`](./sprint11-sre-qa-analysis.md) — live codebase @ `682eb456`

---

## Sprint Progress

| Story | Status | Evidence |
|---|---|---|
| S11-3 · Security hardening | ✅ **Merged** | PR #44 → `3899877` — all V1/V2/V3 guards confirmed |
| S11-1 · Super Admin CRUD — Users & Retailers | ✅ **Merged** | PR #45 → `f75376e` — CRUD wired, Firestore persistence confirmed |
| S11-2 · Super Admin CRUD — Advertisers | ⚠️ **Unconfirmed** | No commit touches `AdvertiserManagement.jsx` or `advertisers.js` |
| S11-4 · Retailer CRUD — Add Location | ⚠️ **Unconfirmed** | No commit touches `RetailerDashboard.jsx` store creation |
| S11-5 · Loop preview + approval workflow | ❌ **Open** | No commit touches `App.jsx` route registration for Loops/ScheduleCalendar |
| S11-6 · Demo Player full wiring | ❌ **Open** | No commit touches `Player.jsx` or `TelemetryService` wiring |
| S11-7 · Network Map blank render | ❌ **Open** | No commit touches `NetworkMap.jsx` or env config |
| S11-8 · Tech Ops network-wide data | ⚠️ **Unconfirmed** | No commit touches `screens.js` role-conditional branch |

### Pre-Sprint Checklist Progress

| Item | Status | Evidence |
|---|---|---|
| Duplicate file cleanup (TicketDashboard, TicketDetail, CampaignApprovalList) | ✅ **Done** | `6fabe23`, `6656928`, `11cba53`, `d814fdc` |
| Husky pre-commit duplicate-component hook | ✅ **Done** | `f5da4c5` |
| `NODE_ENV !== 'test'` guard on `impressionLimiter` | ✅ **Done** | `f2143df` (S11-3 commit) |
| `requireRole` guards in `campaigns.js` (V1/V2) | ✅ **Done** | `f2143df` — PATCH @ line ~97, DELETE tightened to `superadmin` |
| `BaseRepository.findById` confirmation | ⚠️ **Unconfirmed** | No commit confirms or adds this method |
| ENUM-AUDIT-3 — zero uppercase campaign status | ⚠️ **Unconfirmed** | No grep result committed |
| `docs/MVP_SPRINT_PLAN.md` Sprint 11 entry | ⚠️ **Unconfirmed** | No commit touches `MVP_SPRINT_PLAN.md` |

---

## Four SRE/QA Rules

These rules are mandatory for every story in this sprint.

1. **No service call without source verification**
   Every `apiService.X()` call must name the exact existing file and method signature that implements it. If the method does not exist, add a sub-task to create it before UI wiring.

2. **Router file is the API authority**
   Every API story must list the exact `METHOD /path → body shape` as confirmed in `docs/API_ROUTES.md` and the Express router source file. No frontend endpoint may be written from memory.

3. **Mutation auth must be falsifiable**
   Every `POST`, `PUT`, `PATCH`, or `DELETE` acceptance criterion must explicitly state the required middleware guard, e.g. `requireRole('superadmin') confirmed`.

4. **Enums and sprint docs must be canonical**
   All workflow/status values must match the `docs/DATABASE_SCHEMA.md` enum definitions exactly (lowercase, underscore-separated). This file lives at `docs/sprint11.md` per GUARDRAIL-5.

---

## Guardrails Checklist

Before any story is marked **Ready for implementation**, confirm all five boxes:

| Rule | Required check | ✓ |
|---|---|---|
| **GUARDRAIL-1** Service method exists | Every `apiService.X()` call verified in `ApiService.js` source | ☐ |
| **GUARDRAIL-2** Route contract exists | HTTP method, path, body shape confirmed in `docs/API_ROUTES.md` | ☐ |
| **GUARDRAIL-3** Auth guard named in AC | Mutation routes explicitly state `requireRole('X') confirmed` | ☐ |
| **GUARDRAIL-4** Enum values canonical | Status strings match schema; grep returns zero uppercase variants at close | ☐ |
| **GUARDRAIL-5** Doc placement | This file is at `docs/sprint11.md`; linked from `docs/MVP_SPRINT_PLAN.md` | ☐ |

---

## Carry-over Pre-conditions (from sprintWRAPUP MVP Gap Analysis)

- [ ] **ENUM-AUDIT-3** — confirm `campaigns.status` only writes lowercase (`draft`, `pendingapproval`, `scheduled`, `live`, `ended`). `grep -r "'APPROVED'\|'PENDING'" --include="*.js" --include="*.jsx"` must return zero results. ⚠️ *Unconfirmed — no grep result committed.*
- [x] **SECURITY-V1** — `PATCH /api/campaigns/:id/status` wrapped in `requireRole('retaileradmin')` @ line ~97. **RESOLVED** → `f2143df`.
- [x] **SECURITY-V2** — `DELETE /api/campaigns/:id` tightened to `requireRole('superadmin')`. **RESOLVED** → `f2143df`.
- [x] **SECURITY-V3** — `POST /api/telemetry/impression` rate-limited by `impressionLimiter` (100 req/min per IP). **RESOLVED** → `98bd645`. `NODE_ENV !== 'test'` guard added → `f2143df`.
- [ ] **`docs/MVP_SPRINT_PLAN.md`** — add Sprint 11 entry linking to this file. ⚠️ *Unconfirmed.*

---

## Pre-Sprint Checklist

- [x] Duplicate file cleanup — TicketDashboard, TicketDetail deleted; CampaignApprovalList re-exported → `6fabe23`, `6656928`, `11cba53`
- [x] Husky pre-commit hook prevents new duplicates → `f5da4c5`
- [x] `NODE_ENV` guard on `impressionLimiter` → `f2143df`
- [ ] Run `grep -n "requireRole" ad-server/src/api/campaigns.js` — V1/V2 confirmed above; mark complete ✅
- [ ] Read `client-app/src/pages/Player.jsx` — confirm or add `TelemetryService.trackImpression()` call site
- [ ] Run `grep -n "Loops\|ScheduleCalendar" client-app/src/App.jsx` — confirm route registration (**still open**)
- [ ] Confirm `BaseRepository.findById()` exists — needed by telemetry `play_count` increment

---

## Confidence Scores (SRE/QA Analysis @ `682eb456`)

| Story | Score | Status | Ceiling reason |
|---|---|---|---|
| S11-1 · Super Admin CRUD — Users & Retailers | 80% | ✅ **Merged** | — |
| S11-2 · Super Admin CRUD — Advertisers | 82% | ⚠️ Unconfirmed | `advertisers.js` router existence unverified |
| S11-3 · Security hardening | **97%** | ✅ **Merged** | — |
| S11-4 · Retailer CRUD — Add Location | 78% | ⚠️ Unconfirmed | `StoreRepository` stub; `stores.js` unverified |
| S11-5 · Retailer approval workflow | 83% | ❌ **Open** | Route registration in `App.jsx` unverified |
| S11-6 · Demo Player full wiring | 72% | ❌ **Open** | `Player.jsx` (23 KB) unread; speed×rate collision |
| S11-7 · Network Map blank render | 88% | ❌ **Open** | Google Maps API key is external dependency |
| S11-8 · Tech Ops network-wide data | 85% | ⚠️ Unconfirmed | Role-conditional branch in `screens.js` unverified |

---

## Backlog

### S11-3 · Security hardening — campaign auth + telemetry rate limit ✅ MERGED → `3899877`

**Priority:** Critical (pre-condition for all other stories)
**Confidence:** 97% → **Done**
**Merged:** PR #44 @ `3899877f` · 2026-06-07
**Risk refs:** V1, V2, V3 from sprintWRAPUP

**Resolution summary:**
- PATCH `/api/campaigns/:id/status` → `requireRole('retaileradmin')` confirmed @ line ~97
- DELETE `/api/campaigns/:id` → `requireRole('superadmin')` tightened from `'admin'`
- POST `/api/telemetry/impression` → `impressionLimiter` (100 req/min/IP, `Retry-After` header, sliding window) — already in place @ `98bd645`; `NODE_ENV !== 'test'` guard added

**All GUARDRAIL checks passed. No further action.**

---

### S11-1 · Super Admin CRUD — Users & Retailers ✅ MERGED → `f75376e`

**Priority:** Critical
**Confidence:** 80% → **Done**
**Merged:** PR #45 @ `f75376e6` · 2026-06-07
**TASK refs:** TASK-02, TASK-03, TASK-04, TASK-05, TASK-06

**Resolution summary:**
- `UserManagement.jsx` and `RetailerManagement.jsx` wired to `users.js` + `retailers.js` routers
- All mutations guarded by `requireRole('superadmin')` ✅
- `data-testid` attributes added per spec
- Firestore persistence confirmed — records survive hard-refresh

**All GUARDRAIL checks passed. No further action.**

---

### S11-2 · Super Admin CRUD — Advertisers ⚠️ UNCONFIRMED

**Priority:** Critical
**Confidence:** 82%
**TASK refs:** TASK-07, TASK-08
**Files (corrected):**
- `client-app/src/pages/admin/AdvertiserManagement.jsx` ← ~~Advertisers.jsx does not exist~~
- `ad-server/src/api/advertisers.js` (verify existence before wiring)
- `ad-server/src/repositories/AdvertiserRepository.js` (1 441 bytes — check soft-delete exists)

**Context:** No commit in this sprint touches `AdvertiserManagement.jsx` or `advertisers.js`. "Add Advertiser" and "Remove Advertiser" buttons remain unwired. `AdvertiserRepository.js` at 1 441 bytes may be missing soft-delete or `findByEmail` for the 409 guard.

**Pre-work:**

```bash
# Confirm router file
ls ad-server/src/api/advertisers.js 2>&1

# Confirm AdvertiserRepository has create and softDelete
grep -n "create\|delete\|deactivate" \
  ad-server/src/repositories/AdvertiserRepository.js

# Check for existing email-uniqueness guard
grep -n "409\|email.*exists\|unique" \
  ad-server/src/api/advertisers.js 2>/dev/null || echo "File missing or guard absent"
```

**Acceptance criteria:**

**Environment:** `NODE_ENV=development`, `x-demo-role: superadmin`.

| Verb | Route | Auth guard | Success | Error codes |
|---|---|---|---|---|
| POST | `/api/advertisers` | `requireRole('superadmin')` | 201 `{ advertiser_id }` | 400, 403, 409 (email dupe) |
| DELETE | `/api/advertisers/:id` | `requireRole('superadmin')` | 200 `{ status: 'inactive' }` | 403, 404 |

Form validation: name (required), email (required, valid format), billing contact (optional).

**data-testid requirements:**

```
data-testid="add-advertiser-btn"
data-testid="advertiser-row-{id}"
data-testid="delete-advertiser-btn-{id}"
data-testid="advertiser-email-input"
```

**Persistence check:** Hard-refresh after create and delete. Record must persist / be absent.

**GUARDRAIL checks:**
- [ ] G1: `apiService.createAdvertiser()`, `apiService.deleteAdvertiser()` — verify or create
- [ ] G2: Routes confirmed in router source
- [ ] G3: `requireRole('superadmin')` confirmed on both mutations

---

### S11-4 · Retailer CRUD — Add Location ⚠️ UNCONFIRMED

**Priority:** High
**Confidence:** 78%
**TASK ref:** TASK-20
**Files (corrected):**
- `client-app/src/pages/retailer/RetailerDashboard.jsx` ← ~~Locations.jsx does not exist~~
- `ad-server/src/api/stores.js` (verify existence)
- `ad-server/src/repositories/StoreRepository.js` (1 132 bytes — confirm `create()` method)

**Context:** No commit in this sprint wires the "Add Location" button to Firestore. `StoreRepository.js` at 1 132 bytes is almost certainly a bare stub. Confirm method surface and `stores.js` router existence before writing any code. Needs S11-1 merged first (a real retailer must exist to attach a location to).

**Pre-work:**

```bash
# Find the "Add Location" UI entry point
grep -rn "Add Location\|addLocation\|add-location" \
  client-app/src/pages/retailer/RetailerDashboard.jsx

# Check StoreRepository method surface
cat ad-server/src/repositories/StoreRepository.js

# Confirm stores.js API router exists
ls ad-server/src/api/stores.js 2>&1

# If not, find what collection store-creation targets
grep -rn "stores\|locations" ad-server/src/api/ | grep "router.post"
```

**Acceptance criteria:**

**Environment:** `NODE_ENV=development`, `x-demo-role: retaileradmin`.

| Verb | Route | Auth guard | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/api/stores` | `requireRole('retaileradmin')` | `{ name, address, city, province, postal_code, retailer_id }` | 201 `{ store_id }` | 400, 403 |

> ⚠️ `retailer_id` must come from the authenticated session context (`req.user.retailer_id`), not a form field. Confirm demo auth middleware sets this before wiring the form.

- On success, new location appears in the retailer's location list without page reload.

**data-testid requirements:**

```
data-testid="add-location-btn"
data-testid="location-name-input"
data-testid="location-address-input"
data-testid="location-submit-btn"
data-testid="location-row-{id}"
```

**Persistence check:** After form submit, hard-refresh the retailer dashboard. New location must appear in the list.

**GUARDRAIL checks:**
- [ ] G1: `apiService.createStore()` — verify or create
- [ ] G2: `POST /api/stores → { name, address, retailer_id }` confirmed in `stores.js`
- [ ] G3: `requireRole('retaileradmin') confirmed`

---

### S11-5 · Retailer approval workflow — loop preview page ❌ OPEN

**Priority:** High
**Confidence:** 83%
**Risk refs:** R3, R4 from sprintWRAPUP
**TASK refs:** TASK-18 (Schedule Calendar), TASK-19 (Go Back crash)
**Files (corrected):**
- `client-app/src/pages/retailer/Loops.jsx` ← **already exists** (5 778 bytes) — do NOT re-create
- `client-app/src/pages/retailer/ScheduleCalendar.jsx` ← **already exists** (14 241 bytes)
- `client-app/src/pages/retailer/ScheduleHistory.jsx` ← **already exists** (20 355 bytes)
- `client-app/src/pages/retailer/ScheduleManager.jsx` ← **already exists** (24 906 bytes)
- `client-app/src/App.jsx` ← **gap confirmed** — no commit registers Loops or ScheduleCalendar routes

**Context:** The files exist on disk. The unresolved gap is that **`App.jsx` has no registered routes** for `/dashboard/retailer/loops` or `/dashboard/retailer/schedule/calendar`. Any navigation to these paths produces a 404 or blank render. The Go Back crash (TASK-19) in ScheduleHistory is also unaddressed.

**Pre-work:**

```bash
# Confirm Loops.jsx and ScheduleCalendar.jsx are registered in App.jsx
grep -n "Loops\|ScheduleCalendar\|schedule/calendar\|retailer/loops" \
  client-app/src/App.jsx
# Expected: ZERO results — this is the gap to fix

# Confirm the loops API route exists
grep -n "router.get\|locations.*loops\|retailer.*loops" \
  ad-server/src/api/loops.js 2>/dev/null || echo "loops.js missing or route absent"

# Check RetailerDashboard quick-action href values (TASK-19)
grep -n "schedule/calendar\|/history\|Go Back\|goBack" \
  client-app/src/pages/retailer/RetailerDashboard.jsx
```

**Acceptance criteria:**

**Environment:** `NODE_ENV=development`, `x-demo-role: retaileradmin`.

| Check | Route | Pass condition |
|---|---|---|
| Loops page loads | `/dashboard/retailer/loops` | Renders without white screen or 404 |
| Loops API call | `GET /api/locations/:id/loops` | 200 with loop array |
| Schedule Calendar loads | `/dashboard/retailer/schedule/calendar` | Renders without 404 |
| Quick-action links | RetailerDashboard | Click navigates to valid registered route |
| "Go Back" in History | ScheduleHistory back button | No crash, navigates to previous page |

**data-testid requirements:**

```
data-testid="loops-list"
data-testid="loop-row-{id}"
data-testid="loop-status-badge-{id}"
data-testid="schedule-calendar-container"
```

**Enum constraint:** Loop status badge must render one of: `draft` | `approved` | `locked` — matching schema exactly. No uppercase variants.

**GUARDRAIL checks:**
- [ ] G2: `GET /api/locations/:id/loops` confirmed in `loops.js` router
- [ ] G3: Route protected by `requireRole('retaileradmin')`
- [ ] G4: Status badge strings match schema: `approved | draft | locked`

---

### S11-6 · Demo Player — cascading selection + full-day playback + impression wiring ❌ OPEN

**Priority:** High
**Confidence:** 72%
**TASK refs:** TASK-09, TASK-10
**Files (corrected):**
- `client-app/src/pages/Player.jsx` ← ~~pages/demo/Player.jsx does not exist~~ — **23 KB, internal wiring unread**
- `client-app/src/services/TelemetryService.js`

**Context:** No commit in this sprint touches `Player.jsx` or `TelemetryService`. The cascading retailer → store → screen selector and full-day playback loop remain unwired. Impression persistence in `telemetry.js` **is already fully wired** at `98bd645` (impressionLimiter mounted, `impressionRepository.logImpression()` called, `campaignRepository.update()` increments `play_count`). This story is unblocked — S11-3 is merged and the `NODE_ENV` guard is in place.

**Pre-work:**

```bash
# Confirm TelemetryService.trackImpression signature
grep -n "trackImpression\|function track\|export" \
  client-app/src/services/TelemetryService.js

# Confirm Player.jsx has cascading selector scaffolding
grep -n "retailer.*store\|store.*screen\|cascad\|selector" \
  client-app/src/pages/Player.jsx

# Confirm Player.jsx currently calls TelemetryService (or not)
grep -n "TelemetryService\|trackImpression\|telemetry" \
  client-app/src/pages/Player.jsx

# Confirm BaseRepository.findById exists (needed by play_count increment)
grep -n "findById" ad-server/src/repositories/BaseRepository.js
```

**Acceptance criteria:**

**Environment:** `NODE_ENV=development`. Player at `/player` (not `/demo/player`).

| Check | data-testid | Pass condition |
|---|---|---|
| Retailer selector renders | `data-testid="retailer-select"` | Populates from `GET /api/retailers` |
| Store depends on retailer | `data-testid="store-select"` | Disabled until retailer selected; clears on retailer change |
| Screen depends on store | `data-testid="screen-select"` | Disabled until store selected |
| Play Full Day button | `data-testid="play-full-day-btn"` | Cycles loops 1–24 |
| Speed multiplier | `data-testid="speed-select"` | Options: 1×, 10×, 60× |
| Impression counter | `data-testid="impression-counter"` | Increments on each ad play |
| Telemetry fired | Network tab | `POST /api/telemetry/impression` → 201 on each slot |

**Persistence check:** After a playback session, query Firestore `impressions` collection — records matching `screen_id` must be present.

> ⚠️ **Rate-limiter / speed-multiplier collision:** 24h × 12 slots at 60× = 288 impression calls per session against a 100 req/min cap. The 60× test **will** trigger the rate limiter in production. The `NODE_ENV !== 'test'` guard added in `f2143df` mitigates E2E runs. Verify the guard is in place before running 60× tests.

**GUARDRAIL checks:**
- [ ] G1: `TelemetryService.trackImpression()` — verify signature in `TelemetryService.js`
- [ ] G2: `POST /api/telemetry/impression → { screen_id, campaign_id, asset_id?, loop_id?, played_at? }` confirmed
- [ ] G3: Telemetry route uses `requireAuth` (device-level). Confirmed.

---

### S11-7 · Network Map — fix blank render ❌ OPEN

**Priority:** Medium
**Confidence:** 88%
**TASK ref:** TASK-12
**Files (corrected):**
- `client-app/src/pages/admin/NetworkMap.jsx` ← confirmed on disk (4 203 bytes) — **blank render not fixed**
- `.env` / Cloud Run env config

**Context:** No commit in this sprint touches `NetworkMap.jsx` or environment config. The map still renders blank. Root cause is likely a missing `VITE_GOOGLE_MAPS_API_KEY` or a container with `height: 0`. API key procurement is an external dependency — the fallback message is the mitigation for missing keys.

**Pre-work:**

```bash
# Read the component to find root cause
cat client-app/src/pages/admin/NetworkMap.jsx

# Check if VITE_GOOGLE_MAPS_API_KEY is declared in .env.example
grep -n "GOOGLE_MAPS\|VITE_GOOGLE" .env.example client-app/.env.example 2>/dev/null

# Check if the map container has a CSS height
grep -n "height\|min-height\|style=" \
  client-app/src/pages/admin/NetworkMap.jsx
```

**Acceptance criteria:**

**Case A — API key present:**

| Check | Pass condition |
|---|---|
| Map renders | Google Maps tiles visible |
| Screen pins | At least one pin visible when `GET /api/screens` returns data |
| Pin click | Opens tooltip with screen name and status |

**Case B — API key absent (`VITE_GOOGLE_MAPS_API_KEY` undefined):**

| Check | data-testid | Pass condition |
|---|---|---|
| Fallback renders | `data-testid="map-unavailable-msg"` | Text: "Map unavailable — API key not configured" |
| No blank container | — | Container has `min-height: 400px` |
| No console error | — | No uncaught Google Maps JS exception |

**Documentation:** `docs/ENVIRONMENT_SETUP.md` must include:
```
VITE_GOOGLE_MAPS_API_KEY=your_key_here   # Required for Network Map
```

**GUARDRAIL checks:**
- [ ] G2: No new API routes in this story
- [ ] G4: No enum changes

---

### S11-8 · Tech Ops dashboard — network-wide screen data ⚠️ UNCONFIRMED

**Priority:** Medium
**Confidence:** 85%
**TASK ref:** TASK-23
**Files:**
- `client-app/src/pages/tech/` — confirm exact dashboard filename before starting
- `ad-server/src/api/screens.js`
- `ad-server/src/repositories/ScreenRepository.js` (2 885 bytes — confirmed)

**Context:** No commit confirms the role-conditional branch in `GET /api/screens`. Tech Ops dashboard still shows filtered/incomplete screen data. `ScreenRepository.js` exists with meaningful content; the work is adding a role-conditional branch to the `screens.js` router.

**Pre-work:**

```bash
# Confirm the Tech Ops dashboard file name
ls client-app/src/pages/tech/

# Confirm GET /api/screens has a role-conditional branch
grep -n "requireRole\|router.get\|techops\|retaileradmin" \
  ad-server/src/api/screens.js

# Confirm ScreenRepository has an unfiltered findAll
grep -n "findAll\|getAll\|where.*retailer" \
  ad-server/src/repositories/ScreenRepository.js
```

**Acceptance criteria:**

**Environment:** `NODE_ENV=development`.

| Role | Route | Filter | Expected |
|---|---|---|---|
| `techops` | `GET /api/screens` | None | All screens, all retailers — 200 |
| `retaileradmin` | `GET /api/screens` | `retailer_id` from session | Own screens only — 200 |
| `brand` | `GET /api/screens` | — | 403 |

- Dashboard KPIs show: total screens, online count, offline count, screens with active campaigns.
- Screen list is sortable by status and last heartbeat.

**data-testid requirements:**

```
data-testid="total-screens-kpi"
data-testid="online-screens-kpi"
data-testid="offline-screens-kpi"
data-testid="active-campaigns-kpi"
data-testid="screen-table"
data-testid="screen-row-{id}"
data-testid="sort-by-status"
data-testid="sort-by-heartbeat"
```

**GUARDRAIL checks:**
- [ ] G2: `GET /api/screens` (unfiltered) confirmed in `screens.js`
- [ ] G3: `requireRole('techops') confirmed` for unfiltered variant

---

## Cross-Story Dependency Map

```
S11-3 (security) ── ✅ MERGED ────────────────► S11-1 ✅ MERGED
                                                 S11-2 ⚠️ still open
                                                 S11-6 unblocked ✅

V3 (telemetry rate limit) ── ✅ ALREADY DONE ──► S11-6 no longer blocked ✅
NODE_ENV guard ── ✅ f2143df ───────────────────► S11-6 60× test safe ✅

S9-1 (impression persist) ─ ✅ already in main ► S11-6 telemetry wiring ✅

S11-1 ✅ MERGED ────────────────────────────────► S11-4 (add location) — unblocked
                                                  S11-5 (retailer loops) — unblocked
```

**Remaining merge order:** S11-2 + S11-4 (parallel) → S11-5 + S11-8 (parallel) → S11-7 → S11-6

---

## Deferred to Post-MVP (do not schedule this sprint)

- "Report Issue" and "Disconnect/Reestablish" screen actions (TASK-16, TASK-17)
- Notifications feed (`notifications.js` stub — Risk R5)
- Advanced analytics / campaign summary dashboard
- Retailer context selector for Super Admin impersonation (TASK-21)

---

## Story Point Summary

| Story | Priority | Confidence | Effort (est.) | Status | Blocker? |
|---|---|---|---|---|---|
| S11-3 · Security hardening | Critical | 97% | S | ✅ Merged | — |
| S11-1 · Super Admin CRUD — Users & Retailers | Critical | 80% | L | ✅ Merged | — |
| S11-2 · Super Admin CRUD — Advertisers | Critical | 82% | M | ⚠️ Open | Yes |
| S11-4 · Retailer CRUD — Add Location | High | 78% | S | ⚠️ Open | Needs S11-1 ✅ |
| S11-5 · Loop preview + approval workflow | High | 83% | M | ❌ Open | App.jsx routes |
| S11-6 · Demo Player full wiring | High | 72% | M | ❌ Open | Player.jsx unread |
| S11-7 · Network Map blank render | Medium | 88% | S | ❌ Open | API key external |
| S11-8 · Tech Ops network-wide data | Medium | 85% | S | ⚠️ Open | screens.js branch |

**Sprint velocity to date:** 2/8 stories fully merged. S11-2, S11-4, S11-8 are unblocked and can be picked up immediately. S11-5 and S11-6 are unblocked but require pre-work greps before coding. S11-7 has an external dependency (Google Maps API key).

---

*Sprint 11 doc created 2026-06-06. Updated 2026-06-06 with SRE/QA corrections (`sprint11-sre-qa-analysis.md` @ `682eb456`). Updated 2026-06-07 with live commit evidence: S11-3 merged (PR #44 → `3899877`), S11-1 merged (PR #45 → `f75376e`), pre-sprint cleanup resolved (`6fabe23`–`f5da4c5`). Open gaps: S11-5 (App.jsx routes), S11-6 (Player.jsx), S11-7 (NetworkMap/env). Unconfirmed: S11-2, S11-4, S11-8.*
