# SoftoMedia Platform - Quick Test Guide

**Version**: 1.0 (Build 5625cd63)  
**Last Updated**: December 24, 2025  
**Status**: ✅ All Features Functional

---

## Platform URL

**Frontend**: [https://client-app-jjrrgubjxq-uc.a.run.app](https://client-app-jjrrgubjxq-uc.a.run.app)

---

## Test Accounts

| Role | Email | Password | Auto-Routes To |
|------|-------|----------|----------------|
| **Admin** | sokallel@gmail.com | thisisbusiness | Admin Dashboard |
| **Brand** | brand@demo.com | demo123 | Brand Dashboard |
| **Retailer** | retailer@demo.com | demo123 | Retailer Dashboard |

---

## Quick Test Scenarios

### 1️⃣ Admin User Test (2 minutes)

1. Login as Admin
2. ✅ **Verify**: Auto-redirects to `/dashboard`
3. Click hamburger menu (☰) top-right
4. ✅ **Verify**: See navigation options (Dashboard, Users, Screens, Logout)
5. Click "Users"
6. ✅ **Verify**: See user list with Invite button
7. Click "Screens"
8. ✅ **Verify**: See screen management with filters

**Success Criteria**: All pages load instantly, no "Loading..." states

---

### 2️⃣ Brand User Test (2 minutes)

1. Logout → Login as Brand
2. ✅ **Verify**: Auto-redirects to `/brand/dashboard`
3. ✅ **Verify**: See **"1,000"** ad credits displayed
4. ✅ **Verify**: See **"📤 Create Campaign"** button
5. ✅ **Verify**: See campaign stats (0 campaigns, 0 impressions)
6. Click "Create Campaign" button
7. ✅ **Verify**: Drawer slides open from right
8. Click hamburger menu (☰)
9. ✅ **Verify**: See Logout option

**Success Criteria**: Dashboard loads completely with all elements visible, NO "Loading..." anywhere

---

### 3️⃣ Retailer User Test (2 minutes)

1. Logout → Login as Retailer
2. ✅ **Verify**: Auto-redirects to `/retailer/dashboard`
3. ✅ **Verify**: See profit share rate: **"40%"**
4. ✅ **Verify**: See earnings: **"$0.00"** (no campaigns running yet)
5. ✅ **Verify**: See screen status indicator
6. ✅ **Verify**: See total impressions count
7. Click hamburger menu (☰)
8. ✅ **Verify**: Logout works

**Success Criteria**: All data loads instantly, earnings calculations visible

---

### 4️⃣ Screen Player Test (1 minute)

1. Open new tab: [https://client-app-jjrrgubjxq-uc.a.run.app/screen/demo-screen-01](https://client-app-jjrrgubjxq-uc.a.run.app/screen/demo-screen-01)
2. ✅ **Verify**: Fullscreen ad player loads
3. ✅ **Verify**: Ads cycle automatically every 5 seconds
4. ✅ **Verify**: See 5 unique ad images (Coffee, Tech, Travel, Costco, Pizza)
5. Watch for 30 seconds
6. ✅ **Verify**: Smooth transitions, no errors

**Success Criteria**: Player runs continuously without interruption

---

## Key Features Demonstrated

✅ **Role-Based Routing** - Each user type automatically goes to correct dashboard  
✅ **Authentication** - Secure login with JWT tokens  
✅ **Navigation** - Hamburger menu works across all pages  
✅ **Real-Time Status** - Screen online/offline detection  
✅ **Profit Sharing** - Retailer earnings calculation (40% rate)  
✅ **Ad Credits** - Brand account balance (1000 credits)  
✅ **Campaign UI** - Ready for upload (drawer opens)  
✅ **Screen Player** - Fullscreen ad rotation working

---

## What to Expect

**Working** ✅:
- Login & authentication
- Role-based dashboards
- User management
- Screen management
- Navigation menus
- Ad player with rotation

**Not Yet Built** ⏳:
- Campaign upload (UI ready, backend pending)
- Live campaign analytics
- Payment processing
- Multi-store management
- Screen registration

---

## Report Issues

If you encounter any problems, please note:
- Which user role you were logged in as
- What action you were trying to perform
- Screenshot if possible

**Expected Behavior**: All dashboards load instantly with NO "Loading..." states

---

## Technical Details

- **Frontend**: React SPA on Cloud Run
- **Backend**: Node.js API on Cloud Run  
- **Database**: Firestore
- **Auth**: JWT with bcrypt
- **Build**: 5625cd63-45c2-4e14-9248-f93bb827c593

---

**Total Test Time**: ~7 minutes  
**Pass Criteria**: All ✅ checkmarks verified, no loading states or errors
