# LoopBuilder Sprint Task List

Source answers for `orphaned.md` questions 9–16 have been converted into the task list below. The scope in this file is limited to `pages/admin/LoopBuilder.jsx` and the supporting routing, API, schema, and test work needed to ship it to production.

## Sprint tasks

### Routing and access

| Task | Probability | Risk |
|---|---|---|
| Add an **Edit Loop** or **Build Loop** button to each row in Loop Management and route it into LoopBuilder from that screen only | 95% | Straightforward UI addition; minimal dependencies |
| Add or confirm the route for LoopBuilder so it opens with the selected loop ID from Loop Management | 90% | Low risk — likely already partially wired; param passing is simple |
| Restrict write access to users with the `loop_editor` role or higher, and show operations staff a read-only version unless they have an explicit super-admin grant | 75% | Depends on how cleanly roles are currently modelled; super-admin override adds edge case complexity |
| Add a visible read-only banner and disable all editing controls for non-editor users | 80% | UI work is clear but easy to miss stray controls; requires thorough audit of every interactive element |

### Approval rules

| Task | Probability | Risk |
|---|---|---|
| Make approval mandatory before any loop can become active on screens | 85% | Requires tracing all status-change paths, including any background or admin shortcuts |
| Audit all save and update paths to remove any direct or accidental bypass to `active` status outside the approve action | 70% | **Hidden risk** — bypass paths are often undocumented; one missed API route can silently break the invariant |
| Block approval when any slot is missing an assigned asset, both in the UI and on the server | 85% | Well-defined requirement; the dual enforcement (UI + server) adds a bit of coordination overhead |
| Disable the approve button until all 12 slots are filled and explain why it is disabled | 90% | Pure UI state logic; low complexity |

### Slot validation UI

| Task | Probability | Risk |
|---|---|---|
| Add per-slot validation so every empty slot is highlighted clearly when approval is attempted | 90% | Straightforward visual state; well-scoped |
| Show a clear error label for each incomplete slot, identifying which slot needs an asset | 90% | Clear and self-contained |
| Clear the error state immediately when an asset is assigned to that slot | 92% | Reactive state update; simplest task in this group |

### Confirmation flow

| Task | Probability | Risk |
|---|---|---|
| Build a two-step approval confirmation dialog instead of a one-click approve action | 88% | Modal work is routine; two-step adds a small state machine but nothing exotic |
| Show the message: "You are activating this loop across N screens — confirm?" with the real screen count | 78% | Depends on a clean, reliable way to query how many screens the loop is assigned to; could surface a missing data relationship |
| Require explicit confirm and cancel actions in the modal before any approve API call is fired | 92% | Pure UI guard; low risk |

### Version handling

| Task | Probability | Risk |
|---|---|---|
| Change the save flow so editing an approved loop creates a new draft version instead of overwriting the approved version | 68% | **Highest complexity task** — version branching in Firestore requires a schema decision and careful save-flow refactor |
| Move the edited loop version back to `pending_approval` after re-editing | 80% | Straightforward status update, but depends on the version branching above being correct |
| Preserve the previously approved version as the live fallback until the new version is approved | 65% | Requires the ad-server to resolve "active version" correctly — a logic change that touches serving, not just the admin UI |
| Show the current loop version and state in the UI, for example: `Draft v2 — Pending Approval` | 85% | UI display is simple once version data is available; risk is upstream data shape |
| Defer rollback UI and version history UI to post-MVP; do not build those screens now | 98% | Non-action; near-certain to succeed |

### Audit logging

| Task | Probability | Risk |
|---|---|---|
| Write an audit log entry for every save action with loop ID, user ID, timestamp, and loop version | 85% | Well-understood pattern in Firestore; main risk is missing edge cases (auto-save, bulk save) |
| Write an audit log entry for every approve action with loop ID, user ID, timestamp, loop version, and screen count | 82% | Same pattern; screen count adds a small join/query risk at log-write time |
| Confirm or create the Firestore schema for loop audit logs before implementing the logging writes | 88% | Schema design is straightforward; main risk is a migration if existing data needs retrofitting |
| Defer the audit log browsing UI to post-MVP; database logging is the launch requirement | 98% | Non-action |

### QA and testing

| Task | Probability | Risk |
|---|---|---|
| Add an end-to-end test for the happy path: open from Loop Management, fill all 12 slots, confirm approval, and verify activation plus audit logging | 72% | E2E tests touching approval flow, slot fills, and audit logs are brittle — Firestore emulator setup and async timing are common failure points |
| Add an end-to-end test for the blocked path: incomplete loop, disabled approval, visible empty-slot errors, and server-side rejection | 75% | Slightly simpler than happy path; fewer async steps |
| Add a role enforcement test confirming operations staff without editor rights cannot save or approve | 80% | Well-scoped; depends on role mocking being clean in the test environment |
| Add an audit log verification test confirming save and approve both write the expected records | 70% | Requires asserting on Firestore writes in a test environment — setup friction is the main risk |

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

The **version handling group** (65–68% on the core tasks) and the **bypass path audit** (70%) are the highest-risk items. Both touch data model assumptions that may not be fully resolved yet and are likely to surface scope that wasn't visible when the tasks were written.
