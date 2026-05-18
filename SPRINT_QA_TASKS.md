# Sprint QA Task List — Softomedia Live 2026
> **Source:** qa_notes_developer_v1.pdf  
> **Stack:** React 18 + Vite 5 (client-app), Express.js (ad-server), Firestore (NoSQL), Zustand  
> **Note for AI models:** Each task is scoped to one file action. Do not batch multiple files per task. Read only the file referenced before editing.

---

## SPRINT 1 — Users Module (`/dashboard/admin/users`)

### TASK 1.1 — Backend: Add POST handler to `users.js`
- **File:** `ad-server/src/api/users.js`
- **Action:** Add `router.post('/', ...)` handler
- **Logic:**
  - Validate body fields: `name` (string, required, min length 1), `email` (string, required, valid email format), `role` (enum: `superadmin`, `contentmanager`, `techoperator`, `retaileradmin`, `advertiser`), `linkedentityid` (required when role is `advertiser` or `retaileradmin`)
  - Set `status = 'active'` by default
  - Call `UserRepository.create(data)` — do not write Firestore directly in the route
  - Return `201` with the created user document on success
  - Return `400` with a validation error message on failure

### TASK 1.2 — Backend: Add `create()` method to `UserRepository.js`
- **File:** `ad-server/src/repositories/UserRepository.js`
- **Action:** Add a `create(data)` method
- **Logic:**
  - Call `this.db.collection('users').add({ ...data })` (or use `BaseRepository` pattern already in `BaseRepository.js`)
  - Auto-populate `createdat` and `updatedat` using `new Date().toISOString()` or server timestamp
  - Return the created document with its generated `id`

### TASK 1.3 — Backend: Add DELETE handler to `users.js`
- **File:** `ad-server/src/api/users.js`
- **Action:** Add `router.delete('/:id', ...)` handler
- **Logic:**
  - Call `UserRepository.delete(id)`
  - Return `200` on success, `404` if document not found

### TASK 1.4 — Backend: Add `delete()` method to `UserRepository.js`
- **File:** `ad-server/src/repositories/UserRepository.js`
- **Action:** Add a `delete(id)` method
- **Logic:**
  - Call `this.db.collection('users').doc(id).delete()`
  - Return `true` on success; throw if doc does not exist

### TASK 1.5 — Frontend: Wire "Create User" submit in `UserManagement.jsx`
- **File:** `client-app/src/pages/admin/UserManagement.jsx`
- **Action:** Find the "Add User" modal's submit handler (currently does nothing on save)
- **Logic:**
  - On form submit, call `POST /api/users` via `ApiService.js` or `api.js`
  - Pass body: `{ name, email, role, linkedentityid, status: 'active' }`
  - On success: either append the returned user to local state OR re-fetch the users list
  - On error: display the error message inside the modal (do not close modal on error)
  - Reset form fields after successful creation

### TASK 1.6 — Frontend: Add Delete icon to Users table in `UserManagement.jsx`
- **File:** `client-app/src/pages/admin/UserManagement.jsx`
- **Action:** In the Actions column of the users table, add a delete icon button
- **Logic:**
  - Use `Trash2` icon from `lucide-react` (already used elsewhere in the codebase)
  - On click: show a confirmation dialog/prompt ("Are you sure you want to delete this user?")
  - On confirm: call `DELETE /api/users/:id`
  - On success: remove the user row from local state
  - On error: show an error toast/message

### TASK 1.7 — Frontend: Add `deleteUser(id)` method to `ApiService.js` or `api.js`
- **File:** `client-app/src/services/api.js`
- **Action:** Export a `deleteUser(id)` function
- **Logic:**
  - Call `DELETE /api/users/${id}` using the existing axios/fetch instance
  - Return the response or throw on error

### TASK 1.8 — Frontend: Add `createUser(data)` method to `api.js`
- **File:** `client-app/src/services/api.js`
- **Action:** Export a `createUser(data)` function
- **Logic:**
  - Call `POST /api/users` with the user payload
  - Return the created user object

---

