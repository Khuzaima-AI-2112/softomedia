# Database Schema: SoftoMedia Ad Network

This document describes the Firestore database structure used by the SoftoMedia Ad Network.

---

## ⚠️ Canonical Enum Values (GUARDRAIL-4)

All status and workflow string values must match the definitions in this section exactly. **Canonical values are lowercase and underscore-separated.** Any uppercase variant in the codebase is a bug.

### `Campaign.status`

| Value | Meaning | Set by |
|---|---|---|
| `pending_approval` | Campaign submitted by brand manager; awaiting retailer review | `BrandCampaignWizard.jsx` on submit; `POST /api/campaigns` |
| `approved` | Retailer admin has approved; eligible for loop scheduling | `PATCH /api/campaigns/:id/status` |
| `rejected` | Retailer admin has rejected; not eligible for scheduling | `PATCH /api/campaigns/:id/status` |
| `active` | Campaign is live and currently serving impressions | System / scheduler |
| `paused` | Temporarily suspended by brand manager or admin | Brand manager action |
| `completed` | Campaign end_date has passed | System / scheduler |

> **Grep audit required before Sprint 9 closes:**  
> `grep -r "'APPROVED'\|'REJECTED'\|'PENDING'\|'pending'" --include="*.js" --include="*.jsx"` must return zero results outside of test fixtures or comments.

### `loops.status` ⚠️ ENUM-AUDIT-1

> **Current schema stores `APPROVED`, `DRAFT`, `LOCKED` (uppercase).** This is a known casing violation.  
> Canonical target values: `approved`, `draft`, `locked`.  
> Migration tracked as **ENUM-AUDIT-1** — do not introduce new uppercase writes; normalise in the next loop-generation sprint.

| Value | Meaning |
|---|---|
| `draft` | Generated but not yet reviewed |
| `approved` | Retailer has approved for broadcast |
| `locked` | Past D-1 cutoff; cannot be edited |

### `playlists.status` ⚠️ ENUM-AUDIT-2

> **Current schema stores `ACTIVE`, `DRAFT` (uppercase).** Canonical target: `active`, `draft`.  
> Migration tracked as **ENUM-AUDIT-2**.

| Value | Meaning |
|---|---|
| `active` | Live and assigned to screens |
| `draft` | In preparation, not yet assigned |

### `stores.status` / `retailers.status` / `advertisers.status`

| Value | Meaning |
|---|---|
| `active` | Operational |
| `inactive` / `suspended` | Disabled — see per-collection notes below |

---

## Overview
The system uses a flat collection structure in Firestore, with cross-references using document IDs.

## Core Collections

### `retailers`
Stores information about the retail partners.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Unique retailer ID (e.g., `ret_001`) |
| `name` | String | Full name of the retailer |
| `logo` | String | Emoji or URL to logo |
| `contact_email` | String | Administrative contact |
| `status` | String | `active`, `inactive` |

### `locations`
Geographic or logical regions for store grouping.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Region ID (e.g., `loc_downtown`) |
| `name` | String | Display name |
| `type` | String | `region`, `district`, etc. |

### `stores`
Individual physical store locations.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Store ID (e.g., `str_001`) |
| `retailer_id` | String | Reference to `retailers` |
| `location_id` | String | Reference to `locations` |
| `name` | String | Store display name |
| `address` | String | Physical address |
| `city` | String | City location |
| `screen_count` | Number | Number of active screens |
| `traffic_level` | String | `high`, `medium`, `low` |
| `status` | String | `active`, `offline` |

### `screens`
Digital display hardware units.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Unique ID (e.g., `scr_001_01`) |
| `screen_id` | String | Hardware serial or ID |
| `name` | String | Display name |
| `status` | String | `online`, `offline` |
| `store_id` | String | Reference to `stores` |
| `retailer_id` | String | Reference to `retailers` |
| `location_id` | String | Reference to `locations` (inherited) |
| `resolution` | String | Screen resolution (e.g., `1920x1080`) |
| `last_seen` | String | ISO Timestamp of last heartbeat |

