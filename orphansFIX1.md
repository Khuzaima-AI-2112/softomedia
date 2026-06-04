# Sprint Plan: LoopAnalytics.jsx — Admin Loop Analytics Fix

**File:** `client-app/src/pages/admin/LoopAnalytics.jsx`
**Scope:** MVP hardening — prototype cleanup, navigation, data layer, CSV export
**Status:** Ready to implement

---

## Sprint Goal

Ship `LoopAnalytics.jsx` as a production-grade, standalone admin tool. Replace mock data with a real (or gracefully degraded) API, add a summary table as the primary view, add CSV export, and wire the page into admin navigation as a first-class entry.

---

## Epic 1 — Cleanup & De-prototyping

> Remove all signals that this page is temporary or work-in-progress.

### Task 1.1 — Strip prototype-marker comments
- **What:** Remove all `🔶` orange-flag inline comments from the file
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:** No `🔶` characters remain anywhere in the file
- **Effort:** XS

### Task 1.2 — Delete `generateMockAnalytics`
- **What:** Delete the entire `generateMockAnalytics` function and all call sites
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:** The function and its invocation inside `fetchAnalytics` are gone; no mock data is generated at runtime
- **Effort:** XS
- **Note:** Graceful degradation (Task 6.2) covers the gap when the backend is not ready

---

## Epic 2 — Navigation & Routing

> Make Loop Analytics a first-class page in the admin experience.

### Task 2.1 — Register route
- **What:** Add a route entry for `/admin/loop-analytics` pointing to `LoopAnalytics` in the admin router config
- **Files:** Admin router config (e.g. `client-app/src/router.jsx` or equivalent routes file)
- **Acceptance:** Navigating to `/admin/loop-analytics` renders the page without a 404 or redirect
- **Effort:** XS

### Task 2.2 — Add sidebar nav entry
- **What:** Add "Loop Analytics" as a standalone top-level item in the admin sidebar, using the `analytics` Material Symbol icon
- **Files:** Admin sidebar/nav component
- **Acceptance:**
  - Entry appears at top level — not nested inside Loop Management
  - Label reads "Loop Analytics"
  - Icon is `analytics` (Material Symbols)
  - Active state highlights correctly when on `/admin/loop-analytics`
- **Effort:** S

---

## Epic 3 — KPI Cards

> Align the four summary cards with MVP-required metrics only.

### Task 3.1 — Rename "Partial Delivery" to "Slot Failures"
- **What:** Update the card label, `data-testid`, and subtitle copy. Ensure the count represents actual slot-level failures (not just partial hours)
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:**
  - Card header reads "Slot Failures"
  - `data-testid` updated to `slot-failures-count`
  - Value reflects slot failures when real data is available
- **Effort:** XS

### Task 3.2 — Remove colored left borders from KPI cards
- **What:** Remove `border-l-4 border-l-*` Tailwind classes from all four `GlassCard` KPI wrappers. Rely on surface elevation and the card's existing border for visual separation
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:** No colored left border appears on any KPI card in light or dark mode
- **Effort:** XS

### Task 3.3 — Remove impressions from slot detail cards
- **What:** Remove the `impressions` variable, its display value, and the "impressions" label from the slot detail grid cards. Cards show played/not-played state only (✓ / ✗)
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:** Slot detail cards render without any impressions count or label
- **Effort:** XS

---

## Epic 4 — Summary Table (Primary Data View)

> Replace the hourly progress-bar chart as the primary visualization with a scannable summary table.

### Task 4.1 — Build summary table component
- **What:** Add a summary table above the hourly chart. Columns: **Time | Loop Completions | Integrity Score | Slot Failures | Status**. Each row maps to one business hour (8 AM–10 PM)
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:**
  - Table renders for all business hours in the `analytics` state
  - Columns: Time, Loop Completions, Integrity Score (%), Slot Failures, Status badge
  - Numbers use `tabular-nums` font variant for alignment
  - Table is responsive — horizontally scrollable on mobile
  - `data-testid="loop-analytics-summary-table"` on the table element
- **Effort:** M

### Task 4.2 — Wire 7-day default view to table
- **What:** On initial page load (no date selected), the summary table displays aggregated or day-level rows for the **last 7 days**. When the user picks a specific date, the table switches to that day's hourly breakdown
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:**
  - Initial load: table shows 7 rows, one per day (last 7 days including today), with daily aggregate values
  - Date picker selection: table switches to hourly rows for selected date
  - Default `targetDate` state initializes to today (existing behavior preserved)
- **Effort:** M

### Task 4.3 — Demote progress-bar hourly chart
- **What:** Move the `GlassCard` containing the hourly progress-bar visualization below the summary table. It becomes a secondary/supplementary view, not the primary one
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:** Summary table appears first in the page flow; progress-bar chart renders beneath it
- **Effort:** XS

### Task 4.4 — Add "Slot data syncing" placeholder to drill-down grid
- **What:** Replace the `Math.random()` slot data in the `selectedHour` detail panel with a placeholder state. Each slot card reads "Syncing…" and is visually neutral (not green/red) until real slot data is available from the backend
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:**
  - Slot cards do not use `Math.random()` for played/not-played state
  - Placeholder text "Slot data syncing — available shortly" appears in the panel (or per card)
  - Panel still opens/closes correctly when an hour row is clicked
