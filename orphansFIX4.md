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
- **⚠️ Risk (70%):** The loop bar uses purely static JSX with no data bindings. Engineering must decide before coding whether it ships as a static visual aid (easy, safe) or a data-driven component bound to `selectedSlots`. The task as written is ambiguous — ambiguity is the failure mode. Resolve the spec first.
- Commit: `feat: transplant loop visualisation bar into active wizard Step 5`

### Task 1.2 — Extract impact projection cards from Step3ReviewDistribution
- Locate the impact projection cards in `Step3ReviewDistribution.jsx`: frequency per hour, total daily loops, estimated impressions
- Integrate these as a summary block **above** the Confirm button in the active wizard Step 5
- Ensure data bindings match the active wizard's state shape — do not copy stale mock data
- **🔴 Risk (55%) — HIGHEST RISK TASK IN PR 1:** The three metric cards currently show hardcoded mock values (`12x`, `192`, `250k`). `Step5ReviewConfirm.jsx` already has `summary.totalSlots`, `summary.screenCount`, and `pricingService.formatImpressions()` — a completely different state model. The fields `Frequency / Hour` and `Total Loops / Day` have **no equivalent** in `Step5`'s `summary` object. Three failure modes: (1) copy cards verbatim → ships mock data as live data; (2) attempt live binding → `undefined` fields; (3) add new fields to `useMemo` carelessly → breaks existing `totalCost` calculation. **Required pre-work:** produce a written field mapping (old card label → new computed value or explicit "static") before any code is written.
- Commit: `feat: transplant impact projection cards into active wizard Step 5`

### Task 1.3 — Consolidate wizard review into Step 5
- Confirm that any intermediate review checkpoint in Step 3 of the active wizard is now redundant after the transplant
- Remove or slim down Step 3's review content so that Step 5 is the single review-and-confirm screen
- The split between Step 3 and Step 5 is a historical accident — the preferred architecture is one consolidated review screen
- **⚠️ Risk (65%):** The wizard directory contains **two Step 3 files**: `Step3LoopSlotSelection.jsx` (active) and `Step3ReviewDistribution.jsx` (deprecated). A developer scanning for "Step 3" without reading filenames will delete the wrong file. The task description must explicitly name `Step3ReviewDistribution.jsx` as the only target — do not touch `Step3LoopSlotSelection.jsx`.
- Commit: `refactor: consolidate wizard review-and-confirm into Step 5 only`

### Task 1.4 — Delete Step3ReviewDistribution.jsx
- Delete `client-app/src/pages/brand/wizard/Step3ReviewDistribution.jsx`
- Search for any import or route reference to this file and remove it
- Confirm the active wizard does not lazy-load or reference it anywhere
- **✅ Risk (92%):** Low. File confirmed on disk. Only risk is skipping the pre-deletion import sweep in `BrandCampaignWizard.jsx` — do not skip it.
- Commit: `chore: delete deprecated Step3ReviewDistribution.jsx`

### Task 1.5 — Delete PlaylistEditor.jsx
- Delete `pages/admin/PlaylistEditor.jsx`
- Search entire codebase for imports, routes, nav links, or permission entries referencing `PlaylistEditor`
- Remove every hit — do not comment out, delete entirely
- Confirm `App.jsx` has no route for playlist editor (already verified clean for PlaylistManagement — re-verify for editor)
- **✅ Risk (95%):** Very low. Codebase already swept for PlaylistManagement with zero hits. Same sweep for PlaylistEditor is the only step.
- Commit: `chore: delete deprecated PlaylistEditor.jsx`

### Task 1.6 — Update orphaned.md
- Record answers for Q23–31 and Q54–59 under each screen section
- Update Final Decision Table: Screen 4 = `Delete`, Screen 8 = `Delete`
- Add resolution notes: files deleted, components transplanted to wizard
- **✅ Risk (98%):** Pure documentation write.
- Commit: `docs: record Q23-31 and Q54-59 answers, update final decision table`

### Task 1.7 — Update changelog.md
- Add a dated entry logging all three deletions (PlaylistManagement was prior sprint; add PlaylistEditor and Step3ReviewDistribution here)
- Note the two extracted components transplanted to the active wizard
- **✅ Risk (98%):** Pure documentation write.
- Commit: `docs: log deprecated screen deletions and wizard component transplant`

### Task 1.8 — PR review checklist
- PR description references this sprint plan and `orphaned.md`
- All three deprecated files are absent from the repo after merge
- Active wizard Step 5 renders loop visualisation bar and impact projection cards with live data
- No broken imports, no 404 routes, test suite passes
- Reviewer signs off that no playlist or old wizard path is reachable in the app
- **⚠️ Risk (75%):** Checklist item "live data" will fail if Task 1.2's field mapping ambiguity is not resolved before coding. Checklist is only as strong as the tasks it gates.

