# LoopBuilder Sprint Task List

Source answers for `orphaned.md` questions 9–16 have been converted into the task list below. The scope in this file is limited to `pages/admin/LoopBuilder.jsx` and the supporting routing, API, schema, and test work needed to ship it to production.

---

## Sprint tasks

### Routing and access

| Task | Probability | Risk | Mitigation to reach ~95% |
|---|---|---|---|
| Add an **Edit Loop** or **Build Loop** button to each row in Loop Management and route it into LoopBuilder from that screen only | 95% | Straightforward UI addition; minimal dependencies | Already high — proceed directly |
| Register the `admin/loops/:id` route in `App.jsx` pointing to `LoopBuilder` | 90% | Route is missing — `LoopManagement.jsx` already calls `navigate('/dashboard/admin/loops/:loop.id')` but there is no matching `<Route>` for it | See exact edit below |
| Restrict write access to users with the `loop_editor` role or higher, and show operations staff a read-only version unless they have an explicit super-admin grant | 75% | `LoopBuilder.jsx` has zero role checking — anyone who hits the route can edit and approve | Read auth user role from `AuthContext`; derive `const isReadOnly = !['loop_editor','super_admin'].includes(user.role)`; pass `disabled={isReadOnly}` to every interactive element |
| Add a visible read-only banner and disable all editing controls for non-editor users | 80% | Easy to miss stray controls across slot buttons, approve button, and asset picker | Use the single `isReadOnly` flag — one flag touches all three surfaces in one pass |

**`client-app/src/App.jsx` — exact change required:**

```
EDIT:   Add one lazy import and one Route, inside the existing admin Route block.
        Place the new Route immediately after the admin/loops line (line ~97).

ADD import (with the other admin lazy imports):
  const LoopBuilder = lazy(() => import('./pages/admin/LoopBuilder'));

ADD route (after the existing admin/loops route):
  <Route path="admin/loops/:id" element={<LoopBuilder />} />

ADD to the verified file map comment at the top:
  pages/admin/LoopBuilder.jsx   ✅

DO NOT TOUCH:
  Any other route, import, redirect, or layout wrapper.
  AuthProvider, NetworkErrorBanner, Suspense fallback, or Router config.
  The catch-all <Route path="*"> entries.
  Any brand, retailer, or techoperator routes.
```

---

### Approval rules

| Task | Probability | Risk | Mitigation to reach ~95% |
|---|---|---|---|
| Make approval mandatory before any loop can become active on screens | 85% | No status precondition exists anywhere in the approve path | Add status guard in `LoopRepository.approveLoop()` — see exact edit below |
| Audit all save and update paths to remove any direct bypass to `active` status | 70% | One missed path silently breaks the invariant | Add Firestore security rule; also add the status guard in the repository so both layers enforce it |
| Block approval when any slot is missing an assigned asset, in the UI and on the server | 85% | Dual enforcement adds coordination overhead | Preflight in `handleApproveAll` in `LoopBuilder.jsx`; mirror the check in `LoopRepository.approveLoop()` |
| Disable the approve button until all 12 slots are filled | 90% | Pure UI state logic; low complexity | Derive `allSlotsFilled` from `loop.slots` and bind to `disabled` prop with a tooltip |

**`ad-server/src/repositories/LoopRepository.js` — exact change required:**

```
EDIT:   approveLoop(loopId, userId) method only.
        Add a status precondition check and an empty-slot check before the update call.

The method currently opens with:
  const result = await this.update(loopId, { ... });

Change to:
  const loop = await this.findById(loopId);
  if (!loop) throw new Error(`Loop ${loopId} not found`);
  if (loop.status !== LOOP_STATUS.PENDING_APPROVAL) {
    throw new Error(`Loop ${loopId} cannot be approved from status: ${loop.status}`);
  }
  const emptySlots = loop.slots.filter(s => !s?.asset_id);
  if (emptySlots.length > 0) {
    throw new Error(`Loop ${loopId} has ${emptySlots.length} empty slot(s) and cannot be approved`);
  }
  const result = await this.update(loopId, { ... });

The existing schedulingAuditRepository.logAction('loop_approved', ...) call
below the update STAYS UNCHANGED.

DO NOT TOUCH:
  rejectSlot(), replaceSlot(), bookSlot(), findByDate(), findByDateAndHour()
  findPendingByRetailer(), findApprovedByScreen(), create(), validateBusinessHour()
  LOOP_STATUS or SLOT_STATUS constants.
  Any import or export.
  SchedulingAuditRepository — this file is not changed in this sprint.
```

**`ad-server/src/api/loops.js` — exact change required:**

