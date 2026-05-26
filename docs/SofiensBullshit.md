# Recovery Reference — Known Good Commits

This file documents verified stable commits so we can recover quickly
without digging through history.

---

## Last Known Good State — Sprint 7 Complete

| Field | Value |
|---|---|
| **Commit SHA** | `5faffc72e44b60d5be829519505c3ba12526026d` |
| **Date** | 2026-05-25 · 7:40 PM EDT (19:40:38 UTC) |
| **Branch at time** | `main` |
| **Commit message** | `feat: Sprint 7 — network error banner, 404 page, business hours error UI, campaign review fixes, HamburgerMenu cleanup` |
| **GitHub link** | https://github.com/cfroszte/softomedia-live2026/commit/5faffc72e44b60d5be829519505c3ba12526026d |

### What was working at this commit

- ✅ NetworkErrorBanner — global wifi_off banner on `api:network-error` event, auto-dismisses on reconnect
- ✅ NotFound.jsx — 404 page with fire-and-forget broken_route log to `/api/ai-log`
- ✅ BusinessHoursManagement — load errors surfaced to UI (T5)
- ✅ Step5ReviewConfirm — UTC date parsing fixed, React state for terms checkbox (T4)
- ✅ HamburgerMenu — broken Settings link removed
- ✅ Screens page gated to `super_admin` role only (quick-action grid in Overview.jsx)
- ✅ All admin/brand/retailer routes wired in App.jsx
- ✅ App renders NetworkErrorBanner outside `<Suspense>`

### Known issue at this commit (why it failed to build)

`App.jsx` imported the dashboard layout shell as:
```js
const Dashboard = lazy(() => import('./pages/Dashboard'));
```
The file **does not exist at that path**. The actual file is:
```
client-app/src/layouts/DashboardLayout.jsx
```
This caused a fatal Vite production build error:
```
Could not resolve "./pages/Dashboard" from "src/App.jsx"
```
The fix is one line — change the import to:
```js
const Dashboard = lazy(() => import('./layouts/DashboardLayout'));
```

---

## How to recover to this state

If `main` ever gets into a bad state and you need to return to Sprint 7
as the baseline, run the following from your local clone:

```bash
# 1. Check out the known-good commit
git fetch origin
git checkout 5faffc72e44b60d5be829519505c3ba12526026d

# 2. Apply the single build fix
# Edit client-app/src/App.jsx line 9:
#   FROM: const Dashboard = lazy(() => import('./pages/Dashboard'));
#   TO:   const Dashboard = lazy(() => import('./layouts/DashboardLayout'));

# 3. Commit and push
git checkout -b recovery/sprint-7-stable
git add client-app/src/App.jsx
git commit -m "fix: restore Sprint 7 baseline + correct Dashboard import path"
git push origin recovery/sprint-7-stable
# Then open a PR into main
```

---

## Other notable commits

| Commit | Date | Notes |
|---|---|---|
| `543f46c` | 2026-05-25 19:06 UTC | Sprint 7 PR merge — Screens super_admin gate, 404 catch-all |
| `10cf2ba` | 2026-05-16 19:46 UTC | ⚠️ "new main release" reset — overwrote wired App.jsx with broken import paths |
| `5c680924` | 2026-05-12 23:53 UTC | Sprint 4 — TicketDashboard + TicketDetail added (branch: `sprint-4-ticket-support-system`) |
| `d690578` | 2026-05-12 22:36 UTC | All 20 routes wired + role-aware sidebar (good reference for route table) |
| `887406b` | 2025-12-31 02:07 UTC | Initial commit |
