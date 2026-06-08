# Sprint 13 — MVP Gap Closure (Continued)

**Sprint:** 13
**Status:** Step 4 complete — isolation audit done, all four stories cleared for implementation
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

All four new Sprint 13 stories are low blast-radius. No shared repository mutations between S13-1, S13-2, S13-3, S13-4. The only cross-story dependency is DECISION-1, which must be resolved before S13-3 implementation if the guard is being changed in code (not just docs).

---

## 🚨 Sprint 13 New Scope

### Scoping rationale

The four stories below are drawn from the **Known Gaps / Unconfirmed Routes** table in `docs/API_ROUTES.md` and from the MVP spec sections that have no confirmed implementation:

1. **S13-1** — TechOps audit log + screen diagnostics log (`POST /api/audit-log`, `GET /api/screens/:id/logs`) — both FIXMEs in `TechOpsDashboard.jsx` since sprint (PR4)
2. **S13-2** — Loop reject + bulk approve route confirmation (`POST /api/loops/:loopId/reject`, `POST /api/locations/:id/loops/approve-all`) — both FIXMEs in `ScheduleManager.jsx` since sprint7
3. **S13-3** — Campaign `DELETE` guard correction — live code has `requireRole('superadmin')` but `API_ROUTES.md` says `requireRole('admin')`. Doc must be made canonical.
4. **S13-4** — Telemetry impression persistence — `POST /api/telemetry/impression` has a `Phase 2 TODO: persist to Firestore` comment. MVP analytics (proof-of-play) requires persistence. This is the final blocker for the S5 `LoopAnalytics.jsx` dashboard to show real data.

---

### S13-1 · TechOps Audit Log + Screen Diagnostics

**Priority:** High
**Effort:** M
**Confidence (Step 3):** 68%
**MVP section:** 3.5 — Technical Operator: "Incident tracking and resolution"

#### Pre-implementation Step 1 (mandatory before writing a line of code)

```powershell
# 1. Full FIXME inventory in TechOpsDashboard.jsx
Select-String -Path "client-app/src/pages/tech/TechOpsDashboard.jsx" -Pattern "FIXME|audit.log|screens.*logs|api/" -Context 3,3

# 2. Does any audit-log route exist anywhere?
Select-String -Path "ad-server/src" -Recurse -Include "*.js" -Pattern "audit.log|audit_log|auditLog"

# 3. Does GET /screens/:id/logs exist in screens.js?
Select-String -Path "ad-server/src/api/screens.js" -Pattern "logs|diagnostics"

# 4. Does ApiService.js have getScreenLogs or postAuditLog?
Select-String -Path "client-app/src/services/ApiService.js" -Pattern "auditLog|screenLog|getScreen|postAudit"
```

**What the greps will determine:**

| Finding | Action |
|---|---|
| Only 2 FIXMEs (`audit-log` + `screens/:id/logs`) | Scope confirmed — proceed as specced |
| Additional unconfirmed FIXMEs found | Add each to S13-1 sub-tasks or defer to S13-5 |
| `audit.js` already exists | Read it before creating a new file |
| `GET /:id/logs` already stubbed in `screens.js` | Implement body only |
| `ApiService.js` has neither method | Add both methods as first sub-task |

#### Acceptance Criteria

| # | Criterion | Guardrail |
|---|---|---|
| AC-1 | `POST /api/audit-log` registered in `ad-server/src/api/audit.js` (new file) or `screens.js`. Accepts `{ event_type, actor_id, target_id, target_type, detail }`. Returns `201`. Verified: `curl -X POST /api/audit-log -d '{"event_type":"test","actor_id":"u1","target_id":"s1","target_type":"screen","detail":"test"}' -H "Authorization: Bearer <auth_token>"` → `201`. | GUARDRAIL-2 — add row to `API_ROUTES.md` before coding |
| AC-2 | `GET /api/screens/:id/logs` registered in `screens.js`. Returns array of `{ timestamp, event_type, detail }`. Scoped: `techoperator` sees all, `retaileradmin` sees own screens only. Verified: `curl /api/screens/scr_001/logs -H "Authorization: Bearer <retaileradmin_token>"` → `[{ timestamp, event_type, detail }]`. | GUARDRAIL-2, GUARDRAIL-3 |
| AC-3 | Both routes require `requireAuth` minimum; destructive log operations require `requireRole('superadmin')`. | GUARDRAIL-3 |
| AC-4 | `TechOpsDashboard.jsx` FIXME comments removed and replaced with live calls. `Select-String -Path "client-app/src/pages/tech/TechOpsDashboard.jsx" -Pattern "FIXME"` → zero results. | GUARDRAIL-1 |
| AC-5 | Incident log panel renders list of recent audit events with timestamp, event type, and actor. Empty state: `"No incidents logged yet."` — not blank, not spinner. | — |
| AC-6 | Screen diagnostics drawer shows `GET /api/screens/:id/logs` results with last 20 entries. | — |
| AC-7 | `Select-String -Path "client-app/src/pages/tech/TechOpsDashboard.jsx" -Pattern "FIXME"` returns zero results at close. | GUARDRAIL-4 |

