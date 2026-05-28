# screens.md — Screen Inventory

> **Purpose**: Master inventory of all screens in `client-app` for screenshot capture.
> Derived from `client-app/src/App.jsx` (route table) and the full `pages/` directory tree.
> Screens are grouped by persona/role. Each entry includes the URL path, source file, and a `Screenshot` column to be filled in.

---

## How to Use

1. Boot both servers per `/starttesting`.
2. Capture each screen at the URL listed below (logged in as the appropriate persona).
3. Save screenshots to `screenshots/<slug>.png` and update the **Screenshot** column.

---

## Public / Standalone Screens

| # | Screen | URL | Source File | Screenshot |
|---|--------|-----|-------------|------------|
| 1 | Login | `/login` | `pages/Login.jsx` | |
| 2 | Player | `/player` | `pages/Player.jsx` | |
| 3 | Loop Demo Player | `/player/demo` | `pages/LoopDemoPlayer.jsx` | |
| 4 | Not Found (404) | `/any-invalid-path` | `pages/NotFound.jsx` | |

---

## Admin Screens (`/dashboard/admin/…`)

| # | Screen | URL | Source File | Screenshot |
|---|--------|-----|-------------|------------|
| 5 | Admin Overview | `/dashboard/admin` | `pages/admin/Overview.jsx` | |
| 6 | Retailer Management | `/dashboard/admin/retailers` | `pages/admin/RetailerManagement.jsx` | |
| 7 | Advertiser Management | `/dashboard/admin/advertisers` | `pages/admin/AdvertiserManagement.jsx` | |
| 8 | Screen Management | `/dashboard/admin/screens` | `pages/admin/ScreenManagement.jsx` | |
| 9 | Loop Management | `/dashboard/admin/loops` | `pages/admin/LoopManagement.jsx` | |
| 10 | User Management | `/dashboard/admin/users` | `pages/admin/UserManagement.jsx` | |
| 11 | Business Hours Management | `/dashboard/admin/hours` | `pages/admin/BusinessHoursManagement.jsx` | |
| 12 | Network Map | `/dashboard/admin/map` | `pages/admin/NetworkMap.jsx` | |
| 13 | AI Log | `/dashboard/admin/ai-log` | `pages/admin/AILog.jsx` | |
| 14 | CPM Pricing Calendar | `/dashboard/admin/pricing` | `pages/admin/CPMCalendar.jsx` | |

---

## Brand Screens (`/dashboard/brand/…`)

| # | Screen | URL | Source File | Screenshot |
|---|--------|-----|-------------|------------|
| 15 | Brand Dashboard | `/dashboard/brand` | `pages/brand/BrandDashboard.jsx` | |
| 16 | Campaign Wizard | `/dashboard/brand/campaign/new` | `pages/brand/BrandCampaignWizard.jsx` | See `wizardSteps.md` for per-step screenshots |

---

## Retailer Screens (`/dashboard/retailer/…`)

| # | Screen | URL | Source File | Screenshot |
|---|--------|-----|-------------|------------|
| 17 | Retailer Dashboard | `/dashboard/retailer` | `pages/retailer/RetailerDashboard.jsx` | |
| 18 | Schedule Calendar | `/dashboard/retailer/schedule` | `pages/retailer/ScheduleCalendar.jsx` | |

---

## Tech Operator Screens (`/dashboard/techoperator/…`)

| # | Screen | URL | Source File | Screenshot |
|---|--------|-----|-------------|------------|
| 19 | Health Check | `/dashboard/techoperator/health` | `pages/Health.jsx` | |

---

## Orphaned Files (On Disk, Zero References)

The following files exist in `pages/` but have **no route, no import, and no navigation reference anywhere in the codebase** (verified via code search 2026-05-27). They are dead files until explicitly wired up.

| File | Status |
|------|--------|
| `pages/admin/LoopAnalytics.jsx` | 🚫 Orphaned — no route, no import |
| `pages/admin/LoopBuilder.jsx` | 🚫 Orphaned — no route, no import |
| `pages/admin/PlaylistManagement.jsx` | 🚫 Orphaned — no route, no import |
| `pages/admin/PlaylistEditor.jsx` | 🚫 Orphaned — no route, no import |
| `pages/retailer/ScheduleHistory.jsx` | 🚫 Orphaned — no route, no import |
| `pages/retailer/ScheduleManager.jsx` | 🚫 Orphaned — no route, no import |
| `pages/tech/TechOpsDashboard.jsx` | 🚫 Orphaned — no route, no import, no references at all |
| `pages/brand/wizard/Step3ReviewDistribution.jsx` | 🚫 Orphaned — exists on disk but NOT imported by `BrandCampaignWizard.jsx` (see `wizardSteps.md`) |

---

## Omitted (Not on Disk)

These routes were intentionally removed from `App.jsx` because the files do not exist.

| File | Reason |
|------|--------|
| `pages/tickets/TicketDashboard.jsx` | ❌ Not on disk |
| `pages/tickets/TicketDetail.jsx` | ❌ Not on disk |
| `pages/retailer/Loops.jsx` | ❌ Not on disk |

---

*Last updated: 2026-05-27 — orphaned files section corrected after code search; TechOpsDashboard confirmed unrouted with zero references*
