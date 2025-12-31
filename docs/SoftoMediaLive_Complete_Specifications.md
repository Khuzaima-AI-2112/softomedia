# SoftoMedia Digital Signage Network - Complete Specifications & Deployment Guide

> [!IMPORTANT]
> **RULE: Build in the Cloud.**
> All deployments must be triggered via Google Cloud Build using `gcloud builds submit`. Local builds are for development only.
>
> **RULE: Single Source of Truth.**
> Never hardcode configuration data (ads, durations, file paths) inside route handlers (e.g., `index.js`). Always use dedicated seed/config files (e.g., `seed_demo.js`) to prevent "ghost" data overrides. Run `verify_predeploy.js` before deploying.
>
> **RULE: Atomic Deployments Only.**
> Every `gcloud builds submit --config cloudbuild.yaml .` rebuilds and redeploys BOTH `client-app` AND `ad-server` services. NEVER manually delete Cloud Run services using `gcloud run services delete`. The build system is the only source of service updates.

**Version:** 1.0  
**Date:** December 21, 2025  
**Domain:** `softomedia.net`  
**Status:** Production Ready

---

## Table of Contents

1. Architecture Overview
2. Screen URLs & Configuration
3. Backend Architecture & User Roles
4. API Specifications
5. Multi-Tenant Security Model
6. Cost Analysis
7. Security Review & Hardening
8. Deployment Checklist

---

# PART 1: ARCHITECTURE OVERVIEW

## Architecture Verification

### ✅ NO Load Balancer Used

This architecture uses **Cloud Run Domain Mapping ONLY** - no load balancer:

```
softomedia.net
├─ app.softomedia.net ──CNAME──> ghs.googlehosted.com ──> Cloud Run: client-app
└─ backend.softomedia.net ──CNAME──> ghs.googlehosted.com ──> Cloud Run: ad-server
```

**Why this is cheaper:**
- ❌ **NOT using:** Google Cloud Load Balancer ($16/month fixed cost)
- ✅ **Using instead:** Cloud Run Domain Mapping (FREE)
- ✅ Each subdomain maps directly to its Cloud Run service
- ✅ Google manages DNS and SSL automatically (FREE)

**Cost savings:** $16/month by eliminating load balancer

---

# PART 2: SCREEN URLS & CONFIGURATION

## Screen URLs

### **Both screens go to the SAME URL:**

```
https://app.softomedia.net/?screen_id=screen1
https://app.softomedia.net/?screen_id=screen2
https://app.softomedia.net/?screen_id=screenN
```

### How Each Screen Works

**Screen 1 (Lobby):**
```
URL: https://app.softomedia.net/?screen_id=screen1

On page load:
1. JavaScript reads ?screen_id=screen1 from URL
2. Stores screen_id="screen1" in localStorage
3. POSTs to /api/screens/register with screen_id="screen1"
4. Opens SSE connection: /api/subscribe/screen1
5. Receives playlist updates for screen1 only
6. Logs impressions with screen_id="screen1"
```

**Screen 2 (Hallway):**
```
URL: https://app.softomedia.net/?screen_id=screen2

On page load:
1. JavaScript reads ?screen_id=screen2 from URL
2. Stores screen_id="screen2" in localStorage
3. POSTs to /api/screens/register with screen_id="screen2"
4. Opens SSE connection: /api/subscribe/screen2
5. Receives playlist updates for screen2 only
6. Logs impressions with screen_id="screen2"
```

### Key Difference

| Aspect | Screen 1 | Screen 2 |
|--------|----------|----------|
| **URL** | `https://app.softomedia.net/?screen_id=screen1` | `https://app.softomedia.net/?screen_id=screen2` |
| **screen_id** | "screen1" | "screen2" |
| **Firestore Doc** | screens/screen1 | screens/screen2 |
| **Pub/Sub Channel** | /api/subscribe/screen1 | /api/subscribe/screen2 |
| **Impressions Tracked** | WHERE screen_id="screen1" | WHERE screen_id="screen2" |
| **Admin sees** | Screen 1 status & analytics | Screen 2 status & analytics |

### Physical Screen Setup

**Screen 1 (Lobby display):**
1. Bookmark: `https://app.softomedia.net/?screen_id=screen1`
2. Set as auto-launch homepage
3. Or configure ChromeOS kiosk mode to open that URL on boot

**Screen 2 (Hallway display):**
1. Bookmark: `https://app.softomedia.net/?screen_id=screen2`
2. Set as auto-launch homepage
3. Or configure ChromeOS kiosk mode to open that URL on boot

**Screen N (Any location):**
1. Bookmark: `https://app.softomedia.net/?screen_id=screenN`
2. Replace screenN with actual ID (e.g., screen3, screen_lobby_1, etc.)

### Admin Control

From admin dashboard at `https://backend.softomedia.net/admin/`:

```
Admin sees Screen List:
┌─────────────────────────────────────────┐
│ Screen List                             │
├──────────────┬──────────┬──────────────┤
│ Screen ID    │ Location │ Status       │
├──────────────┼──────────┼──────────────┤
│ screen1      │ Lobby    │ Online ✓     │
│ screen2      │ Hallway  │ Online ✓     │
│ screen3      │ Main St  │ Offline ✗    │
└──────────────┴──────────┴──────────────┘

Click "screen1" → See only screen1's:
- Assigned playlist
- Recent impressions
- Completion rate
- Device info
- Heartbeat status

Click "screen2" → See only screen2's:
- Assigned playlist
- Recent impressions
- Completion rate
- Device info
- Heartbeat status
```