#### Files expected to touch

- `ad-server/src/api/screens.js` — add `GET /:id/logs` route (**append after L112 only — do not touch ROLE_HIERARCHY block**)
- `ad-server/src/api/audit.js` — new file (or inline in `screens.js`)
- `client-app/src/pages/tech/TechOpsDashboard.jsx` — wire live calls, remove FIXMEs
- `client-app/src/services/ApiService.js` — add `getScreenLogs(id)` + `postAuditLog(payload)` if missing
- `docs/API_ROUTES.md` — add both route rows

#### Why S13-1 cannot yet exceed 90%

The number of additional unconfirmed FIXMEs in `TechOpsDashboard.jsx` beyond the 2 known ones is unknown. Grep 1 resolves this in under 1 minute. Score will jump to 90%+ immediately after grep returns.

---

### S13-2 · Loop Reject + Bulk Approve Route Confirmation

**Priority:** High
**Effort:** S
**Confidence (Step 3):** 72%
**MVP section:** 4.3 — Retailer Validation Workflow: "Retailers can reject specific ads / request replacements"

#### Pre-implementation Step 1 (mandatory)

```powershell
# 1. Does the reject handler body exist in loops.js?
Select-String -Path "ad-server/src/api/loops.js" -Pattern "reject|approve.all|approve_all|locations" -Context 3,3

# 2. What exact fetch calls does ScheduleManager.jsx make?
Select-String -Path "client-app/src/pages/retailer/ScheduleManager.jsx" -Pattern "fetch|api/loops|api/locations|reject|approve|FIXME" -Context 2,2

# 3. Is /locations prefix mounted in the app entry?
Select-String -Path "ad-server/src" -Recurse -Include "*.js" -Pattern "locations|app.use"
```

**What the greps will determine:**

| Finding | Action |
|---|---|
| `router.post('/:loopId/reject', ...)` exists with a body | Confirm + wire frontend only (S effort) |
| Route registered but handler is a stub/empty | Implement handler body (M effort) |
| Route not registered at all | Create handler + register route (M effort) |
| `/locations` already mounted | Use existing prefix |
| `/locations` not mounted | Add mount in `app.js`/`index.js` entry file |

#### Acceptance Criteria

| # | Criterion | Guardrail |
|---|---|---|
| AC-1 | `POST /api/loops/:loopId/reject` confirmed registered in `loops.js`. Accepts `{ reason }`. Returns `200` with updated loop object. Status set to `'REJECTED'` (uppercase). Verified: `curl -X POST /api/loops/{id}/reject -d '{"reason":"test"}' -H "Authorization: Bearer <retaileradmin_token>"` → `{ status: "REJECTED" }`. | GUARDRAIL-2 |
| AC-2 | `POST /api/locations/:id/loops/approve-all` confirmed registered. If `/locations` prefix requires a separate router, that router must be mounted in the app entry file. Verified: `curl -X POST /api/locations/{id}/loops/approve-all` → `{ approved: N }`. | GUARDRAIL-2 — confirm mount point |
| AC-3 | Both routes require `requireRole('retaileradmin')`. | GUARDRAIL-3 |
| AC-4 | `ScheduleManager.jsx` FIXME comments removed. `Select-String -Path "client-app/src/pages/retailer/ScheduleManager.jsx" -Pattern "FIXME"` → zero results. | GUARDRAIL-1 |
| AC-5 | `loops.status` on reject writes uppercase `'REJECTED'` — consistent with confirmed `APPROVED`/`PENDING`/`DRAFT` uppercase enum. Verified: `Select-String -Path "ad-server/src/api/loops.js" -Pattern "'REJECTED'"` returns a match. | GUARDRAIL-4 |
| AC-6 | `API_ROUTES.md` rows for both routes updated from ⚠️ FIXME unconfirmed to confirmed, with correct body shapes. | GUARDRAIL-2 |

