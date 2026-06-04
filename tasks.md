# Sprint: QA Bug Fixes — Softomedia Live 2026
> Source: `docs/QA/qa1/qa_notes_developer_v1.pdf` (branch: `jan31-plus-new-features`)  
> Target branch: `main`  
> Stack: React 18 + Vite 5 (client-app), Express.js (ad-server), Firestore, Zustand  
> Reference docs (in repo): `database_schema.md`, `data_dictionary.md`, `url_screen_inventory.md`, `user_stories_use_cases.md`

---

## Sprint Overview

| # | Area | Bug Title | Priority | Files Touched |
|---|------|-----------|----------|---------------|
| 1 | Super Admin — Pricing | Section Label Overlay Toggle | Medium | `client-app/src/pages/admin/CPMCalendar.jsx`, `client-app/src/stores/` |
| 2 | Users | Add User Form Does Not Save | High | `client-app/src/pages/admin/UserManagement.jsx`, `ad-server/src/api/users.js` |
| 3 | Users | Delete Action Missing in Actions Column | High | `client-app/src/pages/admin/UserManagement.jsx`, `ad-server/src/api/users.js` |
| 4 | Retailers | Add Retailer Dialogue Does Not Persist | High | `client-app/src/pages/admin/RetailerManagement.jsx`, `ad-server/src/api/retailers.js` |
| 5 | Retailers | Remove Retailer Not Implemented | High | `client-app/src/pages/admin/RetailerManagement.jsx`, `ad-server/src/api/retailers.js` |
| 6 | Retailers | Make Retailer Inactive Not Implemented | Medium | `client-app/src/pages/admin/RetailerManagement.jsx`, `ad-server/src/api/retailers.js` |
| 7 | Advertisers | Add Advertiser Dialogue Does Not Persist | High | `client-app/src/pages/admin/AdvertiserManagement.jsx`, `ad-server/src/api/advertisers.js` |
| 8 | Advertisers | Remove Advertiser Not Implemented | High | `client-app/src/pages/admin/AdvertiserManagement.jsx`, `ad-server/src/api/advertisers.js` |
| 9 | Demo Player | Playback Requires Correct Selection Sequence | High | `client-app/src/pages/Player.jsx` |
| 10 | Demo Player | Must Play Full Day Schedule | High | `client-app/src/pages/Player.jsx`, `ad-server/src/api/loops.js` |
| 11 | Network Map | Map Does Not Render | High | `client-app/src/pages/admin/NetworkMap.jsx` |
| 12 | Brand Dashboard | Campaign Edit Does Not Work | High | `client-app/src/pages/brand/BrandDashboard.jsx`, `client-app/src/pages/brand/BrandCampaignWizard.jsx`, `ad-server/src/api/campaigns.js`, `client-app/src/App.jsx` |
| 13 | Brand Dashboard | Campaign Status Shows Incorrect Values | Medium | `client-app/src/pages/brand/BrandDashboard.jsx` |
| 14 | Retailer Dashboard | Report Issue Not Functional | Low | `client-app/src/pages/retailer/RetailerDashboard.jsx` |
| 15 | Retailer Dashboard | Disconnect / Reestablish Not Functional | Low | `client-app/src/pages/retailer/RetailerDashboard.jsx` |
| 16 | Retailer Dashboard | Schedule Calendar Not Functional | Medium | `client-app/src/pages/retailer/ScheduleCalendar.jsx`, `client-app/src/pages/retailer/RetailerDashboard.jsx` |
| 17 | Retailer Dashboard | Approval History "Go Back" Broken | Medium | `client-app/src/pages/retailer/ScheduleHistory.jsx`, `client-app/src/layouts/DashboardLayout.jsx` |
| 18 | Demo Player / Add Location | Add Location Does Not Create Store | High | `client-app/src/pages/Player.jsx`, `ad-server/src/api/stores.js` |
| 19 | Demo Player / Super Admin | No Retailer Context Selector | High | `client-app/src/pages/Player.jsx`, `client-app/src/stores/` |
| 20 | Store Locations | Unexpected Locations Data Audit | Medium | `ad-server/src/repositories/BaseRepository.js`, `client-app/src/pages/Player.jsx` |
| 21 | Tech Ops Dashboard | View Shows Incomplete Data | Medium | `client-app/src/pages/tech/`, `ad-server/src/api/monitoring.js`, `ad-server/src/api/screens.js`, `ad-server/src/api/stores.js`, `ad-server/src/api/retailers.js` |
| 22 | Loop Builder | Wire Entry Point from Loop Management | High | `client-app/src/pages/admin/LoopManagement.jsx`, `client-app/src/App.jsx` |
| 23 | Loop Builder | Role Guard — Editor vs. Read-Only | High | `client-app/src/pages/admin/LoopBuilder.jsx` |
| 24 | Loop Builder | Block Approval on Empty Slots | High | `client-app/src/pages/admin/LoopBuilder.jsx` |
| 25 | Loop Builder | Empty Slot Error State UI | High | `client-app/src/pages/admin/LoopBuilder.jsx` |
| 26 | Loop Builder | Mandatory Approval — Remove Bypass Paths | High | `client-app/src/pages/admin/LoopBuilder.jsx`, `ad-server/src/api/loops.js` |
| 27 | Loop Builder | Two-Step Approval Confirmation Dialog | High | `client-app/src/pages/admin/LoopBuilder.jsx` |
| 28 | Loop Builder | Re-edit Creates New Draft Version | High | `client-app/src/pages/admin/LoopBuilder.jsx`, `ad-server/src/api/loops.js` |
| 29 | Loop Builder | Version State Display in UI | Medium | `client-app/src/pages/admin/LoopBuilder.jsx` |
| 30 | Loop Builder | Audit Log — Save Action | High | `ad-server/src/api/loops.js`, Firestore schema |
| 31 | Loop Builder | Audit Log — Approve Action | High | `ad-server/src/api/loops.js`, Firestore schema |
| 32 | Loop Builder | Audit Log — DB Schema | High | Firestore / `docs/database_schema.md` |
| 33 | Loop Builder | E2E Flow Test — Happy Path | High | `tests/` |
| 34 | Loop Builder | E2E Flow Test — Blocked Approval Path | High | `tests/` |
| 35 | Loop Builder | Role Enforcement Test | Medium | `tests/` |
| 36 | Loop Builder | Audit Log Verification Test | Medium | `tests/` |

