# Backend Architecture Plan: Projects 2, 3, 4
**Phase 2: Back-Office Dashboard Experience**

---

## Executive Summary

This plan outlines the complete backend infrastructure required to support the frontend components built in Projects 1, 2, and 3. The current backend has basic authentication and screen/ad management, but lacks user management, campaign workflows, retailer-specific APIs, and advanced reporting.

---

## Current Backend State

### ✅ What Exists

#### API Endpoints
- `POST /api/auth/login` - JWT-based login
- `GET /api/screens` - List all screens
- `POST /api/screens/register` - Screen registration/heartbeat
- `POST /api/screens/:screenId/impressions` - Record ad plays
- `GET /api/ads` - List all ads with signed URLs
- `GET /api/playlist/:screenId` - Get screen playlist
- `GET /api/debug/seed` - Demo data seeding

#### Firestore Collections
- `users` - Basic user accounts (admin only)
- `screens` - Screen metadata and stats
- `screens/{screenId}/impressions` - Impression tracking (subcollection)
- `ads` - Advertisement content
- `advertisers` - Advertiser profiles
- `screen_approvals` - Which ads approved for which screens
- `campaigns` - Campaign metadata (partial)

#### Security Rules
- Role-based access (`admin`, `advertiser` roles)
- Owner-based permissions for screens/campaigns
- Basic authentication checks

#### Authentication
- JWT tokens with 24h expiration
- bcrypt password hashing
- Admin bootstrap on startup

---

## Missing Components Analysis

### 🔴 Critical Gaps

1. **User Management System** (State 17)
   - No user creation/invitation API
   - No role assignment system
   - Missing `retailers` and `brands` role types
   - No email invitation workflow

2. **Campaign Management** (States 7, 8, 12)
   - No campaign creation endpoint
   - No video upload handling
   - No campaign-to-screen assignment
   - No campaign reporting aggregation

3. **Retailer Dashboard APIs** (State 10)
   - No retailer-specific data endpoint
   - No earnings calculation
   - No simplified status check

4. **Brand Dashboard APIs** (State 5)
   - No brand-specific campaign data
   - No location mapping data
   - No budget tracking

5. **Screen Management** (State 7)
   - No filtering/search endpoint
   - No bulk operations
   - No detailed screen diagnostics

6. **Alert System Backend** (State 9)
   - No real-time notification infrastructure
   - No offline detection logic
   - No WebSocket/SSE support

---

## Database Architecture

### New Collections Needed

#### `retailers`
```javascript
{
  id: "retailer_001",
  owner_user_id: "user_123",        // Links to users collection
  business_name: "Pizza Hut Downtown",
  contact_person: "John Smith",
  email: "john@pizzahut.com",
  phone: "+1234567890",
  address: {
    street: "123 Main St",
    city: "New York",
    state: "NY",
    zip: "10001",
    country: "USA"
  },
  screens_deployed: 3,              // Denormalized count
  status: "active",                 // active | pending | suspended
  created_at: "2025-12-23T...",
  updated_at: "2025-12-23T..."
}
```

#### `brands`
```javascript
{
  id: "brand_001",
  owner_user_id: "user_456",        // Links to users collection
  company_name: "Coca-Cola Company",
  contact_person: "Emily Davis",
  email: "emily@cocacola.com",
  phone: "+1987654321",
  billing_address: {...},
  tax_id: "EIN-123456789",
  active_campaigns: 5,              // Denormalized count
  total_budget: 50000.00,
  spent_to_date: 12450.50,
  status: "active",
  created_at: "2025-12-23T...",
  updated_at: "2025-12-23T..."
}
```

#### Enhanced `campaigns`
```javascript
{
  id: "campaign_001",
  brand_id: "brand_001",
  name: "Holiday Sale 2025",
  description: "Q4 promotional campaign",
  video_storage_path: "campaigns/brand_001/video_xyz.mp4",
  thumbnail_url: "...",
  duration_seconds: 30,
  start_date: "2025-12-01",
  end_date: "2025-12-31",
  target_screens: ["screen1", "screen2"],  // Array of screen IDs
  budget: 10000.00,
  spent: 5420.50,
  status: "active",                // draft | active | paused | completed
  total_impressions: 24567,        // Aggregated from impressions
  avg_cpm: 22.06,
  completion_rate: 98.5,
  created_at: "2025-12-23T...",
  updated_at: "2025-12-23T..."
}
```