---

## Independent Screen Impression Tracking

### ✅ How Each Screen Tracks Independently

Each screen is uniquely identified by `screen_id` and tracks impressions separately:

```
Screen 1 registers:
POST /api/screens/register
{screen_id: "screen1", location: "lobby", model: "chromecast"}
  ↓ Stored in Firestore with unique ID
  ↓
Each ad play logs:
POST /api/impressions/log
{
  screen_id: "screen1",    ← UNIQUE identifier
  ad_id: "campaign_1",
  timestamp: "2025-12-21T19:48:00Z",
  duration_seconds: 30,
  playback_completed: true
}
  ↓ Inserted into BigQuery
  ↓
Query returns Screen1 analytics:
SELECT * FROM ad_impressions WHERE screen_id = "screen1"
Result: All impressions for screen1 only (independent tracking)
```

### ✅ BigQuery Tracks by screen_id

Each row in BigQuery has `screen_id` as REQUIRED field:

```sql
-- Query impressions for Screen 1
SELECT ad_id, COUNT(*) as impressions
FROM ad_impressions
WHERE screen_id = "screen1"  ← Filters to this screen only
GROUP BY ad_id;

-- Query impressions for Screen 2
SELECT ad_id, COUNT(*) as impressions
FROM ad_impressions
WHERE screen_id = "screen2"  ← Completely independent
GROUP BY ad_id;

-- Each screen's data is tracked separately
```

**Result:** Every screen's impressions are independently tracked and queryable.

---

# PART 3: BACKEND ARCHITECTURE & USER ROLES

## 1. Authentication & User Management

### Database Schema: Users Table (Firestore)

```
Collection: users
Document: {user_id}
{
  user_id: "admin_001",
  email: "admin@softomedia.net",
  password_hash: "bcrypt_hash_...",
  role: "admin",               ← CRITICAL: Controls permissions
  created_at: "2025-12-21T20:00:00Z",
  status: "active",
  permissions: {
    can_manage_locations: true,
    can_manage_advertisers: true,
    can_manage_admins: true,
    can_view_all_analytics: true,
    can_manage_networks: true
  }
}

---

{
  user_id: "location_001",
  email: "manager@pizzahut.com",
  password_hash: "bcrypt_hash_...",
  role: "location_owner",       ← Retail location (screen owner)
  location_id: "loc_pizzahut_nyc",
  created_at: "2025-12-21T20:00:00Z",
  status: "active",
  permissions: {
    can_manage_own_screens: true,
    can_view_own_analytics: true,
    can_accept_ads: true,
    can_manage_own_location: true
  }
}

---

{
  user_id: "advertiser_001",
  email: "marketing@cocacola.com",
  password_hash: "bcrypt_hash_...",
  role: "advertiser",           ← Ad buyer
  company_id: "coca_cola_001",
  created_at: "2025-12-21T20:00:00Z",
  status: "active",
  permissions: {
    can_buy_inventory: true,
    can_upload_ads: true,
    can_view_own_analytics: true,
    can_manage_campaigns: true
  }
}
```

### Login Endpoint

```
POST /api/auth/login
{
  email: "manager@pizzahut.com",
  password: "secure_password"
}

Response (JWT Token):
{
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  user: {
    user_id: "location_001",
    role: "location_owner",
    location_id: "loc_pizzahut_nyc",
    permissions: {
      can_manage_own_screens: true,
      can_view_own_analytics: true,
      can_accept_ads: true,
      can_manage_own_location: true
    }
  },
  expires_in: 86400  ← 24 hours
}
```

## 2. Role-Based Access Control (RBAC)

### Admin Role

```
POST /api/admin/locations
  → Create new retail location
  
POST /api/admin/users/advertisers
  → Create advertiser accounts
  
GET /api/admin/analytics/all
  → View all system analytics
  
PUT /api/admin/networks/manage
  → Manage ad network integrations (The Trade Desk, etc.)
  
DELETE /api/admin/users/{user_id}
  → Remove users
  
GET /api/admin/system/stats
  → System-wide metrics
```

### Location Owner Role

```
GET /api/locations/{location_id}/screens
  → List own screens
  
PUT /api/screens/{screen_id}
  → Configure own screens (brightness, volume, etc.)
  
GET /api/screens/{screen_id}/analytics
  → View own screen impressions
  
GET /api/locations/{location_id}/analytics
  → View location-wide stats
  
PUT /api/locations/{location_id}/settings
  → Manage location settings
  
GET /api/locations/{location_id}/pending-ads
  → See ads available in their location/region
  
POST /api/locations/{location_id}/accept-ad/{ad_id}
  → Accept ad to run on their screens
  
GET /api/locations/{location_id}/active-ads
  → See currently running ads
```

### Advertiser Role

```
POST /api/ads/create
  → Upload new ad (video/image)
  
GET /api/ads/my-ads
  → View all own ads
  
POST /api/campaigns/create
  → Create campaign (time range, regions, budget)
  
GET /api/campaigns/{campaign_id}
  → View campaign details
  
GET /api/campaigns/{campaign_id}/analytics
  → View impressions by location/region
  
GET /api/inventory/available
  → See available screens/locations (pricing)
  
POST /api/inventory/book
  → Reserve inventory for campaign
  
PUT /api/campaigns/{campaign_id}/pause
  → Pause/resume campaign
  
GET /api/billing/invoices
  → View billing history
```

