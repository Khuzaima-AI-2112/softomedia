# Sprint – Admin & Brand Flows Hardening (Retailers, Screens, Stores, Campaign Dates)

## Story 1 – Retailer delete persists (2.4)

**Goal**  
Deleting a retailer removes it from the appropriate data state and it stays gone from all lists after refresh, according to the deletion mode.

**Likely areas to work in**  
- Backend/API (ad server / data layer): `ad-server/` (REST/GraphQL handlers, models)  
- Frontend (admin UI): `client-app/src/**` (React pages for retailers list, API client)  
- Tests: `tests/` (Playwright E2E and any API tests)

**Acceptance criteria**  
- When an admin clicks “Delete retailer”, a dialog offers two options:  
  - Soft delete (archived): retailer no longer appears in any admin/brand lists, but remains recoverable.  
  - Permanent delete: retailer and its data are removed and cannot be restored.  
- If the retailer has existing screens/stores/campaigns:  
  - The system blocks both soft and hard delete and shows a clear message instructing the admin to clean up dependencies first.  
- For soft-deleted retailers:  
  - They do not appear in any standard UI lists.  
  - Admin has a way (view or filter) to restore them; restoring returns them to normal state.  
- For permanently deleted retailers:  
  - They do not appear in any list or recovery view after refresh.  
  - There is no restore option.

**Tasks**

- Backend  
  - Locate retailer routes/handlers in `ad-server` (for example: `ad-server/src/routes/retailers.*`, `ad-server/src/controllers/retailers.*`).  
  - Implement soft delete and hard delete flows and ensure list queries filter out soft-deleted retailers.  
  - Enforce dependency checks (screens/stores/campaigns) before allowing either delete.  
  - Add or update unit/integration tests for retailer deletion and restore under `ad-server/tests` or `tests/api`.

- Frontend  
  - In `client-app`, find the admin retailer list page (likely under `client-app/src/pages/admin` or similar) and its API hooks.  
  - Add a delete dialog that lets the admin choose soft vs permanent delete and calls the appropriate endpoint.  
  - Ensure delete action updates local state; on reload, list endpoint no longer returns deleted retailers.  
  - Add or extend Playwright test case in `tests/` to cover: delete retailer (both modes) → refresh → verify behaviour.  
  - Add restore UI for soft-deleted retailers if required by UX.

- SRE/QA  
  - Add a short checklist item to `qa-human-test-plan.md` describing both delete modes and the dependency-blocking behaviour.

---

## Story 2 – Screen status toggle works (2.8 – status)

**Goal**  
Admin can toggle a screen between `active` and `inactive`; changes persist and are validated against campaigns.

**Likely areas**  
- Backend: screen status field and update endpoint in `ad-server`.  
- Frontend: screen management UI in `client-app`.  
- Tests: Playwright `tests/` and any unit tests.

**Acceptance criteria**  
- Supported screen statuses:  
  - `active`: screen can be used in campaign schedules.  
  - `inactive`: screen cannot be used in new or updated campaigns.  
- When changing a screen’s status:  
  - Before persisting, the system checks if there are any active or upcoming campaigns on that screen.  
  - If the change is invalid (for example, trying to inactivate a screen currently in an active campaign), the update is rejected and a clear reason is shown to the admin.  
- On a successful status change:  
  - The toggle updates visually.  
  - A confirmation (such as a toast) appears indicating success.  
  - After page refresh, the new status persists.

**Tasks**

- Backend  
  - In `ad-server`, identify screen model and controller (for example: `ad-server/src/models/screen.*`, `ad-server/src/controllers/screens.*`).  
  - Ensure the update endpoint accepts a status flag, validates against active/upcoming campaigns, and restricts update to the correct screen ID.  
  - Improve error messages so the frontend can show precise failures (reason for rejection).

- Frontend  
  - Find the screen list UI in `client-app` (for example: `client-app/src/pages/screens/*`).  
  - Ensure the status slider sends the correct payload and handles optimistic update with rollback on error.  
  - Wire detailed error messages into any global notification component and show a toast on success.

- Tests  
  - Add a Playwright scenario under `tests/` to flip screen status, reload, and verify it sticks.  
  - Add backend tests for valid and rejected status changes based on campaign state.

---

