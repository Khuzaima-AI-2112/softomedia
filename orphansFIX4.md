# Sprint Plan — Orphaned Screens Q23–59

> **Screens covered:** PlaylistEditor (Q23–31) · ScheduleHistory (Q32–38) · ScheduleManager (Q39–45) · TechOpsDashboard (Q46–53) · Step3ReviewDistribution (Q54–59)
> **Source:** Stakeholder answers to `orphaned.md` Q23–59, recorded 2026-06-04
> **Priority rule:** All three deletion tasks (Q21, Q31, Q55) must ship in one atomic PR before any new feature work begins.

---

## Decision Summary

| # | Screen | File | Verdict |
|---|--------|------|---------|
| 4 | Playlist Editor | `pages/admin/PlaylistEditor.jsx` | `Delete` — bundle with Screen 3 cleanup PR |
| 5 | Schedule History | `pages/retailer/ScheduleHistory.jsx` | `Ship now` — wire to retailer nav immediately |
| 6 | Schedule Manager | `pages/retailer/ScheduleManager.jsx` | `Revise first` — wire after hardcoded values and approval logic are fixed |
| 7 | Tech Ops Dashboard | `pages/tech/TechOpsDashboard.jsx` | `Revise first` — wire as Tech Operator landing page after action guardrails and Design Lab removal are done |
| 8 | Step3ReviewDistribution | `pages/brand/wizard/Step3ReviewDistribution.jsx` | `Delete` — extract loop bar + impact cards first, then delete in same cleanup PR |

---

## PR 1 — Atomic Cleanup: Delete Deprecated Screens

> **Rule:** This PR must be reviewed and merged before any new feature work begins.
> **Scope:** PlaylistEditor (Q31) + Step3ReviewDistribution (Q55). PlaylistManagement was already deleted in the prior sprint.

### Task 1.1 — Extract loop visualisation bar from Step3ReviewDistribution
- Open `pages/brand/wizard/Step3ReviewDistribution.jsx`
- Locate the loop visualisation bar component/JSX block
- Extract it into a standalone component or inline block in the active wizard's review step
- Target: the review section of the currently active Step 5 in `BrandCampaignWizard.jsx`
- Commit: `feat: transplant loop visualisation bar into active wizard Step 5`

### Task 1.2 — Extract impact projection cards from Step3ReviewDistribution
- Locate the impact projection cards in `Step3ReviewDistribution.jsx`: frequency per hour, total daily loops, estimated impressions
- Integrate these as a summary block **above** the Confirm button in the active wizard Step 5
- Ensure data bindings match the active wizard's state shape — do not copy stale mock data
- Commit: `feat: transplant impact projection cards into active wizard Step 5`

### Task 1.3 — Consolidate wizard review into Step 5
- Confirm that any intermediate review checkpoint in Step 3 of the active wizard is now redundant after the transplant
- Remove or slim down Step 3's review content so that Step 5 is the single review-and-confirm screen
- The split between Step 3 and Step 5 is a historical accident — the preferred architecture is one consolidated review screen
- Commit: `refactor: consolidate wizard review-and-confirm into Step 5 only`

### Task 1.4 — Delete Step3ReviewDistribution.jsx
- Delete `pages/brand/wizard/Step3ReviewDistribution.jsx`
- Search for any import or route reference to this file and remove it
- Confirm the active wizard does not lazy-load or reference it anywhere
- Commit: `chore: delete deprecated Step3ReviewDistribution.jsx`

### Task 1.5 — Delete PlaylistEditor.jsx
- Delete `pages/admin/PlaylistEditor.jsx`
- Search entire codebase for imports, routes, nav links, or permission entries referencing `PlaylistEditor`
- Remove every hit — do not comment out, delete entirely
- Confirm `App.jsx` has no route for playlist editor (already verified clean for PlaylistManagement — re-verify for editor)
- Commit: `chore: delete deprecated PlaylistEditor.jsx`

### Task 1.6 — Update orphaned.md
- Record answers for Q23–31 and Q54–59 under each screen section
- Update Final Decision Table: Screen 4 = `Delete`, Screen 8 = `Delete`
- Add resolution notes: files deleted, components transplanted to wizard
- Commit: `docs: record Q23-31 and Q54-59 answers, update final decision table`

### Task 1.7 — Update changelog.md
- Add a dated entry logging all three deletions (PlaylistManagement was prior sprint; add PlaylistEditor and Step3ReviewDistribution here)
- Note the two extracted components transplanted to the active wizard
- Commit: `docs: log deprecated screen deletions and wizard component transplant`

### Task 1.8 — PR review checklist
- PR description references this sprint plan and `orphaned.md`
- All three deprecated files are absent from the repo after merge
- Active wizard Step 5 renders loop visualisation bar and impact projection cards with live data
- No broken imports, no 404 routes, test suite passes
- Reviewer signs off that no playlist or old wizard path is reachable in the app

---

