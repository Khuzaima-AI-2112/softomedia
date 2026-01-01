# Lessons Learned

Objectives: Document errors, bugs, and mistakes so we do not make them again.

## Development Lessons

### [2026-01-01] Ad Rotation Safety
- **Issue**: Client player rotation was ambiguous (defaulting to 10s) and lacked background syncing for hourly schedules.
- **Root Cause**: Hardcoded fallback values in `Player.jsx` and missing polling mechanism.
- **Prevention**: Forces 5-second rotation and implemented 60-second back-end polling to stay synced with `hourlyLoop`.

### [2026-01-01] Auth to Persona Refactoring
- **Issue**: Traditional login/redirect patterns blocked the seamless switching required for "Persona Mode" demos.
- **Root Cause**: `ProtectedRoute` was hardcoded to check for a `user` object and return a `/login` redirect.
- **Prevention**: Removed `ProtectedRoute` entirely. Refactored `AuthContext` to manage `persona` state with local storage persistence, ensuring all routes are accessible while the UI adapts based on the active persona.

### [2026-01-01] E2E Testing & UI Accessibility
- **Issue**: Playwright tests were brittle due to Material Icon text leaking into button accessible names (e.g., getting "shield_person Brand" instead of just "Brand").
- **Root Cause**: Reliance on `getByRole('button', { name: 'Label' })` without explicit `aria-label` when icons are used inside buttons.
- **Prevention**: Always add `aria-label` to buttons containing Material Icons and use regex or `exact: false` in Playwright selectors.

### [2026-01-01] E2E State Isolation
- **Issue**: Tests were failing non-deterministically when run in sequence or parallel because persona state in `localStorage` persisted between tests.
- **Root Cause**: Previous tests changing the active persona without resetting it for the next test block.
- **Prevention**: Use `page.addInitScript` in `beforeEach` hooks to explicitly set the required `localStorage` state (e.g., `active_persona`) before the page loads.

### [2026-01-01] Selector Standardization (data-test vs data-testid)
- **Issue**: Gold Path integration test failing because UI components used `data-test` while tests expected `data-testid`.
- **Root Cause**: Inconsistent attribute naming conventions across components (`PersonaSwitcher` vs `HamburgerMenu`).
- **Prevention**: Standardize all test selectors on `data-testid`. Update all components to use the same convention and verify with `grep_search` before adding new tests.

---
*Note: This file is a permanent project record. Do not delete or purge entries.*
