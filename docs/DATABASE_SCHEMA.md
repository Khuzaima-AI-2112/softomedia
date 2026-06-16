# Database Schema

Softomedia Live 2026 — Firestore collections reference.

> **Canonical status values are lowercase** as of Sprint 16 (S16-1).
> All `loop.status` and `slot.status` values stored in Firestore use
> lowercase strings (`pending_approval`, `approved`, `rejected`, `live`,
> `pending`, `replaced`, `booked`, `available`).
> Import constants via `LOOP_STATUS` / `SLOT_STATUS` from `LoopRepository.js`.

---

## Soft-Delete Semantics (Authoritative)

Added in **S17**. Extended and hardened in **S21**.

### The `deleted_at` field

`deleted_at` is the **canonical and sole deletion marker** for `retailers`
and `advertisers`. Rules that are enforced in code and must never be violated:

1. **Set exclusively by `softDelete()`** — called by `DELETE /api/retailers/:id`
   and `DELETE /api/advertisers/:id`. No other code path writes `deleted_at`.
2. **Never writable via PATCH or PUT** — the `PATCH /api/advertisers/:id`
   allowlist (S21-2) strips `deleted_at` before any Firestore write. The PUT
   route does a full-document replace and must not include `deleted_at` in the
   update payload either.
3. **Never `null`-ed to resurrect a record** — there is no restore endpoint.
   Resurrection requires a manual Firestore console operation with a comment
   in the incident log.
4. **All list queries filter `where deleted_at == null`** (GUARDRAIL-15).
   This includes `GET /api/retailers`, `GET /api/advertisers`, and
   `GET /api/retailers?for=campaign`.
5. **`GET /:id` returns 404** for any record where `deleted_at` is truthy,
   even if the document exists in Firestore.

### `status` is not a deletion marker

`status: 'inactive'` (retailers) and `status: 'suspended'` (advertisers)
are **business-state fields**, not deletion markers. A record with
`status: 'inactive'` and no `deleted_at` is a legitimately deactivated
record that remains visible in admin lists. Do not infer deletion from
`status` alone.

---

## Collections

### `loops`

Hourly broadcast loops. One document per `{date}_{hour}_{location_id}`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `{date}_{hour}_{location_id}` |
| `date` | string | `YYYY-MM-DD` |
| `hour` | number | 0–23 |
| `retailer_id` | string | |
| `location_id` | string | |
| `screen_id` | string | Legacy single-screen field |
| `screen_ids` | string[] | Multi-screen support (S10+) |
| `status` | string | **Lowercase.** `pending_approval` \| `approved` \| `rejected` \| `live` |
| `slots` | Slot[] | 12 entries, positions 0–11 |
| `version` | number | Incremented on slot replacement |
| `parentLoopId` | string? | Set when loop is a replacement clone |
| `generated_at` | ISO string | |
| `approved_at` | ISO string? | |
| `approved_by` | string? | UID of approving user |
| `rejected_at` | ISO string? | |
| `rejected_by` | string? | |
| `rejection_reason` | string? | |

#### Slot sub-document

| Field | Type | Notes |
|---|---|---|
| `position` | number | 0–11 |
| `asset_id` | string? | |
| `asset_name` | string? | |
| `status` | string | **Lowercase.** `pending` \| `approved` \| `rejected` \| `replaced` \| `booked` \| `available` |
| `campaign_id` | string? | Set when booked via advertiser campaign |
| `advertiser_id` | string? | |
| `creative_url` | string? | |
| `booked_at` | ISO string? | |
| `rejection_reason` | string? | |
| `rejected_at` | ISO string? | |
| `replaced_at` | ISO string? | |

---

### `retailers`