## PR 2 — Wire ScheduleHistory (Screen 5)

> **Status:** Production-ready. No code rewrite needed — only wiring.

### Task 2.1 — Add route to App.jsx
- Add route: `<Route path="retailer/schedule-history" element={<ScheduleHistory />} />`
- Add lazy import: `const ScheduleHistory = lazy(() => import('./pages/retailer/ScheduleHistory'))`
- Confirm file exists at `pages/retailer/ScheduleHistory.jsx` before adding the import
- Update the verified file map comment at the top of `App.jsx`
- Commit: `feat: add ScheduleHistory route to App.jsx`

### Task 2.2 — Add nav link to DashboardLayout.jsx
- In `RETAILER_NAV`, add entry: `{ to: '/dashboard/retailer/schedule-history', icon: 'history', label: 'Schedule History' }`
- Position: between the Schedule entry and any Reports entry; if no Reports entry exists, anchor it at the bottom of the scheduling section
- Commit: `feat: add Schedule History nav link to retailer sidebar`

### Task 2.3 — Scope data to logged-in retailer
- Verify `ScheduleHistory.jsx` auto-scopes API calls to the current authenticated retailer
- No manual store selector should be visible — the screen must never expose another retailer's data
- If the component accepts a `retailerId` prop or reads from a store, confirm it sources from `AuthContext` or equivalent, not from a URL param or hardcoded value
- If multiple locations exist under one retailer account, confirm location filtering is available within that retailer's own portfolio only

### Task 2.4 — Verify CSV export
- Confirm the export button triggers a CSV download of the visible history records
- Export is required at launch — it is not a stub; it must produce a real file
- If the export feature is missing or broken, add it before closing this PR
- Format: CSV with columns matching the displayed table (date, type, slot, status, notes at minimum)

### Task 2.5 — Set date range defaults
- Default view: last 30 days
- Provide a dropdown to extend to 90 days
- History beyond 90 days is post-MVP — do not expose it in the UI
- Confirm the date range selector is bound correctly and re-fetches data on change

### Task 2.6 — Verify event types in history feed
- The screen must include: approvals, rejections, edits, overrides
- Include cancellations if the data model supports them
- A history view that omits edits is non-compliant for dispute resolution purposes
- If the API does not return all event types, flag it as a backend gap and open a tracking issue — do not block the PR on backend work

### Task 2.7 — Smoke test
- Log in as a retailer persona in dev/staging
- Navigate to Schedule History via sidebar
- Confirm data is scoped correctly, date picker works, CSV export downloads a file
- Confirm no console errors, no broken API calls

---

## PR 3 — Revise and Wire ScheduleManager (Screen 6)

> **Status:** Requires fixes before wiring. Hardcoded placeholders and unimplemented buttons block production readiness.

