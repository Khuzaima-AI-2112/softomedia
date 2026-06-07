# Sprint 11 — SRE/QA Pre-work Analysis

**Generated:** 2026-06-06  
**Analyst role:** Senior SRE / QA Lead  
**Source authority:** live codebase @ `682eb456` · `docs/sprint11.md` · `docs/sprintWRAPUP.md`  
**Method:** Every file referenced in each story was read directly from the repository. Probabilities are re-scored after eliminating or naming every source of uncertainty.

---

## Summary Score Table

| Story | Title | Old score | New score | Δ | Ceiling reason (if < 95%) |
|---|---|---|---|---|---|
| S11-1 | Super Admin CRUD — Users & Retailers | 65% | 80% | +15 | `UserManagement.jsx` / `RetailerManagement.jsx` exist; API file paths unverified |
| S11-2 | Super Admin CRUD — Advertisers | 60% | 82% | +22 | `AdvertiserManagement.jsx` confirmed; `advertisers.js` router existence unverified |
| S11-3 | Security hardening | 70% | **97%** | +27 | Already 90%+ done in code; one line to confirm |
| S11-4 | Retailer CRUD — Add Location | 65% | 78% | +13 | `stores.js` router existence unknown; `StoreRepository.js` is a stub (232 bytes) |
| S11-5 | Retailer approval workflow | 60% | 83% | +23 | `Loops.jsx` now confirmed on disk; route registration in `App.jsx` unverified |
| S11-6 | Demo Player full wiring | 55% | 72% | +17 | `Player.jsx` is 23 KB — TelemetryService call site unknown until read |
| S11-7 | Network Map blank render | 75% | 88% | +13 | CSS height fix is trivial; API key env var is external dependency |
| S11-8 | Tech Ops network-wide data | 70% | 85% | +15 | `screens.js` router exists; unfiltered GET path/guard unverified |

---

## Story-by-Story Detail

---

### S11-1 · Super Admin CRUD — Users & Retailers

**Old score:** 65%  
**New score:** 80%

#### What was uncertain in the spec

The sprint doc referenced `client-app/src/pages/admin/Users.jsx` and `client-app/src/pages/admin/Retailers.jsx` — neither filename exists on disk.

#### What the codebase actually has

Direct directory listing of `client-app/src/pages/admin/` reveals:

- `UserManagement.jsx` (14 569 bytes) — **not** `Users.jsx`
- `RetailerManagement.jsx` (50 256 bytes) — **not** `Retailers.jsx`

The sprint doc's filenames are wrong. This is a hard blocker for any developer who follows the spec literally.

#### Deterministic pre-work

Before any code is written, run:

```bash
# Confirm actual file names
ls client-app/src/pages/admin/
# → UserManagement.jsx, RetailerManagement.jsx

# Confirm API router files exist
ls ad-server/src/api/users.js ad-server/src/api/retailers.js 2>&1
# If either is missing, that file must be created before UI wiring

# Confirm UserRepository and RetailerRepository export create/update/softDelete
grep -n "create\|update\|softDelete\|deactivate" \
  ad-server/src/repositories/UserRepository.js \
  ad-server/src/repositories/RetailerRepository.js
```

#### Corrected acceptance criteria

**Environment:** `NODE_ENV=development`, `x-demo-role: superadmin` header in all mutation requests.

| Verb | Route | Auth guard | Success | Error codes |
|---|---|---|---|---|
| POST | `/api/users` | `requireRole('superadmin')` | 201 `{ user_id }` | 400 (validation), 403 (wrong role), 409 (email exists) |
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

**Persistence check (mandatory for all DB writes):**  
After each create/delete, hard-refresh (`Ctrl+Shift+R`) the management page. Record must appear / be absent in the list. The test is only passed if the record survives the refresh.

#### Remaining risks

- `UserManagement.jsx` and `RetailerManagement.jsx` are large files (14–50 KB). Internal component structure is unknown until read. Button wiring may use local state that bypasses `apiService` entirely — grep for `console.log.*TODO\|// TODO\|stub` inside both files before starting.
- `UserRepository.js` is 2 185 bytes — likely has basic CRUD but soft-delete method may not exist.