#### `invitations`
```javascript
{
  id: "invite_001",
  email: "newuser@example.com",
  role: "retailer",                // retailer | brand | admin
  invited_by_user_id: "admin_001",
  metadata: {
    business_name: "Target Store #543",
    contact_name: "Mike Chen"
  },
  token: "secure_random_token",
  status: "pending",               // pending | accepted | expired
  expires_at: "2025-12-30T...",
  created_at: "2025-12-23T...",
  accepted_at: null
}
```

#### `earnings`
```javascript
{
  id: "earnings_001",
  retailer_id: "retailer_001",
  screen_id: "screen1",
  month: "2025-12",
  impressions: 8945,
  revenue: 1876.32,
  rate_per_impression: 0.21,       // $ per impression
  calculated_at: "2025-12-23T...",
  status: "pending_payment"        // pending_payment | paid
}
```

#### `screen_locations` (for map visualization)
```javascript
{
  id: "location_001",
  screen_id: "screen1",
  retailer_id: "retailer_001",
  name: "Downtown Plaza",
  coordinates: {
    lat: 40.7128,
    lng: -74.0060
  },
  address: {...},
  active: true,
  updated_at: "2025-12-23T..."
}
```

### Enhanced Existing Collections

#### `users` (expanded roles)
```javascript
{
  id: "user_123",
  email: "john@example.com",
  password_hash: "bcrypt_hash",
  role: "retailer",                // admin | brand | retailer
  linked_entity_id: "retailer_001", // References retailers/brands collection
  name: "John Smith",
  status: "active",                // active | invited | suspended
  created_at: "2025-12-23T...",
  last_login: "2025-12-23T..."
}
```

#### `screens` (enhanced metadata)
```javascript
{
  screen_id: "screen1",
  retailer_id: "retailer_001",
  location_id: "location_001",     // Links to screen_locations
  status: "active",                // active | offline | pending
  last_seen: "2025-12-23T15:30:00",
  last_heartbeat: "2025-12-23T15:30:00",
  resolution: "1920x1080",
  user_agent: "Chrome/120...",
  current_playlist: [...],
  stats: {
    total_impressions: 4523,
    total_play_time: 55200,        // seconds
    uptime_percentage: 99.8,
    last_updated: "2025-12-23T..."
  },
  diagnostics: {
    wifi_strength: -45,            // dBm
    cpu_usage: 12.5,               // %
    memory_usage: 45.2,            // %
    disk_space: 23.5               // GB free
  },
  created_at: "2025-12-01T...",
  updated_at: "2025-12-23T..."
}
```

---

## API Endpoints Implementation Plan

### Priority 1: User Management (State 17)

#### `POST /api/users/invite`
**Purpose**: Send email invitation to new user (retailer/brand/admin)

**Auth Required**: Admin only

**Request Body**:
```json
{
  "email": "newuser@example.com",
  "role": "retailer",
  "name": "Mike Chen",
  "business_name": "Target Store #543"
}
```

**Response**:
```json
{
  "invitation_id": "invite_001",
  "email_sent": true,
  "expires_at": "2025-12-30T..."
}
```

**Implementation**:
- Generate secure random token
- Create invitation doc in Firestore
- Send email via SendGrid/Mailgun (TODO: integrate)
- Set 7-day expiration

---

#### `POST /api/users/accept-invitation`
**Purpose**: New user accepts invitation and sets password

**Auth Required**: No (uses invitation token)

**Request Body**:
```json
{
  "token": "secure_random_token",
  "password": "newpassword123",
  "name": "Mike Chen"
}
```

**Response**:
```json
{
  "user_id": "user_789",
  "role": "retailer",
  "token": "jwt_token_here"
}
```

**Implementation**:
- Validate invitation token not expired
- Create user in `users` collection
- Create linked entity (retailer/brand)
- Return JWT for immediate login

---

#### `GET /api/users`
**Purpose**: List all users with filtering by role

**Auth Required**: Admin only

**Query Params**: `?role=retailer&status=active`

**Response**:
```json
{
  "users": [
    {
      "id": "user_123",
      "email": "john@example.com",
      "role": "retailer",
      "name": "John Smith",
      "business_name": "Pizza Hut Downtown",
      "screens_deployed": 3,
      "status": "active",
      "created_at": "..."
    }
  ],
  "total": 25
}
```

---

### Priority 2: Campaign Management (States 7, 8, 12)

