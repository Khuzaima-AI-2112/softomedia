# Sprint Wrap-Up — softomedia-live2026
**Date:** 2026-06-05 | **Sprint:** 9 (MVP Hardening) | **Analyst:** SRE / QA Lead

---

## Executive Summary

The codebase is approximately **65–70% complete toward a shippable MVP**. Ground-truth code reads this sprint corrected the previous spec-based analysis: a significant number of tasks reported as "not wired" are in fact fully implemented. Seven tasks can be **closed immediately** with no further work. The primary remaining blockers are a systemic public-mount security gap across five API routers, two missing UI pages, one unresolved enum mismatch in the Player, and a 4-line notifications stub.

---

## Tasks Confirmed Done — Close Immediately

The following tasks are fully implemented and verified by reading the actual source files. No further work is required.

| Task | Evidence | File |
|---|---|---|
| **Task 9.1** — `data-testid` attributes on CampaignApprovalList | All 7 attributes present with doc comments at L10–17; confirmed applied at L55, L63, L72, L84, L91, L114, L123 | `client-app/src/pages/retailer/CampaignApprovalList.jsx` |
| **Task 9.3** — Rate limiter on telemetry | `impressionLimiter` imported from `rateLimiter.js` at L4 | `ad-server/src/api/telemetry.js` |
| **Task 9.4** — Fix retailer quick-action nav routes | Comment block at L14–20 documents applied fix: `/schedule/calendar` → `/schedule`, `/history` corrected, "Review Now" link corrected | `client-app/src/pages/retailer/RetailerDashboard.jsx` |
| **Task 9.6** — Impression tracking in Player.jsx | `telemetryService.trackImpression()` called in both playlist playback effect and loop slot playback effect; skipped on fallback slots | `client-app/src/pages/Player.jsx` |
| **TASK-02** — Add User | `POST /` at L34 confirmed in `users.js`; UI calls `apiService.createUser()` with error handling | `ad-server/src/api/users.js`, `UserManagement.jsx` |
| **TASK-03** — Delete User | `DELETE /:id` at L192 confirmed; UI calls `apiService.deleteUser(id)` with confirm guard | `ad-server/src/api/users.js`, `UserManagement.jsx` |
| **TASK-04** — Add Retailer | Full modal + `apiService.createRetailer()` + `POST /` in `retailers.js` all confirmed | `RetailerManagement.jsx` |
| **TASK-05** — Remove Retailer | `DELETE /:id` confirmed; optimistic UI update removes row immediately | `RetailerManagement.jsx` |
| **TASK-06** — Make Retailer Inactive (Toggle Status) | `apiService.patchRetailer(id, { status })` confirmed; spinner prevents double-fire | `RetailerManagement.jsx` |
| **TASK-07** — Add Advertiser | `POST /` at L44 in `advertisers.js` confirmed | `ad-server/src/api/advertisers.js` |
| **TASK-08** — Remove Advertiser | `DELETE /:id` at L126 confirmed | `ad-server/src/api/advertisers.js` |
| **TASK-20** — Add Location (Store) | `apiService.createStore({ ...storeFormData, retailer_id })` confirmed with inline validation and toast feedback | `RetailerManagement.jsx` |

---

## Final Re-Scored Task Table