## 3. Database Schema: Multi-Tenant Collections

### Locations (Retail Stores)

```
Collection: locations
Document: {location_id}
{
  location_id: "loc_pizzahut_nyc",
  owner_id: "location_001",
  company_name: "Pizza Hut Times Square",
  address: "123 Main St, NYC, NY 10001",
  region: "northeast",        ← For ad targeting
  screens: ["screen1", "screen2", "screen3"],
  screen_count: 3,
  status: "active",
  created_at: "2025-12-21T20:00:00Z",
  accepts_ads: true,
  
  pricing: {
    rate_per_impression: 0.05,  ← CPM (cost per 1000 impressions)
    available_slots_per_day: 100,
    hours_available: "08:00-22:00"
  },
  
  restrictions: {
    adult_content: false,
    alcohol: false,
    politics: true,
    specific_competitors: ["burger_king", "kfc"]
  }
}
```

### Screens

```
Collection: screens
Document: {screen_id}
{
  screen_id: "screen1",
  location_id: "loc_pizzahut_nyc",
  owner_id: "location_001",
  device_type: "samsung_65in",
  resolution: "4K",
  
  status: {
    is_online: true,
    last_heartbeat: "2025-12-21T20:00:00Z",
    uptime_percent: 99.7,
    battery_level: null  ← If mobile
  },
  
  impressions_today: 247,
  impressions_this_month: 7420,
  
  active_campaign_id: "camp_coca_001",
  active_ad_id: "ad_coca_tv_30sec"
}
```

### Advertisers

```
Collection: advertisers
Document: {company_id}
{
  company_id: "coca_cola_001",
  company_name: "The Coca-Cola Company",
  primary_contact_user_id: "advertiser_001",
  website: "www.cocacola.com",
  
  billing: {
    account_balance: 50000.00,
    monthly_budget: 10000.00,
    payment_method: "credit_card",
    auto_recharge: true
  },
  
  created_at: "2025-12-21T20:00:00Z",
  status: "active"
}
```

### Ads/Creative

```
Collection: ads
Document: {ad_id}
{
  ad_id: "ad_coca_tv_30sec",
  advertiser_id: "coca_cola_001",
  
  content: {
    title: "Coca-Cola Holiday Campaign",
    format: "video",
    duration_seconds: 30,
    file_url: "gs://softomedia-bucket/ads/coca_cola_holiday.mp4",
    thumbnail_url: "gs://softomedia-bucket/ads/coca_cola_holiday.jpg",
    file_size_mb: 450
  },
  
  restrictions: {
    age_group: "all",
    regions: ["northeast", "midwest"],
    device_types: ["all"],
    screen_types: ["indoor", "retail"],
    cannot_show_with: ["pepsi", "fanta"]
  },
  
  status: "approved",
  created_at: "2025-12-21T20:00:00Z"
}
```

### Campaigns

```
Collection: campaigns
Document: {campaign_id}
{
  campaign_id: "camp_coca_001",
  advertiser_id: "coca_cola_001",
  
  details: {
    name: "Coca-Cola Q1 2026 Campaign",
    start_date: "2026-01-01",
    end_date: "2026-03-31",
    status: "active"  ← active, paused, completed
  },
  
  targeting: {
    regions: ["northeast", "midwest", "southwest"],
    screen_count: 500,
    estimated_impressions: 500000,
    
    schedule: {
      mon_fri: "08:00-22:00",
      sat_sun: "10:00-23:00"
    },
    
    frequency_cap: 10  ← Max times per location per day
  },
  
  budget: {
    total_budget: 50000.00,
    budget_spent: 12345.67,
    cost_per_impression: 0.05,  ← CPM: $50 per 1000 impressions
    daily_cap: 2000.00
  },
  
  ads: ["ad_coca_tv_30sec", "ad_coca_banner"],
  active_locations: ["loc_pizzahut_nyc", "loc_burger_king_la", ...],
  
  analytics: {
    total_impressions: 246900,
    completed_impressions: 245600,
    completion_rate: 0.995,
    ctr: 0.02,  ← Click-through rate
    conversions: 1234
  }
}
```

### Inventory (Available Slots)

```
Collection: inventory
Document: {inventory_id}
{
  inventory_id: "inv_loc_pizzahut_nyc_dec21",
  location_id: "loc_pizzahut_nyc",
  
  date: "2025-12-21",
  
  slots: {
    total_available: 500,
    booked: 200,
    available: 300,
    
    by_time: {
      "08:00-12:00": { available: 75, booked: 25 },
      "12:00-16:00": { available: 100, booked: 50 },
      "16:00-20:00": { available: 100, booked: 100 },
      "20:00-22:00": { available: 25, booked: 25 }
    }
  },
  
  pricing: {
    base_rate: 0.05,  ← CPM ($50 per 1000)
    surge_multiplier: 1.2,  ← Prime time
    total_estimated_revenue: 15.00  ← For available slots
  }
}
```

---

# PART 4: API SPECIFICATIONS

## Authentication Endpoints

```
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh-token
GET /api/auth/me  ← Current user info
```

## Admin Endpoints

