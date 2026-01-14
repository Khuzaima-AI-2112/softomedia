# Incident Report: Business Hours Synchronization Discrepancy

**Incident ID**: INC-20260114-BUSINESS-HOURS-SYNC  
**Date**: 2026-01-14  
**Severity**: Medium  
**Status**: Resolved  

## Summary
Advertisers were unable to schedule campaigns during special store hours (e.g., Marketing Events) because the Campaign Wizard was hardcoded to an 08:00 - 22:00 range. This discrepancy caused a loss of booking opportunities and UX confusion when Super Admin overrides were ignored by the scheduler.

## Root Cause Analysis
1.  **Hardcoded Constants**: Both the backend (`LoopRepository.js`) and frontend (`Step3LoopSlotSelection.jsx`) had hardcoded business hour ranges.
2.  **Missing Dynamic Fetching**: The `getLoops` API did not retrieve effective store hours or respect overrides from the `BusinessHoursService`.
3.  **Data Stripping**: The `ApiService.js` in the frontend was stripping the `business_hours` object from the API response, returning only the loops array.
4.  **Timezone Mismatch**: A secondary issue was identified where `toISOString()` caused an off-by-one date error in the Admin Calendar and Campaign Wizard due to local vs. UTC offsets.

## Impact
- Ad booking was restricted to default hours regardless of store availability.
- Admin overrides for early openings (e.g., 07:00 AM) were non-functional for advertisers.
- Admin calendar UI was unreliable for setting future overrides.

## Resolution
- **Backend**:
    - Expanded `LoopRepository.BUSINESS_HOURS` to `00:00 - 24:00`.
    - Integrated `BusinessHoursService.getEffectiveHours` into `LoopGenerationService` and the `GET /api/loops` endpoint.
- **Frontend**:
    - Updated `Step3LoopSlotSelection.jsx` to dynamically render the hourly grid based on the `business_hours` response.
    - Added a "Store is Closed" safety state for holidays/closures.
    - Fixed `ApiService.js` to correctly pass `location_id` and preserve the full response object.
    - Refactored date handling to use local `YYYY-MM-DD` strings, resolving the off-by-one timezone bug.

## Prevention
- Standardize on dynamic business hours fetching for all scheduling components.
- Enforce local-time date formatting (`YYYY-MM-DD`) across the entire stack.
- Added comprehensive verification in the Campaign Wizard to ensure alignment with Admin settings.

## Verification
- **Test Case**: Marketing Event override (07:00 - 18:00) for Metro Downtown on Jan 15.
- **Result**: Successfully verified the 07:00 AM slot is visible and bookable in the Campaign Wizard.
- **Calendar**: Verified that clicking Jan 16 in the Admin UI correctly opens the Jan 16 editor.

![Jan 15 07:00 Slot](file:///C:/Users/ChrisFro/.gemini/antigravity/brain/cc9e06b4-ec33-4765-9fc2-cc7d057a4382/jan_15_0700_slot_visible_1768423667585.png)
![Corrected Calendar](file:///C:/Users/ChrisFro/.gemini/antigravity/brain/cc9e06b4-ec33-4765-9fc2-cc7d057a4382/corrected_calendar_modal_1768423605171.png)
