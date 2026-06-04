# LoopBuilder Sprint Task List

Source answers for `orphaned.md` questions 9–16 have been converted into the task list below. The scope in this file is limited to `pages/admin/LoopBuilder.jsx` and the supporting routing, API, schema, and test work needed to ship it to production.

## Sprint tasks

### Routing and access

| Task | Probability | Risk | Mitigation to reach ~95% |
|---|---|---|---|
| Add an **Edit Loop** or **Build Loop** button to each row in Loop Management and route it into LoopBuilder from that screen only | 95% | Straightforward UI addition; minimal dependencies | Already high — proceed directly |
| Add or confirm the route for LoopBuilder so it opens with the selected loop ID from Loop Management | 90% | Low risk — likely already partially wired; param passing is simple | Verify `useParams` receives `id` correctly in current router config before building |
| Restrict write access to users with the `loop_editor` role or higher, and show operations staff a read-only version unless they have an explicit super-admin grant | 75% | Current `LoopBuilder.jsx` has zero role checking — anyone who hits the route can edit and approve | Read auth user role from context at component top; derive `const isReadOnly = !['loop_editor','super_admin'].includes(user.role)`; pass `disabled={isReadOnly}` to every interactive element |
| Add a visible read-only banner and disable all editing controls for non-editor users | 80% | Easy to miss stray controls across slot buttons, approve button, and asset picker | Use the single `isReadOnly` flag from above — one flag touches all three surfaces in one pass rather than auditing each control individually |

> **Gap — routing:** `LoopManagement.jsx` currently navigates to `/dashboard/admin/loops/:loop.id` on the hour-cell `onClick` only. There is no dedicated Edit Loop button per row. The navigate path already exists and works, so adding the button is additive and safe — but `App.jsx` must be checked to confirm the `/loops/:id` route is registered before this task is marked done.

### Approval rules

| Task | Probability | Risk | Mitigation to reach ~95% |
|---|---|---|---|
| Make approval mandatory before any loop can become active on screens | 85% | Requires tracing all status-change paths including background or admin shortcuts | Add a Firestore security rule enforcing `status == 'PENDING_APPROVAL'` as a precondition for any write that sets `status == 'APPROVED'`; closes the bypass at the data layer |
| Audit all save and update paths to remove any direct or accidental bypass to `active` status outside the approve action | 70% | Bypass paths are often undocumented; one missed API route silently breaks the invariant | Combine the Firestore rule above with a server-side check in `loops.js` that rejects any `APPROVED` write unless the document is currently `PENDING_APPROVAL` |
| Block approval when any slot is missing an assigned asset, both in the UI and on the server | 85% | Dual enforcement (UI + server) adds coordination overhead | Add preflight directly in `handleApproveAll` before the API call: `const emptySlots = loop.slots.map((s,i) => !s?.asset_id ? i+1 : null).filter(Boolean); if (emptySlots.length > 0) { /* show error, return early */ }` — three lines, eliminates the UI path; mirror in `loops.js` closes the API path |
| Disable the approve button until all 12 slots are filled and explain why it is disabled | 90% | Pure UI state logic; low complexity | Already near-certain — derive `allSlotsFilled` from `loop.slots` and bind to `disabled` prop with a tooltip |

> **Gap — approve endpoint:** `PATCH /:id/approve` in `loops.js` has no precondition check on current loop status. It calls `loopRepository.approveLoop()` unconditionally. Any caller — including a direct API call — can approve a loop that is already approved or in any other state. The server-side status guard task above is not optional; it is the only thing closing this hole.

### Slot validation UI

| Task | Probability | Risk | Mitigation to reach ~95% |
|---|---|---|---|
| Add per-slot validation so every empty slot is highlighted clearly when approval is attempted | 90% | Straightforward visual state; well-scoped | Add `attempted` boolean to state, set it `true` when approve is clicked with empty slots, extend `getSlotStyle` with: `if (attempted && !slot?.asset_id) return 'border-red-500 bg-red-50 ring-2 ring-red-400'` |
| Show a clear error label for each incomplete slot, identifying which slot needs an asset | 90% | Clear and self-contained | Render an error label inside the slot button conditionally on `attempted && !slot?.asset_id` |
| Clear the error state immediately when an asset is assigned to that slot | 92% | Reactive state update; simplest task in this group | Reset `attempted` to `false` in `handleAssetSelect` when a slot is successfully filled, or re-derive from `loop.slots` on every render |

