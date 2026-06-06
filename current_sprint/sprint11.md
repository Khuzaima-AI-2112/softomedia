# Sprint 11 — MVP Gap Closure

**Sprint:** 11
**Status:** Planning
**Guardrails authority:** [`docs/sprint8-sre-retro-consolidated.md`](./sprint8-sre-retro-consolidated.md)
**Route authority:** [`docs/API_ROUTES.md`](./API_ROUTES.md)
**Schema authority:** [`docs/DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md)
**MVP reference:** [`docs/Digital Screen Network Management Platform (MVP).md`](<./Digital Screen Network Management Platform (MVP).md>)
**Gap source:** [`docs/sprintWRAPUP.md`](./sprintWRAPUP.md) — MVP analysis @ ~65% complete

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
- [ ] **SECURITY-V3** — `POST /api/telemetry/impression` has no rate limit. Add `express-rate-limit` middleware (100 req/min per IP) before Demo Player story ships.
- [ ] **`docs/MVP_SPRINT_PLAN.md`** — add Sprint 11 entry linking to this file.

---

## Backlog

### S11-1 · Super Admin CRUD — Users & Retailers (MVP Blocker)

**Priority:** Critical
**TASK refs:** TASK-02, TASK-03, TASK-04, TASK-05, TASK-06
**Files:**
- `client-app/src/pages/admin/Users.jsx`
- `client-app/src/pages/admin/Retailers.jsx`
- `ad-server/src/api/users.js`
- `ad-server/src/api/retailers.js`

**Context:** All Super Admin CRUD forms are UI-only and do not persist to Firestore. No real retailer or user can be onboarded without these routes.

**Acceptance criteria:**
- `POST /api/users` — creates a user document in Firestore `users` collection. `requireRole('superadmin') confirmed`.
- `DELETE /api/users/:id` — soft-deletes (sets `status: 'inactive'`). `requireRole('superadmin') confirmed`.
- `POST /api/retailers` — creates a retailer document. `requireRole('superadmin') confirmed`.
- `PATCH /api/retailers/:id` — updates retailer fields (name, status). `requireRole('superadmin') confirmed`.
- `DELETE /api/retailers/:id` — soft-deletes. `requireRole('superadmin') confirmed`.
- All forms call `apiService` methods wired to the above routes; no `console.log("TODO")` stubs remain.
- Returns `201` on create, `200` on update/delete, `404` if document not found, `403` if wrong role.
- `docs/API_ROUTES.md` updated to reflect any new routes.

**GUARDRAIL checks:**
- [ ] G1: `apiService.createUser()`, `apiService.deleteUser()`, `apiService.createRetailer()`, `apiService.updateRetailer()`, `apiService.deleteRetailer()` — verify or create in `ApiService.js`
- [ ] G2: All five routes confirmed in router source
- [ ] G3: All mutations confirm `requireRole('superadmin')`
- [ ] G4: `users.status` enum: `active | inactive` per schema

---

### S11-2 · Super Admin CRUD — Advertisers (MVP Blocker)

**Priority:** Critical
**TASK refs:** TASK-07, TASK-08
**Files:**
- `client-app/src/pages/admin/Advertisers.jsx`
- `ad-server/src/api/advertisers.js` (verify or create)

**Context:** "Add Advertiser" and "Remove Advertiser" buttons are not wired to any API. No advertiser can be onboarded.

**Acceptance criteria:**
- `POST /api/advertisers` — creates advertiser document. `requireRole('superadmin') confirmed`.
- `DELETE /api/advertisers/:id` — soft-deletes. `requireRole('superadmin') confirmed`.
- Form validation: name (required), email (required, valid format), billing contact (optional).
- Returns `201` on create, `200` on delete, `409` if email already exists.
- `docs/API_ROUTES.md` updated.

**GUARDRAIL checks:**
- [ ] G1: `apiService.createAdvertiser()`, `apiService.deleteAdvertiser()` — verify or create
- [ ] G2: Routes confirmed in router source
- [ ] G3: `requireRole('superadmin')` confirmed on both mutations

---

### S11-3 · Security hardening — campaign auth + telemetry rate limit

**Priority:** Critical (pre-condition for all other stories)
**Risk refs:** V1, V2, V3 from sprintWRAPUP
**Files:**
- `ad-server/src/api/campaigns.js`
- `ad-server/src/api/telemetry.js`
- `ad-server/src/middleware/` (rate limiter)

**Context:** Three security gaps identified in the MVP gap analysis block any public demo. Must be resolved first this sprint.

**Acceptance criteria:**
- `PATCH /api/campaigns/:id/status` — wrapped in `requireRole('retaileradmin')`. Spoofed `x-demo-role` header without a valid session returns `403`.
- `DELETE /api/campaigns/:id` — wrapped in `requireRole('superadmin')`. Unauthenticated call returns `401`.
- `POST /api/telemetry/impression` — `express-rate-limit` middleware applied: 100 requests per minute per IP. Exceeding limit returns `429 { error: 'Too many requests' }`.
- Manual test: `curl -X DELETE /api/campaigns/test123` without auth header → `401`. With `x-demo-role: brand` → `403`.

**GUARDRAIL checks:**
- [ ] G3: All three fixes name exact middleware and confirm placement in router chain
- [ ] G4: No enum changes in this story

---

### S11-4 · Retailer CRUD — Add Location

**Priority:** High
**TASK ref:** TASK-20
**Files:**
- `client-app/src/pages/retailer/Locations.jsx` (or equivalent)
- `ad-server/src/api/stores.js`

**Context:** "Add Location" button in the retailer dashboard does not create a store record in Firestore.

**Acceptance criteria:**
- `POST /api/stores` — creates a store document under the authenticated retailer's `retailer_id`. `requireRole('retaileradmin') confirmed`.
- Form fields: store name (required), address (required), city, province, postal code.
- On success, new location appears in the retailer's location list without page reload.
- Returns `201 { store_id }` on success, `400` on validation failure.
- `docs/API_ROUTES.md` updated.

**GUARDRAIL checks:**
- [ ] G1: `apiService.createStore()` — verify or create
- [ ] G2: `POST /api/stores → { name, address, retailer_id }` confirmed in `stores.js`
- [ ] G3: `requireRole('retaileradmin') confirmed`

---

### S11-5 · Retailer approval workflow — complete loop preview page

**Priority:** High
**Risk refs:** R3, R4 from sprintWRAPUP
**TASK refs:** TASK-18 (Schedule Calendar), missing `pages/retailer/Loops.jsx`
**Files:**
- `client-app/src/pages/retailer/Loops.jsx` (create)
- `client-app/src/pages/retailer/Schedule.jsx` (fix calendar route)
- `client-app/src/App.jsx` (register new route)

**Context:** `pages/retailer/Loops.jsx` does not exist on disk. The Schedule Calendar at `/dashboard/retailer/schedule/calendar` routes to a dead path. Retailers cannot preview loops or the daily schedule.

**Acceptance criteria:**
- `Loops.jsx` created and registered at `/dashboard/retailer/loops`.
- Page fetches loops for the authenticated retailer via `GET /api/locations/:id/loops` and renders them in a list (loop name, status badge, slot count, created date).
- Status badge uses canonical lowercase enum values: `draft`, `approved`, `locked`.
- Schedule Calendar route (`/dashboard/retailer/schedule/calendar`) resolves without a white screen or 404.
- Quick-action links in the retailer dashboard that point to `/schedule/calendar` and `/history` are updated to correct registered paths.
- Retailer dashboard "Go Back" navigation in Approval History does not crash (`TASK-19` fix included).

**GUARDRAIL checks:**
- [ ] G2: `GET /api/locations/:id/loops` confirmed in `loops.js` router
- [ ] G3: Route protected by `requireRole('retaileradmin')`
- [ ] G4: Status badge strings match schema: `approved | draft | locked`

---

### S11-6 · Demo Player — cascading selection + full-day playback + impression wiring

**Priority:** High
**TASK refs:** TASK-09, TASK-10
**Files:**
- `client-app/src/pages/demo/Player.jsx`
- `client-app/src/services/TelemetryService.js`

**Context:** The Demo Player is the primary MVP showcase. Retailer → Store → Screen cascading selection is not enforced. Full-day schedule playback is not implemented. `TelemetryService.trackImpression()` is not called during playback, so proof-of-play logging is non-functional.

**Acceptance criteria:**
- Retailer selector populates Store selector; Store selector populates Screen selector. Selecting a retailer clears downstream selections.
- "Play Full Day" cycles through all hourly loops in sequence (1–24) with a configurable speed multiplier (1×, 10×, 60×).
- On each ad play, `TelemetryService.trackImpression({ screen_id, campaign_id, asset_id, loop_id, played_at })` is called.
- `POST /api/telemetry/impression` receives the payload and persists to Firestore (depends on S9-1 being merged).
- Player shows a running impression counter per session.
- Rate limit (S11-3) must be in place before this story ships.

**GUARDRAIL checks:**
- [ ] G1: `TelemetryService.trackImpression()` — verify signature in `TelemetryService.js`
- [ ] G2: `POST /api/telemetry/impression → { screen_id, campaign_id, asset_id?, loop_id?, played_at? }` confirmed
- [ ] G3: Telemetry route uses `requireAuth` (device-level). Confirmed.

---

### S11-7 · Network Map — fix blank render

**Priority:** Medium
**TASK ref:** TASK-12
**Files:**
- `client-app/src/pages/techops/NetworkMap.jsx` (or equivalent)
- `.env` / Cloud Run env config

**Context:** The network map renders blank. Root cause is likely a missing Google Maps API key in the environment or a container with `height: 0`.

**Acceptance criteria:**
- Map renders with at least one screen pin when screens exist in Firestore.
- If `VITE_GOOGLE_MAPS_API_KEY` is missing, the component renders a fallback message ("Map unavailable — API key not configured") instead of a blank container.
- Map container has an explicit CSS height (`height: 100%` or `min-height: 400px`).
- `docs/ENVIRONMENT_SETUP.md` updated with `VITE_GOOGLE_MAPS_API_KEY` entry.

**GUARDRAIL checks:**
- [ ] G2: No new API routes in this story
- [ ] G4: No enum changes

---

### S11-8 · Tech Ops dashboard — network-wide screen data

**Priority:** Medium
**TASK ref:** TASK-23
**Files:**
- `client-app/src/pages/techops/TechOpsDashboard.jsx`
- `ad-server/src/api/screens.js`

**Context:** Tech Ops dashboard shows filtered/incomplete screen data instead of the full network view required by the MVP.

**Acceptance criteria:**
- `GET /api/screens` (no retailer filter) — returns all screens when called by `techops` role. `requireRole('techops') confirmed`.
- Dashboard KPIs show: total screens, online count, offline count, screens with active campaigns.
- Screen list is sortable by status and last heartbeat.
- `requireRole` guard prevents `retaileradmin` from calling the unfiltered endpoint.

**GUARDRAIL checks:**
- [ ] G2: `GET /api/screens` (unfiltered) confirmed in `screens.js`
- [ ] G3: `requireRole('techops') confirmed` for unfiltered variant

---

## Deferred to Post-MVP (do not schedule this sprint)

- "Report Issue" and "Disconnect/Reestablish" screen actions (TASK-16, TASK-17)
- Notifications feed (`notifications.js` stub — Risk R5)
- Advanced analytics / campaign summary dashboard
- Retailer context selector for Super Admin impersonation (TASK-21)

---

## Story Point Summary

| Story | Priority | Effort (est.) | Blocker? |
|---|---|---|---|
| S11-1 · Super Admin CRUD — Users & Retailers | Critical | L | Yes — no real onboarding without it |
| S11-2 · Super Admin CRUD — Advertisers | Critical | M | Yes |
| S11-3 · Security hardening | Critical | S | Yes — pre-condition for S11-6 |
| S11-4 · Retailer CRUD — Add Location | High | S | No |
| S11-5 · Loop preview + approval workflow | High | M | No |
| S11-6 · Demo Player full wiring | High | M | Needs S11-3 + S9-1 merged |
| S11-7 · Network Map blank render | Medium | S | No |
| S11-8 · Tech Ops network-wide data | Medium | S | No |

**Estimated sprint velocity:** 8 stories — recommend splitting S11-1 into two sub-PRs (Users / Retailers) for easier review.

---

*Sprint 11 doc created 2026-06-06 based on MVP gap analysis in `docs/sprintWRAPUP.md`.*
