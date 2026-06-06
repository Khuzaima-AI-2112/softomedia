# Sprint — Loop Management Fix & Data Foundation

**Sprint Goal:** Restore Loop Management to a working state, fix the API method mismatch that is breaking the page, and seed the minimum data needed to exercise the full LoopBuilder workflow end to end.

---

## Track 1 — Client Bug Fix

- [ ] **Audit `ApiService` exports** — list every method currently exported from `client-app/src/services/ApiService.*`; identify which methods `LoopManagement.jsx` is calling that do not exist
- [ ] **Fix `getLoopsByDate(date)`** — add the method to `ApiService` if missing, or rename the call in `LoopManagement.jsx` to match the real method name
- [ ] **Fix `generateLoops(date)`** — same as above; wire the **Generate Loops** button to the correct service call
- [ ] **Verify response shape** — confirm the loop objects returned by the backend include `id`, `hour`, `status`, `slots`, `version`, `screen_ids`; update client-side destructuring if shape changed
- [ ] **Smoke test** — open Loop Management, select today's date, confirm no console errors and the hourly grid populates

---

## Track 2 — Edit Loop Rendering Fix

- [ ] **Audit `LoopManagement.jsx` render logic** — find the condition that decides to show "No loop generated" vs. a loop card; confirm **Edit Loop** button is inside the loop-exists branch, not the empty branch
- [ ] **Confirm `LoopManagement.jsx` → `useNavigate`** — verify the Edit Loop button navigates to `/dashboard/admin/loops/:id` using the correct loop `id` field from the API response
- [ ] **Add fetch error state** — if `getLoopsByDate` fails, show an explicit toast or inline error banner rather than silently falling back to empty cards

---

## Track 3 — Backend Verification

- [ ] **Verify loop fetch endpoint** — `GET /loops?date=YYYY-MM-DD` (or equivalent) returns loops for a given date; confirm route exists and is not 404
- [ ] **Verify loop generation endpoint** — `POST /loops/generate` (or equivalent) creates loop documents for all business hours for a given date; confirm it returns the new loop records
- [ ] **Verify loop fetch includes slot and screen data** — response must include `slots[]` array and `screen_ids[]` so LoopBuilder and the approval dialog have what they need

---

## Track 4 — Seed Data

- [ ] **Seed loops** — generate or insert loop records for one test date covering all 14 business hours (8AM–9PM); status can be `PENDING_APPROVAL` or `EMPTY`
- [ ] **Seed assets** — insert 12+ sample image/video asset records into Firestore so slots can be assigned in LoopBuilder; each asset needs `id`, `filename`, `file_type`
- [ ] **Seed screens** — insert 1–3 sample screen records and link their IDs to at least one of the seeded loops via `screen_ids`; this ensures the approval confirmation shows a real screen count
- [ ] **Verify seed** — open Loop Management, select the seeded date, confirm all 14 hour cards show a real loop (not "No loop generated"), and at least one has an **Edit Loop** button

---

## Track 5 — End-to-End QA

- [ ] **Load flow** — Loop Management loads loops for a date without console errors
- [ ] **Generate flow** — clicking **Generate Loops** creates loops for an empty date and the grid updates
- [ ] **Edit flow** — clicking **Edit Loop** opens LoopBuilder for the correct loop
- [ ] **Slot fill flow** — assign assets to all 12 slots; verify all slot tiles fill and counter reads "12/12"
- [ ] **Approval flow** — click Approve, confirm dialog shows correct screen count, confirm, verify status changes to Active
- [ ] **Read-only flow** — log in as operations role, confirm amber banner appears, Edit Loop is read-only, Approve button is absent
- [ ] **Error flow** — remove an asset from a slot after triggering approve; verify red slot error state and blocked approval