## SPRINT 2 — Retailers Module (`/dashboard/admin/retailers`)

### TASK 2.1 — Backend: Verify POST handler exists in `retailers.js`
- **File:** `ad-server/src/api/retailers.js`
- **Action:** Confirm `router.post('/')` is present and writes to Firestore `retailers` collection
- **Logic:**
  - Validate body fields: `name`, `logo`, `contactemail`, `contractstart`, `status`
  - Call `RetailerRepository.create(data)`
  - Return `201` with the new retailer document

### TASK 2.2 — Backend: Add DELETE handler to `retailers.js`
- **File:** `ad-server/src/api/retailers.js`
- **Action:** Add `router.delete('/:id', ...)` handler
- **Logic:**
  - **Soft-delete preferred:** set `status = 'inactive'` on the retailers document rather than hard-deleting (preserves referential integrity with `stores`, `screens`, `loops`, `impressions`)
  - Call `RetailerRepository.softDelete(id)` (sets status field)
  - Return `200` with updated document on success

### TASK 2.3 — Backend: Add `softDelete(id)` to `RetailerRepository.js`
- **File:** `ad-server/src/repositories/RetailerRepository.js`
- **Action:** Add a `softDelete(id)` method
- **Logic:**
  - Call `this.db.collection('retailers').doc(id).update({ status: 'inactive', updatedat: new Date().toISOString() })`
  - Return the updated snapshot

### TASK 2.4 — Backend: Add PATCH handler for status toggle to `retailers.js`
- **File:** `ad-server/src/api/retailers.js`
- **Action:** Add `router.patch('/:id', ...)` handler
- **Logic:**
  - Accept body: `{ status }` — validate value is one of `active`, `inactive`
  - Call `RetailerRepository.updateStatus(id, status)`
  - Return `200` with the updated document

### TASK 2.5 — Backend: Add `updateStatus(id, status)` to `RetailerRepository.js`
- **File:** `ad-server/src/repositories/RetailerRepository.js`
- **Action:** Add `updateStatus(id, status)` method
- **Logic:**
  - Call `this.db.collection('retailers').doc(id).update({ status, updatedat: new Date().toISOString() })`

### TASK 2.6 — Frontend: Wire "Add Retailer" form submit in `RetailerManagement.jsx`
- **File:** `client-app/src/pages/admin/RetailerManagement.jsx`
- **Action:** Find the "Add Retailer" dialogue's submit handler
- **Logic:**
  - On submit: call `POST /api/retailers` with `{ name, logo, contactemail, contractstart, status }`
  - On success: append the returned retailer to local state OR re-fetch
  - On error: display error inside the dialogue, do not close it

### TASK 2.7 — Frontend: Add Remove action to Retailers table in `RetailerManagement.jsx`
- **File:** `client-app/src/pages/admin/RetailerManagement.jsx`
- **Action:** Add a Remove button/icon to the Actions column of the retailers table
- **Logic:**
  - Use `Trash2` from `lucide-react`
  - On click: show confirmation prompt
  - On confirm: call `DELETE /api/retailers/:id` (soft-delete)
  - On success: update local state to reflect `status: 'inactive'` or remove from list

### TASK 2.8 — Frontend: Add "Make Inactive" toggle action to `RetailerManagement.jsx`
- **File:** `client-app/src/pages/admin/RetailerManagement.jsx`
- **Action:** Add a toggle/button to flip `status` between `active` and `inactive` on a retailer row
- **Logic:**
  - On click: call `PATCH /api/retailers/:id` with `{ status: 'inactive' }` (or `'active'` to re-activate)
  - On success: update the status badge in the table row to reflect the new status
  - Status badge values: `active` → green badge, `inactive` → grey/red badge

---

## SPRINT 3 — Advertisers Module (`/dashboard/admin/advertisers`)

