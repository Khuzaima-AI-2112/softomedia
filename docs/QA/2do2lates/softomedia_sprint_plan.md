# SoftoMedia Sprint Plan — May 2026

> **Codebase reviewed:** `cfroszte/softomedia-live2026` @ commit `92325b7`
> **Scope:** Full-stack review — `client-app` (React/Vite), `ad-server` (Node/Express/Firestore), CI/CD (Cloud Build), Playwright E2E tests
> **Sprint cadence:** 1-week sprints. Each sprint has a clear goal, scope boundary, and definition of done.

---

## System Architecture Snapshot

The platform is a **multi-tenant DOOH (Digital Out-of-Home) ad network** with four user personas (Admin, Brand, Retailer, Tech Ops) and three deployed services:

| Service | Tech | Deployment |
|---|---|---|
| `ad-server` | Node.js + Express + Firestore | Cloud Run (`ad-server-*`) |
| `client-app` | React 18 + Vite + React Router 6 | Cloud Run (`client-app-*`) |
| Player | Vanilla JS + Firebase Realtime DB | Cloud Run (`player-*`) |

The broadcasting engine generates hourly "loops" — ordered playlists of paid ads, house ads, and retailer content — served to screens in real time.

---

## Current State Assessment

### ✅ Stable / Production-Quality
- Auth flow (JWT login, invite-accept, role-based guards)
- Campaign creation wizard (`BrandCampaignWizard.jsx`) — 5-step flow with file upload
- Screen management CRUD (`ScreenManagement.jsx` + `screens.js` backend — 11 KB)
- Campaign backend (`campaigns.js` — 16 KB) — full CRUD + review + report
- Loop generation service and `LoopBuilder.jsx` / `LoopManagement.jsx`
- Playlist CRUD backend (`playlist.js`, `playlists.js`)
- Firestore rules, GCS backup scheduler, Cloud Build pipeline (`cloudbuild.yaml`)
- Notification system (subscribe/unsubscribe/preferences/history)
- Telemetry endpoint (`POST /api/telemetry/error`)

### 🟡 Partial / Incomplete
- `ads.js` backend — **1 KB stub** (critical: ad CRUD is the core revenue unit)
- `retailers.js` backend — **2.2 KB** (create + list only; missing update/delete + store sub-routes incomplete)
- `stores.js` backend — **5.4 KB** (present but not mounted in `api/index.js`)
- `locations.js` — **911 byte stub**
- `LoopAnalytics.jsx` — mock data, no real Firestore aggregation
- `Health.jsx` — static page, no real backend connectivity checks
- `ApiService.js` — `updateStore` / `deleteStore` missing
- `AuthContext.jsx` — role sync with `auth_role` key unverified

### 🔴 Broken / Missing
- `TicketDashboard.jsx` + `TicketDetail.jsx` — listed in AGENTS.md route table but pages do not exist
- `ads.js` API — stub with no real implementation (blocks Ad Review, Ad Approval, Ad Serving verification)
- Replacement automation ("2-hour auto-placeholder" for rejected ads)
- Real Analytics API in `LoopAnalytics.jsx`
- Service Worker / offline resilience for Player
- ~19 failing Playwright tests (loop playback timeouts, telemetry regressions, cross-browser timing)
- XSS vulnerability in `react-router` dependency (high severity, unfixed)

---

## Sprint Overview

| Sprint | Theme | Goal |
|---|---|---|
| **S1** | **Foundation Hardening** | Fix all broken data paths: `ads.js` stub, `stores.js` mounting, `ApiService` gaps, `AuthContext` role sync |
| **S2** | **Admin CRUD Completion** | Full CRUD for Retailers + Stores + Business Hours via UI; wire `AdvertiserManagement` end-to-end |
| **S3** | **Broadcasting Engine** | Real analytics API in `LoopAnalytics`, replacement automation (2-hr placeholder), loop playback test stabilization |
| **S4** | **Ticket & Support System** | Build `TicketDashboard` + `TicketDetail` pages + backend; TechOpsDashboard health checks wired |
| **S5** | **Security & Stability** | Patch XSS (react-router upgrade), Zod schema validation on pricing, CSP headers, E2E regression fixes |
| **S6** | **Observability & Polish** | Real `Health.jsx` backend checks, Service Worker offline resilience, a11y audit, IaC foundations |

