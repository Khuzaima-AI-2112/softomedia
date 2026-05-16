# Data Dictionary

This document provides a mapping between the User Interface (UI) fields and their corresponding database columns in Firestore, including validation rules and data types.

## 1. Advertiser Entity
Manages brand and agency accounts.

| UI Field | DB Field | Data Type | Mandatory | Validation / Rules | List Values / Enums |
|----------|----------|-----------|-----------|---------------------|---------------------|
| Company Name | `name` | string | Yes | Min length 1 | - |
| Icon | `logo` | string | Yes | Emoji or URL | 📱, 🥤, 👗, 🚗, 💊, 💰, 🎬, ✈️, ⚽, 🏠, 🏢 |
| Industry | `industry` | string | Yes | - | Electronics, Food & Beverage, Fashion, Automotive, Healthcare, Finance, Entertainment, Travel, Sports, Home & Garden, Other |
| Contact Email | `contact_email` | string | Yes | Email format | - |
| Initial Budget | `budget` | number | Yes | Min 0, step 100 | - |
| Status | `status` | string | Yes | - | `active`, `inactive` |
| ID | `id` | string | Yes | Unique ID | `adv_` prefix |

## 2. Retailer Entity
Manages retail partners and infrastructure owners.

| UI Field | DB Field | Data Type | Mandatory | Validation / Rules | List Values / Enums |
|----------|----------|-----------|-----------|---------------------|---------------------|
| Company Name | `name` | string | Yes | Min length 1 | - |
| Icon | `logo` | string | Yes | Emoji or URL | 🏪, 🛒, 🥬, ⚡, 🏬, 🛍️, 🏢, 🏭 |
| Contact Email | `contact_email` | string | Yes | Email format | - |
| Contract Start Date | `contract_start`| string | Yes | ISO Date (YYYY-MM-DD)| - |
| Status | `status` | string | Yes | - | `active`, `inactive` |
| ID | `id` | string | Yes | Unique ID | `ret_` prefix |

## 3. Store Entity
Physical retail locations.

| UI Field | DB Field | Data Type | Mandatory | Validation / Rules | List Values / Enums |
|----------|----------|-----------|-----------|---------------------|---------------------|
| Store Name | `name` | string | Yes | - | - |
| Retailer | `retailer_id` | string | Yes | Foreign Key | - |
| Address | `address` | string | Yes | - | - |
| City | `city` | string | Yes | - | - |
| Screen Count | `screen_count` | number | No | Derived from screens | - |
| Traffic Level | `traffic_level` | string | Yes | Pricing multiplier link| `low`, `medium`, `high` |
| Region/District | `location_id` | string | No | Foreign Key | - |
| Status | `status` | string | Yes | - | `active`, `maintenance`, `inactive` |

## 4. Screen Entity
Digital signage hardware units.

| UI Field | DB Field | Data Type | Mandatory | Validation / Rules | List Values / Enums |
|----------|----------|-----------|-----------|---------------------|---------------------|
| Screen Hardware ID| `screen_id` | string | Yes | Unique per retailer | - |
| Retailer | `retailer_id` | string | Yes | Foreign Key | - |
| Store | `store_id` | string | Yes | Foreign Key | - |
| Resolution | `resolution` | string | Yes | - | `1920x1080`, `1080x1920`, `3840x2160` |
| Status | `status` | string | Yes | - | `online`, `offline`, `error` |
| Last Heartbeat | `last_seen` | timestamp | No | ISO String | - |

## 5. Campaign Entity
Advertising initiatives and bookings.

| UI Field | DB Field | Data Type | Mandatory | Validation / Rules | List Values / Enums |
|----------|----------|-----------|-----------|---------------------|---------------------|
| Campaign Name | `name` | string | Yes | - | - |
| Advertiser | `advertiser_id`| string | Yes | Foreign Key | - |
| Start Date | `start_date` | string | Yes | ISO Date | - |
| End Date | `end_date` | string | Yes | ISO Date | - |
| Budget | `budget` | number | Yes | Currency: USD | - |
| Spent | `spent` | number | No | Read-only from logs | - |
| Creative URL | `creative_url` | string | Yes | Storage Link | - |
| Slot Duration | `duration` | number | Yes | Seconds | Default: 5 or 10 |
| Status | `status` | string | Yes | - | `draft`, `pending_approval`, `scheduled`, `live`, `ended` |

## 6. Playlist Entity
Content sequences for loops or screens.

| UI Field | DB Field | Data Type | Mandatory | Validation / Rules | List Values / Enums |
|----------|----------|-----------|-----------|---------------------|---------------------|
| Name | `name` | string | Yes | - | - |
| Description | `description` | string | No | - | - |
| Status | `status` | string | Yes | - | `ACTIVE`, `DRAFT`, `ARCHIVED` |
| Global Rotation | `is_global` | boolean | Yes | If true, forces 5s dur | - |
| Assigned Screens | `assignments` | array | Yes | Array of Screen IDs | `['ALL']` or `['scr_001', ...]` |
| Items | `items` | array | Yes | Array of item objects | - |
| (Item) Media ID | `media_id` | string | Yes | Foreign Key to Media | - |
| (Item) Duration | `duration` | number | Yes | Seconds (1-60) | - |
| (Item) Sort Order | `order` | number | Yes | Integer | - |

## 7. Media Asset Entity
Uploaded creatives stored in bucket.

| UI Field | DB Field | Data Type | Mandatory | Validation / Rules | List Values / Enums |
|----------|----------|-----------|-----------|---------------------|---------------------|
| File Name | `filename` | string | Yes | - | - |
| Media Type | `file_type` | string | Yes | Mime-type derived | `image`, `video` |
| Native Duration | `duration` | number | No | Video length (sec) | - |
| Storage URL | `url` | string | Yes | Cloud Storage link | - |

## 8. User Entity
System access and permissions.

| UI Field | DB Field | Data Type | Mandatory | Validation / Rules | List Values / Enums |
|----------|----------|-----------|-----------|---------------------|---------------------|
| Full Name | `name` | string | Yes | - | - |
| Email | `email` | string | Yes | Unique, Email format | - |
| Role | `role` | string | Yes | Governs permissions | `super_admin`, `content_manager`, `tech_operator`, `retailer_admin`, `advertiser` |
| Linked Retailer | `retailer_id` | string | Cond. | Required for `retailer_admin` | - |
| Linked Advertiser | `advertiser_id`| string | Cond. | Required for `advertiser` | - |
| Status | `status` | string | Yes | - | `active`, `inactive` |

## 9. Pricing Configuration
Global and overridden pricing rules.

| UI Field | DB Field | Data Type | Mandatory | Validation / Rules | List Values / Enums |
|----------|----------|-----------|-----------|---------------------|---------------------|
| Base CPM | `baseCPM` | number | Yes | Min 0.01, Max 1000 | - |
| Currency | `currency` | string | Yes | ISO Code | `USD`, `EUR`, etc. |
| Slot Duration | `slotDuration` | number | Yes | Global default | - |
| Slots Per Loop | `slotsPerLoop` | number | Yes | Usually 10 or 12 | - |
| Traffic Multiplier| `multiplier` | number | Yes | In `trafficTiers` | Min 0.1, Max 5.0 |

## 10. System Audit Fields
Automatically attached to every document by the `BaseRepository`.

| Field Name | DB Field | Data Type | Description |
|------------|----------|-----------|-------------|
| Created At | `created_at` | timestamp | ISO string of creation |
| Updated At | `updated_at` | timestamp | ISO string of last update |
| System ID | `id` | string | Document unique identifier |