### TASK 3.1 — Backend: Verify POST handler in `advertisers.js`
- **File:** `ad-server/src/api/advertisers.js`
- **Action:** Confirm `router.post('/')` writes a new document to the `advertisers` Firestore collection
- **Logic:**
  - Fields: `name`, `logo`, `industry`, `contactemail`, `budget`, `status`
  - ID prefix: document ID must be prefixed with `adv` (e.g., `adv_<auto-id>`)
  - Call `AdvertiserRepository.create(data)`
  - Return `201` with the new advertiser document

### TASK 3.2 — Backend: Add DELETE handler to `advertisers.js`
- **File:** `ad-server/src/api/advertisers.js`
- **Action:** Add `router.delete('/:id', ...)` handler
- **Logic:**
  - **Soft-delete preferred:** set `status = 'suspended'` (campaigns reference `advertiserid`)
  - Call `AdvertiserRepository.softDelete(id)`
  - Return `200`

### TASK 3.3 — Backend: Add `softDelete(id)` to `AdvertiserRepository.js`
- **File:** `ad-server/src/repositories/AdvertiserRepository.js`
- **Action:** Add `softDelete(id)` method
- **Logic:**
  - Update `{ status: 'suspended', updatedat: new Date().toISOString() }` on the `advertisers` document

### TASK 3.4 — Frontend: Wire "Add Advertiser" form submit in `AdvertiserManagement.jsx`
- **File:** `client-app/src/pages/admin/AdvertiserManagement.jsx`
- **Action:** Find the "Add Advertiser" dialogue's submit handler
- **Logic:**
  - On submit: call `POST /api/advertisers` with `{ name, logo, industry, contactemail, budget, status }`
  - On success: append the returned advertiser to local state OR re-fetch
  - On error: display error inside the dialogue

### TASK 3.5 — Frontend: Add Remove action to Advertisers table in `AdvertiserManagement.jsx`
- **File:** `client-app/src/pages/admin/AdvertiserManagement.jsx`
- **Action:** Add a Remove button/icon (`Trash2`) to the Actions column of the advertisers table
- **Logic:**
  - On click: confirmation prompt
  - On confirm: call `DELETE /api/advertisers/:id`
  - On success: remove or mark the row inactive in local state

---

## SPRINT 4 — Demo Player (`/player`)

### TASK 4.1 — Frontend: Enforce Retailer → Store → Screen selection sequence in `LoopDemoPlayer.jsx`
- **File:** `client-app/src/pages/LoopDemoPlayer.jsx`
- **Action:** Verify and enforce the cascading selection order
- **Logic:**
  - Step 1: Retailer dropdown — fetches all retailers via `GET /api/retailers`
  - Step 2: Store dropdown — only enabled after a Retailer is selected; fetches `GET /api/stores?retailerid=<id>`
  - Step 3: Screen dropdown — only enabled after a Store is selected; fetches `GET /api/screens?storeid=<id>`
  - Playback button must be disabled until all three levels are selected
  - Selecting a new Retailer resets Store and Screen dropdowns to empty/placeholder state
  - Selecting a new Store resets Screen dropdown

### TASK 4.2 — Frontend: Fix full-day schedule playback in `LoopDemoPlayer.jsx`
- **File:** `client-app/src/pages/LoopDemoPlayer.jsx`
- **Action:** Fix the playback logic so all loops for the selected day are played once per cycle
- **Logic:**
  - On play: fetch all `loops` documents where `screenid == selectedScreenId` AND `date == selectedDate` via `GET /api/loops?screenid=<id>&date=<date>`
  - Each loop has a `slots` array with 12 entries (index 0–11); each slot has a `creativeurl` field
  - Play each slot's `creativeurl` once per loop, in order (index 0 → 11)
  - After all slots in a loop finish, move to the next loop in the day's schedule
  - Do NOT repeat a loop until all loops for the day have been played (play the full cycle first)
  - After all loops in the day have played, optionally restart from the beginning

