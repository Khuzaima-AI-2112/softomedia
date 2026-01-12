---
description: Basic liveness and integration check
---

# Smoke Test Workflow (/smoke-test)

Performs lightweight verification of the application's critical entry points and configuration.

## Phase 1: Endpoint Liveness
// turbo
1. **Check Local Ad-Server Health** (if running):
   ```powershell
   try { Invoke-RestMethod -Uri "http://localhost:3001/health" -Method Get } catch { Write-Host "Local server not running or unreachable" }
   ```

## Phase 2: Configuration Integrity
// turbo
2. **Verify Env Consistency**:
   ```powershell
   # Check if .env.development matches .env.example keys
   node -e "const fs=require('fs'); const e=fs.readFileSync('.env.example','utf8').match(/^[^#\s=]+/gm); const d=fs.readFileSync('.env.development','utf8'); e.forEach(k=> { if(!d.includes(k)) console.error('Missing key:', k) })"
   ```

## Phase 3: Project Structure
// turbo
3. **Run Pre-deployment Script**:
   ```powershell
   node verify_predeploy.js
   ```

## Summary
Ensures basic system availability and configuration completeness before proceeding to deeper tests.