#### Files expected to touch

- `ad-server/src/api/loops.js` — confirm/implement reject + approve-all handlers
- `ad-server/src/` — confirm `/locations` router mount if needed
- `client-app/src/pages/retailer/ScheduleManager.jsx` — remove FIXMEs, wire confirmed routes
- `docs/API_ROUTES.md` — update both loop route rows

#### Why S13-2 cannot yet exceed 90%

Both routes marked FIXME since sprint7. Handler state (stub / partial / absent) is unknown until grep 1 runs. If `/api/locations/:id/loops/approve-all` requires a new `locations.js` router file and a new mount in `app.js`, that is a larger change than estimated. Isolate reject handler as a separate sub-task so it can ship independently of bulk-approve if needed.

---

### S13-3 · Campaign DELETE Guard Canonical Fix

**Priority:** Critical
**Effort:** XS
**Confidence (Step 3):** 98%
**MVP section:** 3.1 — Super Administrator: full campaign governance

#### Context

`campaigns.js` L187 confirmed (Sprint 12 bash block): `requireRole('superadmin')` on `DELETE /api/campaigns/:id`.
`API_ROUTES.md` currently lists `requireRole('admin')` for that row.

One of these is wrong. The code is ground truth. The doc must be corrected.

> **This is a docs fix, not a code change** — unless the intent is `'admin'` (broader role), in which case the code must be changed and the reason documented.

#### Pre-implementation Step 1 (mandatory — 10 seconds)

```powershell
# Confirm live guard at L187
Select-String -Path "ad-server/src/api/campaigns.js" -Pattern "requireRole|router.delete" -Context 1,1
```

Expected output: `requireRole('superadmin')` on the `DELETE /:id` handler. If it says `requireRole('admin')` instead, open DECISION-3 and do not merge until resolved.

#### Acceptance Criteria

| # | Criterion | Guardrail |
|---|---|---|
| AC-1 | `API_ROUTES.md` `DELETE /api/campaigns/:id` row updated to `requireRole('superadmin')` to match live code. | GUARDRAIL-2 |
| AC-2 | If the decision is made to change the guard to `'admin'` instead, `campaigns.js` L187 must be updated AND the reason documented here under a new DECISION-3. | GUARDRAIL-3 |
| AC-3 | After fix, `Select-String -Path "ad-server/src/api/campaigns.js" -Pattern "requireRole"` output matches every row in `API_ROUTES.md` campaigns section exactly. Verified: L135 = `requireRole('retaileradmin')`, L187 = `requireRole('superadmin')`. | GUARDRAIL-3, GUARDRAIL-4 |

#### Files expected to touch

- `docs/API_ROUTES.md` — correct `DELETE /api/campaigns/:id` auth guard row (most likely path)
- `ad-server/src/api/campaigns.js` — only if decision is to broaden guard to `'admin'`

#### Remaining risk

Near-zero. If the live code says `'admin'` (contradicting Sprint 12 bash output), open DECISION-3. Otherwise this is a single cell edit in a markdown table.

---

### S13-4 · Telemetry Impression Persistence (Proof-of-Play)

**Priority:** High
**Effort:** M
**Confidence (Step 3):** 80%
**MVP section:** 4.6 — Analytics: "Proof-of-play per ad" + "Loop delivery confirmation"

#### Context

`POST /api/telemetry/impression` exists and accepts impressions. The handler has an inline comment:
> `// Phase 2 TODO: persist to Firestore`

`LoopAnalytics.jsx` (Sprint 5) shows a proof-of-play dashboard. If impressions are not persisted, the dashboard has no real data. This story wires the persistence layer.

#### Pre-implementation Step 1 (mandatory)

