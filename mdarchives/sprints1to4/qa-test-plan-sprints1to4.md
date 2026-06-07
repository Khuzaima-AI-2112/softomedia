# QA Test Plan — Sprints 1–4 (API)
**Softomedia Live 2026**
**Date:** 2026-05-19

---

## Sprint 1 — Auth & Infrastructure

### T1.1 Health Endpoint
- `GET /api/health` — no headers
- **Assert:** 200, `{ status: 'ok' }`

### T1.2 Protected Route — No Token
- `GET /api/users` — no headers
- **Assert:** 401

### T1.3 Protected Route — Wrong Token
- `GET /api/users`, `Authorization: Bearer badtoken`
- **Assert:** 401

### T1.4 Protected Route — Valid Token
- `GET /api/users`, superadmin headers
- **Assert:** 200, array

---

## Sprint 2 — Retailers, Stores, Screens, Campaigns

### T2.1 List Retailers
- **Assert:** 200, items have `id` + `name`

### T2.2 Stores Filtered by Retailer
- `GET /api/stores?retailerid=1`
- **Assert:** All items `retailer_id == 1`

### T2.3 Screens Filtered by Store
- `GET /api/screens?storeid=1`
- **Assert:** All items `store_id == 1`

### T2.4 Unknown Retailer — Graceful Empty
- `GET /api/stores?retailerid=999999`
- **Assert:** 200, `[]` — NOT 500

---

## Sprint 3 — Loops (P0 Regression Suite)

### T3.1 ⚠️ P0 — Response Shape
- `GET /api/loops`
- **Assert:** `{ loops: Array, business_hours: Object }` — NOT bare array

### T3.2 Dual Spelling — `screenid`
- `GET /api/loops?screenid=1&date=2026-05-19`
- **Assert:** `loops` filtered to screen 1

### T3.3 Dual Spelling — `screen_id`
- `GET /api/loops?screen_id=1&date=2026-05-19`
- **Assert:** Identical to T3.2

### T3.4 Unknown Screen — Graceful Empty
- `GET /api/loops?screenid=99999&date=2026-05-19`
- **Assert:** 200, `{ loops: [], business_hours: {...} }`

### T3.5 Business Hours Never Null
- Three calls: no params / date only / date+screenid
- **Assert:** All have complete `business_hours`

---

## Sprint 4 — LoopDemoPlayer (UI)

### T4.1 Page Load — No Console Errors
- **Assert:** Zero red errors, no `.map is not a function`

### T4.2 Play Button Gating
- Nothing → Retailer → Store → Screen
- **Assert:** Play enables only after all three selected

### T4.3 Cascade Reset
- Full selection → change Retailer
- **Assert:** Store + Screen reset, Play disabled

### T4.4 API Call Shape on Play
- **Assert:** `GET /api/loops?screenid=<id>&date=YYYY-MM-DD` (not ISO timestamp)

---

## Edge & Negative Cases

| ID | Input | Expected |
|----|-------|----------|
| E-1 | `GET /api/loops?screenid=abc` | 200, `loops: []` — no 500 |
| E-2 | `GET /api/loops?date=not-a-date` | 200 or 400 — no 500 |
| E-3 | `POST /api/loops/generate` — no body | 400, clear message |
| E-4 | `GET /api/retailers` — no auth | 401 |
| E-5 | Rapid retailer re-selection ×5 | No duplicate stacked requests |
