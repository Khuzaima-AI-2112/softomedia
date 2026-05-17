# TASKS — Softomedia Live 2026
> Generated from: `qa_notes_developer_v1.pdf`  
> Purpose: Discrete, file-scoped tasks for local LLM execution. Each task names the exact file(s) to load so the context window stays focused.

---

## How to use
1. Pick one task below.
2. Load **only the listed files** into your LLM context.
3. Implement, then mark `[x]`.

---

## Section 1 — Super Admin / CPM Pricing (`/dashboard/admin/pricing`)

- [ ] **TASK-01 — Section Label Overlay Toggle**  
  Add a superadmin-only debug toggle that shows/hides section/zone name labels on the network map or player view. State lives in Zustand only (no Firestore write). Default state: OFF.  
  **Files:** `client-app/src/pages/admin/pricing` (or nearest admin layout), `data_dictionary.md` (User Entity → role enum)

---

## Section 2 — Users (`/dashboard/admin/users`)

- [ ] **TASK-02 — "Add User" Form Does Not Save**  
  Wire the "Add User" modal to `POST /api/users`. Fields: `name`, `email`, `role`, `linkedentityid` (conditional). On success: optimistic update or re-fetch the Users table. Default `status: active`; `createdat`/`updatedat` auto-set by BaseRepository.  
  **Files:** `client-app/src/pages/admin/users`, `ad-server/src/routes/users.js` (or equivalent), `data_dictionary.md` (User Entity)

- [ ] **TASK-03 — Delete User Not Implemented**  
  Add a Trash2 (Lucide React) icon in the Users table Actions column. On click: confirmation prompt → `DELETE /api/users/:id` → remove Firestore document → remove table row.  
  **Files:** `client-app/src/pages/admin/users`, `ad-server/src/routes/users.js`

---

## Section 3 — Retailers (`/dashboard/admin/retailers`)

- [ ] **TASK-04 — "Add Retailer" Dialogue Does Not Persist**  
  Wire the "Add Retailer" form to `POST /api/retailers`. Fields: `name`, `logo`, `contactemail`, `contractstart`, `status`. On success: re-fetch or append to local state so the new row appears immediately.  
  **Files:** `client-app/src/pages/admin/retailers`, `ad-server/src/routes/retailers.js`, `data_dictionary.md` (Retailer Entity)

- [ ] **TASK-05 — Remove Retailer Not Implemented**  
  Add a Remove action to the Retailers table row. On click: confirmation prompt → `DELETE /api/retailers/:id`. Decide hard-delete vs. soft-delete (recommendation: soft-delete — set `status = 'inactive'` to preserve referential integrity with stores, screens, loops, and impressions).  
  **Files:** `client-app/src/pages/admin/retailers`, `ad-server/src/routes/retailers.js`, `database_schema.md` (retailers collection)

- [ ] **TASK-06 — Make Retailer Inactive Not Implemented**  
  Add a "Make Inactive" toggle/action on each Retailer row. On trigger: `PATCH /api/retailers/:id` → set `status: 'inactive'` in Firestore. Reflect change visually with a status badge in the row.  
  **Files:** `client-app/src/pages/admin/retailers`, `ad-server/src/routes/retailers.js`, `database_schema.md` (retailers collection → status field)

---

## Section 4 — Advertisers (`/dashboard/admin/advertisers`)

- [ ] **TASK-07 — "Add Advertiser" Dialogue Does Not Persist**  
  Wire the "Add Advertiser" form to `POST /api/advertisers`. Fields: `name`, `logo`, `industry`, `contactemail`, `budget`, `status`. Firestore document id must be prefixed `adv`. On success: new row appears immediately.  
  **Files:** `client-app/src/pages/admin/advertisers`, `ad-server/src/routes/advertisers.js`, `data_dictionary.md` (Advertiser Entity)

- [ ] **TASK-08 — Remove Advertiser Not Implemented**  
  Add a Remove action to the Advertisers table. On click: confirmation → `DELETE /api/advertisers/:id`. Soft-delete preferred (`status = 'suspended'`) because campaigns reference `advertiserid`.  
  **Files:** `client-app/src/pages/admin/advertisers`, `ad-server/src/routes/advertisers.js`, `data_dictionary.md` (Campaign Entity)

---

## Section 5 — Demo Player (`/player`)

- [ ] **TASK-09 — Playback Requires Correct Cascading Selection**  
  Enforce selection order: Retailer → Store (filtered by `retailerid`) → Screen (filtered by `storeid`) → load schedule. No playback until all three are selected.  
  **Files:** `client-app/src/pages/player`, `data_dictionary.md` (retailers → stores → screens → loops FK chain)

- [ ] **TASK-10 — Demo Player Must Play Full Day Schedule**  
  On play: fetch all `loops` documents for `screenid` + selected date. Each loop has 12 slots (`slots[0–11]`). Play each slot's `creativeurl` once per loop, in order. Cycle through all day's loops once before repeating.  
  **Files:** `client-app/src/pages/player`, `database_schema.md` (loops collection → slots array), `user_stories_use_cases.md` (Use Case 5)

---

## Section 6 — Store Hours (`/dashboard/admin/hours`)

- [ ] **TASK-11 — No action required**  
  No bugs noted by QA. Do not modify.

---

## Section 7 — Network Map

