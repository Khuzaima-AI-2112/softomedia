# Sprints 1–4 QA Summary — Softomedia Live 2026

> **Stack:** React 18 + Vite 5 (`client-app`), Express.js (`ad-server`), Firestore (NoSQL), Zustand
> **Repo:** `cfroszte/softomedia-live2026`
> **Date:** 2026-05-19

---

## Sprint 1 — Users Module (`/dashboard/admin/users`)

**Status: ✅ Complete**
**Reliability: 82%**

All 8 tasks completed and marked ✅ in `SPRINT_QA_TASKS.md`.

### What Was Built
- `POST /api/users` with full field validation: `name`, `email`, `role` (enum), `linkedentityid` (conditional on role)
- `DELETE /api/users/:id` with 404 guard before deletion
- `UserRepository.create(data)` and `UserRepository.delete(id)` methods
- Frontend: "Create User" modal submit wired to `POST /api/users` via `ApiService.js`
- Frontend: Delete icon (`Trash2`) added to users table with confirmation prompt
- `createUser(data)` and `deleteUser(id)` methods added to `api.js`

### Known Risks
- **No duplicate email guard** — Firestore `users` collection has no unique constraint; two users can be created with the same email without a server-side check
- Frontend modal error display and state-append logic unverified (no test coverage)

---

## Sprint 2 — Retailers Module (`/dashboard/admin/retailers`)

**Status: ⚠️ Implemented — Field Mismatch Risk**
**Reliability: 74%**

### What Was Built
- `POST /api/retailers` — validates `name`, `contact_email`, `contract_start`; defaults `status = 'active'`
- `DELETE /api/retailers/:id` — soft-delete sets `status = 'inactive'` via `RetailerRepository.softDelete(id)`
- `PATCH /api/retailers/:id` — status toggle between `active` / `inactive` with enum validation
- `RetailerRepository.softDelete(id)` and `RetailerRepository.updateStatus(id, status)` implemented
- Frontend: "Add Retailer" form, Remove action, and status toggle wired in `RetailerManagement.jsx`

### Known Risks
- **P1 — Field name mismatch:** Task spec defines frontend payload as `{ contactemail, contractstart }` (flat), but backend validates `contact_email` and `contract_start` (snake_case). Any mismatch will produce silent `400` errors on every create attempt.
- **P2 — Missing 404 on PATCH:** `PATCH /api/retailers/:id` does not check for document existence before calling `updateStatus`; a non-existent ID throws an uncaught Firestore error instead of returning a clean `404`.

---

## Sprint 3 — Advertisers Module (`/dashboard/admin/advertisers`)

**Status: ⚠️ Backend Complete — Frontend Unverified**
**Reliability: 71%**

### What Was Built
- `POST /api/advertisers` — validates all 6 fields; generates `adv_`-prefixed document ID (`adv_{timestamp}_{random}`)
- `DELETE /api/advertisers/:id` — soft-delete sets `status = 'suspended'` to preserve campaign referential integrity
- `AdvertiserRepository.create(docId, data)` and `AdvertiserRepository.softDelete(id)` implemented
- Frontend tasks 3.4 and 3.5 scoped (Add Advertiser form, Remove action in `AdvertiserManagement.jsx`)

### Known Risks
- **P1 — `logo` required on backend, may be optional on frontend:** Backend returns `400` if `logo` is missing; if the frontend form doesn't enforce it, users will receive a silent failure with no clear UI error message.
- **P2 — Frontend completion unverified:** Tasks 3.4 and 3.5 have no ✅ marker in the task file — actual wiring of the submit handler and delete action in `AdvertiserManagement.jsx` is unconfirmed.

---

## Sprint 4 — Demo Player (`/player`)

**Status: 🔴 Frontend Built — P0 API Mismatch Blocks Playback**
**Reliability: 55%**

All three tasks implemented in `client-app/src/pages/LoopDemoPlayer.jsx` in commit [`af93259`](https://github.com/cfroszte/softomedia-live2026/commit/af932598ea25e6cbc076d8c6c76c57530068ca65).

### What Was Built

**Task 4.1 — Cascading Retailer → Store → Screen Selector**
- Three dependent dropdowns: Retailer fetches on mount, Store enabled after Retailer selected, Screen enabled after Store selected
- Selecting a new Retailer resets Store + Screen + loaded loops
- "Play Full Day" button disabled until all three selections are made
- Placeholder copy guides the user: `"Select a Retailer first"` / `"Select a Store first"`

**Task 4.2 — Full-Day Schedule Playback**
- `handlePlay()` calls `GET /api/loops?screenid=<id>&date=<date>` and stores the full day's loop array
- Two-counter advancement: `currentSlotIndex` (0–11) increments per slot; `currentLoopIndex` advances after slot 11
- No loop repeats until all loops in the day have fully played — full cycle before restart
- Loop N / Total badge visible in player overlay during playback

**Task 4.3 — SuperAdmin Retailer Context Selector**
- Reads role from `localStorage` (`demo_role` or `active_persona`)
- "Retailer Context" dropdown renders adjacent to "Retailer Command Center" heading **only when `role === 'superadmin'`**
- All downstream API calls (stores → screens → loops) scoped to the selected `retailerId`
- Hidden for all non-superadmin roles

### P0 Blocker — Loops API Mismatch

| Issue | Detail |
|---|---|
| **Query param mismatch** | Player sends `?screenid=<id>` — backend `loops.js` only recognizes `location_id` and `retailer_id`; `screenid` is silently ignored |
| **Response shape mismatch** | Backend returns `{ loops: [...], business_hours: {...} }` (object); player does `Array.isArray(data) ? data : []` which always resolves to `[]` |
| **Net result** | Playback always shows "No loops scheduled for this screen and date" — dead on arrival until fixed |

### Additional Risks
- **Role detection via `localStorage`:** If a Zustand auth store exists and is not synced to `localStorage`, `getRole()` returns an empty string and the superadmin context selector never renders.
- **`getLoopByParams` removed:** The old `ApiService` method `getLoopByParams` used in the previous player version no longer exists — confirmed not needed for the new architecture, but any other component that called it will throw.

---

## Overall Reliability Matrix

| Sprint | Module | Reliability | Top Blocker |
|---|---|---|---|
| Sprint 1 | Users | **82%** | No duplicate email guard |
| Sprint 2 | Retailers | **74%** | `contactemail` vs `contact_email` field name mismatch |
| Sprint 3 | Advertisers | **71%** | `logo` required on backend; frontend tasks unverified |
| Sprint 4 | Demo Player | **55%** | `screenid` param not recognized by loops API; response is object not array |

---

## Recommended Next Actions (Priority Order)

1. **[P0] Fix Sprint 4 loops API** — add `screenid` filter to `GET /api/loops` in `loops.js`; unwrap `data.loops` instead of treating `data` as an array in `LoopDemoPlayer.jsx`
2. **[P1] Fix Sprint 2 field names** — align frontend `RetailerManagement.jsx` payload keys to match backend snake_case (`contact_email`, `contract_start`)
3. **[P1] Verify Sprint 3 frontend** — confirm tasks 3.4 and 3.5 are wired in `AdvertiserManagement.jsx`; enforce `logo` field in the form
4. **[P2] Add 404 guard to PATCH /api/retailers/:id** — check retailer existence before calling `updateStatus`
5. **[P2] Add duplicate email check to POST /api/users** — query Firestore before insert
