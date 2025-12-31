# SoftoMedia - Functional Gap Analysis & Architecture Review

**Analysis Date**: December 24, 2025  
**Current Build**: 5625cd63  
**Scope**: Multi-Tenant Ad Platform (Multiple Brands × Multiple Retailer Chains × Multiple Stores × Multiple Screens)

---

## Executive Summary

**Current State**: ✅ 100% functional for **single-user demo** (1 admin, 1 brand, 1 retailer)  
**Target State**: Production-ready **multi-tenant platform** supporting:
- 100+ brands simultaneously
- 50+ retailer chains (e.g., Pizza Hut, Starbucks)
- 1000+ individual stores
- 5000+ screens

**Critical Gap**: Current system demonstrates UI/UX but **lacks multi-tenant business logic** for scaling beyond demo.

---

## Architecture Context

### Current Database Structure (Demo)
```
users (3 users)
├── admin@gmail.com (role: admin)
├── brand@demo.com (role: brand) → linked_entity_id: "demo_corp"
└── retailer@demo.com (role: retailer) → linked_entity_id: "demo-screen-01"

advertisers (1 entity)
└── demo_corp (1 brand with 1000 credits)

screens (1 screen)
└── demo-screen-01 (linked to retailer@demo.com)

campaigns (0 - empty)
```

### Target Multi-Tenant Structure
```
users (1000s)
├── admin users (5-10)
├── brand users (100s) → each linked to advertiser entity
└── retailer users (100s) → each linked to retailer_chain entity

advertiser_companies (100+)
├── coca_cola (credits: 50000, campaigns: 12)
├── nike (credits: 25000, campaigns: 8)
└── local_pizza_shop (credits: 500, campaigns: 1)

retailer_chains (50+)
├── pizza_hut_corporate
│   └── stores (200+)
│       ├── pizza_hut_nyc_times_square
│       │   └── screens (3)
│       │       ├── lobby_screen_1
│       │       ├── counter_screen_2
│       │       └── drive_thru_screen_3
│       └── pizza_hut_la_downtown
│           └── screens (2)
└── starbucks_corporate
    └── stores (500+)
        └── screens (1500+)

campaigns (1000s)
├── campaign targeting filters
├── screen assignment logic
└── budget tracking
```

---

## Persona-by-Persona Gap Analysis

## 1. ADMIN PERSONA

### What EXISTS ✅
- Login with auto-routing
- User management (invite, list)
- Screen management (view, filter)
- System overview dashboard
- Hamburger menu navigation

### CRITICAL GAPS ❌

#### 1.1 Multi-Tenant Entity Management
**Priority**: 🔴 **CRITICAL** (Blocker for production)

**Missing Features**:
- ❌ **Advertiser/Brand Company Management**
  - Cannot create new advertiser companies
  - Cannot assign multiple users to same company
  - Cannot set company-level credits/budgets
  - Cannot manage company billing information
  
- ❌ **Retailer Chain Management** 
  - Cannot create retailer chains (e.g., "Pizza Hut Corporate")
  - Cannot create hierarchies: Chain → Stores → Screens
  - Cannot manage profit-sharing rates per chain
  - Cannot assign chain administrators

**Impact**: Cannot onboard new brands or retailers beyond demo accounts

**Example User Story**:
```
As Admin, I want to:
1. Click "Add New Brand" → Enter company details → Assign credits
2. Click "Add New Retailer Chain" → Create hierarchy of stores
3. Assign profit-sharing percentages per chain (40% Pizza Hut, 35% Starbucks)
4. Invite multiple users per company with different permissions
```

---

#### 1.2 Financial Management Dashboard
**Priority**: 🔴 **CRITICAL**

**Missing**:
- ❌ Total platform revenue tracking
- ❌ Brand account balances overview
- ❌ Retailer payout queue
- ❌ Transaction history (deposits, withdrawals, earnings)
- ❌ Billing dispute management

**Impact**: No visibility into platform economics

---

#### 1.3 Campaign Approval Workflow
**Priority**: 🟡 **IMPORTANT**

**Missing**:
- ❌ Content moderation queue
- ❌ Approve/reject pending campaigns
- ❌ Content policy enforcement tools
- ❌ Advertiser reputation scoring

**Current State**: All campaigns auto-approved (unsafe for production)

---

#### 1.4 System Analytics & Monitoring
**Priority**: 🟡 **IMPORTANT**