```powershell
# 1. Read the full impression handler to understand current structure
Select-String -Path "ad-server/src/api/telemetry.js" -Pattern "impression|Firestore|persist|TODO|Phase 2" -Context 5,5

# 2. What repositories already exist?
Get-ChildItem -Path "ad-server/src/repositories" -Filter "*.js" | Select-Object Name

# 3. Is Firestore/Firebase initialised anywhere?
Select-String -Path "ad-server/src" -Recurse -Include "*.js" -Pattern "Firestore|firestore|firebase|initializeApp"
```

**Decision tree from grep results:**

| Finding | Action |
|---|---|
| Firestore already initialised (e.g. `admin.firestore()`) | Use it — `TelemetryRepository.js` wraps the existing client |
| No Firestore anywhere | Use existing SQL/JSON repo pattern — create `TelemetryRepository.js` matching `BaseRepository.js` style |
| `TelemetryRepository.js` already exists | Read it fully before writing anything |

#### Key constraint — `impressionLimiter` must survive the refactor

The persistence call must be inserted *inside* the existing handler body, not by restructuring the handler. The `impressionLimiter` is applied as route-level middleware *before* the handler — it is safe as long as the handler function signature doesn't change.

```js
// SAFE — append inside existing handler body:
router.post('/impression', requireAuth, impressionLimiter, async (req, res) => {
  // existing code ...
  await telemetryRepository.recordImpression(payload); // ← insert here
  res.status(200).json({ ok: true });
});

// UNSAFE — do not restructure to a new route definition
```

#### Acceptance Criteria

| # | Criterion | Guardrail |
|---|---|---|
| AC-1 | `POST /api/telemetry/impression` persists `{ screen_id, campaign_id, asset_id, loop_id, played_at, slot_position }` to the persistence layer (Firestore OR a `TelemetryRepository` backed by the existing DB — whichever is live). Verified: POST impression → hard-refresh server → `GET /api/telemetry/impressions?screen_id=X` returns the record. | GUARDRAIL-1 |
| AC-2 | `GET /api/telemetry/impressions` (new route) accepts `{ screen_id?, campaign_id?, date_from?, date_to? }` query params. Returns paginated array. | GUARDRAIL-2 |
| AC-3 | `LoopAnalytics.jsx` hourly delivery chart and slot drill-down pull from `GET /api/telemetry/impressions` instead of mock/static data. | GUARDRAIL-1 |
| AC-4 | `Phase 2 TODO` comment removed from `telemetry.js`. `Select-String -Path "ad-server/src/api/telemetry.js" -Pattern "Phase 2|TODO.*persist"` → zero results. | GUARDRAIL-4 |
| AC-5 | `POST /api/telemetry/impression` still has `requireAuth`. `GET /api/telemetry/impressions` requires `requireRole('admin')` or `requireRole('techoperator')`. Retailer token on `GET` → `403`. | GUARDRAIL-3 |
| AC-6 | `impressionLimiter` still applied after S13-4 change. `Select-String -Path "ad-server/src/api/telemetry.js" -Pattern "impressionLimiter"` returns a match. | GUARDRAIL-3 (Risk 5) |
| AC-7 | If Firestore is not initialised, use the existing SQL/JSON repository pattern — do **not** introduce a new dependency mid-sprint without a DECISION entry here. | — |

#### Files expected to touch

- `ad-server/src/api/telemetry.js` — wire persistence in impression handler; add `GET /impressions` route
- `ad-server/src/repositories/TelemetryRepository.js` — new file (or confirm existing)
- `client-app/src/pages/admin/LoopAnalytics.jsx` — replace mock data with live API call
- `client-app/src/services/ApiService.js` — add `getImpressions(params)` method if missing
- `docs/API_ROUTES.md` — add `GET /api/telemetry/impressions` row

#### Why S13-4 cannot yet exceed 90%

If Firestore is not initialised, creating `TelemetryRepository.js` in the existing repo pattern is correct but adds ~30 min and a sub-task. The `Get-ChildItem` pre-check resolves this in 10 seconds. Score will reach 90%+ immediately after the repository scan returns.

---

## 📊 Step 3 — Probability Delta Table

