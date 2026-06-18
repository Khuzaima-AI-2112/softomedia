# Massive E2E Demo Wizard — Add-On Coverage
**Date:** 2026-06-17
**Status:** Draft — awaiting pre-condition sign-off
**Author:** Architecture Review / SRE
**Parent document:** `current_sprint/massivee2e.md`

This document covers the **10 routed pages confirmed in `App.jsx` (Sprint 22)** that are absent from `massivee2e.md`. It is modelled after that document and shares the same pre-conditions, auth reset rules, and spec structure. Run this suite **after** `massivee2e.md` phases 0–3 complete — it depends on the seeded Firestore state and the `demo-campaign-001` created by Phase 3.

All routes confirmed from `App.jsx` (Sprint 22 — 2026-06-16). Auth behaviour confirmed from `routebyroute.md` and `manual_testing.md`.

---

## Dependency on massivee2e.md

This suite does not re-run Phase 0 (seed) or Phase 1 (admin provision). It assumes:
- `demo-freshmart`, `demo-bonvie`, all 4 screens, and the loop template exist in Firestore
- `demo-campaign-001` was created by Phase 3 of `massivee2e.md` (status: `active`)
- All 6 pre-conditions in `massivee2e.md` are signed off

If running this suite in isolation, run `00_seed.setup.js` and `01_admin_provision.spec.js` first.

---

## Demo Auth State — Mandatory Reset Between Phases

Same rule as `massivee2e.md`. Every spec file must include:

```js
test.beforeEach(async ({ page }) => {
  await page.evaluate(() => {
    localStorage.removeItem('demo_role');
    localStorage.removeItem('active_persona');
  });
});
```

---

## Phase A — Retailer Reviews Loop Inventory

**Persona:** `DEMO_RETAILER` | `x-demo-role: retaileradmin`
**Auth reset:** Clear `demo_role` + `active_persona` before login
**Gap filled:** `/dashboard/retailer/loops` — retailer view of loop templates and slot inventory

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| A.1 | Login as Retailer | `/login` | `localStorage.getItem('demo_role') === 'retaileradmin'`; `x-demo-role: retaileradmin` confirmed in network tab |
| A.2 | Navigate to Retailer Loops | `/dashboard/retailer/loops` | Page loads without 403; loop templates seeded in Phase 1 of `massivee2e.md` are visible |
| A.3 | Verify loop shows correct slot count | `/dashboard/retailer/loops` | Loop for FreshMart displays 12 slots; slot fill indicator is non-zero (slots were seeded in Phase 0) |
| A.4 | Verify BonVie campaign slot is visible | `/dashboard/retailer/loops` | At least one slot in the loop shows `advertiserId: demo-bonvie` or campaign name "BonVie Summer Demo" |

---

## Phase B — Retailer Campaign Approval Gate ← Critical

**Persona:** `DEMO_RETAILER` | `x-demo-role: retaileradmin`
**Auth reset:** Continue from Phase A (same persona) — no reset needed
**Gap filled:** `/dashboard/retailer/campaign-approvals` — the brand-safety approval workflow documented in `manual_testing.md` Act 3
**Why critical:** This is the mandatory approval gate. A campaign submitted in Phase 3 of `massivee2e.md` cannot be scheduled into a loop slot until the retailer approves it. Without this phase, the demo proves content submission but not the brand-safety workflow that is the product's core differentiator.

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| B.1 | Navigate to Campaign Approvals | `/dashboard/retailer/campaign-approvals` | Page loads; `CampaignApprovalList.jsx` renders; "BonVie Summer Demo" appears in the pending queue |
| B.2 | Open campaign detail | `/dashboard/retailer/campaign-approvals` | Clicking the campaign row/card expands or navigates to detail view; creative thumbnail and campaign metadata are visible |
| B.3 | Click Approve | `/dashboard/retailer/campaign-approvals` | `POST /api/campaigns/demo-campaign-001/approve` (or equivalent) returns `200`; campaign row status changes from "Pending" to "Approved" without page reload |
| B.4 | Hard-refresh and verify status persists | `/dashboard/retailer/campaign-approvals` | After hard-refresh, "BonVie Summer Demo" shows status "Approved"; it is no longer in the pending queue |