**Missing**:
- ❌ Platform-wide impression metrics
- ❌ Screen utilization rates (fill rate)
- ❌ Geographic distribution of screens
- ❌ Revenue per region
- ❌ Top-performing campaigns
- ❌ System health monitoring

---

## 2. BRAND/ADVERTISER PERSONA

### What EXISTS ✅
- Login with auto-routing to `/brand/dashboard`
- View ad credits (1000)
- Campaign table (empty state)
- Campaign upload drawer (UI ready)
- Campaign report page (UI built)
- Hamburger menu

### CRITICAL GAPS ❌

#### 2.1 Campaign Creation End-to-End
**Priority**: 🔴 **CRITICAL** (Core functionality)

**Missing Backend Logic**:
- ❌ Video/image upload to Cloud Storage
- ❌ Campaign creation with targeting parameters
- ❌ Budget allocation and deduction from credits
- ❌ Screen selection/targeting logic
- ❌ Campaign activation workflow

**Existing**: Drawer opens, form validates, but **submission fails** (no backend handler)

**Example User Story**:
```
As Brand Manager, I want to:
1. Click "Create Campaign" ✅
2. Upload 30-sec video ❌ (no storage handler)
3. Set budget: $500 (100 credits @ $5/credit) ❌
4. Target: Northeast region, Retail stores, Mon-Fri 9am-5pm ❌
5. Submit → Campaign goes to "Pending Admin Approval" ❌
6. See campaign in table with status "Pending" ❌
```

**Current Behavior**: Form submits but nothing happens (no API endpoint connected)

---

#### 2.2 Targeting & Inventory Search
**Priority**: 🔴 **CRITICAL**

**Missing**:
- ❌ **Browse available screens** (inventory marketplace)
- ❌ Filter by region, store type, price
- ❌ Forecast estimated impressions
- ❌ See screen availability calendar
- ❌ Price preview before booking

**Impact**: Brands cannot choose where their ads play

**Example UI Missing**:
```
Available Inventory:
┌─────────────────────────────────────────┐
│ Region: Northeast    Price: $0.05 CPM   │
│ ☐ Pizza Hut Times Square (3 screens)    │
│ ☐ Starbucks Union Square (2 screens)    │
│ ☐ Gym Downtown (1 screen)               │
│                                          │
│ Estimated reach: 50,000 impressions/week │
│ Total cost: $2,500 (500 credits)        │
└─────────────────────────────────────────┘
```

---

#### 2.3 Campaign Management
**Priority**: 🟡 **IMPORTANT**

**Missing**:
- ❌ Pause/resume campaign
- ❌ Edit campaign targeting
- ❌ Adjust budget mid-campaign
- ❌ Duplicate campaign
- ❌ Delete campaign

---

#### 2.4 Real-Time Campaign Performance
**Priority**: 🟡 **IMPORTANT**

**Missing**:
- ❌ Live impression counter
- ❌ Impressions by time of day
- ❌ Impressions by location
- ❌ Completion rate tracking
- ❌ Cost-per-impression actual vs budget
- ❌ Export reports to CSV/PDF

**Existing**: Campaign report page exists but shows static/empty data

---

#### 2.5 Credit Management
**Priority**: 🟡 **IMPORTANT**

**Missing**:
- ❌ Purchase more credits
- ❌ Credit transaction history
- ❌ Auto-recharge settings
- ❌ Credit expiration tracking
- ❌ Invoices/receipts

**Current**: Credits shown but no way to add more

---

## 3. RETAILER PERSONA

### What EXISTS ✅
- Login with auto-routing to `/retailer/dashboard`
- View 40% profit share rate
- Earnings display ($0.00)
- Screen status (online/offline)
- Impressions count
- Hamburger menu

### CRITICAL GAPS ❌

#### 3.1 Multi-Store Management
**Priority**: 🔴 **CRITICAL** (Blocker for chains)

**Missing**:
- ❌ **View all stores under chain** (if retailer is chain admin)
- ❌ Add new store location
- ❌ Assign screens to specific stores
- ❌ Per-store analytics
- ❌ Store hierarchy navigation

**Current Limitation**: User linked to single screen, not chain/stores

**Example for Pizza Hut Corporate**:
```
Pizza Hut Corporate Dashboard
├── Total Stores: 200
├── Total Screens: 450
├── Total Earnings: $12,450
│
└── Store List:
    ├── Times Square NYC (3 screens) - $500 this month
    ├── Downtown LA (2 screens) - $350 this month
    └── [... 198 more stores]
```

---

