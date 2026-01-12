---
description: Audit pricing configuration parity between local and cloud run
---

# Environment Parity Workflow

This workflow identifies "drift" between the local and cloud pricing configurations to prevent environment-specific bugs.

## Running the Audit

Execute the parity audit tool:
// turbo
```powershell
node ad-server/scripts/parity_audit.js
```

## What it checks:
- **Project Scope**: Ensures auditing `softomedia-live-2026`.
- **Casing Consistency**: Flags legacy `snake_case` keys (like `base_cpm`).
- **Override Hygiene**: Reports on active `retailerOverrides` that might cause price drift.

## Corrective Actions
- If drift is detected, use the Super Admin UI to reset the global configuration or manually clean the Firestore documents using `gcloud`.
