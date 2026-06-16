# Sprint 12 – Retailer → Campaign Flow Stabilization

## Objective
Ensure QA can reliably complete an end-to-end campaign workflow by making retailers real, visible, and schedulable, and by stabilizing the campaign wizard.

## Outcomes
- Retailers created in the Super Admin UI persist to Firestore and appear in all relevant lists.
- The campaign scheduler consistently lists at least one active retailer in QA/dev environments.
- The campaign wizard can be completed end-to-end for at least one test retailer.
- Cross-surface contract tests prevent regressions between Admin CRUD and the brand scheduler.

## Workstreams

### 1. Super Admin → Retailer persistence
- Implement/verify `POST /api/retailers`, `PATCH /api/retailers/:id`, `DELETE /api/retailers/:id` in `ad-server/src/api/retailers.js` using `RetailerRepository`.
- Enforce `requireRole('superadmin')` on all retailer mutation routes.
- Wire `createRetailer`, `updateRetailer`, `deleteRetailer` in `ApiService.js` and replace any remaining stubs or TODOs in `RetailerManagement.jsx`.
- Default new retailers to `status='active'` (or ensure the approval flow flips them to `active`) so they are schedulable.

### 2. Seed canonical test retailer (SRE safety net)
- Add a small bootstrap script or migration that seeds `Test Retailer A` with:
  - `status='active'`
  - at least one location/store
  - at least one screen
- Run the seed in development and QA environments.
- Update QA documentation to always verify that `Test Retailer A` appears in scheduler retailer lists.

### 3. Admin → Scheduler linkage
- Identify the endpoint the campaign scheduler uses to fetch retailers and standardize it (e.g. `GET /api/retailers?for=campaign`).
- Implement backend logic that returns schedulable retailers based on:
  - `status='active'`
  - any required associations (e.g. at least one screen)
  - correct role guard (e.g. `requireRole('brand')`).
- Add an integration test that:
  - creates a retailer via `POST /api/retailers` as superadmin
  - fetches scheduler retailers as brand
  - asserts the created retailer is present.

### 4. Campaign wizard stabilization
- Fix the known bug where the campaign wizard cannot confirm schedule and dates mismatch.
- Ensure the confirm step:
  - calls the correct backend route (e.g. `POST /api/campaigns`)
  - surfaces validation errors instead of silently disabling the confirm button.
- Correct date binding so selected ranges match what is submitted and displayed.
- Add a minimal E2E happy-path test:
  - select `Test Retailer A`
  - pick a valid date range and a simple creative
  - confirm schedule
  - assert the campaign appears in a campaign list view.

### 5. Observability and QA guardrails
- Add structured logging for retailer lifecycle:
  - on `POST`/`PATCH` log `retailer_id`, `status`, `origin_route`.
- Add logging for scheduler retailer queries:
  - log count of returned retailers and requesting role.
- Ensure errors from Admin CRUD and scheduler API calls surface as visible UI messages (no silent failures).
- Document the QA smoke flow:
  - Create retailer as superadmin (or use `Test Retailer A`).
  - Verify retailer appears in scheduler as brand.
  - Complete a full campaign wizard run.

## Acceptance Criteria
- QA can see at least one retailer in the campaign scheduler in QA/dev without manual database edits.
- Creating a retailer via Super Admin UI results in that retailer appearing in the scheduler retailer list after a hard refresh.
- At least one automated test exists asserting Admin → Scheduler retailer propagation.
- At least one E2E test exists that completes a full campaign wizard for `Test Retailer A`.
- Observability shows structured logs for retailer creation/update and scheduler retailer queries in QA/dev.