---

## Sprint 1 — Foundation Hardening
**Duration:** Week 1 | **Goal:** Every existing page can make API calls without runtime errors

### Context
The `ads.js` backend is a 1 KB stub — it has route signatures but no Firestore reads or writes. The `stores.js` router (5.4 KB) exists but is not mounted in `api/index.js`. `ApiService.js` is missing `updateStore` and `deleteStore`. `AuthContext.jsx` may still read `softomedia_role` instead of `auth_role`. These are table-stakes issues that block every other sprint.

### Tasks

#### BE-1.1 — Implement `ads.js` API (Critical)
**File:** `ad-server/src/api/ads.js`

The current stub has route skeletons with no logic. Implement:
- `GET /api/ads` — list ads by `campaign_id` or `status` query param, paginated
- `GET /api/ads/:id` — get single ad with asset metadata
- `PUT /api/ads/:id/review` — admin approve/reject with `status` + `rejection_reason`
- `DELETE /api/ads/:id` — soft-delete (set `status: 'deleted'`)

Reference `campaigns.js` (16 KB) for Firestore query patterns and auth middleware usage.

#### BE-1.2 — Mount `stores.js` router
**File:** `ad-server/src/api/index.js`

`stores.js` implements full store CRUD but is never mounted. Add:
```js
const storesRouter = require('./stores');
router.use('/stores', storesRouter);
```
Also verify `retailers.js` mounts `/retailers/:retailerId/stores` as a sub-route to match `RetailerManagement.jsx` expectations.

#### FE-1.3 — Add `updateStore` / `deleteStore` to `ApiService.js`
**File:** `client-app/src/services/ApiService.js`

```js
updateStore: (storeId, data) => apiClient.put(`/api/stores/${storeId}`, data),
deleteStore: (storeId) => apiClient.delete(`/api/stores/${storeId}`),
```

#### FE-1.4 — Verify `AuthContext.jsx` uses `auth_role`
**File:** `client-app/src/contexts/AuthContext.jsx`

Audit every `localStorage.getItem(...)` call in `AuthContext`. Replace any `softomedia_role`, `user_role`, or other legacy key names with `auth_role` to match the updated `api.js`. Ensure `logout()` in context calls `removeAuthToken()` from `api.js` rather than calling `localStorage.removeItem` directly.

#### FE-1.5 — Fix syntax error in `api.js` `notificationsAPI`
**File:** `client-app/src/services/api.js`

The `getHistory` function has a double `async` keyword (`async (async (limit...)`). Fix to:
```js
getHistory: async (limit = 50) => { ... }
```

### Definition of Done
- [ ] `GET /api/ads` returns a valid JSON array (tested via `curl` or Postman)
- [ ] `stores.js` routes respond to `GET /api/stores`
- [ ] `RetailerManagement.jsx` can create, edit, and delete a store without console errors
- [ ] Login persists role; refreshing the page maintains sidebar state
- [ ] `npm run lint` passes in `client-app/`

---

## Sprint 2 — Admin CRUD Completion
**Duration:** Week 2 | **Goal:** Admin can onboard a Retailer → Store → Advertiser without leaving the dashboard

### Context
`RetailerManagement.jsx` (35 KB), `AdvertiserManagement.jsx` (22 KB), and `BusinessHoursManagement.jsx` (35 KB) are fully built UI components that were previously unreachable due to missing routes. Sprint 1 unblocks them at the routing layer. This sprint ensures the **full data round-trip** works for each management page.

### Tasks

#### BE-2.1 — Complete `retailers.js` CRUD
**File:** `ad-server/src/api/retailers.js`

Current state: create + list only (2.2 KB). Add:
- `PUT /api/retailers/:id` — update retailer name, contact, status
- `DELETE /api/retailers/:id` — soft-delete with cascade check (block if active stores exist)
- `GET /api/retailers/:id/stores` — list stores under a retailer (needed by `RetailerManagement`)