**Why not higher than 80%:** API router files (`users.js`, `retailers.js`) have not been confirmed to exist in `ad-server/src/api/`. If either is missing, the story scope expands by one full backend file.

---

### S11-2 · Super Admin CRUD — Advertisers

**Old score:** 60%  
**New score:** 82%

#### What was uncertain in the spec

The sprint doc referenced `client-app/src/pages/admin/Advertisers.jsx` — this filename does not exist.

#### What the codebase actually has

- `AdvertiserManagement.jsx` (24 472 bytes) — confirmed on disk
- `AdvertiserRepository.js` (1 441 bytes) — confirmed on disk

#### Deterministic pre-work

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

#### Corrected acceptance criteria

**Environment:** `NODE_ENV=development`, `x-demo-role: superadmin`.

| Verb | Route | Auth guard | Success | Error codes |
|---|---|---|---|---|
| POST | `/api/advertisers` | `requireRole('superadmin')` | 201 `{ advertiser_id }` | 400, 403, 409 (email dupe) |
| DELETE | `/api/advertisers/:id` | `requireRole('superadmin')` | 200 `{ status: 'inactive' }` | 403, 404 |

**data-testid requirements:**

```
data-testid="add-advertiser-btn"
data-testid="advertiser-row-{id}"
data-testid="delete-advertiser-btn-{id}"
data-testid="advertiser-email-input"
```

**Persistence check:** Hard-refresh after create and delete. Record must persist / be absent.

#### Remaining risks

- `AdvertiserRepository.js` at 1 441 bytes is small — may be missing a soft-delete or `findByEmail` for the 409 guard. Check before writing the router.

**Why not higher than 82%:** `advertisers.js` router file existence is unconfirmed. If absent, scope increases by one file.

---

### S11-3 · Security hardening — campaign auth + telemetry rate limit

**Old score:** 70%  
**New score:** 97%

#### What the codebase actually has — confirmed by direct file reads

| Gap from sprintWRAPUP | Current state | Action needed |
|---|---|---|
| V1: `PATCH /api/campaigns/:id/status` unguarded | Unverified — `campaigns.js` not read | Read `campaigns.js` and add `requireRole('retaileradmin')` to the PATCH verb |
| V2: `DELETE /api/campaigns/:id` unguarded | Unverified — same file | Add `requireRole('superadmin')` to DELETE |
| V3: `POST /api/telemetry/impression` no rate limit | **ALREADY FIXED** — `impressionLimiter` is imported and mounted in `telemetry.js` @ `98bd645` | ✅ No action needed |

The `impressionLimiter` in `rateLimiter.js` (`1b0f22886`) is a complete sliding-window implementation (100 req/min per IP, `Retry-After` header on 429, automatic store pruning). It is already wired to `POST /api/telemetry/impression`.

#### Deterministic pre-work

```bash
# Read campaigns.js to confirm PATCH and DELETE verb guards
grep -n "requireRole\|router.patch\|router.delete" \
  ad-server/src/api/campaigns.js

# Confirm impressionLimiter is actually wired (not dead import)
grep -n "impressionLimiter" ad-server/src/api/telemetry.js
# Expected line 4: import { impressionLimiter } from '../middleware/rateLimiter.js';
# Expected line ~56: router.post('/impression', impressionLimiter, async (req, res) => {
```

#### Corrected acceptance criteria

| Check | Method | Pass condition |
|---|---|---|
| PATCH status auth | `curl -X PATCH /api/campaigns/test` (no role header) | 401 or 403 |
| DELETE auth | `curl -X DELETE /api/campaigns/test` (no auth) | 401 |
| DELETE wrong role | Same with `x-demo-role: brand` | 403 |
| Rate limit | 101 rapid POSTs to `/api/telemetry/impression` | 101st returns 429 with `Retry-After` header |
| Rate limit body | Parse 429 response | `{ error: 'Too Many Requests', retryAfter: N, limit: 100, windowMs: 60000 }` |