### Confirmation flow

| Task | Probability | Risk | Mitigation to reach ~95% |
|---|---|---|---|
| Build a two-step approval confirmation dialog instead of a one-click approve action | 88% | Modal work is routine; two-step adds a small state machine | Add `showConfirm` boolean to state; render modal conditionally; move `apiService.approveLoop(id)` call into modal's confirm handler — additive change, no risk to existing flow |
| Show the message: "You are activating this loop across N screens — confirm?" with the real screen count | 78% | Depends on whether `loop` data carries its screen count | **Do this first**: confirm whether `loopData` from `apiService.getLoop()` includes `screen_ids` or `screen_count`; if absent, add it to the `getLoop` response in `loops.js` before building the modal — sequence: confirm data shape → build dialog |
| Require explicit confirm and cancel actions in the modal before any approve API call is fired | 92% | Pure UI guard; low risk | Already near-certain once `showConfirm` state is in place |

> **Gap — screen count field:** `GET /:id` in `loops.js` returns whatever `loopRepository.findById()` returns with no field projection. It is unconfirmed whether the loop document includes `screen_ids` or `screen_count`. This must be verified against the Firestore schema before the confirmation dialog task is started. If the field is absent, it must be added to the repository response first.

### Version handling

| Task | Probability | Risk | Mitigation to reach ~95% |
|---|---|---|---|
| Change the save flow so editing an approved loop creates a new draft version instead of overwriting the approved version | 68% | Highest complexity task — current `handleAssetSelect` calls `apiService.replaceLoopSlot` directly on the existing document | Server (`loops.js`) must detect when loop `status == 'APPROVED'` and clone the document with a new `version` number and `PENDING_APPROVAL` status before applying the slot change; define this server contract and schema first — the client just reads what the server returns |
| Move the edited loop version back to `pending_approval` after re-editing | 80% | Straightforward status update, depends on version branching above being correct | Handled automatically by the server-side clone logic above; no separate client change needed |
| Preserve the previously approved version as the live fallback until the new version is approved | 65% | Requires ad-server to resolve "active version" correctly — touches serving, not just admin UI | Change the ad-server loop query to `where('status','==','APPROVED').orderBy('version','desc').limit(1)`; allocate explicit QA time to confirm no serving regression |
| Show the current loop version and state in the UI, for example: `Draft v2 — Pending Approval` | 85% | Display is simple once version data is available; risk is upstream data shape | Read `loop.version` from the API response; render inline next to the existing `StatusBadge` — trivial once the server returns the field |
| Defer rollback UI and version history UI to post-MVP; do not build those screens now | 98% | Non-action; near-certain to succeed | No action needed |

> ⚠️ **Breaking change — version cloning response shape:** `PATCH /:id/slots/:position/replace` currently returns the same loop document with the same `id`. Once the server-side clone logic is added, editing an approved loop will return a **new document with a different `id`**. `LoopBuilder.jsx`'s `handleAssetSelect` stores `loop.id` in local state and reuses it for every subsequent slot call. If the component is not updated to re-read `loop.id` from the API response after the first edit, all subsequent slot calls will target the old (approved) document and silently corrupt it. **This is the only task in this sprint that can break existing production data if sequenced incorrectly. Server changes and client changes must ship together in the same deploy.**

### Audit logging

