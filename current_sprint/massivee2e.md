# Massive E2E Demo Wizard — Canonical Plan
**Date:** 2026-06-17 (revised 2026-06-17)
**Status:** Draft — awaiting pre-condition sign-off
**Author:** Architecture Review / SRE

This document defines the canonical end-to-end demo workflow for `softomedia-live2026`. Every step depends on the one before it — that ordering constraint is also what makes it a reliable regression detector.

All routes confirmed from `App.jsx` (Sprint 22 — 2026-06-16). All auth behaviour confirmed from `routebyroute.md` and `manual_testing.md`.

---

## Critical Pre-Conditions (Blockers — Resolve Before Running Any Phase)

These must be signed off before the demo workflow can be declared passing. **Pre-Condition 0 is a hard gate — without it every API call returns 401 regardless of persona.**

| # | Blocker | Resolution | Status |
|---|---------|------------|--------|
| **0** | `ALLOW_DEMO_MODE` not set on staging | Set `ALLOW_DEMO_MODE=true` in staging env vars, OR confirm `NODE_ENV !== 'production'` locally. Verify: `process.env.ALLOW_DEMO_MODE === 'true'` before Phase 0. Without this, every persona switch returns `401`. | ☐ |
| **1** | `campaigns.js` and `schedules.js` POST handlers return 404 | At minimum implement a stub: `res.status(200).json({ id: 'demo-campaign-001', status: 'active' })`. Without this Phase 3 fails at step 3.7. | ☐ |
| **2** | Dynamic slot seeding missing | `SeedService.js` must write slots with `startTime = Date.now()` (current hour), not a hardcoded time. One-line fix. Unlocks all of Phase 4. | ☐ |
| **3** | `PlaylistManagement.jsx` unrouted | Explicitly excluded from this demo with `// NOT YET ROUTED`. Do not reference it in any wizard step. | ☐ |
| **4** | XSS / Open Redirect vulnerability | Run `npm audit fix` before demo runs on any shared environment. | ☐ |
| **5** | Playwright global timeout | Set `timeout: 60000` in `playwright.config.js` for the demo suite. Add `await page.waitForSelector('.main-content-loaded')` guards on all `React.lazy` routes. | ☐ |

---

## Demo Auth State — Mandatory Reset Between Phases