---

## PR 2 — Wire ScheduleHistory (Screen 5)

> **Status:** Production-ready. No code rewrite needed — only wiring.

### Task 2.1 — Add route to App.jsx
- Add route: `<Route path="retailer/schedule-history" element={<ScheduleHistory />} />`
- Add lazy import: `const ScheduleHistory = lazy(() => import('./pages/retailer/ScheduleHistory'))`
- Confirm file exists at `pages/retailer/ScheduleHistory.jsx` before adding the import ✅ (confirmed on disk)
- Update the verified file map comment at the top of `App.jsx`
- **✅ Risk (97%):** File confirmed on disk. Identical pattern to existing retailer routes. Near-zero risk.
- Commit: `feat: add ScheduleHistory route to App.jsx`

### Task 2.2 — Add nav link to DashboardLayout.jsx
- In `RETAILER_NAV`, add entry: `{ to: '/dashboard/retailer/schedule-history', icon: 'history', label: 'Schedule History' }`
- Position: between the Schedule entry and any Reports entry; if no Reports entry exists, anchor it at the bottom of the scheduling section
- **✅ Risk (97%):** RETAILER_NAV follows a clear, consistent pattern. Straight mechanical addition.
- Commit: `feat: add Schedule History nav link to retailer sidebar`

### Task 2.3 — Scope data to logged-in retailer
- Verify `ScheduleHistory.jsx` auto-scopes API calls to the current authenticated retailer
- No manual store selector should be visible — the screen must never expose another retailer's data
- If the component accepts a `retailerId` prop or reads from a store, confirm it sources from `AuthContext` or equivalent, not from a URL param or hardcoded value
- If multiple locations exist under one retailer account, confirm location filtering is available within that retailer's own portfolio only
- **⚠️ Risk (70%):** Task says "verify" but the actual source has not been read. If `retailerId` is hardcoded (common in orphaned screens), this becomes a fix task, not a verification. Read `ScheduleHistory.jsx` before estimating.

### Task 2.4 — Verify CSV export
- Confirm the export button triggers a CSV download of the visible history records
- Export is required at launch — it is not a stub; it must produce a real file
- If the export feature is missing or broken, add it before closing this PR
- Format: CSV with columns matching the displayed table (date, type, slot, status, notes at minimum)
- **⚠️ Risk (60%):** Given orphaned-screen ancestry, a fully working CSV export may not exist. The task's own hedge ("if missing, add it") signals this is likely a build task. Building CSV export is 2–4 hours of real work — sprint estimate should reflect this.

### Task 2.5 — Set date range defaults
- Default view: last 30 days
- Provide a dropdown to extend to 90 days
- History beyond 90 days is post-MVP — do not expose it in the UI
- Confirm the date range selector is bound correctly and re-fetches data on change
- **⚠️ Risk (75%):** Depends on whether `ScheduleHistory.jsx` already has a date picker UI. If it does, this is a config tweak. If not, it is new UI work. Read the file first.

### Task 2.6 — Verify event types in history feed
- The screen must include: approvals, rejections, edits, overrides
- Include cancellations if the data model supports them
- A history view that omits edits is non-compliant for dispute resolution purposes
- If the API does not return all event types, flag it as a backend gap and open a tracking issue — do not block the PR on backend work
- **⚠️ Risk (65%):** Backend API coverage for all event types is unknown. PR 2 may ship with an open tracking issue for backend — confirm this is explicitly acceptable before merging.

### Task 2.7 — Smoke test
- Log in as a retailer persona in dev/staging
- Navigate to Schedule History via sidebar
- Confirm data is scoped correctly, date picker works, CSV export downloads a file
- Confirm no console errors, no broken API calls
- **✅ Risk (88%):** Straightforward once Tasks 2.1–2.6 are green.

---

## PR 3 — Revise and Wire ScheduleManager (Screen 6)

> **Status:** Requires fixes before wiring. Hardcoded placeholders and unimplemented buttons block production readiness.