---

## Task Details

---

### TASK-01 — Section Label Overlay Toggle (Super Admin)
**Route:** `/dashboard/admin/pricing`  
**Priority:** Medium  
**Status:** `[ ] To Do`

**What to do:**
Add a toggle switch in the Super Admin pricing/CPM view that shows or hides section/zone name labels overlaid on the network map or player view. This is a debugging aid — internal only.

**Files to edit:**
- `client-app/src/pages/admin/CPMCalendar.jsx` — Add toggle UI element (switch/checkbox). Gate visibility with `user.role === 'superadmin'` check. Wire to Zustand action.
- `client-app/src/stores/` — Add or extend an existing store (e.g., create `uiStore.js` if no general UI store exists) with a `overlayLabelsEnabled: false` boolean state field and a `toggleOverlayLabels()` action. Do **not** persist to Firestore. In-memory (Zustand) only.
- Any component that renders zone/section labels (map overlay, player overlay) — Consume `overlayLabelsEnabled` from the store and conditionally render labels.

**Implementation notes:**
- Default state: `false` (labels hidden for all users including Super Admin).
- Guard the toggle UI: `{user?.role === 'superadmin' && <OverlayToggle />}`.
- Use a lightweight boolean in Zustand — no API call needed.
- Prefer a `<label><input type="checkbox" /></label>` or a small toggle component already in the design system.

---

### TASK-02 — Add User Form Does Not Save
**Route:** `/dashboard/admin/users`  
**Priority:** High  
**Status:** `[ ] To Do`

**What to do:**
Fix the "Add User" modal so that submitting the form POSTs to the API and persists the new user to Firestore.

**Files to edit:**
- `client-app/src/pages/admin/UserManagement.jsx`
  - Locate the `Add User` modal/form component.
  - Ensure all 4 form fields are wired to local state: `name`, `email`, `role`, `linkedEntityId`.
  - `linkedEntityId` field must conditionally render only when `role === 'advertiser'` or `role === 'retaileradmin'`.
  - On submit, call the users service: `POST /api/users` with `{ name, email, role, linkedEntityId, status: 'active' }`.
  - On success: optimistically append new user to table state (or re-fetch user list). Close modal and clear form.
  - On error: display inline error. Do not close the modal.
  - Field validation: `name` required (min 1 char), `email` required + valid format, `role` required enum, `linkedEntityId` required when role is `advertiser`/`retaileradmin`.
- `ad-server/src/api/users.js`
  - Verify `POST /api/users` route exists and correctly calls the user repository's `create()` method.
  - Confirm the route auto-populates `createdAt` and `updatedAt` via `BaseRepository` audit fields.
  - Confirm `status` defaults to `'active'` if not provided.
  - If the route is stubbed or missing, implement it using the pattern from `ad-server/src/api/retailers.js` or `advertisers.js` as reference.

**Data mapping (UI → Firestore `users` collection):**

| UI Label | DB Field | Type | Validation |
|---|---|---|---|
| Full Name | `name` | string | Required, min length 1 |
| Email | `email` | string | Required, unique, valid email |
| Role | `role` | string (enum) | Required: `superadmin`, `contentmanager`, `techoperator`, `retaileradmin`, `advertiser` |
| Assign to Advertiser | `linkedEntityId` | string (FK) | Conditional — required when role is `advertiser` or `retaileradmin` |

---

### TASK-03 — Delete Action Missing from Users Table
**Route:** `/dashboard/admin/users`  
**Priority:** High  
**Status:** `[ ] To Do`

**What to do:**
Add a Delete (trash) icon to the Actions column of the Users table with a confirmation prompt before deletion.

**Files to edit:**
- `client-app/src/pages/admin/UserManagement.jsx`
  - Import `Trash2` from `lucide-react` (consistent with existing icon usage per tech stack).
  - Add `<Trash2 />` button to the Actions column for each user row.
  - On click: open a confirmation modal/dialog (`window.confirm` or an inline confirmation component — prefer the latter for UX consistency).
  - On confirm: call `DELETE /api/users/:id`, then remove the row from local state (filter by id).
  - On API error: show inline error toast or message; do not remove the row.
- `ad-server/src/api/users.js`
  - Verify `DELETE /api/users/:id` route exists and calls `repository.delete(id)`.
  - The delete must remove the document from the Firestore `users` collection.
  - If the route does not exist, implement it following the pattern in `ad-server/src/api/retailers.js`.

---

### TASK-04 — Add Retailer Dialogue Does Not Persist
**Route:** `/dashboard/admin/retailers`  
**Priority:** High  
**Status:** `[ ] To Do`

**What to do:**
Fix the "Add Retailer" form submit so the new retailer is saved to Firestore and appears in the Retailers table.

**Files to edit:**
- `client-app/src/pages/admin/RetailerManagement.jsx`
  - Locate the Add Retailer modal. Ensure all form fields are bound to component state: `name`, `logo`, `contactEmail`, `contractStart`, `status`.
  - On submit: `POST /api/retailers` with the form payload.
  - On success: re-fetch retailer list or append the returned retailer to local state. Close modal.
  - On error: show inline error message. Do not close modal.
- `ad-server/src/api/retailers.js`
  - Verify the `POST /api/retailers` route writes to the Firestore `retailers` collection via the repository.
  - Confirm `createdAt`/`updatedAt` are auto-populated by `BaseRepository`.
  - Confirm `status` defaults to `'active'` if not passed.

**Data mapping (UI → Firestore `retailers` collection):**

| UI Label | DB Field | Notes |
|---|---|---|
| Retailer Name | `name` | Required |
| Logo URL | `logo` | Optional |
| Contact Email | `contactEmail` | Required |
| Contract Start | `contractStart` | Date |
| Status | `status` | Default: `active` |

---

### TASK-05 — Remove Retailer Not Implemented
**Route:** `/dashboard/admin/retailers`  
**Priority:** High  
**Status:** `[ ] To Do`

**What to do:**
Add a Remove action to each Retailer row in the Actions column with confirmation and cascading safety.

**Files to edit:**
- `client-app/src/pages/admin/RetailerManagement.jsx`
  - Add Remove/Delete icon button (use `Trash2` from `lucide-react`) in the Actions column.
  - On click: show a confirmation prompt (warn about cascade: "Removing this retailer will affect its stores and screens").
  - On confirm: call `DELETE /api/retailers/:id` (or `PATCH` for soft-delete — see note below), then remove from table state.
