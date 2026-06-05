# API Route Contract

**Authority:** This file is the single source of truth for every registered Express route in the ad-server.  
**Rule (GUARDRAIL-2):** Before any sprint story calls a backend endpoint, it must cite the exact row from this table. If a row is missing, add it here *and* register the route in the router file in the same sub-task.

---

## How to read this table

| Column | Meaning |
|---|---|
| **Method** | HTTP verb |
| **Path** | Relative to the service base URL (`/api`) |
| **Request body** | Required fields; `—` if none |
| **Auth guard** | Middleware applied before the handler; `public` if none |
| **Source file** | Router file that registers the route |
| **Notes** | Status / known gaps |

---

## Auth Service (`ad-server/src/api/auth.js`)

| Method | Path | Request body | Auth guard | Source file | Notes |
|---|---|---|---|---|---|
| POST | `/api/auth/login` | `{ email, password }` | public | `auth.js` | Returns JWT |
| POST | `/api/auth/logout` | — | `requireAuth` | `auth.js` | Clears session |
| POST | `/api/auth/register` | `{ email, password, role }` | public | `auth.js` | MVP only — no invite flow yet |
| GET | `/api/auth/me` | — | `requireAuth` | `auth.js` | Returns current user profile |

---

## Campaigns (`ad-server/src/api/campaigns.js`)

| Method | Path | Request body | Auth guard | Source file | Notes |
|---|---|---|---|---|---|
| GET | `/api/campaigns` | — | `requireAuth` | `campaigns.js` | Returns campaigns scoped to caller's role |
| GET | `/api/campaigns/:id` | — | `requireAuth` | `campaigns.js` | Single campaign |
| POST | `/api/campaigns` | `{ name, advertiser_id, start_date, end_date, budget, duration }` | `requireRole('brandmanager')` | `campaigns.js` | Creates campaign; status set to `pending_approval` |
| PATCH | `/api/campaigns/:id` | `{ name?, start_date?, end_date?, budget? }` | `requireRole('brandmanager')` | `campaigns.js` | Partial update of mutable fields |
| PATCH | `/api/campaigns/:id/status` | `{ status }` | `requireRole('retaileradmin')` | `campaigns.js` | Allowed values: `approved`, `rejected`, `pending_approval`. Normalises to lowercase before write. |
| POST | `/api/campaigns/:id/book` | `{ slots: [{ screen_id, date, hour, slot_index }] }` | `requireRole('brandmanager')` | `campaigns.js` | Books one or more loop slots for a campaign |
| DELETE | `/api/campaigns/:id` | — | `requireRole('admin')` | `campaigns.js` | Soft-delete only |

---

## Screens (`ad-server/src/api/screens.js`)

| Method | Path | Request body | Auth guard | Source file | Notes |
|---|---|---|---|---|---|
| GET | `/api/screens` | — | `requireAuth` | `screens.js` | List all screens; filtered by retailer scope for non-admin |
| GET | `/api/screens/:id` | — | `requireAuth` | `screens.js` | Single screen detail |
| POST | `/api/screens/:id/restart` | — | `requireRole('techoperator')` | `screens.js` | Sends restart signal to player |
| POST | `/api/screens/register` | `{ screen_id, retailer_id, store_id, resolution }` | public | `screens.js` | Player self-registration; issues device token |

---

## Loops / Schedule (`ad-server/src/api/loops.js`)

| Method | Path | Request body | Auth guard | Source file | Notes |
|---|---|---|---|---|---|
| GET | `/api/loops` | — | `requireAuth` | `loops.js` | List loops; scoped by retailer_id query param |
| GET | `/api/loops/:id` | — | `requireAuth` | `loops.js` | Single loop |
| POST | `/api/loops/generate` | `{ screen_id, date }` | `requireRole('retaileradmin')` | `loops.js` | Generates 24-hour loop set for a screen |
| POST | `/api/loops/:loopId/approve` | — | `requireRole('retaileradmin')` | `loops.js` | Approves a single loop |
| POST | `/api/loops/:loopId/reject` | `{ reason }` | `requireRole('retaileradmin')` | `loops.js` | ⚠️ FIXME — endpoint unconfirmed (see sprint7 FIXME comment) |
| POST | `/api/locations/:id/loops/approve-all` | — | `requireRole('retaileradmin')` | `loops.js` | Bulk approve — ⚠️ FIXME unconfirmed |

---

## Telemetry (`ad-server/src/api/telemetry.js`)

| Method | Path | Request body | Auth guard | Source file | Notes |
|---|---|---|---|---|---|
| GET | `/api/telemetry/upload-url` | — | `requireAuth` | `telemetry.js` | Returns signed (or mock) GCS upload URL |
| PUT | `/api/telemetry/sink/*` | raw JSON body | public | `telemetry.js` | Dev/test sink only — not for production |
| POST | `/api/telemetry/impression` | `{ screen_id, campaign_id, asset_id?, loop_id?, played_at? }` | `requireAuth` | `telemetry.js` | Records single impression; Phase 2 TODO: persist to Firestore |
| POST | `/api/telemetry/error` | `{ message, stack, componentStack?, url?, userAgent? }` | public | `telemetry.js` | Client-side error reporting |

---

## Retailers (`ad-server/src/api/retailers.js`)

| Method | Path | Request body | Auth guard | Source file | Notes |
|---|---|---|---|---|---|
| GET | `/api/retailers` | — | `requireRole('admin')` | `retailers.js` | Admin list only |
| GET | `/api/retailers/:id` | — | `requireAuth` | `retailers.js` | Scoped — non-admin can only fetch own retailer |
| POST | `/api/retailers` | `{ name, contact_email, logo? }` | `requireRole('admin')` | `retailers.js` | |
| PATCH | `/api/retailers/:id` | `{ name?, contact_email?, logo?, status? }` | `requireRole('admin')` | `retailers.js` | |

---

## Known Gaps / Unconfirmed Routes

The following routes are referenced in frontend code but not yet confirmed as registered in the Express router. Each must be resolved before the story that calls it can be marked Done.

| Frontend call | Expected route | Tracking |
|---|---|---|
| `POST /api/loops/:loopId/reject` | `loops.js` | FIXME in `ScheduleManager.jsx` — sprint7 |
| `POST /api/locations/:id/loops/approve-all` | `loops.js` | FIXME in `ScheduleManager.jsx` — sprint7 |
| `POST /api/audit-log` | unknown | FIXME in `TechOpsDashboard.jsx` — sprint (PR4) |
| `GET /api/screens/:id/logs` | unknown | FIXME stub in `TechOpsDashboard.jsx` — sprint (PR4) |

---

*Last updated: 2026-06-05 — Sprint 9 pre-condition commit.*
