# Sprint 13 — MVP Gap Closure (Continued)

**Sprint:** 13
**Status:** Step 2 complete — ready for implementation
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
| S11-7 · Network Map blank render | ✅ **CLOSED** | Container height enforced via Tailwind `h-[600px]` on `GlassCard`. Error boundary, loading spinners, stat cards all present. |
| S11-8 · Tech Ops network-wide screen data | ✅ **CLOSED** | Full `ROLE_HIERARCHY` branch confirmed in `screens.js` L79–L112. |

**Sprint 13 entry condition met.** 6 of 8 Sprint 12 stories confirmed closed. Carry-over gates: NODE_ENV DECISION-1 (open) + S11-1/S11-2/S11-4 persistence tests (manual).

---

## ⚠️ Open Decisions

### DECISION-1 — NODE_ENV Guard Logic in `telemetry.js`

**File:** `ad-server/src/api/telemetry.js` Line 49
**Live code:** `if (process.env.NODE_ENV !== 'production') {`
**Spec expected:** `if (process.env.NODE_ENV !== 'test') {`

| Guard | Rate limiter in dev? | Rate limiter in test? | Rate limiter in prod? |
|---|---|---|---|
| `!== 'production'` (live) | ❌ Bypassed | ❌ Bypassed | ✅ Active |
| `!== 'test'` (spec intent) | ✅ Active | ❌ Bypassed | ✅ Active |

**Required before S11-6 E2E begins.** One-line fix if spec intent (`!== 'test'`) is correct. Document decision either way.

### DECISION-2 — S11-1/S11-2/S11-4 Persistence Tests

Manual hard-refresh (`Ctrl+Shift+R`) required for UserManagement, AdvertiserManagement, and Add Location forms. Cannot be confirmed from source. Run in browser before marking stories fully closed.

---

## 🔍 Isolation Verdict

All four new Sprint 13 stories are low blast-radius. No shared repository mutations between S13-1, S13-2, S13-3, S13-4. The only cross-story dependency is DECISION-1, which must be resolved before S13-3 implementation.

---

## 🚨 Sprint 13 New Scope

### Scoping rationale

The four stories below are drawn from the **Known Gaps / Unconfirmed Routes** table in `docs/API_ROUTES.md` and from the MVP spec sections that have no confirmed implementation:

1. **S13-1** — TechOps audit log + screen diagnostics log (`POST /api/audit-log`, `GET /api/screens/:id/logs`) — both FIXMEs in `TechOpsDashboard.jsx` since sprint (PR4)
2. **S13-2** — Loop reject + bulk approve route confirmation (`POST /api/loops/:loopId/reject`, `POST /api/locations/:id/loops/approve-all`) — both FIXMEs in `ScheduleManager.jsx` since sprint7
3. **S13-3** — Campaign `DELETE` guard correction — live code has `requireRole('admin')` but Sprint 12 spec + `campaigns.js` L187 confirmed `requireRole('superadmin')`. API_ROUTES.md says `requireRole('admin')`. One source must be made canonical.
4. **S13-4** — Telemetry impression persistence — `POST /api/telemetry/impression` has a `Phase 2 TODO: persist to Firestore` comment. MVP analytics (proof-of-play) requires persistence. This is the final blocker for the S5 `LoopAnalytics.jsx` dashboard to show real data.

---

### S13-1 · TechOps Audit Log + Screen Diagnostics

**Priority:** High
**Effort:** M
**Confidence pre-implementation:** 60% (routes unconfirmed — Step 1 required on `TechOpsDashboard.jsx` before coding)
**MVP section:** 3.5 — Technical Operator: “Incident tracking and resolution”

#### Pre-implementation Step 1 (mandatory before writing a line of code)

