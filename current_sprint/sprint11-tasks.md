# Sprint 11 — Critical & High Quality Gap Task List

**Generated:** 2026-06-06
**Updated:** 2026-06-06 — added S11-7, S11-8, confidence table, merge order
**Source authority:** `current_sprint/sprint11-sre-qa-analysis.md` @ codebase `682eb456`
**Cross-referenced with:** `current_sprint/sprint11.md`

---

## Confidence Score Summary

| Story | Confidence | Priority | Effort | Merge order |
|---|---|---|---|---|
| S11-3 · Security hardening | **97%** | Critical | S | 1 — merge first |
| S11-7 · Network Map blank render | **88%** | Medium | S | 6 |
| S11-8 · Tech Ops network-wide data | **85%** | Medium | S | 5 |
| S11-5 · Retailer approval workflow | **83%** | High | M | 4 |
| S11-2 · Super Admin CRUD — Advertisers | **82%** | Critical | M | 3 |
| S11-1 · Super Admin CRUD — Users & Retailers | **80%** | Critical | L | 2 |
| S11-4 · Retailer CRUD — Add Location | **78%** | High | S | after S11-1 |
| S11-6 · Demo Player full wiring | **72%** | High | M | last |

**Recommended merge order:** S11-3 → S11-1 + S11-2 (parallel) → S11-5 + S11-8 (parallel) → S11-7 → S11-6

---

## Critical Gaps

---

### S11-3 · Security Hardening — ⟵ MERGE FIRST (97% confidence)

Two auth guards missing from `campaigns.js`. V3 (telemetry rate limit) is already resolved.

- [ ] Run `grep -n "requireRole\|router.patch\|router.delete" ad-server/src/api/campaigns.js` — confirm current guard state
- [ ] Add `requireRole('retaileradmin')` middleware to `PATCH /api/campaigns/:id/status`
- [ ] Add `requireRole('superadmin')` middleware to `DELETE /api/campaigns/:id`
- [ ] Verify `impressionLimiter` is wired (not a dead import): `grep -n "impressionLimiter" ad-server/src/api/telemetry.js`
- [ ] Test: unauthenticated `PATCH` → must return 401/403; `DELETE` with `x-demo-role: brand` → must return 403
- [ ] Test: 101 rapid POSTs to `/api/telemetry/impression` → 101st must return `429 { error: 'Too Many Requests' }` (title case — not lowercase)

---

### S11-1 · Super Admin CRUD — Users & Retailers (80% confidence)

All CRUD forms are UI-only — nothing persists to Firestore.

- [ ] `ls client-app/src/pages/admin/` — confirm `UserManagement.jsx` and `RetailerManagement.jsx` (not `Users.jsx` / `Retailers.jsx`)
- [ ] `ls ad-server/src/api/users.js ad-server/src/api/retailers.js` — if either is missing, **create the router file first** before any UI wiring
- [ ] `grep -n "create\|update\|softDelete\|deactivate" ad-server/src/repositories/UserRepository.js ad-server/src/repositories/RetailerRepository.js` — add any missing methods
- [ ] `grep -n "console.log.*TODO\|// TODO\|stub" client-app/src/pages/admin/UserManagement.jsx` — locate unwired buttons
- [ ] Wire `POST /api/users` with `requireRole('superadmin')` → 201 `{ user_id }`; 409 on email dupe
- [ ] Wire `DELETE /api/users/:id` with `requireRole('superadmin')` → 200 `{ status: 'inactive' }`
- [ ] Wire `POST /api/retailers` with `requireRole('superadmin')` → 201 `{ retailer_id }`; 409 on dupe
- [ ] Wire `PATCH /api/retailers/:id` with `requireRole('superadmin')` → 200
- [ ] Wire `DELETE /api/retailers/:id` with `requireRole('superadmin')` → 200 `{ status: 'inactive' }`
- [ ] Add `data-testid` attributes: `add-user-btn`, `user-row-{id}`, `delete-user-btn-{id}`, `add-retailer-btn`, `retailer-row-{id}`, `delete-retailer-btn-{id}`
- [ ] **Persistence check:** hard-refresh after every create/delete — record must survive the reload

---

### S11-2 · Super Admin CRUD — Advertisers (82% confidence)

"Add Advertiser" and "Remove Advertiser" buttons are not wired to any API.