- `ad-server/src/api/retailers.js`
  - **Recommended approach: soft-delete** — implement a `PATCH /api/retailers/:id` that sets `status = 'inactive'` rather than hard-deleting. This preserves referential integrity with `stores`, `screens`, `loops`, and `impressions` that reference `retailerId`.
  - If a hard-delete endpoint is already present, document the cascade behavior. At minimum, consider setting associated `stores.status = 'inactive'` in the same transaction/batch before deleting the retailer.

**Cascade concern:** `stores` and `screens` collections hold `retailerId` as a foreign key. Hard-deleting a retailer while child records exist breaks referential integrity. Use `status = 'inactive'` on the retailer and filter active retailers in all UI queries.

---

### TASK-06 — Make Retailer Inactive Not Implemented
**Route:** `/dashboard/admin/retailers`  
**Priority:** Medium  
**Status:** `[ ] To Do`

**What to do:**
Add a "Make Inactive" toggle/action to the Retailer row so an admin can change a retailer's operational status without deleting them.

**Files to edit:**
- `client-app/src/pages/admin/RetailerManagement.jsx`
  - Add "Make Inactive" (or "Toggle Status") action button to the retailer row Actions column.
  - On click: call `PATCH /api/retailers/:id` with `{ status: 'inactive' }` (or `'active'` to reactivate — make the action a toggle).
  - After success: update the status badge on the row in local state. Do not re-fetch the entire list.
  - Add a visible status badge (e.g., green "Active" / grey "Inactive") to each row to reflect current status.
- `ad-server/src/api/retailers.js`
  - Ensure a `PATCH /api/retailers/:id` route exists that accepts `{ status }` and updates the document in Firestore.
  - The `status` field accepts `'active'` or `'inactive'` per `database_schema.md → retailers`.

---

### TASK-07 — Add Advertiser Dialogue Does Not Persist
**Route:** `/dashboard/admin/advertisers`  
**Priority:** High  
**Status:** `[ ] To Do`

**What to do:**
Fix the "Add Advertiser" form so submitting saves the advertiser to Firestore and refreshes the table.

**Files to edit:**
- `client-app/src/pages/admin/AdvertiserManagement.jsx`
  - Locate the Add Advertiser modal. Bind all fields: `name`, `logo`, `industry`, `contactEmail`, `budget`, `status`.
  - On submit: `POST /api/advertisers`. The returned document ID must be prefixed with `adv` (e.g., `adv_<uuid>`) per QA notes.
  - On success: append new advertiser to table state or re-fetch. Close modal.
  - On error: show inline error. Do not close modal.
- `ad-server/src/api/advertisers.js`
  - Verify `POST /api/advertisers` exists and calls `repository.create()`.
  - Confirm the ID is generated with the `adv` prefix. If the repository uses auto-generated IDs, apply the prefix in the create route handler: `const id = 'adv_' + generateId()`.
  - Confirm `createdAt`/`updatedAt` are auto-populated.

**Data mapping (UI → Firestore `advertisers` collection):**

| UI Label | DB Field | Notes |
|---|---|---|
| Advertiser Name | `name` | Required |
| Logo | `logo` | Optional URL |
| Industry | `industry` | String |
| Contact Email | `contactEmail` | Required |
| Budget | `budget` | Number |
| Status | `status` | Default: `active` |

---

### TASK-08 — Remove Advertiser Not Implemented
**Route:** `/dashboard/admin/advertisers`  
**Priority:** High  
**Status:** `[ ] To Do`

**What to do:**
Add a Remove action to each Advertiser row with confirmation and soft-delete logic.

**Files to edit:**
- `client-app/src/pages/admin/AdvertiserManagement.jsx`
  - Add Remove icon (`Trash2`) to the Actions column for each advertiser row.
  - On click: confirmation prompt ("Removing this advertiser will affect their campaigns").
  - On confirm: call `PATCH /api/advertisers/:id` with `{ status: 'suspended' }` (soft-delete — see note). Update local state.
- `ad-server/src/api/advertisers.js`
  - **Recommended: soft-delete** — implement `PATCH /api/advertisers/:id` to set `status = 'suspended'` rather than hard-deleting. Campaigns reference `advertiserId`; a hard-delete breaks them.
  - If a hard-delete is required by business logic, ensure cascading campaign records are handled (e.g., set associated `campaigns.status = 'ended'`).

---

### TASK-09 — Demo Player: Enforce Cascading Selection Sequence
**Route:** `/player`  
**Priority:** High  
**Status:** `[ ] To Do`

**What to do:**
Enforce a strict 3-step dropdown selection before playback is enabled: Retailer → Store → Screen.

**Files to edit:**
- `client-app/src/pages/Player.jsx`
  - Step 1 — Retailer dropdown: populate from `GET /api/retailers` (active only). On change: reset Store and Screen selectors to empty; fetch stores filtered by `retailerId` (`GET /api/stores?retailerId=<id>`).
  - Step 2 — Store dropdown: disabled until Retailer is selected. Populate from filtered `GET /api/stores?retailerId=<id>`. On change: reset Screen selector; fetch screens filtered by `storeId` (`GET /api/screens?storeId=<id>`).
  - Step 3 — Screen dropdown: disabled until Store is selected. Populate from `GET /api/screens?storeId=<id>`.
  - Play button: disabled (grayed out) until all three — `retailerId`, `storeId`, `screenId` — are set in component state.
  - On Screen selection: trigger schedule fetch for the selected screen (see TASK-10).

**Data model chain:** `retailers → stores (FK: retailerId) → screens (FK: storeId) → loops (FK: screenId + date + hour)`

**Memory efficiency note:** Fetch each level lazily — only load stores after a retailer is selected, only load screens after a store is selected. Do not load all stores/screens at mount.

---

### TASK-10 — Demo Player Must Play Full Day Schedule
**Route:** `/player`  
**Priority:** High  
**Status:** `[ ] To Do`

**What to do:**
Fix the player so it fetches and plays the full ordered day schedule for the selected screen, cycling through all loops exactly once before repeating.

