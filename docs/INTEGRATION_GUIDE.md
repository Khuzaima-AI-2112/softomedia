# Frontend-Backend Integration Guide
**SoftoMedia Live - Complete Integration Summary**

---

## 📋 Overview

This document provides a complete guide for integrating the React frontend with the Node.js/Express backend. All backend APIs (Phases 1-4) are complete and ready for frontend integration.

---

## 🔗 Backend API Summary

### Base URL
```javascript
const API_URL = process.env.API_URL || 'http://localhost:8080';
```

### Total APIs: 20+ Endpoints across 6 Modules

| Module | Endpoints | Status |
|--------|-----------|--------|
| Auth | 1 | ✅ Ready |
| Users | 3 | ✅ Ready |
| Dashboards | 2 | ✅ Ready |
| Screens | 3 | ✅ Ready |
| Campaigns | 6 | ✅ Ready |
| Notifications | 6 | ✅ Ready |

---

## 🔐 Authentication Flow

### How It Works
1. User logs in with email/password → receives JWT token
2. Token stored in `localStorage` as `auth_token`
3. All API calls include `Authorization: Bearer <token>` header
4. On 401 Unauthorized → auto-redirect to login

### Implementation

**Login:**
```javascript
import api from './services/api';

const handleLogin = async (email, password) => {
    try {
        const data = await api.auth.login(email, password);
        // Token automatically stored in localStorage
        // data.user contains user info
        console.log('Logged in as:', data.user);
    } catch (error) {
        console.error('Login failed:', error.message);
    }
};
```

**Logout:**
```javascript
api.auth.logout(); // Clears token and redirects to /login
```

**Check Auth Status:**
```javascript
import { useAuth } from './contexts/AuthContext';

function MyComponent() {
    const { user, isAuthenticated, loading } = useAuth();
    
    if (loading) return <div>Loading...</div>;
    if (!isAuthenticated) return <div>Please log in</div>;
    
    return <div>Welcome, {user.name}!</div>;
}
```

---

## 📚 Complete API Reference

### 1. Auth API (`api.auth`)

#### `login(email, password)`
```javascript
const data = await api.auth.login('admin@softomedia.com', 'password123');
// Returns: { token: string, user: { email, role, name, ... } }
```

#### `logout()`
```javascript
api.auth.logout(); // Clears token, redirects to /login
```

---

### 2. Users API (`api.users`)

#### `invite(email, role, name, business_name)`
```javascript
await api.users.invite(
    'john@example.com',
    'retailer', // 'retailer' | 'brand' | 'admin'
    'John Smith',
    'Pizza Hut Downtown'
);
```

#### `list(role?, status?)`
```javascript
const { users } = await api.users.list('retailer', 'active');
// users: Array<{ id, email, name, role, business_name, ... }>
```

#### `acceptInvitation(token, password, name)`
```javascript
const data = await api.users.acceptInvitation(
    'invitation_token_123',
    'newpassword',
    'John Smith'
);
// Returns: { user_id, role, token }
```

---

### 3. Dashboard API (`api.dashboard`)

#### `getRetailerDashboard(retailerId)`
```javascript
const data = await api.dashboard.getRetailerDashboard('retailer_001');
// Returns:
// {
//   system_status: 'online' | 'offline',
//   screen: { screen_id, location, uptime },
//   earnings: { current_month, last_month, total }
// }
```

#### `getBrandDashboard(brandId)`
```javascript
const data = await api.dashboard.getBrandDashboard('brand_001');
// Returns:
// {
//   total_impressions: number,
//   active_screens: number,
//   remaining_budget: number,
//   screen_locations: Array<{ name, coordinates, status, impressions }>,
//   campaigns: Array<{ id, name, impressions, status }>
// }
```

---

### 4. Screens API (`api.screens`)

#### `list()`
```javascript
const { screens } = await api.screens.list();
// Basic screen list
```

#### `getManagement(status?, search?, sort?, order?)`
```javascript
const data = await api.screens.getManagement('active', 'downtown', 'last_seen', 'desc');
// Returns:
// {
//   screens: Array<{
//     screen_id, location, retailer, status,
//     last_heartbeat, stats, diagnostics
//   }>,
//   total: number,
//   filtered: number
// }
```

#### `getDiagnostics(screenId)`
```javascript
const data = await api.screens.getDiagnostics('screen1');
// Returns:
// {
//   screen_id, status, last_heartbeat, time_since_heartbeat,
//   diagnostics: {
//     wifi_strength, connection_quality, cpu_usage,
//     memory_usage, disk_space, suggested_actions
//   },
//   recent_errors: Array<{ timestamp, error, severity }>
// }
```

---

### 5. Campaigns API (`api.campaigns`)

