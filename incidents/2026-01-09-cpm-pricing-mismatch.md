# Incident Report: CPM Pricing Dashboard Crash

## Date: 2026-01-09
**Status**: Resolved
**Severity**: Critical (UI Blocking)

## Issue Description
The Admin Pricing Dashboard (`/dashboard/admin/pricing`) was crashing with a `TypeError: Cannot read properties of undefined (reading 'high')`. This prevented administrators from viewing or modifying CPM pricing configurations.

## Root Cause
A naming convention mismatch between the backend API and the frontend client.
- **Backend**: The `ad-server` (Firestore via `PricingRepository`) was returning data using `snake_case` keys (e.g., `traffic_tiers`, `base_cpm`, `date_overrides`).
- **Frontend**: The `client-app` (`CPMCalendar.jsx`) was attempting to access these properties using `camelCase` (e.g., `trafficTiers`, `baseCPM`).

Because `pricingConfig.trafficTiers` was undefined, the subsequent access to `.high` triggered the fatal crash.

## Solution
1. **Standardization**: Updated `PricingRepository.js` in the backend to normalize all outgoing pricing configuration data to `camelCase`.
2. **Defensive Coding**: Updated `CPMCalendar.jsx` and `PricingService.js` to use `camelCase` consistently and added optional chaining (`?.`) with sensible fallbacks (e.g., `pricingConfig?.trafficTiers?.high?.multiplier || '1.5'`).
3. **Hardening**: Added robustness to `PriceDisplay` and `PricingService` formatting logic to handle `NaN` or `undefined` values gracefully, avoiding "$NaN" displays.

## Lessons Learned
- **Casing Consistency**: Always standardize on a single casing convention (camelCase preferred for JS/React) across the entire stack.
- **Normalization Layers**: Backend repositories should normalize database records to the agreed API contract.
- **Graceful Degradation**: UI components should never assume the existence of nested API data; always use optional chaining and provide default values to prevent total application failure.

## Verification
- Verified local fix via browser subagent.
- Confirmed Pricing Calendar loads correctly with valid data.
- Confirmed "Base CPM" and "Traffic Multiplier" cards display correct values.
