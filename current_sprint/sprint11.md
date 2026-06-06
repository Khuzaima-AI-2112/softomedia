# Sprint 11 — MVP Gap Closure

**Sprint:** 11
**Status:** Active
**Guardrails authority:** [`docs/sprint8-sre-retro-consolidated.md`](./sprint8-sre-retro-consolidated.md)
**Route authority:** [`docs/API_ROUTES.md`](./API_ROUTES.md)
**Schema authority:** [`docs/DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md)
**MVP reference:** [`docs/Digital Screen Network Management Platform (MVP).md`](<./Digital Screen Network Management Platform (MVP).md>)
**Gap source:** [`docs/sprintWRAPUP.md`](./sprintWRAPUP.md) — MVP analysis @ ~65% complete
**SRE/QA analysis:** [`current_sprint/sprint11-sre-qa-analysis.md`](./sprint11-sre-qa-analysis.md) — live codebase @ `682eb456`

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

These must be resolved before or during Sprint 11:

- [ ] **ENUM-AUDIT-3** — confirm `campaigns.status` only writes lowercase (`draft`, `pendingapproval`, `scheduled`, `live`, `ended`). `grep -r "'APPROVED'\|'PENDING'" --include="*.js" --include="*.jsx"` must return zero results.
- [ ] **SECURITY-V1** — `PATCH /api/campaigns/:id/status` is reachable without authentication. Wrap in `requireRole` before any story in this sprint ships.
- [ ] **SECURITY-V2** — `DELETE /api/campaigns/:id` has no role guard. Add `requireRole('superadmin')` before any campaign management story ships.
- [x] **SECURITY-V3** — ~~`POST /api/telemetry/impression` has no rate limit.~~ **RESOLVED** — `impressionLimiter` is already imported and wired in `telemetry.js` @ `98bd645`. No action needed. S11-6 is unblocked.
- [ ] **`docs/MVP_SPRINT_PLAN.md`** — add Sprint 11 entry linking to this file.

---

## Pre-Sprint Checklist

Resolve all items below before the planning meeting:

- [ ] Fix filename references confirmed by SRE analysis — verified above in each story
- [ ] Run `ls ad-server/src/api/` — confirm which of `users.js`, `retailers.js`, `advertisers.js`, `stores.js` exist
- [ ] Run `grep -n "requireRole" ad-server/src/api/campaigns.js` — confirm or add V1/V2 guards
- [ ] Read `client-app/src/pages/Player.jsx` — confirm or add `TelemetryService.trackImpression()` call site
- [ ] Run `grep -n "Loops\|ScheduleCalendar" client-app/src/App.jsx` — confirm route registration
- [ ] Add `NODE_ENV !== 'test'` guard to `impressionLimiter` before S11-6 E2E tests run (speed-multiplier collision)
- [ ] Confirm `BaseRepository.findById()` exists — needed by telemetry `play_count` increment

---

## Confidence Scores (SRE/QA Analysis @ `682eb456`)

| Story | Score | Ceiling reason |
|---|---|---|
| S11-1 · Super Admin CRUD — Users & Retailers | 80% | API router file paths unverified |
| S11-2 · Super Admin CRUD — Advertisers | 82% | `advertisers.js` router existence unverified |
| S11-3 · Security hardening | **97%** | Already 90%+ done; two `campaigns.js` guards to add |
| S11-4 · Retailer CRUD — Add Location | 78% | `StoreRepository` stub; `stores.js` unverified |
| S11-5 · Retailer approval workflow | 83% | Route registration in `App.jsx` unverified |
| S11-6 · Demo Player full wiring | 72% | `Player.jsx` (23 KB) unread; speed×rate collision |
| S11-7 · Network Map blank render | 88% | Google Maps API key is external dependency |
| S11-8 · Tech Ops network-wide data | 85% | Route branching logic unverified |

---

## Backlog

### S11-3 · Security hardening — campaign auth + telemetry rate limit ⟵ MERGE FIRST

**Priority:** Critical (pre-condition for all other stories)
**Confidence:** 97%
**Risk refs:** V1, V2, V3 from sprintWRAPUP
**Files:**
- `ad-server/src/api/campaigns.js`
- `ad-server/src/api/telemetry.js` ← V3 already resolved; no changes needed
- `ad-server/src/middleware/rateLimiter.js` ← already complete

**Context:** Three security gaps identified in the MVP gap analysis. V1 and V2 require two `requireRole` guards to be added to `campaigns.js`. **V3 is already resolved** — `impressionLimiter` is imported and wired in `telemetry.js` at commit `98bd645`; the implementation includes a sliding-window 100 req/min per IP with `Retry-After` header and automatic store pruning.

**Pre-work:**

```bash
# Confirm PATCH and DELETE verb guards
grep -n "requireRole\|router.patch\|router.delete" \
  ad-server/src/api/campaigns.js

# Confirm impressionLimiter is wired (not a dead import)
grep -n "impressionLimiter" ad-server/src/api/telemetry.js
# Expected line ~4:  import { impressionLimiter } from '../middleware/rateLimiter.js';
# Expected line ~56: router.post('/impression', impressionLimiter, async (req, res) => {
```

**Acceptance criteria:**

| Check | Method | Pass condition |
|---|---|---|
| PATCH status auth | `curl -X PATCH /api/campaigns/test` (no role header) | 401 or 403 |
| DELETE auth | `curl -X DELETE /api/campaigns/test` (no auth) | 401 |
| DELETE wrong role | Same with `x-demo-role: brand` | 403 |
| Rate limit | 101 rapid POSTs to `/api/telemetry/impression` | 101st returns 429 with `Retry-After` header |
| Rate limit body | Parse 429 response | `{ error: 'Too Many Requests', retryAfter: N, limit: 100, windowMs: 60000 }` |

> ⚠️ **Enum note:** The 429 body is `'Too Many Requests'` (title case) — not `'Too many requests'` as written in the original spec. Tests must match the implementation.

**GUARDRAIL checks:**
- [ ] G3: Both `campaigns.js` mutations name exact middleware and confirm placement in router chain
- [ ] G4: No enum changes in this story

---

### S11-1 · Super Admin CRUD — Users & Retailers (MVP Blocker)

**Priority:** Critical
**Confidence:** 80%
**TASK refs:** TASK-02, TASK-03, TASK-04, TASK-05, TASK-06
**Files (corrected):**
- `client-app/src/pages/admin/UserManagement.jsx` ← ~~Users.jsx does not exist~~
- `client-app/src/pages/admin/RetailerManagement.jsx` ← ~~Retailers.jsx does not exist~~
- `ad-server/src/api/users.js` (verify existence before wiring)
- `ad-server/src/api/retailers.js` (verify existence before wiring)

**Context:** All Super Admin CRUD forms are UI-only and do not persist to Firestore. No real retailer or user can be onboarded without these routes. `UserManagement.jsx` is 14 569 bytes and `RetailerManagement.jsx` is 50 256 bytes — both are large files; grep for `console.log.*TODO\|// TODO\|stub` inside both before starting to find un-wired buttons.

**Pre-work:**

```bash
# Confirm actual file names
ls client-app/src/pages/admin/
# → UserManagement.jsx, RetailerManagement.jsx (not Users.jsx / Retailers.jsx)

# Confirm API router files exist
ls ad-server/src/api/users.js ad-server/src/api/retailers.js 2>&1
# If either is missing, create it before UI wiring

# Confirm repositories export create/update/softDelete
grep -n "create\|update\|softDelete\|deactivate" \
  ad-server/src/repositories/UserRepository.js \
  ad-server/src/repositories/RetailerRepository.js
```

**Acceptance criteria:**

**Environment:** `NODE_ENV=development`, `x-demo-role: superadmin` header on all mutation requests.

| Verb | Route | Auth guard | Success | Error codes |
|---|---|---|---|---|
| POST | `/api/users` | `requireRole('superadmin')` | 201 `{ user_id }` | 400, 403, 409 (email dupe) |
| DELETE | `/api/users/:id` | `requireRole('superadmin')` | 200 `{ status: 'inactive' }` | 403, 404 |
| POST | `/api/retailers` | `requireRole('superadmin')` | 201 `{ retailer_id }` | 400, 403, 409 |
| PATCH | `/api/retailers/:id` | `requireRole('superadmin')` | 200 | 400, 403, 404 |
| DELETE | `/api/retailers/:id` | `requireRole('superadmin')` | 200 `{ status: 'inactive' }` | 403, 404 |

**data-testid requirements:**

```
data-testid="add-user-btn"
data-testid="user-row-{id}"
data-testid="delete-user-btn-{id}"
data-testid="add-retailer-btn"
data-testid="retailer-row-{id}"
data-testid="delete-retailer-btn-{id}"
```

**Persistence check (mandatory):** After each create/delete, hard-refresh (`Ctrl+Shift+R`) the management page. Record must appear / be absent in the list. Story is only passed if the record survives the refresh.

**GUARDRAIL checks:**
- [ ] G1: `apiService.createUser()`, `apiService.deleteUser()`, `apiService.createRetailer()`, `apiService.updateRetailer()`, `apiService.deleteRetailer()` — verify or create in `ApiService.js`
- [ ] G2: All five routes confirmed in router source
- [ ] G3: All mutations confirm `requireRole('superadmin')`
- [ ] G4: `users.status` enum: `active | inactive` per schema

---

### S11-2 · Super Admin CRUD — Advertisers (MVP Blocker)

**Priority:** Critical
**Confidence:** 82%
**TASK refs:** TASK-07, TASK-08
**Files (corrected):**
- `client-app/src/pages/admin/AdvertiserManagement.jsx` ← ~~Advertisers.jsx does not exist~~
- `ad-server/src/api/advertisers.js` (verify existence before wiring)
- `ad-server/src/repositories/AdvertiserRepository.js` (1 441 bytes — check soft-delete exists)

**Context:** "Add Advertiser" and "Remove Advertiser" buttons are not wired to any API. `AdvertiserRepository.js` at 1 441 bytes is small — may be missing a soft-delete or `findByEmail` for the 409 guard. Check before writing the router.

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

### S11-4 · Retailer CRUD — Add Location

**Priority:** High
**Confidence:** 78%
**TASK ref:** TASK-20
**Files (corrected):**
- `client-app/src/pages/retailer/RetailerDashboard.jsx` ← ~~Locations.jsx does not exist~~
- `ad-server/src/api/stores.js` (verify existence)
- `ad-server/src/repositories/StoreRepository.js` (1 132 bytes — confirm `create()` method)

**Context:** "Add Location" button in the retailer dashboard does not create a store record in Firestore. `LocationRepository.js` is 232 bytes — almost certainly a bare stub. Confirm `StoreRepository.js` method surface and `stores.js` router existence before writing any code.

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

### S11-5 · Retailer approval workflow — loop preview page

**Priority:** High
**Confidence:** 83%
**Risk refs:** R3, R4 from sprintWRAPUP
**TASK refs:** TASK-18 (Schedule Calendar), TASK-19 (Go Back crash)
**Files (corrected):**
- `client-app/src/pages/retailer/Loops.jsx` ← **already exists** (5 778 bytes) — do NOT re-create
- `client-app/src/pages/retailer/ScheduleCalendar.jsx` ← **already exists** (14 241 bytes)
- `client-app/src/pages/retailer/ScheduleHistory.jsx` ← **already exists** (20 355 bytes)
- `client-app/src/pages/retailer/ScheduleManager.jsx` ← **already exists** (24 906 bytes)
- `client-app/src/App.jsx` — confirm route registration for all above

**Context:** The primary risk ("Loops.jsx missing entirely") is eliminated — the file exists at HEAD `682eb456`. The work in this story is route registration, broken navigation links, and the Go Back crash fix. The Schedule Calendar at `/dashboard/retailer/schedule/calendar` may route to a dead path if `App.jsx` registration is missing.

**Pre-work:**

```bash
# Confirm Loops.jsx and ScheduleCalendar.jsx are registered in App.jsx
grep -n "Loops\|ScheduleCalendar\|schedule/calendar\|retailer/loops" \
  client-app/src/App.jsx

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

### S11-6 · Demo Player — cascading selection + full-day playback + impression wiring

**Priority:** High
**Confidence:** 72%
**TASK refs:** TASK-09, TASK-10
**Files (corrected):**
- `client-app/src/pages/Player.jsx` ← ~~pages/demo/Player.jsx does not exist~~
- `client-app/src/services/TelemetryService.js`

**Context:** The Demo Player is the primary MVP showcase. `Player.jsx` is 23 KB — its internal wiring is the largest single unknown in this sprint. Impression persistence in `telemetry.js` is **already fully wired** at commit `98bd645` (`impressionLimiter` mounted, `impressionRepository.logImpression()` called, `campaignRepository.update()` increments `play_count`). The V3 pre-condition is resolved; this story is no longer blocked by S11-3.

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

> ⚠️ **Rate-limiter / speed-multiplier collision:** 24h × 12 slots at 60× = 288 impression calls per session against a 100 req/min cap. The 60× test **will** trigger the rate limiter. Fix: add `NODE_ENV !== 'test'` guard to `impressionLimiter` before E2E runs, or test 60× at the UI layer with a mocked fetch.

**GUARDRAIL checks:**
- [ ] G1: `TelemetryService.trackImpression()` — verify signature in `TelemetryService.js`
- [ ] G2: `POST /api/telemetry/impression → { screen_id, campaign_id, asset_id?, loop_id?, played_at? }` confirmed
- [ ] G3: Telemetry route uses `requireAuth` (device-level). Confirmed.

---

### S11-7 · Network Map — fix blank render

**Priority:** Medium
**Confidence:** 88%
**TASK ref:** TASK-12
**Files (corrected):**
- `client-app/src/pages/admin/NetworkMap.jsx` ← confirmed on disk (4 203 bytes)
- `.env` / Cloud Run env config

**Context:** The network map renders blank. Root cause is likely a missing Google Maps API key in the environment or a container with `height: 0`. API key procurement is an external dependency — the fallback message is the mitigation for missing keys.

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

### S11-8 · Tech Ops dashboard — network-wide screen data

**Priority:** Medium
**Confidence:** 85%
**TASK ref:** TASK-23
**Files:**
- `client-app/src/pages/tech/` — confirm exact dashboard filename before starting
- `ad-server/src/api/screens.js`
- `ad-server/src/repositories/ScreenRepository.js` (2 885 bytes — confirmed)

**Context:** Tech Ops dashboard shows filtered/incomplete screen data instead of the full network view required by the MVP. `ScreenRepository.js` exists with meaningful content; the work is adding a role-conditional branch to `GET /api/screens`.

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
S11-3 (security) ──── must merge first ──────► S11-1 (CRUD writes)
                                                S11-2 (CRUD writes)

V3 (telemetry rate limit) ── ALREADY DONE ───► S11-6 no longer blocked by S11-3 ✅

S9-1 (impression persist) ─ already in main ──► S11-6 telemetry wiring ✅

S11-1 (onboard retailer) ── enables ──────────► S11-4 (add location)
                                                 S11-5 (retailer loops need real retailer)
```

**Recommended merge order:** S11-3 → S11-1 + S11-2 (parallel, split into sub-PRs) → S11-5 + S11-8 (parallel) → S11-7 → S11-6

---

## Deferred to Post-MVP (do not schedule this sprint)

- "Report Issue" and "Disconnect/Reestablish" screen actions (TASK-16, TASK-17)
- Notifications feed (`notifications.js` stub — Risk R5)
- Advanced analytics / campaign summary dashboard
- Retailer context selector for Super Admin impersonation (TASK-21)

---

## Story Point Summary

| Story | Priority | Confidence | Effort (est.) | Blocker? |
|---|---|---|---|---|
| S11-3 · Security hardening | Critical | 97% | S | Yes — merge first |
| S11-1 · Super Admin CRUD — Users & Retailers | Critical | 80% | L | Yes — no real onboarding without it |
| S11-2 · Super Admin CRUD — Advertisers | Critical | 82% | M | Yes |
| S11-4 · Retailer CRUD — Add Location | High | 78% | S | Needs S11-1 |
| S11-5 · Loop preview + approval workflow | High | 83% | M | No |
| S11-6 · Demo Player full wiring | High | 72% | M | Needs S11-3 |
| S11-7 · Network Map blank render | Medium | 88% | S | No |
| S11-8 · Tech Ops network-wide data | Medium | 85% | S | No |

**Estimated sprint velocity:** 8 stories — recommend splitting S11-1 into two sub-PRs (Users / Retailers) for easier review.

---

*Sprint 11 doc created 2026-06-06. Updated 2026-06-06 with corrections from SRE/QA analysis (`sprint11-sre-qa-analysis.md`) @ codebase commit `682eb456`.*