> **Auth model note:** `GET /api/campaigns` is intentionally public. Step B.1's queue visibility does not prove the correct role. Step B.3 must assert `x-demo-role: retaileradmin` header on the approve POST via Playwright `page.route()` intercept.

---

## Phase C — Retailer Schedule Manager

**Persona:** `DEMO_RETAILER` | `x-demo-role: retaileradmin`
**Auth reset:** Continue from Phase B (same persona) — no reset needed
**Gap filled:** `/dashboard/retailer/schedule-manager` — granular scheduling interface, distinct from Schedule Calendar

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| C.1 | Navigate to Schedule Manager | `/dashboard/retailer/schedule-manager` | Page loads without 403; `ScheduleManager.jsx` renders with FreshMart stores/screens visible |
| C.2 | Verify approved BonVie campaign appears in schedule | `/dashboard/retailer/schedule-manager` | After Phase B approval, BonVie campaign slots are visible in the manager view; no "pending approval" badge |
| C.3 | Make a schedule adjustment (e.g. shift a slot by 1 hour) | `/dashboard/retailer/schedule-manager` | `PATCH /api/schedules/:slotId` returns `200`; slot time updates in the UI within 2s |

---

## Phase D — Retailer Schedule History (Audit Trail)

**Persona:** `DEMO_RETAILER` | `x-demo-role: retaileradmin`
**Auth reset:** Continue from Phase C (same persona) — no reset needed
**Gap filled:** `/dashboard/retailer/schedule-history` — audit trail of all schedule changes

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| D.1 | Navigate to Schedule History | `/dashboard/retailer/schedule-history` | Page loads; `ScheduleHistory.jsx` renders; history table is non-empty |
| D.2 | Verify the Phase 2 override is recorded | `/dashboard/retailer/schedule-history` | History contains an entry for "Sunday 2–4am no-ads block" created in Phase 2 step 2.3 of `massivee2e.md`; entry has a timestamp and actor field |
| D.3 | Verify the Phase C slot adjustment is recorded | `/dashboard/retailer/schedule-history` | History contains the most recent slot adjustment from Phase C step C.3; entry shows old time and new time |

---

## Phase E — Advertiser Dashboard ← Entire Persona

**Persona:** `DEMO_ADVERTISER` | `x-demo-role: advertiser`
**Auth reset:** Clear `demo_role` + `active_persona` before login — new persona
**Gap filled:** `/dashboard/advertiser` — Sprint 14 Advertiser persona, entirely absent from `massivee2e.md`
**Note:** The `advertiser` role at `/dashboard/advertiser/*` is distinct from the `brand` role at `/dashboard/brand/*`. Both exist as separate route trees in `App.jsx`.

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| E.1 | Login as Advertiser | `/login` | `localStorage.getItem('demo_role') === 'advertiser'`; `x-demo-role: advertiser` confirmed in network tab |
| E.2 | Open Advertiser Dashboard | `/dashboard/advertiser` | `AdvertiserDashboard.jsx` renders; KPI widgets load; no 403 or blank screen |
| E.3 | Verify demo campaign visible on dashboard | `/dashboard/advertiser` | "BonVie Summer Demo" appears in active/recent campaigns section; status = "Approved" (from Phase B) |

---

## Phase F — Advertiser Campaign Management

**Persona:** `DEMO_ADVERTISER` | `x-demo-role: advertiser`
**Auth reset:** Continue from Phase E (same persona) — no reset needed
**Gap filled:** `/dashboard/advertiser/campaigns` — Sprint 14 campaign list with `CampaignWizardModal`

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| F.1 | Navigate to Advertiser Campaigns | `/dashboard/advertiser/campaigns` | `AdvertiserCampaigns.jsx` renders; "BonVie Summer Demo" appears in the campaign list |
| F.2 | Verify retired redirect works | `/dashboard/advertiser/campaigns/new` | Navigating to `campaigns/new` redirects to `/dashboard/advertiser/campaigns` (hard redirect per S22-1 retirement); no 404 |
| F.3 | Open Campaign Wizard Modal | `/dashboard/advertiser/campaigns` | Clicking "New Campaign" opens `CampaignWizardModal` inline (not a route navigation); modal renders Step 1 |
| F.4 | Dismiss modal without submitting | `/dashboard/advertiser/campaigns` | Modal closes; campaign list is unchanged; no orphaned wizard state |