#### BE-2.2 — Complete `advertisers.js` CRUD
**File:** `ad-server/src/api/advertisers.js`

Current state: 2.3 KB (create + list). Add:
- `GET /api/advertisers/:id` — get single advertiser with linked campaigns count
- `PUT /api/advertisers/:id` — update advertiser profile
- `DELETE /api/advertisers/:id` — soft-delete with active campaign guard

#### BE-2.3 — Wire Business Hours to screens
**File:** `ad-server/src/api/` (new `business_hours.js` or extend `stores.js`)

`BusinessHoursManagement.jsx` (35 KB) manages store operating hours that gate loop playback. Audit what API endpoints it expects, then implement:
- `GET /api/stores/:storeId/hours`
- `PUT /api/stores/:storeId/hours` — upsert full weekly schedule

#### FE-2.4 — Add empty states to all three management pages
All three management pages currently show a blank area when the list is empty. Add proper empty states (icon + message + CTA button) following the pattern in `ScreenManagement.jsx`.

#### FE-2.5 — Confirm `data-testid` attributes on all CRUD buttons
Playwright E2E tests use `data-testid` selectors. Audit `RetailerManagement.jsx`, `AdvertiserManagement.jsx`, and `BusinessHoursManagement.jsx` for missing `data-testid="add-retailer-btn"`, `data-testid="edit-retailer-{id}"`, etc.

### Definition of Done
- [ ] Admin can create, edit, and delete a Retailer and see changes immediately
- [ ] Admin can create, edit, and delete an Advertiser
- [ ] Business hours saved for a store persist on page refresh
- [ ] All three pages show a styled empty state when no records exist
- [ ] Playwright `admin_crud.spec.js` (new) passes for retailer + advertiser happy paths

---

## Sprint 3 — Broadcasting Engine
**Duration:** Week 3 | **Goal:** Loop analytics show real data; rejected ads auto-fill with placeholder

### Context
`LoopAnalytics.jsx` (13 KB) renders charts from hardcoded mock data — no Firestore calls. The TODO notes "replacement automation" as a separate item: when an ad is rejected after the loop is generated, a 2-hour window must automatically insert a placeholder ad to avoid dead air. These are the two core revenue-protection features of the broadcasting engine.

### Tasks

#### BE-3.1 — Loop analytics aggregation endpoint
**File:** `ad-server/src/api/loops.js` (extend existing 6.9 KB file)

Add `GET /api/loops/analytics` that returns:
```json
{
  "impressions_by_day": [...],
  "top_screens": [...],
  "fill_rate": 0.94,
  "paid_vs_house_ratio": 0.72
}
```
Aggregate from the `loop_events` Firestore collection. Use `count()` aggregation (already optimized in `BaseRepository`) to avoid full collection scans.

#### BE-3.2 — Replacement automation service
**File:** `ad-server/src/services/` (new `ReplacementService.js`)

When `PUT /api/ads/:id/review` sets `status: 'rejected'`, check if the ad is part of an active loop scheduled within the next 2 hours. If so:
1. Find the loop slot containing the ad
2. Replace it with the retailer's designated placeholder ad (or house ad fallback)
3. Push an update to Firebase Realtime DB so the player refreshes its queue

This integrates with the existing `LoopGenerationService` — reference its slot-filling logic for the replacement algorithm.

#### FE-3.3 — Wire `LoopAnalytics.jsx` to real API
**File:** `client-app/src/pages/admin/LoopAnalytics.jsx`

Replace `const mockData = [...]` with a `useEffect` that calls `ApiService.getLoopAnalytics()`. Add loading skeleton and error state. The existing chart rendering code should be reusable once data shape matches.

#### TEST-3.4 — Fix `loop_playback.spec.js` timeouts
**File:** `tests/loop_playback.spec.js`

The 10 failing tests are due to timing: the test seeds a loop for a specific hour, but test execution may happen at a different clock offset. Fix by:
1. Mocking the server clock in the test setup using `SeedService.js` to seed for "current hour + 5 minutes"
2. Adding `await page.waitForSelector('[data-testid="loop-playing"]', { timeout: 60000 })`

