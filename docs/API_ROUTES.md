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
| DELETE | `/api/campaigns/:id` | — | `requireRole('superadmin')` | `campaigns.js` | Soft-delete only. **S13-3: corrected from `admin` → `superadmin` to match live code at L187.** |

---

## Screens (`ad-server/src/api/screens.js`)

| Method | Path | Request body | Auth guard | Source file | Notes |
|---|---|---|---|---|---|
| GET | `/api/screens` | — | `requireAuth` | `screens.js` | List all screens; filtered by retailer scope for non-admin |
| GET | `/api/screens/:id` | — | `requireAuth` | `screens.js` | Single screen detail |
| GET | `/api/screens/:id/logs` | — | `requireRole('techoperator')` or `requireRole('retaileradmin')` | `screens.js` | Returns last 20 diagnostic log entries. `techoperator` sees all; `retaileradmin` sees own screens only. **S13-1: to be implemented.** |
| POST | `/api/screens/:id/restart` | — | `requireRole('techoperator')` | `screens.js` | Sends restart signal to player |
| POST | `/api/screens/register` | `{ screen_id, retailer_id, store_id, resolution }` | public | `screens.js` | Player self-registration; issues device token |

---

## Loops / Schedule (`ad-server/src/api/loops.js`)

| Method | Path | Request body | Auth guard | Source file | Notes |
|---|---|---|---|---|---|
| GET | `/api/loops` | — | `requireAuth` | `loops.js` | List loops; scoped by retailer_id query param |
| GET | `/api/loops/:id` | — | `requireAuth` | `loops.js` | Single loop |
| POST | `/api/loops/generate` | `{ targetDate, retailerId, locationId }` | `requireAuth` + `authenticate` | `loops.js` | Generates 24-hour loop set for a screen |
| PATCH | `/api/loops/:id/approve` | — | `requireAuth` + `authenticate` | `loops.js` | Approves a single loop. Sets status to `APPROVED`. |
| PATCH | `/api/loops/:id/slots/:position/reject` | `{ reason }` | `requireAuth` + `authenticate` | `loops.js` | Rejects a single slot within a loop. |
| PATCH | `/api/loops/:id/slots/:position/replace` | `{ assetId }` | `requireAuth` + `authenticate` | `loops.js` | Replaces a slot asset; clones loop if currently APPROVED. |
| GET | `/api/loops/pending/:retailerId` | — | `requireRole('retaileradmin')` | `loops.js` | All pending loops for retailer validation. |
| POST | `/api/loops/:loopId/reject` | `{ reason }` | `requireRole('retaileradmin')` | `loops.js` | **S13-2: implemented.** Rejects entire loop. Sets `loops.status = 'REJECTED'` (uppercase). |
| POST | `/api/locations/:id/loops/approve-all` | `{ date? }` | `requireRole('retaileradmin')` | `loops.js` | **S13-2: implemented.** Bulk-approves all PENDING loops for a location. Returns `{ approved: N }`. |

---

## Audit Log (`ad-server/src/api/audit.js`)

| Method | Path | Request body | Auth guard | Source file | Notes |
|---|---|---|---|---|---|
| POST | `/api/audit-log` | `{ event_type, actor_id, target_id, target_type, detail }` | `requireAuth` | `audit.js` | **S13-1: to be implemented.** Creates audit log entry. Returns `201`. |

---

## Telemetry (`ad-server/src/api/telemetry.js`)

| Method | Path | Request body | Auth guard | Source file | Notes |
|---|---|---|---|---|---|
| GET | `/api/telemetry/upload-url` | — | `requireAuth` | `telemetry.js` | Returns signed (or mock) GCS upload URL |
| PUT | `/api/telemetry/sink/*` | raw JSON body | public | `telemetry.js` | Dev/test sink only — not for production |
| POST | `/api/telemetry/impression` | `{ screen_id, campaign_id, asset_id?, loop_id?, played_at? }` | `requireAuth` + `impressionLimiter` | `telemetry.js` | Records single impression. **S13-4: persistence to be wired.** |
| POST | `/api/telemetry/error` | `{ message, stack, componentStack?, url?, userAgent? }` | public | `telemetry.js` | Client-side error reporting |
| GET | `/api/telemetry/impressions` | — | `requireRole('admin')` or `requireRole('techoperator')` | `telemetry.js` | **S13-4: to be implemented.** Query params: `screen_id?`, `campaign_id?`, `date_from?`, `date_to?`. Returns paginated array. |