#### 3.2 Screen Registration & Management
**Priority**: 🔴 **CRITICAL**

**Missing**:
- ❌ **Register new screen** (currently seeded only)
- ❌ Assign screen to specific store/location
- ❌ Configure screen settings (name, location, display hours)
- ❌ Deactivate/remove screen
- ❌ Transfer screen between locations

**Impact**: Cannot add screens without developer intervention

---

#### 3.3 Earnings & Payout Management  
**Priority**: 🔴 **CRITICAL**

**Missing**:
- ❌ Detailed earnings breakdown
  - Earnings by campaign
  - Earnings by screen
  - Earnings by time period
- ❌ Payout request workflow
- ❌ Payment method configuration (bank account)
- ❌ Payout history
- ❌ Tax documentation (1099 generation)

**Current**: Shows "$0.00" with no transaction detail

---

#### 3.4 Ad Content Control
**Priority**: 🟡 **IMPORTANT**

**Missing**:
- ❌ **View pending ad approvals** (campaigns wanting to run on screens)
- ❌ Accept/reject specific campaigns
- ❌ Set content restrictions (no alcohol, politics, etc.)
- ❌ Competitor exclusions (Pizza Hut blocks Domino's ads)
- ❌ Preview ads before accepting

**Current**: All ads automatically play (no retailer control)

**Expected Workflow**:
```
Pending Ad Requests:
┌───────────────────────────────────────┐
│ Coca-Cola Holiday Campaign            │
│ Duration: 30s | Rate: $0.05 CPM       │
│ Est. Earnings: $150/week              │
│ [ACCEPT] [REJECT] [PREVIEW]           │
└───────────────────────────────────────┘
```

---

## Cross-Cutting Technical Gaps

### 4.1 Screen Playlist Logic
**Priority**: 🔴 **CRITICAL**

**Missing**:
- ❌ Dynamic playlist generation based on:
  - Approved campaigns for that screen
  - Campaign budgets/limits
  - Time-of-day targeting
  - Priority/bidding logic
- ❌ Fair rotation algorithm
- ❌ Fallback content when no ads available

**Current**: Player works but playlist is static/seeded

---

### 4.2 Impression Tracking & Attribution
**Priority**: 🔴 **CRITICAL**

**Missing**:
- ❌ Actual impression logging to database
- ❌ Deduct credits from brand budget
- ❌ Credit retailer earnings
- ❌ Campaign budget exhaustion detection
- ❌ Fraud prevention (duplicate impressions)

**Current**: Screen tracks impressions locally but doesn't persist or attribute

---

### 4.3 Payment Processing Integration
**Priority**: 🔴 **CRITICAL** (for real money)

**Missing**:
- ❌ Stripe integration for brands to buy credits
- ❌ Stripe Connect for retailer payouts
- ❌ Payment webhook handlers
- ❌ Failed payment retry logic
- ❌ Refund processing

---

### 4.4 Email Notification System
**Priority**: 🟡 **IMPORTANT**

**Missing**:
- ❌ Campaign approval notifications
- ❌ Low credit balance alerts
- ❌ Payout confirmation emails
- ❌ New campaign request notifications (to retailers)
- ❌ Screen offline alerts

---

### 4.5 Data Schema Gaps
**Priority**: 🔴 **CRITICAL**

**Missing Collections**:
- ❌ `retailer_chains` (corporate entities)
- ❌ `stores` (individual locations under chains)
- ❌ `advertiser_companies` (separate from users)
- ❌ `transactions` (financial ledger)
- ❌ `impressions` (with attribution)
- ❌ `screen_assignments` (screen → store → chain)

**Current**: Users directly linked to screens, no hierarchy

---

## Prioritized Development Roadmap

### PHASE 1: Multi-Tenant Foundation (2 weeks)
**Goal**: Support multiple brands and retailer chains

**Backend**:
1. Create database collections:
   - `advertiser_companies`
   - `retailer_chains`
   - `stores`
   - `screen_to_store_assignments`
2. Update user schema: `user.company_id` instead of `linked_entity_id`
3. Implement RBAC for multi-company access

**Frontend**:
1. Admin: "Add Brand Company" form
2. Admin: "Add Retailer Chain" → "Add Store" → "Register Screen" wizard
3. Admin: Company management dashboard

**Priority**: 🔴 **CRITICAL BLOCKER**

---

### PHASE 2: Campaign Creation End-to-End (1 week)
**Goal**: Brands can upload and launch campaigns

**Backend**:
1. Cloud Storage video upload handler
2. Campaign creation API with targeting
3. Credit deduction logic
4. Campaign status workflow (pending → approved → active)

**Frontend**:
1. Working campaign upload with progress bar
2. Targeting selector (regions, store types, schedule)
3. Budget allocation UI
4. Campaign activation confirmation

**Priority**: 🔴 **CRITICAL** (Core feature)

---

### PHASE 3: Screen Playlist & Impression Tracking (1 week)
**Goal**: Ads actually play and get tracked

**Backend**:
1. Dynamic playlist generation API
2. Impression logging to Firestore
3. Budget deduction on impression
4. Earnings credit to retailer

**Frontend**:
1. Player fetches dynamic playlist
2. Player posts impressions
3. Real-time dashboard updates

**Priority**: 🔴 **CRITICAL** (Core feature)

---

### PHASE 4: Retailer Multi-Store Management (1 week)
**Goal**: Retailer chains can manage multiple locations

**Backend**:
1. Store CRUD APIs
2. Screen registration API
3. Per-store analytics

**Frontend**:
1. Store list view
2. "Add Store" form
3. "Register Screen" QR code workflow
4. Store-level analytics dashboard

**Priority**: 🔴 **CRITICAL** (Scalability)

---

### PHASE 5: Financial Operations (2 weeks)
**Goal**: Real money flows through platform

**Backend**:
1. Stripe integration for credit purchases
2. Stripe Connect for retailer payouts
3. Transaction ledger
4. Earnings calculation engine

**Frontend**:
1. Brand: "Buy Credits" flow
2. Retailer: "Request Payout" flow
3. Admin: Financial overview dashboard

**Priority**: 🔴 **CRITICAL** (Revenue)

---

### PHASE 6: Campaign & Inventory Management (1 week)
**Goal**: Brands can refine targeting and see inventory

**Backend**:
1. Inventory availability API
2. Campaign pause/edit APIs
3. Impression forecasting

**Frontend**:
1. Inventory marketplace browser
2. Campaign management controls
3. Live analytics

**Priority**: 🟡 **IMPORTANT**

---

### PHASE 7: Content Moderation (1 week)
**Goal**: Safe, policy-compliant ads

**Backend**:
1. Campaign approval queue API
2. Content policy rules engine

**Frontend**:
1. Admin: Approval dashboard
2. Retailer: Ad acceptance workflow

**Priority**: 🟡 **IMPORTANT**

---

## Summary Matrix

| Feature Category | Status | Brand Impact | Retailer Impact | Admin Impact | Priority |
|------------------|--------|--------------|-----------------|--------------|----------|
| **Multi-Tenant Foundation** | ❌ 0% | 🔴 Blocker | 🔴 Blocker | 🔴 Blocker | P0 |
| **Campaign Upload** | 🟡 40% | 🔴 Blocker | - | - | P0 |
| **Playlist Generation** | ❌ 0% | 🔴 Blocker | 🔴 Blocker | - | P0 |
| **Impression Tracking** | ❌ 0% | 🔴 Blocker | 🔴 Blocker | - | P0 |
| **Multi-Store Mgmt** | ❌ 0% | - | 🔴 Blocker | 🔴 Blocker | P0 |
| **Payment Processing** | ❌ 0% | 🔴 Blocker | 🔴 Blocker | 🟡 Important | P0 |
| **Inventory Browse** | ❌ 0% | 🟡 Important | - | - | P1 |
| **Screen Registration** | ❌ 0% | - | 🔴 Blocker | 🟡 Important | P1 |
| **Campaign Analytics** | 🟡 30% | 🟡 Important | 🟡 Important | 🟡 Important | P1 |
| **Content Moderation** | ❌ 0% | - | 🟡 Important | 🟡 Important | P2 |
| **Email Notifications** | ❌ 0% | 🟢 Nice | 🟢 Nice | 🟢 Nice | P2 |

---

## Estimated Development Timeline

**Total**: 8-10 weeks for production-ready multi-tenant platform

- Phase 1 (Multi-Tenant): 2 weeks
- Phase 2 (Campaigns): 1 week  
- Phase 3 (Tracking): 1 week
- Phase 4 (Stores): 1 week
- Phase 5 (Payments): 2 weeks
- Phase 6 (Inventory): 1 week
- Phase 7 (Moderation): 1 week
- **Buffer**: 1-2 weeks

**MVP Definition** (Minimum for soft launch):
- Phases 1-5 complete (7 weeks)
- Skip Phases 6-7 initially (add later)
