# Database Schema

Softomedia Live 2026 — Firestore collections reference.

> **Canonical status values are lowercase** as of Sprint 16 (S16-1).
> All `loop.status` and `slot.status` values stored in Firestore use
> lowercase strings (`pending_approval`, `approved`, `rejected`, `live`,
> `pending`, `replaced`, `booked`, `available`).
> Import constants via `LOOP_STATUS` / `SLOT_STATUS` from `LoopRepository.js`.

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

---

## Sprint Changelog

| Sprint | Change |
|---|---|
| S16 (2026-06-08) | **Status normalization (S16-1/S16-2):** `LOOP_STATUS` and `SLOT_STATUS` enum values changed to lowercase. Backfill: `ad-server/scripts/migrate-loop-status-lowercase.js`. |
| S16 (2026-06-08) | **Composite indexes (S16-3):** `firestore.indexes.json` added. Covers `invoices` (advertiserId) and `loops` (retailer\_id, location\_id, status) query patterns. |
| S15 | Invoices collection introduced. `InvoiceRepository` inlined in `ad-server/src/api/invoices.js`. |
| S13-2 | Loop-level reject and bulk approve-all routes added to `loops.js`. |
| S10 | `screen_ids` array added to loops for multi-screen support. |
