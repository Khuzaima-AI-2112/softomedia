# orphaned.md — Orphaned Files & Task Plans

> **Purpose**: Documents all files that exist on disk but have no active route, no import,
> and no navigation reference anywhere in the codebase (verified via code search 2026-05-27).
> Each entry includes what the file does and a task plan to either complete or retire it.
>
> Cross-reference: `screens.md` → Orphaned Files section | `wizardSteps.md` → wizard entry

---

## Status Legend

| Icon | Meaning |
|------|---------|
| 🔴 | Blocked — depends on a product/architecture decision before work can begin |
| 🟡 | In progress — component is mostly built, just needs wiring |
| 🟢 | Ready — no blockers, straightforward to complete |
| 🗑️ | Recommended for deletion |

---

## 1. `pages/admin/LoopAnalytics.jsx`
**Status**: 🟡 Mostly built — mock data needs replacing

### What it does
Admin dashboard showing hourly proof-of-play data for a selected date: loop completion counts,
integrity scores (95–100%), and a per-slot drill-down grid (12 slots × impressions).
Currently uses 100% mock data via `generateMockAnalytics()`.

### Task Plan
- [ ] Add route in `App.jsx`: `/dashboard/admin/loop-analytics` → `LoopAnalytics`
- [ ] Add nav link in Admin Overview / sidebar pointing to the new route
- [ ] Confirm backend endpoint `GET /api/analytics/loops?date=<date>` exists and returns
  `{ hour, loopCompletions, integrityScore, status }` — replace mock call with real `apiService` call
- [ ] Decide: should the slot-detail drill-down (click row → 12-slot grid) also pull real data
  or remain illustrative? Document the decision
- [ ] Decide: standalone page vs. tab inside Loop Management — update nav accordingly

---

## 2. `pages/admin/LoopBuilder.jsx`
**Status**: 🟢 Ready — fully built, just needs a route and entry point

### What it does
Detail editor for a single loop identified by `useParams().id`. Shows all 12 slots, lets an
admin assign/replace assets per slot via a modal asset picker, previews the 60-second timeline,
and approves the loop. Already uses real `apiService` calls (`getLoop`, `getAssets`,
`replaceLoopSlot`, `approveLoop`). Back button already targets `/dashboard/admin/loops`.

### Task Plan
- [ ] Add parameterised route in `App.jsx`: `/dashboard/admin/loops/:id` → `LoopBuilder`
- [ ] In `LoopManagement.jsx`, add an **Edit / Build** action button on each loop row that
  navigates to `/dashboard/admin/loops/<loop.id>`
- [ ] Verify `apiService.getLoop(id)`, `getAssets()`, `replaceLoopSlot()`, and `approveLoop()`
  all exist and return expected shapes against the live backend
- [ ] Smoke test: load a loop, replace a slot, approve — confirm round-trip works

---

## 3. `pages/admin/PlaylistManagement.jsx`
**Status**: 🔴 Blocked — product decision required + restyling needed

### What it does
Lists all playlists with Global / Assigned type filters, a delete action, and a New Playlist
button. Internal `navigate()` calls use the old `/admin/playlists/…` path convention (not
`/dashboard/admin/…`). Styled with hardcoded `bg-gray-800` / `text-white` dark-only classes
from an earlier build era — inconsistent with the current design system.

### Task Plan
- [ ] **Decision required**: Is the Playlist concept still live, or has it been superseded by
  the Loop-based model? Confirm with product before doing any work
- [ ] If keeping: update all `navigate('/admin/playlists/…')` calls →
  `navigate('/dashboard/admin/playlists/…')` to match current routing convention
- [ ] Add route in `App.jsx`: `/dashboard/admin/playlists` → `PlaylistManagement`
- [ ] Add route for editor (see `PlaylistEditor` below)
- [ ] Add nav link in Admin Overview / sidebar
- [ ] Restyle: replace hardcoded `bg-gray-*` / `text-white` classes with design system tokens
  (`GlassCard`, `StatusBadge`, `--color-*` variables) to match the rest of the admin UI

---

## 4. `pages/admin/PlaylistEditor.jsx`
**Status**: 🔴 Blocked — depends on PlaylistManagement decision + restyling needed

### What it does
Two-panel editor (available assets left, playlist sequence right) for creating or editing a
playlist. Supports file upload, per-item duration control, screen assignment by location,
and a Global playlist toggle (forces 5s duration). Navigates back to `/admin/playlists`
(old path). Same hardcoded dark-mode styling issue as `PlaylistManagement`.

### Task Plan
- [ ] **Blocked by PlaylistManagement decision** — only wire up if Playlists are confirmed live
- [ ] Add routes in `App.jsx`:
  - `/dashboard/admin/playlists/new` → `PlaylistEditor`
  - `/dashboard/admin/playlists/:id` → `PlaylistEditor`
- [ ] Update `navigate('/admin/playlists')` → `navigate('/dashboard/admin/playlists')`
- [ ] Verify all required `apiService` methods exist:
  `getPlaylists`, `getPlaylist(id)`, `createPlaylist`, `updatePlaylist`, `deletePlaylist`,
  `getAssets`, `getScreens`, `getLocations`, `uploadAsset`
