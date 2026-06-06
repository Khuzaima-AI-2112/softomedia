# QA Test Plan — Sprints 1–4
**Softomedia Live 2026 · Demo & QA Tester Guide**
**Base URL:** `http://localhost:3001` (ad-server) · `http://localhost:5173` (client-app)
**Auth:** All protected requests require header `Authorization: Bearer demo-token` + `x-demo-role: superadmin`
**Tool:** Use any HTTP client — Bruno, Postman, curl, or browser DevTools Network tab.
**Date:** 2026-05-19

---

> **Before you start:** Open the client app at `http://localhost:5173`. Open browser DevTools → Network tab. Keep it open for all UI tests so you can verify the actual requests and responses alongside the visual behaviour.

---

## Sprint 1 — Core Infrastructure, Auth & API Client

These tests verify the server is alive, auth is enforced on protected routes, and the retry/error path works.

---

### T1.1 — Health check returns 200

**Type:** API
**Method:** `GET`
**URL:** `http://localhost:3001/api/health`
**Headers:** _(none required)_

**Expected response:**
```json
{ "status": "ok" }
```
**Pass if:** HTTP 200, body contains `"status": "ok"` or `"status": "healthy"`.
**Fail if:** Any non-200, timeout, or connection refused.

---

### T1.2 — Protected route rejects unauthenticated request

**Type:** API
**Method:** `GET`
**URL:** `http://localhost:3001/api/users`
**Headers:** _(send NO Authorization header)_

**Expected response:**
```json
{ "error": "Unauthorized" }
```
**Pass if:** HTTP 401.
**Fail if:** HTTP 200 or data is returned without a token.

---

### T1.3 — Protected route accepts valid demo token

**Type:** API
**Method:** `GET`
**URL:** `http://localhost:3001/api/users`
**Headers:**
```
Authorization: Bearer demo-token
x-demo-role: superadmin
```
**Expected response:** HTTP 200, body is an array (may be empty `[]`).
**Pass if:** Status 200, response is a JSON array.
**Fail if:** 401, 403, or non-array body.

---

### T1.4 — Invalid token returns 401

**Type:** API
**Method:** `GET`
**URL:** `http://localhost:3001/api/users`
**Headers:**
```
Authorization: Bearer totally-fake-token-xyz
x-demo-role: superadmin
```
**Pass if:** HTTP 401.
**Fail if:** HTTP 200 or data returned.

---

### T1.5 — Client app auto-seeds demo token on load

**Type:** UI / Browser
**Steps:**
1. Open `http://localhost:5173` in a fresh browser tab (or incognito).
2. Open DevTools → Application → Local Storage → `http://localhost:5173`.
3. Check for key `auth_token`.

**Pass if:** `auth_token` = `demo-token` is present without having logged in.
**Fail if:** Key is absent or empty.

---

### T1.6 — Client app request interceptor attaches auth headers

**Type:** UI / Browser
**Steps:**
1. Open `http://localhost:5173`, DevTools → Network tab.
2. Reload the page and observe any API call (e.g. to `/api/retailers` or `/api/screens`).
3. Click the request → Headers tab.

**Pass if:** Request headers include `Authorization: Bearer demo-token` and `x-demo-role: superadmin`.
**Fail if:** Either header is missing.

---

## Sprint 2 — Retailers, Stores, Screens, Campaigns

These tests verify the cascade data chain and entity CRUD endpoints.

---

### T2.1 — GET /api/retailers returns array

**Type:** API
**Method:** `GET`
**URL:** `http://localhost:3001/api/retailers`
**Headers:** _(no auth required — public route)_

**Pass if:** HTTP 200, body is a JSON array. Each item has at minimum an `id` (or `retailerid`) field and a `name` field.
**Fail if:** Non-200, non-array, or items have no identifiable ID field.

---

### T2.2 — GET /api/stores filters by retailerid

**Type:** API
**Method:** `GET`
**URL:** `http://localhost:3001/api/stores?retailerid=1`
**Headers:** _(no auth required)_

**Pass if:** HTTP 200, returns array. All returned items are associated with retailer `1` (verify `retailerid` or `retailer_id` field on items).
**Fail if:** Returns stores from other retailers, or HTTP error.

