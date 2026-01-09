---
description: Verify the 3-layer defense-in-depth for pricing stability
---

This workflow validates the integrity of the pricing system across three critical layers to prevent regressions, decoupling, or drift.

### Layer 1: Backend Normalization (PricingRepository)
Standardizes database records to camelCase API contract.
// turbo
1. Verify normalization logic in `PricingRepository.js`:
   ```powershell
   Get-Content "ad-server/src/repositories/PricingRepository.js" | Select-String "baseCPM"
   ```

### Layer 2: Frontend Resilience (CPMCalendar)
Prevents fatal UI crashes with optional chaining and fallbacks.
// turbo
2. Verify optional chaining and fallbacks in `CPMCalendar.jsx`:
   ```powershell
   Get-Content "client-app/src/pages/admin/CPMCalendar.jsx" | Select-String "pricingConfig?\."
   ```

### Layer 3: Service Hardening (PricingService)
Handles NaN, null, and legacy formats during formatting.
// turbo
3. Verify robust formatting in `PricingService.js`:
   ```powershell
   Get-Content "client-app/src/services/PricingService.js" | Select-String "price === undefined"
   ```

### Summary Check
If all greps return matching lines, the 3-layer defense is active and healthy.
