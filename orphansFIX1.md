# Sprint Plan: LoopAnalytics.jsx — Admin Loop Analytics Fix

**File:** `client-app/src/pages/admin/LoopAnalytics.jsx`
**Scope:** MVP hardening — prototype cleanup, navigation, data layer, CSV export
**Status:** Ready to implement

---

## Files Touched

| File | Tasks | Edit Type |
|------|-------|-----------|
| `client-app/src/pages/admin/LoopAnalytics.jsx` | 1.1, 1.2, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 6.1, 6.2, 7.1, 7.2 | Primary — substantive changes |
| `client-app/src/App.jsx` | 2.1 | Routing — lazy import + `<Route>` + verified-file map comment |
| `client-app/src/layouts/DashboardLayout.jsx` | 2.2 | Nav — one `ADMIN_NAV` array entry |
| `client-app/src/components/GlassCard.jsx` | 7.2 | Audit only — edit if brand-facing props found |
| `client-app/src/components/StatusBadge.jsx` | 7.2 | Audit only — edit if brand-facing props found |
| `tests/**` *(grep-gated)* | 3.1 | Update `data-testid` refs only if `grep -r "partial-delivery-count" tests/` returns hits |

---

## Sprint Goal

Ship `LoopAnalytics.jsx` as a production-grade, standalone admin tool. Replace mock data with a real (or gracefully degraded) API, add a summary table as the primary view, add CSV export, and wire the page into admin navigation as a first-class entry.

---

## Risk Notes — What Lowers Probability & How to Fix It

Four tasks had meaningful risk identified during review. Mitigations are embedded in the task details below and summarised here:

| Task | Original % | Risk | Mitigation | Target % |
|------|:----------:|------|------------|:--------:|
| 3.1 | 95% | `data-testid` rename breaks existing tests | Grep tests before renaming; update all references atomically | 99% |
| 4.1 | 85% | Table responsive layout, tabular-nums, design-system alignment | Follow existing `GlassCard` + Tailwind patterns from `LoopManagement.jsx`; use `overflow-x-auto` wrapper | 95% |
| 4.2 | 75% | Backend may only support single-day queries; 7-day view needs multi-day data | Decouple: fire 7 individual single-day calls via `Promise.allSettled` — works regardless of backend range support | 90% |
| 6.1 | 70% | `/api/analytics/loops` endpoint not confirmed to exist | Grep `ad-server` first; if missing, file a backend task and ship 6.2 (graceful degradation) as the launch state | 90% |

---

## Epic 1 — Cleanup & De-prototyping

> Remove all signals that this page is temporary or work-in-progress.

### Task 1.1 — Strip prototype-marker comments
- **Probability:** 99%
- **What:** Remove all `🔶` orange-flag inline comments from the file
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:** No `🔶` characters remain anywhere in the file
- **Effort:** XS

### Task 1.2 — Delete `generateMockAnalytics`
- **Probability:** 99%
- **What:** Delete the entire `generateMockAnalytics` function and all call sites
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:** The function and its invocation inside `fetchAnalytics` are gone; no mock data is generated at runtime
- **Effort:** XS
- **Note:** Graceful degradation (Task 6.2) covers the gap when the backend is not ready

---

## Epic 2 — Navigation & Routing

> Make Loop Analytics a first-class page in the admin experience.

### Task 2.1 — Register route in `App.jsx`
- **Probability:** 97% → **99%** with mitigation
- **What:** Add a `lazy` import for `LoopAnalytics` and a `<Route>` entry for `admin/loop-analytics` inside the dashboard `<Route>` block. Follow the verified-file checklist convention already in `App.jsx` — add `pages/admin/LoopAnalytics.jsx ✅` to the comment block at the top of the file.
- **Files:** `client-app/src/App.jsx`
- **Acceptance:** Navigating to `/dashboard/admin/loop-analytics` renders the page without a 404 or redirect; the file is listed in the verified-file map comment
- **Effort:** XS
- **Risk mitigation:** The only prior failure mode here (per `App.jsx` comment block) is adding a route without a corresponding file on disk. Since the file already exists, this risk is eliminated.

### Task 2.2 — Add sidebar nav entry
- **Probability:** 98% → **99%** with mitigation
- **What:** Append to the `ADMIN_NAV` array in `DashboardLayout.jsx`: `{ to: '/dashboard/admin/loop-analytics', icon: 'analytics', label: 'Loop Analytics' }`. Position it after the `Loops` entry.
- **Files:** `client-app/src/layouts/DashboardLayout.jsx`
- **Acceptance:**
  - Entry appears at top level — not nested inside Loop Management
  - Label reads "Loop Analytics"
  - Icon is `analytics` (Material Symbols)
  - Active state highlights correctly when on `/dashboard/admin/loop-analytics`
- **Effort:** XS (one array entry)
- **Risk mitigation:** `ADMIN_NAV` is a plain JS array of `{to, icon, label}` objects — the pattern is identical to all existing entries. Zero new logic required.

---

## Epic 3 — KPI Cards