Retailer accounts. Managed via `RetailerRepository.js`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Auto-generated |
| `name` | string | |
| `contact_email` | string | |
| `contract_start` | string | `YYYY-MM-DD` |
| `logo` | string | Emoji or URL |
| `status` | string | `active` \| `inactive` — **not** a reliable deletion marker; see `deleted_at` |
| `deleted_at` | ISO string \| absent | Set on soft-delete via `DELETE /api/retailers/:id`. **Absent** on non-deleted records (including intentionally-deactivated ones). Use as the canonical deletion marker. |
| `updated_at` | ISO string | |
| `created_at` | ISO string | |

#### Deactivate vs. Delete — Retailers

`status: 'inactive'` alone is **not** a reliable deletion indicator:

- `status: 'inactive'` **without** `deleted_at` → intentionally deactivated via the admin toggle (`PATCH /api/retailers/:id`). Record is still visible in the admin list.
- `status: 'inactive'` **with** `deleted_at` set → soft-deleted via `DELETE /api/retailers/:id`. Record is excluded from `GET /api/retailers`.

`GET /api/retailers` filters `where deleted_at == null`, returning only
non-deleted records (both `active` and intentionally-`inactive`).

#### Scheduler endpoint — GET /api/retailers?for=campaign

Added in **S21-4**. Returns only retailers that are **both** non-deleted
(`deleted_at == null`) **and** `status: 'active'`. Intended for the Campaign
Wizard and the ad scheduler — any venue returned by this endpoint is safe
to book against.

Client method: `ApiService.getRetailersForCampaign()` (wired in S21-5).
Do **not** call the unfiltered `GET /api/retailers` from campaign-creation
flows — it returns deactivated retailers that cannot accept bookings.

Access: `admin` and `superadmin` roles (see S21-3 Role Decision below).

#### S21-3 Role Decision — Retailer / Advertiser Mutation Routes

A caller audit performed in S21-3 confirmed no production caller uses
`superadmin`-only tokens for retailer or advertiser mutation routes.
All live callers authenticate as `admin`.

**Decision recorded 2026-06-16:** Both `admin` and `superadmin` roles are
permitted on all retailer and advertiser mutation routes (`POST`, `PUT`,
`PATCH`, `DELETE`) and on the `?for=campaign` scheduler endpoint.
`superadmin` is not a separate elevated tier for these collections — it
inherits the same access.

Do not re-narrow to `superadmin`-only without:
1. Updating this doc.
2. Updating `retailers.js` and `advertisers.js` route guards.
3. Adding a Sprint Changelog entry.

---

### `advertisers`

Advertiser accounts. Managed via `AdvertiserRepository.js`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | `adv_{timestamp}_{random}` |
| `name` | string | |
| `logo` | string | |
| `industry` | string | |
| `contactemail` | string | |
| `budget` | number | |
| `status` | string | `active` \| `suspended` — preserved for campaign referential integrity |
| `deleted_at` | ISO string \| absent | Set on soft-delete via `DELETE /api/advertisers/:id`. Absent on non-deleted records. Canonical deletion marker. |
| `updated_at` | ISO string | |
| `created_at` | ISO string | |

`GET /api/advertisers` filters `where deleted_at == null`, excluding
soft-deleted advertisers. Campaign documents referencing the `advertiser_id`
of a soft-deleted advertiser are unaffected — the Firestore document persists.

#### PATCH allowlist — S21-2 / SEC-S21-1

`PATCH /api/advertisers/:id` accepts **only** the following fields:
`name`, `logo`, `industry`, `contactemail`, `budget`.

`deleted_at` and `status` are stripped before any Firestore write. This
prevents a caller with an `admin` token from resurrecting a soft-deleted
advertiser by sending `{ deleted_at: null }`. Sending only non-allowlisted
fields returns **HTTP 400** (`No patchable fields provided`).

The `PUT /api/advertisers/:id` route performs a full-document replace and
must never include `deleted_at` in the replacement payload.

---

### `invoices`

Generated per completed campaign. Inline `InvoiceRepository` in
`ad-server/src/api/invoices.js` (no separate repository file).