---

## Retailers (`ad-server/src/api/retailers.js`)

| Method | Path | Request body | Auth guard | Source file | Notes |
|---|---|---|---|---|---|
| GET | `/api/retailers` | — | `requireRole('admin')` | `retailers.js` | Admin list only |
| GET | `/api/retailers/:id` | — | `requireAuth` | `retailers.js` | Scoped — non-admin can only fetch own retailer |
| POST | `/api/retailers` | `{ name, contact_email, logo? }` | `requireRole('admin')` | `retailers.js` | |
| PATCH | `/api/retailers/:id` | `{ name?, contact_email?, logo?, status? }` | `requireRole('admin')` | `retailers.js` | |

---

## Pricing (`ad-server/src/api/pricing.js`)

> S14 GUARDRAIL-7 debt cleared. S15-1 hardening applied.

| Method | Path | Request body | Auth guard | Source file | Notes |
|---|---|---|---|---|---|
| GET | `/api/pricing/config` | — | `authenticate` + `requireRole('admin')` | `pricing.js` | Admin-only read of raw config doc. **S15-1: hardened from public.** |
| PUT | `/api/pricing/config` | `{ baseCPM?, allocation?: { paid, retailer, internal }, ...overrides? }` | `authenticate` + `requireRole('admin')` | `pricing.js` | Overwrites config. `allocation` values must sum to 100 (integer) — returns `400` otherwise. **S15-1: role guard added.** |
| POST | `/api/pricing/overrides` | `{ date, multiplier }` | `authenticate` + `requirePlatformGovernance` | `pricing.js` | Add a date-specific override. Super Administrator only (global pricing). |

---

## Invoices (`ad-server/src/api/invoices.js`)

> Added S15-2. Mounted at `router.use('/invoices', authenticate, invoicesRouter)` in `src/api/index.js`.

| Method | Path | Request body | Auth guard | Source file | Notes |
|---|---|---|---|---|---|
| POST | `/api/invoices/generate` | `{ campaignId }` | `authenticate` + `requireRole('admin')` | `invoices.js` | Campaign must have `status = 'completed'`; `advertiser_id` stamped server-side. Returns `201 { invoiceId, campaignId, impressionsDelivered, cpmRate, amount, generatedAt }`. |
| GET | `/api/invoices` | — (query: `page?`, `limit?`) | `authenticate` | `invoices.js` | Role `advertiser` → scoped to `req.user.linked_entity_id`. Role `admin`/`superadmin` → all, paginated. |
| GET | `/api/invoices/:id` | — | `authenticate` | `invoices.js` | Returns `403` if advertiser requests another advertiser's invoice. |
| GET | `/api/invoices/:id/pdf` | — | `authenticate` | `invoices.js` | Ownership check identical to `GET /:id`. Returns `200 { message, invoiceData }` stub — real PDF deferred post-MVP. |

---

## Known Gaps / Unconfirmed Routes

> All routes previously listed here have been resolved in Sprint 13. The table below is retained for audit trail.

| Frontend call | Expected route | Status |
|---|---|---|
| `POST /api/loops/:loopId/reject` | `loops.js` | ✅ **S13-2 implemented** — `loops.js` handler added, `requireRole('retaileradmin')`, writes `'REJECTED'` uppercase |
| `POST /api/locations/:id/loops/approve-all` | `loops.js` | ✅ **S13-2 implemented** — handler added, `/locations` mount point confirmation pending (see sprint13.md) |
| `POST /api/audit-log` | `audit.js` | ⏳ **S13-1 in progress** — route row registered above; implementation pending |
| `GET /api/screens/:id/logs` | `screens.js` | ⏳ **S13-1 in progress** — route row registered above; implementation pending |

---

*Last updated: 2026-06-08 — S15-5: Pricing (S14 GUARDRAIL-7 debt + S15-1 hardening) and Invoices (S15-2) sections added.*