- **Effort:** S

---

## Epic 5 — CSV Export

> Give internal ops a one-click path to spreadsheet-ready data.

### Task 5.1 — Add "Export CSV" button to header toolbar
- **What:** Add an "Export CSV" button in the header toolbar, adjacent to the Refresh button. Use a `download` Material Symbol icon
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:**
  - Button renders in the header toolbar next to Refresh
  - Button is disabled (greyed out) when `analytics` state is empty or loading
  - `data-testid="export-csv-btn"` on the button
- **Effort:** S

### Task 5.2 — Implement CSV serialization and download
- **What:** On button click, serialize the current `analytics` state to a CSV string with headers: `Time,Loop Completions,Integrity Score,Slot Failures,Status`. Trigger a client-side Blob download. Filename format: `loop-analytics-YYYY-MM-DD.csv`
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:**
  - Clicking the button downloads a `.csv` file immediately — no server call
  - File opens correctly in Excel / Google Sheets
  - Filename includes the currently selected date
  - No PDF export — CSV only
- **Effort:** S

---

## Epic 6 — API Integration & Graceful Degradation

> Activate the real data layer; handle backend unavailability without blocking the UI.

### Task 6.1 — Uncomment and activate real API call
- **What:** Uncomment the `fetch(${API_URL}/api/analytics/loops?date=${targetDate})` call inside `fetchAnalytics`. Remove the mock data fallback path
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:**
  - Real API call fires on mount and on date change
  - Response data populates `analytics` state
  - Console error no longer references mock data
- **Effort:** S
- **Dependency:** Backend endpoint `/api/analytics/loops` must exist or Task 6.2 covers the gap

### Task 6.2 — Implement graceful degradation on API failure
- **What:** In the `catch` block of `fetchAnalytics`, instead of leaving `analytics` as an empty array and showing the empty state, set a dedicated `apiUnavailable` boolean state to `true`. Render a non-error informational notice inside the table body: _"Data syncing — available shortly"_
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:**
  - API failure shows the page shell fully (header, KPI cards at zero/dash, table container)
  - Table body displays a single full-width row with the syncing notice — not an error message, not a spinner
  - Existing empty-state UI (dashed border, "No Analytics Data") is preserved for the case where the API returns an empty array (successful call, no data)
  - `apiUnavailable` state resets to `false` on a successful re-fetch
- **Effort:** S

---

## Epic 7 — Copy & Audience Alignment

> Align all visible text to internal ops language; remove customer-facing copy.

### Task 7.1 — Rewrite page subtitle
- **What:** Update the subtitle below "Loop Analytics" from `"Playlist integrity monitoring and cycle verification"` (or any "proof-of-play" phrasing) to direct ops language, e.g. `"Internal delivery monitoring for loop completion and integrity"`
- **Files:** `LoopAnalytics.jsx`
- **Acceptance:** No customer-report or sales-demo language appears in the subtitle or any visible UI copy
- **Effort:** XS

### Task 7.2 — Audit and remove brand-facing affordances
- **What:** Review the full rendered page for any UI element, label, toggle, or copy that implies a brand-facing or customer-visible mode. Remove or do not add any "brand view" switch, access-level selector, or public-summary panel
- **Files:** `LoopAnalytics.jsx`, any sub-components imported by the page
- **Acceptance:** The page contains no brand-facing affordances; all content is ops-grade internal data
- **Effort:** XS

---

## Task Summary

| # | Task | Epic | Effort | Dependency |
|---|------|------|--------|------------|
| 1.1 | Strip prototype-marker comments | Cleanup | XS | — |
| 1.2 | Delete `generateMockAnalytics` | Cleanup | XS | — |
| 2.1 | Register `/admin/loop-analytics` route | Navigation | XS | — |
| 2.2 | Add sidebar nav entry | Navigation | S | 2.1 |
| 3.1 | Rename "Partial Delivery" → "Slot Failures" | KPI Cards | XS | — |
| 3.2 | Remove colored left borders from KPI cards | KPI Cards | XS | — |
| 3.3 | Remove impressions from slot detail cards | KPI Cards | XS | — |
| 4.1 | Build summary table | Summary Table | M | — |
| 4.2 | Wire 7-day default view | Summary Table | M | 4.1 |
| 4.3 | Demote progress-bar chart | Summary Table | XS | 4.1 |
| 4.4 | Add slot syncing placeholder | Summary Table | S | — |
| 5.1 | Add "Export CSV" button | CSV Export | S | — |
| 5.2 | Implement CSV serialization & download | CSV Export | S | 5.1 |
| 6.1 | Activate real API call | API | S | — |
| 6.2 | Graceful degradation on API failure | API | S | 6.1 |
| 7.1 | Rewrite page subtitle | Copy | XS | — |
| 7.2 | Audit brand-facing affordances | Copy | XS | — |

**Effort key:** XS = < 30 min · S = 30–90 min · M = 90–180 min
