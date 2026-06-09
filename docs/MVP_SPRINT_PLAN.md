# MVP Sprint Plan — Digital Screen Network Management Platform

**Last revised:** 2026-06-08 (Step 5 — aligned to Sprint 16)
**Grounded against:** HEAD [`f4974d0`](https://github.com/cfroszte/softomedia-live2026/commit/f4974d0e58d581ce04c6f24d02180741fbe67252)
**Source docs consumed:** `sprint7.md`, `sprint8.md`, `sprint9.md`, `sprint13.md`, `sprint14.md`, `sprint15.md`, `sprint15-retro.md`, `sprint16.md`, `BUG_FIX_LAN20260527.md`, `TASK_PLAN20260527.md`, `orphansFIX1–5.md`, `changelog.md`
**Active guardrails:** 14 (GUARDRAIL-1 through GUARDRAIL-14 — see § Guardrails)

> **Divergence notice:** The previous version of this file described a 6-sprint plan (S1–S6) that was completed and superseded. The platform has since grown to 16 sprints covering multi-tenant role management, advertiser/brand flows, monetization, pricing config, and enum normalization. This revision reflects reality.

---

## Sprint Overview

| Sprint | Focus | Status | Sprint Doc |
|--------|-------|--------|------------|
| Sprint 1 | Broadcasting Engine Core | ✅ Complete | `sprints1to4summary.md` |
| Sprint 2 | Admin Loop Management UI | ✅ Complete | `sprints1to4summary.md` |
| Sprint 3 | Retailer Validation Workflow | ✅ Complete | `sprints1to4summary.md` |
| Sprint 4 | Player Loop Playback + Fix | ✅ Complete | `sprints1to4summary.md`, `fix-plan-loops-sprint4.md` |
| Sprint 5 | Analytics & Telemetry | ✅ Complete | (archived in old MVP plan) |
| Sprint 6 | Polish & Integration Testing | ✅ Complete | (archived in old MVP plan) |
| Sprint 7 | Multi-Tenant Auth, Role Guards, Screen Mgmt | ✅ Complete | `sprint7.md` |
| Sprint 8 | Retailer Dashboard, Schedule History, Network Map | ✅ Complete | `sprint8.md` |
| Sprint 9 | Ticket System, TechOps Dashboard, Business Hours | ✅ Complete | `sprint9.md` |
| Sprint 10–12 | Orphan Cleanup, URL Fixes, Admin Brand Flows, LAN Hotfix | ✅ Complete | `orphansFIX1–5.md`, `BUG_FIX_LAN20260527.md`, `TASK_PLAN20260527.md` |
| Sprint 13 | Advertiser Persona, Campaign Wizard, Playlists, CPM Calendar | ✅ Complete | `sprint13.md` |
| Sprint 14 | Advertiser Dashboard, Campaigns UI, New Campaign Flow | ✅ Complete | `sprint14.md` |
| Sprint 15 | Monetization, Pricing Config, Billing / Invoices | ✅ Complete | `sprint15.md`, `sprint15-retro.md` |
| Sprint 16 | Enum Normalization, Loop Status Integrity, Infra Hardening | 🟡 In Progress | `sprint16.md` |

**Business rules:**
- Business Hours: 08:00–22:00 (14 loops/day)
- Loop Format: 12 ads × 5 seconds = 60-second loop
- Personas: `admin`, `superadmin`, `super_admin`, `advertiser` (brand), `retaileradmin`, `techoperator`

---

## Sprints 1–6: Core Broadcasting Platform ✅

**Completed scope (per archived docs):**

| Sprint | Key Deliverables | Key Files |
|--------|------------------|----------|
| S1 | `LoopRepository.js`, `LoopGenerationService.js`, `/api/loops` endpoints, 10 Jest tests | `LoopRepository.js`, `loops.js` |
| S2 | `LoopManagement.jsx`, `LoopBuilder.jsx`, `loop_builder.spec.js` (8 tests) | `pages/admin/LoopManagement.jsx`, `pages/admin/LoopBuilder.jsx` |
| S3 | `ScheduleCalendar.jsx`, `LoopPreviewModal.jsx`, retailer approve/reject, `retailer_validation.spec.js` (10 tests) | `pages/retailer/ScheduleCalendar.jsx` |
| S4 | `Player.jsx` dual-mode playback, hour change detection, slot rotation, `loop_playback.spec.js` (7 tests), loop fix | `pages/Player.jsx` |
| S5 | `LoopAnalytics.jsx`, proof-of-play dashboard, `analytics_loop.spec.js` (6 tests) | `pages/admin/LoopAnalytics.jsx` |
| S6 | E2E test suite, `integration_broadcasting.spec.js` (10 tests), `changelog.md` | `tests/integration_broadcasting.spec.js` |

**SRE/QA note:** `integration_broadcasting.spec.js` from S6 is a candidate for S11-1/2/4 persistence QA (RISK-S16-5 carry-forward — 3 sprints unresolved). See § Cross-Sprint Risk Register.

---

## Sprint 7: Multi-Tenant Auth & Screen Management ✅

**Source:** `mdarchives/oldsprints/sprint7.md`

**Scope:**
- Multi-tenant role guard system (`authenticate`, `requireRole`)
- Admin screen management (`ScreenManagement.jsx`)
- User management (`UserManagement.jsx`)
- Advertiser management (`AdvertiserManagement.jsx`)
- Retailer management (`RetailerManagement.jsx`)
- Auth context and protected routes in `App.jsx`

**Key files:** `pages/admin/ScreenManagement.jsx`, `pages/admin/UserManagement.jsx`, `contexts/AuthContext.jsx`

**SRE/QA note:** Sprint 7 established the middleware baseline (`authenticate`, `requireRole`) that all subsequent hardening tasks reference. GUARDRAIL-5 was derived from S7 patterns.

---

## Sprint 8: Retailer Dashboard & Network Infrastructure ✅

**Source:** `mdarchives/oldsprints/sprint8.md`, `sprint8-sre-retro-consolidated.md`

**Scope:**
- `RetailerDashboard.jsx` with live schedule view
- `ScheduleHistory.jsx` (served at `/dashboard/retailer/schedule-history`)
- `ScheduleManager.jsx` (served at `/dashboard/retailer/schedule-manager`)
- `NetworkMap.jsx` (served at `/dashboard/admin/network-map`)
- Retailer loop approval list (`pages/retailer/CampaignApprovalList.jsx`)

**SRE/QA corrections from retro:**
- S8 retro surfaced the `TicketDashboard.jsx` / `TicketDetail.jsx` duplication (components/ vs pages/) — resolved in S11 cleanup
- Hardcoded `localhost:8080` in deleted `components/TicketDashboard.jsx` — source of GUARDRAIL-6

---

## Sprint 9: Ticket System & TechOps ✅

**Source:** `mdarchives/oldsprints/sprint9.md`, `sprint9-blast-radius.md`, `sprint9-probability-audit.md`

**Scope:**
- `TicketDashboard.jsx` (served at `/dashboard/tickets`)
- `TicketDetail.jsx` (served at `/dashboard/tickets/:id`)
- `TechOpsDashboard.jsx` (served at `/dashboard/techoperator`)
- `Health.jsx` (served at `/dashboard/techoperator/health`)
- Business hours management (`BusinessHoursManagement.jsx`)

**SRE/QA corrections from retro:**
- S9 blast radius doc confirms ticket pages are standalone — no shared state with retailer or admin flows
- `BusinessHoursManagement.jsx` added `BUSINESS_HOURS` export to `LoopRepository.js` — this export is used in `loops.js` S13-2 handlers

---

## Sprints 10–12: Orphan Cleanup, URL Fixes, LAN Hotfix ✅

**Sources:** `orphansFIX1.md`, `orphansFIX2.md`, `orphansFIX3.md`, `orphansFIX4.md`, `orphansFIX5.md`, `orphanedFIX12.md`, `BUG_FIX_LAN20260527.md`, `TASK_PLAN20260527.md`, `URLfixNOTES.md`, `sprint-admin-brand-flows-2026-05.md`

**Scope (consolidated):**
- Orphaned component cleanup: deleted stale `components/TicketDashboard.jsx`, `components/TicketDetail.jsx` (hardcoded `localhost:8080`)
- URL fixes across all dashboard routes (documented in `URLfixNOTES.md`)
- Admin/brand flow scaffolding (`sprint-admin-brand-flows-2026-05.md`)
- `SofiensBullshit.md` — prevention plan for hallucinated routes/files; source of GUARDRAIL-1 and GUARDRAIL-2 enforcement
- LAN hotfix (`BUG_FIX_LAN20260527.md`, 2026-05-27): production network fix during live event
- `TASK_PLAN20260527.md`: structured task breakdown that preceded the numbered sprint system

**SRE/QA corrections:**
- No individual sprint12.md found. S10–12 work is documented across orphan fix files and task plans. The `App.jsx` file-map comment (read in full during S16 Step 4) confirms all S10–12 page files are on disk.
- `SofiensBullshit.md` is the prevention plan referenced in `App.jsx` L10 — it codified the "no lazy import without confirmed file" rule that became GUARDRAIL-2.

---

## Sprint 13: Advertiser Persona, Campaign Wizard, Playlists, CPM Calendar ✅

**Source:** `current_sprint/sprint13.md` (46,094B)

**Scope:**
- `AdvertiserDashboard.jsx` (served at `/dashboard/advertiser`) — initial scaffold
- `BrandCampaignWizard.jsx` (served at `/dashboard/brand/campaign/new`)
- `BrandDashboard.jsx` (served at `/dashboard/brand`)
- `CPMCalendar.jsx` (served at `/dashboard/admin/pricing`)
- `Loops.jsx` (served at `/dashboard/retailer/loops`)
- `CampaignApprovalList.jsx` page wrapper (served at `/dashboard/retailer/campaign-approvals`)
- `BRAND_NAV` added to `DashboardLayout.jsx` with `getNavItems()` mapping `persona === 'advertiser'` → `BRAND_NAV`
- ENUM-AUDIT-2 write path resolved: `playlists.js` L22 `status = 'draft'` (lowercase)
- Playlists collection schema added to `DATABASE_SCHEMA.md`

**SRE/QA corrections (Step 5 — from S16 Sprint 1 and Step 4 source reads):**
- ENUM-AUDIT-2 write path was fixed, but `PlaylistRepository.js` `findActiveByScreen()` and `findGlobalPlaylist()` still query `status == 'ACTIVE'` (uppercase). Survivor documented as RISK-S16-9. **Scheduled for ENUM-AUDIT-3 in Sprint 17.**
- S13-2 raw string writes in `loops.js` (`'REJECTED'`, `'PENDING'`, `'APPROVED'`) were introduced in this sprint, bypassing `LOOP_STATUS` constants. This is the root cause of RISK-S16-1 and RISK-S16-2. The `'PENDING'` ≠ `'PENDING_APPROVAL'` mismatch means `POST .../approve-all` has returned `approvedCount: 0` on every call since S13-2.

---

## Sprint 14: Advertiser Dashboard, Campaigns UI, New Campaign Flow ✅

**Source:** `current_sprint/sprint14.md` (9,692B)

**Scope:**
- `AdvertiserDashboard.jsx` full implementation (served at `/dashboard/advertiser`)
- `AdvertiserCampaigns.jsx` (served at `/dashboard/advertiser/campaigns`)
- `AdvertiserNewCampaign.jsx` (served at `/dashboard/advertiser/campaigns/new`)
- Backend campaign endpoints hardened with advertiser role guard
- `App.jsx` updated: advertiser routes registered

**SRE/QA corrections:**
- S14 introduced the advertiser persona as a distinct role in the route table. This disambiguated `persona === 'advertiser'` → `BRAND_NAV` from any hypothetical `brand` persona (there is none). Confirmed in S16 Step 4 source read of `DashboardLayout.jsx`.

---

## Sprint 15: Monetization, Pricing Config & Billing ✅

**Source:** `current_sprint/sprint15.md` (35,265B), `current_sprint/sprint15-retro.md` (13,181B)
**Commits:** [`067b2f2`](https://github.com/cfroszte/softomedia-live2026/commit/067b2f2af2061d5135961436a4e9f618542a2645) → [`1051b85`](https://github.com/cfroszte/softomedia-live2026/commit/1051b85dbe5f97abc78c95ccd3a73227a1045058) (16 commits)

**Scope:**
- `PricingConfig.jsx` (served at `/dashboard/admin/pricing-config`) — NEW page
- `Invoices.jsx` (served at `/dashboard/advertiser/invoices`) — NEW page
- `pricing.js` API router EDITED (not created — already existed at `ad-server/src/api/pricing.js`)
- `PricingRepository.js` — confirmed on disk, updated with config CRUD
- `GET /api/pricing/config` — hardened with `authenticate` + `requireRole('admin', 'superadmin')`
- `PUT /api/pricing/config` — role guard added (`requireRole`)
- `GET /api/invoices` and `POST /api/invoices` — new routes
- `GET /api/invoices/:id/pdf` — stub (returns `{ message: 'PDF generation not yet available' }`); post-MVP
- `DATABASE_SCHEMA.md` updated: invoices collection schema + composite index notes
- `API_ROUTES.md` updated: all new routes documented
- `DashboardLayout.jsx` updated: `BRAND_NAV[2]` Invoices nav entry added (pointing to `/dashboard/brand/invoices` — **bug; corrected in S16-0**)

**Failure modes from retro (FM-S15-1 through FM-S15-7):**
- FM-S15-1: `pricing.js` misclassified as CREATE → added GUARDRAIL-9
- FM-S15-2: Security gaps found mid-sprint → added GUARDRAIL-10
- FM-S15-3: `PATCH` → `PUT` method correction → reinforced GUARDRAIL-9
- FM-S15-4: `CPMCalendar.jsx` anonymous-call risk found late → added GUARDRAIL-11
- FM-S15-5: `PricingService.js` demoted to optional → added GUARDRAIL-12
- FM-S15-6: Doc/nav stories deprioritized → added GUARDRAIL-13
- FM-S15-7: S11-1/2/4 QA carried 3rd sprint → added GUARDRAIL-14

**Carry-forwards to S16:** See § Sprint 16 and § Cross-Sprint Risk Register.

---

## Sprint 16: Enum Normalization, Loop Status Integrity & Infra Hardening 🟡

**Source:** `current_sprint/sprint16.md` (40,187B — Steps 1–4 complete as of 2026-06-08)
**Grounded against:** HEAD [`f4974d0`](https://github.com/cfroszte/softomedia-live2026/commit/f4974d0e58d581ce04c6f24d02180741fbe67252)

### Tasks

| Task | Description | Files | Probability | Status |
|------|-------------|-------|-------------|--------|
| S16-0 | Fix `BRAND_NAV` Invoices link (live 404) | `DashboardLayout.jsx` | **99%** | ⏳ Ready to ship |
| S16-1 | Normalize `LOOP_STATUS` + `SLOT_STATUS` to lowercase | `LoopRepository.js`, `scripts/migrate-loop-status-lowercase.js` | **83%** | ⏳ Pre-checks required |
| S16-2 | Fix `loops.js` raw string writes (atomic with S16-1) | `loops.js` | **95%** | ⏳ Atomic with S16-1 |
| S16-3 | Create `firestore.indexes.json` | `firestore.indexes.json` | **71%** | ⏳ Pre-checks required |
| S16-4 | Schedule or close S11-1/2/4 persistence QA | `tests/` (2 candidate files) | **88%** | ⏳ Read candidate files first |
| S16-5 | Update `DATABASE_SCHEMA.md` | `docs/DATABASE_SCHEMA.md` | **97%** | ⏳ After S16-1+S16-2 merge |

### Key Findings from Steps 1–4

- **`BRAND_NAV` invoices 404 (live bug):** `DashboardLayout.jsx` L33 points Invoices at `/dashboard/brand/invoices`. No `<Route path="brand/invoices">` in `App.jsx`. Fix: point to `/dashboard/advertiser/invoices`. Role-guard risk fully eliminated (S16 Step 4 confirmed `getNavItems()` maps `persona === 'advertiser'` → `BRAND_NAV` with no ambiguity).
- **`LOOP_STATUS` enum actively polluting Firestore:** All-uppercase constants in `LoopRepository.js`. Three raw string writes in `loops.js` (L206, L262, L267) bypass constants. L262 `'PENDING'` ≠ `'PENDING_APPROVAL'` — approve-all broken since S13-2.
- **`PlaylistRepository.js` ENUM-AUDIT-2 survivor:** `findActiveByScreen()` and `findGlobalPlaylist()` query `status == 'ACTIVE'` (uppercase). Not in S16 scope — scheduled ENUM-AUDIT-3 for S17.
- **`firestore.indexes.json` not on disk.** Two documented composite indexes not deployed.
- **S11-1/2/4 QA candidates identified:** `tests/integration_broadcasting.spec.js`, `tests/loop_builder.spec.js` (from 17-file test directory listing).

### Isolation Verdict

- S16-0, S16-3, S16-4, S16-5 are fully isolated (zero shared-infra risk).
- S16-1 + S16-2 must land as a single atomic commit. Dual-write window requires staging backfill gate before production promotion.
- No task in S16 touches shared middleware, auth guards, `AuthContext`, or any cross-cutting frontend infrastructure. No task creates, removes, or renames any API route.

### Recommended Execution Order

1. **Ship S16-0 immediately** — 1-line fix, zero dependencies
2. S16-4 triage in parallel
3. S16-3 pre-check (`find . -name "firebase.json"`)
4. S16-1 + S16-2 atomic commit → staging only
5. Run backfill script, confirm zero uppercase docs
6. S16-5 doc update
7. Promote S16-1+S16-2 to production

---

## What Diverged From the Old MVP Plan

| Old Plan Claim | Reality | Correction |
|---|---|---|
| "Sprint 5: Analytics & Telemetry — Pending" | Completed (archived in old plan) | Marked complete |
| "Sprint 6: Polish & Integration Testing — Pending" | Completed | Marked complete |
| Plan ends at Sprint 6 | 10 additional sprints (S7–S16) have run | All added above |
| No mention of multi-tenant auth | S7 shipped full role-guard system | Added S7 section |
| No mention of advertiser/brand persona | S13–14 shipped full advertiser flows | Added S13–14 sections |
| No mention of monetization or invoices | S15 shipped pricing config, billing, PDF stub | Added S15 section |
| No mention of enum violations | S13-2 introduced `LOOP_STATUS` raw string writes; S16 is the corrective sprint | Added to S13 SRE note and S16 section |
| `route: /admin/analytics` | Actual route is `/dashboard/admin/loop-analytics` (`App.jsx` confirmed) | Corrected |
| `route: /dashboard/retailer/schedule/calendar` | Actual route is `/dashboard/retailer` (ScheduleCalendar is the default retailer page) | Corrected |
| Total tests: 51 Playwright + 10 Jest | Test directory now has 17 spec files (candidates include S11-era persistence tests still unresolved) | Updated |

---

## Cross-Sprint Risk Register

| ID | Description | Introduced | Area | Status | Resolution Sprint |
|---|---|---|---|---|---|
| RISK-S13-1 | `loops.js` S13-2 raw string writes (`'REJECTED'`, `'PENDING'`, `'APPROVED'`) bypass `LOOP_STATUS` constants. `'PENDING'` ≠ `'PENDING_APPROVAL'` — approve-all returns 0 since S13-2. | S13 | Backend | 🔴 Active | **S16** (S16-1+S16-2) |
| RISK-S13-2 | `LOOP_STATUS` and `SLOT_STATUS` enums all-uppercase in `LoopRepository.js`, violating GUARDRAIL-4. | S13 | Backend/Firestore | 🔴 Active | **S16** (S16-1) |
| RISK-S13-3 | ENUM-AUDIT-2 write path (`playlists.status`) introduced with uppercase. | S13 | Backend/Firestore | ✅ Resolved S13 | `playlists.js` L22 `= 'draft'` |
| RISK-S13-4 | ENUM-AUDIT-2 query survivor: `PlaylistRepository.js` `findActiveByScreen()` and `findGlobalPlaylist()` query `'ACTIVE'` (uppercase). Write path fixed; query path was not. | S13 | Backend/Firestore | 🟡 New (found S16 Step 3) | **S17** (ENUM-AUDIT-3) |
| RISK-S14-1 | Advertiser persona `BRAND_NAV` Invoices link (`/dashboard/brand/invoices`) points to non-existent route. Live 404. | S15 (nav added) | Frontend | 🔴 Live bug | **S16** (S16-0) |
| RISK-S15-1 | No `firestore.indexes.json` on disk. Composite indexes on `invoices` and `campaigns` documented but not deployed. | S15 | Infra | 🟡 Pre-production | **S16** (S16-3) |
| RISK-S15-2 | S11-1/2/4 persistence QA unresolved for 3 consecutive sprints (S13, S14, S15). Must schedule or close per GUARDRAIL-14. | S11 | QA | 🔴 Escalation required | **S16** (S16-4) |
| RISK-S15-3 | `PlaylistRepository.js` ENUM-AUDIT-2 survivor (see RISK-S13-4 above). Same risk, re-confirmed in S16. | S13 | Backend/Firestore | 🟡 Scheduled | S17 |
| RISK-S15-4 | `GET /api/invoices/:id/pdf` is a post-MVP stub returning HTTP 200 with `{ message: 'PDF generation not yet available' }`. | S15 | Feature debt | 🟢 Deferred post-MVP | Post-MVP (no sprint assigned) |
| RISK-S16-1 | S16-1+S16-2 enum cutover timing window: post-deploy queries for lowercase status miss uppercase Firestore docs until backfill completes. Retailer approval flow silently empty. | S16 | Backend/Firestore | ⚠️ Mitigated | Backfill gate before prod |
| RISK-S16-2 | `POST .../approve-all` behavior delta: currently returns 0 (bug); after S16-2 returns correct non-zero count. Existing test assertions expecting 0 will fail — correctly. | S16 | Backend/Tests | ⚠️ Known delta | Update assertions before S16-2 merge |

---

## Route Table (Confirmed from App.jsx as of S16)

> Authority: `App.jsx` as read in full during S16 Step 4.

| Route | Component | Persona | Sprint Added |
|---|---|---|---|
| `/player` | `Player.jsx` | Public | S4 |
| `/player/demo` | `LoopDemoPlayer.jsx` | Public | S4 |
| `/login` | `Login.jsx` | Public | S7 |
| `/dashboard/admin` | `AdminOverview` | admin / superadmin | S7 |
| `/dashboard/admin/retailers` | `RetailerManagement` | admin | S7 |
| `/dashboard/admin/advertisers` | `AdvertiserManagement` | admin | S7 |
| `/dashboard/admin/campaigns` | `CampaignManagement` | admin | S7 |
| `/dashboard/admin/screens` | `ScreenManagement` | admin | S7 |
| `/dashboard/admin/loops` | `LoopManagement` | admin | S2 |
| `/dashboard/admin/loops/:id` | `LoopBuilder` | admin | S2 |
| `/dashboard/admin/users` | `UserManagement` | admin | S7 |
| `/dashboard/admin/business-hours` | `BusinessHoursManagement` | admin | S9 |
| `/dashboard/admin/network-map` | `NetworkMap` | admin | S8 |
| `/dashboard/admin/ai-log` | `AILog` | admin | S9 |
| `/dashboard/admin/pricing` | `CPMCalendar` | admin | S13 |
| `/dashboard/admin/loop-analytics` | `LoopAnalytics` | admin | S5 |
| `/dashboard/admin/pricing-config` | `PricingConfig` | admin | S15 |
| `/dashboard/brand` | `BrandOverview` | advertiser | S13 |
| `/dashboard/brand/campaign/new` | `CampaignWizard` | advertiser | S13 |
| `/dashboard/retailer` | `RetailerOverview` | retaileradmin | S8 |
| `/dashboard/retailer/schedule` | `ScheduleCalendar` | retaileradmin | S3 |
| `/dashboard/retailer/schedule-history` | `ScheduleHistory` | retaileradmin | S8 |
| `/dashboard/retailer/schedule-manager` | `ScheduleManager` | retaileradmin | S8 |
| `/dashboard/retailer/loops` | `RetailerLoops` | retaileradmin | S13 |
| `/dashboard/retailer/campaign-approvals` | `CampaignApprovals` | retaileradmin | S13 |
| `/dashboard/advertiser` | `AdvertiserDashboard` | advertiser | S14 |
| `/dashboard/advertiser/campaigns` | `AdvertiserCampaigns` | advertiser | S14 |
| `/dashboard/advertiser/campaigns/new` | `AdvertiserNewCampaign` | advertiser | S14 |
| `/dashboard/advertiser/invoices` | `Invoices` | advertiser | S15 |
| `/dashboard/tickets` | `TicketDashboard` | all authenticated | S9 |
| `/dashboard/tickets/:id` | `TicketDetail` | all authenticated | S9 |
| `/dashboard/techoperator` | `TechOpsDashboard` | techoperator | S9 |
| `/dashboard/techoperator/health` | `Health` | techoperator | S9 |

**Route divergences from old MVP plan (corrected):**
- Old plan: `/admin/analytics` → Actual: `/dashboard/admin/loop-analytics`
- Old plan: `/dashboard/retailer/schedule/calendar` → Actual: `/dashboard/retailer/schedule`

---

## Definition of Done — Sprint 16

- [ ] `grep "brand/invoices" client-app/src/layouts/DashboardLayout.jsx` → exit 1, zero matches
- [ ] Login as `persona = 'advertiser'` → Invoices nav link → `/dashboard/advertiser/invoices` → HTTP 200
- [ ] Hard-refresh at `/dashboard/advertiser/invoices` → page loads, no `<NotFound />`
- [ ] `grep -n "'PENDING_APPROVAL'" ad-server/src/repositories/LoopRepository.js` → zero results
- [ ] All `SLOT_STATUS` values in `LoopRepository.js` are lowercase strings
- [ ] `grep -n "'REJECTED'\|'PENDING'\|'APPROVED'\|'LIVE'" ad-server/src/api/loops.js` → zero results
- [ ] S16-1 and S16-2 land in the same commit (diff contains both `LoopRepository.js` and `loops.js`)
- [ ] Backfill script exists at `ad-server/scripts/migrate-loop-status-lowercase.js`, exits 0 in staging
- [ ] After backfill: zero Firestore `loops` docs with uppercase status
- [ ] `find . -name "firestore.indexes.json" | grep -v node_modules` → 1 result; no `{{` placeholders
- [ ] Field names in `firestore.indexes.json` confirmed against `InvoiceRepository.js` (Pre-check A)
- [ ] `§ S16-4 Resolution` in `sprint16.md` filled in with Option A/B/C and reason
- [ ] `grep "ENUM-AUDIT-2 CLOSED" docs/DATABASE_SCHEMA.md` → "Sprint 13" present
- [ ] `grep "ENUM-AUDIT-2 SURVIVOR" docs/DATABASE_SCHEMA.md` → "PlaylistRepository.js" present
- [ ] `grep "ENUM-AUDIT-1" docs/DATABASE_SCHEMA.md` → "Sprint 16" and "migrate-loop-status-lowercase.js" present
- [ ] Canonical `loops.status` and `loops.slots[].status` values in `DATABASE_SCHEMA.md` are all lowercase
- [ ] RISK-S13-4 (`PlaylistRepository.js` ACTIVE survivor) formally scheduled for S17 with documented reason
- [ ] All 14 guardrails remain intact — no new violation introduced by any S16 commit

---

## Guardrails (Active — 14 total)

> Copy-forward from `sprint15-retro.md`. Applies to S16 and all future sprints.

| # | Rule | Source Sprint |
|---|---|---|
| GUARDRAIL-1 | `App.jsx` is route authority. No route without confirmed `App.jsx` registration. | S7 |
| GUARDRAIL-2 | No route without confirmed live source. API routes confirmed from router file, not `API_ROUTES.md`. | S7/S10 |
| GUARDRAIL-3 | No undocumented `data-testid`. Every testid in acceptance criteria. No "works correctly" criteria. | S9 |
| GUARDRAIL-4 | Canonical enum values: lowercase, underscore-separated. No uppercase outside test fixtures. | S13 |
| GUARDRAIL-5 | No shared middleware change without backward-compatibility proof. | S7 |
| GUARDRAIL-6 | No hardcoded API URLs in frontend. All calls through `apiClient`. | S10 |
| GUARDRAIL-7 | `API_ROUTES.md` updated in the same sprint as route creation. | S13 |
| GUARDRAIL-8 | `DATABASE_SCHEMA.md` updated before first Firestore write. | S13 |
| GUARDRAIL-9 | Read existing files in full before writing spec tasks that touch them. *(New S15)* | S15 |
| GUARDRAIL-10 | Inspect middleware chain of existing handlers before hardening. *(New S15)* | S15 |
| GUARDRAIL-11 | Enumerate downstream callers before hardening a public endpoint. *(New S15)* | S15 |
| GUARDRAIL-12 | Confirm service-layer pattern before creating a service file. *(New S15)* | S15 |
| GUARDRAIL-13 | Doc and nav stories are blocking, not best-effort. *(New S15)* | S15 |
| GUARDRAIL-14 | Carry-over risks must have a resolution sprint assigned. *(New S15)* | S15 |

---

## What Changed Since Last Revision

**Previous revision:** 6-sprint plan (S1–S6), no date, described S5 and S6 as pending.
**This revision:** 2026-06-08, aligned to Sprint 16 in-progress.

### Sprint docs added / updated

| Doc | Change |
|---|---|
| `current_sprint/sprint13.md` | Existing — first time included in MVP plan |
| `current_sprint/sprint14.md` | Existing — first time included in MVP plan |
| `current_sprint/sprint15.md` | Existing — first time included in MVP plan |
| `current_sprint/sprint15-retro.md` | Existing — first time included in MVP plan; source of 14 guardrails |
| `current_sprint/sprint16.md` | In-progress — Steps 1–4 complete; Step 5 adds this plan update |
| `mdarchives/oldsprints/sprint7.md` | Summarized |
| `mdarchives/oldsprints/sprint8.md` | Summarized |
| `mdarchives/oldsprints/sprint9.md` | Summarized |
| `mdarchives/oldsprints/orphansFIX1–5.md` | Consolidated into S10–12 section |
| `mdarchives/oldsprints/BUG_FIX_LAN20260527.md` | Noted in S10–12 section |

### Risks resolved since old plan

| Risk | Resolution |
|---|---|
| ENUM-AUDIT-2 write path (`playlists.status`) | ✅ Resolved Sprint 13 (`playlists.js` L22 `= 'draft'`) |
| S15 security gaps SEC-S15-5/6 (`GET/PUT /api/pricing/config` no role guard) | ✅ Resolved Sprint 15 (auth + requireRole added) |
| `pricing.js` misclassified as CREATE | ✅ Corrected before code written (FM-S15-1) |

### Risks newly documented

| Risk | Details |
|---|---|
| RISK-S13-4 (ENUM-AUDIT-2 query survivor) | `PlaylistRepository.js` queries `'ACTIVE'` (uppercase). Found S16 Step 3. Scheduled S17. |
| RISK-S14-1 (`BRAND_NAV` Invoices 404) | Live bug. `DashboardLayout.jsx` L33 points at `/dashboard/brand/invoices` which has no `App.jsx` route. S16-0 fix ready. |

### Tasks moved across sprints

| Task | From | To | Reason |
|---|---|---|---|
| S11-1/2/4 persistence QA | S13, S14, S15 (carried) | S16 (S16-4) | GUARDRAIL-14: must schedule or close |
| ENUM-AUDIT-1 (loops.status migration) | S14, S15 (carried) | S16 (S16-1+S16-2) | Confirmed active write pollution; scheduled |
| ENUM-AUDIT-3 (PlaylistRepository query) | Found S16 | S17 | Out of S16 scope; blast radius concern |
| Real PDF for `GET /api/invoices/:id/pdf` | S15 stub | Post-MVP | Not scheduled |

---

*MVP Sprint Plan — Step 5 complete: 2026-06-08.*
*Grounded against HEAD `f4974d0`. 16 sprints documented. 14 guardrails active.*
*Next action: Sprint 17 to include ENUM-AUDIT-3 (`PlaylistRepository.js`), S11-1/2/4 close/defer if not resolved in S16, and post-MVP PDF stub scheduling.*