### Task 3.1 — Replace hardcoded date/time placeholders
- Find all hardcoded values in `ScheduleManager.jsx`: `"08:00 – 09:00"`, `"Oct 12, 2023"`, and any similar static strings in the header
- Replace with dynamic values sourced from the selected location's schedule data and the current date
- Date display format: `"Thursday Jun 5 — EST"` (day name, date, resolved timezone from store's location record)

### Task 3.2 — Implement timezone display
- Resolve timezone from the store's location record — never use system time
- Display the resolved timezone explicitly in the screen header on every render
- If the location record does not carry a timezone field, flag it as a data model gap and open a tracking issue

### Task 3.3 — Set default view to full-day
- Entry state must show the full-day schedule for the selected location
- The hourly drill-down is a secondary interaction — it must be accessible but must not be the default view
- Implement a toggle or expand interaction to switch between full-day and single-hour view

### Task 3.4 — Implement Bulk Approve All
- Wire the Bulk Approve All button to approve all unreviewed time slots for the selected location for the next calendar day only
- The button must trigger a confirmation dialog: `"Approve all [N] unreviewed slots for [Location Name] on [Date]? This action cannot be undone."`
- On confirm, call the appropriate API endpoint and refresh the view
- On success, display a toast or inline confirmation
- Bulk Approve All applies to one location at a time — cross-location bulk approval is explicitly post-MVP

### Task 3.5 — Implement per-slot rejection with comment
- Each time slot must have a Reject action
- On click, open an inline form or modal with a text field (max 280 characters) for a rejection comment
- Comment is optional but displays a warning if omitted: `"Rejection without a note may delay resolution"`
- On submit, call the rejection API endpoint and update the slot's status in the UI

### Task 3.6 — Implement D-1 cutoff display
- D-1 = next calendar day
- Hardcode cutoff time as 18:00 store local time (confirmed business rule)
- Display a visible label in the header: e.g. `"Approval deadline: today 6:00 PM EST"`
- If past the cutoff, show a clear warning that the approval window has closed

### Task 3.7 — Add route and nav link
- After Tasks 3.1–3.6 are complete and tested, add route in `App.jsx`: `retailer/schedule-manager`
- Add nav link in `DashboardLayout.jsx` RETAILER_NAV — label: `"D-1 Preview"` (confirm with stakeholder if different label preferred)
- Update the verified file map in `App.jsx`
- Commit: `feat: wire ScheduleManager to retailer nav`

### Task 3.8 — Smoke test
- Log in as retailer, navigate to ScheduleManager
- Confirm: date header shows correct date and resolved timezone, full-day view is default, Bulk Approve All triggers confirmation dialog with correct slot count, per-slot rejection opens comment form with empty-submit warning, D-1 cutoff label is visible

---

## PR 4 — Revise and Wire TechOpsDashboard (Screen 7)

> **Status:** Requires guardrails and Design Lab removal before wiring as landing page.

### Task 4.1 — Remove Design Lab experiment links
- Locate the Design Lab section in `TechOpsDashboard.jsx`
- Remove the section and all links to hamburger-menu experiment files entirely
- A feature flag may be used as a short-term transition measure, but full code removal is required — not just hiding
- Commit: `chore: remove Design Lab links from TechOpsDashboard`

### Task 4.2 — Gate Restart button with confirmation dialog
- Wrap the Restart button action in a confirmation dialog: `"Restart screen [ID]? This will interrupt active playback."`
- On confirm only, trigger the restart API call
- On success or failure, display a result message inline
- The Restart button triggers a real production action — a no-op stub is explicitly unacceptable

### Task 4.3 — Implement audit logging for Restart
- Every Restart action must produce a log entry containing: user ID, screen ID, timestamp, outcome (success/failure)
- This is a hard MVP requirement — it is not deferrable
- Confirm the backend has an endpoint to receive this log entry; if not, create it as part of this task
- Frontend must send the log entry immediately after the API call resolves

### Task 4.4 — Implement Terminal button as log viewer
- Wire the Terminal button to open a log view showing the last N lines of device output for the selected screen
- Remote session capability is explicitly post-MVP — do not implement it
- Recommended UI: modal or slide-over panel with a scrollable log feed
- If the backend endpoint for device logs does not exist, stub the UI with a clear `"Log endpoint not yet available"` message and open a tracking issue

### Task 4.5 — Implement search and filter
- At launch, the search/filter field must support: screen ID, status (online/offline), and location
- Device metadata filtering (firmware version, hardware model) is post-MVP
- Status and location filters are the minimum viable filter set — they must both work at launch

### Task 4.6 — Set TechOpsDashboard as Tech Operator landing page
- In `DashboardLayout.jsx`, update persona routing so that `techoperator` is directed to `/dashboard/techoperator` (TechOpsDashboard) instead of the Health screen
- Health screen remains accessible but must not be the default landing page for this persona
- Update `TECHOP_NAV` to include both TechOpsDashboard and Health as distinct nav items

### Task 4.7 — Add route to App.jsx
- Add lazy import and route for `TechOpsDashboard`: `pages/tech/TechOpsDashboard.jsx`
- Route path: `techoperator` (top-level under the dashboard shell)
- Update the verified file map in `App.jsx`
- Confirm `pages/tech/TechOpsDashboard.jsx` exists on disk before adding the import
- Commit: `feat: wire TechOpsDashboard as Tech Operator landing page`

### Task 4.8 — Smoke test
- Log in as Tech Operator persona
- Confirm: TechOpsDashboard is the landing page, Health is accessible from nav, Design Lab section is gone, Restart triggers confirmation dialog, audit log entry is written on action, Terminal opens log panel, search filters by ID/status/location

---

## PR Sequencing

| Order | PR | Blocker |
|-------|----|---------|
| 1 | Cleanup (PR 1) | Must merge before any other PR starts |
| 2 | ScheduleHistory (PR 2) | No code blockers — wire immediately after PR 1 |
| 3 | ScheduleManager (PR 3) | Depends on revisions in Tasks 3.1–3.6 |
| 4 | TechOpsDashboard (PR 4) | Depends on guardrails in Tasks 4.1–4.5 |

---

## Definition of Done

- [ ] `orphaned.md` Final Decision Table complete for Screens 4–8
- [ ] `PlaylistEditor.jsx` deleted from repo
- [ ] `Step3ReviewDistribution.jsx` deleted from repo
- [ ] Loop visualisation bar and impact projection cards live in active wizard Step 5 with real data
- [ ] `ScheduleHistory.jsx` wired, auto-scoped to retailer, CSV export working, 30-day default active
- [ ] `ScheduleManager.jsx` wired with dynamic timezone, D-1 cutoff label, full-day default, Bulk Approve All with dialog, per-slot rejection with comment
- [ ] `TechOpsDashboard.jsx` wired as Tech Operator landing page: Design Lab removed, Restart gated + audit-logged, Terminal shows log panel, search filters working
- [ ] All test suites pass after each PR merge
- [ ] No broken routes or nav links in any persona

---

*Plan authored: 2026-06-04 — based on stakeholder answers to orphaned.md Q23–59*