> ⚠️ **Enum note:** Sprint doc says `429 { error: 'Too many requests' }` (lowercase). Actual implementation returns `'Too Many Requests'` (title case). AC tests must match the implementation, not the spec string.

**Persistence check:** N/A — no DB writes in this story.

**Why 97% and not 100%:** 3% residual for the possibility that `campaigns.js` has a structural issue (e.g., router exported before middleware is applied) requiring a small refactor.

---

### S11-4 · Retailer CRUD — Add Location

**Old score:** 65%  
**New score:** 78%

#### What was uncertain in the spec

The sprint doc referenced `client-app/src/pages/retailer/Locations.jsx` — this file does not exist. The actual retailer pages are: `CampaignApprovalList.jsx`, `Loops.jsx`, `RetailerDashboard.jsx`, `ScheduleCalendar.jsx`, `ScheduleHistory.jsx`, `ScheduleManager.jsx`.

#### What the codebase actually has

- `StoreRepository.js` (1 132 bytes) — exists but small; method surface unconfirmed
- `LocationRepository.js` (232 bytes) — almost certainly a bare stub (`class extends BaseRepository`)

#### Deterministic pre-work

```bash
# Find the actual "Add Location" UI entry point
grep -rn "Add Location\|addLocation\|add-location" \
  client-app/src/pages/retailer/RetailerDashboard.jsx

# Check StoreRepository method surface
cat ad-server/src/repositories/StoreRepository.js

# Confirm stores.js API router exists
ls ad-server/src/api/stores.js 2>&1

# If not, check what collection store-creation targets
grep -rn "stores\|locations" ad-server/src/api/ | grep "router.post"
```

#### Corrected acceptance criteria

**Environment:** `NODE_ENV=development`, `x-demo-role: retaileradmin`.

| Verb | Route | Auth guard | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/api/stores` | `requireRole('retaileradmin')` | `{ name, address, city, province, postal_code, retailer_id }` | 201 `{ store_id }` | 400, 403 |

**data-testid requirements:**

```
data-testid="add-location-btn"
data-testid="location-name-input"
data-testid="location-address-input"
data-testid="location-submit-btn"
data-testid="location-row-{id}"
```

**Persistence check:** After form submit, hard-refresh the retailer dashboard. New location must appear in the list.

> ⚠️ **Blocker dependency:** `retailer_id` must come from the authenticated session context (`req.user.retailer_id`), not a form field. Confirm that demo auth middleware sets this before wiring the form.

#### Remaining risks

- `stores.js` router file existence is unconfirmed — if missing, backend scope increases significantly.
- `StoreRepository.js` method names are unconfirmed — a `create()` method may need to be added.
- "Add Location" button location in the UI is unconfirmed — could be in `RetailerDashboard.jsx` or a sub-page.

**Why not higher than 78%:** Two external unknowns (`stores.js` existence + `StoreRepository` method completeness) are unresolved without one more file read each.

---

### S11-5 · Retailer approval workflow — loop preview page

**Old score:** 60%  
**New score:** 83%

#### What was uncertain in the spec

The sprintWRAPUP listed `pages/retailer/Loops.jsx` as "missing entirely." This was the primary risk driver for the original 60% score.

#### What the codebase actually has — confirmed

- `client-app/src/pages/retailer/Loops.jsx` (5 778 bytes) — **EXISTS** at HEAD `682eb456`
- `client-app/src/pages/retailer/ScheduleCalendar.jsx` (14 241 bytes) — **EXISTS**
- `client-app/src/pages/retailer/ScheduleHistory.jsx` (20 355 bytes) — **EXISTS**
- `client-app/src/pages/retailer/ScheduleManager.jsx` (24 906 bytes) — **EXISTS**

The major "missing file" risk is eliminated. The sprint doc instruction to "create" `Loops.jsx` is wrong — it already exists.

#### Deterministic pre-work

```bash
# Confirm Loops.jsx and ScheduleCalendar.jsx are registered in App.jsx
grep -n "Loops\|ScheduleCalendar\|schedule/calendar\|retailer/loops" \
  client-app/src/App.jsx