### Task 3.1 — Replace hardcoded date/time placeholders
- Find all hardcoded values in `ScheduleManager.jsx`: `"08:00 – 09:00"`, `"Oct 12, 2023"`, and any similar static strings in the header
- Replace with dynamic values sourced from the selected location's schedule data and the current date
- Date display format: `"Thursday Jun 5 — EST"` (day name, date, resolved timezone from store's location record)
- **✅ Risk (88%):** File is relatively small (6,682 bytes). Hardcoded strings are easy to locate. Only risk: replacing the display string without wiring the data source — confirm replacements read from API data, not just `new Date()`.

### Task 3.2 — Implement timezone display
- Resolve timezone from the store's location record — never use system time
- Display the resolved timezone explicitly in the screen header on every render
- If the location record does not carry a timezone field, flag it as a data model gap and open a tracking issue
- **⚠️ Risk (65%):** Depends entirely on whether the location data model carries a `timezone` field. Given the project's history of hardcoded timezone values, this gap likely exists. Resolving it requires a backend schema change — a cross-team dependency that can block the PR.

### Task 3.3 — Set default view to full-day
- Entry state must show the full-day schedule for the selected location
- The hourly drill-down is a secondary interaction — it must be accessible but must not be the default view
- Implement a toggle or expand interaction to switch between full-day and single-hour view
- **✅ Risk (85%):** Straightforward React default state management. Verify the hourly picker supports a controlled `expanded` prop before assuming it can be toggled without breaking.

### Task 3.4 — Implement Bulk Approve All
- Wire the Bulk Approve All button to approve all unreviewed time slots for the selected location for the next calendar day only
- The button must trigger a confirmation dialog: `"Approve all [N] unreviewed slots for [Location Name] on [Date]? This action cannot be undone."`
- On confirm, call the appropriate API endpoint and refresh the view
- On success, display a toast or inline confirmation
- Bulk Approve All applies to one location at a time — cross-location bulk approval is explicitly post-MVP
- **⚠️ Risk (70%):** Requires a confirmed backend bulk-approval endpoint. If missing, this becomes a backend + frontend task. Confirm the endpoint exists before starting frontend work.

### Task 3.5 — Implement per-slot rejection with comment
- Each time slot must have a Reject action
- On click, open an inline form or modal with a text field (max 280 characters) for a rejection comment
- Comment is optional but displays a warning if omitted: `"Rejection without a note may delay resolution"`
- On submit, call the rejection API endpoint and update the slot's status in the UI
- **⚠️ Risk (72%):** Same API dependency risk as 3.4. UI work is well-defined and achievable. Rejection API endpoint and its `comment` field support must be confirmed before starting frontend work.

### Task 3.6 — Implement D-1 cutoff display
- D-1 = next calendar day
- Hardcode cutoff time as 18:00 store local time (confirmed business rule)
- Display a visible label in the header: e.g. `"Approval deadline: today 6:00 PM EST"`
- If past the cutoff, show a clear warning that the approval window has closed
- **✅ Risk (90%):** A static label at 18:00 store local time is low-risk. The "past cutoff" state requires `new Date()` in the store's resolved timezone — a ~10-line utility function. High confidence.

### Task 3.7 — Add route and nav link
- After Tasks 3.1–3.6 are complete and tested, add route in `App.jsx`: `retailer/schedule-manager`
- Add nav link in `DashboardLayout.jsx` RETAILER_NAV — label: `"D-1 Preview"` (confirm with stakeholder if different label preferred)
- Update the verified file map in `App.jsx`
- **✅ Risk (93%):** Identical pattern to Task 2.1/2.2. High confidence.
- Commit: `feat: wire ScheduleManager to retailer nav`

### Task 3.8 — Smoke test
- Log in as retailer, navigate to ScheduleManager
- Confirm: date header shows correct date and resolved timezone, full-day view is default, Bulk Approve All triggers confirmation dialog with correct slot count, per-slot rejection opens comment form with empty-submit warning, D-1 cutoff label is visible
- **✅ Risk (85%):** High confidence once Tasks 3.1–3.6 are green.

---

## PR 4 — Revise and Wire TechOpsDashboard (Screen 7)

> **Status:** Requires guardrails and Design Lab removal before wiring as landing page.

### Task 4.1 — Remove Design Lab experiment links
- Locate the Design Lab section in `TechOpsDashboard.jsx`
- Remove the section and all links to hamburger-menu experiment files entirely
- A feature flag may be used as a short-term transition measure, but full code removal is required — not just hiding
- **✅ Risk (97%):** Pure deletion. Near-zero risk.
- Commit: `chore: remove Design Lab links from TechOpsDashboard`

### Task 4.2 — Gate Restart button with confirmation dialog
- Wrap the Restart button action in a confirmation dialog: `"Restart screen [ID]? This will interrupt active playback."`
- On confirm only, trigger the restart API call
- On success or failure, display a result message inline
- The Restart button triggers a real production action — a no-op stub is explicitly unacceptable
- **✅ Risk (90%):** The confirmation dialog pattern is already established in the codebase (`ScreenManagement.jsx`). Low risk.

### Task 4.3 — Implement audit logging for Restart
- Every Restart action must produce a log entry containing: user ID, screen ID, timestamp, outcome (success/failure)
- This is a hard MVP requirement — it is not deferrable
- Confirm the backend has an endpoint to receive this log entry; if not, create it as part of this task
- Frontend must send the log entry immediately after the API call resolves
- **🔴 Risk (55%) — HIGHEST RISK TASK IN PR 4:** No audit log endpoint is confirmed to exist. Creating one requires: a new route in `ad-server/src/api/`, a schema for the log document, Firestore write logic, and auth middleware. This is a full backend task embedded inside a frontend PR. Estimated 1–2 days of backend work not currently reflected in sprint scope. Run a route search for `audit` and `restart` in `ad-server/src/api/` before sprint planning.

### Task 4.4 — Implement Terminal button as log viewer
- Wire the Terminal button to open a log view showing the last N lines of device output for the selected screen
- Remote session capability is explicitly post-MVP — do not implement it
- Recommended UI: modal or slide-over panel with a scrollable log feed
- If the backend endpoint for device logs does not exist, stub the UI with a clear `"Log endpoint not yet available"` message and open a tracking issue
- **⚠️ Risk (65%):** Device log endpoint almost certainly does not exist. The task's stub-first fallback raises probability from ~40% to ~65%. Respect the stub-first approach — do not attempt to build the real endpoint within this sprint.

### Task 4.5 — Implement search and filter
- At launch, the search/filter field must support: screen ID, status (online/offline), and location
- Device metadata filtering (firmware version, hardware model) is post-MVP
- Status and location filters are the minimum viable filter set — they must both work at launch
- **⚠️ Risk (78%):** High confidence if filtering is client-side against already-loaded data. If server-side query params are required, a backend change is needed. Clarify before starting.

### Task 4.6 — Set TechOpsDashboard as Tech Operator landing page
- In `DashboardLayout.jsx`, update persona routing so that `techoperator` is directed to `/dashboard/techoperator` (TechOpsDashboard) instead of the Health screen
- Health screen remains accessible but must not be the default landing page for this persona
- Update `TECHOP_NAV` to include both TechOpsDashboard and Health as distinct nav items
- **✅ Risk (93%):** One-line change in persona routing logic. Near-zero risk.

### Task 4.7 — Add route to App.jsx
- Add lazy import and route for `TechOpsDashboard`: `pages/tech/TechOpsDashboard.jsx`
- Route path: `techoperator` (top-level under the dashboard shell)
- Update the verified file map in `App.jsx`
- Confirm `pages/tech/TechOpsDashboard.jsx` exists on disk before adding the import
- **✅ Risk (92%):** Standard pattern, file confirmed on disk. High confidence.
- Commit: `feat: wire TechOpsDashboard as Tech Operator landing page`

### Task 4.8 — Smoke test
- Log in as Tech Operator persona
- Confirm: TechOpsDashboard is the landing page, Health is accessible from nav, Design Lab section is gone, Restart triggers confirmation dialog, audit log entry is written on action, Terminal opens log panel, search filters by ID/status/location
- **⚠️ Risk (72%):** Reduced by open questions on audit logging (4.3) and Terminal endpoint (4.4). If both are properly stubbed, smoke test passes. If either is partially implemented, expect console errors.

---

## PR Sequencing

| Order | PR | Blocker |
|-------|----|---------|\
| 1 | Cleanup (PR 1) | Must merge before any other PR starts |
| 2 | ScheduleHistory (PR 2) | No code blockers — wire immediately after PR 1 |
| 3 | ScheduleManager (PR 3) | Depends on revisions in Tasks 3.1–3.6 |
| 4 | TechOpsDashboard (PR 4) | Depends on guardrails in Tasks 4.1–4.5 |

---

## SRE/QA Risk Assessment Summary

> Assessed 2026-06-04 against live repo source. Rating: 🟢 High (>85%) · 🟡 Medium (60–85%) · 🔴 Low (<60%)

| Task | Rating | Primary Risk |
|------|--------|--------------|
| 1.1 Extract loop bar | 🟡 70% | Static vs. data-driven ambiguity — resolve spec before coding |
| **1.2 Extract impact cards** | 🔴 **55%** | **Hardcoded mock values; no live field mapping to Step5 state shape** |
| 1.3 Consolidate Step 3 | 🟡 65% | Two Step 3 files in wizard — wrong file deletion risk |
| 1.4 Delete Step3ReviewDistribution | 🟢 92% | Pre-deletion import sweep in BrandCampaignWizard.jsx |
| 1.5 Delete PlaylistEditor | 🟢 95% | Minimal — codebase already verified clean for sibling file |
| 1.6–1.7 Docs | 🟢 98% | None |
| 1.8 PR checklist | 🟡 75% | Only as strong as Task 1.2's field mapping resolution |
| 2.1 Add route | 🟢 97% | None — file confirmed on disk |
| 2.2 Add nav link | 🟢 97% | None — pattern established |
| 2.3 Retailer data scope | 🟡 70% | Source not yet read — may be hardcoded |
| 2.4 CSV export | 🟡 60% | Likely missing — treat as build task, not verify |
| 2.5 Date range defaults | 🟡 75% | Depends on existing UI in file |
| 2.6 Event types | 🟡 65% | Backend API coverage unknown |
| 2.7 Smoke test | 🟢 88% | Downstream of 2.1–2.6 |
| 3.1 Replace hardcoded placeholders | 🟢 88% | Ensure data source is wired, not just string replaced |
| 3.2 Timezone display | 🟡 65% | Location schema may lack timezone field — cross-team dependency |
| 3.3 Full-day default | 🟢 85% | Verify hourly picker supports controlled toggle |
| 3.4 Bulk Approve All | 🟡 70% | Backend bulk-approval endpoint unconfirmed |
| 3.5 Per-slot rejection | 🟡 72% | Backend rejection endpoint unconfirmed |
| 3.6 D-1 cutoff display | 🟢 90% | ~10-line utility function for timezone-aware cutoff |
| 3.7 Route + nav | 🟢 93% | Established pattern |
| 3.8 Smoke test | 🟢 85% | Downstream of 3.1–3.6 |
| 4.1 Remove Design Lab | 🟢 97% | Pure deletion |
| 4.2 Restart confirmation dialog | 🟢 90% | Pattern established in ScreenManagement.jsx |
| **4.3 Audit logging for Restart** | 🔴 **55%** | **Backend endpoint does not exist — full backend build task hidden in frontend PR** |
| 4.4 Terminal log viewer | 🟡 65% | Device log endpoint unconfirmed — stub-first is mandatory |
| 4.5 Search and filter | 🟡 78% | High if client-side; backend dependency if server-side |
| 4.6 Landing page routing | 🟢 93% | One-line change |
| 4.7 Add route | 🟢 92% | Standard pattern |
| 4.8 Smoke test | 🟡 72% | Reduced by 4.3 and 4.4 open questions |

### Three Required Pre-Sprint Actions

**Action 1 — Resolve Task 1.2 field mapping before any code is written.**
Read `Step5ReviewConfirm.jsx` state shape and map each of the three metric card labels (`Frequency / Hour`, `Total Loops / Day`, `Est. Impressions`) to a specific computed value or explicitly mark them as static. Ship a written spec, then code.

**Action 2 — Audit backend endpoints before starting PR 3 and PR 4.**
Search `ad-server/src/api/` for `bulk-approve`, `reject`, `restart`, and `audit-log` route handlers. If any are missing, open backend tasks and sequence them before the frontend PRs. Backend gaps in Tasks 3.4, 3.5, 4.3, and 4.4 are the single largest threat to sprint delivery.

**Action 3 — Read `ScheduleHistory.jsx` before marking PR 2 as wiring-only.**
Verify `retailerId` sourcing and confirm CSV export exists. If either is missing, reclassify PR 2 as "revise and wire" and adjust time estimates before sprint kickoff.

---

## Definition of Done

- [ ] `orphaned.md` Final Decision Table complete for Screens 4–8
- [ ] `PlaylistEditor.jsx` deleted from repo
- [ ] `Step3ReviewDistribution.jsx` deleted from repo
- [ ] Loop visualisation bar and impact projection cards live in active wizard Step 5 with real data (field mapping doc approved before merge)
- [ ] `ScheduleHistory.jsx` wired, auto-scoped to retailer, CSV export working, 30-day default active
- [ ] `ScheduleManager.jsx` wired with dynamic timezone, D-1 cutoff label, full-day default, Bulk Approve All with dialog, per-slot rejection with comment
- [ ] `TechOpsDashboard.jsx` wired as Tech Operator landing page: Design Lab removed, Restart gated + audit-logged, Terminal shows log panel (or stub), search filters working
- [ ] All test suites pass after each PR merge
- [ ] No broken routes or nav links in any persona
- [ ] Three pre-sprint actions completed and signed off before any PR is opened

---

*Plan authored: 2026-06-04 — based on stakeholder answers to orphaned.md Q23–59*
*Risk assessment added: 2026-06-04 — SRE/QA review against live repo source*