- [ ] **TASK-12 — Map Does Not Render**  
  Investigate blank map. Likely cause: missing Maps JS API key, or map container has `height: 0` / `display: none` from a parent. Verify GCP Maps API key is passed to the component. Each pin = one `stores` record; geocode using `stores.address` + `stores.city`.  
  **Files:** component containing the map (search for `<Map` or `GoogleMap` in `client-app/src`), `data_dictionary.md` (Store Entity → address/city), `tech_stack.md`

---

## Section 8 — Brand Dashboard (`/dashboard/brand`)

- [ ] **TASK-13 — Campaign Edit Does Not Work**  
  Clicking Edit on a Campaign row must navigate to the Campaign edit view pre-populated with all campaign fields. Re-use the New Campaign wizard with a route param (`/dashboard/brand/campaign/:id/edit`) and an `editMode: true` flag in Zustand/local state. On save: `PUT /api/campaigns/:id`.  
  **Files:** `client-app/src/pages/brand/campaigns`, `ad-server/src/routes/campaigns.js`, `data_dictionary.md` (Campaign Entity)

- [ ] **TASK-14 — Campaign Status Column Shows Incorrect Values**  
  Derive the displayed status client-side: "Live" only when `status === 'live'` AND `startdate ≤ today ≤ enddate`. If `enddate` has passed → show "Completed". If `startdate` is future → show "Scheduled". Do not display raw DB status.  
  DB enum: `draft | pendingapproval | scheduled | live | ended`.  
  **Files:** `client-app/src/pages/brand/campaigns`, `data_dictionary.md` (Campaign Entity → status enum)

- [ ] **TASK-15 — Campaign Pause / Settings Actions (TBD)**  
  Listed as known bugs; implementation details TBD. No changes required now.

---

## Section 9 — Retailer Dashboard (`/dashboard/retailer`)

- [ ] **TASK-16 — "Report Issue" Not Functional (TBD)**  
  Listed as known bug; implementation plan TBD.

- [ ] **TASK-17 — Disconnect / Reestablish Not Functional (TBD)**  
  Listed as known bug; implementation plan TBD.

- [ ] **TASK-18 — Schedule Calendar Not Functional (TBD)**  
  Listed as known bug; implementation plan TBD.

- [ ] **TASK-19 — Approval History "Go Back" Navigation Broken**  
  Route: `/dashboard/retailer/history`. The "Go Back" button does not navigate back to `/dashboard/retailer`. Fix: replace broken handler with `useNavigate()` → `navigate('/dashboard/retailer')`, or `<Link to="/dashboard/retailer">`. Verify `DashboardLayout.jsx` breadcrumb/back navigation for Retailer persona routes.  
  **Files:** `client-app/src/pages/retailer/history` (or `PlaybackHistory.jsx`), `client-app/src/layouts/DashboardLayout.jsx`

---

## Section 10 — Retailer Dashboard: Add Location

- [ ] **TASK-20 — "Add Location" Does Not Create a New Store**  
  Wire Add Location form to `POST /api/stores`. Required fields: `name`, `retailerid`, `address`, `city`, `status` (default: `active`). On success: new store appears in the store list/selector immediately.  
  **Files:** `client-app/src/pages/retailer` (Add Location component), `ad-server/src/routes/stores.js`, `data_dictionary.md` (Store Entity)

- [ ] **TASK-21 — No Retailer Context Selector for Super Admin**  
  Super Admin has no Retailer login yet. Add a Retailer selector dropdown near "Retailer Command Center" (or in the top header for Retailer-persona views). Populate from `GET /api/retailers` (active only). On select: store `retailerId` in Zustand/local state for all subsequent scoped API calls. Visible only when `role === 'superadmin'`.  
  **Files:** `client-app/src/layouts/DashboardLayout.jsx` or nearest Retailer view header, `ad-server/src/routes/retailers.js`

---

## Section 11 — Store Locations: Data Audit

- [ ] **TASK-22 — Unexpected Store Locations Appearing**  
  4 unexpected store records are visible. Investigate: query Firestore `stores` collection, list all documents with `retailerid`, `name`, `city`, `status`. Cross-reference `retailerid` against `retailers` collection. Check if `MOCKSTORAGE` in `BaseRepository.js` pre-populated test records. Resolution: clear mock records or add a UI filter to exclude stores not linked to the active Retailer context.  
  **Files:** `ad-server/src/repositories/BaseRepository.js`, `ad-server/src/routes/stores.js`, `database_schema.md` (stores collection)

---

## Section 12 — Tech Ops Dashboard (`/dashboard/tech`)

- [ ] **TASK-23 — Tech Ops View Shows Incomplete / Filtered Data**  
  The dashboard must show network-wide aggregates, not per-retailer data: total active retailers, total stores (all retailers), total screens (all stores/retailers), real-time status breakdown (`online / offline / error`). Fix API calls: `GET /api/retailers`, `GET /api/stores` (no retailer filter), `GET /api/screens` (no store/retailer filter). Accessible by `superadmin` and `techoperator` roles.  
  **Files:** `client-app/src/pages/tech`, `ad-server/src/routes/retailers.js`, `ad-server/src/routes/stores.js`, `ad-server/src/routes/screens.js`, `database_schema.md` (screens → status field), `data_dictionary.md` (User Entity → role enum)