> **Sprint 22 note:** `AdvertiserNewCampaign.jsx` was retired in S22-1. Campaign creation is now via `CampaignWizardModal` inside `AdvertiserCampaigns.jsx`. The route `/dashboard/advertiser/campaigns/new` hard-redirects to `/campaigns`. Step F.2 validates this redirect is live.

---

## Phase G — Advertiser Invoices

**Persona:** `DEMO_ADVERTISER` | `x-demo-role: advertiser`
**Auth reset:** Continue from Phase F (same persona) — no reset needed
**Gap filled:** `/dashboard/advertiser/invoices` — Sprint 15 invoicing feature

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| G.1 | Navigate to Invoices | `/dashboard/advertiser/invoices` | `Invoices.jsx` renders without 403 or blank screen |
| G.2 | Verify invoice exists for demo campaign | `/dashboard/advertiser/invoices` | At least one invoice row is visible; invoice references "BonVie Summer Demo" or `demo-campaign-001`; amount is non-zero |
| G.3 | Verify invoice download / export | `/dashboard/advertiser/invoices` | If a download button exists: clicking it triggers a file download (assert `page.waitForEvent('download')` resolves); if no download, assert the invoice detail view renders |

---

## Phase H — Ticket System (All Personas)

**Gap filled:** `/dashboard/tickets`, `/dashboard/tickets/:id` — entire ticket system absent from `massivee2e.md`

### H-Admin — Admin creates a ticket

**Persona:** `DEMO_ADMIN` | `x-demo-role: admin`
**Auth reset:** Clear `demo_role` + `active_persona` before login

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| H.1 | Login as Admin | `/login` | `x-demo-role: admin` confirmed |
| H.2 | Navigate to Ticket Dashboard | `/dashboard/tickets` | `TicketDashboard.jsx` renders; ticket list loads (may be empty — assert no error state) |
| H.3 | Create a new ticket | `/dashboard/tickets` | `POST /api/tickets` returns `201` with `{ id: 'demo-ticket-001', status: 'open' }`; new ticket appears in list |
| H.4 | Open ticket detail | `/dashboard/tickets/demo-ticket-001` | `TicketDetail.jsx` renders; ticket subject and status visible; no 404 |

### H-Retailer — Retailer views and responds

**Persona:** `DEMO_RETAILER` | `x-demo-role: retaileradmin`
**Auth reset:** Clear `demo_role` + `active_persona` before login

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| H.5 | Login as Retailer | `/login` | `x-demo-role: retaileradmin` confirmed |
| H.6 | Navigate to Ticket Dashboard | `/dashboard/tickets` | `TicketDashboard.jsx` renders; `demo-ticket-001` is visible (assuming cross-role visibility) |
| H.7 | Add a reply to the ticket | `/dashboard/tickets/demo-ticket-001` | `POST /api/tickets/demo-ticket-001/replies` returns `201`; reply text appears in ticket detail thread without page reload |

> **Scope note:** Ticket visibility rules (which roles see which tickets) are not documented in the audit files. If `DEMO_RETAILER` cannot see admin-created tickets, step H.6 should assert that the retailer's ticket list is empty but loads without error, and H.7 should be demoted to a Brand or Admin persona.

---

## Phase I — Admin Campaign Management & Analytics Read-Back

**Persona:** `DEMO_ADMIN` | `x-demo-role: admin`
**Auth reset:** Clear `demo_role` + `active_persona` before login
**Gap filled:** `/dashboard/admin/campaigns`, `/dashboard/admin/loop-analytics`, `/dashboard/admin/pricing-config`

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| I.1 | Login as Admin | `/login` | `x-demo-role: admin` confirmed |
| I.2 | Open Admin Campaign Management | `/dashboard/admin/campaigns` | `CampaignManagement.jsx` renders; "BonVie Summer Demo" visible with status "Approved" (after Phase B); admin can see all campaigns across all brands |
| I.3 | Verify campaign detail / override capability | `/dashboard/admin/campaigns` | Clicking the campaign row renders campaign metadata; an admin action button (approve/reject/override) is present; **do not click** — assert it exists |
| I.4 | Open Loop Analytics | `/dashboard/admin/loop-analytics` | `LoopAnalytics.jsx` renders; telemetry data from Phase 4 of `massivee2e.md` is reflected (slot play counts > 0); no blank or error state |
| I.5 | Open Pricing Config | `/dashboard/admin/pricing-config` | `PricingConfig.jsx` renders without 403; pricing tier configuration UI is visible (Sprint 15); no blank screen |