```powershell
# 1. Confirm what TechOpsDashboard.jsx is calling
Select-String -Path "client-app/src/pages/tech/TechOpsDashboard.jsx" -Pattern "audit-log|screens.*logs|FIXME" -Context 2,2

# 2. Check if audit-log route exists anywhere
Select-String -Path "ad-server/src" -Recurse -Include "*.js" -Pattern "audit.log|audit_log"

# 3. Check if screen logs route exists
Select-String -Path "ad-server/src/api/screens.js" -Pattern "logs"
```

#### Acceptance Criteria

| # | Criterion | Guardrail |
|---|---|---|
| AC-1 | `POST /api/audit-log` registered in `ad-server/src/api/audit.js` (new file) or `screens.js`. Accepts `{ event_type, actor_id, target_id, target_type, detail }`. Returns `201`. | GUARDRAIL-2 — add row to `API_ROUTES.md` before coding |
| AC-2 | `GET /api/screens/:id/logs` registered in `screens.js`. Returns array of `{ timestamp, event_type, detail }`. Scoped: `techoperator` sees all, `retaileradmin` sees own screens only. | GUARDRAIL-2, GUARDRAIL-3 |
| AC-3 | Both routes require `requireAuth` minimum; `DELETE` or destructive log operations require `requireRole('superadmin')`. | GUARDRAIL-3 |
| AC-4 | `TechOpsDashboard.jsx` FIXME comments removed and replaced with live calls. | GUARDRAIL-1 — confirm `apiService` method exists or add it |
| AC-5 | Incident log panel in `TechOpsDashboard.jsx` renders list of recent audit events with timestamp, event type, and actor. Empty state: “No incidents logged yet.” | — |
| AC-6 | Screen diagnostics drawer (existing or new) shows `GET /api/screens/:id/logs` results with last 20 entries. | — |
| AC-7 | `grep -r "FIXME" client-app/src/pages/tech/TechOpsDashboard.jsx` returns zero results at close. | GUARDRAIL-4 |

#### Files expected to touch

- `ad-server/src/api/screens.js` — add `GET /:id/logs` route
- `ad-server/src/api/audit.js` — new file (or inline in `screens.js`)
- `client-app/src/pages/tech/TechOpsDashboard.jsx` — wire live calls, remove FIXMEs
- `client-app/src/services/ApiService.js` — add `getScreenLogs(id)` + `postAuditLog(payload)` if missing
- `docs/API_ROUTES.md` — add both route rows

---

### S13-2 · Loop Reject + Bulk Approve Route Confirmation

**Priority:** High
**Effort:** S
**Confidence pre-implementation:** 55% (both routes marked FIXME since sprint7 — may exist but be unregistered, or may be stub-only)
**MVP section:** 4.3 — Retailer Validation Workflow: “Retailers can reject specific ads / request replacements”

#### Pre-implementation Step 1 (mandatory)

```powershell
# 1. Check if reject handler exists in loops.js
Select-String -Path "ad-server/src/api/loops.js" -Pattern "reject|approve-all|approve_all" -Context 2,2

# 2. Check ScheduleManager.jsx for exact fetch call shapes
Select-String -Path "client-app/src/pages/retailer/ScheduleManager.jsx" -Pattern "reject|approve.all|FIXME" -Context 2,2

# 3. Check if locations router is registered in app.js/index.js
Select-String -Path "ad-server/src" -Recurse -Include "*.js" -Pattern "locations"
```

#### Acceptance Criteria

| # | Criterion | Guardrail |
|---|---|---|
| AC-1 | `POST /api/loops/:loopId/reject` confirmed registered in `loops.js`. Accepts `{ reason }`. Returns `200` with updated loop object. Status set to `REJECTED`. | GUARDRAIL-2 |
| AC-2 | `POST /api/locations/:id/loops/approve-all` confirmed registered. If the `/locations` prefix requires a separate router, that router must be mounted in the app entry file. | GUARDRAIL-2 — confirm mount point |
| AC-3 | Both routes require `requireRole('retaileradmin')`. | GUARDRAIL-3 |
| AC-4 | `ScheduleManager.jsx` FIXME comments removed. Reject and bulk-approve calls use confirmed route shapes. | GUARDRAIL-1 |
| AC-5 | `loops.status` enum on reject writes uppercase `'REJECTED'` — consistent with confirmed `APPROVED`/`PENDING`/`DRAFT` uppercase enum. | GUARDRAIL-4 |
| AC-6 | `API_ROUTES.md` rows for both routes updated from ⚠️ FIXME unconfirmed to confirmed, with correct body shapes. | GUARDRAIL-2 |