#### `POST /api/campaigns/create`
**Purpose**: Upload new campaign video and create campaign

**Auth Required**: Brand users

**Request**: `multipart/form-data`
```
video: <video file>
name: "Holiday Sale 2025"
duration: 30
target_screens: ["screen1", "screen2"]
budget: 10000
```

**Implementation**:
- Upload video to Cloud Storage bucket
- Generate thumbnail from first frame (ffmpeg/sharp)
- Create campaign doc in Firestore
- Associate with brand via JWT user_id
- Return signed URLs

---

#### `GET /api/campaigns/:id/report`
**Purpose**: Get finalized campaign report (State 12)

**Auth Required**: Brand owner or Admin

**Response**:
```json
{
  "id": "campaign_001",
  "name": "Holiday Sale Campaign",
  "start_date": "2025-12-01",
  "end_date": "2025-12-23",
  "status": "completed",
  "summary": {
    "total_spend": 5420.50,
    "verified_plays": 24567,
    "cpm": 22.06,
    "completion_rate": 98.5
  },
  "performance_by_location": [
    {
      "location": "Downtown Plaza",
      "impressions": 8945,
      "spent": 1876.32
    }
  ],
  "heatmap_data": [...]
}
```

**Implementation**:
- Aggregate impressions from subcollections
- Calculate CPM, completion rate
- Group by screen_location
- Generate heatmap coordinates

---

#### `GET /api/dashboard/brand/:brand_id`
**Purpose**: Brand dashboard data (State 5)

**Auth Required**: Brand owner or Admin

**Response**:
```json
{
  "total_impressions": 24567,
  "active_screens": 8,
  "remaining_budget": 12450,
  "screen_locations": [
    {
      "name": "Downtown Plaza",
      "coordinates": { "lat": 40.7128, "lng": -74.0060 },
      "status": "active",
      "impressions": 8945
    }
  ],
  "campaigns": [
    {
      "id": "campaign_001",
      "name": "Holiday Sale",
      "impressions": 12345,
      "status": "active"
    }
  ]
}
```

---

### Priority 3: Screen Management (State 7)

#### `GET /api/screens/management`
**Purpose**: Enhanced screen list with filtering and search

**Auth Required**: Admin

**Query Params**: 
- `?status=active`
- `?search=downtown`
- `?sort=last_seen`
- `?order=desc`

**Response**:
```json
{
  "screens": [
    {
      "screen_id": "screen1",
      "location": "Downtown Plaza",
      "retailer": "Pizza Hut Downtown",
      "status": "active",
      "last_heartbeat": "2m ago",
      "stats": {
        "impressions": 4523,
        "play_time": "15h 20m",
        "uptime": "99.8%"
      }
    }
  ],
  "total": 8,
  "filtered": 6
}
```

---

#### `GET /api/screens/:screenId/diagnostics`
**Purpose**: Detailed screen health for troubleshooting (State 18)

**Auth Required**: Retailer owner or Admin

**Response**:
```json
{
  "screen_id": "screen1",
  "status": "offline",
  "last_heartbeat": "2025-12-23T13:15:00",
  "time_since_heartbeat": "2h 15m",
  "diagnostics": {
    "wifi_strength": -75,
    "connection_quality": "weak",
    "suggested_actions": [
      "check_wifi",
      "restart_router",
      "contact_support"
    ]
  },
  "recent_errors": [
    {
      "timestamp": "2025-12-23T13:10:00",
      "error": "Connection timeout",
      "severity": "error"
    }
  ]
}
```

---

### Priority 4: Retailer Experience (State 10)

#### `GET /api/dashboard/retailer/:retailer_id`
**Purpose**: Simplified retailer concierge view

**Auth Required**: Retailer owner or Admin

**Response**:
```json
{
  "system_status": "online",
  "screen": {
    "screen_id": "screen1",
    "location": "Downtown Store",
    "uptime": 99.8
  },
  "earnings": {
    "current_month": 1245.50,
    "last_month": 1123.75,
    "total": 14567.25
  }
}
```

---

### Priority 5: Real-Time Alerts (State 9)

#### WebSocket Implementation
**Endpoint**: `ws://api-url/ws/alerts`

**Auth**: JWT token in query param

**Events**:
```json
{
  "type": "screen_offline",
  "data": {
    "screen_id": "screen3",
    "location": "Airport Terminal",
    "last_seen": "2025-12-23T10:42:00"
  }
}
```