> **Edge case — T2.2b:** Call `GET /api/stores` with **no** `retailerid` param. Verify it returns all stores (not an error).

---

### T2.3 — GET /api/screens filters by storeid

**Type:** API
**Method:** `GET`
**URL:** `http://localhost:3001/api/screens?storeid=1`
**Headers:** _(no auth required)_

**Pass if:** HTTP 200, array returned. Items belong to store `1`.
**Fail if:** Returns screens from other stores, or HTTP error.

---

### T2.4 — Cascade selector chain works in UI (Superadmin)

**Type:** UI
**Steps:**
1. Open `http://localhost:5173`, navigate to the Loop Demo Player page.
2. Confirm the **Retailer Context** selector is visible in the header (superadmin role should show this).
3. Select a retailer from the dropdown.
4. Observe the **Store** dropdown — it should populate with stores belonging to that retailer only.
5. Select a store.
6. Observe the **Screen** dropdown — it should populate with screens belonging to that store only.
7. Select a screen.

**Pass if:** Each downstream dropdown populates correctly after the upstream selection. No stale data from a previous selection appears.
**Fail if:** Store or screen dropdown stays empty, shows data from wrong parent, or throws a console error.

---

### T2.5 — Cascade resets on upstream change

**Type:** UI
**Steps:**
1. Complete the full cascade selection (retailer → store → screen).
2. Change the **Retailer** selection to a different retailer.
3. Observe the Store and Screen dropdowns.

**Pass if:** Both Store and Screen dropdowns reset and repopulate for the new retailer. No screen from the previous retailer remains selected.
**Fail if:** Store or screen retains the old selection after the retailer changes.

---

### T2.6 — GET /api/campaigns returns data

**Type:** API
**Method:** `GET`
**URL:** `http://localhost:3001/api/campaigns`
**Headers:** _(no auth required)_

**Pass if:** HTTP 200, JSON array or object returned.
**Fail if:** 404 or 500.

---

### T2.7 — Create a retailer (POST)

**Type:** API
**Method:** `POST`
**URL:** `http://localhost:3001/api/retailers`
**Headers:**
```
Authorization: Bearer demo-token
x-demo-role: superadmin
Content-Type: application/json
```
**Body:**
```json
{
  "name": "QA Test Retailer",
  "email": "qa@testretailer.com"
}
```
**Pass if:** HTTP 201 (or 200), response includes the created retailer with an `id`.
**Fail if:** 400, 422, or 500.
**Cleanup:** Note the returned `id`. Delete it after the test with `DELETE /api/retailers/{id}`.

---

## Sprint 3 — Loops, Business Hours, Loop Generation

These tests verify the P0-fixed loop endpoint and its response shape.

---

### T3.1 — GET /api/loops returns envelope shape

**Type:** API
**Method:** `GET`
**URL:** `http://localhost:3001/api/loops`
**Headers:** _(no auth required)_

**Expected response shape:**
```json
{
  "loops": [ ... ],
  "business_hours": { ... }
}
```
**Pass if:** HTTP 200, body has a `loops` key containing an array, and a `business_hours` key.
**Fail if:** Body is a bare array (old broken shape), missing `loops` key, or HTTP error.

> ⚠️ This is the **P0 regression test** — a bare array response means the fix has been reverted.

---

### T3.2 — GET /api/loops filters by screenid (lowercase)

**Type:** API
**Method:** `GET`
**URL:** `http://localhost:3001/api/loops?screenid=1&date=2026-05-19`
**Headers:** _(no auth required)_

**Pass if:** HTTP 200, `loops` array contains only loops for screen `1`. If no loops exist for that screen/date, `loops` is `[]` — this is still a pass.
**Fail if:** HTTP error, or `loops` key is missing from the response.

---

### T3.3 — GET /api/loops filters by screen_id (underscore variant)

**Type:** API
**Method:** `GET`
**URL:** `http://localhost:3001/api/loops?screen_id=1&date=2026-05-19`
**Headers:** _(no auth required)_

**Pass if:** Same result as T3.2 — both spellings must work identically (dual-spelling fix).
**Fail if:** Different result from T3.2, HTTP error, or `loops` is not an array.