```
EDIT:   PATCH /:id/approve route handler only.
        The repository now throws on invalid state, so the route handler
        must forward that error with a 400 instead of a 500.

Change the catch block from:
  res.status(500).json({ error: 'Failed to approve loop' });

To:
  const status = error.message.includes('cannot be approved') ? 400 : 500;
  res.status(status).json({ error: error.message });

DO NOT TOUCH:
  Any other route handler (GET /, GET /:id, POST /generate,
  PATCH /slots/:position/reject, PATCH /slots/:position/replace,
  GET /pending/:retailerId).
  The authenticate middleware imports or usage.
  The logger calls on any other route.
```

---

### Slot validation UI

| Task | Probability | Risk | Mitigation to reach ~95% |
|---|---|---|---|
| Highlight every empty slot clearly when approval is attempted | 90% | Straightforward visual state; well-scoped | Add `attempted` boolean to state; extend `getSlotStyle` with: `if (attempted && !slot?.asset_id) return 'border-red-500 bg-red-50 ring-2 ring-red-400'` |
| Show an error label for each incomplete slot | 90% | Clear and self-contained | Render label inside slot button conditionally on `attempted && !slot?.asset_id` |
| Clear error state immediately when an asset is assigned | 92% | Reactive state update | Reset `attempted` to `false` inside `handleAssetSelect` on successful fill |

**`client-app/src/pages/admin/LoopBuilder.jsx` — exact changes for this section:**

```
EDIT:   Add `attempted` to the existing useState block at the top of the component.
EDIT:   Inside handleApproveAll, before the apiService call, set attempted = true
        if any slot is empty and return early.
EDIT:   Inside handleAssetSelect, after a successful slot fill, reset attempted = false.
EDIT:   Extend getSlotStyle (or equivalent slot class helper) with the empty+attempted case.
EDIT:   Render an error label node inside the slot button when attempted && !slot?.asset_id.

DO NOT TOUCH:
  The apiService import or any other API call in the file.
  The loop fetch/load logic (useEffect, loopId param reading).
  The asset picker modal open/close logic.
  The StatusBadge component or its props.
  Any other state variable already in the component.
```

---

### Confirmation flow

| Task | Probability | Risk | Mitigation to reach ~95% |
|---|---|---|---|
| Build a two-step approval confirmation dialog | 88% | Modal work is routine; two-step adds a small state machine | Add `showConfirm` boolean to state; move `apiService.approveLoop(id)` into the modal confirm handler |
| Show "You are activating this loop across N screens — confirm?" with real screen count | 78% | `screen_count` field is absent from the loop document — see gap below | Add `screen_count` to `LoopRepository.findById()` response; then read it in the component |
| Require explicit confirm and cancel before any API call | 92% | Pure UI guard | Handled once `showConfirm` state is in place |

> **Gap — `screen_count` field confirmed absent:** `LoopRepository.findById()` inherits from `BaseRepository` and returns the raw Firestore document. The loop documents produced by `LoopGenerationService` do not include a `screen_count` or `screen_ids` field — confirmed by reading `LoopRepository.js`. This field does not exist yet anywhere in the data model.

**`ad-server/src/repositories/LoopRepository.js` — additional change for screen count:**

```
EDIT:   findApprovedByScreen(screenId, date) already filters by screen_id.
        The simplest safe approach is to add screen_count as a virtual field
        in the approveLoop response and in findById by joining against a
        screens query — OR store screen_ids as an array on the loop document
        at generation time.

        Recommended: add screen_ids: [loop.screen_id] to the loop document
        in LoopRepository.create() so it is stored at generation time, and
        add screen_count: loop.screen_ids?.length ?? 1 to the GET /:id
        response in loops.js.

DO NOT TOUCH:
  Anything outside create() and the GET /:id route handler for this change.
  bookSlot, rejectSlot, replaceSlot, or any other method.
```

---

### Version handling

| Task | Probability | Risk | Mitigation to reach ~95% |
|---|---|---|---|
| Editing an approved loop creates a new draft version instead of overwriting | 68% | `replaceSlot` writes directly to the existing document with no status check | Add clone logic in `LoopRepository.replaceSlot()` — see exact edit below |
| Move re-edited loop back to `pending_approval` | 80% | Handled automatically by the clone | No separate change needed |
| Preserve the approved version as the live fallback | 65% | Ad-server `findApprovedByScreen` filters by status only, not version | Add `version` field to loop documents and sort by it in `findApprovedByScreen` |
| Show `Draft v2 — Pending Approval` in the UI | 85% | Trivial once `loop.version` is in the API response | Read `loop.version` from response; render next to `StatusBadge` |
| Defer rollback UI and version history UI to post-MVP | 98% | Non-action | No action needed |