---

## Phase J — Login Page as a Tested Feature

**Persona:** Unauthenticated
**Gap filled:** `/login` — form validation, wrong-credential error state, redirect-after-login behaviour; never tested as a feature in `massivee2e.md`

| Step | Action | Route | Acceptance Criterion |
|------|--------|-------|---------------------|
| J.1 | Navigate to `/login` as unauthenticated user | `/login` | Login form renders; email and password fields visible; submit button present |
| J.2 | Submit empty form | `/login` | Client-side validation fires; error message(s) appear without API call; form does not submit |
| J.3 | Submit wrong credentials | `/login` | `POST /api/auth/login` returns `401`; error banner or inline message appears: "Invalid credentials" or equivalent; form is not cleared |
| J.4 | Login with valid demo credentials | `/login` | `POST /api/auth/login` returns `200` with a token; redirect fires to `/dashboard` within 2s; `data-testid="dashboard-shell"` or equivalent is visible |
| J.5 | Verify root `/` redirects to `/dashboard` | `/` | Navigating to `/` redirects to `/dashboard/admin` (confirmed from `App.jsx` root redirect); no 404 |

---

## MVP vs. Full Add-On Coverage

| Tier | Phases | Priority rationale |
|------|--------|-------------------|
| **Add-On MVP** | B (Retailer Approval), E–F (Advertiser Dashboard + Campaigns), H-Admin (Ticket create) | These are the critical gaps — brand-safety gate and entire missing persona |
| **Add-On Full** | All phases A–J | Complete route coverage across all 10 missing routes |

Phase B (Retailer Campaign Approval) is the single most important addition. It completes the business loop: Brand submits → **Retailer approves** → Admin validates → Player broadcasts.

---

## Spec File Architecture

Extend `tests/demo_wizard/` with:

```
tests/
  demo_wizard/
    07_retailer_loops.spec.js          ← Phase A
    08_retailer_approval.spec.js       ← Phase B ← highest priority
    09_retailer_schedule_manager.spec.js ← Phase C
    10_retailer_schedule_history.spec.js ← Phase D
    11_advertiser_dashboard.spec.js    ← Phase E
    12_advertiser_campaigns.spec.js    ← Phase F
    13_advertiser_invoices.spec.js     ← Phase G
    14_ticket_system.spec.js           ← Phase H
    15_admin_campaign_analytics.spec.js ← Phase I
    16_login_feature.spec.js           ← Phase J
```

All specs share `demo.fixtures.js` (beforeEach auth reset) from the parent suite.

---

## Coverage Gap Closure

| Route | Phase | Severity | Status |
|-------|-------|----------|--------|
| `/dashboard/retailer/loops` | A | Medium | Covered |
| `/dashboard/retailer/campaign-approvals` | B | **Critical** | Covered |
| `/dashboard/retailer/schedule-manager` | C | High | Covered |
| `/dashboard/retailer/schedule-history` | D | Low | Covered |
| `/dashboard/advertiser` | E | **High** | Covered |
| `/dashboard/advertiser/campaigns` | F | **High** | Covered |
| `/dashboard/advertiser/invoices` | G | Medium | Covered |
| `/dashboard/tickets` + `/dashboard/tickets/:id` | H | High | Covered |
| `/dashboard/admin/campaigns` + `/dashboard/admin/loop-analytics` + `/dashboard/admin/pricing-config` | I | Medium | Covered |
| `/login` as tested feature | J | Low | Covered |

With both `massivee2e.md` and this document passing, **every confirmed route in `App.jsx` (Sprint 22) is covered by at least one E2E step**.

---

## Registration

Register as `/demo-addons` in `workflows.md` alongside the existing `/demo` entry. Back with `.agent/workflows/demo-addons.md`.
