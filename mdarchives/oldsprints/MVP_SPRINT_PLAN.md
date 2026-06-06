# Softomedia Live — MVP Sprint Plan

**Repo:** `cfroszte/softomedia-live2026`  
**Generated:** 2026-06-05  
**Last updated:** 2026-06-05  
**Source audits:** Live repo file listing, `sprint7.md`, `TASKS.md`, `tasks.md`, `sre-integration-report-sprints1to4.md`, `BUG_FIX_LAN20260527.md`, `TASK_PLAN20260527.md`, `qa_notes_developer_v1.pdf` references, `changelog.md`

---

## Overview

This document tracks the full MVP sprint sequence for Softomedia Live — a multi-tenant digital signage SaaS platform. It is the canonical reference for sprint scope, retrospective corrections, and carry-over items. Sprint detail files (`sprint7.md`, `sprint8.md`, etc.) contain task-level implementation specs; this file contains the authoritative sprint history and forward plan.

---

## Hotfixes (Between Sprints)

### ✅ LAN-20260527 — BaseRepository.update() Silent-Catch Fix

**Merged:** 2026-05-27  
**Files changed:** `ad-server/src/repositories/BaseRepository.js`, `RetailerRepository.js`, `AdvertiserRepository.js`

`BaseRepository.update()` was silently swallowing Firestore errors. All UI edits (advertisers, retailers, screens, stores) appeared to succeed but were never persisted. Fixed by removing the silent `catch` and switching from `.update()` to `.set({ merge: true })`.

> ⚠️ `LoopRepository.js` has NOT been audited for the same pattern — this is an open item in Sprint 7 (Task 7.3).

---

## Sprint History

### Sprint 1 — Foundation & Auth

**Status:** ✅ Complete  
**Goal:** Project scaffold, Firebase auth, role-based routing, tenant data model.

**Delivered:**
- React + Vite client app scaffolded under `client-app/`
- Firebase Auth integration with role claim: `admin`, `brand`, `retailer`, `techops`
- `App.jsx` route structure with `DashboardLayout` wrapper
- `AuthContext` + `useAuth` hook
- Tenant Firestore data model (brands, retailers, screens, stores)

---

### Sprint 2 — Admin Dashboard Core

**Status:** ✅ Complete  
**Goal:** Admin CRUD for advertisers, retailers, screens, stores.

**Delivered:**
- `AdvertiserManagement.jsx` — list, create, edit, soft-delete
- `RetailerManagement.jsx` — list, create, edit, soft-delete
- `ScreenManagement.jsx` — register screens, assign to store
- `StoreManagement.jsx` — store CRUD with business hours
- `BaseRepository.js` repository pattern established

---

### Sprint 3 — Brand & Retailer Dashboards

**Status:** ✅ Complete  
**Goal:** Brand campaign management; retailer loop review dashboard.

**Delivered:**
- `BrandDashboard.jsx` — campaign list, status summary
- `CampaignBuilder.jsx` — campaign creation wizard
- `RetailerDashboard.jsx` — retailer home
- `ContentLibrary.jsx` — asset upload and management

> ⚠️ **Retrospective correction:** `ScheduleManager.jsx` and `ScheduleHistory.jsx` (previously attributed to Sprint 3) were actually added in Sprint 6. Sprint 3 delivered `RetailerDashboard.jsx` and `ContentLibrary.jsx` only.

---

### Sprint 4 — Loop Engine

**Status:** ✅ Complete  
**Goal:** Loop data model, `LoopBuilder.jsx`, Player state machine.

**Delivered:**
- `LoopBuilder.jsx` — drag-and-drop loop slot editor
- `LoopManagement.jsx` — admin loop grid
- `Player.jsx` — screen playback engine (loop-slot state machine)
- `LoopRepository.js` — Firestore loop CRUD
- `server/routes/loops.js` — loop API endpoint

**Known open issues from Sprint 4 (carried to Sprint 7):**
- `Player.jsx` `initializePlayer` dep array includes `currentHour` — causes hourly re-registration (R1)
- Loop fetch returns full day dataset, filtered client-side (R2)
- No retry logic in `initializePlayer` (R3)

---

### Sprint 5 — Analytics & Reporting