---

## Advertising & Content

### `advertisers`
Companies or brands running campaigns.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Advertiser ID (e.g., `adv_001`) |
| `name` | String | Brand name |
| `industry` | String | Business category |
| `contact_email` | String | Marketing contact |
| `budget` | Number | Total account budget |
| `status` | String | `active`, `suspended` |

### `campaigns`
Specific advertising initiatives.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Campaign ID (e.g., `cmp_001`) |
| `advertiser_id` | String | Reference to `advertisers` |
| `name` | String | Campaign name |
| `status` | String | See **Canonical Enum Values → Campaign.status** above |
| `creative_url` | String | Primary asset URL |
| `duration` | Number | Slot duration in seconds |
| `start_date` | String | YYYY-MM-DD |
| `end_date` | String | YYYY-MM-DD |
| `budget` | Number | Campaign-specific budget |
| `spent` | Number | Actual spend to date |
| `booked_slots` | Number | Count of reserved slots |

### `media`
Reusable media assets.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Asset ID (e.g., `asset_001`) |
| `filename` | String | Original filename |
| `file_type` | String | `image`, `video` |
| `duration` | Number | Playback duration |
| `url` | String | Storage URL |

### `playlists`
Ordered collections of media for distribution.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Playlist ID (e.g., `ply_001`) |
| `name` | String | Display name |
| `description` | String | Usage notes |
| `status` | String | See **Canonical Enum Values → playlists.status** ⚠️ ENUM-AUDIT-2 |
| `is_global` | Boolean | True if applies to all screens |
| `assignments` | Array | List of target IDs (Store/Retailer or `ALL`) |
| `items` | Array | Objects: `{ media_id, duration, order }` |

---

## Operations & Pricing

### `pricing_config`
Global and overridden pricing rules.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Always `global` |
| `baseCPM` | Number | The anchor price per 1000 impressions |
| `currency` | String | e.g., `USD` |
| `slotDuration` | Number | Standard slot length (e.g., 5s) |
| `slotsPerLoop` | Number | Number of slots in a 1-minute loop |
| `trafficTiers` | Map | Tiers with `multiplier`, `label`, `color`, `hours` |
| `dateOverrides` | Map | Date-specific multipliers (Key: `YYYY-MM-DD`) |
| `retailerOverrides`| Map | Retailer-specific base CPMs |
| `updatedAt` | String | Last update timestamp |

### `loops`
The daily schedule for a specific screen and hour.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Format: `{screen_id}_{date}_{hour}` |
| `screen_id` | String | Reference to `screens` |
| `store_id` | String | Reference to `stores` |
| `date` | String | YYYY-MM-DD |
| `hour` | Number | 0-23 |
| `slots` | Array | 12 slots with `status`, `campaign_id`, `creative_url` |
| `status` | String | See **Canonical Enum Values → loops.status** ⚠️ ENUM-AUDIT-1 |

### `impressions`
Analytical logs of actual ad plays.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Random ID |
| `impression_id` | String | UUID generated by `POST /api/telemetry/impression` |
| `campaign_id` | String | Reference to `campaigns` |
| `screen_id` | String | Reference to `screens` |
| `asset_id` | String | Optional — specific creative asset |
| `loop_id` | String | Optional — loop this slot belongs to |
| `played_at` | String | ISO Timestamp provided by Player or server time |
| `playlist_source`| String | `assigned`, `fallback` |

> **Phase 2 TODO:** `POST /api/telemetry/impression` currently logs via Winston only. Firestore persistence to this collection is the Phase 2 sub-task.

### `scheduling_audits`
History of manual or automated scheduling changes.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Audit ID |
| `action` | String | e.g., `loop_gen`, `slot_book` — lowercase per GUARDRAIL-4 |
| `timestamp` | String | ISO Timestamp |
| `metadata` | Map | Detailed changes and user context |

---

*Last updated: 2026-06-05 — Sprint 9 pre-condition commit. Enum audit (ENUM-AUDIT-1, ENUM-AUDIT-2) pending full migration sprint.*
