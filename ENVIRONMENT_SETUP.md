# Sprint 1: Environment Configuration Setup Guide

## Overview
This guide documents the environment configuration changes made in Sprint 1 to fix production blockers.

## What Changed

### 1. Environment Variables
- Created `.env.example` template file
- Created `.env.development` for local development
- Added `.env*` files to `.gitignore` (except `.env.example`)

### 2. Client App Configuration
- Updated `client-app/src/config.js` to use `VITE_API_URL` environment variable
- Falls back to `http://localhost:8080` if not set (development mode)
- Logs API URL in development mode only

### 3. Ad Server Security
- **JWT Secret:** Now REQUIRED - server will not start without `JWT_SECRET` env var
- **CORS:** Environment-based whitelist (defaults to localhost for development)
- Validates required environment variables on startup

### 4. Cloud Build Deployment
- Injects `VITE_API_URL` into client-app at deployment time
- Injects `JWT_SECRET` from Google Secret Manager
- Sets production CORS origins automatically
- Client deployment waits for ad-server URL

## Local Development Setup

### First Time Setup

1. **Copy environment template:**
   ```bash
   cp .env.example .env.development
   ```

2. **The `.env.development` file is already configured with:**
   - `VITE_API_URL=http://localhost:8080`
   - `JWT_SECRET=<secure-random-string>`
   - `CORS_ORIGINS=http://localhost:5173,http://localhost:3000`

3. **Start the ad-server:**
   ```bash
   cd ad-server
   npm run dev
   ```
   
   The server will load `JWT_SECRET` from `.env.development` in the parent directory.

4. **Start the client-app:**
   ```bash
   cd client-app
   npm run dev
   ```
   
   Vite will automatically load `VITE_API_URL` from `.env.development`.

### Verifying Configuration

**Check client-app:**
- Open browser console
- You should see: `[Config] API_URL: http://localhost:8080`

**Check ad-server:**
- Server should start without errors
- If `JWT_SECRET` is missing, server will exit with error message

## Production Deployment Setup

### Prerequisites

1. **Create JWT Secret in Google Secret Manager:**
   ```bash
   # Generate a secure secret
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # Create secret in Secret Manager
   echo -n "YOUR_GENERATED_SECRET" | gcloud secrets create JWT_SECRET \
     --project softomedia-live2026 \
     --data-file=-
   ```

2. **Grant Cloud Run access to the secret:**
   ```bash
   gcloud secrets add-iam-policy-binding JWT_SECRET \
     --project softomedia-live2026 \
     --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```
   
   Replace `PROJECT_NUMBER` with your project number (find with `gcloud projects describe softomedia-live2026`).

### Deployment Process

When you deploy via Cloud Build:

1. **Ad-server deployment:**
   - `JWT_SECRET` injected from Secret Manager
   - `CORS_ORIGINS` set to client-app URL
   - `NODE_ENV=production`

2. **Client-app deployment:**
   - Waits for ad-server to deploy
   - Retrieves ad-server URL automatically
   - `VITE_API_URL` set to ad-server URL

3. **Automatic configuration:**
   - No manual URL configuration needed
   - CORS automatically allows client-app origin
   - Secrets never committed to git

## Environment Variables Reference

### Client App (Vite)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | `http://localhost:8080` | Backend API URL |

**Note:** Vite only exposes variables prefixed with `VITE_` to the browser.

### Ad Server (Node.js)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | **YES** | None | JWT signing secret (server exits if not set) |
| `CORS_ORIGINS` | No | `http://localhost:5173,http://localhost:3000` | Comma-separated allowed origins |
| `PORT` | No | `8080` | Server port |
| `NODE_ENV` | No | `development` | Environment mode |

## Security Improvements

### Before Sprint 1
- ❌ Hardcoded `http://localhost:8080` in code
- ❌ Default JWT secret (`demo-secret`)
- ❌ CORS allowed all origins (`cors()`)
- ⚠️ Console.log in production code

### After Sprint 1
- ✅ Environment-based API URL
- ✅ JWT secret required (fails if not set)
- ✅ CORS whitelist with environment config
- ✅ No console.log in production code
- ✅ Secrets managed via Google Secret Manager

## Troubleshooting

### Error: "JWT_SECRET environment variable is not set"

**Cause:** Ad-server cannot find `JWT_SECRET` in environment.

**Solution:**
- **Local:** Ensure `.env.development` exists with `JWT_SECRET=...`
- **Production:** Verify secret exists in Secret Manager and IAM permissions are correct

### Error: "Not allowed by CORS"

**Cause:** Client origin not in CORS whitelist.

**Solution:**
- **Local:** Add your origin to `CORS_ORIGINS` in `.env.development`
- **Production:** Verify `CORS_ORIGINS` includes client-app URL

### Client app shows "Failed to fetch"

**Cause:** `VITE_API_URL` pointing to wrong server.

**Solution:**
- **Local:** Check `.env.development` has `VITE_API_URL=http://localhost:8080`
- **Production:** Verify Cloud Build deployment step 8 completed successfully

## Testing Checklist

- [ ] Local dev: Client connects to `http://localhost:8080`
- [ ] Local dev: Ad-server starts without JWT errors
- [ ] Local dev: CORS allows `http://localhost:5173`
- [ ] Local dev: No console.log in browser console (except config log in dev mode)
- [ ] Production: JWT secret loaded from Secret Manager
- [ ] Production: Client connects to ad-server Cloud Run URL
- [ ] Production: CORS blocks unauthorized origins
- [ ] Production: No console.log in production build

## Next Steps

After Sprint 1 is verified:
- **Sprint 2:** Migrate from in-memory database to Firestore
- **Sprint 3:** Create service layer and API client
- **Sprint 4:** Add input validation and security hardening
- **Sprint 5:** Performance optimization and monitoring