- [ ] `ls ad-server/src/api/advertisers.js` — if missing, create router file before UI wiring
- [ ] `grep -n "create\|delete\|deactivate" ad-server/src/repositories/AdvertiserRepository.js` — at 1 441 bytes it may be missing soft-delete and `findByEmail`
- [ ] Add `findByEmail()` to `AdvertiserRepository.js` if absent (needed for 409 email-dupe guard)
- [ ] Wire `POST /api/advertisers` with `requireRole('superadmin')` → 201 `{ advertiser_id }`; 409 on email dupe
- [ ] Wire `DELETE /api/advertisers/:id` with `requireRole('superadmin')` → 200 `{ status: 'inactive' }`
- [ ] Add `data-testid` attributes: `add-advertiser-btn`, `advertiser-row-{id}`, `delete-advertiser-btn-{id}`, `advertiser-email-input`
- [ ] **Persistence check:** hard-refresh after create/delete

---

## High Priority Gaps

---

### S11-6 · Demo Player — Full Wiring (72% confidence — lowest in sprint)

`Player.jsx` is 23 KB and unread. Speed-multiplier will collide with rate limiter at 60×.

- [ ] `grep -n "retailer.*store\|store.*screen\|cascad\|selector" client-app/src/pages/Player.jsx` — confirm cascading selector scaffolding exists or needs building from scratch
- [ ] `grep -n "TelemetryService\|trackImpression\|telemetry" client-app/src/pages/Player.jsx` — confirm or add `TelemetryService.trackImpression()` call site
- [ ] `grep -n "trackImpression\|function track\|export" client-app/src/services/TelemetryService.js` — confirm method signature before wiring
- [ ] `grep -n "findById" ad-server/src/repositories/BaseRepository.js` — confirm exists (needed by `play_count` increment)
- [ ] **Fix rate-limiter collision:** add `if (process.env.NODE_ENV !== 'test')` guard around `impressionLimiter` in `ad-server/src/api/telemetry.js` — 60× speed = 288 calls/session vs. 100 req/min cap → will fail E2E without this guard
- [ ] Wire cascading selectors: retailer → store → screen (each dropdown disabled until parent selected; clears on parent change)
- [ ] Wire "Play Full Day" to cycle 24 hourly loops with speed options 1×, 10×, 60×
- [ ] Ensure impression counter (`data-testid="impression-counter"`) increments on each ad slot
- [ ] Add all `data-testid` attributes: `retailer-select`, `store-select`, `screen-select`, `play-full-day-btn`, `speed-select`, `impression-counter`
- [ ] **Persistence check:** after playback session, query Firestore `impressions` collection for records matching `screen_id`

---

### S11-4 · Retailer CRUD — Add Location (78% confidence)

`LocationRepository.js` is a 232-byte stub; `stores.js` router is unconfirmed.

- [ ] `cat ad-server/src/repositories/StoreRepository.js` — read full file to confirm `create()` method exists; add if missing
- [ ] `ls ad-server/src/api/stores.js` — if missing, create the router file (scope expands significantly if absent)
- [ ] `grep -rn "Add Location\|addLocation\|add-location" client-app/src/pages/retailer/RetailerDashboard.jsx` — locate button entry point in the UI
- [ ] Confirm demo auth middleware sets `req.user.retailer_id` — `retailer_id` must come from session context, **not** a form field
- [ ] Wire `POST /api/stores` with `requireRole('retaileradmin')` → 201 `{ store_id }`; body: `{ name, address, city, province, postal_code, retailer_id }`
- [ ] Add `data-testid` attributes: `add-location-btn`, `location-name-input`, `location-address-input`, `location-submit-btn`, `location-row-{id}`
- [ ] **Persistence check:** hard-refresh retailer dashboard after submit — new location must appear in list

---

### S11-5 · Retailer Approval Workflow — Loop Preview (83% confidence)

`Loops.jsx` exists on disk but route registration in `App.jsx` is unconfirmed.

- [ ] `grep -n "Loops\|ScheduleCalendar\|schedule/calendar\|retailer/loops" client-app/src/App.jsx` — if either route is missing, add import + `<Route>` declaration
- [ ] `grep -n "router.get\|locations.*loops\|retailer.*loops" ad-server/src/api/loops.js` — confirm `GET /api/locations/:id/loops` exists on the backend; create if absent
- [ ] `grep -n "schedule/calendar\|/history\|Go Back\|goBack" client-app/src/pages/retailer/RetailerDashboard.jsx` — find broken quick-action hrefs (TASK-19) and correct them to registered routes
- [ ] Fix "Go Back" crash in `ScheduleHistory.jsx` — use `navigate(-1)` or an explicit route path
- [ ] Read `Loops.jsx` — confirm or add `data-testid` attributes: `loops-list`, `loop-row-{id}`, `loop-status-badge-{id}`, `schedule-calendar-container`
- [ ] Verify loop status badge only renders lowercase `draft` | `approved` | `locked`: `grep -rn "'APPROVED'\|'DRAFT'\|'LOCKED'" client-app/src/pages/retailer/` — must return zero results

