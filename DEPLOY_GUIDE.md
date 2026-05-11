# SoftoMedia Live - Cloud Build Deployment Guide

## 🚨 Critical Lessons from Previous Deployment (Dec 22, 2025)

### What Went Wrong
1. **Cloud Build Silent Failure**: Build steps succeeded but deployment steps never executed
2. **Hardcoded URLs**: Frontend components had different backend URLs causing "split brain"
3. **Missing Infrastructure**: Firestore API not enabled, database not created
4. **Premature Service Deletion**: Accidentally deleted active backend thinking it was old

### What We Fixed
✅ Updated `cloudbuild.yaml` with explicit step ordering (`waitFor`) and IDs  
✅ Centralized API URL in `client-app/src/config.js`  
✅ Added backend URL injection during frontend build  
✅ Created separate cloudbuild files for backend/frontend  

---

## Prerequisites

### 1. Required Tools
```powershell
# Verify installations
gcloud --version
node --version
```

### 2. Project Setup
```powershell
# Set active project
gcloud config set project softomedia-live2026

# Verify current project
gcloud config get-value project
```

### 3. Enable Required APIs
```powershell
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### 4. Create Infrastructure
```powershell
# Create Firestore database
gcloud firestore databases create --region=us-central1

# Verify database exists
gcloud firestore databases list
```

### 5. Create JWT Secret
```powershell
# Generate secure JWT secret
$JwtSecret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Store in Secret Manager
echo $JwtSecret | gcloud secrets create jwt-secret --data-file=-

# Grant Cloud Run access to secret
gcloud secrets add-iam-policy-binding jwt-secret `
  --member=serviceAccount:779405254912-compute@developer.gserviceaccount.com `
  --role=roles/secretmanager.secretAccessor

# Save for future reference
Write-Host "⚠️  SAVE THIS JWT SECRET: $JwtSecret"
```

---

## Deployment Options

### Option 1: Full Stack Deployment (Recommended)

Deploy both backend and frontend in one command:

```powershell
cd c:\Users\ChrisFro\Desktop\EmoGini\softomediaLIVE
gcloud builds submit --config cloudbuild.yaml .
```

**What This Does:**
1. Builds backend Docker image
2. Deploys backend to Cloud Run with environment variables
3. Captures backend URL
4. Injects backend URL into frontend `.env.production`
5. Builds frontend Docker image
6. Deploys frontend to Cloud Run
7. Displays deployment summary

**Expected Output:**
```
🚀 FULL STACK DEPLOYMENT COMPLETE!
==========================================
📱 Frontend: https://client-app-779405254912.us-central1.run.app
🔧 Backend:  https://ad-server-779405254912.us-central1.run.app
📊 Project:  softomedia-live2026
🌎 Region:   us-central1
```

### Option 2: Backend Only

```powershell
cd c:\Users\ChrisFro\Desktop\EmoGini\softomediaLIVE\ad-server
gcloud builds submit --config cloudbuild.yaml .
```

### Option 3: Frontend Only (After Backend is Deployed)

```powershell
cd c:\Users\ChrisFro\Desktop\EmoGini\softomediaLIVE\client-app
gcloud builds submit --config cloudbuild.yaml .
```

---

## Post-Deployment Steps

### 1. Verify Services are Running
```powershell
gcloud run services list --region=us-central1
```

### 2. Get Service URLs
```powershell
$BACKEND_URL = gcloud run services describe ad-server --region=us-central1 --format="value(status.url)"
$FRONTEND_URL = gcloud run services describe client-app --region=us-central1 --format="value(status.url)"

Write-Host "Backend:  $BACKEND_URL"
Write-Host "Frontend: $FRONTEND_URL"
```

### 3. Test Backend Health
```powershell
Invoke-RestMethod -Uri "$BACKEND_URL/health"
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-23T...",
  "services": {
    "firestore": "connected",
    "storage": "connected"
  }
}
```

### 4. Seed Database (CRITICAL - MUST DO AFTER FIRST DEPLOYMENT)
```powershell
Invoke-RestMethod -Uri "$BACKEND_URL/api/debug/seed"
```

This creates:
- Admin user (`sokallel@gmail.com` / `thisisbusiness`)
- Demo screen (`demo-screen-01`)
- 5 demo ads with proper metadata

### 5. Verify Data
```powershell
# Check ads
Invoke-RestMethod -Uri "$BACKEND_URL/api/ads"