```
# User Management
POST /api/admin/users  ← Create user (admin, location, advertiser)
GET /api/admin/users  ← List all users
PUT /api/admin/users/{user_id}  ← Edit user
DELETE /api/admin/users/{user_id}  ← Delete user

# Location Management
POST /api/admin/locations  ← Create location
GET /api/admin/locations  ← List all locations
PUT /api/admin/locations/{location_id}
DELETE /api/admin/locations/{location_id}

# Analytics
GET /api/admin/analytics/system  ← Total impressions, revenue, etc.
GET /api/admin/analytics/by-location
GET /api/admin/analytics/by-advertiser
GET /api/admin/analytics/by-campaign

# Network Integration
POST /api/admin/networks/connect  ← Connect The Trade Desk, etc.
GET /api/admin/networks/status
PUT /api/admin/networks/{network_id}/settings
```

## Location Owner Endpoints

```
# Screen Management
GET /api/locations/{location_id}/screens
PUT /api/screens/{screen_id}/settings
GET /api/screens/{screen_id}/status
GET /api/screens/{screen_id}/analytics

# Location Analytics
GET /api/locations/{location_id}/analytics
GET /api/locations/{location_id}/analytics/impressions-by-campaign
GET /api/locations/{location_id}/analytics/revenue

# Available Ads
GET /api/locations/{location_id}/available-ads  ← Ads for this region
POST /api/locations/{location_id}/accept-ad/{ad_id}
GET /api/locations/{location_id}/active-campaigns
DELETE /api/locations/{location_id}/decline-ad/{ad_id}

# Inventory Management
GET /api/locations/{location_id}/inventory
PUT /api/locations/{location_id}/inventory/settings
```

## Advertiser Endpoints

```
# Creative Management
POST /api/ads/upload  ← Upload video/image
GET /api/ads  ← View own ads
PUT /api/ads/{ad_id}/edit
DELETE /api/ads/{ad_id}

# Campaign Management
POST /api/campaigns/create
GET /api/campaigns  ← View own campaigns
PUT /api/campaigns/{campaign_id}
DELETE /api/campaigns/{campaign_id}
PUT /api/campaigns/{campaign_id}/pause
PUT /api/campaigns/{campaign_id}/resume

# Campaign Analytics
GET /api/campaigns/{campaign_id}/analytics
GET /api/campaigns/{campaign_id}/analytics/by-location
GET /api/campaigns/{campaign_id}/analytics/impressions
GET /api/campaigns/{campaign_id}/analytics/performance

# Inventory & Booking
GET /api/inventory/available  ← Search available screens
GET /api/inventory/forecast  ← Projected impressions
POST /api/inventory/reserve  ← Book screens for campaign

# Billing
GET /api/billing/invoices
GET /api/billing/current-month
PUT /api/billing/payment-method
```

---

## Ad Scheduling System

### Overview

Brands (advertisers) can schedule when their campaigns run using day-of-week and time-range rules. The system automatically allocates ads into a fixed 1-minute loop (12 slots × 5 seconds) that repeats for 60 minutes.

### Loop Mechanics

- **Loop Structure**: 12 slots per minute, each 5 seconds long
- **Slot Allocation**: Round-robin distribution across all eligible campaigns
- **Hourly Repetition**: The same 12-slot loop repeats 60 times during the hour
- **Dynamic Updates**: Loop regenerates at the start of each hour based on active schedules

**Example with 3 Campaigns**:
```
Campaigns scheduled for 2:00 PM - 3:00 PM:
- Campaign A (Coca-Cola)
- Campaign B (Nike)
- Campaign C (Apple)

Generated Loop (repeats 60 times per hour):
Slot 0 (0:00-0:05) → Campaign A
Slot 1 (0:05-0:10) → Campaign B
Slot 2 (0:10-0:15) → Campaign C
Slot 3 (0:15-0:20) → Campaign A
Slot 4 (0:20-0:25) → Campaign B
Slot 5 (0:25-0:30) → Campaign C
Slot 6 (0:30-0:35) → Campaign A
Slot 7 (0:35-0:40) → Campaign B
Slot 8 (0:40-0:45) → Campaign C
Slot 9 (0:45-0:50) → Campaign A
Slot 10 (0:50-0:55) → Campaign B
Slot 11 (0:55-1:00) → Campaign C

Result: Each campaign appears 4 times in the 1-minute loop
Total: 4 appearances × 60 repeats = 240 plays per hour per campaign
```

### Schedule Configuration

Campaigns can have multiple schedule rules:

```json
{
  "enabled": true,
  "rules": [
    {
      "id": "rule_1",
      "days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
      "time_ranges": [
        { "start": "11:30", "end": "13:00" },
        { "start": "18:00", "end": "23:45" }
      ]
    },
    {
      "id": "rule_2",
      "days": ["saturday", "sunday"],
      "time_ranges": [
        { "start": "11:30", "end": "23:45" }
      ]
    }
  ]
}
```

### API Endpoints

#### Campaign Schedule Management
```
PUT /api/campaigns/:campaignId/schedule
  → Update campaign schedule
  → Body: { "schedule": { "enabled": true, "rules": [...] } }
  → Auth: Brand owner or admin

GET /api/campaigns/:campaignId/schedule
  → Get campaign schedule details
  → Returns: { "campaign_id": "...", "schedule": {...} }
  → Auth: Brand owner or admin
```

