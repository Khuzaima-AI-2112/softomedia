# Sprint Tasks — `pages/admin/LoopBuilder.jsx`

Answers 9–16 from `orphaned.md` converted to sprint tasks with completion status.
All items reflect the state of the `fix/loop-management-api-mismatch` branch.

---

## Routing & Access

- [x] **Edit Loop / Build Loop button** in Loop Management row → navigates to `/dashboard/admin/loops/${loop.id}`
  - `LoopManagement.jsx` renders the button per hour cell inside the `loop ? (...)` branch
- [x] **Route registered** — `admin/loops/:id` → `<LoopBuilder />` in `App.jsx`; verified file map updated
- [x] **Role guard** — `EDITOR_ROLES = ['loop_editor', 'super_admin', 'admin']`; `isReadOnly` derived from `useAuth()`; defaults to read-only if role is undefined
- [x] **Read-only view** — amber banner shown + all slot buttons and approve button disabled for non-editor roles
- [x] **Entry point is Loop Management only** — no route through Campaigns or Screens exists

---

## Slot Validation & Empty State UI

- [x] **Block approve if any slot is empty** — enforced in UI (`allSlotsFilled` guard on approve button) AND in `LoopRepository.approveLoop()` (server-side throws 400 if any slot has no `asset_id`)
- [x] **Empty slot error state** — `attempted` flag triggers `ring-2 ring-red-400` border + `error` icon + `"Required"` label per empty slot when approve is clicked
- [x] **Approve button tooltip** — `title="Fill all 12 slots before approving"` shown when `!allSlotsFilled`
- [x] **No auto-fill** — empty slots stay empty; no default asset is assigned

---

## Approval Flow

- [x] **Approval is mandatory** — no code path in UI or API sets a loop live without `PATCH /api/loops/:id/approve`
- [x] **Confirmation dialog** — `handleApproveClick` validates slots then opens `showConfirm` modal with: *"You are activating this loop across N screens — confirm?"* where N = `loop.screen_count ?? loop.screen_ids?.length ?? 1`
- [x] **Two-step UI** — Step 1: click Approve button (validates + opens dialog). Step 2: click "Yes, approve loop" in dialog (calls API). Distinct actions, no single-click bypass.
- [x] **`GET /api/loops/:id`** returns `screen_count: loop.screen_ids?.length ?? 1` for the dialog copy

---

## Versioning & Re-editing

- [x] **Re-editing an approved loop creates a new draft** — `LoopRepository.replaceSlot()` clones the approved document into `loopId_vN` with `status: PENDING_APPROVAL` and `version: N+1`; original approved doc is untouched
- [x] **Approval gates each version, not the loop entity** — cloned draft goes back through the full approval flow
- [x] **Client consumes full response** — `LoopBuilder.handleAssetSelect` stores the entire returned object (`setLoop(responseLoop)`), so if the clone produced a new `id`, all subsequent slot calls use the new id
- [x] **Version badge in header** — `v{loop.version} — Pending Approval` rendered when `loop.version > 1`
- [x] **Rollback UI deferred** — version field persisted to DB as groundwork; no history/rollback screen built at launch

---

## Audit Logging

- [x] **Slot save (replace) logged** — `schedulingAuditRepository.logAction('slot_replaced', { entity_id, slot_index, asset_id, user_id, version, timestamp })` called in `LoopRepository.replaceSlot()` for both clone (approved) and in-place (pending) paths
- [x] **Approve action logged** — `schedulingAuditRepository.logAction('loop_approved', { entity_id, user_id, version, screen_count, timestamp })` called in `LoopRepository.approveLoop()`
- [x] **Reject and book also logged** — `slot_rejected` and `slot_booked` events already instrumented
- [x] **No anonymous fallback** — `PATCH /:id/approve` returns 401 if `req.user?.uid` is absent after auth middleware; `'anonymous'` fallback removed
- [x] **Audit log UI deferred** — DB writes live at launch; browsing/review UI post-MVP

---

## Bug Fixes Completed in This Sprint

| File | Bug | Fix |
|---|---|---|
| `LoopManagement.jsx` | `setLoops(data \|\| [])` stored the full `{ loops, business_hours }` object — grid rendered 0 cards | Changed to `setLoops(data?.loops \|\| [])` |
| `LoopManagement.jsx` | `generateLoops` payload used snake_case keys the backend never reads (`target_date`, `retailer_id`, `store_id`) — backend returned 400 every time | Changed to `{ targetDate, retailerId, locationId }` matching backend destructure |

---

## QA Checklist

- [ ] **Happy path** — Loop Management → Edit Loop → fill all 12 slots → Approve → confirmation dialog shows correct screen count → confirm → loop enters `APPROVED` state
- [ ] **Blocked path** — attempt Approve with ≥1 empty slot → button disabled + red error ring on empty slots + toast; server also returns 400 if called directly
- [ ] **Role enforcement** — operations staff sees amber read-only banner; all slot buttons and approve button are disabled; `loop_editor`+ can write
- [ ] **Re-edit approved loop** — slot replace on an `APPROVED` loop returns a new document with incremented version and `PENDING_APPROVAL` status; original doc unchanged
- [ ] **Audit log entries** — verify `slot_replaced` and `loop_approved` records written to DB with correct `user_id` and `timestamp` after each action
- [ ] **Generate loops** — payload reaches backend, 201 returned, grid populates for the selected date
- [ ] **Read-only operations staff cannot save/approve** — verified in browser and in API (missing `loop_editor` role returns appropriate error)
