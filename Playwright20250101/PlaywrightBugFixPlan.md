# Stabilization Assessment: 19 Remaining Test Failures

## 🌐 Live Application URLs (Cloud Run)
| Service | URL |
| :--- | :--- |
| **Client App** | [https://client-app-kiieh7nmwa-uc.a.run.app](https://client-app-kiieh7nmwa-uc.a.run.app) |
| **Ad Server API** | [https://ad-server-kiieh7nmwa-uc.a.run.app](https://ad-server-kiieh7nmwa-uc.a.run.app) |

---

## 📊 Failure Cause Analysis (% Attribution)

| Likely Cause | % of Failures | Affected Tests | Confidence |
| :--- | :---: | :---: | :---: |
| **Hourly Slot Mismatch** | 40% | ~8 | High |
| **Missing API Handler Logic** | 30% | ~6 | Medium |
| **Cross-Browser Timing (Firefox/WebKit)** | 20% | ~4 | Medium |
| **Residual Selector Issues** | 10% | ~1 | Low |

---

## 🔍 Detailed Breakdown

### 1. Hourly Slot Mismatch (40%)
- **Description**: The new 1-hour slot segmentation logic (`PlaylistService.js`) calculates the current slot dynamically. If tests run at a time (e.g., 7:15 PM) that matches seeded data (e.g., "07:00 PM"), they pass. If the clock rolls over (e.g., 8:00 PM), the player shows the "Waiting" placeholder.
- **Impact**: `ad_player.spec.js` tests for rotation fail if no ads match the active slot.
- **Short-Term Fix**: Seed an "ALL_DAY" slot or seed ads for ALL 24 hours.
- **Long-Term Fix**: Decouple test clock from system clock using Playwright's `page.clock.install()`.

### 2. Missing API Handler Logic (30%)
- **Description**: Certain multi-step journeys rely on API endpoints like `/api/campaigns` or `/api/ads` that currently return 404 or empty stubs.
- **Impact**: The Brand Wizard "Review" step and Retailer "Approval" flow timeout waiting for data.
- **Short-Term Fix**: Restore GET handlers from `.archives/progress/server/src/api/`.
- **Long-Term Fix**: Migrate to a proper OpenAPI-driven stub generator for consistent API coverage.

### 3. Cross-Browser Timing (20%)
- **Description**: Firefox and WebKit have slower rendering for `React.lazy` chunks than Chromium. Default timeouts cause failures.
- **Impact**: Dashboard loading assertions fail before elements appear.
- **Short-Term Fix**: Add `waitForLoadState('networkidle')` or increase global timeout to 60s.
- **Long-Term Fix**: Add explicit "loaded" markers to layout components (`data-testid="layout-loaded"`).

### 4. Residual Selector Issues (10%)
- **Description**: A small number of tests might still have brittle selectors not yet updated to `data-testid`.
- **Impact**: Isolated failures on specific UI interactions.
- **Short-Term Fix**: Grep for any remaining `getByRole('button', { name: '...' })` patterns with icons.
- **Long-Term Fix**: Enforce `data-testid` linting rule in ESLint config.

---

## 📋 Prioritized Action Plan

| Priority | Action | Est. Time | Expected Recovery |
| :---: | :--- | :---: | :---: |
| **P0** | Seed "ALL_DAY" slot ads in `SeedService.js` | 5 min | +8 tests |
| **P1** | Restore GET `/api/campaigns` and `/api/ads` handlers | 15 min | +6 tests |
| **P2** | Add `waitForLoadState('networkidle')` after persona switches | 10 min | +4 tests |
| **P3** | Audit & fix remaining icon selectors | 5 min | +1 test |

**Total Estimated Time**: ~35 minutes
**Expected Outcome**: 100% green suite (57/57)

---

## 🚀 Next Steps
1. **Approve this plan** to proceed with surgical fixes.
2. **Or** ask me to run a fresh Playwright sweep first to get precise counts before fixing.