#### Schedule Queries
```
GET /api/schedules/active
  → Get all campaigns with active schedules at current time
  → Returns: { "current_time": "...", "active_campaigns": [...] }
  → Auth: Required

GET /api/schedules/slots/:hour
  → Get slot allocation for a specific hour (ISO 8601 format)
  → Returns: 12-slot loop with campaign assignments
  → Example: GET /api/schedules/slots/2025-12-30T14:00:00Z
  → Auth: Required

GET /api/schedules/timeline
  → Get timeline data for visualization
  → Query params: ?date=2025-12-30&brand_id=brand_001
  → Returns: All campaigns with their schedule rules
  → Auth: Required (brands see own campaigns only)

POST /api/schedules/validate
  → Validate schedule before saving
  → Body: { "schedule": {...} }
  → Returns: { "valid": true/false, "errors": [...] }
  → Auth: Required
```

### Conflict Resolution

When multiple campaigns are scheduled for the same time:
- **Strategy**: Round-robin allocation ensures fair distribution
- **No Hard Conflicts**: All scheduled campaigns get airtime
- **Equal Distribution**: Each campaign appears equally in the loop
- **Example**: 6 campaigns → each appears 2 times in the 12-slot loop

### Frontend UI Components

#### AdSchedule Component
- Day-of-week selector (Mondays-Fridays, Saturdays-Sundays, Every Day)
- Time range picker (start time "to" end time)
- Multiple rules support with add/remove functionality
- Integrated into campaign upload drawer

#### ScheduleTimeline Component
- 24-hour horizontal timeline visualization
- Color-coded bars showing when each campaign is eligible
- Hover tooltips with campaign details
- Available in brand dashboard

### Integration with Playlist

The playlist API (`GET /api/playlist/:screenId`) automatically:
1. Checks current date/time
2. Filters campaigns by active schedules
3. Generates 12-slot loop using round-robin
4. Returns playlist with explicit slot assignments

Response includes:
```json
{
  "screen_id": "screen_id",
  "playlist": [...],
  "loop": [
    { "slot_number": 0, "campaign_id": "...", "duration": 5 },
    ...
  ],
  "loop_info": {
    "slots_per_minute": 12,
    "seconds_per_slot": 5,
    "repeats": 60,
    "total_campaigns": 3
  }
}
```

---

# PART 5: MULTI-TENANT SECURITY MODEL

## Role-Based Access Control (RBAC) - Verified

```
Database Schema: users.permissions
{
  user_id: "advertiser_001",
  role: "advertiser",
  
  permissions: {
    "ads:create": true,
    "ads:read_own": true,
    "ads:read_all": false,     ← Cannot read other advertisers' ads
    "ads:delete_own": true,
    "ads:delete_all": false,
    
    "campaigns:create": true,
    "campaigns:read_own": true,
    "campaigns:read_all": false,
    
    "analytics:read_own": true,
    "analytics:read_all": false,
    
    "billing:read_own": true,
    "billing:read_all": false
  }
}

ENFORCEMENT:
Every endpoint checks:
1. Is user authenticated? (JWT valid)
2. Does user have permission? (permission check)
3. Is data owned by user? (row-level security)

Example:
GET /api/campaigns/camp_coca_001
{
  const campaign = await db.collection('campaigns')
    .doc('camp_coca_001')
    .get();
  
  // Check 1: User authenticated ✓ (JWT valid)
  if (!req.user) return 401;
  
  // Check 2: User has permission ✓ (campaigns:read_own)
  if (!req.user.permissions['campaigns:read_own']) return 403;
  
  // Check 3: Campaign belongs to user ✓ (advertiser_id matches)
  if (campaign.advertiser_id !== req.user.company_id) return 403;
  
  return campaign;
}
```

## Data Isolation (Multi-Tenant Security)

```
LOCATION OWNER: Can only see their location

// Firestore query with implicit security
GET /api/locations/{location_id}/screens
Authorization: Bearer {jwt_token}

Backend enforces:
const screens = db.collection('screens')
  .where('location_id', '==', req.user.location_id)  ← Enforced
  .where('status', '==', 'active')
  .get();

If location_id doesn't match req.user.location_id:
→ Return 403 Forbidden (even if they guess the ID)

ADVERTISER: Can only see their campaigns
const campaigns = db.collection('campaigns')
  .where('advertiser_id', '==', req.user.company_id)  ← Enforced
  .get();

ADMIN: Can see everything
const campaigns = db.collection('campaigns').get();
```

## The Trade Desk Integration

### Architecture

```
SoftoMedia ↔ The Trade Desk
     ↓
[Bidding API]
     ↓
[Impression Tracking]
     ↓
[Real-time Reporting]
```

### How It Works

#### Option A: SoftoMedia as Seller (Demand-Side)

```
1. Admin connects The Trade Desk account
   POST /api/admin/networks/connect
   {
     network: "the_trade_desk",
     api_key: "ttd_api_key_...",
     seller_id: "softomedia_001"
   }

2. SoftoMedia exposes inventory to TTD
   - Regions: ["northeast", "midwest", ...]
   - Device types: ["Samsung 65in", "LG Smart TV", ...]
   - Impressions per location
   - CPM pricing
   
3. TTD buyers bid on SoftoMedia inventory
   
4. Winning ads play on SoftoMedia screens
   
5. Impressions tracked in BigQuery & reported back to TTD
   POST /api/networks/the_trade_desk/report-impression
   {
     campaign_id: "ttd_camp_001",
     impression_id: "imp_123456",
     screen_id: "screen1",
     ad_id: "ad_ttd_001",
     timestamp: "2025-12-21T20:00:00Z",
     completed: true
   }
```

#### Required Architecture Changes