### Definition of Done
- [ ] `LoopAnalytics.jsx` shows real impressions data (not mock)
- [ ] Rejecting an ad that is in an active loop triggers a placeholder replacement visible in player within 10 seconds
- [ ] `loop_playback.spec.js` passes on Chromium (10/10 tests)
- [ ] Fill rate KPI on Overview dashboard matches `GET /api/loops/analytics`

---

## Sprint 4 — Ticket & Support System
**Duration:** Week 4 | **Goal:** Tech Ops persona is fully functional end-to-end

### Context
`TechOpsDashboard.jsx` (7.8 KB) exists but links to `TicketDashboard` and `TicketDetail` pages that don't exist on disk. The AGENTS.md canonical route table specifies `/dashboard/tech/tickets` and `/dashboard/tech/tickets/:id`. This sprint builds those pages and wires `Health.jsx` to real backend checks.

### Tasks

#### FE-4.1 — Build `TicketDashboard.jsx`
**File:** `client-app/src/pages/tech/TicketDashboard.jsx` (new)

A paginated list of support tickets with columns: ID, Screen ID, Status (open/in-progress/resolved), Priority, Created At. Filters by status and priority. Clicking a row navigates to `/dashboard/tech/tickets/:id`.

#### FE-4.2 — Build `TicketDetail.jsx`
**File:** `client-app/src/pages/tech/TicketDetail.jsx` (new)

Detail view showing: ticket metadata, screen diagnostics link, timeline of status changes, resolution notes textarea + "Mark Resolved" button. Reads from `GET /api/tickets/:id`.

#### BE-4.3 — Implement tickets API
**File:** `ad-server/src/api/tickets.js` (new)

- `GET /api/tickets` — list with status/priority filter + pagination
- `GET /api/tickets/:id` — single ticket with timeline
- `POST /api/tickets` — create from screen alert or manual creation
- `PUT /api/tickets/:id` — update status + resolution notes

Mount in `api/index.js`. Firestore collection: `support_tickets`.

#### FE-4.4 — Wire `Health.jsx` to real backend
**File:** `client-app/src/pages/Health.jsx`

Replace static "All systems operational" text with calls to:
- `GET /api/health` — existing endpoint in `health.js`
- Display Firestore, Cloud Storage, and ad-server latency with colored status pills (green/yellow/red)
- Auto-refresh every 30 seconds

#### App-4.5 — Register ticket routes in `App.jsx`
Add to the `tech` section:
```jsx
<Route path="tech/tickets" element={<TicketDashboard />} />
<Route path="tech/tickets/:id" element={<TicketDetail />} />
```
Also add nav links in the Tech sidebar section of `DashboardLayout.jsx`.

### Definition of Done
- [ ] Tech Ops user can view ticket list and open a ticket detail
- [ ] Resolving a ticket persists to Firestore
- [ ] `Health.jsx` shows real latency data with auto-refresh
- [ ] Routes registered and sidebar links present for Tech persona
- [ ] TechOpsDashboard links to TicketDashboard without 404

---

## Sprint 5 — Security & Stability
**Duration:** Week 5 | **Goal:** Zero high-severity vulnerabilities; E2E regression suite green

### Context
The TODO flags a high-severity XSS vulnerability in `react-router` (open redirect). The pricing system has a known data drift risk (snake_case vs camelCase from Firestore). ~9 E2E tests regressed after the Player state machine refactor. All three must be addressed before a production release can be considered safe.

### Tasks

#### SEC-5.1 — Patch `react-router` XSS vulnerability
**File:** `client-app/package.json`

Run `npm audit fix` in `client-app/`. If that introduces breaking changes, pin to the specific safe version identified in the audit report. Test all navigation flows post-upgrade (login redirect, role-based guards, 404 redirect).

#### SEC-5.2 — Zod validation on pricing endpoints
**File:** `ad-server/src/api/pricing.js` + new `ad-server/src/schemas/pricing.schema.js`