**Status:** ✅ Complete  
**Goal:** Playback telemetry, loop analytics dashboard.

**Delivered:**
- `LoopAnalytics.jsx` at route `/dashboard/admin/loop-analytics` ⚠️ *(previously documented as `/admin/analytics` — corrected)*
- Telemetry event writes from `Player.jsx`
- Analytics charts (mock data — Firestore aggregation pending, carried to Sprint 8)

---

### Sprint 6 — Schedule Management + Approval Workflow

**Status:** ✅ Complete  
**Goal:** Retailer schedule management; loop approval workflow.

**Delivered:**
- `ScheduleManager.jsx` — retailer weekly schedule grid
- `ScheduleHistory.jsx` — retailer change history
- Bulk-approve endpoint `/api/locations/:id/loops/approve-all` ⚠️ *(endpoint unconfirmed — FIXME in commit, see SRE R5)*
- Loop status transitions: `DRAFT` → `PENDING` → `APPROVED` / `REJECTED`

> ⚠️ **Test files for Sprint 6 are UNVERIFIED** — spec files (`loop_builder.spec.js`, `integration_gold_path.spec.js` Sprint 6 scenarios) not confirmed in commit history. Status unknown until re-run.

---

### Sprint 7 — Playback Gate + Resilience + Content Compliance

**Status:** 🔄 In Progress  
**Duration estimate:** 3 days  
**Risk level:** 🔴 HIGH — `Player.jsx` is the live broadcast engine  
**Detail file:** [`sprint7.md`](./sprint7.md)

**Goal:** Make the approval workflow actually gate broadcast; harden Player against network failures; add upload-time content validation; eliminate dead code risk.

**Tasks:**

| Task | Description | Risk | Status |
|------|-------------|------|--------|
| 7.1 | Fix `Player.jsx` re-registration on hour change | 🔴 HIGH | 🔲 Open |
| 7.2 | Startup retry with exponential backoff | 🔴 HIGH | 🔲 Open |
| 7.3 | Server-side loop fetch scoping (hour + status) | 🟡 MEDIUM | 🔲 Open |
| 7.4 | Offline fallback loop | 🟡 MEDIUM | 🔲 Open |
| 7.5 | Content spec validation on asset upload | 🟡 MEDIUM | 🔲 Open |
| 7.6 | Approval status badges in `LoopManagement` grid | 🟢 LOW | 🔲 Open |
| 7.7 | Documentation updates (`changelog.md`, this file) | 🟢 LOW | 🔲 Open |
| 7.8 | Delete `PlaylistEditor.jsx` (dead code) | 🟢 LOW | 🔲 Open |
| V1–V5 | Security patches (`Player.jsx`, `TechOpsDashboard.jsx`) | 🟡 MEDIUM | 🔲 Open |

**Sprint-level composite outcome:** ~79%

---

### Sprint 8 — Campaign Handoff + Retailer Gating

**Status:** 📋 Planned  
**Duration estimate:** 3 days  
**Risk level:** 🟡 MEDIUM  
**Detail file:** [`sprint8.md`](./sprint8.md)

**Goal:** Close the campaign→validation workflow gap; add retailer content category exclusions; wire `LoopGenerationService` enforcement; replace mock data in `LoopAnalytics.jsx` with live Firestore aggregation.

See `sprint8.md` for full task detail.

---

### Sprint 9 — CRUD Completion & Form Bug Fix

**Status:** 📋 Planned  
**Duration estimate:** 4 days  
**Risk level:** 🟡 MEDIUM

**Goal:** Resolve 16 specific form/action bugs identified in `qa_notes_developer_v1.pdf` and `TASKS.md`. Forms that don't save, missing delete buttons, broken navigation, and unscoped data views across all dashboard routes.

**Affected routes (from QA notes):**
- `/dashboard/admin/advertisers` — edit form does not persist after LAN-20260527 (re-audit)
- `/dashboard/admin/retailers` — delete confirmation missing
- `/dashboard/admin/screens` — screen assignment to store broken
- `/dashboard/admin/stores` — business hours form does not save
- `/dashboard/brand/campaigns` — campaign edit wizard navigation broken
- `/dashboard/retailer/schedule` — schedule drag-and-drop does not persist
- `/dashboard/retailer/content` — content library shows all tenants' assets (scoping bug)

