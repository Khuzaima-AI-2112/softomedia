# Database Schema: SoftoMedia Ad Network

This document describes the Firestore database structure used by the SoftoMedia Ad Network.

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
| `status` | String | `live`, `paused`, `completed` |
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
| `status` | String | `ACTIVE`, `DRAFT` |
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
| `status` | String | `APPROVED`, `DRAFT`, `LOCKED` |

### `impressions`
Analytical logs of actual ad plays.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Random ID |
| `campaign_id` | String | Reference to `campaigns` |
| `screen_id` | String | Reference to `screens` |
| `timestamp` | String | ISO Timestamp |
| `playlist_source`| String | `assigned`, `fallback` |

### `scheduling_audits`
History of manual or automated scheduling changes.
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | String | Audit ID |
| `action` | String | e.g., `LOOP_GEN`, `SLOT_BOOK` |
| `timestamp` | String | ISO Timestamp |
| `metadata` | Map | Detailed changes and user context |
