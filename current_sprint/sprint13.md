# Sprint 13 — MVP Gap Closure (Continued)

**Sprint:** 13
**Status:** Planning — bash blocks executed, Step 2 unblocked pending 3 items
**Cross-referenced with:** `client-app/src/App.jsx` @ `335f1c2`, `ad-server/src/api/` @ `294fd25`
**Guardrails authority:** [`docs/sprint8-sre-retro-consolidated.md`](./sprint8-sre-retro-consolidated.md)
**Route authority:** [`docs/API_ROUTES.md`](./API_ROUTES.md)
**Schema authority:** [`docs/DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md)
**MVP reference:** [`docs/Digital Screen Network Management Platform (MVP).md`](<./Digital Screen Network Management Platform (MVP).md>)

---

## Sprint 12 Close-Out Status

Step 1 (Repository Reality Check) executed against `App.jsx` @ `335f1c2` and `ad-server/src/api/` @ `294fd25` on 2026-06-07.
Pre-Sprint bash blocks executed 2026-06-07 — results logged below.

| Story | Status | Evidence |
|---|---|---|
| S11-3 · Security hardening — campaign auth + NODE_ENV guard | ✅ **CLOSED** ⚠️ NODE_ENV flag | `requireRole('retaileradmin')` on `PATCH /:id/status` confirmed @ `campaigns.js` L135. `requireRole('superadmin')` on `DELETE /:id` confirmed @ L187. `impressionLimiter` applied to `POST /impression` @ `telemetry.js` L79. **NODE_ENV guard is `!== 'production'` (L49) — not `!== 'test'` as spec intended. Decision required before S11-6 E2E.** |
| S11-1 · Super Admin CRUD — Users & Retailers | ⚠️ **Persistence test only** | `users.js` ✅ on disk (8 219 B); `retailers.js` ✅ on disk (5 330 B). Hard-refresh persistence test is the only remaining gate — cannot be confirmed from source alone. |
| S11-2 · Super Admin CRUD — Advertisers | ⚠️ **Persistence test only** | `advertisers.js` ✅ on disk (5 268 B). Hard-refresh persistence test is the only remaining gate. |
| S11-4 · Retailer CRUD — Add Location | ✅ **CLOSED** (pending persistence test) | `router.post('/')` wired with `authenticate` + `requireRole('admin')` @ `stores.js` L69. `StoreRepository.createWithScreens()` called @ L77. Persistence test recommended before closing completely. |
| S11-5 · Retailer Approval — Loop Preview + App.jsx route reg | ✅ **CLOSED** | All four routes confirmed live in `App.jsx` @ `335f1c2`. `CampaignApprovalList` duplicate resolved. |
| S11-6 · Demo Player full wiring | ✅ **CLOSED** | `telemetryService.trackImpression()` called at `Player.jsx` L296 and L327. Heartbeat firing at L280. `logTelemetryEvent` + `sendTelemetry` helpers present. No `LoopDemoPlayer` collision — Risk 3 cleared. |
| S11-7 · Network Map blank render | ✅ **CLOSED** | Container height enforced via Tailwind `h-[600px]` on `GlassCard` (not a CSS `min-height` property — explains grep no-match). Loading spinners, error boundary (`data-testid="network-map-error"`), and stat cards with `data-testid` all present. |
| S11-8 · Tech Ops network-wide screen data | ✅ **CLOSED** | Full `ROLE_HIERARCHY` branch confirmed in `screens.js`: `techoperator` (level 2) sees all screens; `retaileradmin` (level 1) scoped to own `retailer_id` from JWT; `advertiser` / unknown role → 403. |

> ⚠️ **`LoopDemoPlayer.jsx` collision — Risk 3 CLEARED:** Grep of `LoopDemoPlayer.jsx` returned zero matches for `TelemetryService`, `trackImpression`, or `impression`. The two player pages are fully independent. No mitigation required for S11-6.

**Sprint 13 entry condition:** 6 of 8 Sprint 12 stories confirmed closed. Two remaining gates: (1) NODE_ENV guard decision in `telemetry.js`, (2) S11-1/S11-2 hard-refresh persistence tests.

---

## ⚠️ Open Decisions Before Step 2

### DECISION-1 — NODE_ENV Guard Logic in `telemetry.js`

**File:** `ad-server/src/api/telemetry.js` Line 49
**Live code:**
```js
if (process.env.NODE_ENV !== 'production') {
```
**Sprint spec expected:**
```js
if (process.env.NODE_ENV !== 'test') {
```

**Impact table:**

| Guard | Rate limiter in dev? | Rate limiter in test? | Rate limiter in prod? |
|---|---|---|---|
| `!== 'production'` (live) | ❌ Bypassed | ❌ Bypassed | ✅ Active |
| `!== 'test'` (spec intent) | ✅ Active | ❌ Bypassed | ✅ Active |

**The spec intent** was to bypass the rate limiter only during automated tests so E2E suites can fire impressions freely. With `!== 'production'`, the limiter is also bypassed in dev — which may be intentional for local development convenience, or may be a mistake.

**Required action before S11-6 E2E work begins:** Decide and document which behaviour is correct. If `!== 'test'` is the correct intent, this is a one-line fix. If `!== 'production'` is intentional (bypass in dev + test), update the sprint docs and carry-over pre-condition accordingly.

### DECISION-2 — S11-1/S11-2 Persistence Tests

Manual hard-refresh tests for `UserManagement.jsx` and `AdvertiserManagement.jsx` CRUD forms. Run in browser, not confirmable from source. Check:
- Create a record → hard-refresh (`Ctrl+Shift+R`) → record still present
- Update a record → hard-refresh → updated values persist
- Delete a record → hard-refresh → record gone

### DECISION-3 — ENUM-AUDIT-3

Not yet run. Add to next PowerShell batch:
```powershell
Select-String -Path "ad-server/src","client-app/src" -Recurse -Include "*.js","*.jsx" -Pattern "'APPROVED'|'PENDING'"
```
Must return zero results before any story ships.

---

## 🔍 Isolation Verdict

> ⚠️ **Pending Step 4.** Six stories confirmed closed. Step 4 blast-radius table to be completed in Step 2 session.

---

## Four SRE/QA Rules

These rules are mandatory for every story in this sprint.

1. **No service call without source verification**
   Every `apiService.X()` call must name the exact existing file and method signature that implements it. If the method does not exist, add a sub-task to create it before UI wiring.

2. **Router file is the API authority**
   Every API story must list the exact `METHOD /path → body shape` as confirmed in `docs/API_ROUTES.md` and the Express router source file. No frontend endpoint may be written from memory.

3. **Mutation auth must be falsifiable**
   Every `POST`, `PUT`, `PATCH`, or `DELETE` acceptance criterion must explicitly state the required middleware guard, e.g. `requireRole('superadmin') confirmed`.

4. **Enums and sprint docs must be canonical**
   All workflow/status values must match the `docs/DATABASE_SCHEMA.md` enum definitions exactly (lowercase, underscore-separated). This file lives at `docs/sprint13.md` per GUARDRAIL-5.

---

## Guardrails Checklist

Before any story is marked **Ready for implementation**, confirm all five boxes:

| Rule | Required check | ✓ |
|---|---|---|
| **GUARDRAIL-1** Service method exists | Every `apiService.X()` call verified in `ApiService.js` source | ☐ |
| **GUARDRAIL-2** Route contract exists | HTTP method, path, body shape confirmed in `docs/API_ROUTES.md` | ☐ |
| **GUARDRAIL-3** Auth guard named in AC | Mutation routes explicitly state `requireRole('X') confirmed` | ☐ |
| **GUARDRAIL-4** Enum values canonical | Status strings match schema; grep returns zero uppercase variants at close | ☐ |
| **GUARDRAIL-5** Doc placement | This file is at `docs/sprint13.md`; linked from `docs/MVP_SPRINT_PLAN.md` | ☐ |

---

## Carry-over Pre-conditions (from sprint12.md)

- [ ] **ENUM-AUDIT-3** — confirm `campaigns.status` only writes lowercase (`draft`, `pendingapproval`, `scheduled`, `live`, `ended`). `grep -r "'APPROVED'\|'PENDING'" --include="*.js" --include="*.jsx"` must return zero results. ⚠️ **Not yet run.**
- [x] **SECURITY-V1** — `PATCH /api/campaigns/:id/status` wrapped in `requireRole('retaileradmin')`. **CONFIRMED** @ `campaigns.js` L135.
- [x] **SECURITY-V2** — `DELETE /api/campaigns/:id` has `requireRole('superadmin')` guard. **CONFIRMED** @ `campaigns.js` L187.
- [x] **SECURITY-V3** — ~~`POST /api/telemetry/impression` has no rate limit.~~ **RESOLVED** at commit `98bd645`. `impressionLimiter` confirmed @ `telemetry.js` L79.
- [ ] **NODE_ENV guard** — live code uses `!== 'production'` (L49). Spec expected `!== 'test'`. **DECISION-1 required** before any S11-6 E2E work begins.
- [x] **`CampaignApprovalList` duplicate** — **RESOLVED** @ `App.jsx` `335f1c2`. `pages/retailer/CampaignApprovalList.jsx` re-exports from `components/`. Single source of truth confirmed.
- [x] **`BaseRepository.findById()`** — **CONFIRMED** @ `BaseRepository.js` L53. Used internally at L105 + L139.
- [ ] **`docs/MVP_SPRINT_PLAN.md`** — add Sprint 13 entry linking to this file.

---

## Pre-Sprint Checklist

- [x] Run `ls ad-server/src/api/` — `users.js` ✅ · `retailers.js` ✅ · `advertisers.js` ✅ · `stores.js` ✅ · confirmed @ `294fd25`
- [x] Run `grep -n "requireRole|router.patch|router.delete" ad-server/src/api/campaigns.js` — SECURITY-V1/V2 guards **confirmed** (L135, L187)
- [x] Run `grep -n "NODE_ENV|impressionLimiter" ad-server/src/api/telemetry.js` — guard present @ L49 as `!== 'production'`. ⚠️ **DECISION-1 required**
- [x] ~~Run `grep -n "Loops|ScheduleCalendar|schedule/calendar|retailer/loops" client-app/src/App.jsx`~~ — routes confirmed @ `335f1c2`. Correct path is `retailer/schedule`.
- [x] Run `grep -n "router.post|create" ad-server/src/api/stores.js` — `router.post('/')` + `StoreRepository.createWithScreens()` **confirmed** (L69, L77)
- [x] Read `client-app/src/pages/Player.jsx` — `telemetryService.trackImpression()` confirmed at L296 + L327. Heartbeat at L280. ✅
- [x] Check `LoopDemoPlayer.jsx` collision — **zero matches** for TelemetryService/trackImpression/impression. Risk 3 cleared. ✅
- [x] Confirm `BaseRepository.findById()` — **confirmed** @ L53. ✅
- [x] Read `client-app/src/pages/admin/NetworkMap.jsx` — blank-render fix confirmed via `h-[600px]` Tailwind + error boundary + loading states. ✅
- [x] Run `grep -n "techops|role|retaileradmin" ad-server/src/api/screens.js` — full role-hierarchy branch **confirmed** (L79–L112). ✅
- [ ] **ENUM-AUDIT-3** — `Select-String` for `'APPROVED'|'PENDING'` not yet run
- [ ] **S11-1/S11-2 persistence tests** — hard-refresh `Ctrl+Shift+R` on UserManagement + AdvertiserManagement forms (manual, browser only)
- [ ] **S11-4 persistence test** — hard-refresh after Add Location form submit (manual, browser only)
- [ ] **DECISION-1** — resolve NODE_ENV guard intent in `telemetry.js`

---

## Known File Inventory (Step 1 + Bash Blocks Confirmed)

All paths confirmed on disk at commit `294fd25` / `App.jsx` @ `335f1c2`.

| File | Size | Status | Notes |
|---|---|---|---|
| `client-app/src/App.jsx` | 11 214 B | ✅ Confirmed | Route authority. All retailer routes registered. |
| `client-app/src/pages/Player.jsx` | 23 098 B | ✅ Confirmed | `trackImpression` at L296 + L327. Heartbeat at L280. Wiring confirmed. |
| `client-app/src/pages/LoopDemoPlayer.jsx` | 35 994 B | ✅ Confirmed — No collision | Registered at `/player/demo`. Zero shared telemetry dependencies with `Player.jsx`. Risk 3 cleared. |
| `client-app/src/pages/admin/NetworkMap.jsx` | ~4 097 B | ✅ Confirmed — Fix present | `h-[600px]` Tailwind on `GlassCard`. Error boundary `data-testid="network-map-error"`. Loading spinners. Stats: `data-testid="stat-total-screens"`, `"stat-online-rate"`, `"stat-daily-impressions"`. |
| `client-app/src/pages/admin/UserManagement.jsx` | — | ✅ Confirmed | Via App.jsx verified map |
| `client-app/src/pages/admin/RetailerManagement.jsx` | — | ✅ Confirmed | Via App.jsx verified map |
| `client-app/src/pages/admin/AdvertiserManagement.jsx` | — | ✅ Confirmed | Via App.jsx verified map |
| `client-app/src/pages/retailer/Loops.jsx` | — | ✅ Confirmed | Route: `/dashboard/retailer/loops` |
| `client-app/src/pages/retailer/ScheduleCalendar.jsx` | — | ✅ Confirmed | Route: `/dashboard/retailer/schedule` (**not** `schedule/calendar`) |
| `client-app/src/pages/retailer/ScheduleHistory.jsx` | — | ✅ Confirmed | Route: `/dashboard/retailer/schedule-history` |
| `client-app/src/pages/retailer/ScheduleManager.jsx` | — | ✅ Confirmed | Route: `/dashboard/retailer/schedule-manager` |
| `client-app/src/pages/retailer/CampaignApprovalList.jsx` | — | ✅ Confirmed | Route: `/dashboard/retailer/campaign-approvals`. Duplicate resolved. |
| `client-app/src/pages/tech/TechOpsDashboard.jsx` | — | ✅ Confirmed | Route: `/dashboard/techoperator` |
| `ad-server/src/api/campaigns.js` | 6 323 B | ✅ Confirmed — Guards live | `requireRole('retaileradmin')` @ L135. `requireRole('superadmin')` @ L187. Sprint 9 + 11 history in comments. |
| `ad-server/src/api/telemetry.js` | 5 135 B | ✅ Confirmed ⚠️ NODE_ENV flag | `impressionLimiter` @ L79. Guard @ L49 uses `!== 'production'`. See DECISION-1. |
| `ad-server/src/api/users.js` | 8 219 B | ✅ Confirmed | — |
| `ad-server/src/api/retailers.js` | 5 330 B | ✅ Confirmed | — |
| `ad-server/src/api/advertisers.js` | 5 268 B | ✅ Confirmed | — |
| `ad-server/src/api/stores.js` | 7 426 B | ✅ Confirmed — S11-4 wired | `router.post('/')` + `StoreRepository.createWithScreens()` confirmed. Grew 8% from Sprint 12. |
| `ad-server/src/api/screens.js` | 6 683 B | ✅ Confirmed — Role branch live | Full `ROLE_HIERARCHY` branch: techoperator → all screens; retaileradmin → scoped; advertiser/unknown → 403. |
| `ad-server/src/api/loops.js` | 8 674 B | ✅ Confirmed | — |
| `ad-server/src/api/notifications.js` | 5 216 B | ✅ Confirmed — Deferred | Larger than a bare stub. Do not assume empty before post-MVP planning. |
| `ad-server/src/repositories/BaseRepository.js` | — | ✅ Confirmed | `findById()` @ L53. Used internally @ L105 + L139. |
| `ad-server/src/middleware/requireRole.js` | — | ✅ Confirmed | Exports `requireRole`, `ROLE_HIERARCHY`, `normalizeRole`. All confirmed imported in `campaigns.js` and `screens.js`. |
| `ad-server/src/middleware/rateLimiter.js` | — | ✅ Confirmed | Exports `impressionLimiter`. Confirmed imported in `telemetry.js` L4. |

---

## Confidence Scores (Post Bash Blocks)

| Story | Score | Status | Remaining gate |
|---|---|---|---|
| S11-5 · Retailer Approval — routes | ✅ 100% | Closed @ `335f1c2` | None |
| S11-3 · Security hardening + NODE_ENV | ✅ 95% | Closed ⚠️ NODE_ENV flag | DECISION-1 only — one-line fix if needed |
| S11-4 · Add Location | ✅ 90% | Closed (API wired) | Persistence test (manual) |
| S11-6 · Demo Player full wiring | ✅ 90% | Closed | DECISION-1 must be resolved before E2E |
| S11-7 · Network Map blank render | ✅ 95% | Closed | None — fix confirmed in source |
| S11-8 · TechOps network-wide data | ✅ 95% | Closed | None — role branch confirmed |
| S11-1 · Super Admin CRUD — Users & Retailers | ⚠️ 70% | Unconfirmed | Persistence test (manual) only |
| S11-2 · Super Admin CRUD — Advertisers | ⚠️ 70% | Unconfirmed | Persistence test (manual) only |

---

## 💥 Blast-Radius Table

> ⚠️ **Pending Step 4.** To be completed in Step 2 session now that bash blocks are resolved.

| Task | Files Touched | Route(s) | Change Type | Shared Infra? | Can It Break Other Features? | Mitigation |
|---|---|---|---|---|---|---|
| *(to be filled in Step 4)* | — | — | — | — | — | — |

---

## Backlog

> All Sprint 12 stories are now confirmed closed or pending manual persistence tests only. No code carry-over work remains. Sprint 13 new scope to be defined in Step 2 after DECISION-1 + persistence tests are resolved.

---

### S12-CARRY · Sprint 12 Carry-overs

| Story | Outcome | Evidence |
|---|---|---|
| S11-5 · Routes + CampaignApprovalList | ✅ CLOSED | `App.jsx` @ `335f1c2` |
| S11-3 · Campaign auth + NODE_ENV | ✅ CLOSED ⚠️ NODE_ENV flag | `campaigns.js` L135, L187 · `telemetry.js` L49 — DECISION-1 open |
| S11-4 · Add Location | ✅ CLOSED (persistence TBD) | `stores.js` L69, L77 |
| S11-6 · Demo Player wiring | ✅ CLOSED | `Player.jsx` L296, L327 · LoopDemoPlayer collision cleared |
| S11-7 · NetworkMap blank render | ✅ CLOSED | `NetworkMap.jsx` `h-[600px]` + error boundary |
| S11-8 · TechOps role branch | ✅ CLOSED | `screens.js` L79–L112 |
| S11-1 · Super Admin CRUD — Users & Retailers | ⚠️ Persistence test only | Files on disk — manual test required |
| S11-2 · Super Admin CRUD — Advertisers | ⚠️ Persistence test only | Files on disk — manual test required |

---

### S13-NEW · New Scope (to be defined after DECISION-1 + persistence tests)

> ⚠️ **Do not add new stories here until DECISION-1 is resolved and S11-1/S11-2 persistence tests are confirmed.** New scope from the MVP backlog should only be pulled in once carry-over debt is fully known.

---

## Route Correction Log

> **IMPORTANT — read before writing any acceptance criteria or bash grep patterns.**

| Old path (Sprint 12) | Correct live path (confirmed @ `335f1c2`) | Notes |
|---|---|---|
| `/dashboard/retailer/schedule/calendar` | `/dashboard/retailer/schedule` | `ScheduleCalendar` served at `retailer/schedule` in `App.jsx`. The `/calendar` suffix never existed in the live router. All grep patterns, AC tables, and test assertions must use the corrected path. |

---

## Cross-Story Dependency Map

```
S11-5 ── ✅ CLOSED ──────────────────────────────────────────────────────────────

S11-3 ✅ CLOSED (NODE_ENV flag) ── DECISION-1 ──► unblocks S11-6 E2E

S11-1 (persistence test) ──► unblocks S11-4 full close

S11-6 ── ✅ CLOSED ── LoopDemoPlayer collision cleared ── no further action
```

**Recommended merge order for any remaining fixes:** DECISION-1 fix (if needed) → S11-1/S11-2 persistence sign-off → new S13 scope

---

## ⚠️ Genuine Cross-Cutting Risks (carry-forward)

### Risk 1 — `telemetry.js` NODE_ENV guard × Demo Player E2E

**Status:** DECISION-1 open. S11-6 wiring is confirmed in `Player.jsx`. However, E2E tests that fire impressions in a `test` environment will hit the rate limiter if the guard remains `!== 'production'`. Resolve DECISION-1 before any E2E suite is run against `/api/telemetry/impression`.

### Risk 2 — `GET /api/screens` role-conditional expansion

**Status:** ✅ Role branch confirmed in `screens.js` L79–L112. S11-8 closed. Residual: always run `grep -rn "api/screens" client-app/src/pages/brand/` before merging any screens-touching PR to confirm Brand pages are not affected by role scoping.

### Risk 3 — `LoopDemoPlayer.jsx` × `Player.jsx` collision

**Status:** ✅ CLEARED. `LoopDemoPlayer.jsx` contains zero references to `TelemetryService`, `trackImpression`, or `impression`. The two pages are fully independent. No further mitigation required.

---

## Deferred to Post-MVP (do not schedule this sprint)

- "Report Issue" and "Disconnect/Reestablish" screen actions (TASK-16, TASK-17)
- Notifications feed (`notifications.js` — deferred; file is 5 216 B, larger than a bare stub — do not assume empty before post-MVP planning)
- Advanced analytics / campaign summary dashboard
- Retailer context selector for Super Admin impersonation (TASK-21)

---

## Story Point Summary

| Story | Priority | Confidence | Effort (est.) | Sprint 12 status | Blocker? |
|---|---|---|---|---|---|
| S11-5 · Retailer Approval — routes | — | ✅ Closed | — | ✅ Confirmed closed | No |
| S11-3 · Security hardening + NODE_ENV | Critical | 95% | S | ✅ Closed ⚠️ NODE_ENV flag | DECISION-1 only |
| S11-4 · Add Location | High | 90% | S | ✅ Closed (API wired) | Persistence test |
| S11-6 · Demo Player full wiring | High | 90% | — | ✅ Closed | DECISION-1 before E2E |
| S11-7 · Network Map blank render | Medium | 95% | — | ✅ Closed | No |
| S11-8 · Tech Ops network-wide data | Medium | 95% | — | ✅ Closed | No |
| S11-1 · Super Admin CRUD — Users & Retailers | Critical | 70% | L | ⚠️ Persistence unconfirmed | Persistence test |
| S11-2 · Super Admin CRUD — Advertisers | Critical | 70% | M | ⚠️ Persistence unconfirmed | Persistence test |

---

## Definition of Done

- [x] S11-5 confirmed closed — routes and `CampaignApprovalList` resolution evidenced @ `335f1c2`
- [x] S11-3 confirmed closed — `requireRole` guards at `campaigns.js` L135 + L187; `impressionLimiter` at `telemetry.js` L79
- [x] S11-4 confirmed closed (API) — `router.post` + `StoreRepository.createWithScreens` at `stores.js` L69 + L77
- [x] S11-6 confirmed closed — `trackImpression` at `Player.jsx` L296 + L327; LoopDemoPlayer collision cleared
- [x] S11-7 confirmed closed — `h-[600px]` + error boundary + loading states in `NetworkMap.jsx`
- [x] S11-8 confirmed closed — role-hierarchy branch at `screens.js` L79–L112
- [x] `BaseRepository.findById()` confirmed present @ L53
- [x] `CampaignApprovalList` duplicate resolved @ `App.jsx` `335f1c2`
- [x] SECURITY-V1 confirmed — `requireRole('retaileradmin')` on `PATCH /campaigns/:id/status`
- [x] SECURITY-V2 confirmed — `requireRole('superadmin')` on `DELETE /campaigns/:id`
- [x] Risk 3 (`LoopDemoPlayer` collision) cleared
- [ ] **DECISION-1** — NODE_ENV guard intent documented and fix applied if needed
- [ ] **ENUM-AUDIT-3** — `grep` for `'APPROVED'|'PENDING'` returns zero results
- [ ] S11-1 persistence test passed — UserManagement + RetailerManagement hard-refresh confirmed
- [ ] S11-2 persistence test passed — AdvertiserManagement hard-refresh confirmed
- [ ] S11-4 persistence test passed — Add Location hard-refresh confirmed
- [ ] Route Correction Log applied — no AC or test references `/dashboard/retailer/schedule/calendar`
- [ ] Blast-radius table complete (Step 4 executed)
- [ ] `docs/MVP_SPRINT_PLAN.md` updated with Sprint 13 entry
- [ ] No story marked Done without a commit SHA cited as evidence
- [ ] No vague acceptance criteria ("works correctly" language banned)
- [ ] `GUARDRAIL-5`: this file is at `docs/sprint13.md` and linked from `MVP_SPRINT_PLAN.md`

---

*Sprint 13 doc created 2026-06-07. Scaffold only — awaiting Step 1 (Repository Reality Check) to populate story details, confidence scores, and blast-radius table.*
*Updated 2026-06-07 (commit `fb5ddcf`): Step 1 corrections — S11-5 confirmed closed; route path corrected; `LoopDemoPlayer.jsx` added.*
*Updated 2026-06-07 (this commit): Bash block results applied — 6 stories confirmed closed; NODE_ENV guard flag raised (DECISION-1); Risk 3 cleared; `BaseRepository.findById()` confirmed; SECURITY-V1/V2 checked off; Known File Inventory fully grounded. Step 2 unblocked pending DECISION-1 + persistence tests.*
*Sources: live `App.jsx` @ `335f1c2`, `ad-server/src/api/` @ `294fd25`, PowerShell grep outputs 2026-06-07.*