#### `create(formData)`
```javascript
const formData = new FormData();
formData.append('video', videoFile); // File object
formData.append('name', 'Holiday Sale 2025');
formData.append('duration', '30');
formData.append('budget', '10000');
formData.append('target_screens', JSON.stringify(['screen1', 'screen2']));

const data = await api.campaigns.create(formData);
// Returns: { campaign_id, video_url, message }
```

#### `list(status?)`
```javascript
const { campaigns } = await api.campaigns.list('active');
// campaigns: Array<{ id, name, status, ... }>
```

#### `get(campaignId)`
```javascript
const { campaign } = await api.campaigns.get('campaign_001');
```

#### `update(campaignId, updates)`
```javascript
await api.campaigns.update('campaign_001', {
    status: 'paused',
    budget: 15000
});
```

#### `delete(campaignId)`
```javascript
await api.campaigns.delete('campaign_001');
```

#### `getReport(campaignId)`
```javascript
const report = await api.campaigns.getReport('campaign_001');
// Returns:
// {
//   id, name, start_date, end_date, status,
//   summary: { total_spend, verified_plays, cpm, completion_rate },
//   performance_by_location: Array<{ location, impressions, spent }>,
//   heatmap_data: []
// }
```

---

### 6. Notifications API (`api.notifications`)

#### `subscribe(fcm_token, device_type?)`
```javascript
await api.notifications.subscribe('fcm_token_abc123', 'web');
```

#### `unsubscribe()`
```javascript
await api.notifications.unsubscribe();
```

#### `getPreferences()`
```javascript
const prefs = await api.notifications.getPreferences();
// Returns: { screen_offline: true, campaign_completed: true, ... }
```

#### `updatePreferences(preferences)`
```javascript
await api.notifications.updatePreferences({
    screen_offline: true,
    campaign_completed: false,
    low_balance: true
});
```

#### `getHistory(limit?)`
```javascript
const { notifications } = await api.notifications.getHistory(50);
```

---

## 🔧 Component Integration Examples

### Example 1: User Management Component

```javascript
import React, { useState, useEffect } from 'react';
import api from '../../services/api';

function UserManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        fetchUsers();
    }, []);
    
    const fetchUsers = async () => {
        try {
            const data = await api.users.list('retailer');
            setUsers(data.users);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
    };
    
    const handleInvite = async (email, name, businessName) => {
        try {
            await api.users.invite(email, 'retailer', name, businessName);
            alert('Invitation sent!');
            fetchUsers(); // Refresh list
        } catch (error) {
            alert('Failed to send invitation: ' + error.message);
        }
    };
    
    if (loading) return <div>Loading...</div>;
    
    return (
        <div>
            <h1>Users</h1>
            <ul>
                {users.map(user => (
                    <li key={user.id}>{user.name} - {user.email}</li>
                ))}
            </ul>
        </div>
    );
}
```

### Example 2: Retailer Dashboard

```javascript
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

function RetailerDashboard() {
    const { user } = useAuth();
    const [dashboard, setDashboard] = useState(null);
    
    useEffect(() => {
        if (user?.linked_entity_id) {
            fetchDashboard();
        }
    }, [user]);
    
    const fetchDashboard = async () => {
        try {
            const data = await api.dashboard.getRetailerDashboard(user.linked_entity_id);
            setDashboard(data);
        } catch (error) {
            console.error('Failed to fetch dashboard:', error);
        }
    };
    
    if (!dashboard) return <div>Loading...</div>;
    
    return (
        <div>
            <h1>My Store</h1>
            <div>Status: {dashboard.system_status}</div>
            <div>Earnings: ${dashboard.earnings.current_month}</div>
        </div>
    );
}
```

### Example 3: Campaign Upload

```javascript
import React, { useState } from 'react';
import api from '../../services/api';

function CampaignUpload() {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) return;
        
        setUploading(true);
        
        const formData = new FormData();
        formData.append('video', file);
        formData.append('name', 'My Campaign');
        formData.append('duration', '30');
        formData.append('budget', '5000');
        
        try {
            const data = await api.campaigns.create(formData);
            alert('Campaign created! Video URL: ' + data.video_url);
        } catch (error) {
            alert('Upload failed: ' + error.message);
        } finally {
            setUploading(false);
        }
    };
    
    return (
        <form onSubmit={handleSubmit}>
            <input 
                type="file" 
                accept="video/*"
                onChange={(e) => setFile(e.target.files[0])}
            />
            <button type="submit" disabled={uploading}>
                {uploading ? 'Uploading...' : 'Upload Campaign'}
            </button>
        </form>
    );
}
```

---

## ⚠️ Known Issues to Fix