---

### Sprint 10 — Pre-Deploy Security Gate

**Status:** 📋 Planned  
**Duration estimate:** 2 days  
**Risk level:** 🔴 HIGH

**Goal:** Sign off on all open security items before production deploy gate.

**Tasks:**
- Patch high-severity XSS in `react-router` dependency (version audit required)
- Implement CSP headers in `cloudbuild.yaml` / Express middleware
- Accessibility (a11y) coverage pass — keyboard nav, ARIA, contrast audit
- `cloudbuild.yaml` production deploy sign-off
- Final Playwright E2E smoke suite passing on staging

---

## Open Cross-Sprint Risks

| ID | Severity | Description | Assigned Sprint |
|----|----------|-------------|----------------|
| R1 | 🔴 HIGH | `Player.jsx` re-registers every hour — screen ID churn | Sprint 7 (7.1) |
| R2 | 🔴 HIGH | Loop fetch returns full day dataset client-side — N×full-dataset at 100+ screens | Sprint 7 (7.3) |
| R3 | 🔴 HIGH | No retry in `initializePlayer` — one network blip = permanent dark screen | Sprint 7 (7.2) |
| R4 | 🟡 MEDIUM | `'APPROVED'` case-sensitivity mismatch between client and `LoopRepository` | Sprint 7 (7.3 FIXME) |
| R5 | 🟡 MEDIUM | Bulk-approve endpoint unconfirmed (FIXME in commit) — 404 not surfaced to retailer | Sprint 8 |
| R6 | 🟡 MEDIUM | `TechOpsDashboard.jsx` reads `user_id` from `localStorage` — fragile in sandboxed iframes | Sprint 7 (V5) |
| R7 | 🟢 LOW | `PlaylistEditor.jsx` — dead code, confirmed unrouted and unimported | Sprint 7 (7.8) |
| R8 | ✅ RESOLVED | `BaseRepository.update()` silent-catch — all edits appeared to succeed but weren't persisted | LAN-20260527 |

---

## File Inventory by Sprint

### Active / In-Sprint Files

| File | Sprint | Status |
|------|--------|--------|
| `client-app/src/pages/Player.jsx` | Sprint 7 | 🔄 Being edited |
| `server/routes/loops.js` | Sprint 7 | 🔄 Being edited |
| `client-app/src/pages/admin/LoopManagement.jsx` | Sprint 7 | 🔄 Being edited |
| `client-app/src/pages/admin/LoopBuilder.jsx` | Sprint 7 | 🔄 Read / possibly edit |
| `client-app/src/pages/admin/PlaylistEditor.jsx` | Sprint 7 | 🗑️ Scheduled deletion |
| `client-app/src/pages/admin/TechOpsDashboard.jsx` | Sprint 7 | 🔄 Security patch |
| `changelog.md` | Sprint 7 | 🔄 Being updated |

### Planned Sprint 8 Files

| File | Sprint | Operation |
|------|--------|-----------|
| `client-app/src/pages/brand/CampaignBuilder.jsx` | Sprint 8 | Edit — add `PENDING_VALIDATION` transition |
| `client-app/src/pages/admin/LoopAnalytics.jsx` | Sprint 8 | Edit — replace mock data with Firestore aggregation |
| `server/routes/campaigns.js` | Sprint 8 | Edit — campaign status endpoint |
| `ad-server/src/services/LoopGenerationService.js` | Sprint 8 | Edit — enforce category exclusions |
| `client-app/src/pages/retailer/RetailerDashboard.jsx` | Sprint 8 | Edit — validation queue UI |

---

## Definition of MVP Done

- [ ] All screens broadcast approved loops without manual intervention
- [ ] Player survives network failures and recovers automatically
- [ ] Campaign → validation → approval → broadcast flow fully gated
- [ ] Retailer can exclude content categories; exclusions enforced at loop generation
- [ ] All CRUD operations persist correctly (Sprint 9)
- [ ] Security sign-off: XSS patch, CSP headers, auth context (Sprint 10)
- [ ] `npm run build` exits zero errors
- [ ] Playwright E2E smoke suite passes on staging
- [ ] `changelog.md` current through deploy