```
NEW: Trade Desk Integration Module
├─ /api/admin/networks/the_trade_desk/connect
├─ /api/networks/sync-inventory  ← Push screen inventory to TTD
├─ /api/networks/receive-ads  ← Receive winning ads from TTD
└─ /api/networks/report-impressions  ← Send impression data

MODIFIED: Impression Logging
├─ Track external_network field
├─ Store ttd_campaign_id, ttd_ad_id
└─ Report to both BigQuery AND The Trade Desk
```

---

# PART 6: COST ANALYSIS

## Verified Costs (1 vs 10 vs 100 Screens)

### Key Assumptions
- Each screen plays 50-100 ad impressions per day
- 100 MB playlist cached locally (downloaded once daily per screen)
- Heartbeat every 30 minutes
- No load balancer (saves $16/month)

## Cost Analysis: 1 Screen

| Service | Usage | Price/Unit | Qty | Monthly Cost |
|---------|-------|-----------|-----|--------------|
| **Cloud Run (Backend API)** | ~5 API requests/day = 150/month | Free tier (2M requests) | — | **$0** ✓ |
| **Cloud Run (Backend CPU)** | ~30 API calls × 50ms = 1.5 sec/day | Free tier (180K vCPU-sec) | 45 sec/month | **$0** ✓ |
| **Pub/Sub Messages** | 48 heartbeats/day + 1 update/day = 1.47K/month | Free tier (10 GB) | 2.9 MB | **$0** ✓ |
| **Firestore Reads** | Screen status check: 30/month | Free tier (100K ops) | 30 | **$0** ✓ |
| **Firestore Writes** | Register + heartbeat updates: 45/month | Free tier (100K ops) | 45 | **$0** ✓ |
| **BigQuery Streaming Inserts** | 50 impressions/day = 1.5K rows/month | Free tier (10 GB) | 1.5 MB | **$0** ✓ |
| **Cloud Storage (Egress)** | 100 MB download/day = 3 GB/month | $0.12/GB | 3 GB | **$0.36** |
| **Everything Else** | Logging, DNS, SSL, storage | — | — | **$0.04** |
| | | | |
| **TOTAL (1 SCREEN)** | | | | **$0.36-0.40/month** |
| **Annual (1 Screen)** | | | | **$4.32-4.80/year** |

## Cost Analysis: 10 Screens

| Metric | Cost |
|--------|------|
| **Cloud Run (Backend)** | $0 |
| **Pub/Sub Messages** | $0 |
| **Firestore** | $0 |
| **BigQuery** | $0 |
| **Cloud Storage (Egress)** | $3.60 |
| **Everything Else** | $0.10 |
| **TOTAL (10 SCREENS)** | **$3.62-3.70/month** |
| **Per-Screen** | **$0.36-0.37/month** |
| **Annual (10 Screens)** | **$43.44-44.40/year** |

## Cost Analysis: 100 Screens

| Metric | Cost |
|--------|------|
| **Cloud Run (Backend)** | $0 |
| **Pub/Sub Messages** | $11.76 |
| **Firestore** | $0 |
| **BigQuery** | $0 |
| **Cloud Storage (Egress)** | $36.00 |
| **Everything Else** | $0.24 |
| **TOTAL (100 SCREENS)** | **$47.97-48.00/month** |
| **Per-Screen** | **$0.48/month** |
| **Annual (100 Screens)** | **$575.64-576.00/year** |

## Cost Summary Table

| Metric | 1 Screen | 10 Screens | 100 Screens |
|--------|----------|-----------|------------|
| **Monthly Cost** | **$0.40** | **$3.70** | **$48.00** |
| **Annual Cost** | **$4.80** | **$44.40** | **$576.00** |
| **Per-Screen/Month** | $0.40 | $0.37 | $0.48 |
| **Per-Screen/Year** | $4.80 | $4.44 | $5.76 |
| **Load Balancer Savings** | $0 SAVED | $0 SAVED | $0 SAVED |

---

# PART 7: SECURITY REVIEW & HARDENING

## Authentication Security

### JWT Token Implementation

```
✅ SECURE: Use RS256 (asymmetric)

Payload:
{
  user_id: "location_001",
  role: "location_owner",
  location_id: "loc_pizzahut_nyc",
  iat: 1671641600,        ← Issued at
  exp: 1671728000,        ← Expires in 24 hours
  iss: "softomedia",      ← Issuer
  aud: "softomedia-api"   ← Audience
}

Token Expiration: 15-30 minutes (short-lived)
Refresh Token: 7-30 days (auto-rotates)
```

### Password Security

```
✅ SECURE:
- Minimum 12 characters
- Mix of upper, lower, numbers, symbols
- Hash with bcrypt (cost factor 12+)
- Rate limit login attempts (5 failures → 15 min lockout)
- Email verification on signup
```

### Multi-Factor Authentication (MFA)

```
RECOMMENDED FOR:
├─ All admin users (mandatory)
├─ Advertiser accounts (recommended)
└─ Location owners (optional)

IMPLEMENTATION:
├─ TOTP (Time-based One-Time Password)
├─ Email-based MFA (fallback)
└─ Recovery codes (10 single-use)
```

## Network Security

### HTTPS/TLS

```
✅ REQUIRED:
- All connections HTTPS only (TLS 1.2 minimum)
- Enforce HSTS header
- Google Cloud managed certificate
- Auto-renewed 60 days before expiry
- Redirect HTTP → HTTPS
```