Add Zod (already a project dependency) schemas for `PUT /api/pricing/cpm`:
```js
const CpmUpdateSchema = z.object({
  day_of_week: z.enum(['monday','tuesday',...]),
  hour: z.number().int().min(0).max(23),
  cpm_rate: z.number().positive(),
});
```
Validate on ingress. Return `400` with field-level errors on failure. This prevents the snake_case/camelCase data drift identified in the SRE report.

#### SEC-5.3 — CSP headers
**File:** `client-app/index.html` + `ad-server` Express middleware

Add `Content-Security-Policy` meta tag to `index.html`:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com; img-src 'self' data: https://storage.googleapis.com;">
```
Add `helmet` middleware to `ad-server` if not already present.

#### TEST-5.4 — Fix telemetry + ad_player + integration regressions
**Files:** `tests/telemetry.spec.js`, `tests/ad_player.spec.js`, `tests/integration_gold_path.spec.js`

The 9 regressions share a root cause: React.lazy loading timing varies by browser. Fix:
1. Add `await page.waitForSelector('[data-testid="main-content-loaded"]')` to `DashboardLayout` (emit the attribute once `<Outlet>` renders)
2. Increase Playwright global timeout to `60000` in `playwright.config.js`
3. For `ad_player.spec.js`: seed the current hour's slots in `beforeEach`, not `beforeAll`

#### TEST-5.5 — Data drift integration test
**File:** `tests/pricing_drift.spec.js` (new)

Per TODO: create a Playwright test that POSTs a pricing update with snake_case keys and verifies the UI displays the correct camelCase values — confirming the Zod boundary catches drift.

### Definition of Done
- [ ] `npm audit` shows zero high or critical vulnerabilities in `client-app`
- [ ] Posting a malformed CPM update returns `400` with field-level errors
- [ ] CSP headers present on all HTML responses (verified in browser DevTools)
- [ ] All 9 regressed E2E tests pass on Chromium, Firefox, and WebKit
- [ ] New `pricing_drift.spec.js` passes

---

## Sprint 6 — Observability & Polish
**Duration:** Week 6 | **Goal:** Production-ready observability; offline player resilience; accessibility baseline

### Context
This sprint completes the maintenance items from the TODO backlog that aren't blockers but are necessary for a sustainable production system: Service Worker for offline ad playback, accessibility testing, Terraform IaC foundations, and backup verification automation.

### Tasks

#### OPS-6.1 — Service Worker for offline player resilience
**File:** `client-app/public/service-worker.js` (new) + register in `Player.jsx`

Cache the current loop's ad assets (images/videos) in `CacheStorage` on load. On network failure, serve from cache. Key decisions:
- Cache strategy: stale-while-revalidate for ad assets, network-first for loop manifest
- Eviction: clear previous loop's cache on new loop load
- Reference AGENTS.md offline resilience spec for cache key naming conventions

#### OPS-6.2 — Automated backup verification
**File:** `ad-server/src/services/BackupService.js` (already exists — wire it)

Per TODO: the `BackupService.js` exists but is not called on a schedule. Add a Cloud Scheduler job (or extend the existing nightly export job) to:
1. Verify the latest GCS export exists and is < 25 hours old
2. POST result to `POST /api/monitoring/backup-status`
3. Trigger a Slack/email alert if backup is stale

#### TEST-6.3 — Accessibility audit with axe-core
**File:** `tests/a11y.spec.js` (new)

Add `@axe-core/playwright` (per TODO). Run axe against:
- `/login`
- `/dashboard/admin`
- `/dashboard/admin/retailers`
- `/dashboard/brand`
- `/dashboard/retailer`

Assert zero critical or serious axe violations. Fix any found (common issues: missing `aria-label` on icon buttons, form inputs without labels, insufficient color contrast on the muted text tokens).

#### OPS-6.4 — Heartbeat + impression hooks in `LoopDemoPlayer`
**File:** `client-app/src/pages/LoopDemoPlayer.jsx`

Per TODO: implement `useHeartbeat` and `useImpression` hooks (already defined elsewhere in the codebase). Beware TDZ errors on initialization — initialize refs before `useEffect` callbacks per lessons_learned.md.

#### OPS-6.5 — IaC foundations (Terraform)
**File:** `terraform/` (new directory)

Create minimal Terraform configuration for:
- Cloud Run service definitions (ad-server, client-app)
- Cloud Scheduler jobs
- Firestore database (import existing)
- GCS bucket for backups

This does not replace the existing `cloudbuild.yaml` — it runs alongside it for environment reproducibility.

### Definition of Done
- [ ] Player serves cached ads during a simulated network offline event
- [ ] Backup verification runs nightly; stale backup triggers alert
- [ ] `a11y.spec.js` passes with zero critical axe violations on all 5 routes
- [ ] `LoopDemoPlayer` emits heartbeat events visible in Firestore `telemetry` collection
- [ ] Terraform `plan` runs cleanly against the staging GCP project

---

## Dependency Map

```
S1 (Foundation)
 └─▶ S2 (Admin CRUD)  ──────────────────────┐
 └─▶ S3 (Broadcasting Engine)               │
      └─▶ S5 (Security/Stability) ◀─────────┘
           └─▶ S6 (Observability)