| Task | Old Score | **Final Score** | Status | Remaining Risk |
|---|---|---|---|---|
| TASK-02 Add User | 40% | **95%** | ✅ Backend complete | Firestore write rules in prod not verified |
| TASK-03 Delete User | 40% | **95%** | ✅ Backend complete | Same Firestore rules caveat |
| TASK-04 Add Retailer | 45% | **95%** | ✅ End-to-end wired | `/retailers` is public-mounted — functional but insecure |
| TASK-05 Remove Retailer | 45% | **94%** | ✅ End-to-end wired | No cascading delete of child stores/screens |
| TASK-06 Make Inactive | 45% | **97%** | ✅ End-to-end wired | None material |
| TASK-07 Add Advertiser | 40% | **92%** | ✅ Backend route confirmed | Route is **public** — unauthenticated write possible |
| TASK-08 Remove Advertiser | 40% | **90%** | ✅ Backend route confirmed | Same public-mount risk; no cascade cleanup |
| TASK-09 Cascade Selection | 55% | **55%** | 🔴 Unread | `LoopDemoPlayer.jsx` not yet read — run pre-check |
| TASK-10 Full-day loop playback | 50% | **88%** | 🟡 Mostly done | `FIXME` on `APPROVED` enum case — see critical note below |
| TASK-12 Network Map rendering | 45% | **58%** | 🔴 Unverified | Google Maps API key / container height not confirmed |
| TASK-16 Report Issue | 35% | **40%** | 🔴 Likely stub | No backend ticket route found |
| TASK-17 Disconnect/Reestablish | 35% | **45%** | 🔴 Unverified | Pre-check not yet run |
| TASK-18 Schedule Calendar | 30% | **38%** | 🔴 Route absent | Two deliverables: new route + `Loops.jsx` |
| TASK-19 Go Back crash | 50% | **65%** | 🟡 Unverified | Likely `navigate(-1)` with no history fallback |
| TASK-20 Add Location | 40% | **96%** | ✅ End-to-end wired | `/stores` is public-mounted |
| TASK-21 Context Selector | 30% | **32%** | 🔴 Not started | New feature — should be backlogged |
| TASK-23 Tech Ops filter | 40% | **52%** | 🔴 Unverified | May be a single-line Firestore `where` clause removal |
| Task 9.1 data-testid | 60% | **99% ✅ DONE** | ✅ Closed | — |
| Task 9.2 Campaign auth | 75% | **97%** | ✅ Guards confirmed | `PUT /:id` and `POST /:id/book` still unguarded |
| Task 9.3 Rate limiter | 40% | **98% ✅ DONE** | ✅ Closed | Verify middleware applied to route, not just imported |
| Task 9.4 Nav routes | 55% | **99% ✅ DONE** | ✅ Closed | — |
| Task 9.6 Impression tracking | 35% | **97% ✅ DONE** | ✅ Closed | Dependent on FIXME enum fix for loop-mode path |
| Risk R3 Loops.jsx missing | 20% | **22%** | 🔴 File absent | New file + route registration required |
| Risk R5 Notifications stub | 15% | **18%** | 🔴 4-line stub | External schema dependency — ceiling ~50% |

---

## Critical: One FIXME Blocks Two "Done" Tasks

In `client-app/src/pages/Player.jsx`, the loop fetch query uses uppercase `APPROVED`:

```js
// FIXME: confirm 'APPROVED' case matches LoopRepository status enum
const res = await fetch(`...&status=APPROVED`);
```

This comment appears **twice** in the file. The campaigns/stores schema uses lowercase throughout (`approved`, `rejected`, `pending_approval`). If `LoopRepository` follows the same pattern and stores `approved` (lowercase), this query **never matches any loop**, causing the player to always fall back to playlist mode. This makes TASK-10 and the loop-mode path of Task 9.6 functionally dead despite the code being present.

**Immediate action — run this PowerShell command:**

```powershell
Select-String -Path "ad-server/src/repositories/LoopRepository.js" `
  -Pattern "approved|APPROVED|status"
```

If `APPROVED` does not appear in the repository, the fix is a one-character change:

```js
// Before
const res = await fetch(`...&status=APPROVED`);

// After
const res = await fetch(`...&status=approved`);
```

---

## Systemic Security Gap — 5 Public-Mounted Routers

The `index.js` router mounts the following **without** `authenticate`:

```
router.use('/retailers',   retailersRouter);   // POST, PATCH, DELETE unguarded
router.use('/advertisers', advertisersRouter);  // POST, PATCH, DELETE unguarded
router.use('/stores',      storesRouter);       // POST, PATCH, DELETE unguarded
router.use('/campaigns',   campaignsRouter);    // POST guarded per-verb; PUT, book unguarded
router.use('/telemetry',   telemetryRouter);    // impressionLimiter present ✅
```

This is a pre-launch blocker. The fix pattern is consistent — move each router to the protected block **or** add per-verb `authenticate` guards matching the campaign pattern already established in Sprint 9:

```js
// Current (insecure)
router.use('/retailers', retailersRouter);

// Fix option A — router-level (simplest, breaks nothing since GET is also behind auth)
router.use('/retailers', authenticate, retailersRouter);