| Story | Old Score | New Score | What was keeping it below 100% | Remaining risks |
|---|---|---|---|---|
| S13-3 · Campaign DELETE guard doc fix | 95% | **98%** | Minor: `API_ROUTES.md` row could have been updated in a commit not yet read | Near-zero — pure doc correction; no code path affected |
| S13-2 · Loop reject + bulk approve | 55% | **72%** | Routes marked FIXME since sprint7 — handler state (stub/partial/absent) unknown; `/locations` mount point unknown | If `POST /api/loops/:loopId/reject` body is absent entirely, effort jumps from S → M |
| S13-1 · TechOps audit log + screen logs | 60% | **68%** | Unknown number of additional FIXMEs in `TechOpsDashboard.jsx`; `audit-log` route may not exist anywhere; `ApiService.js` audit/log methods unconfirmed | Additional FIXMEs beyond the 2 known ones could expand scope |
| S13-4 · Telemetry impression persistence | 70% | **80%** | Persistence layer (Firestore vs existing repo pattern) unknown; `TelemetryRepository.js` may not exist; `LoopAnalytics.jsx` data source shape unknown | If Firestore is not initialised, must use existing repo pattern — adds 1 sub-task |

### Tasks That Cannot Realistically Exceed 90% Yet

**S13-1 (68%)** and **S13-2 (72%)** cannot exceed 90% until their mandatory greps are run. Both have unknown call shapes in frontend files and unconfirmed backend handler states. Scores will jump to 90%+ immediately after greps return.

**S13-4 (80%)** cannot exceed 90% until the repository scan (`Get-ChildItem ad-server/src/repositories`) confirms whether `TelemetryRepository.js` exists and whether Firestore is already initialised. This is a 5-minute check that removes the biggest architectural uncertainty.

**S13-3 (98%)** is effectively ready. The remaining 2% accounts for the theoretical case where the live guard was changed in a commit after `294fd25` — the confirmatory grep eliminates this in 10 seconds.

---

## 🛡️ Step 4 — Isolation Audit

### Blast-Radius Table (Definitive)

| Story | Files Touched | Change Type | Shared Infra? | Can It Break Other Features? | Verdict |
|---|---|---|---|---|---|
| **S13-3** · Campaign DELETE guard doc fix | `docs/API_ROUTES.md` only (most likely) | Docs correction — additive | No shared code. `API_ROUTES.md` is reference-only, never imported by any runtime file | ❌ No | ✅ **Fully isolated. Zero blast-radius.** Ship first. |
| **S13-2** · Loop reject + bulk approve | `loops.js`, `ScheduleManager.jsx`, `API_ROUTES.md`. Possibly: app entry file if `/locations` mount is new | Additive — new handler bodies or confirming stubs | `loops.js` consumed by `Player.jsx` via `GET /api/loops?status=APPROVED` | ⚠️ Partial — `loops.js` is shared | ✅ **Safe if additive only.** New POST routes cannot affect the existing GET handler. Verify no `router.use()` middleware is added that intercepts all loop routes. |
| **S13-1** · TechOps audit log + screen logs | `screens.js`, `audit.js` (new), `TechOpsDashboard.jsx`, `ApiService.js`, `API_ROUTES.md` | New routes + new file + FIXME removal | `screens.js` shared with S11-8 role branch (L79–L112). `ApiService.js` shared across all pages. | ⚠️ Partial — `screens.js` and `ApiService.js` are shared | ✅ **Safe if appended cleanly.** `GET /:id/logs` must be added **after L112** — not inside the ROLE_HIERARCHY block. New `ApiService.js` methods are safely additive. |
| **S13-4** · Telemetry impression persistence | `telemetry.js`, `TelemetryRepository.js` (new), `LoopAnalytics.jsx`, `ApiService.js`, `API_ROUTES.md` | Persistence inserted inside existing handler body; new GET route appended | `telemetry.js` has `impressionLimiter` (SECURITY-V3). `ApiService.js` shared. | ⚠️ Partial — `telemetry.js` is shared | ✅ **Safe if handler body is not restructured.** `impressionLimiter` survives as long as the route registration line is not touched. Verify with AC-6 grep after merge. |

---

### Isolation Verdict — Story by Story