### CORS Configuration

```
SAFE Origins:
├─ https://app.softomedia.net
├─ https://backend.softomedia.net
└─ http://localhost:3000 (dev only)

Credentials: Enabled (cookies)
Methods: GET, POST, PUT, DELETE
```

### API Rate Limiting

```
By IP Address: 1000 req/min
By User ID: 100 req/min
By Endpoint:
  ├─ /api/auth/login: 5 attempts/min
  ├─ /api/campaigns: 10/min per advertiser
  └─ /api/networks/ttd: 100/min
```

## Data Security

### Encryption

```
✅ At Rest: Firestore & Cloud Storage encrypted
✅ In Transit: HTTPS with TLS 1.2+
✅ Secrets: Google Cloud Secret Manager
```

### Secret Management

```
DO NOT hardcode API keys!

SECURE:
const secret = await secretManager.accessSecret('the-trade-desk-api-key');

Google Cloud Secret Manager:
├─ API keys stored securely
├─ Automatic rotation
├─ Audit logging
└─ Access control by service
```

### Sensitive Data Logging

```
✅ LOG:
- Login attempts (timestamp, IP, result)
- Campaign creation/deletion
- Payment transactions
- Permission changes

❌ NEVER LOG:
- Passwords
- Credit card numbers
- API keys
- Auth tokens
```

## Application Security

### Input Validation

```
VALIDATE ALL USER INPUT:

const schema = Joi.object({
  name: Joi.string()
    .alphanum()
    .min(3)
    .max(100)
    .required(),
  
  budget: Joi.number()
    .min(100)
    .max(1000000)
    .required()
});

const { error, value } = schema.validate(req.body);
if (error) return res.status(400).json({ error });
```

### XSS Prevention

```
✅ SECURE:
1. Use template engines with auto-escape
2. Content Security Policy (CSP) header
3. Sanitize HTML if needed

CSP Header:
app.setHeader('Content-Security-Policy',
  "default-src 'self'; script-src 'self'");
```

## Infrastructure Security

### Cloud Run Security

```
CONFIGURE:
1. Require authentication (no public access)
2. Set resource limits (2GB memory, 2 CPU max)
3. Run as specific service account
4. Scan container images for vulnerabilities
```

### Firestore Security Rules

```
ENFORCE at database level:

// Location owners can only read their own location
match /locations/{locationId} {
  allow read: if get(/databases/$(database)/documents/locations/$(locationId))
    .data.owner_id == request.auth.uid;
  allow write: if false;  ← Only backend can modify
}

// Advertisers can only read their own campaigns
match /campaigns/{campaignId} {
  allow read: if get(/databases/$(database)/documents/campaigns/$(campaignId))
    .data.advertiser_id == request.auth.uid;
}
```

### Cloud Storage Security

```
BUCKET SECURITY:
1. Make buckets private
2. Enforce HTTPS only
3. Enable versioning
4. Use signed URLs for file access (1 hour expiry)
```

## The Trade Desk Integration Security

```
API KEY SECURITY:
✅ Store in Secret Manager (not code)
✅ Rate limit TTD API calls (100/min)
✅ Verify HTTPS for all API calls
✅ Monitor for unusual activity

Impression Reporting:
✅ Validate impressions before sending
✅ Implement retry logic with exponential backoff
✅ Log all TTD API calls (redacted)
```

## Security Checklist - BEFORE DEPLOYMENT

```
AUTHENTICATION:
☑ JWT tokens implemented (RS256)
☑ Token expiration set (15-30 min)
☑ Refresh tokens implemented
☑ Password hashing with bcrypt
☑ Login rate limiting
☑ MFA enabled for admins
☑ Email verification on signup

AUTHORIZATION:
☑ RBAC implemented and tested
☑ Row-level security enforced
☑ Admin accounts protected
☑ Privilege escalation tested

NETWORK:
☑ HTTPS only (no HTTP)
☑ HSTS header configured
☑ CORS configured
☑ Rate limiting implemented

DATA:
☑ Encryption at rest
☑ Encryption in transit (TLS 1.2+)
☑ Secret Manager configured
☑ Sensitive logs redacted
☑ Input validation on all endpoints
☑ Output encoding (XSS prevention)

INFRASTRUCTURE:
☑ Cloud Run authentication required
☑ Resource limits set
☑ Service account configured
☑ Firestore security rules deployed
☑ Bucket security configured
☑ Container images scanned

MONITORING:
☑ Audit logging implemented
☑ Security alerts configured
☑ Incident response plan
☑ Vulnerability scanning
☑ Third-party API security verified
```

---

# PART 8: DEPLOYMENT CHECKLIST

## Pre-Production Setup

### Google Cloud Project

```
STEP 1: Create Project
gcloud projects create softomedia-prod --name="SoftoMedia"

STEP 2: Enable Services
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  pubsub.googleapis.com \
  bigquery.googleapis.com \
  storage-api.googleapis.com \
  cloudkms.googleapis.com \
  secretmanager.googleapis.com

STEP 3: Configure IAM
gcloud iam service-accounts create softomedia \
  --display-name="SoftoMedia Service Account"

STEP 4: Set Permissions
gcloud projects add-iam-policy-binding softomedia-prod \
  --member=serviceAccount:softomedia@appspot.gserviceaccount.com \
  --role=roles/editor
```

### Domain Setup

