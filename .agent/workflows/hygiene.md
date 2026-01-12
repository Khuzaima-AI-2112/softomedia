---
description: Operational excellence through linting and log sanitation
---

# Operational Hygiene Workflow (/hygiene)

This workflow ensures code quality through linting and protects against information disclosure via logs.

## Phase 1: Linting Enforcement
// turbo
1. **Ad-Server Lint**:
   ```powershell
   cd ad-server; npm run lint
   ```
// turbo
2. **Client-App Lint**:
   ```powershell
   cd client-app; npm run lint
   ```

## Phase 2: Log Sanitation
// turbo
3. **Scan for console.log in source**:
   ```powershell
   # Check for non-production-sanitized logging
   Get-ChildItem -Path "ad-server/src", "client-app/src" -Recurse -Include *.js,*.jsx | Select-String "console\.log"
   ```

## Phase 3: Technical Debt Audit
// turbo
4. **Check for Overdue TODOs**:
   ```powershell
   Select-String -Path "TODO.md" -Pattern "TODO"
   ```

## Summary
Maintains high code standards and prevents accidental exposure of debugging information in production.
