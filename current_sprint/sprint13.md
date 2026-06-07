# Sprint 13 — MVP Gap Closure (Continued)

**Sprint:** 13
**Status:** Planning
**Cross-referenced with:** `client-app/src/App.jsx` @ `335f1c2`, `ad-server/src/api/` @ `294fd25`
**Guardrails authority:** [`docs/sprint8-sre-retro-consolidated.md`](./sprint8-sre-retro-consolidated.md)
**Route authority:** [`docs/API_ROUTES.md`](./API_ROUTES.md)
**Schema authority:** [`docs/DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md)
**MVP reference:** [`docs/Digital Screen Network Management Platform (MVP).md`](<./Digital Screen Network Management Platform (MVP).md>)

---

## Sprint 12 Close-Out Status

Step 1 (Repository Reality Check) executed against `App.jsx` @ `335f1c2` and `ad-server/src/api/` @ `294fd25` on 2026-06-07.

| Story | Status | Gap / Evidence |
|---|---|---|
| S11-3 · Security hardening — campaign auth + NODE_ENV guard | ⚠️ Unconfirmed | `campaigns.js` ✅ on disk (6 323 B); `telemetry.js` ✅ on disk (5 135 B). Guard presence requires grep — run pre-work bash block before opening |
| S11-1 · Super Admin CRUD — Users & Retailers | ⚠️ Unconfirmed | `users.js` ✅ on disk (8 219 B); `retailers.js` ✅ on disk (5 330 B). Hard-refresh persistence test not evidenced |
| S11-2 · Super Admin CRUD — Advertisers | ⚠️ Unconfirmed | `advertisers.js` ✅ on disk (5 268 B). Hard-refresh persistence test not evidenced |
| S11-4 · Retailer CRUD — Add Location | ⚠️ Likely partial | `stores.js` ✅ on disk — **grew from 6 909 B → 7 426 B** since Sprint 12 audit, suggesting edits were made. Read file before re-planning. Persistence test not evidenced |
| S11-5 · Retailer Approval — Loop Preview + App.jsx route reg | ✅ **CONFIRMED CLOSED** | All four routes confirmed live in `App.jsx` @ `335f1c2`: `retailer/loops` ✅ · `retailer/schedule` ✅ · `retailer/schedule-history` ✅ · `retailer/campaign-approvals` ✅. `CampaignApprovalList` duplicate documented as resolved in `App.jsx` header comment. No action needed. |
| S11-6 · Demo Player full wiring | ⚠️ Unconfirmed | `Player.jsx` ✅ on disk (23 098 B — **unchanged size**, suggesting no new wiring since Sprint 12). `LoopDemoPlayer.jsx` now exists at 35 994 B at `/player/demo` — see note below. Wiring requires grep |
| S11-7 · Network Map blank render | ⚠️ Unconfirmed | `NetworkMap.jsx` ✅ on disk (confirmed in `App.jsx` verified file map). `min-height` / fallback fix requires grep |
| S11-8 · Tech Ops network-wide screen data | ⚠️ Unconfirmed | `screens.js` ✅ on disk (6 683 B). Role-conditional branch requires grep |

> ⚠️ **NEW — `LoopDemoPlayer.jsx`:** A new top-level page (`client-app/src/pages/LoopDemoPlayer.jsx`, 35 994 B) is registered in `App.jsx` at `/player/demo`. This component did not exist in Sprint 12 planning. Any Sprint 13 work touching the Player or demo flow must account for this file and confirm it does not collide with S11-6 wiring changes to `Player.jsx`.

**Sprint 13 entry condition:** S11-5 is closed. All remaining ⚠️ items must have their pre-work bash blocks executed and findings logged in the PR description before any story is opened for implementation.

---

## 🔍 Isolation Verdict

> ⚠️ **Pending Step 4.** Complete the isolation and non-blocking audit after remaining bash block outputs are in hand.

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

- [ ] **ENUM-AUDIT-3** — confirm `campaigns.status` only writes lowercase (`draft`, `pendingapproval`, `scheduled`, `live`, `ended`). `grep -r "'APPROVED'\|'PENDING'" --include="*.js" --include="*.jsx"` must return zero results. ⚠️ **Unconfirmed from Sprint 12.**
- [ ] **SECURITY-V1** — `PATCH /api/campaigns/:id/status` must be wrapped in `requireRole` before any story ships. Carried from Sprint 11/12 — verify it is complete before marking S11-3 done.
- [ ] **SECURITY-V2** — `DELETE /api/campaigns/:id` must have `requireRole('superadmin')` guard. Verify S11-3 completion.
- [x] **SECURITY-V3** — ~~`POST /api/telemetry/impression` has no rate limit.~~ **RESOLVED** at commit `98bd645`. No action needed.
- [ ] **NODE_ENV guard** — confirm `if (process.env.NODE_ENV !== 'test')` bypass is in `telemetry.js` before any S11-6 E2E work begins.
- [x] **`CampaignApprovalList` duplicate** — ~~resolve ambiguous import before S11-5 merge~~. **RESOLVED** — documented in `App.jsx` header comment @ `335f1c2`. `pages/retailer/CampaignApprovalList.jsx` re-exports from `components/`; `RetailerDashboard` imports directly from `components/`. Single source of truth confirmed.
- [ ] **`BaseRepository.findById()`** — confirm method exists; needed by telemetry `play_count` increment. ⚠️ **Unconfirmed from Sprint 11/12.**
- [ ] **`docs/MVP_SPRINT_PLAN.md`** — add Sprint 13 entry linking to this file.

---

## Pre-Sprint Checklist

Resolve all items below before the planning meeting:

- [x] ~~Run `ls ad-server/src/api/`~~ — **Done via Step 1.** `users.js` ✅ · `retailers.js` ✅ · `advertisers.js` ✅ · `stores.js` ✅ · all confirmed present at `294fd25`
- [ ] Run `grep -n "requireRole\|router.patch\|router.delete" ad-server/src/api/campaigns.js` — confirm SECURITY-V1/V2 guards are in place
- [ ] Run `grep -n "NODE_ENV\|impressionLimiter" ad-server/src/api/telemetry.js` — confirm test bypass guard is present
- [x] ~~Run `grep -n "Loops\|ScheduleCalendar\|schedule/calendar\|retailer/loops" client-app/src/App.jsx`~~ — **Done via Step 1.** All routes confirmed live. **Correct live path is `retailer/schedule` (not `retailer/schedule/calendar`)** — update any test or acceptance criteria that referenced the old path.
- [ ] Run `grep -n "router.post\|create" ad-server/src/api/stores.js` — `stores.js` grew 8% (6 909 → 7 426 B); confirm what was added before re-opening S11-4
- [ ] Read `client-app/src/pages/Player.jsx` — confirm `TelemetryService.trackImpression()` call site is wired. Also confirm no collision with `LoopDemoPlayer.jsx` at `/player/demo`
- [ ] Confirm `BaseRepository.findById()` exists: `grep -n "findById" ad-server/src/repositories/BaseRepository.js`
- [ ] Confirm ENUM-AUDIT-3: `grep -r "'APPROVED'\|'PENDING'" --include="*.js" --include="*.jsx"` returns zero results
- [ ] Hard-refresh test for S11-1/S11-2 forms: confirm records persist after `Ctrl+Shift+R`
- [ ] Hard-refresh test for S11-4 Add Location form: confirm store record persists after `Ctrl+Shift+R`
- [ ] Run `grep -n "min-height\|apiKey\|unavailable" client-app/src/pages/admin/NetworkMap.jsx` — confirm fix or fallback is present
- [ ] Run `grep -n "techops\|role\|retaileradmin" ad-server/src/api/screens.js` — confirm role-conditional branch is live

---

## Known File Inventory (Step 1 Confirmed)

All paths confirmed on disk at commit `294fd25` / `App.jsx` @ `335f1c2`.

| File | Size | Status | Notes |
|---|---|---|---|
| `client-app/src/App.jsx` | 11 214 B | ✅ Confirmed | Route authority. All retailer routes registered. |
| `client-app/src/pages/Player.jsx` | 23 098 B | ✅ Confirmed | Unchanged size — TelemetryService wiring unconfirmed |
| `client-app/src/pages/LoopDemoPlayer.jsx` | 35 994 B | ✅ **NEW** | Registered at `/player/demo`. Did not exist in Sprint 12 planning. Must be accounted for in S11-6 work. |
| `client-app/src/pages/admin/NetworkMap.jsx` | — | ✅ Confirmed | Fix presence unconfirmed — grep required |
| `client-app/src/pages/admin/UserManagement.jsx` | — | ✅ Confirmed | Via App.jsx verified map |
| `client-app/src/pages/admin/RetailerManagement.jsx` | — | ✅ Confirmed | Via App.jsx verified map |
| `client-app/src/pages/admin/AdvertiserManagement.jsx` | — | ✅ Confirmed | Via App.jsx verified map |
| `client-app/src/pages/retailer/Loops.jsx` | — | ✅ Confirmed | Route: `/dashboard/retailer/loops` |
| `client-app/src/pages/retailer/ScheduleCalendar.jsx` | — | ✅ Confirmed | Route: `/dashboard/retailer/schedule` (**not** `schedule/calendar`) |
| `client-app/src/pages/retailer/ScheduleHistory.jsx` | — | ✅ Confirmed | Route: `/dashboard/retailer/schedule-history` |
| `client-app/src/pages/retailer/ScheduleManager.jsx` | — | ✅ Confirmed | Route: `/dashboard/retailer/schedule-manager` |
| `client-app/src/pages/retailer/CampaignApprovalList.jsx` | — | ✅ Confirmed | Route: `/dashboard/retailer/campaign-approvals`. Duplicate resolved. |
| `client-app/src/pages/tech/TechOpsDashboard.jsx` | — | ✅ Confirmed | Route: `/dashboard/techoperator` |
| `ad-server/src/api/campaigns.js` | 6 323 B | ✅ Confirmed | Guards unconfirmed — grep required |
| `ad-server/src/api/telemetry.js` | 5 135 B | ✅ Confirmed | NODE_ENV guard unconfirmed — grep required |
| `ad-server/src/api/users.js` | 8 219 B | ✅ Confirmed | — |
| `ad-server/src/api/retailers.js` | 5 330 B | ✅ Confirmed | — |
| `ad-server/src/api/advertisers.js` | 5 268 B | ✅ Confirmed | — |
| `ad-server/src/api/stores.js` | 7 426 B | ✅ Confirmed | Grew 8% — read before re-opening S11-4 |
| `ad-server/src/api/screens.js` | 6 683 B | ✅ Confirmed | Role branch unconfirmed — grep required |
| `ad-server/src/api/loops.js` | 8 674 B | ✅ Confirmed | — |
| `ad-server/src/api/notifications.js` | 5 216 B | ✅ Confirmed | Deferred — larger than expected for a stub; do not assume stub |

---

## Confidence Scores (SRE/QA Analysis — Pending remaining bash blocks)

> ⚠️ **Partially populated.** S11-5 is confirmed closed. Remaining scores require grep outputs from Pre-Sprint Checklist.

| Story | Score | Priority | Effort | Carry-over? | Merge order |
|---|---|---|---|---|---|
| S11-5 · Retailer Approval — routes + `CampaignApprovalList` | ✅ **CLOSED** | — | — | Confirmed closed @ `335f1c2` | No merge needed |
| S11-3 · Security hardening + NODE_ENV guard | ⚠️ TBD | Critical | S | Yes — guards unconfirmed | 1 — verify then close |
| S11-1 · Super Admin CRUD — Users & Retailers | ⚠️ TBD | Critical | L | Yes — persistence unconfirmed | 2 |
| S11-2 · Super Admin CRUD — Advertisers | ⚠️ TBD | Critical | M | Yes — persistence unconfirmed | 3 (parallel with S11-1) |
| S11-4 · Retailer CRUD — Add Location | ⚠️ TBD | High | S | Likely partial — stores.js grew | After S11-1 |
| S11-8 · Tech Ops network-wide screen data | ⚠️ TBD | Medium | S | Yes — role branch unconfirmed | Parallel with S11-4 |
| S11-7 · Network Map blank render | ⚠️ TBD | Medium | S | Yes — fix unconfirmed | After S11-8 |
| S11-6 · Demo Player full wiring | ⚠️ TBD | High | M | Yes — Player.jsx unchanged | Last — blocked on S11-3 + NODE_ENV guard. Account for `LoopDemoPlayer.jsx`. |

---

## 💥 Blast-Radius Table

> ⚠️ **Pending Step 4.** Complete the isolation and non-blocking audit after remaining bash block outputs are in hand.

| Task | Files Touched | Route(s) | Change Type | Shared Infra? | Can It Break Other Features? | Mitigation |
|---|---|---|---|---|---|---|
| *(to be filled after Step 4)* | — | — | — | — | — | — |

---

## Backlog

> Stories below are derived from Sprint 12 carry-overs. S11-5 is confirmed closed and removed from the backlog. All remaining stories require bash block confirmation before being opened.

---

### S12-CARRY · Sprint 12 Carry-overs (resolve before new scope)

All ⚠️ items from the Sprint 12 Close-Out table above must be triaged here. For each:
- Mark ✅ if closed — record the commit SHA
- Mark ❌ if still open — copy its pre-work bash block forward
- Mark 🚫 if descoped — document the reason

**S11-5 — ✅ CLOSED** @ `App.jsx` `335f1c2`. Routes `retailer/loops`, `retailer/schedule`, `retailer/schedule-history`, `retailer/campaign-approvals` all registered. `CampaignApprovalList` duplicate resolved. No further work required.

---

### S13-NEW · New Scope (to be defined after Step 1)

> ⚠️ **Do not add new stories here until all Sprint 12 carry-overs are triaged.** New scope from the MVP backlog should only be pulled in once the carry-over debt is known and the sprint velocity is confirmed.

---

## Route Correction Log

> **IMPORTANT — read before writing any acceptance criteria or bash grep patterns.**

| Old path (Sprint 12) | Correct live path (confirmed @ `335f1c2`) | Notes |
|---|---|---|
| `/dashboard/retailer/schedule/calendar` | `/dashboard/retailer/schedule` | `ScheduleCalendar` is served at `retailer/schedule` in `App.jsx`. The `/calendar` suffix never existed in the live router. All grep patterns, AC tables, and test assertions must use the corrected path. |

---

## Cross-Story Dependency Map

```
S11-5 ── ✅ CLOSED ──────────────────────────────────────────────────────────────

S11-3 (security + NODE_ENV guard) ── if still open ──► blocks S11-6 E2E

S11-1 (onboard retailer) ── if still open ──► blocks S11-4 (add location)

S11-6 (Demo Player) ── must account for LoopDemoPlayer.jsx at /player/demo ──► confirm no collision before wiring
```

**Recommended merge order:** S11-3 (verify/close) → S11-1 + S11-2 (parallel, persistence gate) → S11-4 + S11-8 (parallel) → S11-7 → S11-6 (last — blocked on S11-3 + NODE_ENV guard)

---

## ⚠️ Genuine Cross-Cutting Risks (carry-forward)

### Risk 1 — `telemetry.js` rate limiter × Demo Player speed multiplier
*(Carried from Sprint 12 — see sprint12.md for full context.)*
**Status:** Unresolved until S11-3 + S11-6 are both confirmed closed.

### Risk 2 — `GET /api/screens` role-conditional expansion
*(Carried from Sprint 12 — see sprint12.md for full context.)*
**Status:** Unresolved until S11-8 is confirmed closed. Always run `grep -rn "api/screens" client-app/src/pages/brand/` before merging any screens-touching PR.

### Risk 3 — `LoopDemoPlayer.jsx` × `Player.jsx` collision ⚠️ NEW
**Affected story:** S11-6
**New component:** `client-app/src/pages/LoopDemoPlayer.jsx` (35 994 B) registered at `/player/demo`. This component did not exist in Sprint 12.
**Problem:** S11-6 wires `Player.jsx` at `/player`. If `LoopDemoPlayer.jsx` shares any state, services, or API calls with `Player.jsx`, changes to impression wiring could have unintended side effects.
**Pre-check before S11-6 opens:**
```bash
# Confirm LoopDemoPlayer imports and shared dependencies
grep -n "TelemetryService\|trackImpression\|impression\|Player" \
  client-app/src/pages/LoopDemoPlayer.jsx
```
**Mitigation:** Treat the two files as independent until the grep confirms otherwise. If both call `TelemetryService.trackImpression()`, any change to the service contract must be backward-compatible.

---

## Deferred to Post-MVP (do not schedule this sprint)

- "Report Issue" and "Disconnect/Reestablish" screen actions (TASK-16, TASK-17)
- Notifications feed (`notifications.js` — deferred; note: file is 5 216 B, larger than a bare stub — do not assume it is empty before any post-MVP planning)
- Advanced analytics / campaign summary dashboard
- Retailer context selector for Super Admin impersonation (TASK-21)

---

## Story Point Summary

> ⚠️ **Partially populated.** Populate remaining rows after carry-over triage and bash block outputs.

| Story | Priority | Confidence | Effort (est.) | Sprint 12 status | Blocker? |
|---|---|---|---|---|---|
| S11-5 · Retailer Approval — routes | — | ✅ Closed | — | ✅ Confirmed closed | No |
| S11-3 · Security hardening + NODE_ENV | Critical | TBD | S | ⚠️ Guards unconfirmed | Yes — must close first |
| S11-1 · Super Admin CRUD — Users & Retailers | Critical | TBD | L | ⚠️ Persistence unconfirmed | Yes |
| S11-2 · Super Admin CRUD — Advertisers | Critical | TBD | M | ⚠️ Persistence unconfirmed | Yes |
| S11-4 · Retailer CRUD — Add Location | High | TBD | S | ⚠️ Likely partial | Needs S11-1 |
| S11-6 · Demo Player full wiring | High | TBD | M | ⚠️ Unchanged size | Needs S11-3 + NODE_ENV guard + LoopDemoPlayer check |
| S11-7 · Network Map blank render | Medium | TBD | S | ⚠️ Fix unconfirmed | No |
| S11-8 · Tech Ops network-wide data | Medium | TBD | S | ⚠️ Role branch unconfirmed | No |

---

## Definition of Done

- [ ] All Sprint 12 carry-overs triaged (✅ closed, ❌ carried, or 🚫 descoped) with evidence
- [x] S11-5 confirmed closed — routes and `CampaignApprovalList` resolution evidenced @ `335f1c2`
- [ ] Every new story has a confirmed on-disk file path (no NOT ON DISK items)
- [ ] Every new story has a confirmed live route in the Express router source
- [ ] All mutation routes name `requireRole` guard explicitly in acceptance criteria
- [ ] ENUM-AUDIT-3 grep returns zero uppercase variants
- [ ] `NODE_ENV !== 'test'` guard confirmed in `telemetry.js`
- [ ] `BaseRepository.findById()` confirmed present
- [ ] All new `data-testid` values documented in story acceptance criteria
- [ ] Hard-refresh persistence check passed for every CRUD story
- [ ] `LoopDemoPlayer.jsx` collision check completed before S11-6 opens
- [ ] Route Correction Log applied — no acceptance criteria reference `/dashboard/retailer/schedule/calendar`
- [ ] Blast-radius table complete (Step 4 executed)
- [ ] `docs/MVP_SPRINT_PLAN.md` updated with Sprint 13 entry
- [ ] No story marked Done without a commit SHA cited as evidence
- [ ] No vague acceptance criteria ("works correctly" language banned)
- [ ] `GUARDRAIL-5`: this file is at `docs/sprint13.md` and linked from `MVP_SPRINT_PLAN.md`

---

*Sprint 13 doc created 2026-06-07. Scaffold only — awaiting Step 1 (Repository Reality Check) to populate story details, confidence scores, and blast-radius table.*
*Updated 2026-06-07: Step 1 corrections applied — S11-5 confirmed closed @ `App.jsx` `335f1c2`; route path corrected (`retailer/schedule/calendar` → `retailer/schedule`); `LoopDemoPlayer.jsx` (35 994 B, `/player/demo`) added to Known File Inventory, Risk 3, and Definition of Done. `CampaignApprovalList` carry-over pre-condition marked resolved. `stores.js` growth (6 909 → 7 426 B) flagged.*
*Sources: live `App.jsx` @ `335f1c2`, `ad-server/src/api/` directory listing @ `294fd25`.*
