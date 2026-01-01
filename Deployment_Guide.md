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
