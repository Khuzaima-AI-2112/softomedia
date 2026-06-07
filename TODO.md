# TODO

## 🚫 Deployment Blockers (Must Fix Before Deploy)

### Deployment Infrastructure
- [ ] **Verify Production Release**: Monitor first deploy logs for successful Rules and dynamic CORS injection.

### Pre-commit Hooks (one-time dev machine setup)
- [ ] **Each dev must run** (from `client-app/`):
  ```bash
  npx husky install
  ```
  After that, any commit introducing a duplicate filename across `components/` and
  `pages/` will be **blocked before it even hits CI**. The hook runs
  `scripts/check-duplicate-components.sh` automatically on every `git commit`.
  > Added in Sprint 11 after `TicketDashboard`, `TicketDetail`, and `CampaignApprovalList`
  > each existed in two places with diverging implementations, causing a build failure.
  > Don't skip this step.

## 🛡️ Security & Vulnerabilities
- [ ] **Patch High-Severity XSS**: `react-router` XSS via Open Redirect identified by `/security` scan. Run `npm audit fix` or update the dependency in the next cycle.

## Maintenance & Operations
- [ ] Implement periodic database synchronization workflow for staging.
- [ ] Set up automated backup verification using `BackupService.js`.
- [ ] Monitor Firestore quota usage for softomedia-live-2026.

### Critical Test Failures
- [ ] **Broadcasting Engine Baseline**: Stabilize the 10 failing tests in `loop_playback.spec.js` (timeouts).
- [ ] **Post-Refactor E2E Stabilization**: Fix 9 regressions in `telemetry.spec.js`, `ad_player.spec.js`, `loop_builder.spec.js`, and `integration_gold_path.spec.js` following the Player state machine refactor.

### Broadcasting Engine MVP Maintenance
- [ ] **Real Analytics API**: Replace mock data in `LoopAnalytics.jsx` with actual Firestore aggregation.
- [ ] **Replacement Automation**: Implement the "2-hour auto-placeholder" logic for rejected ads.
- [ ] **Campaign Prioritization Audit**: Verify `LoopGenerationService` correctly handles edge cases where zero Paid ads exist.

---

## High Priority

### Pricing Stability Governance (SRE Recommendations)
- [ ] **Schema Validation**: Introduce Zod or Joi schemas in `PricingRepository.js` to enforce casing at the boundary.
- [ ] **Linting Policy**: Enable ESLint rules (e.g., `no-unsafe-member-access`) specifically for API-fed state to encourage optional chaining.
- [ ] **Data Drift Integration Test**: Create a Playwright test that simulates "snake_case" API responses to verify UI resilience.

### Telemetry & Monitoring (Postponed from Rollout)
- [ ] **Silent Player Fix**: Implement `useHeartbeat` and `useImpression` in `LoopDemoPlayer.jsx` (Beware TDZ errors, see lessons learned).

## Medium Priority

### Testing & Observability
- [ ] Add accessibility (a11y) tests with `@axe-core/playwright`
- [ ] Expand visual regression coverage to Admin and Retailer dashboards

### Infrastructure & Performance
- [ ] **IaC**: Migrate GCP provisioning to Terraform for environment reproducibility.
- [ ] Configure CSP headers in `index.html`
- [ ] Add real backend connectivity checks to `Health.jsx`
- [ ] **Offline Resilience**: Implement Service Worker/CacheStorage for ads to enable playback during internet outages.

## 🎯 Remaining Test Failures (Fix Instructions)

### 🔴 Leftover Issues (~19 tests)

#### 1. Hourly Slot Loop Verification
- **Error**: Ad Player shows "Waiting for Scheduled Slot" instead of ads.
- **Root Cause**: Logic changed from "endless loops" to "1hr slots". If current server time doesn't match seeded slots, player shows fallback.
- **Fix**:
    1. Check `SeedService.js` for current hour coverage.
    2. Verify `ad_player.spec.js` transitions between the two seeded 7PM ads.

#### 2. Missing API Handler Depth
- **Error**: 404s or empty responses in complex journey steps (e.g., Campaign Review).
- **Root Cause**: Several API files in `ad-server/src/api/` are stubs.
- **Fix**:
    1. Reference `.archives/progress/server/src/api/` to restore missing logic in `ads.js`, `campaigns.js`, and `schedules.js`.
    2. Focus on the GET handlers required for UI population.

#### 3. Cross-Browser Timing (Firefox/WebKit)
- **Error**: Interaction timeouts.
- **Root Cause**: `React.lazy` loading speed varies by browser.
- **Fix**:
    1. Add `await page.waitForSelector('.main-content-loaded')` or equivalent in layout tests.
    2. Increase global Playwright timeout to 60s for slow environments.
