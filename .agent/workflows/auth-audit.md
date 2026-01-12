---
description: Verify the hardening measures for the authentication system
---

# Authentication Audit (/auth-audit)

This workflow verifies that the Authentication Resilience measures are correctly implemented across the backend, frontend, and infrastructure.

## Phase 1: Backend Middleware Verification
// turbo
1. **Check ALLOW_DEMO_MODE in Auth Middleware**:
   ```powershell
   Get-Content "ad-server/src/middleware/auth.js" | Select-String "ALLOW_DEMO_MODE"
   ```
   *Expected: Lines showing the check for ALLOW_DEMO_MODE === 'true'*

## Phase 2: Frontend Synchronization Verification
// turbo
2. **Check Persona State Sync**:
   ```powershell
   Get-Content "client-app/src/contexts/AuthContext.jsx" | Select-String "demo_role"
   ```
   *Expected: Lines showing demo_role being set in setPersona*

// turbo
3. **Check API Interceptor Sync**:
   ```powershell
   Get-Content "client-app/src/services/api.js" | Select-String "demoRole"
   ```
   *Expected: Lines showing the interceptor using demo_role or active_persona*

## Phase 3: Infrastructure Configuration
// turbo
4. **Check Cloud Build Env Vars**:
   ```powershell
   Get-Content "cloudbuild.yaml" | Select-String "ALLOW_DEMO_MODE=true"
   ```
   *Expected: Line in cloudbuild.yaml setting ALLOW_DEMO_MODE=true*

## Summary
If all checks pass, the system is verified for Authentication Resilience.
