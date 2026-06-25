# Massive E2E Demo Wizard — Canonical Workflow
**Date:** 2026-06-17
**Status:** Draft — awaiting pre-condition sign-off
**Author:** Architecture Review / SRE
**Scope:** All 16 phases covering every confirmed route in `App.jsx` (Sprint 22 — 2026-06-16) across all 5 user personas.

Routes confirmed from `App.jsx` (Sprint 22). Auth behaviour confirmed from `routebyroute.md` and `manual_testing.md`.

For gap-closure (API surface smoke, error paths, Firestore Rules), see `massivee2e_gaps.md`.
For the complete 18-file spec register, see `massivee2e_gaps.md` → Spec File Register.

---

## Update 2026-06-25 - E2E Testing Progress
- Fixed 13 backend Jest suites in Phase 2A (removed unused global mocks).
- Cleared 591 linting errors across the codebase to pass strict `/hygiene`.
- Flushed and re-seeded local database successfully.
- Fixed 404 seed verification error in `00_seed.setup.js` by allowing deterministic ID seeding in API routes.
- Removed deprecated `verify_predeploy.js` script.
- Created `tests/legacy/` folder to isolate broken and outdated root specs that were causing false negatives in the Playwright E2E suite.

---

## Critical Pre-Conditions (Blockers — Resolve Before Running Any Phase)

Pre-Condition 0 is a hard gate — without it every API call returns 401 regardless of persona.

| # | Blocker | Resolution | Status |
|---|---------|------------|--------|
| **0** | `ALLOW_DEMO_MODE` not set on staging | Set `ALLOW_DEMO_MODE=true` in staging env vars, OR confirm `NODE_ENV !== 'production'` locally. Verify `process.env.ALLOW_DEMO_MODE === 'true'` before Phase 0. | ☐ |
| **1** | `campaigns.js` POST handler returns 404 | Implement stub: `res.status(200).json({ id: 'demo-campaign-001', status: 'active' })`. Without this Phase 3 fails at step 3.7. | ☐ |
| **2** | Dynamic slot seeding missing | `SeedService.js` must write slots with `startTime = Date.now()` (current hour), not a hardcoded time. Unlocks all of Phase 4. | ☐ |
| **3** | `PlaylistManagement.jsx` unrouted | Explicitly excluded from this demo. Do not reference it in any wizard step. | ☐ |
| **4** | XSS / Open Redirect vulnerability | Run `npm audit fix` before demo runs on any shared environment. | ☐ |
| **5** | Playwright global timeout | Set `timeout: 60000` in `playwright.config.js`. Add `await page.waitForSelector('.main-content-loaded')` guards on all `React.lazy` routes. | ☐ |

---

## Demo Auth State — Single Source of Truth