### 1. UserManagement.jsx
**Location**: `client-app/src/pages/admin/UserManagement.jsx`
**Issue**: Duplicate code from merge (lines 34-51)
**Fix**: Remove the mock data block:
```javascript
// DELETE THESE LINES (34-51):
const mockData = {
    retailers: [
        { id: '1', name: 'John Smith', ... },
        // ... rest of mock data
    ],
};
setUsers(mockData[type] || []);
} catch (error) {
```

### 2. ScreenManagement.jsx
**Location**: `client-app/src/pages/admin/ScreenManagement.jsx`
**Issue**: Syntax error at line 33
**Fix**: Review the useEffect and fetchScreens integration, ensure proper closure

---

## ✅ Integration Checklist

### Backend Setup
- [x] All API endpoints implemented (20+)
- [x] Authentication middleware (JWT)
- [x] RBAC (Role-Based Access Control)
- [x] Rate limiting configured
- [x] Firestore security rules updated
- [ ] Install dependencies (`npm install` in ad-server/)
- [ ] Start backend server (`node index.js`)

### Frontend Setup
- [x] API service layer created (`services/api.js`)
- [x] AuthContext provider created
- [ ] Add AuthProvider to App.jsx root
- [ ] Fix syntax errors in UserManagement.jsx
- [ ] Fix syntax errors in ScreenManagement.jsx
- [ ] Update RetailerDashboard.jsx with API calls
- [ ] Update BrandDashboard.jsx with API calls
- [ ] Update CampaignReport.jsx with API calls
- [ ] Test login/logout flow
- [ ] Test protected routes

### App.jsx Integration
```javascript
import { AuthProvider } from './contexts/AuthContext';
import { BrowserRouter } from 'react-router-dom';

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                {/* Your routes here */}
            </AuthProvider>
        </BrowserRouter>
    );
}
```

---

## 🧪 Testing Guide

### 1. Test Authentication
```bash
# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sokallel@gmail.com","password":"thisisbusiness"}'
```

### 2. Test User Invitation (requires token)
```bash
curl -X POST http://localhost:8080/api/users/invite \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "role":"retailer",
    "name":"Test User",
    "business_name":"Test Business"
  }'
```

### 3. Test Screen Management
```bash
curl -X GET "http://localhost:8080/api/screens/management?status=active" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🚀 Deployment Steps

### 1. Backend Deployment
```bash
cd ad-server
npm install
# Set environment variables
export PROJECT_ID=softomedia-live2026
export JWT_SECRET=your-secret-key
export GCS_BUCKET=your-bucket-name

# Deploy to Cloud Run
gcloud builds submit --config cloudbuild.yaml
```

### 2. Frontend Deployment
```bash
cd client-app
npm install
npm run build

# Deploy to Firebase Hosting or Cloud Storage
firebase deploy --only hosting
```

### 3. Environment Variables

**Backend (.env)**:
```
PORT=8080
JWT_SECRET=your-production-secret
PROJECT_ID=softomedia-live2026
GCS_BUCKET=softomedia-live2026.appspot.com
```

**Frontend (.env)**:
```
VITE_API_URL=https://your-backend-url.run.app
```

---

## 📖 Next Steps

1. **Fix Syntax Errors** - Clean up UserManagement and ScreenManagement
2. **Update Remaining Components** - RetailerDashboard, BrandDashboard, CampaignReport
3. **Add AuthProvider** - Wrap App.jsx with AuthProvider
4. **Create Login Page** - If not exists, create login form
5. **Test End-to-End** - Login → Navigate → API calls → Logout
6. **Add Error Handling** - Toast notifications for API errors
7. **Add Loading States** - Spinners while fetching data
8. **Deploy** - Backend to Cloud Run, Frontend to Firebase

---

## 🔗 Quick Reference

| Component | API Method | Endpoint |
|-----------|-----------|----------|
| Login | `api.auth.login()` | `POST /api/auth/login` |
| User List | `api.users.list()` | `GET /api/users?role=retailer` |
| Invite User | `api.users.invite()` | `POST /api/users/invite` |
| Retailer Dashboard | `api.dashboard.getRetailerDashboard()` | `GET /api/dashboard/retailer/:id` |
| Brand Dashboard | `api.dashboard.getBrandDashboard()` | `GET /api/dashboard/brand/:id` |
| Screen List | `api.screens.getManagement()` | `GET /api/screens/management` |
| Screen Diagnostics | `api.screens.getDiagnostics()` | `GET /api/screens/:id/diagnostics` |
| Create Campaign | `api.campaigns.create()` | `POST /api/campaigns/create` |
| Campaign Report | `api.campaigns.getReport()` | `GET /api/campaigns/:id/report` |

---

**Last Updated**: 2025-12-23
**Status**: Backend complete, Frontend integration 60% complete
