# Sprint 13 — MVP Gap Closure (Continued)

**Sprint:** 13
**Status:** Planning
**Cross-referenced with:** `client-app/src/App.jsx` — commit TBD (run Step 1 to confirm)
**Guardrails authority:** [`docs/sprint8-sre-retro-consolidated.md`](./sprint8-sre-retro-consolidated.md)
**Route authority:** [`docs/API_ROUTES.md`](./API_ROUTES.md)
**Schema authority:** [`docs/DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md)
**MVP reference:** [`docs/Digital Screen Network Management Platform (MVP).md`](<./Digital Screen Network Management Platform (MVP).md>)

---

## Sprint 12 Close-Out Status

> ⚠️ **Fill this table in before Sprint 13 planning begins.** Run Step 1 from `SPRINT_OPERATOR.md` against the Sprint 12 stories below. Every ❌ or ⚠️ item carries directly into Sprint 13 and must be resolved before any new story is opened.

| Story | Status | Gap |
|---|---|---|
| S11-3 · Security hardening — campaign auth + NODE_ENV guard | ⚠️ Unconfirmed | Verify `requireRole` guards in `campaigns.js` and `NODE_ENV` guard in `telemetry.js` |
| S11-1 · Super Admin CRUD — Users & Retailers | ⚠️ Unconfirmed | Hard-refresh persistence test not evidenced from Sprint 12 |
| S11-2 · Super Admin CRUD — Advertisers | ⚠️ Unconfirmed | Hard-refresh persistence test not evidenced from Sprint 12 |
| S11-4 · Retailer CRUD — Add Location | ⚠️ Unconfirmed | Confirm `StoreRepository.create()` wired and persistence verified |
| S11-5 · Retailer Approval — Loop Preview + App.jsx route reg | ⚠️ Unconfirmed | Confirm `/dashboard/retailer/loops` and `schedule/calendar` registered in `App.jsx` |
| S11-6 · Demo Player full wiring | ⚠️ Unconfirmed | Confirm `Player.jsx` cascading selectors + `TelemetryService.trackImpression()` wired |
| S11-7 · Network Map blank render | ⚠️ Unconfirmed | Confirm `min-height` fix or API-key fallback message implemented |
| S11-8 · Tech Ops network-wide screen data | ⚠️ Unconfirmed | Confirm role-conditional branch live in `GET /api/screens` |

**Sprint 13 entry condition:** Before any story below is opened for implementation, all ⚠️ items must be closed or explicitly carried forward with pre-work bash blocks executed and findings logged in the PR description.

---

## 🔍 Isolation Verdict

> ⚠️ **Pending Step 1.** Complete the repository reality check before filling in this section.

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
- [ ] **`CampaignApprovalList` duplicate** — resolve ambiguous import before S11-5 merge: `grep -r "CampaignApprovalList" client-app/src --include="*.jsx" -n`
- [ ] **`BaseRepository.findById()`** — confirm method exists; needed by telemetry `play_count` increment. ⚠️ **Unconfirmed from Sprint 11/12.**
- [ ] **`docs/MVP_SPRINT_PLAN.md`** — add Sprint 13 entry linking to this file.

---

## Pre-Sprint Checklist

Resolve all items below before the planning meeting:

- [ ] Run `ls ad-server/src/api/` — re-verify `users.js`, `retailers.js`, `advertisers.js`, `stores.js` all still exist
- [ ] Run `grep -n "requireRole" ad-server/src/api/campaigns.js` — confirm SECURITY-V1/V2 guards are in place
- [ ] Run `grep -n "NODE_ENV" ad-server/src/api/telemetry.js` — confirm test bypass guard is present
- [ ] Run `grep -n "Loops\|ScheduleCalendar\|schedule/calendar\|retailer/loops" client-app/src/App.jsx` — confirm routes registered
- [ ] Read `client-app/src/pages/Player.jsx` — confirm `TelemetryService.trackImpression()` call site is wired
- [ ] Confirm `BaseRepository.findById()` exists: `grep -n "findById" ad-server/src/repositories/BaseRepository.js`
- [ ] Confirm ENUM-AUDIT-3: `grep -r "'APPROVED'\|'PENDING'" --include="*.js" --include="*.jsx"` returns zero results
- [ ] Resolve `CampaignApprovalList` duplicate: `grep -r "CampaignApprovalList" client-app/src --include="*.jsx" -n`
- [ ] Hard-refresh test for S11-1/S11-2 forms: confirm records persist after `Ctrl+Shift+R`
- [ ] Hard-refresh test for S11-4 Add Location form: confirm store record persists after `Ctrl+Shift+R`
- [ ] Confirm `NetworkMap.jsx` container has `min-height` set or fallback message renders

---

## Confidence Scores (SRE/QA Analysis — Pending Step 1)

> ⚠️ **Pending.** Run Step 1 and Step 3 from `SPRINT_OPERATOR.md` to populate this table.

| Story | Score | Priority | Effort | Carry-over? | Merge order |
|---|---|---|---|---|---|
| *(to be filled after Step 1)* | — | — | — | — | — |

---

## 💥 Blast-Radius Table

> ⚠️ **Pending Step 4.** Complete the isolation and non-blocking audit before implementation begins.

| Task | Files Touched | Route(s) | Change Type | Shared Infra? | Can It Break Other Features? | Mitigation |
|---|---|---|---|---|---|---|
| *(to be filled after Step 1 + Step 4)* | — | — | — | — | — | — |

---

## Backlog

> Stories below are placeholders derived from Sprint 12 carry-overs. Run Step 1 to confirm file paths, routes, and reality before treating any story as ready.

---

### S12-CARRY · Sprint 12 Carry-overs (resolve before new scope)

All ⚠️ items from the Sprint 12 Close-Out table above must be triaged here. For each:
- Mark ✅ if closed — record the commit SHA
- Mark ❌ if still open — copy its pre-work bash block forward
- Mark 🚫 if descoped — document the reason

---

### S13-NEW · New Scope (to be defined after Step 1)

> ⚠️ **Do not add new stories here until all Sprint 12 carry-overs are triaged.** New scope from the MVP backlog should only be pulled in once the carry-over debt is known and the sprint velocity is confirmed.

---

## Cross-Story Dependency Map

```
Sprint 12 carry-overs ── verify closed ──────► new S13 scope unblocked

S11-3 (security + NODE_ENV guard) ── if still open ──► blocks S11-6 E2E

S11-1 (onboard retailer) ── if still open ──► blocks S11-4 (add location)
                                              blocks S11-5 (retailer loops)
```

**Recommended merge order:** close all carry-overs in dependency order → then new scope in isolation order (additive-only first)

---

## ⚠️ Genuine Cross-Cutting Risks (carry-forward)

### Risk 1 — `telemetry.js` rate limiter × Demo Player speed multiplier
*(Carried from Sprint 12 — see sprint12.md for full context.)*
**Status:** Unresolved until S11-3 + S11-6 are both confirmed closed.

### Risk 2 — `GET /api/screens` role-conditional expansion
*(Carried from Sprint 12 — see sprint12.md for full context.)*
**Status:** Unresolved until S11-8 is confirmed closed. Always run `grep -rn "api/screens" client-app/src/pages/brand/` before merging any screens-touching PR.

---

## Deferred to Post-MVP (do not schedule this sprint)

- "Report Issue" and "Disconnect/Reestablish" screen actions (TASK-16, TASK-17)
- Notifications feed (`notifications.js` stub — Risk R5)
- Advanced analytics / campaign summary dashboard
- Retailer context selector for Super Admin impersonation (TASK-21)

---

## Story Point Summary

> ⚠️ **Pending Step 1.** Populate after carry-over triage and new scope definition.

| Story | Priority | Confidence | Effort (est.) | Sprint 12 status | Blocker? |
|---|---|---|---|---|---|
| *(to be filled after Step 1)* | — | — | — | — | — |

---

## Definition of Done

- [ ] All Sprint 12 carry-overs triaged (✅ closed, ❌ carried, or 🚫 descoped) with evidence
- [ ] Every new story has a confirmed on-disk file path (no NOT ON DISK items)
- [ ] Every new story has a confirmed live route in the Express router source
- [ ] All mutation routes name `requireRole` guard explicitly in acceptance criteria
- [ ] ENUM-AUDIT-3 grep returns zero uppercase variants
- [ ] `NODE_ENV !== 'test'` guard confirmed in `telemetry.js`
- [ ] `CampaignApprovalList` duplicate import resolved
- [ ] `BaseRepository.findById()` confirmed present
- [ ] All new `data-testid` values documented in story acceptance criteria
- [ ] Hard-refresh persistence check passed for every CRUD story
- [ ] Blast-radius table complete (Step 4 executed)
- [ ] `docs/MVP_SPRINT_PLAN.md` updated with Sprint 13 entry
- [ ] No story marked Done without a commit SHA cited as evidence
- [ ] No vague acceptance criteria ("works correctly" language banned)
- [ ] `GUARDRAIL-5`: this file is at `docs/sprint13.md` and linked from `MVP_SPRINT_PLAN.md`

---

*Sprint 13 doc created 2026-06-07. Scaffold only — awaiting Step 1 (Repository Reality Check) to populate story details, confidence scores, and blast-radius table.*
*Sources: `sprint12.md` carry-over analysis, `SPRINT_OPERATOR.md` v1.*
