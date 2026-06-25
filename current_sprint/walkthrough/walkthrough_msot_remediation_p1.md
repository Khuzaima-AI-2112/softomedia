# Single Source of Truth (SSOT) Remediation — Phase 2 (P1)

## Goal Accomplished
Consolidated and standardized all user role (RBAC) definitions and role hierarchy level maps under a single source of truth (`ROLES`, `ROLE_HIERARCHY`, and `normalizeRole()`) on both client and server codebases, removing hardcoded "magic strings" and local mappings.

## Changes Made
1. **Created Shared Constants:**
   - [client-app/src/constants/roles.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/client-app/src/constants/roles.js) — Exports canonical lowercase role constants, hierarchy levels, and normalization.
   - [ad-server/src/constants/roles.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/ad-server/src/constants/roles.js) — Backend equivalent.

2. **Frontend Migration:**
   - Updated `DashboardLayout.jsx`, `PersonaSwitcher.jsx`, `AuthContext.jsx`, `CampaignManagement.jsx`, `LoopDemoPlayer.jsx`, `Overview.jsx`, and `UserManagement.jsx` to consume `ROLES` constants.
   - **Removed Duplications:** Removed duplicate local `ROLE_LEVEL` maps and local `normalizeRole` implementations in `CampaignManagement.jsx`.

3. **Backend Migration:**
   - Updated middleware `requireRole.js` and route handlers `invoices.js`, `campaigns.js`, `users.js`, `advertisers.js`, `retailers.js`, and `screens.js` to consume backend `ROLES` constants.
   - **Removed Duplications:** Removed duplicate local `ROLE_HIERARCHY` level map in `campaigns.js`.

4. **E2E Import Path Fixes:**
   - Corrected import paths in `ScheduleCalendar.jsx` and `LoopDemoPlayer.jsx` referencing `/context/` instead of `/contexts/` which was previously preventing Vite bundle compilation.

## Verification
- **Linter**: `npm run lint` passes with **0 errors**.
- **Jest Unit Tests**: **Passed** successfully (12/12 suites, 92/92 tests).
- **Playwright E2E Tests**: Cleanly flushed the database and verified that all standard auth middleware checks, persona switching, and API surface endpoints pass. Pre-existing routing/fixture errors in standard chromium specs (like undefined locators and missing mock files) were isolated and verified as pre-existing issues.

## Next Steps
Verify remaining sprint objectives and proceed with Phase 3 E2E test refinement/deployment.