### TASK 4.3 — Frontend: Add Retailer context selector for Super Admin in `LoopDemoPlayer.jsx`
- **File:** `client-app/src/pages/LoopDemoPlayer.jsx`
- **Action:** Add a Retailer context selector visible only when `role === 'superadmin'`
- **Logic:**
  - Fetch all active retailers: `GET /api/retailers`
  - Display as a dropdown labelled "Retailer Context" adjacent to the "Retailer Command Center" heading
  - Display value: `retailer.name`; stored value: `retailer.id`
  - On selection: store the active `retailerId` in Zustand store (or local component state)
  - All subsequent API calls (stores, screens, loops) scoped to this `retailerId`
  - This selector must only render when `role === 'superadmin'` — hide for all other roles

---

## SPRINT 5 — Add Location / Stores (`/dashboard/admin` or Demo Player context)

### TASK 5.1 — Backend: Verify POST handler in `stores.js`
- **File:** `ad-server/src/api/stores.js`
- **Action:** Confirm `router.post('/')` creates a new store document in the `stores` Firestore collection
- **Logic:**
  - Required fields: `name` (store name), `retailerid` (FK — must be selected), `address`, `city`
  - Default: `status = 'active'`
  - Call `StoreRepository.create(data)`
  - Return `201` with the new store document

### TASK 5.2 — Frontend: Wire "Add Location" form submit in `LoopDemoPlayer.jsx`
- **File:** `client-app/src/pages/LoopDemoPlayer.jsx`
- **Action:** Find the "Add Location" form submit handler — currently does not create a store
- **Logic:**
  - On submit: call `POST /api/stores` with `{ name: enteredStoreName, retailerid: selectedRetailerId, address, city, status: 'active' }`
  - `retailerid` must come from the active Retailer context (see Task 4.3)
  - On success: the new store must appear in the store dropdown/list immediately (append to state or re-fetch)
  - On error: display error message inline

### TASK 5.3 — Frontend: Investigate and clean unexpected store locations in `LoopDemoPlayer.jsx`
- **File:** `client-app/src/pages/LoopDemoPlayer.jsx`
- **Action:** Data audit — check if MOCKSTORAGE seed data is leaking into the store list
- **Logic:**
  - When fetching stores, filter by the currently selected `retailerid` context (`GET /api/stores?retailerid=<id>`)
  - If stores not linked to any known retailer appear, add a filter in the store list to exclude stores where `retailerid` does not match the selected Retailer context
  - Check `BaseRepository.js` for the `MOCKSTORAGE` fallback — if present, confirm it is disabled or cleared in non-dev environments

---

## SPRINT 6 — Network Map (`/dashboard/admin` or `/dashboard/retailer`)

### TASK 6.1 — Frontend: Fix map container CSS in `NetworkMap.jsx`
- **File:** `client-app/src/pages/admin/NetworkMap.jsx`
- **Action:** Ensure the map container `<div>` has explicit non-zero `height` and `width`
- **Logic:**
  - Add inline style or CSS class: `style={{ height: '500px', width: '100%' }}` (or equivalent Tailwind classes: `h-[500px] w-full`)
  - Confirm no parent component is passing `display: none` or `height: 0` down to this container
  - Check `DashboardLayout.jsx` to verify the content area allows non-zero height for this route

### TASK 6.2 — Frontend: Verify map library initialization in `NetworkMap.jsx`
- **File:** `client-app/src/pages/admin/NetworkMap.jsx`
- **Action:** Confirm the map API key or CDN dependency is correctly loaded
- **Logic:**
  - If using Google Maps: verify the Maps JavaScript API key is read from `import.meta.env.VITE_GOOGLE_MAPS_API_KEY` (or similar env var in `client-app/.env`)
  - If using Leaflet/Mapbox: confirm the CDN link or npm import is present and the CSS is imported
  - Add a console error log if the key is missing: `if (!apiKey) console.error('Map API key missing')`

### TASK 6.3 — Frontend: Wire store pins on the map in `NetworkMap.jsx`
- **File:** `client-app/src/pages/admin/NetworkMap.jsx`
- **Action:** Fetch stores and render a pin/marker for each
- **Logic:**
  - Fetch `GET /api/stores` (no retailer filter — show all stores for admin)
  - Each pin uses `stores.address` + `stores.city` for geolocation
  - Marker click can show a tooltip with the store name and status

---