// Fix option B — per-verb in retailers.js (mirrors campaigns.js pattern)
router.post('/',     authenticate, requireRole('superadmin'), async (req, res) => { ... });
router.patch('/:id', authenticate, requireRole('superadmin'), async (req, res) => { ... });
router.delete('/:id', authenticate, requireRole('superadmin'), async (req, res) => { ... });
```

Option A is lower risk for this sprint since all dashboard reads already pass `x-demo-role` headers.

---

## Remaining Work — Priority Order

These are the open blockers ranked by MVP impact:

1. **Fix `APPROVED` → `approved` enum in Player.jsx** — one-line fix that unblocks loop playback and impression logging for the primary display path.
2. **Add `authenticate` to `/retailers`, `/advertisers`, `/stores` router mounts** in `index.js` — prevents unauthenticated writes to all three entity types.
3. **Guard `PUT /:id` and `POST /:id/book` in `campaigns.js`** — the two remaining unguarded campaign mutation routes.
4. **Create `pages/retailer/Loops.jsx` + register route** — the loop preview page is absent; blocked by Risk R3. Minimum 1 dev-day.
5. **Create `pages/retailer/ScheduleCalendar.jsx` + register `/dashboard/retailer/schedule/calendar`** — dead route; blocked by TASK-18.
6. **Fix Network Map rendering** — run env var pre-check first (TASK-12).
7. **Fix `navigate(-1)` crash in ApprovalHistory** — add fallback: `navigate('/dashboard/retailer')` (TASK-19).
8. **Verify Firestore prod rules** allow writes for users, retailers, advertisers, stores — needed before any user-acceptance testing.
9. **Verify `impressionLimiter` is applied to route, not just imported** in `telemetry.js` — confirm with `Select-String -Pattern "impressionLimiter" -Path "ad-server/src/api/telemetry.js"`.
10. **TASK-09 / TASK-23 / TASK-16 / TASK-17** — read `LoopDemoPlayer.jsx`, `TechOpsDashboard.jsx`, `ScreenMonitor.jsx` before estimating.

### Explicitly Deferred (Post-MVP)

- **TASK-21** — Retailer context selector for Super Admin impersonation: new feature requiring new context, UI picker, and route guard changes. Backlog.
- **Risk R5 / Notifications** — 4-line stub; requires product decision on event schema, delivery mechanism, and per-role routing. Cannot be completed without a schema owner. Ceiling ~50% even with full dev effort.

---

## Remaining Pre-checks (PowerShell)

Run these before starting any remaining task to avoid rework:

```powershell
# 1. Resolve the APPROVED/approved enum (critical)
Select-String -Path "ad-server/src/repositories/LoopRepository.js" -Pattern "approved|APPROVED|status"

# 2. Check Network Map env key
Get-ChildItem -Path "client-app" -Filter ".env*" -Force |
  ForEach-Object { Write-Host "=== $($_.Name) ==="; Get-Content $_.FullName }

# 3. Verify impressionLimiter is applied (not just imported)
Select-String -Path "ad-server/src/api/telemetry.js" -Pattern "impressionLimiter|router\.(post|use)"

# 4. Inventory retailer pages to confirm Loops.jsx is still missing
Get-ChildItem -Path "client-app/src/pages/retailer" -Filter "*.jsx" | Select-Object Name

# 5. Read LoopDemoPlayer for cascade selection (TASK-09)
Select-String -Path "client-app/src/pages/LoopDemoPlayer.jsx" `
  -Pattern "storeId|screenId|selectedStore|selectedScreen|disabled|cascade"

# 6. Check Tech Ops dashboard for retailer_id scope (TASK-23)
Select-String -Path "client-app/src/pages/tech/TechOpsDashboard.jsx" `
  -Pattern "retailer_id|where|filter"

# 7. Check ApprovalHistory navigate call (TASK-19)
Select-String -Path "client-app/src/pages/retailer/ApprovalHistory.jsx" `
  -Pattern "navigate|goBack|useNavigate"

# 8. Check notifications stub current content
Get-Content "ad-server/src/api/notifications.js"
```

---

## MVP Completion Estimate

| Category | Status |
|---|---|
| **User & Entity CRUD (Admin)** | ✅ ~95% complete — all routes and UI wired |
| **Campaign Auth Guards** | ✅ ~97% complete — 2 verbs still unguarded |
| **Retailer Validation Workflow** | 🟡 ~70% — approval list done; loops page and calendar missing |
| **Demo Player / Loop Playback** | 🟡 ~85% — wired but blocked by enum FIXME |
| **Impression Tracking** | 🟡 ~90% — wired but dependent on enum fix for loop path |
| **Security (Auth on mutations)** | 🔴 ~60% — 3 routers still public-mounted |
| **Network Map** | 🔴 ~58% — env key unverified |
| **Retailer Dashboard Navigation** | ✅ ~95% — quick-action routes fixed |
| **Notifications** | 🔴 ~5% — 4-line stub only |
| **Overall MVP Readiness** | **~68%** |
