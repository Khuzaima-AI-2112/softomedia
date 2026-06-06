# QA Demo Session — Test Checklist
**Softomedia Live 2026 · Sprints 1–4**
**Date:** 2026-05-19

---

## Setup (do this first)

- [ ] Ad-server running at `http://localhost:3001`
- [ ] Client app running at `http://localhost:5173`
- [ ] Browser DevTools open → Network tab
- [ ] HTTP client ready (Postman, Bruno, or curl)

---

## 1 — Server is alive

| # | What to do | Pass |
|---|---|---|
| 1.1 | `GET /api/health` — no headers | `{ "status": "ok" }` |
| 1.2 | `GET /api/users` — no headers | HTTP **401** |
| 1.3 | `GET /api/users` with `Authorization: Bearer demo-token` + `x-demo-role: superadmin` | HTTP **200**, array |

---

## 2 — Retailers, Stores & Screens

| # | What to do | Pass |
|---|---|---|
| 2.1 | `GET /api/retailers` | 200, array with names |
| 2.2 | `GET /api/stores?retailerid=1` | 200, stores for retailer 1 only |
| 2.3 | `GET /api/screens?storeid=1` | 200, screens for store 1 only |

---

## 3 — Loops (P0 fix)

| # | What to do | Pass |
|---|---|---|
| 3.1 | `GET /api/loops` | Body has **`loops` array** + `business_hours` — NOT a bare array |
| 3.2 | `GET /api/loops?screenid=1&date=2026-05-19` | `loops` filtered for screen 1 |
| 3.3 | `GET /api/loops?screen_id=1&date=2026-05-19` | **Same result as 3.2** (both spellings work) |
| 3.4 | `GET /api/loops?screenid=99999&date=2026-05-19` | 200, `loops: []` — no crash |

---

## 4 — Demo Player (UI)

Open `http://localhost:5173` → Loop Demo Player

| # | What to do | Pass |
|---|---|---|
| 4.1 | Page loads with no errors in console | ✓ |
| 4.2 | **Play button is greyed out** with nothing selected | ✓ |
| 4.3 | Select Retailer → Store dropdown populates | ✓ |
| 4.4 | Select Store → Screen dropdown populates | ✓ |
| 4.5 | Select Screen → **Play button becomes clickable** | ✓ |
| 4.6 | Click Play → Network tab shows `GET /api/loops?screenid=X&date=...` | ✓ |
| 4.7 | Loop list renders OR a “no loops” message appears — **no blank screen** | ✓ |
| 4.8 | Progress bar moves after clicking Play | ✓ |
| 4.9 | Change Retailer → Store + Screen dropdowns reset | ✓ |
| 4.10 | Change date → loops reload, selectors stay the same | ✓ |

---

## 5 — Role visibility

| # | What to do | Pass |
|---|---|---|
| 5.1 | In LocalStorage set `demo_role = superadmin` → reload → **Retailer Context selector visible** in header | ✓ |
| 5.2 | Change `demo_role = retailer_admin` → reload → **selector is gone** | ✓ |

---

## 🚨 Critical fail signals

- `GET /api/loops` returns a bare `[ ]` array → P0 fix reverted
- Console shows `.map is not a function` → P0 fix reverted
- Play button never enables → cascade selector broken
- Any route returns 500 → log immediately

---

## Results

| Section | Pass | Fail | Notes |
|---|---|---|---|
| 1 — Server | | | |
| 2 — Entities | | | |
| 3 — Loops | | | |
| 4 — Player UI | | | |
| 5 — Roles | | | |