**S13-3 is fully isolated.** Doc-only change with zero runtime surface. Cannot break anything. Implement first.

**S13-2, S13-1, S13-4 are additive-only changes.** No existing handler, route, method, or component is removed or restructured. Each story only appends new code or fills empty stubs. This is the safest class of change: existing behaviour cannot regress unless a shared file is accidentally modified beyond the intended insertion point.

---

### The Two Genuine Cross-Cutting Risks

#### CCR-1 — `screens.js` ROLE_HIERARCHY block integrity (S13-1)

**Risk:** S13-1 adds `GET /:id/logs` to `screens.js`. If a developer edits inside the S11-8 role-hierarchy block (L79–L112) while adding this route, the `techoperator` / `retaileradmin` scoping on the existing `GET /api/screens` route will break silently.

**Mitigation:** Run before and after the merge:
```powershell
Select-String -Path "ad-server/src/api/screens.js" -Pattern "ROLE_HIERARCHY"
```
If the match count or line number changes, the PR must not be merged until the block is restored.

**Gate:** This grep is mandatory — it is a PR merge gate, not optional.

#### CCR-2 — `impressionLimiter` survival through S13-4 (Risk 5)

**Risk:** S13-4 inserts persistence logic inside the `POST /api/telemetry/impression` handler. The `impressionLimiter` is applied as route-level middleware at the `router.post(...)` call site. If S13-4 lifts the handler into a named function or rewrites the route registration line, the limiter will be silently dropped — no error, no test failure, but SECURITY-V3 is broken.

**Mitigation:** Run after S13-4 is merged:
```powershell
Select-String -Path "ad-server/src/api/telemetry.js" -Pattern "impressionLimiter"
```
This is AC-6 in S13-4 and is a hard close condition. Story cannot be marked Done without this grep returning a match.

---

### Backward-Compatible Touch Points — Why Each Is Safe

| Touch point | Story | Why additive = backward compatible |
|---|---|---|
| `ad-server/src/api/loops.js` | S13-2 | `POST /:loopId/reject` and `POST .../approve-all` are new path segments. The existing `GET /`, `GET /:id`, `POST /`, `PUT /:id` handlers are matched by method + path — adding new routes cannot affect existing ones. Express does not re-evaluate prior routes. |
| `ad-server/src/api/screens.js` | S13-1 | `GET /:id/logs` is a new path segment. The existing `GET /` with role-hierarchy branching at L79–L112 matches `/` only. `/:id/logs` will not match `/` or `/:id`. Appending after L112 is safe. |
| `client-app/src/services/ApiService.js` | S13-1, S13-4 | Adding new exported methods (`getScreenLogs`, `postAuditLog`, `getImpressions`) does not alter existing method signatures. No existing caller is affected. JavaScript module exports are additive. |
| `ad-server/src/api/telemetry.js` | S13-4 | The `POST /impression` handler body receives an `await` call inserted before `res.json(...)`. The route registration line (`router.post('/impression', requireAuth, impressionLimiter, ...)`) is not changed. The limiter stays bound. The response contract (`200 { ok: true }`) is unchanged. |

---

### Non-Blocking Confirmation

**No story in Sprint 13 blocks another story's implementation start**, with one conditional:

- S13-3 (docs-only fix) can be implemented in any order.
- S13-1, S13-2, S13-4 can each be implemented in parallel — they touch different API files (`screens.js` vs `loops.js` vs `telemetry.js`) and different frontend pages (`TechOpsDashboard.jsx` vs `ScheduleManager.jsx` vs `LoopAnalytics.jsx`).
- **DECISION-1** (NODE_ENV guard) must be resolved before S13-4 E2E testing in the `test` environment — but it does not block S13-4 implementation start.

