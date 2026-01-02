# Deployment Guide

> [!IMPORTANT]
> **RULE: Build in the Cloud.**
> All deployments must be triggered via Google Cloud Build using `gcloud builds submit`. Local builds are for development only.
>
> **RULE: Single Source of Truth.**
> Never hardcode configuration data (ads, durations, file paths) inside route handlers (e.g., `index.js`). Always use dedicated seed/config files (e.g., `seed_demo.js`) to prevent "ghost" data overrides. Run `verify_predeploy.js` before deploying.
>
> **RULE: Atomic Deployments Only.**
> Every `gcloud builds submit --config cloudbuild.yaml .` rebuilds and redeploys BOTH `client-app` AND `ad-server` services. NEVER manually delete Cloud Run services using `gcloud run services delete`. The build system is the only source of service updates.

---

## Pre-Deployment Checklist

Before deploying, run the verification script:

```bash
node verify_predeploy.js
```

This checks:
- ✅ Client build exists (`client-app/dist/`)
- ✅ Ad-server entry point exists
- ✅ No hardcoded localhost without env fallback
- ✅ ESLint config in place
- ⚠️ Dockerfiles present (warning if missing)

---

## Deployment Commands

### Deploy to Production

```bash
# From project root
gcloud builds submit --config cloudbuild.yaml --project=softomedia-live-2026 .
```

### View Build Logs

```bash
gcloud builds list --project=softomedia-live-2026 --limit=5
```

### Rollback (if needed)

```bash
# Get previous revision
gcloud run revisions list --service=client-app --region=us-central1 --project=softomedia-live-2026

# Route traffic to previous revision
gcloud run services update-traffic client-app --to-revisions=REVISION_NAME=100 --region=us-central1 --project=softomedia-live-2026
```

---

## Required Setup (One-Time)

1. **Create Artifact Registry repository**:
   ```bash
   gcloud artifacts repositories create softomedia --repository-format=docker --location=us-central1 --project=softomedia-live-2026
   ```

2. **Create Dockerfiles** for both services (see `client-app/Dockerfile` and `ad-server/Dockerfile`)

