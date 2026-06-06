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
| `./pages/admin/CPMCalendar` | `client-app/src/pages/admin/CPMCalendar.jsx` | ✅ (served at `/dashboard/admin/pricing`) |
| `./pages/brand/BrandDashboard` | `client-app/src/pages/brand/BrandDashboard.jsx` | ✅ |
| `./pages/brand/BrandCampaignWizard` | `client-app/src/pages/brand/BrandCampaignWizard.jsx` | ✅ |
| `./pages/retailer/RetailerDashboard` | `client-app/src/pages/retailer/RetailerDashboard.jsx` | ✅ |
| `./pages/retailer/ScheduleCalendar` | `client-app/src/pages/retailer/ScheduleCalendar.jsx` | ✅ |
| `./pages/tickets/TicketDashboard` | ❌ does not exist as a page | **OMIT** — see Backlog #1 |
| `./pages/tickets/TicketDetail` | ❌ does not exist as a page | **OMIT** — see Backlog #1 |
| `./pages/retailer/Loops` | ❌ does not exist | **OMIT** |

---

## Wiring Audit Backlog — 2026-05-26

Found during audit on 2026-05-26. None of these are build-breakers
(no missing imports). They are silent dead-ends or broken UX flows
that need to be fixed in a future sprint.

### 🔴 C1 — Ticket pages exist as components but have no routes

**Severity:** Critical — testers will 404 on QA checklist items 6.14–6.15

`TicketDashboard.jsx` and `TicketDetail.jsx` exist at:
- `client-app/src/components/TicketDashboard.jsx`
- `client-app/src/components/TicketDetail.jsx`

They are built components, not page stubs. However they live in `components/`
not `pages/`, and `App.jsx` has no routes for `/dashboard/tickets` or
`/dashboard/tickets/:id`. `SupportTicketModal.jsx` submits tickets but there
is nowhere to view them.

**Fix:** Move both files to `pages/tickets/`, add routes in `App.jsx`:
```jsx
const TicketDashboard = lazy(() => import('./pages/tickets/TicketDashboard'));
const TicketDetail    = lazy(() => import('./pages/tickets/TicketDetail'));
// ...
<Route path="tickets"     element={<TicketDashboard />} />
<Route path="tickets/:id" element={<TicketDetail />} />
```

---

### 🔴 C2 — Three admin pages exist on disk but have no routes

**Severity:** Critical — completely unreachable, no nav link reaches them

The following files exist in `pages/admin/` but are not routed in `App.jsx`
and have no nav link anywhere in the UI:

| File | Natural route |
|---|---|
| `pages/admin/LoopAnalytics.jsx` | `/dashboard/admin/analytics` |
| `pages/admin/PlaylistEditor.jsx` | `/dashboard/admin/playlists/:id/edit` |
| `pages/admin/PlaylistManagement.jsx` | `/dashboard/admin/playlists` |

**Fix:** Add routes in `App.jsx` and add tiles/nav links in `Overview.jsx`
or `HamburgerMenu.jsx` as appropriate. Do not add the routes until you
have confirmed the pages are in a shippable state (per Rule 2).

---

### 🔴 C3 — Persona switcher always redirects to `/dashboard/admin`

**Severity:** Critical — Brand and Retailer users land on the wrong dashboard

In `HamburgerMenu.jsx`, `switchPersona()` always calls:
```js
navigate('/dashboard/admin');
```
This means switching to a Brand or Retailer persona dumps the user
into the Admin overview instead of their own dashboard.

**Fix:** Route by role:
```js
const destination = {
    super_admin: '/dashboard/admin',
    admin:       '/dashboard/admin',
    brand:       '/dashboard/brand',
    retailer:    '/dashboard/retailer',
};
navigate(destination[swatch.role] ?? '/dashboard/admin');
```

---

### 🟡 M1 — LoopBuilder.jsx exists on disk with no route or nav link

**Severity:** Medium — dead code, no user can reach it

`pages/admin/LoopBuilder.jsx` exists but has no route in `App.jsx`
and no tile or link anywhere. Either wire it up or delete it to
avoid confusion.

**Natural route:** `/dashboard/admin/loops/builder` or as a modal
launched from `LoopManagement.jsx`.

---

### 🟡 M2 — Retailer users have no nav link to their Schedule page

**Severity:** Medium — Retailer users can only reach `/dashboard/retailer/schedule`
if they know the URL directly. `HamburgerMenu.jsx` has no nav item for it.

**Fix:** Add to `navItems` in `HamburgerMenu.jsx` conditionally:
```js
...(user?.role === 'retailer' ? [
    { label: 'My Schedule', path: '/dashboard/retailer/schedule', icon: 'calendar_month' }
] : []),
```

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
- ✅ CPMCalendar wired to `/dashboard/admin/pricing` (2026-05-26)

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