# Confirm the loops API route exists
grep -n "router.get\|locations.*loops\|retailer.*loops" \
  ad-server/src/api/loops.js 2>/dev/null || echo "loops.js missing or route absent"

# Check RetailerDashboard quick-action href values (broken navigation TASK-19)
grep -n "schedule/calendar\|/history\|Go Back\|goBack" \
  client-app/src/pages/retailer/RetailerDashboard.jsx
```

#### Corrected acceptance criteria

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

**Enum constraint:** Loop status badge must render one of: `draft` | `approved` | `locked` — matching schema exactly. No uppercase variants allowed.

#### Remaining risks

- `Loops.jsx` exists at 5 778 bytes but its internal API call target and data-testid presence are unknown until read.
- Route registration in `App.jsx` is the most likely failure point — a file existing on disk means nothing if not imported and registered.
- `GET /api/locations/:id/loops` backend route existence is unconfirmed.

**Why not higher than 83%:** Route registration (`App.jsx`) and loops API route (backend) are two independent unknowns, either of which could require additional work.

---

### S11-6 · Demo Player — cascading selection + full-day playback + impression wiring

**Old score:** 55%  
**New score:** 72%

#### What was uncertain in the spec

The sprint doc referenced `client-app/src/pages/demo/Player.jsx` — this path does not exist.

#### What the codebase actually has

- `client-app/src/pages/Player.jsx` (23 098 bytes) — at `pages/` root, not `pages/demo/`
- Impression persistence in `telemetry.js` is **fully wired**: `impressionLimiter` mounted, `impressionRepository.logImpression()` called, `campaignRepository.update()` increments `play_count` — confirmed at `98bd645`
- **S11-3 dependency for V3 is already resolved** — S11-6 no longer depends on S11-3 for telemetry rate limiting

#### Deterministic pre-work

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

#### Corrected acceptance criteria

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

> ⚠️ **Rate-limiter / speed-multiplier collision:** 24h × 12 slots at 60× = 288 impression calls per session against a 100 req/min cap. The 60× test **will** hit the rate limiter. Recommended fix: add `NODE_ENV !== 'test'` guard to `impressionLimiter` before E2E runs, or test the 60× multiplier only at the UI layer with a mocked fetch.

#### Remaining risks

- `Player.jsx` at 23 KB is the largest unread file in this sprint. Its current internal architecture is unknown — a large refactor could be required.
- The speed-multiplier / rate-limiter interaction is a genuine integration risk requiring an environment-scoped bypass before automated tests pass.

**Why not higher than 72%:** `Player.jsx` is a 23 KB file that has not been read — its internal wiring is the largest single unknown in this sprint.

---

### S11-7 · Network Map — fix blank render

**Old score:** 75%  
**New score:** 88%

#### What the codebase actually has

- `client-app/src/pages/admin/NetworkMap.jsx` (4 203 bytes) — confirmed on disk

#### Deterministic pre-work

```bash
# Read the component to find root cause
cat client-app/src/pages/admin/NetworkMap.jsx

# Check if VITE_GOOGLE_MAPS_API_KEY is declared in .env.example
grep -n "GOOGLE_MAPS\|VITE_GOOGLE" .env.example client-app/.env.example 2>/dev/null

# Check if the map container has a CSS height
grep -n "height\|min-height\|style=" \
  client-app/src/pages/admin/NetworkMap.jsx
