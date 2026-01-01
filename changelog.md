# Project Changelog

Objectives: Document changes and progress milestones throughout the project lifecycle.

## [2026-01-01] - SRE-Grade UI Integration & Reliability

### Added
- **ErrorBoundary**: Created `ErrorBoundary.jsx` component for module-level fault isolation.
- **Health Dashboard**: Implemented `/dashboard/health` route to verify backend, storage, and auth connectivity.
- **Gold Path Test**: Created `integration_gold_path.spec.js` for cross-persona journey verification.
- **Visual Regression**: Configured Playwright for baseline screenshot comparisons.

### Changed
- **Code Splitting**: Refactored `App.jsx` to use `React.lazy` and `Suspense` for improved TTI.
- **SPA Navigation**: Removed `window.location.href` from `HamburgerMenu.jsx` for smoother persona switching.
- **DashboardLayout**: Simplified role-based routing to only redirect on exact `/dashboard` path.
- **Selector Standardization**: Unified all persona switching buttons to use `data-testid="persona-{role}"`.

---

## [2026-01-01] - Persona Management & Campaign Wizard

### Added
- **Persona Switcher**: Implemented a global button group in `DashboardLayout.jsx` for instant switching between Admin, Brand, and Retailer.
- **Brand Persona**: Integrated high-fidelity dashboard based on `4.html` with KPI trends and detailed campaign tables.
- **Campaign Wizard**: Launched a 3-step creation flow for the Brand persona:
    - Step 1: Location & Screen Picker (based on `1.html`).
    - Step 2: Schedule & Creative Upload (based on `2.html`).
    - Step 3: Loop Distribution Review (based on `3.html`).
- **Testing**: Added comprehensive Playwright test suite (`tests/personas.spec.js`) covering persona persistence and E2E wizard flow.
- **Testing Stability**: Improved E2E reliability by implementing `aria-label` targeting and explicit `localStorage` initialization in test hooks.
- **Zero-Flake Architecture**: Implemented Senior SRE testing standards:
    - Standardized on `data-test` attributes for core components.
    - Implemented **Synthetic Authentication** via `storageState` and `globalSetup.js`.
    - Created `base.fixtures.js` for authenticated multi-persona page contexts.
    - Integrated self-healing `npx kill-port` into the dev server lifecycle.
- **Infrastructure Tooling**: Optimized `playwright.config.js` with increased timeouts and port-reusage handling for Windows developer environments.

### Changed
- **Auth Architecture**: Refactored `AuthContext.jsx` to `PersonaContext` logic (persisting `active_persona` in `localStorage`).
- **Routing**: Removed login/redirect logic from `App.jsx`, standardizing on persona-aware views.

### Removed
- **Legacy Auth**: Deleted `ProtectedRoute.jsx` as it conflicted with the new login-less demo architecture.

## [2026-01-01] - Deployment Safety & Player Enhancements

### Added
- Created `lessons_learned.md` for error prevention and technical post-mortems.
- Created `changelog.md` for tracking project progress.
- Implemented `/update` workflow automation in `.agent/workflows/update.md`.
- Added workspace safety rules in `.agent/rules/this-folder.md` for Google Cloud project scoping and documentation permanence.

### Changed
- **Client Player**: Updated `Player.jsx` to force ads to rotate every 5 seconds as requested.
- **Client Player**: Added background polling to `Player.jsx` (every 60s) to pick up schedule/playlist changes dynamically.
- **Safety**: Standardized all CLI operations to explicitly require `--project softomedia-live2026`.

---
*Note: This file is a permanent project record. Do not delete or purge entries.*
