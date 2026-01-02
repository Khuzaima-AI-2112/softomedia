# TODO

## 🚫 Deployment Blockers (Must Fix Before Deploy)

### ESLint Configuration
- [x] Create `.eslintrc.cjs` in `client-app/` directory
- [x] Ensure `npm run lint` passes with zero errors

### Deployment Infrastructure
- [x] Create `cloudbuild.yaml` for GCP Cloud Build
- [x] Create `verify_predeploy.js` script
- [ ] **Verify Production Release**: Monitor first deploy logs for successful Rules and dynamic CORS injection.

### Critical Test Failures
- [x] Fix failing Playwright tests (standardized on `data-testid`)
- [ ] **Broadcasting Engine Baseline**: Stabilize the 10 failing tests identified in the full integration run (`loop_playback.spec.js` timeouts).
- [ ] **Post-Refactor E2E Stabilization**: Fix 9 regressions in `telemetry.spec.js`, `ad_player.spec.js`, `loop_builder.spec.js`, and `integration_gold_path.spec.js` following the Player state machine refactor.

### Broadcasting Engine MVP Maintenance
- [ ] **Real Analytics API**: Replace mock data in `LoopAnalytics.jsx` with actual Firestore aggregation.
- [ ] **Replacement Automation**: Implement the "2-hour auto-placeholder" logic for rejected ads.
- [ ] **Campaign Prioritization Audit**: Verify `LoopGenerationService` correctly handles edge cases where zero Paid ads exist.

---

## High Priority

### Fix Gold Path Integration Test
- [x] Debug persona switcher navigation timing (implemented `waitForURL`)
- [x] Update test selectors to `data-testid`

### Firebase Production Readiness (from Audit SDLC12 & SDLC2)
- [x] **Scalability**: Refactor `PlaylistService.js` to avoid O(n) ad fetching (use subsets/caching)
- [x] **Reliability**: Implement automated nightly Firestore exports to GCS (Cloud Scheduler)
- [x] **Security**: Implement per-endpoint `allUsers` invoker review (move sensitive routes to authenticated-only)
- [x] **Database Optimization**: Optimize `count()` queries in BaseRepository
- [x] **Glue**: Dynamicize `CORS_ORIGINS` in `cloudbuild.yaml` to avoid brittle hardcoded URLs.
- [x] **Glue**: Consolidate `ad-server` routing into `src/api/` structure.

## Medium Priority

### Testing & Observability
- [ ] Add accessibility (a11y) tests with `@axe-core/playwright`
- [ ] Expand visual regression coverage to Admin and Retailer dashboards
- [ ] **Logging**: Add `correlation-id` to Winston logger to trace requests across services.

### Infrastructure & Performance
- [ ] **IaC**: Migrate GCP provisioning to Terraform for environment reproducibility.
- [ ] Configure CSP headers in `index.html`
- [ ] Add real backend connectivity checks to `Health.jsx`

## 🎯 Remaining Test Failures (Fix Instructions)

### 🟢 Resolved in Current Session
- [x] **Wizard Step 2 Timeslots**: Restored `timeSlots` array; standardized `data-testid` to `timeslot-HH:MMAM`.
- [x] **Dashboard Navigation**: Instrumented `HamburgerMenu.jsx` with full role-based links.
- [x] **Backend Fast-Fail**: Gated Firestore to prevent event-loop hangs in local dev.

### 🔴 Leftover Issues (~19 tests)

#### 1. Hourly Slot Loop Verification
- **Error**: Ad Player might show "Waiting for Scheduled Slot" instead of ads.
- **Root Cause**: Just changed logic from "endless loops" to "1hr slots". If current server time doesn't match seeded slots, player shows fallback.
- **Instruction**:
    1. Check `SeedService.js` for current hour coverage.
    2. Verify `ad_player.spec.js` transitions between the two seeded 7PM ads.

#### 2. Missing API Handler Depth
- **Error**: 404s or empty responses in complex journey steps (e.g., Campaign Review).
- **Root Cause**: Several API files in `ad-server/src/api/` are stubs.
- **Instruction**:
    1. Reference `.archives/progress/server/src/api/` to restore missing logic in `ads.js`, `campaigns.js`, and `schedules.js`.
    2. Focus on the GET handlers required for UI population.

#### 3. Cross-Browser Timing (Firefox/WebKit)
- **Error**: Interaction timeouts.
- **Root Cause**: `React.lazy` loading speed varies by browser.
- **Instruction**:
    1. Add `await page.waitForSelector('.main-content-loaded')` or equivalent in layout tests.
    2. Increase global Playwright timeout to 60s for slow environments.