**Files to edit:**
- `client-app/src/pages/Player.jsx`
  - After Screen is selected (or when the user clicks Play), fetch: `GET /api/loops?screenId=<id>&date=<today>` to retrieve all loops for that screen and day.
  - Build a flat ordered playlist from the response: for each loop (ordered by `hour` or loop index), iterate slots array (index 0–11). Each slot's `creativeUrl` is one media item.
  - Playback algorithm: play items in sequential order. After the last slot of the last loop, restart from the first loop (complete one full day cycle then loop). Do not repeat a loop before all others have played.
  - Store the playlist array in component state (or a local ref). Track `currentLoopIndex` and `currentSlotIndex` to advance without re-fetching.
  - On date change or screen change: clear existing playlist state and re-fetch.
- `ad-server/src/api/loops.js`
  - Verify the `GET /api/loops` endpoint supports filtering by `screenId` and `date` query parameters.
  - If not, add `WHERE screenId == req.query.screenId AND date == req.query.date` filters in the route handler. Reference existing filter patterns in `ad-server/src/api/stores.js`.

**Reference:** `user_stories_use_cases.md → Use Case 5 (Daily Loop Generation)` for loop/slot structure.

---

### TASK-11 — Network Map Does Not Render
**Route:** `/dashboard/admin` (Network Map component)  
**Priority:** High  
**Status:** `[ ] To Do`

**What to do:**
Debug and fix the network map so it renders correctly with store pins.

**Files to edit:**
- `client-app/src/pages/admin/NetworkMap.jsx`
  - **CSS check (most common cause):** Verify the map container `<div>` has an explicit non-zero `height` and `width` in CSS or inline style. A container with `height: 0` or `display: none` inherited from a parent will produce a blank map regardless of the library.
  - **API key check:** If using Google Maps, confirm the Maps JavaScript API key is present in the environment (`.env` / GCP Secret Manager). Verify the key is passed to the map component initializer. Check browser console for `InvalidKeyMapError` or `MissingKeyMapError`.
  - **Library initialization check:** If using Leaflet or Mapbox, confirm the CDN/npm dependency is loaded and that `import 'leaflet/dist/leaflet.css'` (or equivalent) is included. Missing CSS causes invisible map tiles.
  - **Pin/marker rendering:** After the map renders, load store records via `GET /api/stores`. For each store, geocode using `stores.address` + `stores.city` fields (see `data_dictionary.md → Store Entity`). Place a marker/pin at each geocoded location.
  - If geocoding is not implemented, use static `lat`/`lng` fields if available on store records, or add them. Do not silently fail if no coordinates exist — log a warning per store.

**Suggested diagnostic order:**
1. Check browser console for map library errors.
2. Inspect the map container element — confirm it has `height > 0`.
3. Confirm API key is loaded and not `undefined` in the component.
4. Add a `console.log('map initialized')` in the init callback to confirm it fires.

---

### TASK-12 — Campaign Edit Does Not Work
**Route:** `/dashboard/brand` → Campaign table → Actions → Edit  
**Priority:** High  
**Status:** `[ ] To Do`

**What to do:**
Wire the Edit button on campaign rows to navigate to the Campaign Wizard pre-populated with existing campaign data, and implement the save-as-update (PUT) path.

**Files to edit:**
- `client-app/src/pages/brand/BrandDashboard.jsx`
  - Locate the campaign table Actions column Edit button.
  - On click: navigate to `/dashboard/brand/campaign/:id/edit` passing the `campaignId` via React Router (route param or `state`). Use `useNavigate()` from `react-router-dom`.
- `client-app/src/App.jsx`
  - Add a new route: `<Route path="/dashboard/brand/campaign/:id/edit" element={<BrandCampaignWizard />} />` (alongside the existing new campaign route).
- `client-app/src/pages/brand/BrandCampaignWizard.jsx`
  - At mount, read `campaignId` from route params (`useParams()`).
  - If `campaignId` is present (edit mode): fetch `GET /api/campaigns/:id` and pre-populate all wizard form fields with the existing campaign data (`id`, `name`, `advertiserId`, `startDate`, `endDate`, `budget`, `status`, `creativeUrl`, etc.).
  - Add an `editMode` flag to component state (`const editMode = !!campaignId`).
  - On final wizard step "Save": if `editMode`, call `PUT /api/campaigns/:id` instead of `POST /api/campaigns`. Navigate back to `/dashboard/brand` on success.
  - All existing step validations and field rules apply identically in edit mode.
- `ad-server/src/api/campaigns.js`
  - Verify `PUT /api/campaigns/:id` route exists and updates the Firestore `campaigns` document.
  - If missing: implement it. Validate fields, merge with existing document, update `updatedAt` via `BaseRepository`.

**Campaign Entity fields to pre-fill:** `id`, `name`, `advertiserId`, `startDate`, `endDate`, `budget`, `status`, `creativeUrl` — see `data_dictionary.md → Campaign Entity`.

---

### TASK-13 — Campaign Status Shows Incorrect Values
**Route:** `/dashboard/brand`  
**Priority:** Medium  
**Status:** `[ ] To Do`

**What to do:**
Derive the displayed campaign status client-side by combining the DB `status` field with the current date, rather than displaying the raw `status` value.

**Files to edit:**
- `client-app/src/pages/brand/BrandDashboard.jsx`
  - Create a `getDisplayStatus(campaign)` helper function (or add to a `utils` file if one exists):
    ```js
    function getDisplayStatus(campaign) {
      const today = new Date();
      const start = new Date(campaign.startDate);
      const end = new Date(campaign.endDate);
      if (campaign.status === 'live' && today >= start && today <= end) return 'Live';
      if (campaign.status === 'live' && today > end) return 'Completed';
      if (campaign.status === 'scheduled' || (campaign.status === 'live' && today < start)) return 'Scheduled';
      if (campaign.status === 'ended') return 'Completed';
      if (campaign.status === 'draft') return 'Draft';
      if (campaign.status === 'pendingapproval') return 'Pending Approval';
      return campaign.status; // fallback
    }
    ```
  - Replace all raw `campaign.status` display references in the campaign table Status column with `getDisplayStatus(campaign)`.
  - Apply appropriate status badge styling (e.g., green for Live, grey for Completed, blue for Scheduled).

**DB status enum:** `draft`, `pendingapproval`, `scheduled`, `live`, `ended`  
**Display labels:** Live, Completed, Scheduled, Draft, Pending Approval

---

### TASK-14 — Report Issue Not Functional
**Route:** `/dashboard/retailer`  
**Priority:** Low  
**Status:** `[ ] To Do`

