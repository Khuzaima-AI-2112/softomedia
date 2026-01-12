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

### Layer 1+: Cascading Invalidation (PricingRepository)
Ensures retailer overrides are cleared when base price changes.
// turbo
1b. Verify cascading invalidation:
   ```powershell
   Get-Content "ad-server/src/repositories/PricingRepository.js" | Select-String "clearOverridesToPreventGhostPrices"
   ```

### Layer 2+: Reactive Pulse (CPMCalendar)
Ensures UI state refreshes immediately after any pricing update.
// turbo
2b. Verify pricingService refresh in calendar:
   ```powershell
   Get-Content "client-app/src/pages/admin/CPMCalendar.jsx" | Select-String "pricingService.init\(true\)"
   ```

### Layer 3+: Schema Enforcement (PricingSchema)
Validates data integrity against Zod definitions.
// turbo
3b. Run schema verification:
   ```powershell
   node ad-server/scripts/verify_schema.js --local
   ```

### Summary Check
If all greps return matching lines and the schema script passes, the pricing system is highly resilient.
