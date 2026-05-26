# Recovery Reference & Build-Break Prevention Plan

This file exists because `App.jsx` has broken the production build
multiple times by importing files that do not exist on disk.
Read this before touching `App.jsx` or adding new routes.

---

## The Root Cause (Why This Keeps Happening)

Vite / Rollup resolves all `import()` paths **at build time**.
If the file does not exist, the build fails with:
```
Could not resolve "./pages/Foo" from "src/App.jsx"
```
This error only surfaces in the **production Docker build** (Cloud Build),
not in local `npm run dev`, because dev mode does lazy resolution.
So a developer can run the app locally, push, and break CI without
ever seeing an error on their machine.

---

## The Prevention Plan (Permanent Fix)

### Rule 1 — App.jsx is the source of truth, not assumptions

Every `lazy(() => import(...))` in `App.jsx` must be verified
against the actual file tree before committing.
The header comment block at the top of `App.jsx` lists every import
with a ✅ / ❌ status. Keep it updated.

### Rule 2 — Add a route only when the file exists

Do NOT add a `<Route>` as a placeholder for a page you plan to build later.
Add the route in the **same commit** that creates the page file.
If the page is not built yet, the route simply does not exist yet.

### Rule 3 — Verify before every push to main

Before pushing any change to `App.jsx`, run this one-liner from
`client-app/` to check that every import resolves:

```bash
grep -oP "import\('([^']+)'\)" src/App.jsx | \
  grep -oP "'([^']+)'" | tr -d "'" | \
  while read p; do
    f="src/${p#./}.jsx"
    [ -f "$f" ] || echo "MISSING: $f"
  done
```

If it prints nothing, all imports are safe to push.
If it prints `MISSING: ...`, remove or comment out that route.

### Rule 4 — The file map table below is canonical

When in doubt, this table says what exists on disk.
Update it whenever a new page file is created or deleted.

| Import path in App.jsx | File on disk | Status |
|---|---|---|
| `./layouts/DashboardLayout` | `client-app/src/layouts/DashboardLayout.jsx` | ✅ |
| `./pages/Login` | `client-app/src/pages/Login.jsx` | ✅ |
| `./pages/Player` | `client-app/src/pages/Player.jsx` | ✅ |
| `./pages/LoopDemoPlayer` | `client-app/src/pages/LoopDemoPlayer.jsx` | ✅ |
| `./pages/NotFound` | `client-app/src/pages/NotFound.jsx` | ✅ |
| `./pages/Health` | `client-app/src/pages/Health.jsx` | ✅ |
| `./pages/admin/Overview` | `client-app/src/pages/admin/Overview.jsx` | ✅ |
| `./pages/admin/RetailerManagement` | `client-app/src/pages/admin/RetailerManagement.jsx` | ✅ |
| `./pages/admin/AdvertiserManagement` | `client-app/src/pages/admin/AdvertiserManagement.jsx` | ✅ |
| `./pages/admin/ScreenManagement` | `client-app/src/pages/admin/ScreenManagement.jsx` | ✅ |
| `./pages/admin/LoopManagement` | `client-app/src/pages/admin/LoopManagement.jsx` | ✅ |
| `./pages/admin/UserManagement` | `client-app/src/pages/admin/UserManagement.jsx` | ✅ |
| `./pages/admin/BusinessHoursManagement` | `client-app/src/pages/admin/BusinessHoursManagement.jsx` | ✅ |
| `./pages/admin/NetworkMap` | `client-app/src/pages/admin/NetworkMap.jsx` | ✅ |
| `./pages/admin/AILog` | `client-app/src/pages/admin/AILog.jsx` | ✅ |
| `./pages/brand/BrandDashboard` | `client-app/src/pages/brand/BrandDashboard.jsx` | ✅ |
| `./pages/brand/BrandCampaignWizard` | `client-app/src/pages/brand/BrandCampaignWizard.jsx` | ✅ |
| `./pages/retailer/RetailerDashboard` | `client-app/src/pages/retailer/RetailerDashboard.jsx` | ✅ |
| `./pages/retailer/ScheduleCalendar` | `client-app/src/pages/retailer/ScheduleCalendar.jsx` | ✅ |
| `./pages/tickets/TicketDashboard` | ❌ does not exist | **OMIT** |
| `./pages/tickets/TicketDetail` | ❌ does not exist | **OMIT** |
| `./pages/admin/PricingManagement` | ❌ does not exist | **OMIT** |
| `./pages/retailer/Loops` | ❌ does not exist | **OMIT** |

---

## Last Known Good State — Sprint 7 Complete

| Field | Value |
|---|---|
| **Commit SHA** | `5faffc72e44b60d5be829519505c3ba12526026d` |
| **Date** | 2026-05-25 · 7:40 PM EDT (19:40:38 UTC) |
| **Commit message** | `feat: Sprint 7 — network error banner, 404 page, business hours error UI, campaign review fixes, HamburgerMenu cleanup` |
| **GitHub link** | https://github.com/cfroszte/softomedia-live2026/commit/5faffc72e44b60d5be829519505c3ba12526026d |

### What was working at this commit

- ✅ NetworkErrorBanner — global wifi_off banner, auto-dismisses on reconnect
- ✅ NotFound.jsx — 404 page with broken_route log to `/api/ai-log`
- ✅ BusinessHoursManagement — load errors surfaced to UI
- ✅ Step5ReviewConfirm — UTC date parsing fixed, React state for terms checkbox
- ✅ HamburgerMenu — broken Settings link removed
- ✅ Screens page gated to `super_admin` role only
- ✅ All admin/brand/retailer routes wired in App.jsx

### Known issue at this commit

`App.jsx` imported `'./pages/Dashboard'` which does not exist.
The actual layout shell is at `'./layouts/DashboardLayout'`.
This caused a fatal production build failure. The fix is one line.

### Recovery procedure

```bash
git fetch origin
git checkout 5faffc72e44b60d5be829519505c3ba12526026d
# Fix App.jsx line 9:
# FROM: lazy(() => import('./pages/Dashboard'))
# TO:   lazy(() => import('./layouts/DashboardLayout'))
git checkout -b recovery/sprint-7-stable
git add client-app/src/App.jsx
git commit -m "fix: restore Sprint 7 baseline + correct Dashboard import path"
git push origin recovery/sprint-7-stable
# Open PR into main
```

---

## Build-Break History

| Date | Commit | What broke | Root cause |
|---|---|---|---|
| 2026-05-26 ~01:28 | `616e04c` | Build passed but wiped most routes | Over-aggressive cleanup removed valid routes alongside broken ones |
| 2026-05-26 ~01:18 | `bf109f8` | Build still failed | Wrong layout path not yet fixed |
| 2026-05-25 ~19:40 | `5faffc7` | Production build failed | `import('./pages/Dashboard')` — file does not exist |
| 2026-05-16 ~19:46 | reset | All import paths broken | "New main release" reset overwrote working App.jsx with placeholder paths |