---

### T3.4 — GET /api/loops with date filter

**Type:** API
**Method:** `GET`
**URL:** `http://localhost:3001/api/loops?date=2026-05-19`
**Headers:** _(no auth required)_

**Pass if:** HTTP 200, `loops` contains only loops for `2026-05-19` (or empty array if none generated yet). `business_hours` key present.
**Fail if:** Loops from other dates appear in the result, or response is malformed.

---

### T3.5 — GET /api/loops with no params returns all loops

**Type:** API
**Method:** `GET`
**URL:** `http://localhost:3001/api/loops`

**Pass if:** HTTP 200, `loops` is an array (may be large or empty). Response time under 3 seconds.
**Fail if:** HTTP error or missing `loops` key.

---

### T3.6 — Business hours are present in response

**Type:** API
**Method:** `GET`
**URL:** `http://localhost:3001/api/loops?date=2026-05-19`

**Pass if:** `business_hours` in the response is not `null` and contains at least `start` and `end` fields (e.g. `{ "start": 8, "end": 22 }`).
**Fail if:** `business_hours` is `null`, missing, or empty `{}`.

---

### T3.7 — Loop generation endpoint (POST)

**Type:** API
**Method:** `POST`
**URL:** `http://localhost:3001/api/loops/generate`
**Headers:**
```
Authorization: Bearer demo-token
x-demo-role: superadmin
Content-Type: application/json
```
**Body:**
```json
{ "date": "2026-05-20" }
```
**Pass if:** HTTP 200 or 201, response confirms loops were generated (message or count field present).
**Fail if:** 404 (route doesn't exist), 500, or 401.

> If this route doesn't exist yet, mark as **SKIP — not implemented** and log for Sprint 5.

---

## Sprint 4 — LoopDemoPlayer, Playback, Superadmin UI

These tests verify the full end-to-end demo player flow.

---

### T4.1 — Play button is disabled until all three selectors are filled

**Type:** UI
**Steps:**
1. Open the Loop Demo Player page.
2. With no selections made, observe the **Play** button.
3. Select only the Retailer. Check Play button.
4. Select Retailer + Store. Check Play button.
5. Select Retailer + Store + Screen. Check Play button.

**Pass if:** Play button is disabled (greyed out / unclickable) at steps 2, 3, and 4. Play button becomes enabled only at step 5.
**Fail if:** Play button is clickable with incomplete selections, or remains disabled after all three are selected.

---

### T4.2 — Play button triggers loop fetch for correct screen and date

**Type:** UI + Network
**Steps:**
1. Complete cascade selection for a known screen (e.g. Screen ID 1).
2. Set date to `2026-05-19`.
3. Open DevTools → Network tab.
4. Click **Play**.
5. Observe the network request fired.

**Pass if:** A `GET /api/loops?screenid=1&date=2026-05-19` (or `screen_id=1`) request is made. Response body has `loops` array (not bare array).
**Fail if:** Request is missing the `screenid` or `date` param, or response is a bare array.

---

### T4.3 — Player renders loop list after fetch

**Type:** UI
**Steps:**
1. Complete steps 1–4 of T4.2.
2. Observe the player UI after the fetch completes.

**Pass if:** Loop items appear in the player (track names, durations, or slot info rendered). If no loops exist for that screen/date, a "no loops" or empty state message appears — this is also a pass.
**Fail if:** Blank screen with no content and no empty state message. Console errors referencing `.map is not a function` or `Cannot read properties of undefined`.

> ⚠️ `.map is not a function` is the exact error the P0 fix addresses. If this error appears, the fix has been reverted.

---

### T4.4 — Progress bar advances during playback

**Type:** UI
**Steps:**
1. Ensure at least one loop is loaded in the player.
2. Click **Play**.
3. Wait 3–5 seconds and observe the progress bar.

**Pass if:** Progress bar visibly advances. It does not jump or reset unexpectedly within the first 10 seconds.
**Fail if:** Progress bar stays at 0%, jumps erratically, or resets immediately.

---

### T4.5 — Superadmin sees Retailer Context selector; non-superadmin does not

**Type:** UI
**Steps:**
1. In DevTools → Application → Local Storage, set `demo_role` = `superadmin`. Reload.
2. Observe the header — the **Retailer Context** selector should be visible.
3. Change `demo_role` to `retailer_admin`. Reload.
4. Observe the header — the Retailer Context selector should be gone.

**Pass if:** Selector appears for `superadmin` and is hidden for `retailer_admin`.
**Fail if:** Selector appears for non-superadmin roles, or is never visible even for superadmin.

---

### T4.6 — Changing date resets loops but preserves selectors

**Type:** UI
**Steps:**
1. Complete cascade selection and click Play to load loops.
2. Change the **date** input to a different date.
3. Observe the loop list and the cascade selectors.

**Pass if:** Loop list clears/reloads for the new date. The retailer, store, and screen dropdowns retain their selections (no reset).
**Fail if:** Cascade dropdowns reset when the date changes, or loops from the old date remain visible.

---

## Edge Cases & Negative Tests

| Test ID | Scenario | Method + URL | Expected |
|---|---|---|---|
| E1 | Unknown screen ID | `GET /api/loops?screenid=99999&date=2026-05-19` | 200, `loops: []` |
| E2 | Invalid date format | `GET /api/loops?date=not-a-date` | 200 with `loops: []` OR 400 with error message |
| E3 | Missing route | `GET /api/nonexistent` | 404 |
| E4 | GET single retailer by ID | `GET /api/retailers/1` | 200 with single retailer object |
| E5 | GET single screen by ID | `GET /api/screens/1` | 200 with single screen object |
| E6 | GET screen with no storeid | `GET /api/screens` | 200, all screens array |
| E7 | Notifications stub | `GET /api/notifications` | Should return 200 or 404 — **do not expect real data; log result** |

---

## Test Results Log

Use this table to record outcomes during the session.

| Test ID | Description | Result | Notes |
|---|---|---|---|
| T1.1 | Health check | ⬜ Pass / ⬜ Fail | |
| T1.2 | Unauth rejected | ⬜ Pass / ⬜ Fail | |
| T1.3 | Valid token accepted | ⬜ Pass / ⬜ Fail | |
| T1.4 | Invalid token rejected | ⬜ Pass / ⬜ Fail | |
| T1.5 | Auto-seed demo token | ⬜ Pass / ⬜ Fail | |
| T1.6 | Auth headers in request | ⬜ Pass / ⬜ Fail | |
| T2.1 | GET retailers | ⬜ Pass / ⬜ Fail | |
| T2.2 | GET stores filter | ⬜ Pass / ⬜ Fail | |
| T2.3 | GET screens filter | ⬜ Pass / ⬜ Fail | |
| T2.4 | Cascade UI chain | ⬜ Pass / ⬜ Fail | |
| T2.5 | Cascade reset | ⬜ Pass / ⬜ Fail | |
| T2.6 | GET campaigns | ⬜ Pass / ⬜ Fail | |
| T2.7 | POST create retailer | ⬜ Pass / ⬜ Fail | |
| T3.1 | Loops envelope shape | ⬜ Pass / ⬜ Fail | |
| T3.2 | Filter by screenid | ⬜ Pass / ⬜ Fail | |
| T3.3 | Filter by screen_id | ⬜ Pass / ⬜ Fail | |
| T3.4 | Filter by date | ⬜ Pass / ⬜ Fail | |
| T3.5 | No params returns all | ⬜ Pass / ⬜ Fail | |
| T3.6 | Business hours present | ⬜ Pass / ⬜ Fail | |
| T3.7 | Loop generation POST | ⬜ Pass / ⬜ Skip | |
| T4.1 | Play button gating | ⬜ Pass / ⬜ Fail | |
| T4.2 | Play fires correct request | ⬜ Pass / ⬜ Fail | |
| T4.3 | Loop list renders | ⬜ Pass / ⬜ Fail | |
| T4.4 | Progress bar advances | ⬜ Pass / ⬜ Fail | |
| T4.5 | Superadmin selector visibility | ⬜ Pass / ⬜ Fail | |
| T4.6 | Date change preserves selectors | ⬜ Pass / ⬜ Fail | |
| E1–E7 | Edge cases | ⬜ Pass / ⬜ Fail | |