---

## Medium Priority Gaps

---

### S11-7 · Network Map — Fix Blank Render (88% confidence)

Map renders blank — likely a missing `VITE_GOOGLE_MAPS_API_KEY` env var or a zero-height container.

- [ ] `cat client-app/src/pages/admin/NetworkMap.jsx` — read full file to identify root cause (key check vs. container height vs. missing `useEffect`)
- [ ] `grep -n "GOOGLE_MAPS\|VITE_GOOGLE" .env.example client-app/.env.example 2>/dev/null` — confirm key is documented
- [ ] `grep -n "height\|min-height\|style=" client-app/src/pages/admin/NetworkMap.jsx` — confirm map container has a non-zero height (CSS `height: 0` is a common blank-map cause)
- [ ] **Case A — API key present:** verify Google Maps tiles render; at least one pin visible when `GET /api/screens` returns data; pin click opens tooltip with screen name and status
- [ ] **Case B — API key absent:** add `data-testid="map-unavailable-msg"` fallback — text must read `"Map unavailable — API key not configured"`; container must have `min-height: 400px`; no uncaught Google Maps JS exception in console
- [ ] Add `VITE_GOOGLE_MAPS_API_KEY=your_key_here  # Required for Network Map` to `docs/ENVIRONMENT_SETUP.md`

---

### S11-8 · Tech Ops Dashboard — Network-Wide Screen Data (85% confidence)

Dashboard shows filtered/incomplete data instead of the full network view.

- [ ] `ls client-app/src/pages/tech/` — confirm exact Tech Ops dashboard filename before starting
- [ ] `grep -n "requireRole\|router.get\|techops\|retaileradmin" ad-server/src/api/screens.js` — confirm role-conditional branch exists or add it
- [ ] `grep -n "findAll\|getAll\|where.*retailer" ad-server/src/repositories/ScreenRepository.js` — confirm unfiltered `findAll()` exists; add if missing
- [ ] Implement role-conditional query branch:
  - `techops` → `GET /api/screens` returns **all screens, all retailers** — 200
  - `retaileradmin` → filtered by `retailer_id` from session — 200
  - `brand` → 403
- [ ] Dashboard KPIs must show: total screens, online count, offline count, screens with active campaigns
- [ ] Screen list must be sortable by status and last heartbeat
- [ ] Add `data-testid` attributes: `total-screens-kpi`, `online-screens-kpi`, `offline-screens-kpi`, `active-campaigns-kpi`, `screen-table`, `screen-row-{id}`, `sort-by-status`, `sort-by-heartbeat`
- [ ] **GUARDRAIL-G3:** `requireRole('techops')` confirmed on unfiltered variant

---

## Pre-Sprint Checklist (resolve before planning meeting)

- [ ] Run `ls ad-server/src/api/` — confirm which of `users.js`, `retailers.js`, `advertisers.js`, `stores.js` exist
- [ ] Run `grep -n "requireRole" ad-server/src/api/campaigns.js` — confirm or add V1/V2 guards
- [ ] Read `client-app/src/pages/Player.jsx` — confirm or add `TelemetryService.trackImpression()` call site
- [ ] Run `grep -n "Loops\|ScheduleCalendar" client-app/src/App.jsx` — confirm route registration
- [ ] Add `NODE_ENV !== 'test'` guard to `impressionLimiter` before S11-6 E2E tests run
- [ ] Confirm `BaseRepository.findById()` exists — needed by telemetry `play_count` increment
- [ ] Confirm `ENUM-AUDIT-3`: `grep -r "'APPROVED'\|'PENDING'" --include="*.js" --include="*.jsx"` returns zero results

---

*Task list generated 2026-06-06 from `sprint11-sre-qa-analysis.md` cross-referenced with `sprint11.md`.*
*Updated 2026-06-06 — added S11-7 (Network Map), S11-8 (Tech Ops), confidence score summary table, and recommended merge order.*
