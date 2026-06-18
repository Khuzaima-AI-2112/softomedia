# Massive E2E Demo Wizard — Canonical Plan
**Date:** 2026-06-17
**Status:** Draft — awaiting pre-condition sign-off
**Author:** Architecture Review / SRE

This document defines the canonical end-to-end demo workflow for `softomedia-live2026`. Every step depends on the one before it — that ordering constraint is also what makes it a reliable regression detector.

---

## Phase 0 — Seed & Bootstrap (Programmatic, no UI)

Before the wizard starts, a `DemoSeedService` pre-populates Firestore with a known, deterministic dataset:

- `DEMO_RETAILER`: "FreshMart Montréal" — 2 stores, 4 screens, business hours seeded for the current week
- `DEMO_ADVERTISER`: "BonVie Snacks" — pre-approved brand account
- `DEMO_ADMIN`: superuser with full access
- `DEMO_TECHOP`: health-check operator
- Loop template with 2 seeded paid slots at the **current hour** (this fixes the `loop_playback.spec.js` timeout bug — the slot timing mismatch is the documented root cause in `TODO.md`)

> **Lessons Learned:** The existing `ad_player.spec.js` failures stem from the player showing "Waiting for Scheduled Slot" because seeded slots don't cover the current hour. The demo seed must dynamically set slot timestamps to `now() + offset`.

---

## Phase 1 — Admin Provisions the Network

**Persona:** `DEMO_ADMIN`
**Screens touched:** Admin Overview, Retailer Mgmt, Advertiser Mgmt, Screen Mgmt, Loop Mgmt, CPM Pricing Calendar, Business Hours, User Mgmt

| Step | Action | Input Created |
|------|--------|---------------|
| 1.1 | Login as Admin | Auth token saved |
| 1.2 | Create Retailer: "FreshMart Montréal" | `retailers` collection doc |
| 1.3 | Add 2 Stores to that Retailer | `stores` sub-docs |
| 1.4 | Add 4 Screens (2 per store) | `screens` sub-docs |
| 1.5 | Set Business Hours for all stores | `businessHours` docs |
| 1.6 | Create Advertiser: "BonVie Snacks" | `advertisers` collection doc |
| 1.7 | Create a Loop Template for FreshMart | `loops` collection doc |
| 1.8 | Set CPM pricing on the calendar | `pricing` docs |
| 1.9 | Create Brand User account for BonVie | `users` doc with `role=brand` |
| 1.10 | Create Retailer User for FreshMart | `users` doc with `role=retailer` |

> **Orphan alert:** `LoopBuilder.jsx` and `PlaylistManagement.jsx` are unrouted. Step 1.7 must use whatever routed Loop Management UI exists at `/dashboard/admin/loops`, not the orphaned builder. Wire-up or exclusion must be a declared pre-condition before this phase runs.

---

## Phase 2 — Retailer Configures Their Schedule

**Persona:** `DEMO_RETAILER`
**Screens:** Retailer Dashboard, Schedule Calendar

| Step | Action | Input Created |
|------|--------|---------------|
| 2.1 | Login as Retailer | Retailer auth token |
| 2.2 | Open Schedule Calendar | Confirms stores/screens populated from Phase 1 |
| 2.3 | Block out a "no-ads" window (e.g., Sunday 2–4am) | `scheduleOverride` doc |
| 2.4 | Verify Dashboard KPIs reflect the loop config | Read-only assertion |

---

## Phase 3 — Brand Books a Campaign (The 5-Step Wizard)

**Persona:** `DEMO_BRAND` (BonVie Snacks)
**Screens:** Brand Dashboard → Campaign Wizard Steps 1–5

This is the most important phase — the wizard data flow is fully documented and all 5 step files are wired up.

| Step | Action | Data Written |
|------|--------|--------------|
| 3.1 | Login as Brand | Brand auth token |
| 3.2 | Open Campaign Wizard | `/dashboard/brand/campaign/new` |
| 3.3 | **Step 1 — Location:** Select FreshMart, both stores, all 4 screens | `wizardData.selectedRetailers/Stores/Screens` |
| 3.4 | **Step 2 — Schedule:** Name="BonVie Summer Demo", date range = next 7 days, budget=$2,000 | `wizardData.campaignName/dateRange/budget` |
| 3.5 | **Step 3 — Slots:** Select peak hourly slots (e.g., 12–1pm, 5–7pm) | `wizardData.selectedSlots` |
| 3.6 | **Step 4 — Creative:** Upload `test-ad.png` (already in `/tests/test-ad.png`), duration=15s | `wizardData.creativeUrl/creativeDuration` |
| 3.7 | **Step 5 — Review:** Confirm summary is correct, click Submit | `POST /api/campaigns` + `POST /api/slots` |
| 3.8 | Verify redirect to Brand Dashboard with campaign visible | Read assertion |

> **Known stub risk:** `campaigns.js` and `schedules.js` in `ad-server/src/api/` are documented stubs. Phase 3 will fail at step 3.7 unless those POST handlers are implemented first. This is the **#1 blocker** for a complete E2E demo — it must be a declared pre-condition.

---

## Phase 4 — Player Broadcasts the Campaign

**Persona:** Public (no auth)
**Screens:** `/player`, `/player/demo`