## SPRINT 7 — Brand Dashboard / Campaign Edit (`/dashboard/brand`)

### TASK 7.1 — Backend: Verify PUT handler in `campaigns.js`
- **File:** `ad-server/src/api/campaigns.js`
- **Action:** Confirm `router.put('/:id', ...)` exists and updates the campaign document in Firestore
- **Logic:**
  - Accept all campaign fields: `name`, `advertiserid`, `startdate`, `enddate`, `budget`, `status`, `creativeurl`, etc.
  - Call `CampaignRepository.update(id, data)`
  - Return `200` with the updated document

### TASK 7.2 — Frontend: Fix Edit button navigation in `BrandDashboard.jsx`
- **File:** `client-app/src/pages/brand/BrandDashboard.jsx`
- **Action:** Find the Edit button in the campaign list table's Actions column — it currently does not navigate
- **Logic:**
  - On click: navigate to `/dashboard/brand/campaign/:id/edit` using React Router's `useNavigate()` hook
  - Pass the `campaignId` as the route param

### TASK 7.3 — Frontend: Add Edit route to `App.jsx`
- **File:** `client-app/src/App.jsx`
- **Action:** Add a new route for campaign editing
- **Logic:**
  - Add: `<Route path="/dashboard/brand/campaign/:id/edit" element={<BrandCampaignWizard />} />`
  - This reuses the existing `BrandCampaignWizard` component with an `editMode` flag

### TASK 7.4 — Frontend: Add `editMode` prop handling to `BrandCampaignWizard.jsx`
- **File:** `client-app/src/pages/brand/BrandCampaignWizard.jsx`
- **Action:** Detect when the component is in edit mode vs. create mode
- **Logic:**
  - Read `campaignId` from `useParams()`
  - If `campaignId` is present: set `editMode = true`, fetch existing campaign data via `GET /api/campaigns/:id`, and pre-populate all wizard fields
  - If `campaignId` is absent: `editMode = false`, wizard starts empty (existing create flow unchanged)
  - On save in edit mode: call `PUT /api/campaigns/:id` instead of `POST /api/campaigns`
  - On success: navigate back to `/dashboard/brand`

### TASK 7.5 — Frontend: Fix Campaign Status display logic in `BrandDashboard.jsx`
- **File:** `client-app/src/pages/brand/BrandDashboard.jsx`
- **Action:** Derive the displayed campaign status client-side from the DB `status` field + current date
- **Logic:**
  - Do NOT display the raw `status` DB field directly in the Status column
  - Apply this derived logic:
    - If `status === 'live'` AND `today >= startdate` AND `today <= enddate` → display `Live` (green badge)
    - If `status === 'live'` AND `today > enddate` → display `Completed` (grey badge)
    - If `startdate > today` → display `Scheduled` (blue badge)
    - Otherwise: display the raw status value (e.g., `draft`, `pendingapproval`) capitalized
  - Use `new Date()` for today's date; compare as ISO strings or Date objects

---

## SPRINT 8 — Retailer Dashboard (`/dashboard/retailer`)

### TASK 8.1 — Frontend: Fix "Go Back" navigation in `ScheduleHistory.jsx`
- **File:** `client-app/src/pages/retailer/ScheduleHistory.jsx`
- **Action:** Find the "Go Back" button handler — currently broken
- **Logic:**
  - Replace broken handler with: `navigate('/dashboard/retailer')` using `useNavigate()` from `react-router-dom`
  - Alternatively use `<Link to="/dashboard/retailer">Go Back</Link>` if no logic is needed on click

### TASK 8.2 — Frontend: Verify breadcrumb back navigation in `DashboardLayout.jsx`
- **File:** `client-app/src/layouts/DashboardLayout.jsx`
- **Action:** Confirm that breadcrumb/back navigation is correctly wired for Retailer persona routes (`/dashboard/retailer/*`)
- **Logic:**
  - The breadcrumb "back" action for any `/dashboard/retailer/*` sub-route must navigate to `/dashboard/retailer`
  - Check if `DashboardLayout.jsx` uses a generic back handler — if so, scope it to use `useNavigate(-1)` or a hard-coded path based on the current route prefix