- [ ] Restyle: same token migration as `PlaylistManagement`

---

## 5. `pages/retailer/ScheduleHistory.jsx`
**Status**: 🟢 Ready — closest to done of all orphaned files

### What it does
Retailer-facing history of loop approvals and slot rejections. Shows date/status filters,
a grouped schedule log (by date + hour), and a recent audit activity feed pulled from
`apiService.getAuditLogs()`. Fully built, real API calls, styled consistently with the app.
Currently auto-selects `retailers[0]` as the current retailer.

### Task Plan
- [ ] Add route in `App.jsx`: `/dashboard/retailer/schedule-history` → `ScheduleHistory`
- [ ] Add nav link in `RetailerDashboard.jsx` or retailer sidebar (e.g. "History" tab
  alongside the existing Schedule Calendar link)
- [ ] Confirm whether current-retailer should be scoped from auth context (`useAuth()`)
  rather than always using `retailers[0]` — fix if so
- [ ] "Export CSV" button is a placeholder with no handler — implement or add a `// TODO`
  comment before shipping

---

## 6. `pages/retailer/ScheduleManager.jsx`
**Status**: 🟡 Mostly built — two hardcoded values and one missing handler need attention

### What it does
Lets a retailer select a store location from a sidebar and preview the D-1 (next-day) hourly
loop for that location using the `LoopPreview` component. Hardcoded header shows
"08:00 - 09:00" and "Oct 12, 2023". Uses `localStorage.getItem('auth_token')` directly
instead of the auth context. "Bulk Approve All" button has no handler.

### Task Plan
- [ ] Add route in `App.jsx`: `/dashboard/retailer/schedule-manager` → `ScheduleManager`
- [ ] Add nav link in `RetailerDashboard.jsx` (e.g. "D-1 Preview" or "Validate Schedule")
- [ ] Replace `localStorage.getItem('auth_token')` with `useAuth()` hook — consistent with
  the rest of the app
- [ ] Wire the hardcoded hour/date header to real data: derive hour from current time or
  selected loop, and date from `today + 1` (D-1)
- [ ] Verify `LoopPreview` component exists and accepts `slots` prop as expected
- [ ] Implement "Bulk Approve All" handler or remove the button before wiring up

---

## 7. `pages/tech/TechOpsDashboard.jsx`
**Status**: 🟡 Mostly built — two unimplemented actions + Design Lab assets unverified

### What it does
Network-wide screen health overview: total / online / offline fleet stats (polled every 30s
from `GET /api/monitoring/status`), a Design Lab section linking to hamburger-menu experiment
HTML files (`/experiments/hamburger-variant-*.html`), and a searchable screen inventory table
with Restart and Terminal action buttons per screen. The search input and action buttons have
no handlers.

### Task Plan
- [ ] Add route in `App.jsx`: `/dashboard/techoperator` → `TechOpsDashboard`
  (alongside the existing `/dashboard/techoperator/health` → `Health`)
- [ ] Confirm `DashboardLayout` redirect correctly resolves `techoperator` persona to
  `/dashboard/techoperator` (currently redirects to `/dashboard/<persona>`)
- [ ] Verify the Design Lab experiment files exist at
  `public/experiments/hamburger-variant-a.html`, `…-b.html`, `…-c.html`, and
  `hamburger-index.html` — if missing, hide or remove the Design Lab section
- [ ] Wire the screen ID search input to filter `stats.screens` client-side
- [ ] Implement Restart button handler (confirm dialog → POST to a restart endpoint)
  or stub it with a toast ("Restart requested") until the backend endpoint exists
- [ ] Terminal button: define expected behaviour (open SSH session? navigate to a log view?)
  and implement or stub accordingly

---

## 8. `pages/brand/wizard/Step3ReviewDistribution.jsx`
**Status**: 🗑️ Recommended for deletion — superseded by active wizard steps

### What it does
An older draft of the wizard's Step 3. Shows a 1-hour loop visualisation bar, impact
projection cards (frequency, daily loops, impressions), and a configuration summary table
with a "Confirm Distribution" button that POSTs directly to `POST /api/campaigns`.
Its responsibilities are now split between the active `Step3LoopSlotSelection.jsx` (slot
selection) and `Step5ReviewConfirm.jsx` (review + submission).

### Task Plan
- [ ] Compare the `POST /api/campaigns` payload in this file's `createCampaign()` against
  `BrandCampaignWizard.jsx`'s `handleConfirm()` — confirm no unique fields are missing
  from the active wizard before deleting
- [ ] If the loop visualisation bar (12-slot alternating diagram) is worth keeping, extract
  it as a standalone reusable component and reference it from Step 5
- [ ] Delete this file once the above are confirmed safe
- [ ] Remove the corresponding entry from `screens.md` and this file's entry from `orphaned.md`

---

*Last updated: 2026-05-27 — initial task plans derived from full file read + code search*