| Field | Type | Notes |
|---|---|---|
| `invoiceId` | string | UUID v4 |
| `campaignId` | string | FK → `campaigns` |
| `advertiserId` | string | Copied from `campaign.advertiser_id` at generation time |
| `impressionsDelivered` | number | From campaign; falls back to `impressions_delivered` |
| `cpmRate` | number | CPM rate at time of generation (default 15.00) |
| `amount` | number | `impressionsDelivered × cpmRate / 1000`, 4dp |
| `generatedAt` | ISO string | Generation timestamp |
| `generatedBy` | string | `req.user.id` \| `req.user.email` \| `'system'` |

> **Note on field casing:** Invoice fields use camelCase (`advertiserId`,
> `generatedAt`, `impressionsDelivered`, `cpmRate`, `generatedBy`).
> This differs from the snake_case convention used in `loops` and most
> other collections. Do not rename — existing Firestore documents and the
> `advertiserId` composite index depend on this casing.

---

### `campaigns`

Advertiser ad campaigns. Managed via `CampaignRepository.js`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `advertiser_id` | string | FK → `advertisers` |
| `status` | string | `draft` \| `active` \| `completed` \| `cancelled` |
| `screen_type` | string? | Used for CPM rate lookup |
| `impressionsDelivered` | number? | camelCase variant |
| `impressions_delivered` | number? | snake_case variant (legacy) |

---

### `impressions`

Per-play impression records. Managed via `ImpressionRepository.js`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `campaign_id` | string | |
| `screen_id` | string | |
| `played_at` | ISO string | |
| `duration` | number | seconds |

---

### `screens`

Registered display screens. Managed via `ScreenRepository.js`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `retailer_id` | string | |
| `location_id` | string | |
| `status` | string | `active` \| `inactive` \| `maintenance` |
| `last_heartbeat` | ISO string? | |

---

### `playlists`

Content playlists assigned to screens. Managed via `PlaylistRepository.js`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `status` | string | **Lowercase.** `active` \| `inactive`. Prior to S17-6 backfill, legacy documents may carry uppercase `'ACTIVE'` — see Sprint Changelog. |
| `assignments` | string[] | Screen IDs or `'ALL'` for global assignment |
| `is_global` | boolean? | `true` for the system-wide fallback playlist |

> **S17-6 (RISK-S16-9 resolution):** `PlaylistRepository.findActiveByScreen()` and `findGlobalPlaylist()` now query `status == 'active'` (lowercase). Run `ad-server/scripts/backfill-playlist-status.js` in staging then production to normalise pre-S13 documents that carry uppercase `'ACTIVE'`.

---

## Firestore Indexes

Composite indexes are defined in `firestore.indexes.json` at the repo root.
Deploy with:

```bash
firebase deploy --only firestore:indexes --project <project-id>
```

| Collection | Fields | Order | Purpose |
|---|---|---|---|
| `invoices` | `advertiserId`, `generatedAt` | ASC, DESC | Advertiser invoice list, newest first |
| `invoices` | `advertiserId`, `amount` | ASC, DESC | Invoice totals by value |
| `loops` | `retailer_id`, `status`, `date` | ASC, ASC, DESC | Pending loops by retailer |
| `loops` | `location_id`, `status`, `date` | ASC, ASC, DESC | Bulk approve-all by location |
| `loops` | `status`, `date` | ASC, DESC | Approved loops cross-location |
| `retailers` | `status`, `deleted_at` | ASC, ASC | S21-4: active non-deleted retailers for `?for=campaign` scheduler endpoint |

---

## Backfill Scripts

All scripts are in `ad-server/scripts/`. Run in **staging first**, verify
zero ghost records remain, then run in production.