**Recommended implementation order (confirmed in Step 4):** S13-3 (XS, doc, zero risk) → S13-2 (S, route confirm, low risk) → S13-1 (M, new routes, medium) → S13-4 (M, persistence, medium). This order ships the highest-confidence items first and keeps the two M-effort stories at the end where any surprises from Step 1 greps have the most planning time.

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
|---|---|---|---|---|
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
| `client-app/src/pages/LoopDemoPlayer.jsx` | 35 994 B | ✅ NEW | No collision with `Player.jsx`. Risk 3 cleared. |
| `client-app/src/pages/admin/NetworkMap.jsx` | ~4 097 B | ✅ | Blank-render fix present. |
| `client-app/src/pages/admin/LoopAnalytics.jsx` | — | ✅ (S13-4 target) | Sprint 5 deliverable. Will be wired to live telemetry in S13-4. |
| `client-app/src/pages/tech/TechOpsDashboard.jsx` | — | ⚠️ FIXMEs present | S13-1 target. Step 1 grep required before coding. |
| `client-app/src/pages/retailer/ScheduleManager.jsx` | — | ⚠️ FIXMEs present | S13-2 target. Step 1 grep required before coding. |
| `ad-server/src/api/campaigns.js` | 6 323 B | ✅ | Guards confirmed. DELETE guard doc vs code mismatch — S13-3. |
| `ad-server/src/api/telemetry.js` | 5 135 B | ⚠️ Phase 2 TODO | Impression handler has no persistence yet. S13-4 target. |
| `ad-server/src/api/loops.js` | 8 674 B | ⚠️ FIXMEs present | Reject + approve-all handlers unconfirmed. S13-2 target. |
| `ad-server/src/api/playlists.js` | 2 100 B | ✅ | `'DRAFT'` bug fixed @ `e0ea260`. |
| `ad-server/src/api/screens.js` | 6 683 B | ✅ | Role branch live. S13-1 will add `GET /:id/logs` after L112. |
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
| S13-3 · Campaign DELETE guard fix | 🟢 98% | Ready for implementation | 1 confirmatory grep (10 seconds) |
| S13-4 · Telemetry impression persistence | 🟡 80% | Ready — Step 1 required | Repository scan + Firestore check |
| S13-2 · Loop reject + bulk approve | 🟡 72% | Ready — Step 1 required | 3 greps on `loops.js` + `ScheduleManager.jsx` + mount check |
| S13-1 · TechOps audit log + screen logs | 🟡 68% | Ready — Step 1 required | 4 greps on `TechOpsDashboard.jsx` + `audit-log` + `ApiService.js` |
| S11-1 · Super Admin CRUD — Users & Retailers | ⚠️ 70% | Carry-over | Persistence test (manual) |
| S11-2 · Super Admin CRUD — Advertisers | ⚠️ 70% | Carry-over | Persistence test (manual) |

---

## ⚠️ Genuine Cross-Cutting Risks

### Risk 1 — `telemetry.js` NODE_ENV guard × Demo Player E2E

**Status:** DECISION-1 open. S11-6 wiring confirmed. E2E tests firing impressions in `test` environment will hit the rate limiter if guard stays `!== 'production'`.

### Risk 2 — `GET /api/screens` role-conditional expansion

**Status:** ✅ Role branch confirmed L79–L112. Always run `Select-String -Path "ad-server/src/api/screens.js" -Pattern "ROLE_HIERARCHY"` before and after merging any screens-touching PR.

### Risk 3 — `LoopDemoPlayer.jsx` × `Player.jsx` collision

**Status:** ✅ CLEARED.

### Risk 4 — Two enum systems: `campaigns.status` vs `loops.status`

**Status:** ✅ Documented (2026-06-07). Uppercase = loops. Lowercase = campaigns. Any new story touching either must confirm which enum applies. S13-2 reject handler must write `'REJECTED'` (uppercase) for `loops.status`.

### Risk 5 — `impressionLimiter` must survive S13-4 handler refactor

**Status:** Open. When S13-4 adds persistence inside the `POST /api/telemetry/impression` handler, the `impressionLimiter` middleware (SECURITY-V3) must remain applied. Do not restructure the handler in a way that moves or removes the limiter. Confirm with `Select-String -Path "ad-server/src/api/telemetry.js" -Pattern "impressionLimiter"` after S13-4 is implemented. This is **CCR-2** in the Step 4 isolation audit — a hard PR merge gate.

---

## Cross-Story Dependency Map