> ⚠️ **Breaking change — version cloning response shape:** `replaceSlot` currently returns the same loop document with the same `id`. Once clone logic is added, editing an approved loop returns a **new document with a different `id`**. `LoopBuilder.jsx`'s `handleAssetSelect` stores `loop.id` in local state and reuses it for every subsequent slot call. If the component is not updated in the same deploy, subsequent calls write to the old approved document and silently corrupt it. **Server and client changes must ship in the same deploy.**

**`ad-server/src/repositories/LoopRepository.js` — exact change for versioning:**

```
EDIT:   replaceSlot(loopId, position, newAssetId) method only.
        Add a status check at the top: if the loop is APPROVED, clone it
        before applying the slot change.

Insert before the existing slots mutation:
  if (loop.status === LOOP_STATUS.APPROVED) {
    const newId = `${loopId}_v${(loop.version ?? 1) + 1}`;
    const clonedSlots = [...loop.slots];
    clonedSlots[position] = {
      ...clonedSlots[position],
      asset_id: newAssetId,
      status: SLOT_STATUS.REPLACED,
      replaced_at: new Date().toISOString()
    };
    return this.create(newId, {
      ...loop,
      id: newId,
      status: LOOP_STATUS.PENDING_APPROVAL,
      version: (loop.version ?? 1) + 1,
      parentLoopId: loopId,
      slots: clonedSlots,
      approved_at: null,
      approved_by: null
    });
  }
  // existing code continues unchanged for non-APPROVED loops

DO NOT TOUCH:
  approveLoop(), rejectSlot(), bookSlot(), findByDate(),
  findPendingByRetailer(), findApprovedByScreen(), create(), validateBusinessHour().
  LOOP_STATUS or SLOT_STATUS constants.
```

**`client-app/src/pages/admin/LoopBuilder.jsx` — exact change for versioning:**

```
EDIT:   handleAssetSelect only.
        After a successful apiService.replaceLoopSlot() call, update local
        state with the full response object — including its id — not just
        the slots array. This ensures subsequent slot calls use the new
        document id if a clone occurred.

Change from (approximate current pattern):
  setLoop(prev => ({ ...prev, slots: updatedSlots }))

Change to:
  setLoop(responseLoop)   // where responseLoop is the full object returned by the API

DO NOT TOUCH:
  Any other state setter in the component.
  The loopId URL param — do not re-derive it from loop.id for the URL.
  The asset picker, approval dialog, or StatusBadge logic.
```

---

### Audit logging

| Task | Probability | Risk | Mitigation to reach ~95% |
|---|---|---|---|
| Log every save action with loop ID, user ID, timestamp, and loop version | 85% | `SchedulingAuditRepository.logAction()` already exists and is used by `approveLoop` and `bookSlot` — just needs to be called from `replaceSlot` too | Add `schedulingAuditRepository.logAction('slot_replaced', {...})` to `replaceSlot` after the update call — same pattern as `rejectSlot` and `bookSlot` |
| Log every approve action with loop ID, user ID, timestamp, version, and screen count | 82% | `approveLoop` already logs via `schedulingAuditRepository` — add `version` and `screen_count` to the metadata | Extend the existing `logAction` call in `approveLoop` with `version: loop.version` and `screen_count: loop.screen_ids?.length ?? 1` |
| Confirm the audit log schema before writing | 88% | Schema already exists: `scheduling_audits` Firestore collection via `SchedulingAuditRepository` | No new collection needed — use the existing `schedulingAuditRepository.logAction()` in all cases |
| Defer audit log browsing UI to post-MVP | 98% | Non-action | No action needed |

> **Gap — `userId` anonymous fallback:** `PATCH /:id/approve` in `loops.js` reads `userId` from `req.body.userId || req.user?.uid || 'anonymous'`. The `'anonymous'` fallback means audit logs can be written with no traceable user. Remove it — if `req.user?.uid` is absent after the `authenticate` middleware runs, fail the request with `return res.status(401).json({ error: 'Authenticated user required' })` before calling `loopRepository.approveLoop()`.

**`ad-server/src/repositories/LoopRepository.js` — exact change for audit logging:**

```
EDIT:   replaceSlot() method only.
        After the return this.update(...) call, add:

  await schedulingAuditRepository.logAction('slot_replaced', {
    entity_id: loopId,
    slot_index: position,
    asset_id: newAssetId,
    user_id: null,   // userId not available in repository layer;
                     // pass it as a parameter from loops.js PATCH handler
    timestamp: new Date().toISOString()
  });

  Note: replaceSlot currently takes (loopId, position, newAssetId).
  Add userId as a fourth parameter and thread it from the PATCH route handler.

EDIT:   approveLoop() logAction call — extend existing metadata only:
  Change from:
    { entity_id: loopId, user_id: userId, timestamp: ... }
  Change to:
    { entity_id: loopId, user_id: userId, version: loop.version ?? 1,
      screen_count: loop.screen_ids?.length ?? 1, timestamp: ... }

DO NOT TOUCH:
  SchedulingAuditRepository itself — logAction() signature is correct as-is.
  rejectSlot(), bookSlot(), findByDate() — their existing logAction calls are unchanged.
  Any import or export in LoopRepository.js.
```