S4 (Tickets) — parallel to S2/S3, no blockers
```

S1 is the only hard prerequisite. S2, S3, and S4 can run in parallel once S1 is complete. S5 must follow S2 and S3 (the regression tests need the CRUD flows working). S6 follows S5.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `ads.js` Firestore schema differs from what `RetailerManagement` expects | Medium | High | Read `.archives/progress/server/src/api/ads.js` before implementing BE-1.1 |
| react-router upgrade breaks role-based redirects | Medium | High | Pin upgrade behind a feature branch; full E2E run before merge |
| Replacement automation race condition (two rejections at same time) | Low | High | Use Firestore transactions in `ReplacementService.js` |
| Terraform state conflicts with manual Cloud Console changes | Medium | Medium | Import existing resources; use `terraform plan` review gate in CI |
| axe-core finds contrast failures on `--color-text-muted` | High | Low | Darken muted token in dark mode from `#797876` to `#8a8986` |

---

## Files to Create (Not Yet on Disk)

| File | Sprint | Type |
|---|---|---|
| `client-app/src/pages/tech/TicketDashboard.jsx` | S4 | New page |
| `client-app/src/pages/tech/TicketDetail.jsx` | S4 | New page |
| `ad-server/src/api/tickets.js` | S4 | New API route |
| `ad-server/src/schemas/pricing.schema.js` | S5 | Zod schema |
| `tests/a11y.spec.js` | S6 | New E2E test |
| `tests/pricing_drift.spec.js` | S5 | New E2E test |
| `client-app/public/service-worker.js` | S6 | Service Worker |
| `terraform/main.tf` | S6 | IaC |

---

## Files to Modify (Key Changes Only)

| File | Sprint | Change |
|---|---|---|
| `ad-server/src/api/ads.js` | S1 | Implement stub → full Firestore CRUD |
| `ad-server/src/api/index.js` | S1 | Mount `stores.js` router |
| `client-app/src/services/ApiService.js` | S1 | Add `updateStore`, `deleteStore` |
| `client-app/src/contexts/AuthContext.jsx` | S1 | Sync to `auth_role` key |
| `client-app/src/services/api.js` | S1 | Fix `notificationsAPI.getHistory` syntax error |
| `ad-server/src/api/retailers.js` | S2 | Add PUT + DELETE + sub-route |
| `ad-server/src/api/advertisers.js` | S2 | Add GET/:id + PUT + DELETE |
| `ad-server/src/api/loops.js` | S3 | Add analytics aggregation endpoint |
| `client-app/src/pages/admin/LoopAnalytics.jsx` | S3 | Replace mock data with real API |
| `client-app/index.html` | S5 | CSP meta tag |
| `client-app/package.json` | S5 | Upgrade react-router |
| `playwright.config.js` | S5 | Timeout → 60s |
| `client-app/src/pages/Health.jsx` | S4 | Wire to real `/api/health` |
| `client-app/src/App.jsx` | S4 | Add ticket routes |
| `client-app/src/layouts/DashboardLayout.jsx` | S4 | Add ticket nav links |