#### Files expected to touch

- `ad-server/src/api/loops.js` — confirm/implement reject + approve-all handlers
- `ad-server/src/` — confirm `/locations` router mount if needed
- `client-app/src/pages/retailer/ScheduleManager.jsx` — remove FIXMEs, wire confirmed routes
- `docs/API_ROUTES.md` — update both loop route rows

---

### S13-3 · Campaign DELETE Guard Canonical Fix

**Priority:** Critical
**Effort:** XS
**Confidence pre-implementation:** 95% (one-line discrepancy between `campaigns.js` L187 and `API_ROUTES.md`)
**MVP section:** 3.1 — Super Administrator: full campaign governance

#### Context

`campaigns.js` L187 confirmed (Sprint 12 bash block): `requireRole('superadmin')` on `DELETE /api/campaigns/:id`.
`API_ROUTES.md` currently lists `requireRole('admin')` for that row.

One of these is wrong. The code is ground truth. The doc must be corrected.

> **This is a docs fix, not a code change** — unless the intent is `'admin'` (broader role), in which case the code must be changed and the reason documented.

#### Pre-implementation Step 1 (mandatory)

```powershell
# Confirm live guard at L187
Select-String -Path "ad-server/src/api/campaigns.js" -Pattern "requireRole|router.delete" -Context 1,1
```

#### Acceptance Criteria

| # | Criterion | Guardrail |
|---|---|---|
| AC-1 | `API_ROUTES.md` `DELETE /api/campaigns/:id` row updated to `requireRole('superadmin')` to match live code. | GUARDRAIL-2 |
| AC-2 | If the decision is made to change the guard to `'admin'` instead, `campaigns.js` L187 must be updated AND the reason documented in this file under a new DECISION-3. | GUARDRAIL-3 |
| AC-3 | After fix, `grep -n "requireRole" ad-server/src/api/campaigns.js` output matches every row in `API_ROUTES.md` campaigns section exactly. | GUARDRAIL-3, GUARDRAIL-4 |

#### Files expected to touch

- `docs/API_ROUTES.md` — correct `DELETE /api/campaigns/:id` auth guard row (most likely path)
- `ad-server/src/api/campaigns.js` — only if decision is to broaden guard to `'admin'`

---

### S13-4 · Telemetry Impression Persistence (Proof-of-Play)

**Priority:** High
**Effort:** M
**Confidence pre-implementation:** 70% (handler exists; persistence layer unconfirmed)
**MVP section:** 4.6 — Analytics: “Proof-of-play per ad” + “Loop delivery confirmation”

#### Context

`POST /api/telemetry/impression` exists and accepts impressions. The handler has an inline comment:
> `// Phase 2 TODO: persist to Firestore`

`LoopAnalytics.jsx` (Sprint 5) shows a proof-of-play dashboard. If impressions are not persisted, the dashboard has no real data to display. This story wires the persistence layer.

#### Pre-implementation Step 1 (mandatory)

```powershell
# 1. Read the full impression handler
Select-String -Path "ad-server/src/api/telemetry.js" -Pattern "impression|Firestore|persist|TODO" -Context 3,3

# 2. Check what TelemetryRepository or equivalent exists
Get-ChildItem -Path "ad-server/src/repositories" -Filter "*.js" | Select Name

# 3. Check if Firestore client is already initialised anywhere
Select-String -Path "ad-server/src" -Recurse -Include "*.js" -Pattern "Firestore|firestore|firebase"
```

