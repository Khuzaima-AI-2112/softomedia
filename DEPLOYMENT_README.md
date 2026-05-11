# SoftoMedia - Quick Deployment Guide

**Current Production Build**: `225670b3-91e5-44a7-a7cd-5380b4c1c9b5`  
**Status**: ✅ 100% Functional - All Personas Working (Brand Dashboard Fixed!)  
**Last Deploy**: December 24, 2025 - 13:42 UTC

## Prerequisites

1. **Google Cloud SDK**: https://cloud.google.com/sdk/docs/install
2. **Firebase CLI**: `npm install -g firebase-tools`
3. **Node.js**: https://nodejs.org/

## Usage

### Full Deployment (Backend + Frontend)

```powershell
.\deploy.ps1
```

This will:
- ✅ Check all prerequisites
- ✅ Generate JWT secret automatically
- ✅ Deploy backend to Cloud Run
- ✅ Configure environment variables
- ✅ Build and deploy frontend to Firebase
- ✅ Display deployment URLs and credentials

### Deploy with Custom JWT Secret

```powershell
.\deploy.ps1 -JwtSecret "your_existing_secret_here"
```

### Deploy to Different Project

```powershell
.\deploy.ps1 -ProjectId "my-project-id" -Region "us-east1"
```

## What It Does

### Backend Deployment
1. Builds Docker container using Cloud Build
2. Deploys to Cloud Run (`ad-server` service)
3. Sets environment variables:
   - `JWT_SECRET`: Auto-generated or provided
   - `PROJECT_ID`: Your GCP project
   - `GCS_BUCKET`: Cloud Storage bucket name

### Frontend Deployment
1. Creates `.env.production` with backend URL
2. Installs npm dependencies
3. Builds production bundle
4. Deploys to Firebase Hosting

## After Deployment

### Test Backend
```bash
curl https://YOUR-BACKEND-URL.run.app/health
# Should return "OK"
```

### Test Login
1. Open frontend URL (shown in deployment output)
2. Login with any persona:
   - **Admin**: `sokallel@gmail.com` / `thisisbusiness` → `/dashboard`
   - **Brand**: `brand@demo.com` / `demo123` → `/brand/dashboard`
   - **Retailer**: `retailer@demo.com` / `demo123` → `/retailer/dashboard`
3. Verify auto-redirect to correct dashboard
4. Verify NO "Loading..." states (dashboard loads instantly)

### View Logs
```bash
# Backend logs
gcloud run logs read --service=ad-server --region=us-central1

# Realtime logs
gcloud run logs tail --service=ad-server --region=us-central1
```

## Troubleshooting

### Build Fails
- Check `ad-server/cloudbuild.yaml` exists
- Verify Cloud Build API is enabled
- Check billing is enabled

### Frontend Build Fails
- Run `npm install` manually in `client-app/`
- Check for syntax errors in components
- Verify `.env.production` is created

### Login Fails
- Check JWT_SECRET is set correctly
- Verify backend URL in frontend `.env.production`
- Check CORS is enabled in backend

## Manual Deployment

### Backend Only
```bash
cd ad-server
gcloud builds submit --config cloudbuild.yaml
gcloud run services update ad-server --set-env-vars="JWT_SECRET=xxx" --region=us-central1
```

### Frontend Only
```bash
cd client-app
npm run build
firebase deploy --only hosting
```

## Rollback

### Backend
```bash
# List revisions
gcloud run revisions list --service=ad-server --region=us-central1

# Rollback to previous
gcloud run services update-traffic ad-server --to-revisions=PREVIOUS_REVISION=100 --region=us-central1
```

### Frontend
```bash
firebase hosting:clone SOURCE_SITE_ID:SOURCE_CHANNEL_ID TARGET_SITE_ID:live
```

## Cost Monitoring

After deployment, set up billing alerts:
```bash
# Create budget alert
gcloud billing budgets create --billing-account=BILLING_ACCOUNT_ID \
  --display-name="SoftoMedia Budget" \
  --budget-amount=100USD \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90
```