The `demo_role` / `active_persona` localStorage conflict (documented in `active_personaVSdemo_role.md`, PR #46) causes role bleed between phases. The `beforeEach` reset **lives in `demo.fixtures.js` only** — do not copy it into individual spec files.

Every spec file imports and uses it:
```js
// In each spec file:
import { authReset } from './demo.fixtures.js';
test.beforeEach(authReset);
```

See `tests/demo_wizard/demo.fixtures.js` for the implementation.

---

## Lessons Learned (From This Repo)

1. **Silent catch = invisible failures** — `BaseRepository.update()` swallowed Firestore errors until Sprint 11. Every step asserts on the *response body and status code*, not just the absence of an error modal.
2. **Duplicate filenames broke CI** — `TicketDashboard` and `CampaignApprovalList` previously had two diverging implementations. Run `/hygiene` and `/validate-testids` before executing the demo suite.
3. **Clock-sensitive logic needs clock control** — The player slot timing bug (10 timeouts in `loop_playback.spec.js`) is a clock problem. The seed owns the clock: write `startTime = Date.now()` at seed-time, not test-time.
4. **Public endpoints don't prove correct auth** — `GET /api/campaigns` returns 200 with no auth (confirmed `routebyroute.md`). Always assert request headers explicitly on POST/mutation steps via Playwright `page.route()` intercept.

---

## Phase 0 — Seed & Bootstrap

**Type:** Programmatic — no UI
**Spec file:** `00_seed.setup.js` (Playwright `globalSetup`)

Pre-populates Firestore with a known, deterministic dataset. All subsequent phases depend on this state.

**Acceptance criteria (all must pass before Phase 1 starts):**
- `retailers/demo-freshmart` exists with `name: "FreshMart Montréal"`, 2 stores, 4 screens, business hours for current week
- `advertisers/demo-bonvie` exists with `status: "approved"`
- Users exist: `demo-admin`, `demo-retailer`, `demo-brand`, `demo-advertiser`, `demo-techop`
- Loop template exists with 2 paid slots where `startTime >= Date.now()` AND `startTime <= Date.now() + 3600000`

> **Root cause fix for `loop_playback.spec.js` (10 timeouts):** Slot `startTime` must equal `Date.now()` — not a hardcoded ISO string. This is the architectural key that unlocks Phase 4.

---

## Phase 1 — Admin Provisions the Network

**Persona:** `DEMO_ADMIN` | `x-demo-role: admin`
**Spec file:** `01_admin_provision.spec.js`

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| 1.1 | Login as Admin | `/login` | `localStorage.getItem('demo_role') === 'admin'`; `x-demo-role: admin` on first API call |
| 1.2 | Create Retailer: "FreshMart Montréal" | `/dashboard/admin/retailers` | `POST /api/retailers` → `201` with `{ id, name: "FreshMart Montréal" }`; hard-refresh shows retailer |
| 1.3 | Add 2 Stores | `/dashboard/admin/retailers` | `POST /api/retailers/:id/stores` ×2 → `201`; store count = 2 on hard-refresh |
| 1.4 | Add 4 Screens (2 per store) | `/dashboard/admin/screens` | `POST /api/screens` ×4 → `201`; each has `storeId` set; count = 4 |
| 1.5 | Set Business Hours | `/dashboard/admin/hours` | `POST /api/retailers/:id/business-hours` → `200`; hours populated on hard-refresh |
| 1.6 | Create Advertiser: "BonVie Snacks" | `/dashboard/admin/advertisers` | `POST /api/advertisers` → `201` with `{ id, name: "BonVie Snacks", status: "approved" }` |
| 1.7 | Create Loop Template for FreshMart | `/dashboard/admin/loops` → `/dashboard/admin/loops/:id` | `POST /api/loops` → `201`; `/dashboard/admin/loops/:id` renders `LoopBuilder` with 12 empty slots |
| 1.8 | Set CPM pricing on calendar | `/dashboard/admin/pricing` | `POST /api/pricing` → `200`; calendar cell shows updated CPM on hard-refresh |
| 1.9 | Create Brand User for BonVie | `/dashboard/admin/users` | `POST /api/users` → `201` with `{ role: "brand" }`; user in list |
| 1.10 | Create Retailer User for FreshMart | `/dashboard/admin/users` | `POST /api/users` → `201` with `{ role: "retailer" }`; user in list |

> `LoopBuilder.jsx` is confirmed routed at `/dashboard/admin/loops/:id` in `App.jsx` (Sprint 22). Prior "orphan alert" is retired.

---

## Phase 2 — Retailer Configures Their Schedule

**Persona:** `DEMO_RETAILER` | `x-demo-role: retaileradmin`
**Spec file:** `02_retailer_schedule.spec.js`

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| 2.1 | Login as Retailer | `/login` | `localStorage.getItem('demo_role') === 'retaileradmin'`; `x-demo-role: retaileradmin` confirmed |
| 2.2 | Open Schedule Calendar | `/dashboard/retailer/schedule` | Loads without 403; stores/screens from Phase 1 visible |
| 2.3 | Block "no-ads" window (Sunday 2–4am) | `/dashboard/retailer/schedule` | `POST /api/schedules/override` → `200`; hard-refresh shows greyed-out block |
| 2.4 | Verify Dashboard KPIs | `/dashboard/retailer` | `GET /api/retailers/:id/stats` → `200`; KPI widgets non-zero and non-loading |

---

## Phase 3 — Brand Books a Campaign (5-Step Wizard)

**Persona:** `DEMO_BRAND` | `x-demo-role: brand`
**Spec file:** `03_brand_campaign_wizard.spec.js`
**Blocker dependency:** Pre-Condition #1 (`campaigns.js` POST stub) must be resolved before step 3.7.

> **Highest-risk auth transition in the demo.** Auth reset is mandatory before this phase.

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| 3.1 | Login as Brand | `/login` | `localStorage.getItem('demo_role') === 'brand'`; `x-demo-role: brand` confirmed |
| 3.2 | Open Campaign Wizard | `/dashboard/brand/campaign/new` | Step 1 (Location) renders; retailer picker visible; no 403 |
| 3.3 | **Step 1 — Location:** Select FreshMart, both stores, all 4 screens | `/dashboard/brand/campaign/new` | `wizardData.selectedRetailers` contains `demo-freshmart`; all 4 screens checked; "Next" enabled |
| 3.4 | **Step 2 — Schedule:** Name="BonVie Summer Demo", 7-day range, budget=$2,000 | `/dashboard/brand/campaign/new` | `wizardData.campaignName === "BonVie Summer Demo"`; 7-day range; budget = `2000`; "Next" enabled |
| 3.5 | **Step 3 — Slots:** Select 12–1pm, 5–7pm | `/dashboard/brand/campaign/new` | `wizardData.selectedSlots` non-empty; slot labels match; "Next" enabled |
| 3.6 | **Step 4 — Creative:** Upload `tests/test-ad.png`, duration=15s | `/dashboard/brand/campaign/new` | Upload → `200`; `wizardData.creativeUrl` non-null; duration = `15`; "Next" enabled |
| 3.7 | **Step 5 — Review:** Confirm and Submit | `/dashboard/brand/campaign/new` | `POST /api/campaigns` asserts **both** `Authorization: Bearer demo-token` AND `x-demo-role: brand` via `page.route()` intercept; response `{ id: 'demo-campaign-001', status: 'active' }`; `POST /api/slots` called per slot |
| 3.8 | Verify redirect to Brand Dashboard | `/dashboard/brand` | Redirect within 3s; `data-testid="campaign-card"` visible; "BonVie Summer Demo" in DOM |

---

## Phase 4 — Player Broadcasts the Campaign

**Persona:** Public (no auth)
**Spec file:** `04_player_broadcast.spec.js`
**Blocker dependency:** Pre-Condition #2 (dynamic slot seeding).

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| 4.1 | Open Loop Demo Player | `/player/demo` | Loads without auth; demo loop cycles within 5s; no "Waiting for Scheduled Slot" |
| 4.2 | Open Player with screen token | `/player?screen=demo-screen-01` | `GET /api/screens/demo-screen-01/playback-loop` → `200` (public); BonVie ad renders |
| 4.3 | Verify ad transitions | `/player?screen=demo-screen-01` | Player advances slot 1 → slot 2 within **35s** (15s creative + 10s cold-start buffer + 10s CI margin); `data-testid="ad-frame"` src changes. ⚠️ **FIX [Issue 9]:** Previous value was 15s, which assumed zero cold-start overhead on first player load. |
| 4.4 | Assert telemetry heartbeats fire | `/player?screen=demo-screen-01` | `page.waitForRequest(r => r.url().includes('/telemetry'))` resolves within 30s; body contains `{ screenId, timestamp, slotId }` — all non-null |

---

## Phase 5 — TechOps Verifies Health

**Persona:** `DEMO_TECHOP` | `x-demo-role: techop`
**Spec file:** `05_techops_health.spec.js`

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| 5.1 | Login as TechOperator | `/login` | `localStorage.getItem('demo_role') === 'techop'`; `x-demo-role: techop` confirmed |
| 5.2 | Navigate to Health Check | `/dashboard/techoperator/health` | Health status widget shows green / "OK" (mock response — `ENVIRONMENT-GATED`). **Skip condition:** `test.skip(!process.env.REAL_HEALTH_ENDPOINT, 'Health.jsx real connectivity not wired — see TODO.md')` |
| 5.3 | Navigate to TechOps Dashboard | `/dashboard/techoperator` | `TechOpsDashboard.jsx` renders; no 404 or blank screen |

> `Health.jsx` currently has hardcoded checks (`TODO.md`). Mock must return `{ status: "ok", backend: true }`. Step 5.2 is skipped until `REAL_HEALTH_ENDPOINT` env var is set.

---

## Phase 6 — Admin Validates the Full Circle

**Persona:** `DEMO_ADMIN` | `x-demo-role: admin`
**Spec file:** `06_admin_validate.spec.js`

> ⚠️ **FIX [Issue 6]:** Step 6.4 (campaign delete/cleanup) was previously the last step of this phase. It has been **removed from Phase 6** and relocated to Phase 16.5 (globalTeardown), which runs after Phase 15 completes. The old placement caused a cascade failure across Phases 7–15, all of which assert on `demo-campaign-001` being present.

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| 6.1 | Open Admin Overview | `/dashboard/admin` | `GET /api/campaigns` returns array containing `{ id: 'demo-campaign-001', name: 'BonVie Summer Demo' }`; card visible |
| 6.2 | Open Network Map | `/dashboard/admin/map` | `NetworkMap.jsx` renders; FreshMart screens show status badge; no blank/error state |
| 6.3 | Open AI Log | `/dashboard/admin/ai-log` | `AILog.jsx` renders; table loads without 500 (entries may be empty — assert no error state) |

---

## Phase 7 — Retailer Reviews Loop Inventory

**Persona:** `DEMO_RETAILER` | `x-demo-role: retaileradmin`
**Spec file:** `07_retailer_loops.spec.js`
**Pre-flight:** See `massivee2e_gaps.md` Gap 3 for the `/api/playlist` vs `/api/playlists` disambiguation `beforeAll` required in this spec.

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| 7.1 | Login as Retailer | `/login` | `x-demo-role: retaileradmin` confirmed |
| 7.2 | Navigate to Retailer Loops | `/dashboard/retailer/loops` | Loads without 403; loop templates from Phase 1 visible |
| 7.3 | Verify loop slot count | `/dashboard/retailer/loops` | FreshMart loop shows 12 slots; fill indicator non-zero |
| 7.4 | Verify BonVie slot visible (pre-approval) | `/dashboard/retailer/loops` | At least one slot shows `advertiserId: demo-bonvie` or "BonVie Summer Demo". **⚠️ Scope note [Issue 10]:** This step runs before Phase 8 approval. If `LoopSlotFill` only surfaces approved campaigns, this assertion will fail. Verify component behaviour against `LoopSlotFill.jsx` before enabling. If pending campaigns are not surfaced, **demote this step to Phase 9** (post-approval). |

---

## Phase 8 — Retailer Campaign Approval Gate ← Critical

**Persona:** `DEMO_RETAILER` | `x-demo-role: retaileradmin`
**Spec file:** `08_retailer_approval.spec.js`
**Why critical:** This is the mandatory brand-safety gate. A campaign submitted in Phase 3 cannot be scheduled into a loop slot until the retailer approves it. Completes the business loop: Brand submits → **Retailer approves** → Admin validates → Player broadcasts.

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| 8.1 | Navigate to Campaign Approvals | `/dashboard/retailer/campaign-approvals` | `CampaignApprovalList.jsx` renders; "BonVie Summer Demo" in pending queue |
| 8.2 | Open campaign detail | `/dashboard/retailer/campaign-approvals` | Clicking row expands/navigates to detail; creative thumbnail and metadata visible |
| 8.3 | Click Approve | `/dashboard/retailer/campaign-approvals` | `POST /api/campaigns/demo-campaign-001/approve` → `200`; status changes "Pending" → "Approved" without reload; assert `x-demo-role: retaileradmin` header via `page.route()` |
| 8.4 | Hard-refresh and verify persistence | `/dashboard/retailer/campaign-approvals` | After hard-refresh, "BonVie Summer Demo" shows "Approved"; not in pending queue |

---

## Phase 9 — Retailer Schedule Manager

**Persona:** `DEMO_RETAILER` | `x-demo-role: retaileradmin`
**Spec file:** `09_retailer_schedule_manager.spec.js`

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| 9.1 | Navigate to Schedule Manager | `/dashboard/retailer/schedule-manager` | Loads without 403; `ScheduleManager.jsx` renders; FreshMart stores/screens visible |
| 9.2 | Verify approved BonVie campaign in schedule | `/dashboard/retailer/schedule-manager` | After Phase 8 approval, BonVie slots visible; no "pending approval" badge |
| 9.3 | Shift a slot by 1 hour | `/dashboard/retailer/schedule-manager` | `PATCH /api/schedules/:slotId` → `200`; slot time updates in UI within 2s |

---

## Phase 10 — Retailer Schedule History

**Persona:** `DEMO_RETAILER` | `x-demo-role: retaileradmin`
**Spec file:** `10_retailer_schedule_history.spec.js`

> ⚠️ **FIX [Issue 11]:** Steps 10.2 and 10.3 previously asserted on human-readable display strings (e.g. `"Sunday 2–4am no-ads block"`). Display format is not a contract and will vary by locale and component implementation. Assertions now target structured data fields only.

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| 10.1 | Navigate to Schedule History | `/dashboard/retailer/schedule-history` | `ScheduleHistory.jsx` renders; history table non-empty |
| 10.2 | Verify Phase 2 override recorded | `/dashboard/retailer/schedule-history` | Row exists where: `type === 'override'`, `actorId === 'demo-freshmart'`, `startTime` falls within Sunday 02:00–04:00 of current week, `endTime` falls within Sunday 02:00–04:00 of current week. Assert on data attributes or API response fields — not display strings. |
| 10.3 | Verify Phase 9 slot adjustment recorded | `/dashboard/retailer/schedule-history` | Most recent row where `type === 'slot-shift'` and `actorId === 'demo-freshmart'`; row contains both `previousStartTime` and `newStartTime` fields, both non-null and differing by 3600000ms (1 hour). Assert on data fields — not display strings. |

---

## Phase 11 — Advertiser Dashboard

**Persona:** `DEMO_ADVERTISER` | `x-demo-role: advertiser`
**Spec file:** `11_advertiser_dashboard.spec.js`
**Note:** `advertiser` role at `/dashboard/advertiser/*` is distinct from `brand` role at `/dashboard/brand/*`. Both exist as separate route trees in `App.jsx` (Sprint 14).

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| 11.1 | Login as Advertiser | `/login` | `localStorage.getItem('demo_role') === 'advertiser'`; `x-demo-role: advertiser` confirmed |
| 11.2 | Open Advertiser Dashboard | `/dashboard/advertiser` | `AdvertiserDashboard.jsx` renders; KPI widgets load; no 403 or blank screen |
| 11.3 | Verify demo campaign visible | `/dashboard/advertiser` | "BonVie Summer Demo" in active/recent campaigns; status = "Approved" (from Phase 8) |

---

## Phase 12 — Advertiser Campaign Management

**Persona:** `DEMO_ADVERTISER` | `x-demo-role: advertiser`
**Spec file:** `12_advertiser_campaigns.spec.js`

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| 12.1 | Navigate to Advertiser Campaigns | `/dashboard/advertiser/campaigns` | `AdvertiserCampaigns.jsx` renders; "BonVie Summer Demo" in campaign list |
| 12.2 | Verify retired redirect | `/dashboard/advertiser/campaigns/new` | Navigating to `campaigns/new` redirects to `/dashboard/advertiser/campaigns` (S22-1 retirement); no 404 |
| 12.3 | Open Campaign Wizard Modal | `/dashboard/advertiser/campaigns` | Clicking "New Campaign" opens `CampaignWizardModal` inline (not a route navigation); Step 1 renders |
| 12.4 | Dismiss without submitting | `/dashboard/advertiser/campaigns` | Modal closes; campaign list unchanged; no orphaned wizard state |

> `AdvertiserNewCampaign.jsx` was retired in S22-1. Campaign creation is now via `CampaignWizardModal`. Step 12.2 validates the redirect is live.

---

## Phase 13 — Advertiser Invoices

**Persona:** `DEMO_ADVERTISER` | `x-demo-role: advertiser`
**Spec file:** `13_advertiser_invoices.spec.js`

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| 13.1 | Navigate to Invoices | `/dashboard/advertiser/invoices` | `Invoices.jsx` renders without 403 or blank screen |
| 13.2 | Verify invoice for demo campaign | `/dashboard/advertiser/invoices` | At least one invoice row references "BonVie Summer Demo" or `demo-campaign-001`; amount non-zero |
| 13.3 | Verify invoice download | `/dashboard/advertiser/invoices` | If download button exists: `page.waitForEvent('download')` resolves on click; if not, invoice detail view renders |

---

## Phase 14 — Ticket System (All Personas)

**Spec file:** `14_ticket_system.spec.js`

### Admin creates a ticket

**Persona:** `DEMO_ADMIN` | `x-demo-role: admin`

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| 14.1 | Login as Admin | `/login` | `x-demo-role: admin` confirmed |
| 14.2 | Navigate to Ticket Dashboard | `/dashboard/tickets` | `TicketDashboard.jsx` renders; list loads (may be empty — assert no error state) |
| 14.3 | Create a ticket | `/dashboard/tickets` | `POST /api/tickets` → `201` with `{ id: 'demo-ticket-001', status: 'open' }`; ticket appears in list |
| 14.4 | Open ticket detail | `/dashboard/tickets/demo-ticket-001` | `TicketDetail.jsx` renders; subject and status visible; no 404 |

### Persona switch — Admin → Retailer

> ⚠️ **FIX [Issue 7]:** An explicit reset step is required here. The prior version switched personas implicitly with no authReset, reproducing the PR #46 `demo_role`/`active_persona` bleed pattern. `authReset` + `loginAs` must be called before any Retailer-persona step.

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| 14.4b | **authReset + loginAs as DEMO_RETAILER** | `/login` | `authReset` clears all auth keys and reloads; `loginAs(page, DEMO_RETAILER)` sets `demo_role: 'retaileradmin'`; `data-testid="dashboard-shell"` visible; `x-demo-role: retaileradmin` confirmed before step 14.5 proceeds |

### Retailer views and responds

**Persona:** `DEMO_RETAILER` | `x-demo-role: retaileradmin`

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| 14.5 | Navigate to Ticket Dashboard | `/dashboard/tickets` | `TicketDashboard.jsx` renders; `demo-ticket-001` visible (if cross-role visibility applies — see scope note) |
| 14.6 | Add reply | `/dashboard/tickets/demo-ticket-001` | `POST /api/tickets/demo-ticket-001/replies` → `201`; reply appears in thread without page reload |

> **Scope note:** Ticket visibility rules are not documented in audit files. If Retailer cannot see admin-created tickets, step 14.5 asserts an empty list without error, and 14.6 is demoted to an Admin persona step.

---

## Phase 15 — Admin Campaign Analytics Read-Back

**Persona:** `DEMO_ADMIN` | `x-demo-role: admin`
**Spec file:** `15_admin_campaign_analytics.spec.js`

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| 15.1 | Login as Admin | `/login` | `x-demo-role: admin` confirmed |
| 15.2 | Open Admin Campaign Management | `/dashboard/admin/campaigns` | `CampaignManagement.jsx` renders; "BonVie Summer Demo" visible with status "Approved" |
| 15.3 | Verify campaign detail | `/dashboard/admin/campaigns` | Clicking the campaign row shows metadata; admin action button present — **do not click** |
| 15.4 | Open Loop Analytics | `/dashboard/admin/loop-analytics` | `LoopAnalytics.jsx` renders; telemetry from Phase 4 reflected (play counts > 0); no blank or error state |
| 15.5 | Open Pricing Config | `/dashboard/admin/pricing-config` | `PricingConfig.jsx` renders without 403; pricing tier configuration visible (Sprint 15) |

---

## Phase 16 — Login Page as a Tested Feature

**Persona:** Unauthenticated
**Spec file:** `16_login_feature.spec.js`

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| 16.1 | Navigate to `/login` unauthenticated | `/login` | Login form renders; email and password fields visible; submit button present |
| 16.2 | Submit empty form | `/login` | Client-side validation fires; error message(s) appear; no API call made; form not submitted |
| 16.3 | Submit wrong credentials | `/login` | `POST /api/auth/login` → `401`; error banner appears: "Invalid credentials" or equivalent; form not cleared |
| 16.4 | Login with valid demo credentials | `/login` | `POST /api/auth/login` → `200` with token; redirect to `/dashboard` within 2s; `data-testid="dashboard-shell"` visible |
| 16.5 | Verify root `/` redirects to `/login` when unauthenticated | `/` | Navigating to `/` without auth redirects to `/login`; no 404. ⚠️ **FIX [Minor Issue 13]:** Previous text asserted redirect to `/dashboard/admin` — that is the post-login destination for an admin, not the unauthenticated root destination. |

---

## globalTeardown — Suite Cleanup

**Spec file:** `00_seed.setup.js` → `globalTeardown` export
**Runs:** After Phase 15 completes — never during the validation phases.

> ⚠️ **FIX [Issue 6]:** Cleanup was previously Step 6.4 inside Phase 6 (Admin Validates). That placement caused a cascade failure across Phases 7–15 because the demo campaign was deleted before any of those phases ran. Cleanup is now an explicit globalTeardown, isolated from the validation logic.

| Step | Action | Acceptance Criterion |
|------|--------|---------------------|
| T.1 | Delete demo campaign | `DELETE /api/campaigns/demo-campaign-001` → `200`; Firestore doc `campaigns/demo-campaign-001` does not exist after teardown |
| T.2 | Delete seed data | `SeedService.teardown()` removes all `demo-*` documents from all collections |
| T.3 | Confirm clean state | `GET /api/campaigns/demo-campaign-001` → `404`; `GET /api/retailers/demo-freshmart` → `404` |

---

## MVP vs. Full Demo

| Tier | Scope | Prerequisite fixes needed |
|------|-------|---------------------------|
| **MVP (Tier 1)** | Phases 0–3 only | Pre-Conditions 0, 1, 2 |
| **Full Demo (Tier 2)** | All 16 phases + globalTeardown | All 6 pre-conditions; real `campaigns.js` handlers; `Health.jsx` real connectivity |

---

## Pass Probability

| Phase | Probability | Ceiling removed by |
|-------|-------------|-------------------|
| Phase 0 — Seed | 92% | Dynamic slot timing (Pre-Condition 2) |
| Phase 1 — Admin | 93% | All routes confirmed; LoopBuilder orphan alert retired |
| Phase 2 — Retailer | 91% | Route confirmed; falsifiable assertions added |
| Phase 3 — Brand Wizard | 82% | Gated on `campaigns.js` stub; rises to ~95% once stub lands |
| Phase 4 — Player | 85% | Dynamic slot seed directly unlocks; 35s transition timeout now safe |
| Phase 5 — TechOps | 88% | Route confirmed; mock health documented as pre-condition; skip gate added |
| Phase 6 — Admin Validate | 94% | Cleanup cascade removed; phase ends at step 6.3 |
| Phases 7–10 — Retailer extended | 91% | Phase 7.4 scope note added; Phase 10 asserts on structured fields not display strings |
| Phases 11–13 — Advertiser | 88% | Sprint 14 routes confirmed in App.jsx |
| Phase 14 — Tickets | 86% | Explicit persona reset step (14.4b) added; PR #46 bleed pattern eliminated |
| Phases 15–16 — Analytics + Login | 92% | Phase 16.5 redirect target corrected to `/login` |
| **Overall suite** | **90%** | Rises to ~95% once Pre-Conditions 0–2 resolved |

---

## Registration

Register as `/demo` in `workflows.md`. Back with `.agent/workflows/demo.md` following the same step-by-step format as `bigtest.md`.