**What to do:**
Implement the "Report Issue" action on the Retailer Dashboard. Implementation plan is TBD per QA notes — scope at minimum a functional stub.

**Files to edit:**
- `client-app/src/pages/retailer/RetailerDashboard.jsx`
  - At minimum: wire the Report Issue button to open a modal with a text field and submit button.
  - On submit: `POST /api/ops` (or an appropriate incidents/notifications endpoint — see `ad-server/src/api/ops.js` and `notifications.js`) with the issue description and current `screenId`/`retailerId` context.
  - On success: show a confirmation message ("Your issue has been reported").
  - Full implementation scope (incidents system) can be planned in a follow-up sprint.

---

### TASK-15 — Disconnect / Reestablish Not Functional
**Route:** `/dashboard/retailer`  
**Priority:** Low  
**Status:** `[ ] To Do`

**What to do:**
Implement the "Disconnect" and "Reestablish" screen connectivity actions. Per QA notes, implementation plan is TBD.

**Files to edit:**
- `client-app/src/pages/retailer/RetailerDashboard.jsx`
  - Wire Disconnect/Reestablish buttons to call `PATCH /api/screens/:id` with `{ status: 'offline' }` / `{ status: 'online' }` respectively.
  - Update the screen row status badge in local state after success.
  - Consider: this may require a `screenId` context — ensure the selected screen is known before allowing disconnect/reestablish.
- `ad-server/src/api/screens.js`
  - Verify `PATCH /api/screens/:id` exists and updates `screens.status` in Firestore.
  - If missing, add the PATCH route.

---

### TASK-16 — Schedule Calendar Not Functional
**Route:** `/dashboard/retailer`  
**Priority:** Medium  
**Status:** `[ ] To Do`

**What to do:**
Connect the Schedule Calendar component to real loop/schedule data.

**Files to edit:**
- `client-app/src/pages/retailer/ScheduleCalendar.jsx`
  - On mount (or when a screen is selected): fetch `GET /api/loops?screenId=<id>&startDate=<weekStart>&endDate=<weekEnd>` to load the schedule for the current week.
  - Render loop blocks on the calendar grid — each loop occupies the hour slot indicated by the loop's `hour` field.
  - Each slot block should show the loop's time, number of creatives, and status.
  - Lazy-load: only fetch the visible date range. When the user navigates weeks, fetch only the new range.
- `client-app/src/pages/retailer/RetailerDashboard.jsx`
  - Ensure the schedule calendar entry point links correctly to `ScheduleCalendar.jsx` (verify route in `client-app/src/App.jsx`).
- `ad-server/src/api/loops.js`
  - Verify date-range filtering (`startDate`, `endDate` query params) is supported alongside `screenId`. Add if missing.

---

### TASK-17 — Approval History "Go Back" Navigation Broken
**Route:** `/dashboard/retailer/history`  
**Priority:** Medium  
**Status:** `[ ] To Do`

**What to do:**
Fix the "Go Back" button in the Approval/Playback History view so it navigates back to `/dashboard/retailer`.

**Files to edit:**
- `client-app/src/pages/retailer/ScheduleHistory.jsx`
  - Import `useNavigate` from `react-router-dom`.
  - Replace the broken back button handler with: `const navigate = useNavigate(); ... onClick={() => navigate('/dashboard/retailer')}`.
  - Alternatively, replace the button with `<Link to="/dashboard/retailer">Go Back</Link>` if it's a navigation-only action with no side effects.
- `client-app/src/layouts/DashboardLayout.jsx`
  - Verify the breadcrumb/back navigation in `DashboardLayout` is correctly configured for Retailer persona routes (Routes 21–24 per `url_screen_inventory.md`).
  - If `DashboardLayout` uses a `backPath` prop or similar mechanism, ensure the Retailer routes pass the correct back path.

---

### TASK-18 — Add Location Does Not Create a New Store
**Route:** `/player` (Super Admin acting as Retailer)  
**Priority:** High  
**Status:** `[ ] To Do`

**What to do:**
Fix the "Add Location" form in the Demo Player/Admin panel so submitting creates a new store in Firestore.

**Files to edit:**
- `client-app/src/pages/Player.jsx`
  - Locate the Add Location form. Ensure it captures: `name` (store name), `address`, `city`.
  - The `retailerId` must come from the active Retailer context selector (see TASK-19). Block submit if no Retailer context is selected.
  - On submit: `POST /api/stores` with `{ name, retailerId, address, city, status: 'active' }`.
  - On success: append the new store to the Store dropdown list immediately. Clear the form.
  - On error: display inline error message.
- `ad-server/src/api/stores.js`
  - Verify `POST /api/stores` exists and writes to the Firestore `stores` collection.
  - Required fields per `data_dictionary.md → Store Entity`: `name`, `retailerId`, `address`, `city`, `status`.
  - Confirm `createdAt`/`updatedAt` are auto-populated by `BaseRepository`.
  - If the route is stubbed or missing, implement it following the pattern used in `ad-server/src/api/retailers.js`.

---

### TASK-19 — No Retailer Context Selector for Super Admin
**Route:** `/player` (and any Retailer-persona views used by Super Admin)  
**Priority:** High  
**Status:** `[ ] To Do`

**What to do:**
Add a Retailer selector dropdown visible only to Super Admin, so they can act in the context of a specific Retailer without a Retailer login.

**Files to edit:**
- `client-app/src/pages/Player.jsx`
  - Add a "Retailer Context" `<select>` dropdown adjacent to the "Retailer Command Center" heading (or in the page header for Retailer-persona views).
  - Populate from `GET /api/retailers` (all active retailers) on component mount.
  - Display label: `retailer.name`. Value: `retailer.id`.
  - Visibility guard: `{user?.role === 'superadmin' && <RetailerContextSelector />}`.
  - On selection: store the `activeRetailerId` in Zustand (or component-level state shared via context). This value feeds all subsequent API calls on this page (`GET /api/stores?retailerId=<activeRetailerId>`, etc.).
- `client-app/src/stores/` — If no existing store handles `activeRetailerId` context, add it to an existing store (e.g., a `playerStore.js` or `appStore.js`):
  ```js
  // In relevant Zustand store
  activeRetailerId: null,
  setActiveRetailerId: (id) => set({ activeRetailerId: id }),
  ```
  Keep this in-memory only. Do not persist to Firestore.

