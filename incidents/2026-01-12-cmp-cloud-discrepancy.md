# SRE Incident Report: CMP Calculation Discrepancy (Cloud vs Local)

**Date:** 2026-01-12  
**Incident ID:** INC-2026-01-12-CMP  
**Status:** RESOLVED  
**Severity:** Medium (Financial Visibility & Data Display)  
**Component:** `ad-server/src/repositories/PricingRepository.js`, `client-app/src/services/PricingService.js`

---

## Executive Summary

On 2026-01-12, a discrepancy was identified in the CMP (Cost Per Mille) pricing calculations between the local development environment and the production Cloud Run environment (`softomedia-live-2026`). While local testing showed correct calculations ($12.00 Base CPM -> $12.00 Medium Tier), the Cloud environment displayed $11.00 for the same configuration. This led to a lack of trust in the pricing dashboard and potential billing ambiguity.

---

## Symptoms & Observations

| Metric | Local Expected | Cloud Observed | Result |
|--------|----------------|----------------|--------|
| Base CPM | $12.00 | $12.00 | ✅ Match |
| Medium Tier (1.0x) | $12.00 | **$11.00** | ❌ -$1.00 Delta |
| High Tier (1.5x) | $18.00 | **$16.50** | ❌ -$1.50 Delta |

**Observation**: The cloud environment consistently used a "Ghost Base" of **$11.00** for all calculations despite the UI header showing $12.00.

---

## Root Cause Analysis (RCA)

The investigation revealed a combination of four contributing factors:

### 1. Stale Retailer Overrides (Primary Cause)
The Cloud Firestore database contained high-priority "Retailer Overrides" that were created during early testing. These overrides set the Base CPM for specific retailers to $8.00 or $10.00. 
- **The Bug**: The calculation logic for "Avg Slot CPM" averages across all active screens. One retailer with a lower override price was dragging the average down.
- **The Gap**: Local environments lacked these specific database documents, masking the issue during offline testing.

### 2. Hidden "Phantom" Multipliers
A legacy `storeTrafficMultiplier` (assigning 1.25x to "High Traffic" stores) was still active in the calculation logic but was **not visible** in the Super Admin UI.
- **Impact**: Calculations was technically "correct" based on the hidden data, but "incorrect" based on the user's visible configuration.

### 3. Frontend State Synchronization (Stale Singletons)
The `PricingService` singleton in the frontend did not automatically refresh its internal cache when the global configuration was updated.
- **Impact**: Even after a successful update, the UI continued to use stale data from the previous `init()` call until a manual browser refresh.

### 4. Data Casing Mismatches (Silent Failures)
Persistence used `snake_case` (`base_cpm`), while the UI expected `camelCase` (`baseCPM`).
- **Impact**: Property access on `undefined` triggered defaults (e.g., $15.00 fallback) or silent failures that skewed the final average.

---

## Resolution & Fixes

We implemented a **3-Layer Defense-in-Depth** strategy:

1.  **Persistence Layer (Automatic Hygiene)**:
    - Modified `PricingRepository.updateConfig` to automatically clear all `retailerOverrides` whenever the global `baseCPM` is modified. This prevents stale "anchor" prices from persisting across configuration cycles.
    - Standardized output to `camelCase` at the repository boundary.

2.  **Service Layer (Reactive Refresh)**:
    - Updated `PricingService.js` to support `forceRefresh`.
    - Integrated `pricingService.init(true)` into the `handleSaveBaseCPM` flow in `CPMCalendar.jsx`.

3.  **UI Layer (The Visibility Rule)**:
    - **REMOVED** all hidden multipliers (including `storeTrafficMultiplier`).
    - **NEW GOVERNANCE**: No price-altering multiplier shall be implemented unless it is explicitly visible and editable in the Super Admin UI.

---

## Prevention & Safeguards

To prevent future discrepancies, we have implemented the following structural changes:

1.  **Pricing Visibility Audit**: Added a `/pricing-visibility` workflow to all future pricing-related tasks.
2.  **Environment Parity Checks**: Enhanced the `check_cloud_config.js` diagnostic tool to frequently audit Cloud Run vs Local data shapes.
3.  **Schema Enforcement**: Planned migration to Zod schemas in `PricingRepository` to enforce data types and casing at the database boundary ($TODO.md item).
4.  **SRE Alerting**: Implemented `validateConfiguration()` in `PricingService` to log a `[PRICING_ALERT]` if extreme discounts (>50%) or invalid base prices are detected.

---

**Report Prepared By:** Antigravity SRE AI  
**Reviewer Required:** ChrisFro (SRE Lead)
