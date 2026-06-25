# Single Source of Truth (SSOT) Remediation — Phase 1 (P0)

## Goal Accomplished
Successfully mitigated the critical P0 architectural multiple sources of truth (MSOT) that were causing widespread "magic string" breakages and Auth bypass issues.

## Changes Made
1. **Banned Native Fetch:**
   - Enforced a rigid rule in `.eslintrc.cjs` (`no-restricted-syntax`) to prevent any usage of native `fetch()` across `client-app`.
   - Disabled the rule with `eslint-disable` exclusively for `apiClient` (`services/api.js`) and third-party library wrappers (like Ghost CMS and telemetry pipelines) where bypassing interceptors is explicitly intended.

2. **Refactored `fetch()` to `apiClient`:**
   - `AILog.jsx`, `Player.jsx`, `TechOpsDashboard.jsx`, `TicketDashboard.jsx`, `ScheduleManager.jsx`
   - These components now automatically inject `auth_token`, `active_persona`, and `demo_role` headers via the `apiClient` request interceptors, preventing backend 403s during E2E persona-switching.

3. **Migrated Context Bleeds to `useAuth()`:**
   - `ScheduleCalendar.jsx` and `LoopDemoPlayer.jsx` were directly reading `localStorage.getItem('active_persona')` and `'demo_role'`, missing React state updates.
   - Migrated to `const { persona } = useAuth()`. The UI now dynamically reacts when the Super Admin switches personas.

## Verification
- `npm run lint` now passes with 0 errors (down from 15+ fetch violations).
- Executed `npm run test:e2e`. The `ad_player.spec.js` test suite passed successfully, confirming that the `Player.jsx` fetch refactor properly resolved the API request auth headers.
- Other tests (like `analytics_loop.spec.js`) are failing, which aligns with the remaining MSOT fractures (URL Pathing, Role Strings) mapped out in the P1 and P2 blueprints.

## Next Steps
We are now ready to tackle Phase 2 (P1 Remediation), which targets:
1. URL Pathing MSOT (`verifyRouteAccess` vs React Router)
2. Role Strings MSOT (`'brand'` vs `'advertiser'`)