### TASK 8.3 — Known Bug Stub: "Report Issue" button in `RetailerDashboard.jsx`
- **File:** `client-app/src/pages/retailer/RetailerDashboard.jsx`
- **Action:** Stub only — do not implement full functionality yet
- **Logic:**
  - Ensure the "Report Issue" button does not throw a JS error on click
  - Add a placeholder handler: `onClick={() => alert('Report Issue — coming soon')}` or disable the button with a tooltip "Coming soon"

### TASK 8.4 — Known Bug Stub: "Disconnect / Reestablish" button in `RetailerDashboard.jsx`
- **File:** `client-app/src/pages/retailer/RetailerDashboard.jsx`
- **Action:** Stub only — do not implement full functionality yet
- **Logic:**
  - Same as Task 8.3: prevent JS errors on click
  - Add a placeholder: disabled button with `title="Coming soon"` or a toast notification

### TASK 8.5 — Known Bug Stub: Schedule Calendar in `ScheduleCalendar.jsx`
- **File:** `client-app/src/pages/retailer/ScheduleCalendar.jsx`
- **Action:** Stub only — confirm the calendar renders without crashing
- **Logic:**
  - If the component throws on render, add a try/catch or conditional render guard
  - Log a console warning: `console.warn('ScheduleCalendar: full implementation pending')`

---

## SPRINT 9 — Tech Ops Dashboard (`/dashboard/tech`)

### TASK 9.1 — Backend: Fix `/api/retailers` aggregate count in `retailers.js`
- **File:** `ad-server/src/api/retailers.js`
- **Action:** Ensure `GET /api/retailers` returns ALL retailers, not filtered by a single `retailerid`
- **Logic:**
  - Remove any `where('retailerid', '==', someId)` filter from the GET all handler
  - Return the full count of active retailer documents

### TASK 9.2 — Backend: Fix `/api/stores` aggregate count in `stores.js`
- **File:** `ad-server/src/api/stores.js`
- **Action:** Ensure `GET /api/stores` (with no query params) returns ALL stores across all retailers
- **Logic:**
  - The TechOps view needs a total count — when no `retailerid` query param is provided, do not apply a retailer filter
  - Only apply the `retailerid` filter when the query param is explicitly passed

### TASK 9.3 — Backend: Fix `/api/screens` aggregate + status breakdown in `screens.js`
- **File:** `ad-server/src/api/screens.js`
- **Action:** Ensure `GET /api/screens` (with no query params) returns ALL screens with status breakdown
- **Logic:**
  - When no `storeid` or `retailerid` filter is passed, return all screen documents
  - Include in the response: `total`, `online` count, `offline` count, `error` count — derived from `screens.status` field (values: `online`, `offline`, `error`)

### TASK 9.4 — Frontend: Update `TechOpsDashboard.jsx` to use aggregate API calls
- **File:** `client-app/src/pages/tech/TechOpsDashboard.jsx`
- **Action:** Wire the stat cards to the correct unfiltered API endpoints
- **Logic:**
  - "Retail Partners" card: call `GET /api/retailers` → display `data.length` or `data.total`
  - "Store Locations" card: call `GET /api/stores` (no retailer filter) → display total count
  - "Screens" card: call `GET /api/screens` (no store/retailer filter) → display total + breakdown by status
  - Roles allowed to see this view: `superadmin`, `techoperator` — add a role guard if not already present

---

## SPRINT 10 — Super Admin CPM / Section Label Toggle (`/dashboard/admin/pricing`)

### TASK 10.1 — Frontend: Add overlay label toggle to Zustand store
- **File:** `client-app/src/stores/GeminiStore.js`  
  *(or create a new `client-app/src/stores/uiStore.js` if GeminiStore is unrelated)*
- **Action:** Add a boolean `showSectionLabels` flag (default: `false`) and a `toggleSectionLabels()` action
- **Logic:**
  - State: `showSectionLabels: false`
  - Action: `toggleSectionLabels: () => set(state => ({ showSectionLabels: !state.showSectionLabels }))`
  - This is in-memory only — do NOT persist to Firestore