| Script | Target | Strategy | Idempotent |
|---|---|---|---|
| `backfill-deleted-retailers.js` | `retailers` with `status: 'inactive'` and no `deleted_at` | **Option A** — all pre-S17 inactive retailers treated as ghost records (see note) | Yes |
| `backfill-deleted-advertisers.js` | `advertisers` with `status: 'suspended'` and no `deleted_at` | **Option A** — `'suspended'` written only by `softDelete()`; no separate suspend toggle existed pre-S17 | Yes |
| `backfill-playlist-status.js` | `playlists` with `status: 'ACTIVE'` | Normalise to lowercase `'active'` (S17-6 / RISK-S16-9) | Yes |
| `seed-test-retailer-a.js` | Creates `ret_test_a` fixture | Seed only — run in staging/emulator for E2E tests | Yes |

### Backfill Execution History (2026-06-16)
- **Retailers**: 5 updated (Staging run), 0 (Production run)
- **Advertisers**: 0 updated (Staging run), 0 (Production run)
- **Playlists**: 1 updated (Staging run), 0 (Production run)

### Retailers backfill — Option A rationale

All pre-S17 `inactive` retailers with no `deleted_at` are treated as
soft-deleted ghost records. Rationale: the admin UI prior to S17 had no
separate "deactivate" toggle — any retailer set to `inactive` was done
so via the delete path. If your dataset contains legitimate pre-S17
deactivations (inactive but not deleted), switch to Option B (manual review
before writing `deleted_at`) and update this doc.

### Advertisers backfill — Option A rationale

`'suspended'` is written only by `softDelete()` — there is no standalone
admin toggle that sets an advertiser to `suspended` without also setting
`deleted_at`. All pre-S17 suspended advertisers with no `deleted_at` are
therefore ghost records and are safe to backfill.

---

## Sprint Changelog

| Sprint | Change |
|---|---|
| S21 (2026-06-16) | **Soft-delete hardening and scheduler endpoint (S21-1 through S21-7):** Backfill script headers updated with Option A strategy decisions. `PATCH /api/advertisers/:id` field allowlist added — `deleted_at` and `status` stripped; only `name`, `logo`, `industry`, `contactemail`, `budget` patchable (S21-2 / SEC-S21-1). Caller audit confirmed `admin` role sufficient for all retailer/advertiser mutation routes — `superadmin` inherits same access (S21-3). `GET /api/retailers?for=campaign` branch added: filters `status='active'` AND `deleted_at==null` for scheduler use (S21-4). `ApiService.getRetailersForCampaign()` wired to new endpoint (S21-5). `seed-test-retailer-a.js` seed script added; `soft-delete-lifecycle.test.js` (10 assertions) and `scheduler-campaign-flow.test.js` (5 assertions) added to `ad-server/tests/` (S21-6). `DATABASE_SCHEMA.md` updated with all authoritative decisions (S21-7). |
| S17 (2026-06-08) | **Soft-delete visibility fix (S17-1 through S17-6):** `deleted_at` ISO timestamp field added to `retailers` and `advertisers` as canonical deletion marker. `GET /api/retailers` and `GET /api/advertisers` now filter `where deleted_at == null`. `BaseRepository.findAll()` memory comparator fixed (`?? null`). `GET /:id` returns 404 for soft-deleted records. Backfill scripts: `backfill-deleted-retailers.js`, `backfill-deleted-advertisers.js`. `PlaylistRepository` ACTIVE query fixed to lowercase `'active'` (RISK-S16-9 closed). Playlist backfill: `backfill-playlist-status.js`. |
| S16 (2026-06-08) | **Status normalization (S16-1/S16-2):** `LOOP_STATUS` and `SLOT_STATUS` enum values changed to lowercase. Backfill: `ad-server/scripts/migrate-loop-status-lowercase.js`. |
| S16 (2026-06-08) | **Composite indexes (S16-3):** `firestore.indexes.json` added. Covers `invoices` (advertiserId) and `loops` (retailer\_id, location\_id, status) query patterns. |
| S15 | Invoices collection introduced. `InvoiceRepository` inlined in `ad-server/src/api/invoices.js`. |
| S13-2 | Loop-level reject and bulk approve-all routes added to `loops.js`. |
| S10 | `screen_ids` array added to loops for multi-screen support. |