# Check playlist
Invoke-RestMethod -Uri "$BACKEND_URL/api/playlist/demo-screen-01"
```

### 6. Test Frontend
Open in browser:
- **Player**: `$FRONTEND_URL/screen/demo-screen-01`
- **Admin Login**: `$FRONTEND_URL/admin`
  - Email: `sokallel@gmail.com`
  - Password: `thisisbusiness`

---

## Troubleshooting

### Issue: "Cloud Build succeeded but services not updated"

**Symptom**: Build logs show SUCCESS but `gcloud run services list` shows old timestamps

**Solution**: This was the critical bug from Dec 22. Our updated `cloudbuild.yaml` fixes this with:
- Explicit step IDs
- `waitFor` dependencies
- Verbose logging

**Verify fix**:
```powershell
# Check if services were actually updated
gcloud run services describe ad-server --region=us-central1 --format="value(status.observedGeneration,metadata.generation)"
```

If generations don't match, manually deploy:
```powershell
gcloud run deploy ad-server --image gcr.io/softomedia-live2026/ad-server:latest --region us-central1 --allow-unauthenticated
```

### Issue: "Frontend shows old backend data"

**Cause**: Frontend cached with wrong backend URL

**Solution**:
1. Check `client-app/src/config.js` - should use Vite env vars
2. Verify `.env.production` was created during build
3. Redeploy frontend:
   ```powershell
   cd client-app
   gcloud builds submit --config cloudbuild.yaml .
   ```

### Issue: "Player shows same image for all ads"

**Solutions**:
1. Upload unique images to GCS bucket
2. Re-seed database with correct metadata
3. Clear browser cache

### Issue: "Permission denied" or "403 Forbidden"

**Solution**: Enable Cloud Run unauthenticated access
```powershell
gcloud run services add-iam-policy-binding ad-server `
  --region=us-central1 `
  --member=allUsers `
  --role=roles/run.invoker
```

---

## Monitoring & Debugging

### View Build Logs
```powershell
# List recent builds
gcloud builds list --limit=5

# View specific build
gcloud builds log BUILD_ID
```

### View Cloud Run Logs
```powershell
# Backend logs
gcloud run services logs read ad-server --region=us-central1 --limit=50

# Frontend logs
gcloud run services logs read client-app --region=us-central1 --limit=50
```

### Monitor Real-Time Logs
```powershell
# Stream backend logs
gcloud run services logs tail ad-server --region=us-central1
```

---

## Clean Deployment (From Scratch)

If you need to start completely fresh:

```powershell
# 1. Delete existing services
gcloud run services delete ad-server --region=us-central1 --quiet
gcloud run services delete client-app --region=us-central1 --quiet

# 2. Delete container images
gcloud container images delete gcr.io/softomedia-live2026/ad-server --quiet
gcloud container images delete gcr.io/softomedia-live2026/client-app --quiet

# 3. Clear Firestore (optional - WARNING: deletes all data)
# Use Firebase Console: https://console.firebase.google.com

# 4. Deploy from scratch
cd c:\Users\ChrisFro\Desktop\EmoGini\softomediaLIVE
gcloud builds submit --config cloudbuild.yaml .

# 5. Seed database
$BACKEND_URL = gcloud run services describe ad-server --region=us-central1 --format="value(status.url)"
Invoke-RestMethod -Uri "$BACKEND_URL/api/debug/seed"
```

---

## Success Checklist

- [ ] Project is `softomedia-live2026`
- [ ] All 4 APIs enabled (Run, Build, Firestore, Storage, Secrets)
- [ ] Firestore database created
- [ ] JWT secret stored in Secret Manager
- [ ] `gcloud builds submit` completed successfully
- [ ] Both services show in `gcloud run services list`
- [ ] Backend `/health` endpoint returns 200
- [ ] Database seeded via `/api/debug/seed`
- [ ] `/api/ads` returns 5 ads
- [ ] Player displays 5 distinct images
- [ ] Admin login works

---

## Quick Reference

### Essential Commands
```powershell
# Deploy everything
gcloud builds submit --config cloudbuild.yaml .

# Get backend URL
gcloud run services describe ad-server --region=us-central1 --format="value(status.url)"

# Seed database
Invoke-RestMethod -Uri "https://ad-server-XXXXX.run.app/api/debug/seed"

# View logs
gcloud run services logs read ad-server --region=us-central1
```

### Admin Credentials
- Email: `sokallel@gmail.com`
- Password: `thisisbusiness`

### Demo Screen ID
- `demo-screen-01`
