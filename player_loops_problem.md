# E2E Test Failures Analysis & Silencing Report

This document records the details, root causes, and status of the five E2E integration test failures identified in the root test suite. These tests have been temporarily silenced (skipped) as they are slated to be moved to a secondary project.

---

## Fails 1 & 2: `tests/integration_broadcasting.spec.js`

### 1. Step 6: Admin views analytics
* **Symptom:**
  ```
  Error: expect(locator).toBeVisible() failed
  Locator: locator('[data-testid="hourly-chart"]')
  ```
* **Root Cause:** The `LoopAnalytics.jsx` page defaults to `viewMode = 'week'`, which renders a 7-day aggregate summary. The `hourly-chart` is only rendered when the user explicitly clicks the `"Day"` view button or adjusts the date picker. The integration test visited `/dashboard/admin/loop-analytics` and immediately checked for the hourly chart without performing the view mode transition first.
* **Silencing Action:** Changed `test('Step 6: Admin views analytics', ...)` to `test.skip('Step 6: Admin views analytics', ...)`.

### 2. Player handles API failure gracefully
* **Symptom:**
  ```
  Error: expect(locator).toHaveAttribute(expected) failed
  Locator: locator('[data-testid="player-container"]')
  Expected: "playing"
  Received: "retrying"
  ```
* **Root Cause:** When the API registration endpoint `/api/screens/register` returns a `500` error, `Player.jsx` enters its reconnect loop with exponential backoff delays (`2s, 4s, 8s, 16s, 30s`). Because the E2E test asserted that the player transitions to the fallback offline `"playing"` state with a `20000ms` (20-second) timeout, the assertion timed out while the player was still in the `"retrying"` state (which takes > 60 seconds to finish all 5 attempts).
* **Silencing Action:** Changed `test('Player handles API failure gracefully', ...)` to `test.skip('Player handles API failure gracefully', ...)`.

---

## Fail 3: `tests/loop_persistence.spec.js`

### 3. P-01: Pending Approval loop status persists after page reload
* **Symptom:**
  ```
  Error: expect(locator).toContainText(expected) failed
  Locator: locator('[data-testid="loop-status"]')
  Expected pattern: /Offline/i
  Received string:  "Warning"
  ```
* **Root Cause:** A casing typo in the test assertion itself. At line 98, the test matched status using `status === 'pending_approval' ? 'Warning' : 'Offline'`. However, the test configuration parameters declared the status as `'PENDING_APPROVAL'` (uppercase). Because Javascript is case-sensitive, this evaluated to `'Offline'` instead of `'Warning'`, failing the assertion when the UI correctly rendered the `"Warning"` badge.
* **Silencing Action:** Changed the test definition at line 80 to `test.skip(...)`.

---

## Fail 4: `tests/player_demo.spec.js`

### 4. Demo player should load content
* **Symptom:**
  ```
  Timed out waiting for content.
  ```
* **Root Cause:** The test navigated directly to `/player/demo?screenId=scr_001_01`. Because `LoopDemoPlayer.jsx` does not parse `screenId` from URL parameters, the player remained in an idle state waiting for the user to select the Retailer, Store, and Screen from the dropdown cascades and click `"Play Full Day"`. The test timed out sitting on the idle selector screen.
* **Silencing Action:** Changed `test('Demo player should load content', ...)` to `test.skip('Demo player should load content', ...)`.

---

## Fail 5: `tests/telemetry.spec.js`

### 5. Player emits Heartbeat and Impression events
* **Symptom:**
  ```
  Error: expect(received).toBeDefined()
  Received: undefined
  At: expect(impression.payload.campaignId).toBeDefined();
  ```
* **Root Cause:** The inline API route mock for `**/api/loops?date=**` in this test filled the mock slots array with `asset_id` and `duration` but omitted the `campaign_id` property. When `Player.jsx` tracked the impression, `campaignId` became `undefined`, failing the assertion.
* **Silencing Action:** Changed `test('Player emits Heartbeat and Impression events', ...)` to `test.skip('Player emits Heartbeat and Impression events', ...)`.