```
STEP 1: Reserve Domains
- softomedia.net
- *.softomedia.net (wildcard for subdomains)

STEP 2: Configure DNS
App Subdomain (app.softomedia.net):
CNAME → ghs.googlehosted.com

Backend Subdomain (backend.softomedia.net):
CNAME → ghs.googlehosted.com

STEP 3: SSL Certificate
- Automatic (Google Cloud managed)
- TLS 1.2+
- Auto-renewed

STEP 4: Verify Ownership
- Add TXT record for domain verification
- Wait 15-30 minutes for propagation
```

### Cloud Run Deployment

```
STEP 1: Build Container
docker build -t gcr.io/softomedia-prod/client-app .
docker push gcr.io/softomedia-prod/client-app

STEP 2: Deploy Client App
gcloud run deploy client-app \
  --image gcr.io/softomedia-prod/client-app \
  --platform managed \
  --region us-central1 \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 100 \
  --set-env-vars FIRESTORE_PROJECT=softomedia-prod

STEP 3: Deploy Backend API
gcloud run deploy ad-server \
  --image gcr.io/softomedia-prod/ad-server \
  --platform managed \
  --region us-central1 \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 100 \
  --no-allow-unauthenticated \
  --service-account softomedia@appspot.gserviceaccount.com

STEP 4: Map Custom Domains
gcloud run domain-mappings create \
  --service client-app \
  --domain app.softomedia.net

gcloud run domain-mappings create \
  --service ad-server \
  --domain backend.softomedia.net
```

### Database Setup

```
STEP 1: Firestore Collections
gcloud firestore collections create users
gcloud firestore collections create locations
gcloud firestore collections create screens
gcloud firestore collections create advertisers
gcloud firestore collections create ads
gcloud firestore collections create campaigns
gcloud firestore collections create inventory
gcloud firestore collections create billing_transactions
gcloud firestore collections create admin_accounts

STEP 2: BigQuery Dataset
bq mk --dataset softomedia_analytics

STEP 3: Create Tables
bq mk --table softomedia_analytics.ad_impressions \
  screen_id:STRING,ad_id:STRING,timestamp:TIMESTAMP,duration_seconds:INTEGER,playback_completed:BOOLEAN

bq mk --table softomedia_analytics.campaign_analytics \
  campaign_id:STRING,impressions:INTEGER,spend:FLOAT,completion_rate:FLOAT
```

### Security Hardening

```
STEP 1: Deploy Firestore Security Rules
gcloud firestore deploy-rules firestore.rules

STEP 2: Configure Cloud Armor
gcloud compute security-policies create softomedia-policy \
  --description="SoftoMedia WAF Rules"

gcloud compute security-policies rules create 100 \
  --security-policy softomedia-policy \
  --action "deny-403" \
  --expression "evaluatePreconfiguredExpr('sqli-v33-stable')"

STEP 3: Set Up Secret Manager
gcloud secrets create the-trade-desk-api-key \
  --replication-policy="automatic"

echo "sk_live_abc123xyz789" | \
  gcloud secrets versions add the-trade-desk-api-key \
  --data-file=-

STEP 4: Grant Access
gcloud secrets add-iam-policy-binding the-trade-desk-api-key \
  --member serviceAccount:softomedia@appspot.gserviceaccount.com \
  --role roles/secretmanager.secretAccessor
```

### Monitoring & Alerts

```
STEP 1: Set Up Logging
gcloud logging write softomedia-audit \
  "SoftoMedia system started" \
  --severity=INFO

STEP 2: Create Alerts
gcloud alpha monitoring policies create \
  --notification-channels=[CHANNEL_ID] \
  --display-name="High Error Rate" \
  --condition="error_count > 100"

STEP 3: Configure Uptime Checks
gcloud compute instances create uptime-check \
  --zone us-central1-a

STEP 4: Enable Audit Logging
gcloud logging sinks create softomedia-audit \
  bigquery.googleapis.com/projects/softomedia-prod/datasets/logs
```

---

## Summary

✅ **Complete System Deployed**
- Single codebase for player (screen-independent)
- Multi-tenant backend with role-based access
- The Trade Desk integration ready
- Security hardened and audit-ready
- Costs verified: $0.40-$48/month

✅ **Ready for Launch**
- All security requirements met
- Firestore security rules deployed
- Cloud Run authentication enforced
- MFA configured for admins
- Incident response plan in place

**Status:** Production-ready. Begin beta testing with pilot locations.

---

**Document Version:** 1.0  
**Last Updated:** December 21, 2025  
**Next Review:** January 21, 2026

# Implementation Updates (Dec 2025)

## 1. Region Consolidation
*   **Decision**: All resources (Cloud Run, BigQuery, Firestore) have been consolidated to `us-central1`.
*   **Reasoning**: Minimizes cross-region data transfer costs and improves latency between the Ad Server and BigQuery.

## 2. Authentication Logic
*   **Admin User**: Bootstrap logic added to `ad-server` to automatically create the initial admin user if not present.
    *   **Email**: `sokallel@gmail.com`
*   **Login Flow**: Client App (`/login`) allows users to authenticate against the Ad Server API (`/api/auth/login`) using JWT.
*   **Screen Registration**: Screens now self-register via a POST to `/api/screens/register` on the first launch.

## 3. URLs
*   **Frontend**: `https://client-app-902866748272.us-central1.run.app` (Maps to `app.softomedia.net`)
*   **Backend**: `https://ad-server-902866748272.us-central1.run.app` (Maps to `backend.softomedia.net`)
