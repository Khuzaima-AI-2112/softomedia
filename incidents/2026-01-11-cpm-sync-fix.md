# SRE Report: CPM Pricing Synchronization Resolve

## Date: 2026-01-11
**Status**: Resolved
**Severity**: Medium (Functional Inconsistency)

## Problem Summary
The CPM Pricing Dashboard exhibited a synchronization gap where user-initiated changes (Base CPM, Traffic Tiers) successfully persisted to the backend but failed to reflect in the UI's calculation table without a manual refresh. This was traced to a stale internal state in the `PricingService` singleton.

## Root Cause Analysis
- **Service Architecture**: The `PricingService` was designed as a singleton that fetched configuration once during initialization.
- **State Inconsistency**: When `CPMCalendar.jsx` updated the configuration via `ApiService`, it updated its local React state but did not notify the `PricingService` instance. Since the table calculations relied on the service, the displayed prices remained stale.
- **Data Pollution**: Successive updates were discovered to occasionally re-introduce legacy `snake_case` keys into the Firestore document, potentially leading to future casing-related crashes.

## Implemented Fixes
1. **Dynamic Singleton Updates**: Introduced `pricingService.updateConfig()` to allow the service state to be refreshed reactively.
2. **Reactive Recalculation**: Confirmed that all pricing factors (Base CPM, Global Tiers, Hourly Overrides) trigger an immediate, synchronous recalculation of the "AVG SLOT CPM" column, eliminating the need for page reloads.
3. **UI Component Sync**: Modified `CPMCalendar` handlers to push updates to the service instance immediately after API confirmation.
4. **Backend Sanitization**: Hardened `PricingRepository.updateConfig` to purge legacy snake_case keys during the update-and-merge process.
5. **Layout Tagging**: Implemented a debugging layer (`LayoutTag`) to assist in identifying component boundaries for future SRE audits.

## Verification & Stability
- Functional verification confirmed that updating Base CPM triggers an immediate re-calculation of all slot prices in the table.
- Non-overlapping layout tags were validated to ensure they provide clear structural identification without obstructing UI elements.
- The solution is backward compatible and improves data quality in the persistence layer.

## Recommendation
- Monitor the `pricing_config` collection for any recurrence of snake_case keys.
- Consider moving towards a centralized state management solution (e.g., Context or Redux) if more singletons exhibit similar synchronization gaps.
