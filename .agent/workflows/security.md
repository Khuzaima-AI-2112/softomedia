---
description: Defensive security audits for dependencies and code
---

# Security Audit Workflow (/security)

This workflow performs automated security checks to identify vulnerabilities in dependencies and prevent secret leakage.

## Phase 1: Dependency Audits
// turbo
1. **Ad-Server Audit**:
   ```powershell
   cd ad-server; npm audit --audit-level=high
   ```
// turbo
2. **Client-App Audit**:
   ```powershell
   cd client-app; npm audit --audit-level=high
   ```

## Phase 2: Secret Scanning (Pattern Matching)
// turbo
3. **Scan for hardcoded JWT/API keys**:
   ```powershell
   # Scan for high-entropy strings or common secret patterns
   Get-ChildItem -Recurse -Include *.js,*.jsx,*.json,*.yaml -Exclude node_modules,dist | Select-String "JWT_SECRET|API_KEY|PRIVATE_KEY|password"
   ```

## Phase 3: Cloud Secret Governance
// turbo
4. **Verify Secret Manager Health**:
   ```powershell
   gcloud secrets list --project=softomedia-live-2026 --limit=5
   ```

## Summary
If all audits return 0 vulnerabilities and no hardcoded secrets are found, the system's defensive posture is validated.