| Task | Probability | Risk | Mitigation to reach ~95% |
|---|---|---|---|
| Write an audit log entry for every save action with loop ID, user ID, timestamp, and loop version | 85% | Main risk is missing edge cases (auto-save, bulk save) | Current code has no auto-save; the only save event is `replaceLoopSlot`. Add `addAuditLog()` call inside `handleAssetSelect`'s `try` block immediately after the successful `replaceLoopSlot` call |
| Write an audit log entry for every approve action with loop ID, user ID, timestamp, loop version, and screen count | 82% | Screen count adds a small join/query risk at log-write time | Screen count will already be available in state once the confirmation dialog task is done; pass it directly to `addAuditLog()` in `handleApproveAll`'s `try` block |
| Confirm or create the Firestore schema for loop audit logs before implementing the logging writes | 88% | Main risk is a migration if existing data needs retrofitting | **Do this first before any logging writes**; define `loop_audit_log` collection with fields: `loopId`, `userId`, `action`, `timestamp`, `version`, `screenCount` |
| Defer the audit log browsing UI to post-MVP; database logging is the launch requirement | 98% | Non-action | No action needed |

> **Gap — `userId` in approve route:** `PATCH /:id/approve` reads `userId` from `req.body.userId || req.user?.uid || 'anonymous'`. The `'anonymous'` fallback means audit logs can be written with no traceable user if the auth middleware fails silently. Before audit logging is considered complete, confirm that `req.user?.uid` is always populated by the `authenticate` middleware and remove the `'anonymous'` fallback — or fail the request explicitly if `uid` is absent.

### QA and testing

| Task | Probability | Risk | Mitigation to reach ~95% |
|---|---|---|---|
| Add an end-to-end test for the happy path: open from Loop Management, fill all 12 slots, confirm approval, and verify activation plus audit logging | 72% | E2E tests touching approval flow and Firestore are brittle — async timing is the main failure mode | Write Playwright waits against existing `data-testid` attributes already in the JSX (`slot-grid`, `slot-0` through `slot-11`, `approve-loop-btn`) instead of arbitrary timeouts; use `waitForSelector('[data-testid="approve-loop-btn"]:not([disabled])')` as the fill-complete anchor |
| Add an end-to-end test for the blocked path: incomplete loop, disabled approval, visible empty-slot errors, and server-side rejection | 75% | Slightly simpler than happy path; fewer async steps | Same `data-testid` strategy; assert `approve-loop-btn` has `disabled` attribute and that slot error labels are visible |
| Add a role enforcement test confirming operations staff without editor rights cannot save or approve | 80% | Depends on role mocking being clean in the test environment | Mock the auth context to return `role: 'operations'`; assert all slot buttons and approve button are `disabled` and the read-only banner is visible |
| Add an audit log verification test confirming save and approve both write the expected records | 70% | Requires asserting on Firestore writes in a test environment | Use the Firestore emulator (confirmed present via `playwright.config.js`); assert on the emulator REST API after each test action rather than mocking Firestore — gives real write verification without production data |

## Key sequencing rules

Three tasks must be done before others can succeed:

1. **Schema first** — define `loop.version`, `loop.parentLoopId`, and `loop_audit_log` collection before writing any versioning or logging code
2. **Confirm `loop.screen_count` in API response** before building the confirmation dialog
3. **Server-side clone logic** in `loops.js` before any client-side version display work — and the client update that re-reads `loop.id` from the response **must ship in the same deploy**

## Files expected to change

| Area | Likely files |
|---|---|
| Routing | `client-app/src/pages/admin/LoopManagement.jsx`, `client-app/src/App.jsx` |
| Editor UI | `client-app/src/pages/admin/LoopBuilder.jsx` |
| Loop API | `ad-server/src/api/loops.js` |
| Schema | `docs/database_schema.md` and Firestore audit log collection setup |
| Tests | `tests/` |

## MVP boundaries

The current decision is to ship LoopBuilder to production now because it is functionally close to complete and a core workflow. Version history UI, rollback UI, and audit log viewing UI are explicitly deferred to post-MVP, while approval gating and audit logging are hard launch requirements.

## Sprint risk summary

The **version handling group** (65–68% on the core tasks) and the **bypass path audit** (70%) are the highest-risk items. Both are mitigated by working server-side first and letting the client follow the server contract, rather than building UI before the data model is confirmed.

The only task that can break **existing production data** if sequenced incorrectly is version cloning — server and client changes must be deployed together.
