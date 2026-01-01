---
trigger: always_on
---

# Google Cloud Project Limitation
- You are strictly limited to the `softomedia-live2026` project.
- **Requirement**: Always include the explicit `--project softomedia-live2026` flag in all `gcloud` and `firebase` CLI commands.
- **Safety**: Perform a check before any destructive operations (delete, replace, update) to ensure the target is within the approved project scope.