---

### QA and testing

| Task | Probability | Risk | Mitigation to reach ~95% |
|---|---|---|---|
| E2E happy path: open from Loop Management, fill all 12 slots, confirm approval, verify activation and audit log | 72% | Async timing against Firestore is the main failure mode | Use `waitForSelector('[data-testid="approve-loop-btn"]:not([disabled])')` as the fill-complete anchor; assert on the Firestore emulator REST API for the audit log entry |
| E2E blocked path: incomplete loop, disabled approve button, visible slot errors, server-side rejection | 75% | Simpler than happy path; fewer async steps | Assert `approve-loop-btn` has `disabled` attribute; assert slot error labels are visible |
| Role enforcement test: operations staff cannot save or approve | 80% | Depends on clean role mocking in test environment | Mock `AuthContext` to return `role: 'operations'`; assert all slot buttons and approve button are `disabled` and read-only banner is visible |
| Audit log verification: save and approve both write expected records | 70% | Requires asserting Firestore writes in test environment | Assert against the Firestore emulator REST API after each action |

---

## Key sequencing rules

1. **`LoopRepository.js` changes first** — status guard in `approveLoop`, clone logic in `replaceSlot`, and audit log extension must all be done before any client work
2. **`App.jsx` route registration** before any LoopBuilder UI work is tested end-to-end
3. **`screen_ids` field added in `create()`** before the confirmation dialog is built
4. **`LoopBuilder.jsx` `handleAssetSelect` updated to consume full response object** must ship in the same deploy as the `replaceSlot` clone logic — never separately

---

## Files to edit — complete list

| File | What to edit | What NOT to touch |
|---|---|---|
| `client-app/src/App.jsx` | Add one `lazy` import for `LoopBuilder`; add one `<Route path="admin/loops/:id">` after the existing `admin/loops` route; update the verified file map comment | Every other route, import, layout, redirect, AuthProvider, Suspense, NetworkErrorBanner |
| `client-app/src/pages/admin/LoopBuilder.jsx` | `handleAssetSelect` (consume full response), `handleApproveAll` (slot preflight + confirmation dialog), `getSlotStyle` (empty+attempted case), add `attempted` and `showConfirm` state, add read-only banner and `isReadOnly` flag | Loop fetch logic, asset picker open/close, StatusBadge, loopId URL param derivation, any other state variable |
| `client-app/src/pages/admin/LoopManagement.jsx` | Add Edit Loop / Build Loop button per row reusing the existing `navigate('/dashboard/admin/loops/${loop.id}')` call | The hourly grid, generate button, date picker, stats cards, fetch logic, toast system |
| `ad-server/src/api/loops.js` | `PATCH /:id/approve` catch block (400 vs 500); `userId` anonymous fallback removal; thread `userId` into `replaceSlot` call | All other route handlers, middleware imports, logger calls on other routes |
| `ad-server/src/repositories/LoopRepository.js` | `approveLoop()` (add status + empty-slot guard, extend audit metadata); `replaceSlot()` (add clone logic for APPROVED loops, add userId param, add audit log call); `create()` (add `screen_ids` field); `findApprovedByScreen()` (sort by version desc) | `rejectSlot()`, `bookSlot()`, `findByDate()`, `findByDateAndHour()`, `findPendingByRetailer()`, `validateBusinessHour()`, all constants, all imports/exports |
| `ad-server/src/repositories/SchedulingAuditRepository.js` | **Do not edit this file at all** | Entire file |
| `ad-server/src/repositories/BaseRepository.js` | **Do not edit this file at all** | Entire file |
| `ad-server/src/services/LoopGenerationService.js` | **Do not edit this file at all** | Entire file |
| `ad-server/src/services/BusinessHoursService.js` | **Do not edit this file at all** | Entire file |
| All brand, retailer, and techoperator pages | **Do not edit any of these** | Entire files |

---

## MVP boundaries

The current decision is to ship LoopBuilder to production now because it is functionally close to complete and a core workflow. Version history UI, rollback UI, and audit log viewing UI are explicitly deferred to post-MVP, while approval gating and audit logging are hard launch requirements.

## Sprint risk summary

The **version handling group** (65–68% on the core tasks) and the **bypass path audit** (70%) are the highest-risk items. Both are mitigated by working server-side first in `LoopRepository.js` and letting the client follow the server contract.

The only task that can break **existing production data** if sequenced incorrectly is version cloning — `LoopRepository.replaceSlot` changes and `LoopBuilder.handleAssetSelect` changes must be deployed together.