**Implementation Options**:
1. **Firebase Cloud Messaging** (Recommended for MVP)
2. **WebSocket with Socket.io**
3. **Server-Sent Events (SSE)**

**Trigger Logic**:
- Cloud Function triggered every 5 minutes
- Check all screens `last_seen > 10 minutes ago`
- Send notification to relevant users

---

## Permissions & Security

### Role-Based Access Control (RBAC)

#### Middleware: `requireRole(roles)`
```javascript
function requireRole(allowedRoles) {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (!allowedRoles.includes(decoded.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    req.user = decoded;
    next();
  };
}
```

#### Middleware: `requireOwnership(entityType)`
```javascript
function requireOwnership(entityType) {
  return async (req, res, next) => {
    // Check if user owns the resource
    // e.g., brand owns campaign, retailer owns screen
  };
}
```

### Updated Firestore Rules

```javascript
// Enhanced rules for new collections
match /retailers/{retailerId} {
  allow read: if isOwner(resource.data.owner_user_id) || hasRole('admin');
  allow write: if hasRole('admin');
}

match /brands/{brandId} {
  allow read: if isOwner(resource.data.owner_user_id) || hasRole('admin');
  allow write: if hasRole('admin');
  allow update: if isOwner(resource.data.owner_user_id); // Can update own profile
}

match /campaigns/{campaignId} {
  allow read: if isOwner(resource.data.brand_id) || hasRole('admin');
  allow create: if hasRole('brand');
  allow update, delete: if isOwner(resource.data.brand_id) || hasRole('admin');
}

match /invitations/{inviteId} {
  allow read: if resource.data.email == request.auth.token.email || hasRole('admin');
  allow create: if hasRole('admin');
}

match /earnings/{earningId} {
  allow read: if isOwner(resource.data.retailer_id) || hasRole('admin');
  allow write: if hasRole('admin'); // Only system writes earnings
}
```

---

## Implementation Priority

### Phase 1: Foundation (Week 1)
- [ ] Enhance `users` collection schema
- [ ] Create `retailers` and `brands` collections
- [ ] Implement user invitation API
- [ ] Add role-based middleware
- [ ] Update Firestore security rules

### Phase 2: Campaign System (Week 2)
- [ ] Implement video upload endpoint
- [ ] Create campaigns CRUD endpoints
- [ ] Build campaign reporting aggregation
- [ ] Add screen-to-campaign assignment

### Phase 3: Dashboard APIs (Week 3)
- [ ] Brand dashboard endpoint
- [ ] Retailer dashboard endpoint
- [ ] Screen management filtering
- [ ] Earnings calculation logic

### Phase 4: Real-Time & Polish (Week 4)
- [ ] WebSocket/FCM alerts
- [ ] Screen diagnostics endpoint
- [ ] Email invitation integration
- [ ] Performance optimization

---

## Technology Stack Recommendations

### Email Service
**Recommendation**: SendGrid or AWS SES
- Transactional email for invitations
- Template support for branded emails
- Delivery tracking

### File Upload
**Current**: Cloud Storage (already configured)
- Continue using signed URLs
- Add video transcoding with Cloud Functions
- Thumbnail generation with ffmpeg

### Real-Time Alerts
**Recommendation**: Firebase Cloud Messaging
- Already integrated with Firebase
- Works across web and mobile
- Push notification support

### Monitoring
**Add**: Cloud Logging + Sentry
- Error tracking for API failures
- Performance monitoring
- Alert notifications for critical errors

---

## Database Indexes

Create composite indexes for performance:

```javascript
// screens collection
screen_id + status
retailer_id + status
last_seen (descending)

// campaigns collection
brand_id + status
status + end_date

// impressions subcollection
timestamp (descending)
ad_id + timestamp
```

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Prioritize endpoints** based on frontend dependencies
3. **Set up development environment** for backend work
4. **Create API testing suite** (Postman/Jest)
5. **Begin Phase 1 implementation**

---

## Open Questions

> [!IMPORTANT]
> **Decisions Needed**:
> 
> 1. **Email Provider**: SendGrid vs AWS SES vs Mailgun?
> 2. **Real-time**: WebSocket vs FCM vs SSE?
> 3. **Video Processing**: Cloud Functions vs third-party service?
> 4. **Payment Integration**: Stripe for retailer payouts?
> 5. **Rate Limiting**: Implement API rate limits per user role?

---

**Status**: Ready for review and implementation prioritization