#### Acceptance Criteria

| # | Criterion | Guardrail |
|---|---|---|
| AC-1 | `POST /api/telemetry/impression` persists `{ screen_id, campaign_id, asset_id, loop_id, played_at, slot_position }` to the persistence layer (Firestore OR a `TelemetryRepository` backed by the existing DB — whichever is live in the codebase). | GUARDRAIL-1 — confirm or create repository method |
| AC-2 | `GET /api/telemetry/impressions` (new route) accepts `{ screen_id?, campaign_id?, date_from?, date_to? }` query params. Returns paginated array. | GUARDRAIL-2 — add row to `API_ROUTES.md` |
| AC-3 | `LoopAnalytics.jsx` hourly delivery chart and slot drill-down pull from `GET /api/telemetry/impressions` instead of mock/static data. | GUARDRAIL-1 |
| AC-4 | `Phase 2 TODO` comment removed from `telemetry.js`. | GUARDRAIL-4 |
| AC-5 | `POST /api/telemetry/impression` route requires `requireAuth`. `GET /api/telemetry/impressions` requires `requireRole('admin')` or `requireRole('techoperator')`. | GUARDRAIL-3 |
| AC-6 | If Firestore is not initialised in the codebase, use the existing SQL/JSON repository pattern — do **not** introduce a new dependency mid-sprint without a DECISION entry here. | — |

#### Files expected to touch

- `ad-server/src/api/telemetry.js` — wire persistence in impression handler; add `GET /impressions` route
- `ad-server/src/repositories/TelemetryRepository.js` — new file (or confirm existing)
- `client-app/src/pages/admin/LoopAnalytics.jsx` — replace mock data with live API call
- `client-app/src/services/ApiService.js` — add `getImpressions(params)` method if missing
- `docs/API_ROUTES.md` — add `GET /api/telemetry/impressions` row

---

## 💥 Blast-Radius Table

| Story | Files Touched | Route(s) | Change Type | Shared Infra? | Can It Break Other Features? | Mitigation |
|---|---|---|---|---|---|---|
| S13-1 · TechOps audit log + screen logs | `screens.js`, `audit.js` (new), `TechOpsDashboard.jsx`, `ApiService.js`, `API_ROUTES.md` | `POST /api/audit-log`, `GET /api/screens/:id/logs` | New routes + new file | `screens.js` shared with S11-8 role branch | Adding routes to `screens.js` cannot break the existing `GET /api/screens` role branch if appended cleanly. Run `grep -n "ROLE_HIERARCHY" screens.js` before and after. | |
| S13-2 · Loop reject + bulk approve | `loops.js`, `ScheduleManager.jsx`, `API_ROUTES.md` | `POST /api/loops/:loopId/reject`, `POST /api/locations/:id/loops/approve-all` | Confirm/implement existing stubs | `loops.js` is used by `Player.jsx` for `GET /api/loops` | Confirming reject/approve-all handlers does not affect the `GET /api/loops?status=APPROVED` query. Verify no global `router.use()` middleware is added that intercepts GET. |
| S13-3 · Campaign DELETE guard fix | `API_ROUTES.md` (most likely), `campaigns.js` only if guard broadened | `DELETE /api/campaigns/:id` | Docs correction (most likely) | `campaigns.js` guards confirmed in Sprint 12 | Doc-only change is zero blast-radius. If code changes, re-run SECURITY-V2 grep to confirm. |
| S13-4 · Telemetry persistence | `telemetry.js`, `TelemetryRepository.js` (new), `LoopAnalytics.jsx`, `ApiService.js`, `API_ROUTES.md` | `POST /api/telemetry/impression` (modify), `GET /api/telemetry/impressions` (new) | Persistence layer addition + new GET route | `telemetry.js` has `impressionLimiter` (SECURITY-V3). Adding persistence to the existing POST handler must not bypass or remove the limiter. | Append persistence call inside the existing handler body — do not restructure the handler. Confirm `impressionLimiter` still applied after change. |