## Story 3 – Screen deletion is functional (2.8 – delete)

**Goal**  
Admin can delete a screen when it is safe to do so; deletion is blocked when there are active or upcoming campaigns, and an audit trail exists.

**Likely areas**  
- `ad-server` for delete endpoint and schedule/slot dependencies.  
- `client-app` for UI delete button and confirmation flows.  
- `tests/` for E2E coverage.

**Acceptance criteria**  
- Admin may delete a screen if it has no active or upcoming campaigns.  
- Historical campaigns are allowed; those records remain but are handled consistently (for example, keep a reference to the deleted screen for reporting if required).  
- If a screen is linked to active or upcoming campaigns, deletion is blocked and a specific error explains that the screen cannot be deleted until those campaigns are adjusted.  
- Once deleted, the screen no longer appears in any screen lists after refresh.  
- An audit trail is recorded for each deletion (who deleted, when, previous status), either in logs or an audit store.

**Tasks**

- Backend  
  - In `ad-server`, locate the screen delete handler and implement checks for active/upcoming campaigns.  
  - Decide and implement behaviour for historical campaigns (retain references or anonymize) as per product requirements.  
  - Add logging or audit entries for each delete.  
  - Add backend tests covering allowed deletion and blocked deletion cases.

- Frontend  
  - In `client-app`, extend the screen list page to call the delete endpoint with a confirmation dialog.  
  - On success, remove the screen from the list; ensure it does not reappear after reload.  
  - On failure due to active campaigns, show the specific error message returned by the backend.

- Tests  
  - Add Playwright tests for: delete screen with no active campaigns → no longer visible → stays gone after reload.  
  - Add a test for delete attempt with active campaigns → action blocked with clear error.

---

## Story 4 – Campaign dates consistent across tabs (2.10)

**Goal**  
Campaign dates are based on the store’s timezone; the Slots tab adjusts but remains logically consistent with the Schedule tab.

**Likely areas**  
- Frontend state/logic in `client-app` (campaign creation flow).  
- Backend serialization in `ad-server`.

**Acceptance criteria**  
- Source of truth timezone: all campaign dates are interpreted and stored relative to the store’s timezone.  
- When a brand selects start/end dates in the Schedule tab, the Slots tab uses those dates and may adjust them only according to defined business rules (for example, snapping to valid store opening days/hours), not arbitrarily.  
- Any adjustments made by the Slots tab are predictable and documented so QA can verify them.  
- For campaigns that cross time boundaries (for example, start late one day and run into the next), both tabs clearly indicate the correct start and end based on the store’s timezone, with no off-by-one-day drift between tabs.

**Tasks**

- Frontend  
  - In `client-app`, identify the campaign scheduling flow components; look under route files referencing “schedule” or “slots”.  
  - Ensure both tabs share one campaign state object (context or store) for start/end dates, including the store timezone.  
  - Implement the Slots tab adjustment rules based on the store’s timezone and opening hours.  
  - Update UI so that multi-day or boundary-crossing campaigns are displayed clearly and consistently in both tabs.

- Backend  
  - In `ad-server`, inspect campaign model/controllers for date handling and check that responses and requests use an ISO format tied to the store timezone.  
  - Ensure that backend validations and calculations respect the store’s timezone.

- Tests  
  - Add a Playwright test to create a campaign, set dates in Schedule, move to Slots, and verify dates are consistent and any adjustments match the defined rules.  
  - Add backend tests for date parsing and timezone behaviour per store.

---

## Story 5 – Store opening time per store (3.2)

**Goal**  
Most retailers share default opening hours across all stores, but individual stores can override those hours when needed, without changing everyone else.

**Likely areas**  
- `ad-server`: store model and hours update route.  
- `client-app`: retailer → store management screens.

**Acceptance criteria**  
- There is a retailer-level default schedule that applies to all stores initially.  
- Each store can have its own override schedule when edited.  
- If a store has never been customized, it uses the retailer’s shared default.  
- When an admin edits a specific store’s opening time, that store gets its own override and only that store changes.  
- Other stores continue using the retailer default or their own overrides; no unintended bulk updates occur.  
- Existing shared hours remain as the retailer default; overrides are only created when a store is explicitly edited.  
- The UI makes it clear when the admin is editing a store’s specific hours versus the shared retailer default.

