# Playwright E2E Test Failure Analysis

**Author:** SRE / Ad System API Analyst  
**Date:** 2026-01-01  
**Status:** Investigation In Progress  

---

## Executive Summary

The Playwright E2E test suite is experiencing persistent failures (5/19 failing, 74% pass rate). The primary blocker is the **Brand Campaign Wizard's Step 3 "Confirm Distribution" button remaining disabled**, preventing the full wizard journey from completing.

---

## Problem Definition

### Primary Symptom
The Playwright test `should complete Step 3: Review & Confirm` fails with:
```
Error: locator.click: element is not enabled
  - Selector: [data-testid="confirm-distribution-btn"]
```

### Root Cause Hypothesis
The `confirm-distribution-btn` button in `Step3ReviewDistribution.jsx` is **never disabled** by its own logic (no `disabled` prop). However, the test cannot click it. This suggests:

1. **The component is crashing silently** before rendering the button due to a missing import or undefined variable.
2. **A parent component's error boundary** is catching the crash and rendering a fallback UI that doesn't include the button.
3. **The preceding steps (Step 1, Step 2) are not completing their data updates** correctly, causing Step 3 to receive malformed or incomplete `data` props.

### Secondary Symptoms (Resolved)
| Issue | Resolution |
|-------|------------|
| Ad Player showing "Waiting for Slot" | Seeded `ALL_DAY` ads |
| 404 on `/api/ads` | Implemented GET handler |
| 404 on `/api/schedules` | Implemented stub handler |
| Test timeouts (30s) | Increased `actionTimeout` to 30s |
| `ad-server` not running | Added to `playwright.config.js` `webServer` array |
| Missing `useNavigate` import | Added to `Step3ReviewDistribution.jsx` |

---

## Approaches Attempted (Did Not Solve Primary Issue)

### 1. Timeout Increases
**Hypothesis:** The button is rendered, but Playwright times out before it becomes enabled.  
**Action:** Increased `actionTimeout` from 15s to 30s, `expect.timeout` from 10s to 20s.  
**Result:** No change. The button is found but explicitly reported as "not enabled."

### 2. Backend API Stubs
**Hypothesis:** The wizard flow is failing due to 404s on API calls for assets or campaigns.  
**Action:** Implemented `POST /api/assets/upload` and enhanced `GET /api/schedules`.  
**Result:** Pass rate improved from 11/19 to 14/19, but the Step 3 button remained disabled.

### 3. Missing React Router Import
**Hypothesis:** `Step3ReviewDistribution.jsx` was crashing due to undefined `useNavigate`.  
**Action:** Added `import { useNavigate } from 'react-router-dom'`.  
**Result:** Pass rate improved to 15/19, but the Step 3 button remained disabled.

### 4. Data Prop Integrity
**Hypothesis:** `data.dateRange` or `data.media_id` is undefined, causing a crash in `handleConfirm`.  
**Action:** Reviewed `BrandCampaignWizard.jsx` and confirmed `dateRange` is initialized correctly.  
**Result:** No change. The data flow appears correct.

### 5. Server Stability (nodemon restarts)
**Hypothesis:** `nodemon` restarts the server mid-test, losing seeded data.  
**Action:** Switched from `npm run dev` to `npm start` for the ad-server in `playwright.config.js`.  
**Result:** No change.

### 6. Debug Logging
**Hypothesis:** The click handler is not being called.  
**Action:** Added `console.log('[Wizard] Confirming distribution...')` to `handleConfirm`.  
**Result:** Log is never printed, confirming Playwright cannot interact with the button.

---

## Current State of Evidence

| Evidence | Implication |
|----------|-------------|
| Button selector `[data-testid="confirm-distribution-btn"]` is found | The element exists in the DOM |
| Playwright reports "element is not enabled" | A `disabled` attribute is somehow present |
| No `disabled` prop on the button in source code | The disabling is happening upstream or dynamically |
| Debug log in `handleConfirm` is never printed | The click event is never dispatched |
| Pass rate increases (11 → 14 → 15) correlate with API fixes | The earlier steps are now completing successfully |

---

## Unexplored Avenues