---

## Four SRE/QA Rules

These rules are mandatory for every story in this sprint.

1. **No service call without source verification** — every `apiService.X()` call must name the exact existing file and method signature that implements it.
2. **Router file is the API authority** — every API story must list the exact `METHOD /path → body shape` as confirmed in `docs/API_ROUTES.md` and the Express router source.
3. **Mutation auth must be falsifiable** — every `POST`, `PUT`, `PATCH`, or `DELETE` AC must explicitly state the required middleware guard.
4. **Enums and sprint docs must be canonical** — all status values must match `docs/DATABASE_SCHEMA.md` exactly. Loops use uppercase; campaigns use lowercase.

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

- [x] **ENUM-AUDIT-3** — ✅ **RESOLVED @ `e0ea260` (2026-06-07).** `Player.jsx` `status=APPROVED` confirmed correct. `playlists.js` `'DRAFT'` default fixed to `'draft'`. See **Enum Bug Log** below.
- [x] **SECURITY-V1** — `requireRole('retaileradmin')` @ `campaigns.js` L135. ✅ CONFIRMED.
- [x] **SECURITY-V2** — `requireRole('superadmin')` @ `campaigns.js` L187. ✅ CONFIRMED.
- [x] **SECURITY-V3** — `impressionLimiter` @ `telemetry.js` L79. ✅ CONFIRMED.
- [ ] **NODE_ENV guard** — live code uses `!== 'production'` (L49). Spec expected `!== 'test'`. **DECISION-1 required** before any S11-6 E2E work begins.
- [x] **`CampaignApprovalList` duplicate** — ✅ RESOLVED @ `App.jsx` `335f1c2`.
- [x] **`BaseRepository.findById()`** — ✅ CONFIRMED @ `BaseRepository.js` L53.
- [ ] **`docs/MVP_SPRINT_PLAN.md`** — add Sprint 13 entry linking to this file.

---

## Enum Bug Log

> Canonical enum values are **lowercase** for campaigns, **uppercase** for loops, per `docs/DATABASE_SCHEMA.md`.

| File | Line | Bug | Fix | Commit |
|---|---|---|---|
---|
| `ad-server/src/api/playlists.js` | L31 | `status = 'DRAFT'` (uppercase default on `POST /api/playlists`) | Changed to `status = 'draft'` | `e0ea260` (2026-06-07) |
| `client-app/src/pages/Player.jsx` | L70, L187 | `status=APPROVED` in query param — marked FIXME pending enum confirmation | ✅ **Confirmed correct** — `loops.status` is uppercase `APPROVED`. FIXME comments removed. | `e0ea260` (2026-06-07) |

> **Two enum systems:** `campaigns.status` is lowercase (`draft`, `pendingapproval`, `scheduled`, `live`, `ended`). `loops.status` is uppercase (`APPROVED`, `PENDING`, `DRAFT`, `REJECTED`). Do not conflate them.

---

## Pre-Sprint Checklist

- [x] `ls ad-server/src/api/` — all API files confirmed @ `294fd25`
- [x] SECURITY-V1/V2 guards confirmed (`campaigns.js` L135, L187)
- [x] NODE_ENV guard present @ `telemetry.js` L49 as `!== 'production'` ⚠️ DECISION-1
- [x] Routes confirmed @ `App.jsx` `335f1c2`. Correct path is `retailer/schedule`.
- [x] `router.post('/')` + `StoreRepository.createWithScreens()` confirmed (`stores.js` L69, L77)
- [x] `telemetryService.trackImpression()` confirmed at `Player.jsx` L296 + L327
- [x] `LoopDemoPlayer.jsx` collision — zero matches. Risk 3 cleared.
- [x] `BaseRepository.findById()` confirmed @ L53
- [x] `NetworkMap.jsx` blank-render fix confirmed
- [x] `screens.js` role-hierarchy branch confirmed (L79–L112)
- [x] **ENUM-AUDIT-3** — ✅ CLOSED @ `e0ea260`
- [ ] **S11-1/S11-2 persistence tests** — manual browser hard-refresh
- [ ] **S11-4 persistence test** — manual browser hard-refresh
- [ ] **DECISION-1** — NODE_ENV guard intent in `telemetry.js`