**Tasks**

- Backend  
  - Find store data model and hours update logic under `ad-server/src/**` (search for "storeHours", "openingHours").  
  - Implement retailer-level default hours and per-store override mechanics in the data model.  
  - Ensure update endpoints apply changes only to the targeted store when an override is created or modified.  
  - Add backend tests verifying default vs override behaviour.

- Frontend  
  - In `client-app`, inspect the UI used to edit store opening hours.  
  - Ensure each save request includes the store ID and indicates whether the admin is editing default or override.  
  - Fix any state sharing that might be copying changes across multiple rows unintentionally.  
  - Update UI to show whether a store is using default hours or custom hours.

- Tests  
  - Add an E2E test: change Store A hours → refresh → Store B hours unchanged. Place under `tests/store-hours.spec.*`.  
  - Add a test for creating and reverting store-specific overrides.

---

## Story 6 – Closed weekday per store (3.3)

**Goal**  
Weekday “closed” flags can be managed per store, with an option to apply changes to all stores and support for temporary closures.

**Likely areas**  
- Shared with Story 5 in `ad-server` and `client-app`.

**Acceptance criteria**  
- Each store can be configured so a given weekday is open or closed.  
- When editing one store’s weekday closed setting, the admin has an explicit option to “apply this closed/open setting to all stores” for that weekday; if selected, the change propagates to all of that retailer’s stores.  
- Admin can configure a store as “temporarily closed” for a specific period of time without changing the permanent weekday schedule.  
- After the temporary closure period ends, the store reverts to its normal weekday open/closed settings.  
- The UI clearly distinguishes between permanent weekday closure and temporary closure periods.

**Tasks**

- Backend  
  - Reuse and extend the store hours model to support per-store weekday closed flags and temporary closure periods.  
  - Implement an operation to apply a weekday closed/open change to all stores of a retailer when requested.  
  - Add regression tests that toggling closed on one store only affects that store unless the “apply to all” option is used.

- Frontend  
  - Verify checkboxes/toggles for closed days are bound to specific store entries by default.  
  - Add a clear control (for example, a checkbox) for “apply this closed/open setting to all stores”.  
  - Add UI for configuring temporary closures (start/end dates) and displaying current temporary closure status.

- Tests  
  - Extend the store-hours Playwright spec to include per-store closed-day toggles and the “apply to all stores” option.  
  - Add tests for temporary closure periods and correct reversion after the period ends.

---

## Story 7 – Store CRUD via Retailer Management

**Goal**  
From a retailer’s detail view, admin can fully manage stores with mandatory fields and safe deletion that respects active campaigns.

**Likely areas**  
- `client-app`: retailer detail route, store list, forms.  
- `ad-server`: CRUD endpoints for stores under a retailer.  
- Docs: QA and SRE notes docs in repo.

**Acceptance criteria**  
- Mandatory fields for store creation/editing: name, address, retailer linkage, opening hours configuration, and geolocation (or equivalent location representation). All are required.  
- The UI prevents saving if any required field is missing or invalid and shows clear validation messages.  
- When deleting a store:  
  - If there is an active campaign for that store, the system informs the user before deleting and follows the agreed rule (block or allow with clear consequences).  
  - A confirmation dialog warns about the impact (for example, “This will remove this store and may affect associated schedules for this store”).  
  - After confirming, the store disappears from the retailer’s store list and does not reappear after refresh.

**Tasks**

- Backend  
  - In `ad-server`, ensure existence and correct behaviour of: list stores for retailer, create store for retailer, update store, delete store.  
  - Implement checks for active campaigns when deleting a store and return appropriate warnings or errors.  
  - Add or harden tests for full store CRUD and campaign dependency handling.

- Frontend  
  - In `client-app`, implement/verify:  
    - Retailer detail view that loads a store list.  
    - Modal or page for adding a store with all mandatory fields.  
    - Edit and delete flows that respect validation and campaign dependency rules.  
  - Confirm behaviour against QA manual checklist and `qa-human-test-plan.md` scenarios.

- QA/SRE docs  
  - Add a short “store CRUD” scenario to `qa-human-test-plan.md`, including active-campaign delete behaviour.  
  - Optionally add a line item to `SPRINT_QA_TASKS.md` or `tasks.md` under this sprint name.
