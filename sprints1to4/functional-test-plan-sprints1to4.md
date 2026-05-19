# Functional Test Plan — Sprints 1–4
**Softomedia Live 2026**
**Date:** 2026-05-19 | **Tester:** _________________ | **Build:** `main`

---

## Scope

| Sprint | Feature Area |
|--------|-------------|
| 1 | Auth middleware, API client, health endpoint |
| 2 | Retailers, Stores, Screens, Campaigns — CRUD & filtering |
| 3 | Loops — generation, filtering, business hours, slot lifecycle |
| 4 | LoopDemoPlayer — cascade selector, playback, role visibility |

---

## Test Environment

| Item | Value |
|------|-------|
| Ad-server | `http://localhost:3001` |
| Client app | `http://localhost:5173` |
| Auth token | `demo-token` |
| Superadmin headers | `Authorization: Bearer demo-token` + `x-demo-role: superadmin` |
| Retailer headers | `Authorization: Bearer demo-token` + `x-demo-role: retailer_admin` |

---

## Sprint 1 — Auth & Infrastructure

### FT-1.1 Health Check
**Steps:** `GET /api/health` — no headers  
**Expected:** HTTP `200`, `{ "status": "ok", "timestamp": "<ISO>", "uptime": <number> }`

### FT-1.2 Protected Route Rejects No Token
**Steps:** `GET /api/users` — no headers  
**Expected:** HTTP `401`

### FT-1.3 Protected Route Rejects Bad Token
**Steps:** `GET /api/users`, `Authorization: Bearer wrongtoken`  
**Expected:** HTTP `401`

### FT-1.4 Protected Route Accepts Valid Token
**Steps:** `GET /api/users` + superadmin headers  
**Expected:** HTTP `200`, array

### FT-1.5 Client Auto-Seeds Demo Token
**Steps:** Open app → DevTools → Application → Local Storage  
**Expected:** Key `auth_token` = `demo-token`

### FT-1.6 Client Attaches Auth Headers on Every Request
**Steps:** DevTools → Network → trigger any dropdown → inspect request  
**Expected:** `Authorization: Bearer demo-token` AND `x-demo-role` present

---

## Sprint 2 — Retailers, Stores, Screens, Campaigns

### FT-2.1 List All Retailers
**Expected:** 200, array, items have `id` + `name`

### FT-2.2 List Stores Filtered by Retailer
**Steps:** `GET /api/stores?retailerid=1`  
**Expected:** 200, all items `retailer_id == 1`

### FT-2.3 Store Filter Isolation
**Steps:** Compare `?retailerid=1` vs `?retailerid=2`  
**Expected:** Different datasets

### FT-2.4 List Screens Filtered by Store
**Steps:** `GET /api/screens?storeid=<id>`  
**Expected:** 200, items have `id` + `store_id`

### FT-2.5 List Campaigns
**Expected:** 200, items have `id`, `name`, `status`

### FT-2.6 Campaign Filter by Retailer
**Steps:** `GET /api/campaigns?retailer_id=1`  
**Expected:** All items belong to retailer 1

### FT-2.7 Unknown Retailer Returns Empty
**Steps:** `GET /api/stores?retailerid=999999`  
**Expected:** 200, `[]` — NOT 500

---

## Sprint 3 — Loops & Business Hours

### FT-3.1 ⚠️ P0 — Loops Response Shape
**Steps:** `GET /api/loops`  
**Expected:** `{ "loops": [...], "business_hours": { "start": 8, "end": 22, "is_closed": false, "total_loops": 14 } }`  
**FAIL if:** bare array returned.

### FT-3.2 Loop Filter by `screenid`
**Steps:** `GET /api/loops?screenid=<id>&date=2026-05-19`  
**Expected:** `loops` filtered to that screen, `business_hours` present

### FT-3.3 Loop Filter by `screen_id`
**Steps:** `GET /api/loops?screen_id=<id>&date=2026-05-19`  
**Expected:** Identical to FT-3.2

### FT-3.4 Loop Filter by Date
**Steps:** `GET /api/loops?date=2026-05-19`  
**Expected:** All loops have `date === '2026-05-19'`