---

## Known File Inventory (Confirmed)

| File | Size | Status | Notes |
|---|---|---|---|
| `client-app/src/App.jsx` | 11 214 B | ✅ | Route authority. All retailer routes registered. |
| `client-app/src/pages/Player.jsx` | 23 098 B | ✅ | `trackImpression` at L296 + L327. FIXMEs removed @ `e0ea260`. |
| `client-app/src/pages/LoopDemoPlayer.jsx` | 35 994 B | ✅ | No collision with `Player.jsx`. Risk 3 cleared. |
| `client-app/src/pages/admin/NetworkMap.jsx` | ~4 097 B | ✅ | Blank-render fix present. |
| `client-app/src/pages/admin/LoopAnalytics.jsx` | — | ✅ (S13-4 target) | Sprint 5 deliverable. Will be wired to live telemetry in S13-4. |
| `client-app/src/pages/tech/TechOpsDashboard.jsx` | — | ⚠️ FIXMEs present | S13-1 target. Step 1 grep required before coding. |
| `client-app/src/pages/retailer/ScheduleManager.jsx` | — | ⚠️ FIXMEs present | S13-2 target. Step 1 grep required before coding. |
| `ad-server/src/api/campaigns.js` | 6 323 B | ✅ | Guards confirmed. DELETE guard doc vs code mismatch — S13-3. |
| `ad-server/src/api/telemetry.js` | 5 135 B | ⚠️ Phase 2 TODO | Impression handler has no persistence yet. S13-4 target. |
| `ad-server/src/api/loops.js` | 8 674 B | ⚠️ FIXMEs present | Reject + approve-all handlers unconfirmed. S13-2 target. |
| `ad-server/src/api/playlists.js` | 2 100 B | ✅ | `'DRAFT'` bug fixed @ `e0ea260`. |
| `ad-server/src/api/screens.js` | 6 683 B | ✅ | Role branch live. S13-1 will add `GET /:id/logs`. |
| `ad-server/src/api/users.js` | 8 219 B | ✅ | — |
| `ad-server/src/api/retailers.js` | 5 330 B | ✅ | — |
| `ad-server/src/api/advertisers.js` | 5 268 B | ✅ | — |
| `ad-server/src/api/stores.js` | 7 426 B | ✅ | S11-4 wired. |
| `ad-server/src/api/notifications.js` | 5 216 B | ⚠️ Deferred | Larger than stub — do not assume empty. |
| `ad-server/src/repositories/BaseRepository.js` | — | ✅ | `findById()` @ L53. |
| `ad-server/src/middleware/requireRole.js` | — | ✅ | Exports `requireRole`, `ROLE_HIERARCHY`, `normalizeRole`. |
| `ad-server/src/middleware/rateLimiter.js` | — | ✅ | `impressionLimiter` @ `telemetry.js` L4. |

---

## Confidence Scores

| Story | Score | Status | Remaining gate |
|---|---|---|---|
| S13-1 · TechOps audit log + screen logs | 🟡 60% | Ready — Step 1 required | Step 1 grep on `TechOpsDashboard.jsx` + `loops.js` |
| S13-2 · Loop reject + bulk approve | 🟡 55% | Ready — Step 1 required | Step 1 grep on `loops.js` + `ScheduleManager.jsx` |
| S13-3 · Campaign DELETE guard fix | 🟢 95% | Ready for implementation | Confirm live guard with one grep, then fix `API_ROUTES.md` |
| S13-4 · Telemetry impression persistence | 🟡 70% | Ready — Step 1 required | Step 1 grep on `telemetry.js` + repository scan |
| S11-1 · Super Admin CRUD — Users & Retailers | ⚠️ 70% | Carry-over | Persistence test (manual) |
| S11-2 · Super Admin CRUD — Advertisers | ⚠️ 70% | Carry-over | Persistence test (manual) |

