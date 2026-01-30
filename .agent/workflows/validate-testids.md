---
description: Validate test IDs and auth setup before running E2E tests
---

# Validate Test Infrastructure

This workflow validates that E2E test selectors and auth setup match the application code.

## Steps

// turbo
1. **Validate Auth Contract**
   Check that `tests/global.setup.js` sets all localStorage keys required by `AuthContext.jsx`:
   ```powershell
   Write-Host "=== AUTH CONTRACT VALIDATION ===" -ForegroundColor Cyan
   
   # Required keys from AuthContext.jsx
   $required = @('auth_token', 'auth_user', 'active_persona', 'demo_role')
   
   # Check global.setup.js for each
   $setupContent = Get-Content tests/global.setup.js -Raw
   foreach ($key in $required) {
       if ($setupContent -match "localStorage.setItem\([`"']$key") {
           Write-Host "  ✅ $key" -ForegroundColor Green
       } else {
           Write-Host "  ❌ $key MISSING" -ForegroundColor Red
       }
   }
   ```

// turbo
2. **Extract Test IDs from Test Files**
   ```powershell
   Write-Host "`n=== TEST ID EXTRACTION ===" -ForegroundColor Cyan
   $testIds = Get-ChildItem tests/*.spec.js | ForEach-Object {
       Select-String -Path $_ -Pattern 'data-testid[=^]+"([^"]+)"' -AllMatches | 
       ForEach-Object { $_.Matches.Groups[1].Value }
   } | Sort-Object -Unique
   Write-Host "Found $($testIds.Count) unique test IDs"
   ```

// turbo
3. **Check Test IDs Exist in Components**
   ```powershell
   Write-Host "`n=== TEST ID VALIDATION ===" -ForegroundColor Cyan
   $missing = @()
   foreach ($id in $testIds) {
       # Skip dynamic IDs (those with ^ prefix in selector)
       if ($id -match '\$\{') { continue }
       
       $found = Get-ChildItem client-app/src -Recurse -Include *.jsx,*.tsx | 
           Select-String -Pattern "data-testid[=`"']$id" -Quiet
       
       if (-not $found) {
           $missing += $id
           Write-Host "  ❌ MISSING: $id" -ForegroundColor Red
       }
   }
   
   if ($missing.Count -eq 0) {
       Write-Host "  ✅ All test IDs found in components" -ForegroundColor Green
   } else {
       Write-Host "`n$($missing.Count) test IDs missing from components" -ForegroundColor Yellow
   }
   ```

4. **Review Results**
   - If auth keys are missing: Update `tests/global.setup.js`
   - If test IDs are missing: Either update tests or add IDs to components

## When to Run
- Before `/bigtest`
- After modifying auth-related files
- After adding new E2E tests