**Memory note:** Fetch the retailers list once on mount using a memoized query. Avoid re-fetching on every render.

---

### TASK-20 — Unexpected Store Locations Data Audit
**Area:** Store Locations / `MOCKSTORAGE` in `BaseRepository`  
**Priority:** Medium  
**Status:** `[ ] To Do`

**What to do:**
Investigate and resolve the 4 unexpected store records appearing in the UI.

**Files to investigate/edit:**
- `ad-server/src/repositories/BaseRepository.js`
  - Locate the `MOCKSTORAGE` in-memory fallback. List all pre-seeded `stores` records.
  - Identify which have `retailerId` values that correspond to real retailer documents vs. test/mock data.
  - **Resolution option A (preferred):** Remove seed/mock store records from `MOCKSTORAGE` that are not linked to a legitimate active retailer.
  - **Resolution option B:** Add a UI-level filter in the Player or Admin views to exclude stores where `retailerId` does not match the currently selected Retailer context (already required by TASK-19).
- `client-app/src/pages/Player.jsx`
  - After TASK-19 is implemented: the store dropdown should already filter by `activeRetailerId`. This will implicitly hide orphaned mock store records for unrelated retailers.
- Cross-reference: Query `GET /api/retailers` and `GET /api/stores` in the browser console or Postman. Map each `stores.retailerId` to a retailer name. Document any orphaned records in a comment or brief note in the code.

---

### TASK-21 — Tech Ops View Shows Incomplete / Scoped Data
**Route:** `/dashboard/tech`  
**Priority:** Medium  
**Status:** `[ ] To Do`

**What to do:**
Fix the Tech Ops dashboard to show network-wide aggregated counts (all retailers, all stores, all screens) rather than data scoped to a single retailer.

**Files to edit:**
- `client-app/src/pages/tech/` (the Tech Ops dashboard component — check exact filename in `client-app/src/pages/tech/`)
  - Replace any retailer-scoped API calls with global unfiltered calls:
    - `GET /api/retailers` → count all active retailers.
    - `GET /api/stores` (no `?retailerId=` filter) → count all stores.
    - `GET /api/screens` (no store/retailer filter) → count all screens + derive `online`/`offline`/`error` breakdown from `screens.status`.
  - Display three KPI tiles: Total Retailers, Total Stores, Total Screens.
  - Display a status breakdown for screens: Online / Offline / Error counts (or percentage badges).
  - Restrict view access: only render for `role === 'superadmin'` or `role === 'techoperator'`.
- `ad-server/src/api/monitoring.js`
  - Check if a monitoring/aggregate endpoint exists. If so, ensure it does not apply retailer-scoped filters.
  - If needed, add a `GET /api/monitoring/network-summary` route that returns `{ retailers: N, stores: N, screens: N, screenStatus: { online: N, offline: N, error: N } }` to reduce multiple round-trips to a single call.
- `ad-server/src/api/screens.js`
  - Verify `GET /api/screens` supports an unfiltered (admin-level) query and returns all records across all retailers/stores when no filter params are provided. Add role guard: only `superadmin` and `techoperator` may call the unfiltered endpoint.
- `ad-server/src/api/stores.js`
  - Same as above: verify `GET /api/stores` returns all stores when no `retailerId` filter is passed, and is guarded behind admin/tech roles.

---

### TASK-22 — LoopBuilder: Wire Entry Point from Loop Management
**Route:** `/dashboard/admin/loops` → Loop row → "Edit Loop" / "Build Loop" button  
**Priority:** High  
**Status:** `[ ] To Do`  
**Source:** `orphaned.md` Q10 answer

**What to do:**
Add an "Edit Loop" (or "Build Loop") action button to each row in the Loop Management list. Wire it to open the LoopBuilder with the selected loop's ID. Do not route through Campaigns or Screens.

**Files to edit:**
- `client-app/src/pages/admin/LoopManagement.jsx`
  - Add an "Edit Loop" button (or icon + label) to the Actions column of each loop row.
  - On click: navigate to `/dashboard/admin/loops/:id/build` using `useNavigate()`.
- `client-app/src/App.jsx`
  - Add the route: `<Route path="/dashboard/admin/loops/:id/build" element={<LoopBuilder />} />`.
  - Protect the route: only users with `role === 'loop_editor'` or higher may access it. Redirect others to a read-only view (see TASK-23).

---

### TASK-23 — LoopBuilder: Role Guard — Editor vs. Read-Only
**Route:** `/dashboard/admin/loops/:id/build`  
**Priority:** High  
**Status:** `[ ] To Do`  
**Source:** `orphaned.md` Q11 answer

**What to do:**
Gate LoopBuilder write actions behind the `loop_editor` role. Operations staff must see a read-only version of the editor unless a super-admin has explicitly elevated their rights.

**Files to edit:**
- `client-app/src/pages/admin/LoopBuilder.jsx`
  - Read the authenticated user's role from the auth store.
  - Derive `isEditor = user.role === 'loop_editor' || user.role === 'superadmin' || user.hasExplicitEditorGrant`.
  - When `isEditor` is false: disable all slot assignment controls, the save button, and the approve button. Show a read-only banner: "You have view-only access to this loop."
  - When `isEditor` is true: enable all controls normally.

**Role hierarchy for this screen:**
- `superadmin` → full access
- `loop_editor` → full access
- `operations` (no explicit grant) → read-only
- `operations` (super-admin granted) → full access

---

### TASK-24 — LoopBuilder: Block Approval on Empty Slots
**Route:** `/dashboard/admin/loops/:id/build`  
**Priority:** High  
**Status:** `[ ] To Do`  
**Source:** `orphaned.md` Q15 answer

**What to do:**
Prevent the approve action from being triggered if any of the 12 slots has no assigned asset. This guard must be enforced in both the UI and the submission handler on the server.

**Files to edit:**
- `client-app/src/pages/admin/LoopBuilder.jsx`
  - Before enabling the approve button, validate that all 12 slots have a non-null `creativeUrl` (or equivalent asset reference).
  - If any slot is empty: disable the approve button. Show a tooltip or inline message explaining why it is disabled ("All 12 slots must be filled before approving").
- `ad-server/src/api/loops.js`
  - In the approve endpoint handler (`PATCH /api/loops/:id/approve` or equivalent): before writing the `status = 'approved'` update, re-validate server-side that all slots in the loop document are populated.
  - If any slot is empty: return `400 Bad Request` with a descriptive error message listing the empty slot indices.

