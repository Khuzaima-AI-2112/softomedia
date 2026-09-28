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
| POST | `/api/campaigns` | Brand: `{ name, media_id, start_date, end_date, budget, inventory_selection, slots: [{ store_id, date, hour, position }] }`; Admin: `{ …, advertiser_id }` | `requireRole('brandmanager')` | `campaigns.js` | Creates campaign; status set to `pending_approval`. A Brand's `slots` become Slot Reservations in the same transaction (#31, ADR 0005), each priced server-side and listed in `reserved_slots`. `400 { error, code: 'INVALID_SLOTS' }` for a pick that is not a Paid Slot in an operating hour of a booked Store and Campaign date; `400 { error, code: 'BOOKING_CLOSED' }` from 18:00 two days before the date, Store time; `409 { error, code: 'SLOT_TAKEN', slots }` when another Brand holds a picked Slot. Admin Retailer promotion (#40): `{ type: 'retailer', name, retailer_id, store_id?, media_id, schedule: { dates: ['YYYY-MM-DD'], dayparts?: ['breakfast' / 'lunch' / 'dinner'], hours?: [0–23] } }`, with no `advertiser_id`; the media must be that Retailer's own, else `400 { error }`. Retailer Administrators can't create promotions. |
| PATCH | `/api/campaigns/:id` | `{ name?, start_date?, end_date?, budget? }` | `requireRole('brandmanager')` | `campaigns.js` | Partial update of mutable fields |
| PATCH | `/api/campaigns/:id/status` | `{ status }` | `requireRole('retaileradmin')` | `campaigns.js` | Allowed values: `approved`, `rejected`, `pending_approval`. Normalises to lowercase before write. |
| DELETE | `/api/campaigns/:id` | — | `requireRole('superadmin')` | `campaigns.js` | Soft-delete only. **S13-3: corrected from `admin` → `superadmin` to match live code at L187.** |

---

## Bookable Inventory (`ad-server/src/api/inventory.js`)

| Method | Path | Request body | Auth guard | Source file | Notes |
|---|---|---|---|---|---|
| GET | `/api/inventory` | — | `authenticate` + Brand only | `inventory.js` | Bookable Screens by Retailer, Store and Location, with booking prices. Never names another organization's Campaigns. |
| GET | `/api/inventory/stores/:storeId/slots?date=YYYY-MM-DD` | — | `authenticate` + Brand only | `inventory.js` | Every Slot of each operating hour: `category`, and for Paid Slots `status` `free` \| `taken` \| `yours`, never who holds it. Each hour has `price` and `tier`; the date has `booking_open` and `booking_cutoff: { date, time, time_zone }`. `404` for a Store the Brand cannot book, `400` for a malformed date. |

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
| POST | `/api/loops/generate` | `{ targetDate, retailerId, storeId }` | `requireAuth` + `authenticate` | `loops.js` | Generates the Store's hourly loops for each operating hour of `targetDate` |
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

## Dayparts (`ad-server/src/api/dayparts.js`)

| Method | Path | Request body | Auth guard | Source file | Notes |
|---|---|---|---|---|---|
| GET | `/api/dayparts` | — | `authenticate` | `dayparts.js` | The network's Dayparts, `{ breakfast, lunch, dinner }`, each `{ start, end }` in whole hours with `end` exclusive. Defaults 06–11, 11–15, 17–21 until set. |
| PUT | `/api/dayparts` | `{ breakfast: { start, end }, lunch: {…}, dinner: {…} }` | `authenticate` + `requirePlatformGovernance` | `dayparts.js` | Super Administrator only (#40). `400` for overlapping Dayparts or hours outside 0–24. Writes a `dayparts_updated` platform audit record. |

---

## Delivery report (`ad-server/src/api/deliveryReport.js`)

| Method | Path | Request body | Auth guard | Source file | Notes |
|---|---|---|---|---|---|
| GET | `/api/delivery-report` | — | `authenticate` + `delivery_report.view_network` or `delivery_report.view_own` | `deliveryReport.js` | Proof of Play per Campaign or Retailer promotion and per Daypart (#41): `{ dayparts, columns, rows: [{ campaign_id, campaign_name, is_promotion, dayparts: { breakfast, lunch, dinner, outside_dayparts }, total }], totals }`. A Proof of Play counts in the Daypart of its Hourly Loop's hour; hours no Daypart covers count as `outside_dayparts`. Fallback Content is never counted. Admin and Super Administrator see the network, a Brand its own Campaigns, a Retailer Administrator its own Stores; `403` for a Technical Operator or an account with no organization. |

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