> Align the four summary cards with MVP-required metrics only.

### Task 3.1 — Rename "Partial Delivery" to "Slot Failures"
- **Probability:** 95% → **99%** with mitigation
- **What:** Update the card label, `data-testid`, and subtitle copy. Ensure the count represents actual slot-level failures (not just partial hours).
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:**
  - Card header reads "Slot Failures"
  - `data-testid` updated to `slot-failures-count`
  - Value reflects slot failures when real data is available
- **Effort:** XS
- **Risk mitigation:** Before renaming, grep the test suite for `partial-delivery-count`:
  ```
  grep -r "partial-delivery-count" tests/
  ```
  Update all matching test references in the same PR atomically. Do not rename the `data-testid` without updating tests in the same commit.

### Task 3.2 — Remove colored left borders from KPI cards
- **Probability:** 99%
- **What:** Remove `border-l-4 border-l-*` Tailwind classes from all four `GlassCard` KPI wrappers. Rely on surface elevation and the card's existing border for visual separation.
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:** No colored left border appears on any KPI card in light or dark mode
- **Effort:** XS

### Task 3.3 — Remove impressions from slot detail cards
- **Probability:** 97%
- **What:** Remove the `impressions` variable, its display value, and the "impressions" label from the slot detail grid cards. Cards show played/not-played state only (✓ / ✗).
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:** Slot detail cards render without any impressions count or label
- **Effort:** XS

---

## Epic 4 — Summary Table (Primary Data View)

> Replace the hourly progress-bar chart as the primary visualization with a scannable summary table.

### Task 4.1 — Build summary table component
- **Probability:** 85% → **95%** with mitigation
- **What:** Add a summary table above the hourly chart. Columns: **Time | Loop Completions | Integrity Score | Slot Failures | Status**. Each row maps to one business hour (8 AM–10 PM).
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:**
  - Table renders for all business hours in the `analytics` state
  - Columns: Time, Loop Completions, Integrity Score (%), Slot Failures, Status badge
  - Numbers use `font-variant-numeric: tabular-nums` (Tailwind: `tabular-nums`) for alignment
  - Table is wrapped in `overflow-x-auto` for mobile horizontal scroll
  - `data-testid="loop-analytics-summary-table"` on the `<table>` element
- **Effort:** M
- **Risk mitigation:** Reference the existing table pattern from `RetailerManagement.jsx` or `UserManagement.jsx` for the `<table>` / `<thead>` / `<tbody>` structure and Tailwind classes already used in the project — do not invent new patterns. Use `StatusBadge` (already imported) for the Status column.

### Task 4.2 — Wire 7-day default view to table
- **Probability:** 75% → **90%** with mitigation
- **What:** On initial page load, the summary table shows daily aggregate rows for the last 7 days. When the user picks a specific date via the date picker, the table switches to that day's hourly breakdown.
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:**
  - Initial load: 7 rows, one per day (last 7 days including today), with daily aggregate values (total loop completions, avg integrity score, total slot failures, overall status)
  - Date picker selection: table switches to hourly rows for the selected date
  - Default `targetDate` state initialises to today (existing behaviour preserved)
- **Effort:** M
- **Risk mitigation:** Do not depend on the backend supporting a date-range parameter. On initial load, fire 7 calls to `/api/analytics/loops?date=YYYY-MM-DD` (one per day) using `Promise.allSettled` via `apiClient.get()` — this works with the existing single-day endpoint regardless of backend range support. Aggregate client-side. If individual calls fail, show `—` for that day's row rather than blocking the whole view.

### Task 4.3 — Demote progress-bar hourly chart
- **Probability:** 99%
- **What:** Move the `GlassCard` containing the hourly progress-bar visualization below the summary table. It becomes a secondary/supplementary view.
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:** Summary table appears first in the page flow; progress-bar chart renders beneath it
- **Effort:** XS

### Task 4.4 — Add "Slot data syncing" placeholder to drill-down grid
- **Probability:** 95%
- **What:** Replace the `Math.random()` slot data in the `selectedHour` detail panel with a static placeholder state. Each slot card shows "Syncing…" in a visually neutral style (no green/red) until real slot data is available.
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:**
  - Slot cards do not use `Math.random()` for any value
  - Panel body shows "Slot data syncing — available shortly" notice
  - Panel still opens/closes correctly when an hour row is clicked
- **Effort:** S

---

## Epic 5 — CSV Export

> Give internal ops a one-click path to spreadsheet-ready data.

### Task 5.1 — Add "Export CSV" button to header toolbar
- **Probability:** 97%
- **What:** Add an "Export CSV" button in the header toolbar, adjacent to the Refresh button. Use a `download` Material Symbol icon.
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:**
  - Button renders in the header toolbar next to Refresh
  - Button is disabled (greyed out) when `analytics` state is empty or `loading` is true
  - `data-testid="export-csv-btn"` on the button
- **Effort:** S