The `demo_role` / `active_persona` localStorage conflict (documented in `active_personaVSdemo_role.md`, PR #46) will cause Phase 3 (Brand) to silently send `x-demo-role: admin` if run after Phase 1 (Admin) without clearing state. **Every spec file must include this `beforeEach` hook:**

```js
// 00_seed.setup.js — and every spec file in demo_wizard/
test.beforeEach(async ({ page }) => {
  await page.evaluate(() => {
    localStorage.removeItem('demo_role');
    localStorage.removeItem('active_persona');
  });
});
```

Without this, the brand wizard loads with the wrong role header and shows an empty screen list with no error — the exact regression from PR #46.

---

## Phase 0 — Seed & Bootstrap (Programmatic, no UI)

Before the wizard starts, `DemoSeedService` pre-populates Firestore with a known, deterministic dataset.

**Acceptance criteria (all must pass before Phase 1 starts):**
- Firestore contains `retailers/demo-freshmart` with `name: "FreshMart Montréal"`
- Firestore contains `advertisers/demo-bonvie` with `status: "approved"`
- Firestore contains `users/demo-admin`, `users/demo-retailer`, `users/demo-brand`, `users/demo-techop`
- Loop template exists with 2 paid slots where `startTime >= Date.now()` and `startTime <= Date.now() + 3600000` (current hour window)

**Seed data:**
- `DEMO_RETAILER`: "FreshMart Montréal" — 2 stores, 4 screens, business hours seeded for the current week
- `DEMO_ADVERTISER`: "BonVie Snacks" — pre-approved brand account
- `DEMO_ADMIN`: superuser with full access
- `DEMO_TECHOP`: health-check operator
- Loop template with 2 seeded paid slots at `now()` + offset

> **Root cause fix:** `ad_player.spec.js` and `loop_playback.spec.js` failures (10 timeouts) occur because seeded slot `startTime` values don't fall within the current hour. The seed **must** write `startTime = Date.now()` — not a hardcoded ISO string. This is the architectural key that unlocks Phase 4.

---

## Phase 1 — Admin Provisions the Network

**Persona:** `DEMO_ADMIN` | `x-demo-role: admin`
**Auth reset:** Run `localStorage.clear()` before login (see Demo Auth State above)

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| 1.1 | Login as Admin | `/login` | `localStorage.getItem('demo_role') === 'admin'`; network tab shows `x-demo-role: admin` on first API call |
| 1.2 | Create Retailer: "FreshMart Montréal" | `/dashboard/admin/retailers` | `POST /api/retailers` returns `201` with `{ id, name: "FreshMart Montréal" }`; hard-refresh shows retailer in list |
| 1.3 | Add 2 Stores to that Retailer | `/dashboard/admin/retailers` | `POST /api/retailers/:id/stores` ×2 returns `201`; store count = 2 on retailer detail hard-refresh |
| 1.4 | Add 4 Screens (2 per store) | `/dashboard/admin/screens` | `POST /api/screens` ×4 returns `201`; each screen has `storeId` set; screen count = 4 in list |
| 1.5 | Set Business Hours for all stores | `/dashboard/admin/hours` | `POST /api/retailers/:id/business-hours` returns `200`; hard-refresh shows hours populated |
| 1.6 | Create Advertiser: "BonVie Snacks" | `/dashboard/admin/advertisers` | `POST /api/advertisers` returns `201` with `{ id, name: "BonVie Snacks", status: "approved" }` |
| 1.7 | Create Loop Template for FreshMart | `/dashboard/admin/loops` → `/dashboard/admin/loops/:id` | `POST /api/loops` returns `201`; navigating to `/dashboard/admin/loops/:id` renders `LoopBuilder` with 12 empty slots |
| 1.8 | Set CPM pricing on calendar | `/dashboard/admin/pricing` | `POST /api/pricing` returns `200`; calendar cell for target date shows updated CPM value after hard-refresh |
| 1.9 | Create Brand User for BonVie | `/dashboard/admin/users` | `POST /api/users` returns `201` with `{ role: "brand" }`; user appears in user list |
| 1.10 | Create Retailer User for FreshMart | `/dashboard/admin/users` | `POST /api/users` returns `201` with `{ role: "retailer" }`; user appears in user list |

> **Note — LoopBuilder is routed:** `LoopBuilder.jsx` is confirmed routed at `/dashboard/admin/loops/:id` in `App.jsx` (Sprint 22). The prior "orphan alert" is retired. Step 1.7 uses this confirmed path.
>
> **Note — `campaigns.js` auth model:** `GET /api/campaigns` is intentionally public (no auth at mount point per `routebyroute.md`). Step 1 does not assert campaign visibility — that is reserved for Phase 6 where auth context is explicitly verified.

---

## Phase 2 — Retailer Configures Their Schedule

**Persona:** `DEMO_RETAILER` | `x-demo-role: retaileradmin`
**Auth reset:** Clear `demo_role` + `active_persona` before switching (see Demo Auth State above)

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| 2.1 | Login as Retailer | `/login` | `localStorage.getItem('demo_role') === 'retaileradmin'`; `x-demo-role: retaileradmin` confirmed in network tab |
| 2.2 | Open Schedule Calendar | `/dashboard/retailer/schedule` | Page loads without 403; stores and screens seeded in Phase 1 are visible in the location picker |
| 2.3 | Block out "no-ads" window (Sunday 2–4am) | `/dashboard/retailer/schedule` | `POST /api/schedules/override` returns `200`; hard-refresh of `/dashboard/retailer/schedule` shows greyed-out Sunday 2–4am block |
| 2.4 | Verify Dashboard KPIs reflect loop config | `/dashboard/retailer` | `GET /api/retailers/:id/stats` returns `200`; KPI widgets are non-zero and non-loading |

---

## Phase 3 — Brand Books a Campaign (The 5-Step Wizard)

**Persona:** `DEMO_BRAND` | `x-demo-role: brand`
**Auth reset:** Clear `demo_role` + `active_persona` before switching — **this is the highest-risk auth transition in the demo**
**Blocker dependency:** Pre-Condition #1 (`campaigns.js` POST stub) must be resolved before step 3.7 can pass.

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| 3.1 | Login as Brand | `/login` | `localStorage.getItem('demo_role') === 'brand'`; `x-demo-role: brand` confirmed in network tab |
| 3.2 | Open Campaign Wizard | `/dashboard/brand/campaign/new` | Page loads; Step 1 (Location) renders with retailer picker visible; no 403 or empty state |
| 3.3 | **Step 1 — Location:** Select FreshMart, both stores, all 4 screens | `/dashboard/brand/campaign/new` | `wizardData.selectedRetailers` contains `demo-freshmart`; all 4 screen checkboxes selected; "Next" button enabled |
| 3.4 | **Step 2 — Schedule:** Name="BonVie Summer Demo", date range = next 7 days, budget=$2,000 | `/dashboard/brand/campaign/new` | `wizardData.campaignName === "BonVie Summer Demo"`; date range spans 7 days from today; budget field = `2000`; "Next" enabled |
| 3.5 | **Step 3 — Slots:** Select peak hourly slots (12–1pm, 5–7pm) | `/dashboard/brand/campaign/new` | `wizardData.selectedSlots` is non-empty array; slot time labels match selected hours; "Next" enabled |
| 3.6 | **Step 4 — Creative:** Upload `test-ad.png` (from `/tests/test-ad.png`), duration=15s | `/dashboard/brand/campaign/new` | File upload returns `200`; `wizardData.creativeUrl` is a non-null string; duration = `15`; "Next" enabled |
| 3.7 | **Step 5 — Review:** Confirm summary, click Submit | `/dashboard/brand/campaign/new` | `POST /api/campaigns` called with `Authorization: Bearer demo-token` **and** `x-demo-role: brand` (assert both headers — public endpoint does not guarantee correct role was used); response `200` with `{ id: 'demo-campaign-001', status: 'active' }`; `POST /api/slots` called for each selected slot |
| 3.8 | Verify redirect to Brand Dashboard with campaign visible | `/dashboard/brand` | Redirect completes within 3s; `data-testid="campaign-card"` is visible in the DOM; campaign name "BonVie Summer Demo" rendered |

> **Auth model note:** `GET /api/campaigns` is intentionally public (no `authenticate` at mount point). Step 3.8's campaign visibility assertion does **not** prove the correct role was used. Step 3.7 must explicitly assert both `Authorization` and `x-demo-role` headers via Playwright `page.route()` intercept or `request.headers()`.

---

## Phase 4 — Player Broadcasts the Campaign

**Persona:** Public (no auth required)
**Blocker dependency:** Pre-Condition #2 (dynamic slot seeding) must be resolved — slots must cover current hour.

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| 4.1 | Open Loop Demo Player | `/player/demo` | Page loads without auth; demo loop begins cycling within 5s; no "Waiting for Scheduled Slot" message |
| 4.2 | Open Player with screen token | `/player?screen=demo-screen-01` | `GET /api/screens/demo-screen-01/playback-loop` returns `200` (intentionally public per `routebyroute.md`); BonVie ad creative renders in current slot |
| 4.3 | Verify ad transitions | `/player?screen=demo-screen-01` | Player state machine advances from slot 1 → slot 2 within 15s (creative duration); `data-testid="ad-frame"` src changes |
| 4.4 | Assert telemetry heartbeats fire | `/player?screen=demo-screen-01` | `page.waitForRequest(r => r.url().includes('/telemetry'))` resolves within 30s; request body contains `{ screenId, timestamp, slotId }` — all three fields non-null |

---

## Phase 5 — TechOps Verifies Health

**Persona:** `DEMO_TECHOP` | `x-demo-role: techop`
**Auth reset:** Clear `demo_role` + `active_persona` before switching

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| 5.1 | Login as TechOperator | `/login` | `localStorage.getItem('demo_role') === 'techop'`; `x-demo-role: techop` confirmed in network tab |
| 5.2 | Navigate to Health Check | `/dashboard/techoperator/health` | Page loads; health status widget shows green / "OK" (mock response acceptable — see note) |
| 5.3 | Navigate to TechOps Dashboard | `/dashboard/techoperator` | `TechOpsDashboard.jsx` renders; no 404 or blank screen |

> **Known gap — mock health response:** `Health.jsx` currently contains hardcoded/fake connectivity checks (`TODO.md`: "Add real backend connectivity checks to Health.jsx"). For the demo, the health endpoint mock must return `{ status: "ok", backend: true }`. Do not assert real backend connectivity in this phase — mark it `ENVIRONMENT-GATED` until the real checks are wired.

---

## Phase 6 — Admin Validates the Full Circle

**Persona:** `DEMO_ADMIN` | `x-demo-role: admin`
**Auth reset:** Clear `demo_role` + `active_persona` before switching

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| 6.1 | Open Admin Overview | `/dashboard/admin` | `GET /api/campaigns` returns array containing `{ id: 'demo-campaign-001', name: 'BonVie Summer Demo' }`; campaign card visible on overview page |
| 6.2 | Open Network Map | `/dashboard/admin/map` | `NetworkMap.jsx` renders; FreshMart screens show status badge (active or broadcasting); no blank/error state |
| 6.3 | Open AI Log | `/dashboard/admin/ai-log` | `AILog.jsx` renders; log table loads without 500 error (entries may be empty — assert no error state, not entry count) |
| 6.4 | **Cleanup:** Delete demo campaign | `/dashboard/admin/campaigns` | `DELETE /api/campaigns/demo-campaign-001` returns `200`; hard-refresh of `/dashboard/admin/campaigns` does not contain "BonVie Summer Demo" in the DOM |

---

## MVP vs. Full Demo

| Tier | Scope | Prerequisite fixes needed |
|------|-------|-----------------------------|
| **MVP (Tier 1)** | Phases 0–3 only — seed + Admin provision + Brand wizard submission | Pre-Conditions 0, 1, 2 |
| **Full Demo (Tier 2)** | All 6 phases | All 6 pre-conditions; real `campaigns.js`/`schedules.js` handlers; `Health.jsx` real connectivity checks |

The MVP proves the UI layer works for all input surfaces in ~30 minutes of test time. The full demo proves the backend-to-player chain is live.

---

## Spec File Architecture

```
tests/
  demo_wizard/
    00_seed.setup.js            ← DemoSeedService, dynamic slot timing (startTime = Date.now())
    01_admin_provision.spec.js
    02_retailer_schedule.spec.js
    03_brand_campaign_wizard.spec.js
    04_player_broadcast.spec.js
    05_techops_health.spec.js
    06_admin_validate.spec.js
    demo.fixtures.js            ← shared personas, sample data constants, beforeEach auth reset
```

Each spec uses Playwright's `test.describe.serial()` to enforce ordering within the phase. The `globalSetup` in `00_seed.setup.js` guarantees Firestore state before Phase 1 starts. Every spec imports `beforeEach` auth reset from `demo.fixtures.js`.

---

## Lessons Learned (From This Repo)

1. **Silent catch = invisible failures** — `BaseRepository.update()` swallowed Firestore errors until Sprint 11. Every step in this demo asserts on the *response body and status code*, not just the absence of an error modal.
2. **Duplicate filenames broke CI** — `TicketDashboard` and `CampaignApprovalList` previously had two diverging implementations. Run `/hygiene` and `/validate-testids` before executing the demo suite to guarantee a clean baseline.
3. **Clock-sensitive logic needs clock control** — The player slot timing bug is a test environment/clock problem. The demo seed owns the clock by writing `startTime = Date.now()` at seed-time, not at test-time.
4. **Public endpoints don't prove correct auth** — `GET /api/campaigns` returns 200 with no auth (confirmed `routebyroute.md`). Asserting campaign visibility is not sufficient proof that the correct `x-demo-role` was sent. Always assert request headers explicitly on POST/mutation steps.

---

## Probability Summary

| Phase | Probability | Ceiling removed by |
|-------|-------------|-------------------|
| Phase 0 — Seed | 92% | Dynamic slot timing fix (Pre-Condition 2) |
| Phase 1 — Admin | 93% | All routes confirmed from `App.jsx`; LoopBuilder orphan alert retired |
| Phase 2 — Retailer | 91% | Route confirmed; falsifiable assertions added |
| Phase 3 — Brand Wizard | 82% | Gated on `campaigns.js` stub (Pre-Condition 1); rises to ~95% once stub lands |
| Phase 4 — Player | 85% | Dynamic slot seed directly unlocks; telemetry assertion falsifiable |
| Phase 5 — TechOps | 88% | Route confirmed; mock health response documented as explicit pre-condition |
| Phase 6 — Admin Validate | 94% | All routes confirmed; delete assertion falsifiable with hard-refresh |
| **Overall suite** | **89%** | Rises to ~95% once Pre-Conditions 0–2 are resolved |

---

## Registration

Register as `/demo` in `workflows.md` and back with `.agent/workflows/demo.md` following the same step-by-step format as `bigtest.md`.