```
S11-5 ── ✅ CLOSED
S11-3 ── ✅ CLOSED (NODE_ENV flag) ──► DECISION-1 ──► unblocks S11-6 E2E + S13-4 rate-limiter safety
S11-1 ── ⚠️ persistence test ──► unblocks S11-4 full close
ENUM-AUDIT-3 ── ✅ CLOSED @ e0ea260

S13-3 ── doc fix only ── no blockers ── implement first (XS effort, 98%)
S13-2 ── Step 1 grep required ── unblocks ScheduleManager FIXME removal (72%)
S13-1 ── Step 1 grep required ── no external blockers (68%)
S13-4 ── Step 1 grep required ── DECISION-1 must resolve before E2E (80%)
         └─ unblocks LoopAnalytics.jsx real-data display

CCR-1: S13-1 merge gate ── ROLE_HIERARCHY grep before + after
CCR-2: S13-4 merge gate ── impressionLimiter grep after
```

**Recommended implementation order (confirmed Step 4):** S13-3 (XS, doc only, 98%) → S13-2 (S, route confirm, 72%) → S13-1 (M, new routes, 68%) → S13-4 (M, persistence, 80%) → DECISION-1 → S11-6 E2E

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
| S13-3 · Campaign DELETE guard fix | Critical | XS | 98% | Ready for implementation | None |
| S13-4 · Telemetry impression persistence | High | M | 80% | Ready — Step 1 req | Step 1 greps |
| S13-2 · Loop reject + bulk approve | High | S | 72% | Ready — Step 1 req | Step 1 greps |
| S13-1 · TechOps audit log + screen logs | High | M | 68% | Ready — Step 1 req | Step 1 greps |
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
- [x] **Step 4 isolation audit complete** — all four stories cleared. CCR-1 (ROLE_HIERARCHY grep gate) and CCR-2 (impressionLimiter grep gate) defined as hard PR merge gates.
- [ ] **DECISION-1** — NODE_ENV guard documented + fix applied if needed
- [ ] S11-1 persistence test passed
- [ ] S11-2 persistence test passed
- [ ] S11-4 persistence test passed
- [ ] **S13-3** — `API_ROUTES.md` `DELETE /api/campaigns/:id` guard row corrected. Grep confirms match with live code.
- [ ] **S13-2** — loop reject + bulk approve routes confirmed/implemented. `API_ROUTES.md` rows updated. `ScheduleManager.jsx` FIXMEs removed. `'REJECTED'` uppercase confirmed.
- [ ] **S13-1** — `POST /api/audit-log` + `GET /api/screens/:id/logs` live. `TechOpsDashboard.jsx` FIXMEs removed. `API_ROUTES.md` updated. Empty state renders "No incidents logged yet." CCR-1 merge gate passed.
- [ ] **S13-4** — impression persistence wired. `GET /api/telemetry/impressions` live. `LoopAnalytics.jsx` shows real data. Phase 2 TODO removed. `impressionLimiter` still active (CCR-2 merge gate passed).
- [ ] Route Correction Log applied — no AC references `/dashboard/retailer/schedule/calendar`
- [ ] `docs/MVP_SPRINT_PLAN.md` updated with Sprint 13 entry
- [ ] No story marked Done without a commit SHA cited as evidence
- [ ] No vague acceptance criteria — all ACs have curl/grep verification commands
- [ ] `GUARDRAIL-5`: this file at `current_sprint/sprint13.md`, linked from `MVP_SPRINT_PLAN.md`

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
*Updated 2026-06-07 (`5891731`): Step 2 complete — 4 new stories scoped (S13-1 through S13-4) with full AC tables, blast-radius table, dependency map, recommended implementation order.*
*Updated 2026-06-08 (Step 3): Probabilities tightened (S13-3: 95%→98%, S13-2: 55%→72%, S13-1: 60%→68%, S13-4: 70%→80%). All ACs rewritten with falsifiable curl/grep verification. Decision trees added. Risk 5 formalised.*
*Updated 2026-06-08 (Step 4): Isolation audit complete. Blast-radius table finalised. CCR-1 (ROLE_HIERARCHY merge gate) and CCR-2 (impressionLimiter merge gate) defined. All four stories cleared for implementation. Non-blocking confirmation recorded.*
*Sources: live `App.jsx` @ `335f1c2`, `ad-server/src/api/` @ `294fd25`, `docs/API_ROUTES.md`, `docs/DATABASE_SCHEMA.md`, PowerShell grep outputs 2026-06-07/08.*
