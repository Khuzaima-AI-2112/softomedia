# User Stories & Use Cases - Softomedia Live 2026

This document traces expected user flows to their corresponding database operations, providing a map for developers to verify end-to-end functionality.

---

## 1. Advertiser / Brand Persona

### Story: Campaign Creation & Slot Booking
**As an** Advertiser,  
**I want to** select specific store screens and book hourly slots for my creative,  
**So that** my ads reach the target audience in physical retail locations.

| Flow Step | User Action / Input | Backend API / Operation | Database Impact (Firestore) |
|-----------|--------------------|------------------------|---------------------------|
| 1. Init | Clicks "New Campaign" | `GET /api/screens` & `GET /api/pricing/config` | Reads `screens` and `pricing_config` |
| 2. Select | Selects Store/Screen | `GET /api/loops?retailer_id=...&date=...` | Reads `loops` for availability |
| 3. Budget | Enters budget & date range | Internal Wizard State | No DB impact yet |
| 4. Media | Uploads video/image | `POST /api/assets` (Multer) | Writes to `media` collection & Cloud Storage |
| 5. Submit | Clicks "Confirm Booking" | `POST /api/campaigns` | Creates new doc in `campaigns` |
| 6. Final | System commits bookings | `POST /api/campaigns/:id/book` | Updates `loops` collection (slots array modified) |

**Success Output**: Campaign status set to `active`, budget deducted from advertiser's dashboard view, and slots in `loops` collection marked as `booked` with the advertiser's `campaign_id`.

---

## 2. Retailer Persona

### Story: Network Health Monitoring
**As a** Retailer,  
**I want to** see which of my screens are online and what content they are currently playing,  
**So that** I can ensure my infrastructure is operating correctly and generating revenue.

| Flow Step | User Action / Input | Backend API / Operation | Database Impact (Firestore) |
|-----------|--------------------|------------------------|---------------------------|
| 1. Dashboard| Logs in to Dashboard | `GET /api/retailers/:id/stores` | Reads `retailers` and `stores` |
| 2. Health | Views Screen List | `GET /api/screens?retailer_id=...` | Reads `screens` (checks `status` & `last_seen`) |
| 3. Schedule | Clicks "View Schedule" | `GET /api/loops?date=today&retailer_id=...` | Reads `loops` for current day's active slots |

**Success Output**: Real-time visualization of screen connectivity and a preview of the creative assets currently queued in the active hourly loops.

---

## 3. Super Admin Persona

### Story: Dynamic Pricing Adjustment
**As an** Admin,  
**I want to** increase the CPM multiplier for a specific high-traffic holiday,  
**So that** the platform revenue scales with increased foot traffic.

| Flow Step | User Action / Input | Backend API / Operation | Database Impact (Firestore) |
|-----------|--------------------|------------------------|---------------------------|
| 1. Config | Navigates to CPM Calendar| `GET /api/pricing/config` | Reads `pricing_config` |
| 2. Override | Selects Date (e.g., Dec 25) | `POST /api/pricing/overrides` | Updates `pricing_config` (modifies `dateOverrides` map) |
| 3. Multiplier| Sets 2.0x Multiplier | `PUT /api/pricing/config` | Updates `baseCPM` or `trafficTiers` |

**Success Output**: All subsequent slot bookings for that specific date will return calculated prices at 2.0x the base rate. Existing bookings remain unaffected (price locked at time of booking).

---

## 4. Technical Operator Persona

### Story: Screen Provisioning
**As a** Tech Operator,  
**I want to** register a new hardware unit at a store,  
**So that** it can immediately start pulling production loops.

| Flow Step | User Action / Input | Backend API / Operation | Database Impact (Firestore) |
|-----------|--------------------|------------------------|---------------------------|
| 1. Setup | Enters Hardware ID | `POST /api/screens` | Creates new doc in `screens` collection |
| 2. Link | Assigns to Retailer/Store | Step 1 continuation | Writes `retailer_id` and `store_id` to screen doc |
| 3. Verify | Powers on screen | `GET /api/screens/:id` (Heartbeat) | Updates `last_seen` and `status` to `online` |

**Success Output**: Screen appears as "Online" in the dash and starts receiving loop data from `loops` via the `/player` route.

---

## 5. Automated System Use Case

### Use Case: Daily Loop Generation (Cron/D-1)
**Trigger**: Automated job runs at 11:00 PM every night.
**Goal**: Pre-generate all hourly loops for the next calendar day based on store business hours.

| Step | Operation | Backend Logic | Database Impact |
|------|-----------|--------------|-----------------|
| 1 | Scan Stores | Finds all active stores | Reads `stores` |
| 2 | Get Hours | Checks `store_default_hours` | Reads `store_default_hours` |
| 3 | Create Loops| For each open hour (8am-10pm) | Writes 14-16 docs to `loops` per screen |
| 4 | Fill Global | Injects global playlists | Reads `playlists` (where `is_global: true`) |

**System Output**: A fully populated grid of 12-slot loops for every screen in the network, ready for live playback starting at midnight.
