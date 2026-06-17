# State Validation Remediation Plan

This document outlines the three core State Validation vulnerabilities identified during the MVP demo analysis and provides a technical roadmap to permanently resolve them across the platform.

## Problem 1: Front-End "Ghost State" Assumption
**The Vulnerability**: The frontend assumed inventory existed and generated fake UI components (e.g., `loop_${screenId}`) if the backend returned empty data, allowing impossible user actions without erroring.

**The Solution**:
- [x] **Implemented**: Added `hasRealInventory` state tracking in `Step3LoopSlotSelection.jsx` to verify if the API actually returned valid loops.
- [x] **Implemented**: Injected a hard UI boundary that disables the "Continue" checkout button and displays a severe warning banner if the inventory is absent.

### Remaining Tasks:
**Task 1.1: Restrict Date Selection to Valid Inventory**
- **Action**: Refactor the temporal components (like date pickers in the wizard) to fetch bounded limits from the backend, visually disabling dates where inventory is zero.
- **Blast Radius**: **Low**. Confined entirely to the Brand Campaign Wizard UI.
- **Probability of Success**: **95%**. We already fetch loops by date; simply querying availability upfront is low risk.

## Problem 2: Back-End "Silent Drop" Processing
**The Vulnerability**: The API gracefully ignored non-existent IDs instead of alerting the caller. In `ad-server/src/api/campaigns.js (/book)`, if `loopRepository.findById(loopId)` returned undefined, the logic simply `continue`d without throwing an error, silently dropping the advertiser's bookings.

**The Solution**:

### Remaining Tasks:
**Task 2.1: Strict Payload Validation & Loud Failures**
- [x] **Implemented**: Refactored the `/book` endpoint to look up *all* requested `loopId`s before making writes. The API now throws `400 Bad Request` with `VALIDATION_FAILED` dynamically citing missing IDs exactly as promised.

**Task 2.2: Atomic Booking Transactions**
- [x] **Implemented**: Implemented a pre-flight validation check (`conflictSlots`) before booking runs to accurately detect if any of the target positions are already flagged as `BOOKED`, throwing `409 CONFLICT`.

## Problem 3: Blind Time-Dependent Retrieval
**The Vulnerability**: The physical media playback system relies on dynamic temporal state (`hour === currentHour`). The player blindly fetched loops and gracefully degraded to a fallback screen without assessing *why* the time slot was empty, leaving presenters and testers stranded.

**The Solution**:
- [x] **Implemented**: Updated `SeedService.js` to proactively generate and Auto-Approve the current local hour's loop on bootstrap, guaranteeing the initial state is always active out-of-the-box for demonstrations.

### Remaining Tasks:
**Task 3.1: Descriptive Telemetry & Error Contexts**
- [x] **Implemented**: Appended dynamic `reason:` injection natively to the `.json()` payload on `screens.js` `/playback-loop` fallback. (Values like `UNGENERATED_INVENTORY` or `REJECTED_INVENTORY`).

**Task 3.2: Graceful Degradation (Temporal Sliding)**
- [x] **Implemented**: Engineered the fallback layer to dynamically search for the `--hour` loop behind it. If `currentHour` drops due to a lack of approval, it smoothly serves `playback_mode: 'TEMPORAL_SLIDE'`, keeping the physical screen visually active.