---

## ⚠️ Genuine Cross-Cutting Risks

### Risk 1 — `telemetry.js` NODE_ENV guard × Demo Player E2E

**Status:** DECISION-1 open. S11-6 wiring confirmed. E2E tests firing impressions in `test` environment will hit the rate limiter if guard stays `!== 'production'`.

### Risk 2 — `GET /api/screens` role-conditional expansion

**Status:** ✅ Role branch confirmed L79–L112. Always run `grep -rn "api/screens" client-app/src/pages/brand/` before merging any screens-touching PR.

### Risk 3 — `LoopDemoPlayer.jsx` × `Player.jsx` collision

**Status:** ✅ CLEARED.

### Risk 4 — Two enum systems: `campaigns.status` vs `loops.status`

**Status:** ✅ Documented (2026-06-07). Uppercase = loops. Lowercase = campaigns. Any new story touching either must confirm which enum applies. S13-2 reject handler must write `'REJECTED'` (uppercase) for `loops.status`.

### Risk 5 — `impressionLimiter` must survive S13-4 handler refactor

**Status:** Open. When S13-4 adds Firestore/repository persistence inside the `POST /api/telemetry/impression` handler, the `impressionLimiter` middleware (SECURITY-V3) must remain applied. Do not restructure the handler in a way that moves or removes the limiter. Confirm with `grep -n "impressionLimiter" ad-server/src/api/telemetry.js` after S13-4 is implemented.

---

## Cross-Story Dependency Map

```
S11-5 ── ✅ CLOSED
S11-3 ── ✅ CLOSED (NODE_ENV flag) ──► DECISION-1 ──► unblocks S11-6 E2E + S13-4 rate-limiter safety
S11-1 ── ⚠️ persistence test ──► unblocks S11-4 full close
ENUM-AUDIT-3 ── ✅ CLOSED @ e0ea260

S13-3 ── doc fix only ── no blockers ── implement first (XS effort)
S13-2 ── Step 1 grep required ── unblocks ScheduleManager FIXME removal
S13-1 ── Step 1 grep required ── no external blockers
S13-4 ── Step 1 grep required ── DECISION-1 must resolve before E2E
         └─ unblocks LoopAnalytics.jsx real-data display
```

**Recommended implementation order:** S13-3 (XS, doc only) → S13-2 (S, route confirm) → S13-1 (M, new routes) → S13-4 (M, persistence) → DECISION-1 → S11-6 E2E

---

## Deferred to Post-MVP

- "Report Issue" and "Disconnect/Reestablish" screen actions (TASK-16, TASK-17)
- Notifications feed (`notifications.js` — 5 216 B, larger than stub)
- Advanced analytics / campaign summary dashboard
- Retailer context selector for Super Admin impersonation (TASK-21)
- Firestore production setup (if not already initialised — confirm in S13-4 Step 1)

---

## Story Point Summary

| Story | Priority | Effort | Confidence | Status | Blocker? |
|---|---|---|---|---|---|
| S13-3 · Campaign DELETE guard fix | Critical | XS | 95% | Ready | None |
| S13-2 · Loop reject + bulk approve | High | S | 55% | Ready — Step 1 req | Step 1 grep |
| S13-1 · TechOps audit log + screen logs | High | M | 60% | Ready — Step 1 req | Step 1 grep |
| S13-4 · Telemetry impression persistence | High | M | 70% | Ready — Step 1 req | Step 1 grep |
| S11-1 · Super Admin CRUD — Users & Retailers | Critical | L | 70% | Carry-over | Persistence test |
| S11-2 · Super Admin CRUD — Advertisers | Critical | M | 70% | Carry-over | Persistence test |