| Step | Action | Assertion |
|------|--------|-----------|
| 4.1 | Open `/player/demo` (Loop Demo Player) | Demo loop plays — no auth required |
| 4.2 | Open `/player` with a screen token | Seeded BonVie ad plays in the current hour slot |
| 4.3 | Verify ad transitions (BonVie ad 1 → BonVie ad 2) | Player state machine fires correctly |
| 4.4 | Assert telemetry heartbeats fire | Network intercept confirms `POST /telemetry` calls |

> **Known failure:** `loop_playback.spec.js` has 10 timeout failures because seeded slot times don't match current hour. The demo seed (Phase 0) fixes this by setting slot times dynamically. This is the architectural key that unlocks Phase 4.

---

## Phase 5 — TechOps Verifies Health

**Persona:** `DEMO_TECHOP`
**Screen:** `/dashboard/techoperator/health`

| Step | Action | Assertion |
|------|--------|-----------|
| 5.1 | Login as TechOperator | TechOp auth token |
| 5.2 | Navigate to Health Check | Confirm backend connectivity shows green |
| 5.3 | Confirm the new campaign appears in backend status | Integration assertion |

> **Current gap:** `Health.jsx` has hardcoded/fake checks — `TODO.md` explicitly notes "Add real backend connectivity checks to Health.jsx". For the demo, mock the health response to return green so the phase doesn't block on infrastructure.

---

## Phase 6 — Admin Validates the Full Circle

**Persona:** `DEMO_ADMIN`
**Screens:** Admin Overview, AI Log, Network Map

| Step | Action | Assertion |
|------|--------|-----------|
| 6.1 | Open Admin Overview | BonVie campaign visible in active campaigns |
| 6.2 | Open Network Map | FreshMart screens show as active/broadcasting |
| 6.3 | Open AI Log | Confirm AI-assisted actions were logged (if any) |
| 6.4 | **Cleanup:** Delete demo campaign, assert it disappears | Tests teardown path |

---

## MVP vs. Full Demo

| Tier | Scope | Prerequisite fixes needed |
|------|-------|--------------------------|
| **MVP (Tier 1)** | Phases 0–3 only — seed + Admin provision + Brand wizard submission | Stub out `campaigns.js` POST to return `200` + fake ID |
| **Full Demo (Tier 2)** | All 6 phases | Fix slot timing bug, implement real `campaigns.js`/`schedules.js` handlers, wire `Health.jsx` to real backend |

The MVP proves the UI layer works for all input surfaces in ~30 minutes of test time. The full demo proves the backend-to-player chain is live.

---

## Spec File Architecture

Rather than overloading `integration_gold_path.spec.js`, the recommended structure is:

```
tests/
  demo_wizard/
    00_seed.setup.js          ← DemoSeedService, dynamic slot timing
    01_admin_provision.spec.js
    02_retailer_schedule.spec.js
    03_brand_campaign_wizard.spec.js
    04_player_broadcast.spec.js
    05_techops_health.spec.js
    06_admin_validate.spec.js
    demo.fixtures.js          ← shared demo personas + sample data constants
```

Each spec uses Playwright's `test.describe.serial()` to enforce ordering within the phase, and the `globalSetup` in `00_seed.setup.js` guarantees Firestore state before Phase 1 starts.

---

## Critical Pre-Conditions (Blockers to Resolve First)

These must be resolved before the demo workflow can be declared passing:

1. **API stub depth** — `campaigns.js` and `schedules.js` POST handlers return 404. At minimum, implement a stub returning `{ id: 'demo-campaign-001', status: 'active' }`.
2. **Dynamic slot seeding** — `SeedService.js` must write slots with `startTime = currentHour`, not a hardcoded time. This is a one-line fix with major test-stability impact.
3. **Orphaned pages** — `LoopBuilder.jsx`, `PlaylistManagement.jsx`, `TechOpsDashboard.jsx` have zero routes. Either wire them up before including them in the demo, or explicitly exclude them with a `// NOT YET ROUTED` comment in the wizard spec.
4. **XSS vulnerability** — the `react-router` Open Redirect should be patched (`npm audit fix`) before demo runs go to any shared environment.
5. **Playwright timeout** — increase global timeout to 60s for the demo suite and add `await page.waitForSelector('.main-content-loaded')` guards for `React.lazy` routes.

---

## Lessons Learned (From This Repo)

Three lessons from `TODO.md` and `incidents/` that directly shaped this plan:

1. **Silent catch = invisible failures** — `BaseRepository.update()` was swallowing Firestore errors until Sprint 11. The demo spec must assert on the *response*, not just the absence of an error modal.
2. **Duplicate filenames broke CI** — `TicketDashboard` and `CampaignApprovalList` existed in two diverging implementations. The demo workflow should run `/hygiene` and `/validate-testids` before executing, guaranteeing a clean baseline.
3. **Clock-sensitive logic needs clock control** — the player slot timing bug is fundamentally a test environment/clock problem. The demo seed must own the clock by writing slot times at seed-time, not at test-time.

---

## Registration

This workflow must be registered as `/demo` in `workflows.md` and backed by `.agent/workflows/demo.md` following the same step-by-step format as `bigtest.md`.
