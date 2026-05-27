# Sprint – Admin & Brand Flows Hardening (Retailers, Screens, Stores, Campaign Dates)

## Story 1 – Retailer delete persists (2.4)

**Goal**  
Deleting a retailer removes it from DB and it stays gone after refresh.

**Likely areas to work in**  
- Backend/API (ad server / data layer): `ad-server/` (REST/GraphQL handlers, models)  
- Frontend (admin UI): `client-app/src/**` (React pages for retailers list, API client)  
- Tests: `tests/` (Playwright E2E and any API tests)

**Tasks**

- Backend  
  - Locate retailer routes/handlers in `ad-server` (for example: `ad-server/src/routes/retailers.*`, `ad-server/src/controllers/retailers.*`).  
  - Verify DELETE handler actually writes to DB and list queries filter out deleted retailers.  
  - Add or update unit/integration tests for retailer deletion under `ad-server/tests` or `tests/api`.

- Frontend  
  - In `client-app`, find the admin retailer list page (likely under `client-app/src/pages/admin` or similar) and its API hooks.  
  - Ensure delete action calls the correct endpoint and updates local state; on reload, list endpoint no longer returns the deleted retailer.  
  - Add or extend Playwright test case in `tests/` to cover: delete retailer → refresh → verify absence.

- SRE/QA  
  - Add a short checklist item to `qa-human-test-plan.md` describing the manual path for this bug.

---

## Story 2 – Screen status toggle works (2.8 – status)

**Goal**  
Admin can toggle screen active/inactive; change persists and no generic error banner.

**Likely areas**  
- Backend: screen status field and update endpoint in `ad-server`.  
- Frontend: screen management UI in `client-app`.  
- Tests: Playwright `tests/` and any unit tests.

**Tasks**

- Backend  
  - In `ad-server`, identify screen model and controller (for example: `ad-server/src/models/screen.*`, `ad-server/src/controllers/screens.*`).  
  - Verify update endpoint accepts a status flag and restricts update to the correct screen ID.  
  - Improve error messages so the frontend can show precise failures instead of a generic banner.

- Frontend  
  - Find the screen list UI in `client-app` (for example: `client-app/src/pages/screens/*`).  
  - Ensure status slider:  
    - Sends correct payload.  
    - Optimistically updates UI then rolls back on error.  
  - Wire detailed error messages into any global notification component.

- Tests  
  - Add a Playwright scenario under `tests/` to flip screen status, reload, and verify it sticks.

---

## Story 3 – Screen deletion is functional (2.8 – delete)

**Goal**  
Admin can delete a screen; it disappears from list and DB.

**Likely areas**  
- `ad-server` for delete endpoint and schedule/slot dependencies.  
- `client-app` for UI delete button and confirmation flows.  
- `tests/` for E2E coverage.

**Tasks**

- Backend  
  - In `ad-server`, locate screen delete handler and check for soft/hard delete semantics and referential integrity with schedules/slots.  
  - Fix any silent failures and harmonize error responses.

- Frontend  
  - In `client-app`, extend screen list page to call delete endpoint with confirmation.  
  - After success, remove screen from the list; ensure it does not reappear after reload.

- Tests  
  - Add Playwright tests for: delete screen → no longer visible → stays gone after reload.

---

## Story 4 – Campaign dates consistent across tabs (2.10)

**Goal**  
Dates chosen in Schedule tab match dates in Slots tab exactly.

**Likely areas**  
- Frontend state/logic in `client-app` (campaign creation flow).  
- Backend serialization in `ad-server`.

**Tasks**

- Frontend  
  - In `client-app`, identify the campaign scheduling flow components; look under route files referencing “schedule” or “slots”.  
  - Ensure both tabs share one campaign state object (context or store) for start/end dates.  
  - Normalize to a single timezone and format when passing across tabs.

- Backend  
  - In `ad-server`, inspect campaign model/controllers for date handling and check that responses and requests use ISO timestamps consistently.

- Tests  
  - Add a Playwright test to create a campaign, set dates in Schedule, move to Slots, and verify exact match. Put under `tests/campaign-date-flow.spec.*`.

---

## Story 5 – Store opening time per store (3.2)

**Goal**  
Editing opening time impacts only that store, not all stores.

**Likely areas**  
- `ad-server`: store model and hours update route.  
- `client-app`: retailer → store management screens.

**Tasks**

- Backend  
  - Find store data model and hours update logic under `ad-server/src/**` (search for "storeHours", "openingHours").  
  - Ensure update is keyed on store ID rather than retailer ID or a shared template.  
  - Adjust DB queries/ORM calls to avoid bulk updates on the retailer.

- Frontend  
  - In `client-app`, inspect the UI used to edit store opening hours; confirm each save request includes the store ID and not just retailer ID.  
  - Fix any state sharing that might be copying values across multiple rows.

- Tests  
  - Add an E2E test: change Store A hours → refresh → Store B hours unchanged. Place under `tests/store-hours.spec.*`.

---

## Story 6 – Closed weekday per store (3.3)

**Goal**  
Setting a weekday to “closed” affects only that store; no global change.

**Likely areas**  
- Shared with Story 5 in `ad-server` and `client-app`.

**Tasks**

- Backend  
  - Reuse store model/hours logic; ensure closed flags are stored per store.  
  - Add regression test that toggling closed on one store does not change others.

- Frontend  
  - Verify checkboxes/toggles for closed days are bound to specific store entries, not a shared object.

- Tests  
  - Extend the store-hours Playwright spec to include per-store closed-day toggles.

---

## Story 7 – Store CRUD via Retailer Management

**Goal**  
From a given retailer, admin can add/edit/delete multiple stores.

**Likely areas**  
- `client-app`: retailer detail route, store list, forms.  
- `ad-server`: CRUD endpoints for stores under a retailer.  
- Docs: QA and SRE notes docs in repo.

**Tasks**

- Backend  
  - In `ad-server`, ensure existence and correct behavior of:  
    - List stores for retailer.  
    - Create store for retailer.  
    - Update store.  
    - Delete store.  
  - Add or harden tests for full CRUD.

- Frontend  
  - In `client-app`, implement/verify:  
    - Retailer detail view that loads a store list.  
    - Modal or page for adding a store, editing, and deleting.  
  - Confirm behavior against QA manual checklist and `qa-human-test-plan.md` scenarios.

- QA/SRE docs  
  - Add a short “store CRUD” scenario to `qa-human-test-plan.md`.  
  - Optionally add a line item to `SPRINT_QA_TASKS.md` or `tasks.md` under this sprint name.