---

## Definition of Done

- [x] S11-5 confirmed closed @ `335f1c2`
- [x] S11-3 confirmed closed — guards at `campaigns.js` L135 + L187
- [x] S11-4 confirmed closed (API) — `stores.js` L69 + L77
- [x] S11-6 confirmed closed — `Player.jsx` L296 + L327; Risk 3 cleared
- [x] S11-7 confirmed closed — `NetworkMap.jsx` `h-[600px]` + error boundary
- [x] S11-8 confirmed closed — `screens.js` L79–L112
- [x] `BaseRepository.findById()` confirmed @ L53
- [x] `CampaignApprovalList` duplicate resolved
- [x] SECURITY-V1 + SECURITY-V2 + SECURITY-V3 confirmed
- [x] Risk 3 (`LoopDemoPlayer` collision) cleared
- [x] **ENUM-AUDIT-3** — ✅ CLOSED @ `e0ea260`. `playlists.js` `'DRAFT'` fixed. Two enum systems documented (Risk 4).
- [ ] **DECISION-1** — NODE_ENV guard documented + fix applied if needed
- [ ] S11-1 persistence test passed
- [ ] S11-2 persistence test passed
- [ ] S11-4 persistence test passed
- [ ] **S13-3** — `API_ROUTES.md` `DELETE /api/campaigns/:id` guard row corrected. `grep` confirms match.
- [ ] **S13-2** — loop reject + bulk approve routes confirmed/implemented. `API_ROUTES.md` rows updated. `ScheduleManager.jsx` FIXMEs removed.
- [ ] **S13-1** — `POST /api/audit-log` + `GET /api/screens/:id/logs` live. `TechOpsDashboard.jsx` FIXMEs removed. `API_ROUTES.md` updated.
- [ ] **S13-4** — impression persistence wired. `GET /api/telemetry/impressions` live. `LoopAnalytics.jsx` shows real data. Phase 2 TODO removed.
- [ ] Route Correction Log applied — no AC references `/dashboard/retailer/schedule/calendar`
- [ ] Blast-radius table complete ✅
- [ ] `docs/MVP_SPRINT_PLAN.md` updated with Sprint 13 entry
- [ ] No story marked Done without a commit SHA cited as evidence
- [ ] No vague acceptance criteria
- [ ] `GUARDRAIL-5`: this file at `docs/sprint13.md`, linked from `MVP_SPRINT_PLAN.md`

---

## Route Correction Log

| Old path (Sprint 12) | Correct live path (confirmed @ `335f1c2`) | Notes |
|---|---|---|
| `/dashboard/retailer/schedule/calendar` | `/dashboard/retailer/schedule` | `/calendar` suffix never existed in the live router. |

---

*Sprint 13 doc created 2026-06-07.*
*Updated 2026-06-07 (`fb5ddcf`): S11-5 closed; route path corrected; `LoopDemoPlayer.jsx` added.*
*Updated 2026-06-07 (`5b84c94`): Bash block results — 6 stories closed; DECISION-1 raised; Risk 3 cleared.*
*Updated 2026-06-07 (`e0ea260` + `6f858e6`): ENUM-AUDIT-3 resolved; `playlists.js` bug fixed; Enum Bug Log + Risk 4 added.*
*Updated 2026-06-07 (this commit): Step 2 complete — 4 new stories scoped (S13-1 through S13-4) with full AC tables, blast-radius table, dependency map, recommended implementation order.*
*Sources: live `App.jsx` @ `335f1c2`, `ad-server/src/api/` @ `294fd25`, `docs/API_ROUTES.md`, `docs/MVP_SPRINT_PLAN.md`, PowerShell grep outputs 2026-06-07.*