---

### TASK-25 — LoopBuilder: Empty Slot Error State UI
**Route:** `/dashboard/admin/loops/:id/build`  
**Priority:** High  
**Status:** `[ ] To Do`  
**Source:** `orphaned.md` Q15 answer

**What to do:**
When a user attempts to approve with empty slots, each empty slot must display a clear visual error state — not just a generic message.

**Files to edit:**
- `client-app/src/pages/admin/LoopBuilder.jsx`
  - On failed approval attempt (either user click or API 400 response): set an `emptySlots` array in component state listing the indices of slots with no asset.
  - For each slot in `emptySlots`: apply an error highlight (red border or red background on the slot card) and display a label: "Slot [N] — No asset assigned".
  - Clear the error highlights as soon as the user assigns an asset to the slot.

---

### TASK-26 — LoopBuilder: Mandatory Approval — Remove Bypass Paths
**Route:** `/dashboard/admin/loops/:id/build`  
**Priority:** High  
**Status:** `[ ] To Do`  
**Source:** `orphaned.md` Q12 answer

**What to do:**
Ensure there is no code path that allows a loop to become active on screens without going through explicit approval. This is a non-negotiable content integrity requirement.

**Files to edit:**
- `client-app/src/pages/admin/LoopBuilder.jsx`
  - Audit all submit/save actions. Confirm none of them set `status = 'active'` directly.
  - The only path to `active` status is through the dedicated approve action (see TASK-27).
- `ad-server/src/api/loops.js`
  - Audit all loop write endpoints (`POST`, `PUT`, `PATCH`).
  - Any endpoint that sets `status = 'active'` directly (outside the dedicated approve endpoint) must be removed or blocked.
  - The approve endpoint is the single authoritative path to activation.

---

### TASK-27 — LoopBuilder: Two-Step Approval Confirmation Dialog
**Route:** `/dashboard/admin/loops/:id/build`  
**Priority:** High  
**Status:** `[ ] To Do`  
**Source:** `orphaned.md` Q16 answer

**What to do:**
Implement a mandatory two-step confirmation dialog on the approve action. The dialog must dynamically display how many screens the loop will be activated on.

**Files to edit:**
- `client-app/src/pages/admin/LoopBuilder.jsx`
  - When the user clicks Approve:
    1. **Step 1:** Open a confirmation dialog. Fetch the count of screens assigned to this loop (from loop metadata or a `GET /api/screens?loopId=<id>` call). Display: *"You are activating this loop across N screens — confirm?"*
    2. **Step 2:** Only after the user clicks the confirm button in the dialog does the approve API call fire.
  - Do not use `window.confirm()` — use an inline modal component for UX consistency with the rest of the admin UI.
  - The dialog must have two explicit actions: "Confirm" (fires approve) and "Cancel" (closes dialog, no action taken).

---

### TASK-28 — LoopBuilder: Re-edit Creates New Draft Version
**Route:** `/dashboard/admin/loops/:id/build`  
**Priority:** High  
**Status:** `[ ] To Do`  
**Source:** `orphaned.md` Q13 answer

**What to do:**
When an approved loop is edited, the system must create a new draft version and move the loop back to `pending_approval`. Approval gates each version, not the loop entity.

**Files to edit:**
- `client-app/src/pages/admin/LoopBuilder.jsx`
  - When a user edits an approved loop and saves: the save action must signal to the API that this is a versioned edit (e.g., include a `createNewVersion: true` flag in the request body, or use a dedicated endpoint).
  - After the save succeeds: update local state to reflect `status = 'pending_approval'` and increment the displayed version number.
- `ad-server/src/api/loops.js`
  - On a save/update request for an approved loop:
    1. Do not overwrite the existing approved version document.
    2. Create a new loop version document (or increment a `version` field) with `status = 'draft'`.
    3. Set the parent loop's `activeVersionId` to the new draft and `status = 'pending_approval'`.
  - The previously approved version must remain in the database as the live version until the new draft is approved.

**Version lifecycle:** `draft` → `pending_approval` → `approved/active`. Re-editing an approved loop restarts this cycle for the new version only.

---

### TASK-29 — LoopBuilder: Version State Display in UI
**Route:** `/dashboard/admin/loops/:id/build`  
**Priority:** Medium  
**Status:** `[ ] To Do`  
**Source:** `orphaned.md` Q13 answer

**What to do:**
The LoopBuilder UI must clearly show the current version number and its approval state.

**Files to edit:**
- `client-app/src/pages/admin/LoopBuilder.jsx`
  - Display a version badge or label near the loop title: e.g., "Draft v2 — Pending Approval" or "v1 — Active".
  - The badge must update reactively when the loop's status changes (save, approve, re-edit).
  - Use the `status` and `version` fields from the loop document to derive the display string.

---

### TASK-30 — LoopBuilder: Audit Log — Save Action
**Area:** Backend — `ad-server/src/api/loops.js`, Firestore  
**Priority:** High  
**Status:** `[ ] To Do`  
**Source:** `orphaned.md` Q16 answer

**What to do:**
Every save action on a loop must write an audit log entry to the database. This is a hard launch requirement.

**Files to edit:**
- `ad-server/src/api/loops.js`
  - In the loop save/update endpoint handler: after a successful write, create an audit log entry in a Firestore `loop_audit_log` collection (or append to an `auditLog` subcollection on the loop document — pick one pattern and apply it consistently).
  - Audit entry must include: `loopId`, `action: 'save'`, `userId` (from authenticated session), `timestamp` (server-side, ISO 8601), `loopVersion`, `changedFields` (optional but recommended).
- See TASK-32 for the DB schema definition.

---

### TASK-31 — LoopBuilder: Audit Log — Approve Action
**Area:** Backend — `ad-server/src/api/loops.js`, Firestore  
**Priority:** High  
**Status:** `[ ] To Do`  
**Source:** `orphaned.md` Q16 answer

**What to do:**
Every approve action on a loop must write an audit log entry to the database. This is a hard launch requirement.

**Files to edit:**
- `ad-server/src/api/loops.js`
  - In the loop approve endpoint handler: after a successful approval write, create an audit log entry using the same pattern as TASK-30.
  - Audit entry must include: `loopId`, `action: 'approve'`, `userId`, `timestamp`, `loopVersion`, `screenCount` (number of screens activated).

