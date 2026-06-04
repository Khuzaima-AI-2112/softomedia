# LoopBuilder Sprint Task List

Source answers for `orphaned.md` questions 9–16 have been converted into the task list below. The scope in this file is limited to `pages/admin/LoopBuilder.jsx` and the supporting routing, API, schema, and test work needed to ship it to production.

## Sprint tasks

### Routing and access
- [ ] Add an **Edit Loop** or **Build Loop** button to each row in Loop Management and route it into LoopBuilder from that screen only
- [ ] Add or confirm the route for LoopBuilder so it opens with the selected loop ID from Loop Management
- [ ] Restrict write access to users with the `loop_editor` role or higher, and show operations staff a read-only version unless they have an explicit super-admin grant
- [ ] Add a visible read-only banner and disable all editing controls for non-editor users

### Approval rules
- [ ] Make approval mandatory before any loop can become active on screens
- [ ] Audit all save and update paths to remove any direct or accidental bypass to `active` status outside the approve action
- [ ] Block approval when any slot is missing an assigned asset, both in the UI and on the server
- [ ] Disable the approve button until all 12 slots are filled and explain why it is disabled

### Slot validation UI
- [ ] Add per-slot validation so every empty slot is highlighted clearly when approval is attempted
- [ ] Show a clear error label for each incomplete slot, identifying which slot needs an asset
- [ ] Clear the error state immediately when an asset is assigned to that slot

### Confirmation flow
- [ ] Build a two-step approval confirmation dialog instead of a one-click approve action
- [ ] Show the message: "You are activating this loop across N screens — confirm?" with the real screen count
- [ ] Require explicit confirm and cancel actions in the modal before any approve API call is fired

### Version handling
- [ ] Change the save flow so editing an approved loop creates a new draft version instead of overwriting the approved version
- [ ] Move the edited loop version back to `pending_approval` after re-editing
- [ ] Preserve the previously approved version as the live fallback until the new version is approved
- [ ] Show the current loop version and state in the UI, for example: `Draft v2 — Pending Approval`
- [ ] Defer rollback UI and version history UI to post-MVP; do not build those screens now

### Audit logging
- [ ] Write an audit log entry for every save action with loop ID, user ID, timestamp, and loop version
- [ ] Write an audit log entry for every approve action with loop ID, user ID, timestamp, loop version, and screen count
- [ ] Confirm or create the Firestore schema for loop audit logs before implementing the logging writes
- [ ] Defer the audit log browsing UI to post-MVP; database logging is the launch requirement

### QA and testing
- [ ] Add an end-to-end test for the happy path: open from Loop Management, fill all 12 slots, confirm approval, and verify activation plus audit logging
- [ ] Add an end-to-end test for the blocked path: incomplete loop, disabled approval, visible empty-slot errors, and server-side rejection
- [ ] Add a role enforcement test confirming operations staff without editor rights cannot save or approve
- [ ] Add an audit log verification test confirming save and approve both write the expected records

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