### Task 5.2 — Implement CSV serialization and download
- **Probability:** 93%
- **What:** On button click, serialize the current `analytics` state to a CSV string with headers: `Time,Loop Completions,Integrity Score,Slot Failures,Status`. Trigger a client-side Blob download. Filename: `loop-analytics-YYYY-MM-DD.csv`.
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:**
  - Clicking the button downloads a `.csv` file immediately — no server call
  - File opens correctly in Excel / Google Sheets
  - Filename includes the currently selected `targetDate`
  - No PDF export — CSV only
  - Values containing commas are quoted
- **Effort:** S

---

## Epic 6 — API Integration & Graceful Degradation

> Activate the real data layer; handle backend unavailability without blocking the UI.

### Task 6.1 — Verify endpoint and activate real API call
- **Probability:** 70% → **90%** with mitigation
- **What:** Verify the endpoint exists in `ad-server`, then uncomment and activate the fetch call inside `fetchAnalytics`. Switch from raw `fetch` to `apiClient.get()` from `client-app/src/services/api.js` to get auth headers (`Authorization`, `x-demo-role`), retry logic, and timeout handling automatically via the existing interceptor.
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:**
  - `apiClient.get('/api/analytics/loops', ...)` fires on mount and on date change
  - Auth token and `x-demo-role` headers sent automatically
  - Response data populates `analytics` state
- **Effort:** S
- **Risk mitigation:** **Before writing a line of code**, run:
  ```
  grep -r "analytics/loops" ad-server/
  ```
  If the endpoint does not exist, do **not** activate this task — file a backend task and ship with Task 6.2 as the production state at launch. Confirming existence first reduces implementation risk to near-zero.

### Task 6.2 — Implement graceful degradation on API failure
- **Probability:** 92%
- **What:** In the `catch` block of `fetchAnalytics`, set `apiUnavailable = true` (new boolean state). Render a full-width informational row inside the table body: _"Data syncing — available shortly"_. This is a neutral holding state, not an error.
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:**
  - API failure shows the full page shell (header, KPI cards at `—`, table container)
  - Table body shows the syncing notice row — no spinner, no error colour
  - Existing empty-state UI is preserved for successful calls that return an empty array
  - `apiUnavailable` resets to `false` on a successful re-fetch
  - This task is **independent of Task 6.1** — implement and ship regardless of backend readiness
- **Effort:** S

---

## Epic 7 — Copy & Audience Alignment

> Align all visible text to internal ops language; remove customer-facing copy.

### Task 7.1 — Rewrite page subtitle
- **Probability:** 99%
- **What:** Change the subtitle from `"Playlist integrity monitoring and cycle verification"` to `"Internal delivery monitoring for loop completion and integrity"`
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:** No customer-report or sales-demo language in any visible UI copy
- **Effort:** XS

### Task 7.2 — Audit and remove brand-facing affordances
- **Probability:** 90%
- **What:** Review the full rendered page — including `GlassCard` and `StatusBadge` sub-components — for any UI element implying a brand-facing or customer-visible mode. Remove any such elements.
- **Files:** `LoopAnalytics.jsx`, `GlassCard.jsx`, `StatusBadge.jsx`
- **Acceptance:** Page contains no brand-facing affordances; all content is ops-grade internal data
- **Effort:** XS

---

## Task Summary

| # | Task | Effort | Original % | Target % | Key Mitigation |
|---|------|--------|:----------:|:--------:|----------------|
| 1.1 | Strip `🔶` comments | XS | 99% | 99% | — |
| 1.2 | Delete `generateMockAnalytics` | XS | 99% | 99% | — |
| 2.1 | Register route in `App.jsx` | XS | 97% | 99% | Add to verified-file map comment |
| 2.2 | Add sidebar nav entry | XS | 98% | 99% | Plain array append, no new logic |
| 3.1 | Rename "Partial Delivery" → "Slot Failures" | XS | 95% | 99% | Grep + update tests atomically |
| 3.2 | Remove colored left borders | XS | 99% | 99% | — |
| 3.3 | Remove impressions from slot cards | XS | 97% | 97% | — |
| 4.1 | Build summary table | M | 85% | 95% | Copy table pattern from existing admin pages |
| 4.2 | Wire 7-day default view | M | 75% | 90% | `Promise.allSettled` over 7 single-day calls |
| 4.3 | Demote progress-bar chart | XS | 99% | 99% | — |
| 4.4 | Slot syncing placeholder | S | 95% | 95% | — |
| 5.1 | Add "Export CSV" button | S | 97% | 97% | — |
| 5.2 | CSV serialization & download | S | 93% | 93% | Quote values with commas |
| 6.1 | Activate real API call | S | 70% | 90% | Grep `ad-server` first; use `apiClient.get()` |
| 6.2 | Graceful degradation on API failure | S | 92% | 92% | Independent of 6.1 — ship regardless |
| 7.1 | Rewrite page subtitle | XS | 99% | 99% | — |
| 7.2 | Audit brand-facing affordances | XS | 90% | 90% | Check `GlassCard` + `StatusBadge` too |

**Effort key:** XS = < 30 min · S = 30–90 min · M = 90–180 min
