---
trigger: always_on
---

# Project Name Distinction
- **Antigravity Project Name**: softomedia-live2026 (used locally in package.json)
- **Google Cloud Project ID**: softomedia-live-2026 (used for all GCP resources)

# Google Cloud Project Limitation
- You are strictly limited to the softomedia-live-2026 project.
- **Requirement**: Always include the explicit --project softomedia-live-2026 flag in all gcloud and firebase CLI commands.
- **Profile Requirement**: Ensure the active gcloud configuration profile is set to `softomedia-live-2026` (via `gcloud config configurations activate softomedia-live-2026`).
- **Safety**: Perform a check before any destructive operations (delete, replace, update) to ensure the target is within the approved project scope.