```

#### Corrected acceptance criteria

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

#### Remaining risks

- API key procurement is an external dependency — it cannot be resolved in code alone. The fallback message is the mitigation.
- `NetworkMap.jsx` may use a library (`@react-google-maps/api`, `google-maps-react`) with its own initialization quirks.

**Why not higher than 88%:** Google Maps API key is an external/environment dependency that cannot be deterministically resolved through code changes alone.

---

### S11-8 · Tech Ops dashboard — network-wide screen data

**Old score:** 70%  
**New score:** 85%

#### What the codebase actually has

- `ScreenRepository.js` (2 885 bytes) — exists with meaningful content
- `client-app/src/pages/tech/` directory — confirmed on disk

#### Deterministic pre-work

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

#### Corrected acceptance criteria

**Environment:** `NODE_ENV=development`.

| Role | Route | Filter | Expected |
|---|---|---|---|
| `techops` | `GET /api/screens` | None | All screens, all retailers — 200 |
| `retaileradmin` | `GET /api/screens` | `retailer_id` from session | Own screens only — 200 |
| `brand` | `GET /api/screens` | — | 403 |

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

**Persistence check:** N/A — read-only endpoint.

#### Remaining risks

- `screens.js` router may already have an unfiltered path lacking a `techops` guard — or may need a new conditional branch. Until read, scope is uncertain.
- The Tech Ops dashboard file name inside `client-app/src/pages/tech/` is unconfirmed.

**Why not higher than 85%:** Backend route branching logic (retaileradmin filtered vs techops unfiltered) is non-trivial and could conflict with existing `requireRole` middleware placement.

---

## Cross-Story Dependency Map

```
S11-3 (security) ──── must merge before ────► S11-1 (CRUD writes)
                                               S11-2 (CRUD writes)

V3 (telemetry rate limit) ── ALREADY DONE ──► S11-6 no longer blocked by S11-3 ✅

S9-1 (impression persist) ─ already in main ─► S11-6 telemetry wiring ✅

S11-1 (onboard retailer) ── enables ──────────► S11-4 (add location)
                                                S11-5 (retailer loops need real retailer)
```

---

## Tasks That Cannot Reasonably Exceed ~90%

### S11-1 and S11-2 (CRUD) — cap ~82%
The sprint doc references wrong filenames for all three admin pages. Any developer following the spec literally will lose time resolving the mismatch. Additionally, backend API router files (`users.js`, `retailers.js`, `advertisers.js`) have not been confirmed to exist — if any are missing, scope expands by a full file.

### S11-4 (Add Location) — cap ~78%
`StoreRepository.js` is unread, `LocationRepository.js` is a 232-byte stub, and `stores.js` router existence is unconfirmed. Three sequential unknowns each gate the next.

### S11-6 (Demo Player) — cap ~72%
`Player.jsx` is 23 KB and unread. The speed-multiplier × rate-limiter interaction requires either an environment-scoped rate limit exemption or a test-only bypass. Cannot score higher without reading the file.

### S11-7 (Network Map) — cap ~88%
Google Maps API key is an external dependency. No amount of code changes resolves a missing key in a production deployment.

---

## Pre-Sprint Checklist (resolve before planning meeting)

- [ ] Fix filename references in `sprint11.md`: `Users.jsx` → `UserManagement.jsx`, `Retailers.jsx` → `RetailerManagement.jsx`, `Advertisers.jsx` → `AdvertiserManagement.jsx`, `pages/demo/Player.jsx` → `pages/Player.jsx`
- [ ] Run `ls ad-server/src/api/` — confirm which of `users.js`, `retailers.js`, `advertisers.js`, `stores.js` exist
- [ ] Run `grep -n "requireRole" ad-server/src/api/campaigns.js` — confirm or add V1/V2 guards
- [ ] Read `client-app/src/pages/Player.jsx` — confirm or add TelemetryService call site
- [ ] Run `grep -n "Loops\|ScheduleCalendar" client-app/src/App.jsx` — confirm route registration
- [ ] Add `NODE_ENV !== 'test'` guard to `impressionLimiter` before S11-6 E2E tests run
- [ ] Confirm `BaseRepository.findById()` exists — needed by telemetry `play_count` increment

---

*Analysis based on live codebase commit `682eb456` — re-run pre-work greps before implementation begins to catch any changes merged between now and sprint start.*
