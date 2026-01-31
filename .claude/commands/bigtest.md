---
description: Execute all verification workflows and test suites in a single master test
---

# Master Verification Workflow (/bigtest) - ANALYTICAL MODE

This workflow executes all verification protocols in a **READ-ONLY** capacity.

**STRICT RULE**: If any step fails, **DO NOT FIX IT**.
Instead, you must stop and generate an **SRE Incident Report**.

## Failure Protocol
If a failure occurs in any phase:
1. **STOP** execution.
2. **ANALYZE** the error log.
3. **CREATE** a report file: `sre-reports/report-[TIMESTAMP].md`.
4. **DOCUMENT**:
   - **Root Cause**: What exactly failed?
   - **Impact**: What is broken?
   - **Proposed Fix**: How should it be fixed? (Do not implement it).

## Phase 1: Environment & Project Context
1. **Check Cloud Project**:
   ```powershell
   gcloud config get-value project
   ```
   *Expected: softomedia-live-2026*

## Phase 2: Security Audit (/security)
2. **Dependency & Secret Audit**:
   ```powershell
   npm audit --audit-level=high
   Get-ChildItem -Recurse -Include *.js,*.jsx,*.json,*.yaml -Exclude node_modules,dist | Select-String "JWT_SECRET|API_KEY|PRIVATE_KEY|password"
   ```

## Phase 3: Operational Hygiene (/hygiene)
3. **Linting & Log Sanitation**:
   ```powershell
   npm run lint
   Get-ChildItem -Path "ad-server/src", "client-app/src" -Recurse -Include *.js,*.jsx | Select-String "console\.log"
   ```

## Phase 4: Smoke Test (/smoke-test)
4. **Liveness & Config Integrity**:
   ```powershell
   node verify_predeploy.js
   ```

## Phase 5: Pricing Governance (/schema, /parity)
5. **Schema Enforcement**:
   ```powershell
   node ad-server/scripts/verify_schema.js --local
   ```
6. **Environment Parity**:
   ```powershell
   node ad-server/scripts/parity_audit.js
   ```

## Phase 6: Defense-in-Depth (/layers)
7. **Verify Pricing Layers**:
   ```powershell
   # Layer 1: Normalization
   Get-Content "ad-server/src/repositories/PricingRepository.js" | Select-String "baseCPM"
   # Layer 2: Frontend Resilience
   Get-Content "client-app/src/pages/admin/CPMCalendar.jsx" | Select-String "pricingConfig?\."
   # Layer 3: Robust Formatting
   Get-Content "client-app/src/services/PricingService.js" | Select-String "price === undefined"
   ```

## Phase 7: Automated Testing (Unit & E2E)
8. **Backend Unit Tests**:
   ```powershell
   cd ad-server; npm run test
   ```
9. **Integration / E2E Tests**:
   ```powershell
   npm run test:e2e
   ```

## Phase 8: Authentication Audit (/auth-audit)
10. **Verify Auth Resilience**:
    Run the /auth-audit workflow.

## Summary
This run was purely analytical. If failures were found, consult the generated SRE Report in `sre-reports/`. DO NOT APPLY FIXES AUTOMATICALLY.