### TASK 10.2 — Frontend: Add toggle UI to `CPMCalendar.jsx`
- **File:** `client-app/src/pages/admin/CPMCalendar.jsx`
- **Action:** Add a toggle switch (or checkbox) visible only when `role === 'superadmin'`
- **Logic:**
  - Import `showSectionLabels` and `toggleSectionLabels` from the Zustand store (Task 10.1)
  - Render a labelled toggle: "Show Section Labels"
  - Only render when `user.role === 'superadmin'`
  - Default state: OFF (labels hidden)

### TASK 10.3 — Frontend: Conditionally render section/zone name labels in `NetworkMap.jsx`
- **File:** `client-app/src/pages/admin/NetworkMap.jsx`
- **Action:** Read `showSectionLabels` from Zustand store and render labels over UI zones when `true`
- **Logic:**
  - Import `showSectionLabels` from the store
  - When `showSectionLabels === true`: render section/zone name labels over the relevant map zones
  - When `showSectionLabels === false`: hide all labels (this is the default state)
  - Labels are for debugging/internal use only — no styling requirement beyond visible text

---

## DO NOT MODIFY (QA Confirmed Working)

| Area | File | Status |
|---|---|---|
| Brand — Preview Demo | `client-app/src/pages/brand/BrandDashboard.jsx` (preview section only) | ✅ Working |
| Brand — New Campaign Wizard | `client-app/src/pages/brand/BrandCampaignWizard.jsx` (create mode) | ✅ Working |
| Campaign Pause Action | `BrandDashboard.jsx` pause button | ℹ️ No-op, leave as-is |
| Campaign Settings Action | `BrandDashboard.jsx` settings button | ℹ️ No-op, leave as-is |
| Store Hours | `client-app/src/pages/admin/BusinessHoursManagement.jsx` | ℹ️ No bugs noted |

---

## File Reference Map

| Bug Area | Primary Frontend File | Primary Backend File |
|---|---|---|
| Users | `client-app/src/pages/admin/UserManagement.jsx` | `ad-server/src/api/users.js` + `ad-server/src/repositories/UserRepository.js` |
| Retailers | `client-app/src/pages/admin/RetailerManagement.jsx` | `ad-server/src/api/retailers.js` + `ad-server/src/repositories/RetailerRepository.js` |
| Advertisers | `client-app/src/pages/admin/AdvertiserManagement.jsx` | `ad-server/src/api/advertisers.js` + `ad-server/src/repositories/AdvertiserRepository.js` |
| Demo Player | `client-app/src/pages/LoopDemoPlayer.jsx` | `ad-server/src/api/stores.js`, `ad-server/src/api/loops.js` |
| Add Location | `client-app/src/pages/LoopDemoPlayer.jsx` | `ad-server/src/api/stores.js` + `ad-server/src/repositories/StoreRepository.js` |
| Network Map | `client-app/src/pages/admin/NetworkMap.jsx` | `ad-server/src/api/stores.js` |
| Campaign Edit | `client-app/src/pages/brand/BrandDashboard.jsx`, `BrandCampaignWizard.jsx`, `App.jsx` | `ad-server/src/api/campaigns.js` + `ad-server/src/repositories/CampaignRepository.js` |
| Retailer Dashboard | `client-app/src/pages/retailer/RetailerDashboard.jsx`, `ScheduleHistory.jsx` | — |
| Layout / Navigation | `client-app/src/layouts/DashboardLayout.jsx` | — |
| Tech Ops | `client-app/src/pages/tech/TechOpsDashboard.jsx` | `ad-server/src/api/retailers.js`, `stores.js`, `screens.js` |
| CPM / Labels | `client-app/src/pages/admin/CPMCalendar.jsx`, `NetworkMap.jsx` | — |
| Zustand Store | `client-app/src/stores/GeminiStore.js` (or new `uiStore.js`) | — |
| API Service | `client-app/src/services/api.js` | — |
