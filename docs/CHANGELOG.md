# Changelog

## [Unreleased]

### Added
- Created unified role string constants (`ROLES`, `ROLE_HIERARCHY`, and `normalizeRole()`) in `client-app/src/constants/roles.js` and `ad-server/src/constants/roles.js` to serve as a Single Source of Truth (SSOT) for RBAC roles.

### Fixed
- Migrated frontend and backend files (including `DashboardLayout.jsx`, `PersonaSwitcher.jsx`, `AuthContext.jsx`, `CampaignManagement.jsx`, `LoopDemoPlayer.jsx`, `Overview.jsx`, `UserManagement.jsx`, `requireRole.js`, `invoices.js`, `campaigns.js`, `users.js`, `advertisers.js`, `retailers.js`, and `screens.js`) to consume central role constants, eliminating all magic role strings and duplicate role maps across the project.
- Migrated 5 isolated UI components to the `apiClient` singleton and banned native `fetch()` via ESLint to prevent API auth bypasses.
- Switched UI components (`ScheduleCalendar.jsx`, `LoopDemoPlayer.jsx`) from reading `localStorage` synchronously to consuming `useAuth()` React Context to resolve demo persona switching latency.
- Fixed Vite proxy configuration to default to ad-server port 8080 instead of dormant port 3001.
- Fixed nested /loops API routes resolving to 404 by properly nesting them under /locations router.
- Fixed Playwright configuration to ensure demo wizard tests run strictly under the isolated demo-wizard profile, eliminating concurrent race conditions.
- Fixed duplicate imports syntax error in `08_retailer_approval.spec.js`.
- Fixed missing `AdminOverview` data-testid locator in test definitions.
- Fixed infinite retry loop in `Player.jsx` during E2E tests caused by 403 network connection refusals dropping into the reconnect flow.
- Fixed Playwright locators for campaign text in Schedule Manager and Loop Analytics to filter by visibility (`filter({ visible: true })`), preventing collisions with hidden details tooltip cards.
- Restored `fullday` view as default in `ScheduleManager.jsx` and updated it to fetch actual location loops from `/api/locations/:id/loops` to resolve slot-shifting E2E timeouts.
- Consolidated invoice test ID states in `Invoices.jsx` to prevent page wrapper swaps from breaking loaded-state E2E assertions.
- Normalized telemetry API parameter mappings in `TelemetryService.js` (supporting both camelCase and snake_case properties like `screenId` vs `screen_id`) to ensure play events are correctly logged to the database.
- Cleaned up unused imports/variables in 13 backend Jest suites to satisfy strict linting.
- Moved unmaintained legacy E2E specs to `tests/legacy/` and configured Playwright to ignore them.