---

### TASK-32 — LoopBuilder: Audit Log — DB Schema
**Area:** Firestore schema, `docs/database_schema.md`  
**Priority:** High  
**Status:** `[ ] To Do`  
**Source:** `orphaned.md` Q16 answer

**What to do:**
Confirm or create the Firestore collection and document structure for loop audit logs before TASK-30 and TASK-31 are implemented.

**Files to edit:**
- `docs/database_schema.md`
  - Add a `loop_audit_log` collection definition (or document the `auditLog` subcollection pattern on loop documents).
  - Required fields per entry: `loopId` (string), `action` (enum: `save` | `approve`), `userId` (string), `timestamp` (timestamp), `loopVersion` (number), `screenCount` (number, for approve actions only).
- Firestore
  - Create the collection/subcollection as defined. No UI is required for this collection at launch — write-only from the API.

**Note:** The audit log UI (browsing/reviewing logs) is explicitly deferred to post-MVP. Only the DB writes are required now.

---

### TASK-33 — LoopBuilder: E2E Test — Happy Path
**Area:** `tests/`  
**Priority:** High  
**Status:** `[ ] To Do`  
**Source:** `orphaned.md` Q9–Q16 answers

**What to do:**
Write or update an end-to-end test covering the complete LoopBuilder happy path.

**Test steps:**
1. Navigate to Loop Management as a `loop_editor` user.
2. Click "Edit Loop" on a loop row — confirm LoopBuilder opens with the correct loop loaded.
3. Assign assets to all 12 slots.
4. Click Approve — confirm the two-step confirmation dialog appears with the correct screen count.
5. Confirm in the dialog — confirm the loop status changes to `active` / `approved`.
6. Verify an audit log entry exists for the approve action (DB check or API call).

---

### TASK-34 — LoopBuilder: E2E Test — Blocked Approval Path
**Area:** `tests/`  
**Priority:** High  
**Status:** `[ ] To Do`  
**Source:** `orphaned.md` Q15 answer

**What to do:**
Write or update a test confirming that approval is blocked when one or more slots are empty.

**Test steps:**
1. Open LoopBuilder with a loop that has at least one empty slot.
2. Confirm the Approve button is disabled.
3. Confirm empty slots display the error highlight and label.
4. Attempt to call the approve API endpoint directly (bypass UI) — confirm a `400` response is returned.

---

### TASK-35 — LoopBuilder: Role Enforcement Test
**Area:** `tests/`  
**Priority:** Medium  
**Status:** `[ ] To Do`  
**Source:** `orphaned.md` Q11 answer

**What to do:**
Write a test confirming that operations staff without an explicit editor grant cannot perform write actions in LoopBuilder.

**Test steps:**
1. Open LoopBuilder as an `operations` user (no explicit editor grant).
2. Confirm all slot assignment controls are disabled.
3. Confirm the Save and Approve buttons are not visible or are disabled.
4. Confirm the read-only banner is displayed.

---

### TASK-36 — LoopBuilder: Audit Log Verification Test
**Area:** `tests/`  
**Priority:** Medium  
**Status:** `[ ] To Do`  
**Source:** `orphaned.md` Q16 answer

**What to do:**
Write a test confirming audit log entries are correctly written for both save and approve actions.

**Test steps:**
1. Perform a save action on a loop as a `loop_editor` user.
2. Query the `loop_audit_log` collection (or subcollection) — confirm an entry exists with `action: 'save'`, correct `userId`, and a valid `timestamp`.
3. Perform an approve action on the same loop.
4. Query again — confirm an entry exists with `action: 'approve'`, correct `userId`, `loopVersion`, and `screenCount`.

---

## Do Not Touch

Per QA notes, the following are confirmed working and must **not** be modified:

- `/player` — Preview Demo feature: **OK, do not modify**
- `/dashboard/brand/campaign/new` — New Campaign Wizard: **OK, do not modify**
- `/dashboard/admin/hours` — Store Hours (BusinessHoursManagement.jsx): **No bugs noted, no changes required**
- Campaign Pause Action: leave as-is (no functionality, no changes required)
- Campaign Settings Action: leave as-is (no functionality, no changes required)

---

## Reference Files (do not modify, use for lookup)

| File | Purpose |
|---|---|
| `docs/database_schema.md` | Firestore collection schemas |
| `docs/data_dictionary.md` | Entity definitions, field types, role enums |
| `docs/url_screen_inventory.md` | All routes and their read/write collections |
| `docs/user_stories_use_cases.md` | Use case specs (esp. Use Case 5 for loop structure) |
| `ad-server/src/repositories/BaseRepository.js` | Audit fields (`createdAt`, `updatedAt`), `MOCKSTORAGE` fallback |
| `client-app/src/App.jsx` | React Router route definitions |
| `client-app/src/layouts/DashboardLayout.jsx` | Shared layout, breadcrumb, back navigation |
| `orphaned.md` | Orphaned screen decisions and Q&A — source of TASK-22 through TASK-36 |

---

## Notes for Developer

- **Icon library:** Use `lucide-react` for all new icons (`Trash2`, `ToggleLeft`, `ChevronDown`, etc.) — consistent with existing codebase.
- **State management:** Use Zustand for cross-component/page state. Use local React state for single-component state (form fields, modal open/close). Do not persist debug/admin toggles to Firestore.
- **API error handling:** Every mutating API call (POST/PUT/PATCH/DELETE) must handle both success and error states with a visible UI response. Do not silently fail.
- **Soft-delete convention:** When removing Retailers or Advertisers, prefer `status = 'inactive'` / `status = 'suspended'` over hard-delete to preserve referential integrity with `loops`, `impressions`, and `campaigns`.
- **Memory efficiency:** Fetch data lazily and in small scopes. Do not load all stores/screens at mount; load only what the current selection requires. Use memoization (`useMemo`, `useCallback`) where appropriate to avoid redundant re-renders.
- **Auth/role guards:** All Super Admin-only features (overlay toggle, Retailer context selector) must check `user.role === 'superadmin'` before rendering.
- **Audit logging (TASK-30, TASK-31, TASK-32):** Audit log writes are a hard MVP requirement for LoopBuilder. Audit log UI is deferred to post-MVP.
- **Loop versioning (TASK-28):** Never overwrite an approved loop version. Always create a new draft version and keep the approved version as the live fallback until the new version is approved.