### FT-3.5 Unknown Screen — Graceful Empty
**Expected:** 200, `{ loops: [], business_hours: {...} }`

### FT-3.6 Business Hours Never Null
**Steps:** Three calls — no params / date only / date+screenid  
**Expected:** All have complete `business_hours`

### FT-3.7 Get Single Loop by ID
**Expected:** 200, object with `slots` array

### FT-3.8 Get Single Loop — Not Found
**Expected:** 404, `{ error: 'Loop not found' }`

### FT-3.9 Generate Mock Loops
**Steps:** `POST /api/loops/generate`, body `{ targetDate, retailerId, locationId, mock: true }`  
**Expected:** 201, `loops` array + `message` + `business_hours`

### FT-3.10 Generate Loops — Missing Fields
**Expected:** 400, error listing missing fields

### FT-3.11 Approve a Loop
**Steps:** `PATCH /api/loops/<id>/approve`, body `{ userId: 'demo-user-1' }`  
**Expected:** 200, loop has updated `status`

### FT-3.12 Reject a Slot — Valid
**Steps:** `PATCH /api/loops/<id>/slots/1/reject`, body `{ reason: 'Off-brand imagery' }`  
**Expected:** 200, slot has `status: 'rejected'` + `rejection_reason`

### FT-3.13 Reject a Slot — Missing Reason
**Expected:** 400, `{ error: 'Rejection reason is required' }`

### FT-3.14 Get Pending Loops for Retailer
**Steps:** `GET /api/loops/pending/1`  
**Expected:** 200, `{ loops: [...], count: <number> }`, count matches array length

---

## Sprint 4 — Loop Demo Player (UI)

### FT-4.1 Initial Page Load — No Errors
**Expected:** Zero red console errors, no TypeError

### FT-4.2 Play Button Gating
**Expected:** Play enables only after all three dropdowns selected

### FT-4.3 Cascade — Retailer Populates Store
**Expected:** Store dropdown fills; Screen stays empty

### FT-4.4 Cascade — Store Populates Screen
**Expected:** Screen dropdown fills

### FT-4.5 Cascade Reset
**Steps:** Full selection → change Retailer  
**Expected:** Store + Screen reset, Play disabled

### FT-4.6 Play — Correct API Call Shape
**Expected:** `GET /api/loops?screenid=<id>&date=YYYY-MM-DD` (not ISO timestamp)

### FT-4.7 Play — Loops Render or Empty State
**Expected:** Loop list OR "no loops" message — no blank screen

### FT-4.8 Progress Bar Advances
**Expected:** Bar animates — not frozen at 0

### FT-4.9 Date Change Reloads Loops
**Expected:** New API call fires, loops refresh, selectors preserved

### FT-4.10 Role — Superadmin Sees Retailer Context Selector
**Expected:** Selector visible

### FT-4.11 Role — Retailer Admin Hides Selector
**Expected:** Selector hidden

---

## Edge & Negative Cases

| ID | Test | Expected |
|----|------|----------|
| E-1 | `GET /api/loops?screenid=abc` | 200, `loops: []` — no 500 |
| E-2 | `GET /api/loops?date=not-a-date` | 200 or 400 — no 500 |
| E-3 | `POST /api/loops/generate` — no body | 400, clear message |
| E-4 | `GET /api/retailers` — no auth | 401 |
| E-5 | Rapid retailer re-selection ×5 | No stacked duplicate calls |
| E-6 | Play → change date → Play again | Second response wins, no stale data |

---

## Results Summary

| Sprint | Test IDs | Pass | Fail | Blocked | Notes |
|--------|----------|------|------|---------|-------|
| Sprint 1 — Auth | FT-1.1 → 1.6 | | | | |
| Sprint 2 — Entities | FT-2.1 → 2.7 | | | | |
| Sprint 3 — Loops | FT-3.1 → 3.14 | | | | |
| Sprint 4 — Player UI | FT-4.1 → 4.11 | | | | |
| Edge Cases | E-1 → E-6 | | | | |
| **TOTAL** | **44** | | | | |

---

## Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| QA Tester | | | |
| Dev Lead | | | |
| Product Owner | | | |