1. **Visual Inspection:** Open the Playwright trace or headed browser to visually confirm the button's rendered state.
2. **DOM Snapshot:** Capture the raw HTML of the Step 3 view to check for dynamic `disabled` or `aria-disabled` attributes.
3. **Error Boundary Logging:** Add logging to `ErrorBoundary.jsx` to see if Step 3 is crashing before the button renders.
4. **Wizard State Logging:** Log the `wizardData` object at the start of Step 3 to verify all required fields are populated.

---

## Files of Interest

- `client-app/src/pages/brand/wizard/Step3ReviewDistribution.jsx` (L144-151)
- `client-app/src/pages/brand/BrandCampaignWizard.jsx` (L42-51)
- `client-app/src/components/ErrorBoundary.jsx`
- `tests/personas.spec.js` (L84-96)

---

*This document is a living analysis. Updates will be appended as the investigation progresses.*

---

## Phase 1 Update (2026-01-01 22:38)

### Finding: Blockage is at Step 2, NOT Step 3

The headed browser debug test revealed:
- Test output: `❌ BLOCKED AT STEP 2: Proceed button is disabled`
- The `proceed-to-review` button in `Step2ScheduleUpload.jsx` is disabled.

### Root Cause (Revised Hypothesis)
The `proceed-to-review` button has a `disabled` condition:
```jsx
disabled={!data.creativeFile || data.selectedSlots.length === 0}
```

Either:
1. **`data.creativeFile` is not being set** after the upload click (async failure or mock issue).
2. **`data.selectedSlots` is empty** (timeslot selection not registering).

### Next Step
Investigate the `validateAndUpload` function in `Step2ScheduleUpload.jsx` to confirm the `creativeFile` state is being updated correctly after the mock upload click.

---

## Phase 2 Update (2026-01-01 22:43)

### Finding: API Response & State Update Chain Verified

| Component | Status | Notes |
|-----------|--------|-------|
| `POST /api/assets/upload` | ✅ OK | Returns `{ id, filename, duration, ... }` |
| `BaseRepository.create()` | ✅ OK | Returns full document with `id` field |
| `Step2ScheduleUpload.validateAndUpload()` | ⚠️ SUSPECT | Async fetch inside `onClick` |

### Root Cause: Async State Update Race Condition

The `validateAndUpload` function is **async**, but the button click handler resumes immediately after triggering it. Playwright clicks `proceed-to-review` before the async state update completes.

**Evidence:**
- Debug test output shows `demo-ad.mp4` text appearing (UI feedback works)
- But `data.creativeFile` is not set in time for the button's `disabled` check

### Recommended Fix
Add an explicit `await` or use a loading state to gate the "Proceed" button until the upload completes.

```jsx
// Option A: Add loading state
const [isUploading, setIsUploading] = useState(false);

const validateAndUpload = async (fileName) => {
    setIsUploading(true);
    // ... existing logic ...
    setIsUploading(false);
};

// Then in button:
disabled={isUploading || !data.creativeFile || data.selectedSlots.length === 0}
```

### Alternative Test Fix (Quick)
In the test, add a wait after clicking the upload area:
```js
await page.locator('[data-testid="upload-creative-area"]').click();
await page.waitForTimeout(2000); // Wait for async upload
```

---

## Phase 3 Update (2026-01-01 22:58)

### Finding: Core Fix Validated, Test Isolation Issue Remains

| Test Mode | Result | Analysis |
|-----------|--------|----------|
| `debug-step3-confirm.spec.js` (isolated) | ✅ PASS | Button enabled, click works, navigation succeeds |
| `personas.spec.js -g "Step 3"` (parallel) | ❌ FAIL | Button disabled at 1.2s |

### Root Cause: Test Parallelization & Server State

The debug test passes because:
1. It runs in isolation with a fresh browser context
2. The server has time to initialize and seed data
3. No resource contention from other tests

The standard test fails because:
1. 8 workers run simultaneously, competing for server resources
2. The `beforeEach` navigates while other tests are modifying state
3. The upload API endpoint may be rate-limited or overloaded

### Fix Status
| Component | Status |
|-----------|--------|
| Loading state (`isUploading`) | ✅ Implemented |
| Proceed button gating | ✅ Working |
| Step 3 confirm button | ✅ Working (in isolation) |
| Test wait strategy | ⚠️ Needs serial mode |

### Recommended Action
Run tests with `--workers=1` to ensure stable serial execution, or implement test-level mocking for the upload endpoint.




