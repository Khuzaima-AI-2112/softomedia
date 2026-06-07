# Sprint 12 — MVP Gap Closure (Continued)

**Sprint:** 12
**Status:** Active
**Carried from:** `current_sprint/sprint11.md` + `current_sprint/sprint12.md` (task list)
**Generated:** 2026-06-06
**Source authority:** `current_sprint/sprint11-sre-qa-analysis.md` @ codebase `682eb456`
**Cross-referenced with:** `client-app/src/App.jsx` @ `ec3ea058`, `ad-server/src/api/` @ `24b991c9`
**Guardrails authority:** [`docs/sprint8-sre-retro-consolidated.md`](./sprint8-sre-retro-consolidated.md)
**Route authority:** [`docs/API_ROUTES.md`](./API_ROUTES.md)
**Schema authority:** [`docs/DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md)
**MVP reference:** [`docs/Digital Screen Network Management Platform (MVP).md`](<./Digital Screen Network Management Platform (MVP).md>)

---

## 🔍 Isolation Verdict

**Sprint 12 is PARTIALLY BLOCKING — one genuine cross-cutting risk identified, one env-level risk.**

Six of eight stories are fully isolated: S11-1, S11-2, S11-4, S11-5, S11-7, and S11-8 touch only their own dedicated routes, repositories, and page components with no shared state or shared middleware beyond `requireRole`, which they only add to (never modify). They carry zero blast radius to unrelated features.

**Cross-cutting risk 1 — `telemetry.js` / `impressionLimiter` (S11-3 × S11-6):** `POST /api/telemetry/impression` is the single endpoint shared by both tasks. S11-3 confirms the rate limiter is live; S11-6 drives that same endpoint at 60× speed (≈ 288 req/session). Without a `NODE_ENV !== 'test'` guard around `impressionLimiter`, S11-6 E2E tests will 429-fail mid-session. **Backward-compatible fix:** add the env guard in `telemetry.js` before S11-6 work begins. The limiter stays active in production; only the test runner bypasses it.

**Cross-cutting risk 2 — `GET /api/screens` role-conditional branch (S11-8):** This is an existing endpoint that all three roles (`techops`, `retaileradmin`, `brand`) already call. S11-8 adds a conditional query branch (`techops` → unfiltered, `retaileradmin` → filtered by `retailer_id`, `brand` → 403). This is backward-compatible because the `retaileradmin` path returns the same filtered result set it always did; only `techops` gets an expanded result. The `brand` 403 is new behavior, but brand users do not call `/api/screens` today — confirmed from `BrandDashboard.jsx` imports.

**Blocked dependency:** S11-6 is blocked until S11-3 is merged AND the `NODE_ENV` env guard is added to `telemetry.js`. All other stories are independently mergeable in parallel.

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
   All workflow/status values must match the `docs/DATABASE_SCHEMA.md` enum definitions exactly (lowercase, underscore-separated). This file lives at `docs/sprint12.md` per GUARDRAIL-5.

---

## Guardrails Checklist

Before any story is marked **Ready for implementation**, confirm all five boxes:

| Rule | Required check | ✓ |
|---|---|---|
| **GUARDRAIL-1** Service method exists | Every `apiService.X()` call verified in `ApiService.js` source | ☐ |
| **GUARDRAIL-2** Route contract exists | HTTP method, path, body shape confirmed in `docs/API_ROUTES.md` | ☐ |
| **GUARDRAIL-3** Auth guard named in AC | Mutation routes explicitly state `requireRole('X') confirmed` | ☐ |
| **GUARDRAIL-4** Enum values canonical | Status strings match schema; grep returns zero uppercase variants at close | ☐ |
| **GUARDRAIL-5** Doc placement | This file is at `docs/sprint12.md`; linked from `docs/MVP_SPRINT_PLAN.md` | ☐ |

---

## Carry-over Pre-conditions (from sprint11.md)

- [ ] **ENUM-AUDIT-3** — confirm `campaigns.status` only writes lowercase (`draft`, `pendingapproval`, `scheduled`, `live`, `ended`). `grep -r "'APPROVED'\|'PENDING'" --include="*.js" --include="*.jsx"` must return zero results.
- [ ] **SECURITY-V1** — `PATCH /api/campaigns/:id/status` must be wrapped in `requireRole` before any story in this sprint ships. Carried from Sprint 11 — verify it is complete before marking S11-3 done.
- [ ] **SECURITY-V2** — `DELETE /api/campaigns/:id` must have `requireRole('superadmin')` guard. Same — verify S11-3 completion.
- [x] **SECURITY-V3** — ~~`POST /api/telemetry/impression` has no rate limit.~~ **RESOLVED** — `impressionLimiter` wired in `telemetry.js` @ `98bd645`. No action needed.
- [ ] **NODE_ENV guard** — add `if (process.env.NODE_ENV !== 'test')` bypass around `impressionLimiter` in `telemetry.js` before any S11-6 E2E work begins.
- [ ] **`CampaignApprovalList` duplicate** — resolve ambiguous import before S11-5 merge: `grep -r "CampaignApprovalList" client-app/src --include="*.jsx" -n`
- [ ] **`docs/MVP_SPRINT_PLAN.md`** — add Sprint 12 entry linking to this file.

---

## Pre-Sprint Checklist

Resolve all items below before the planning meeting:

- [ ] Run `ls ad-server/src/api/` — confirm which of `users.js`, `retailers.js`, `advertisers.js`, `stores.js` exist *(all four confirmed present at audit time — re-verify)*
- [ ] Run `grep -n "requireRole" ad-server/src/api/campaigns.js` — confirm V1/V2 guards are in place (S11-3 should be done)
- [ ] Read `client-app/src/pages/Player.jsx` — confirm or add `TelemetryService.trackImpression()` call site
- [ ] Run `grep -n "Loops\|ScheduleCalendar" client-app/src/App.jsx` — confirm route registration *(both confirmed registered at audit time)*
- [ ] Add `NODE_ENV !== 'test'` guard to `impressionLimiter` before S11-6 E2E tests run (speed-multiplier collision)
- [ ] Confirm `BaseRepository.findById()` exists — needed by telemetry `play_count` increment
- [ ] Confirm `ENUM-AUDIT-3`: `grep -r "'APPROVED'\|'PENDING'" --include="*.js" --include="*.jsx"` returns zero results
- [ ] Resolve `CampaignApprovalList` duplicate: `grep -r "CampaignApprovalList" client-app/src --include="*.jsx" -n`

---

## Confidence Scores (SRE/QA Analysis @ `682eb456`)

| Story | Score | Priority | Effort | Merge order |
|---|---|---|---|---|
| S11-3 · Security hardening | **97%** | Critical | S | 1 — merge first |
| S11-1 · Super Admin CRUD — Users & Retailers | 80% | Critical | L | 2 |
| S11-2 · Super Admin CRUD — Advertisers | 82% | Critical | M | 3 (parallel with S11-1) |
| S11-5 · Retailer approval workflow | 83% | High | M | 4 (parallel with S11-8) |
| S11-8 · Tech Ops network-wide data | 85% | Medium | S | 4 (parallel with S11-5) |
| S11-4 · Retailer CRUD — Add Location | 78% | High | S | after S11-1 |
| S11-7 · Network Map blank render | 88% | Medium | S | 6 |
| S11-6 · Demo Player full wiring | 72% | High | M | last — blocked on S11-3 + NODE_ENV guard |

---

## 💥 Blast-Radius Table

| Task | Files Touched | Route(s) | Change Type | Shared Infra? | Can It Break Other Features? | Mitigation |
|---|---|---|---|---|---|---|
| **S11-3** Security hardening | `ad-server/src/api/campaigns.js` | `PATCH /api/campaigns/:id/status`, `DELETE /api/campaigns/:id` | Add `requireRole` guards (additive) | **Y** — `campaigns.js` read by `CampaignManagement.jsx` and `BrandDashboard.jsx` | Only unauthenticated callers break — by design. No regression for authenticated callers. | Verify existing authenticated tests still pass after guard insertion. |
| **S11-1** Super Admin CRUD — Users & Retailers | `users.js`, `retailers.js`, `UserManagement.jsx`, `RetailerManagement.jsx`, `UserRepository.js`, `RetailerRepository.js` | `POST /api/users`, `DELETE /api/users/:id`, `POST /api/retailers`, `PATCH /api/retailers/:id`, `DELETE /api/retailers/:id` | Wire UI → existing API; add missing CRUD methods to repos | **N** | No. New methods are additive. Existing `GET` routes untouched. | Soft-delete pattern — records never hard-deleted; downstream FK integrity preserved. |
| **S11-2** Super Admin CRUD — Advertisers | `advertisers.js`, `AdvertiserManagement.jsx`, `AdvertiserRepository.js` | `POST /api/advertisers`, `DELETE /api/advertisers/:id` | Wire UI buttons → router; add `findByEmail()` + soft-delete to repo | **N** | No. Additive only. | `findByEmail()` solely for 409 dupe guard on `POST`. |
| **S11-4** Retailer CRUD — Add Location | `stores.js`, `RetailerDashboard.jsx`, `StoreRepository.js` | `POST /api/stores` | Wire UI → router; verify/add `create()` to repo | **N** | No. Only `POST` (new resource). Existing `GET /api/stores` untouched. | `retailer_id` from `req.user` session — not a form field. |
| **S11-5** Retailer Approval — Loop Preview | `Loops.jsx`, `ScheduleHistory.jsx`, `RetailerDashboard.jsx`, `loops.js` | `GET /api/locations/:id/loops`, `/dashboard/retailer/loops`, `/dashboard/retailer/schedule-history` | Fix broken hrefs; add `navigate(-1)`; confirm/add backend route | **N** | No. Navigation fixes are client-only. `GET` route addition cannot regress existing routes. | Enum audit (`grep -r "'APPROVED'\|'DRAFT'\|'LOCKED'"`) must pass before merge. |
| **S11-6** Demo Player — Full Wiring | `pages/Player.jsx`, `TelemetryService.js`, `telemetry.js`, `BaseRepository.js` | `POST /api/telemetry/impression` (existing), `/player` (existing) | Wire cascading selectors + playback loop + impression counter | **Y** — shared with production impression tracking | **YES — blocked until S11-3 merged + `NODE_ENV` guard added.** 288 calls/session vs. 100 req/min cap. | Add `NODE_ENV !== 'test'` guard around `impressionLimiter` in `telemetry.js` before any E2E work. |
| **S11-7** Network Map — Fix Blank Render | `NetworkMap.jsx`, `docs/ENVIRONMENT_SETUP.md` | `/dashboard/admin/map` (existing), `GET /api/screens` (read-only) | Fix container height and/or add API-key fallback; document env var | **N** | No. CSS height fix or `if (!apiKey)` fallback — both purely additive. | Two-path implementation (Case A/B) ensures no uncaught JS exceptions. |
| **S11-8** Tech Ops — Network-Wide Screen Data | `TechOpsDashboard.jsx`, `screens.js`, `ScreenRepository.js` | `GET /api/screens` (existing endpoint, new role branch) | Add role-conditional query branch | **Y** — `GET /api/screens` consumed by `ScreenManagement.jsx`, `NetworkMap.jsx`, `TechOpsDashboard.jsx` | Potential regression for `ScreenManagement.jsx` and `NetworkMap.jsx` if role-branch logic is miscoded. | `superadmin` and `retaileradmin` return identical result sets to today. Only `techops` path is new. Confirm: `grep -rn "api/screens" client-app/src/pages/brand/`. |

---

## Backlog

---

### S11-3 · Security Hardening — campaign auth + telemetry rate limit ⟵ MERGE FIRST

**Priority:** Critical (pre-condition for all other stories)
**Confidence:** 97%
**Risk refs:** V1, V2, V3 from sprintWRAPUP
**Files:**
- `ad-server/src/api/campaigns.js`
- `ad-server/src/api/telemetry.js` ← V3 already resolved; add `NODE_ENV` guard only
- `ad-server/src/middleware/rateLimiter.js` ← already complete

**Context:** V1 and V2 require two `requireRole` guards to be added to `campaigns.js`. **V3 is already resolved** — `impressionLimiter` is imported and wired in `telemetry.js` at commit `98bd645`. This story also adds the `NODE_ENV !== 'test'` bypass to unblock S11-6 E2E testing.

**Pre-work:**

```bash
# Confirm PATCH and DELETE verb guards
grep -n "requireRole\|router.patch\|router.delete" \
  ad-server/src/api/campaigns.js

# Confirm impressionLimiter is wired (not a dead import)
grep -n "impressionLimiter" ad-server/src/api/telemetry.js
# Expected ~line 4:  import { impressionLimiter } from '../middleware/rateLimiter.js';
# Expected ~line 56: router.post('/impression', impressionLimiter, async (req, res) => {
```

**Acceptance criteria:**

| Check | Method | Pass condition |
|---|---|---|
| PATCH status auth | `curl -X PATCH /api/campaigns/test` (no role header) | 401 or 403 |
| DELETE auth | `curl -X DELETE /api/campaigns/test` (no auth) | 401 |
| DELETE wrong role | Same with `x-demo-role: brand` | 403 |
| Rate limit | 101 rapid POSTs to `/api/telemetry/impression` | 101st returns 429 with `Retry-After` header |
| Rate limit body | Parse 429 response | `{ error: 'Too Many Requests', retryAfter: N, limit: 100, windowMs: 60000 }` |
| NODE_ENV guard | E2E run with `NODE_ENV=test` | No 429 returned during test suite |

> ⚠️ **Enum note:** The 429 body is `'Too Many Requests'` (title case) — not `'Too many requests'` as written in the original spec. Tests must match the implementation.

**NODE_ENV guard implementation:**

```js
// ad-server/src/api/telemetry.js
router.post('/impression',
  process.env.NODE_ENV !== 'test' ? impressionLimiter : (req, res, next) => next(),
  async (req, res) => { /* existing handler unchanged */ }
);
```

**GUARDRAIL checks:**
- [ ] G3: Both `campaigns.js` mutations name exact middleware and confirm placement in router chain
- [ ] G4: No enum changes in this story

---

### S11-1 · Super Admin CRUD — Users & Retailers (MVP Blocker)

**Priority:** Critical
**Confidence:** 80%
**TASK refs:** TASK-02, TASK-03, TASK-04, TASK-05, TASK-06
**Files (corrected):**
- `client-app/src/pages/admin/UserManagement.jsx` ← ~~Users.jsx does not exist~~
- `client-app/src/pages/admin/RetailerManagement.jsx` ← ~~Retailers.jsx does not exist~~
- `ad-server/src/api/users.js` (verify existence before wiring)
- `ad-server/src/api/retailers.js` (verify existence before wiring)
- `ad-server/src/repositories/UserRepository.js`
- `ad-server/src/repositories/RetailerRepository.js`

**Context:** All Super Admin CRUD forms are UI-only and do not persist to Firestore. No real retailer or user can be onboarded without these routes. `UserManagement.jsx` is 14 569 bytes and `RetailerManagement.jsx` is 50 256 bytes — both are large files; grep for `console.log.*TODO\|// TODO\|stub` inside both before starting.

**Pre-work:**

```bash
# Confirm actual file names
ls client-app/src/pages/admin/
# → UserManagement.jsx, RetailerManagement.jsx (not Users.jsx / Retailers.jsx)

# Confirm API router files exist
ls ad-server/src/api/users.js ad-server/src/api/retailers.js 2>&1
# If either is missing, create it before UI wiring

# Confirm repositories export create/update/softDelete
grep -n "create\|update\|softDelete\|deactivate" \
  ad-server/src/repositories/UserRepository.js \
  ad-server/src/repositories/RetailerRepository.js

# Locate unwired buttons
grep -n "console.log.*TODO\|// TODO\|stub" \
  client-app/src/pages/admin/UserManagement.jsx \
  client-app/src/pages/admin/RetailerManagement.jsx
```

**Acceptance criteria:**

**Environment:** `NODE_ENV=development`, `x-demo-role: superadmin` header on all mutation requests.

| Verb | Route | Auth guard | Success | Error codes |
|---|---|---|---|---|
| POST | `/api/users` | `requireRole('superadmin')` | 201 `{ user_id }` | 400, 403, 409 (email dupe) |
| DELETE | `/api/users/:id` | `requireRole('superadmin')` | 200 `{ status: 'inactive' }` | 403, 404 |
| POST | `/api/retailers` | `requireRole('superadmin')` | 201 `{ retailer_id }` | 400, 403, 409 |
| PATCH | `/api/retailers/:id` | `requireRole('superadmin')` | 200 | 400, 403, 404 |
| DELETE | `/api/retailers/:id` | `requireRole('superadmin')` | 200 `{ status: 'inactive' }` | 403, 404 |

**data-testid requirements:**

```
data-testid="add-user-btn"
data-testid="user-row-{id}"
data-testid="delete-user-btn-{id}"
data-testid="add-retailer-btn"
data-testid="retailer-row-{id}"
data-testid="delete-retailer-btn-{id}"
```

**Persistence check (mandatory):** After each create/delete, hard-refresh (`Ctrl+Shift+R`) the management page. Record must appear / be absent in the list. Story is only passed if the record survives the refresh.

**GUARDRAIL checks:**
- [ ] G1: `apiService.createUser()`, `apiService.deleteUser()`, `apiService.createRetailer()`, `apiService.updateRetailer()`, `apiService.deleteRetailer()` — verify or create in `ApiService.js`
- [ ] G2: All five routes confirmed in router source
- [ ] G3: All mutations confirm `requireRole('superadmin')`
- [ ] G4: `users.status` enum: `active | inactive` per schema

---

### S11-2 · Super Admin CRUD — Advertisers (MVP Blocker)

**Priority:** Critical
**Confidence:** 82%
**TASK refs:** TASK-07, TASK-08
**Files (corrected):**
- `client-app/src/pages/admin/AdvertiserManagement.jsx` ← ~~Advertisers.jsx does not exist~~
- `ad-server/src/api/advertisers.js` (5 268 bytes — confirmed ✅)
- `ad-server/src/repositories/AdvertiserRepository.js` (1 441 bytes — check soft-delete and `findByEmail`)

**Context:** "Add Advertiser" and "Remove Advertiser" buttons are not wired to any API. `AdvertiserRepository.js` at 1 441 bytes is small — may be missing a soft-delete or `findByEmail` for the 409 guard. Check before writing the router.

**Pre-work:**

```bash
# Confirm router file
ls ad-server/src/api/advertisers.js 2>&1

# Confirm AdvertiserRepository has create and softDelete
grep -n "create\|delete\|deactivate" \
  ad-server/src/repositories/AdvertiserRepository.js

# Check for existing email-uniqueness guard
grep -n "409\|email.*exists\|unique" \
  ad-server/src/api/advertisers.js 2>/dev/null || echo "File missing or guard absent"

# Add findByEmail if absent
grep -n "findByEmail" \
  ad-server/src/repositories/AdvertiserRepository.js
```

**Acceptance criteria:**

**Environment:** `NODE_ENV=development`, `x-demo-role: superadmin`.

| Verb | Route | Auth guard | Success | Error codes |
|---|---|---|---|---|
| POST | `/api/advertisers` | `requireRole('superadmin')` | 201 `{ advertiser_id }` | 400, 403, 409 (email dupe) |
| DELETE | `/api/advertisers/:id` | `requireRole('superadmin')` | 200 `{ status: 'inactive' }` | 403, 404 |

Form validation: name (required), email (required, valid format), billing contact (optional).

**data-testid requirements:**

```
data-testid="add-advertiser-btn"
data-testid="advertiser-row-{id}"
data-testid="delete-advertiser-btn-{id}"
data-testid="advertiser-email-input"
```

**Persistence check:** Hard-refresh after create and delete. Record must persist / be absent.

**GUARDRAIL checks:**
- [ ] G1: `apiService.createAdvertiser()`, `apiService.deleteAdvertiser()` — verify or create
- [ ] G2: Routes confirmed in router source
- [ ] G3: `requireRole('superadmin')` confirmed on both mutations

---

### S11-4 · Retailer CRUD — Add Location

**Priority:** High
**Confidence:** 78%
**TASK ref:** TASK-20
**Files (corrected):**
- `client-app/src/pages/retailer/RetailerDashboard.jsx` ← ~~Locations.jsx does not exist~~
- `ad-server/src/api/stores.js` (6 909 bytes — confirmed ✅)
- `ad-server/src/repositories/StoreRepository.js` (1 132 bytes — confirm `create()` method)

**Context:** "Add Location" button in the retailer dashboard does not create a store record in Firestore. `LocationRepository.js` is 232 bytes — almost certainly a bare stub. Confirm `StoreRepository.js` method surface and `stores.js` router existence before writing any code.

**Pre-work:**

```bash
# Find the "Add Location" UI entry point
grep -rn "Add Location\|addLocation\|add-location" \
  client-app/src/pages/retailer/RetailerDashboard.jsx

# Check StoreRepository method surface
cat ad-server/src/repositories/StoreRepository.js

# Confirm stores.js API router exists
ls ad-server/src/api/stores.js 2>&1

# Confirm demo auth middleware sets req.user.retailer_id
grep -n "retailer_id\|req.user" \
  ad-server/src/middleware/demoAuth.js 2>/dev/null || \
grep -n "retailer_id\|req.user" \
  ad-server/src/middleware/auth.js 2>/dev/null
```

**Acceptance criteria:**

**Environment:** `NODE_ENV=development`, `x-demo-role: retaileradmin`.

| Verb | Route | Auth guard | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/api/stores` | `requireRole('retaileradmin')` | `{ name, address, city, province, postal_code, retailer_id }` | 201 `{ store_id }` | 400, 403 |

> ⚠️ `retailer_id` must come from the authenticated session context (`req.user.retailer_id`), not a form field. Confirm demo auth middleware sets this before wiring the form.

- On success, new location appears in the retailer's location list without page reload.

**data-testid requirements:**

```
data-testid="add-location-btn"
data-testid="location-name-input"
data-testid="location-address-input"
data-testid="location-submit-btn"
data-testid="location-row-{id}"
```

**Persistence check:** After form submit, hard-refresh the retailer dashboard. New location must appear in the list.

**GUARDRAIL checks:**
- [ ] G1: `apiService.createStore()` — verify or create
- [ ] G2: `POST /api/stores → { name, address, retailer_id }` confirmed in `stores.js`
- [ ] G3: `requireRole('retaileradmin') confirmed`

---

### S11-5 · Retailer Approval Workflow — Loop Preview Page

**Priority:** High
**Confidence:** 83%
**Risk refs:** R3, R4 from sprintWRAPUP
**TASK refs:** TASK-18 (Schedule Calendar), TASK-19 (Go Back crash)
**Files:**
- `client-app/src/pages/retailer/Loops.jsx` ← **already exists** (5 778 bytes) — do NOT re-create
- `client-app/src/pages/retailer/ScheduleCalendar.jsx` ← **already exists** (14 241 bytes)
- `client-app/src/pages/retailer/ScheduleHistory.jsx` ← **already exists** (20 355 bytes)
- `client-app/src/pages/retailer/ScheduleManager.jsx` ← **already exists** (24 906 bytes)
- `client-app/src/App.jsx` — confirm route registration for all above
- `ad-server/src/api/loops.js` (8 674 bytes — confirmed ✅)

**Context:** The primary risk ("Loops.jsx missing entirely") is eliminated — the file exists at HEAD `682eb456`. The work in this story is route registration, broken navigation links, and the Go Back crash fix. The Schedule Calendar at `/dashboard/retailer/schedule/calendar` may route to a dead path if `App.jsx` registration is missing. The `CampaignApprovalList` duplicate import must be resolved before merge.

**Pre-work:**

```bash
# Confirm Loops.jsx and ScheduleCalendar.jsx are registered in App.jsx
grep -n "Loops\|ScheduleCalendar\|schedule/calendar\|retailer/loops" \
  client-app/src/App.jsx

# Confirm the loops API route exists
grep -n "router.get\|locations.*loops\|retailer.*loops" \
  ad-server/src/api/loops.js 2>/dev/null || echo "loops.js missing or route absent"

# Check RetailerDashboard quick-action href values (TASK-19)
grep -n "schedule/calendar\|/history\|Go Back\|goBack" \
  client-app/src/pages/retailer/RetailerDashboard.jsx

# Resolve CampaignApprovalList duplicate
grep -r "CampaignApprovalList" client-app/src --include="*.jsx" -n

# Enum audit — must return zero results before merge
grep -rn "'APPROVED'\|'DRAFT'\|'LOCKED'" \
  client-app/src/pages/retailer/
```

**Acceptance criteria:**

**Environment:** `NODE_ENV=development`, `x-demo-role: retaileradmin`.

| Check | Route | Pass condition |
|---|---|---|
| Loops page loads | `/dashboard/retailer/loops` | Renders without white screen or 404 |
| Loops API call | `GET /api/locations/:id/loops` | 200 with loop array |
| Schedule Calendar loads | `/dashboard/retailer/schedule/calendar` | Renders without 404 |
| Quick-action links | RetailerDashboard | Click navigates to valid registered route |
| "Go Back" in History | ScheduleHistory back button | No crash, navigates to previous page |
| CampaignApprovalList | App.jsx | No duplicate import warning in console |

**data-testid requirements:**

```
data-testid="loops-list"
data-testid="loop-row-{id}"
data-testid="loop-status-badge-{id}"
data-testid="schedule-calendar-container"
```

**Enum constraint:** Loop status badge must render one of: `draft` | `approved` | `locked` — matching schema exactly. No uppercase variants.

**GUARDRAIL checks:**
- [ ] G2: `GET /api/locations/:id/loops` confirmed in `loops.js` router
- [ ] G3: Route protected by `requireRole('retaileradmin')`
- [ ] G4: Status badge strings match schema: `approved | draft | locked`

---

### S11-6 · Demo Player — Cascading Selection + Full-Day Playback + Impression Wiring

**Priority:** High
**Confidence:** 72% (lowest in sprint)
**TASK refs:** TASK-09, TASK-10
**Files (corrected):**
- `client-app/src/pages/Player.jsx` ← ~~pages/demo/Player.jsx does not exist~~ (23 KB — largest unknown)
- `client-app/src/services/TelemetryService.js`
- `ad-server/src/api/telemetry.js` ← NODE_ENV guard to be added here
- `ad-server/src/repositories/BaseRepository.js`

**Context:** The Demo Player is the primary MVP showcase. `Player.jsx` is 23 KB — its internal wiring is the largest single unknown in this sprint. Impression persistence in `telemetry.js` is **already fully wired** at commit `98bd645`. The V3 pre-condition is resolved.

> ⛔ **BLOCKED** — do not start until S11-3 is merged AND the `NODE_ENV !== 'test'` guard is added to `telemetry.js`. At 60× playback speed = 288 impression calls per session vs. 100 req/min cap → rate limiter will 429 mid-session during E2E tests without the guard.

**Pre-work:**

```bash
# Confirm TelemetryService.trackImpression signature
grep -n "trackImpression\|function track\|export" \
  client-app/src/services/TelemetryService.js

# Confirm Player.jsx has cascading selector scaffolding
grep -n "retailer.*store\|store.*screen\|cascad\|selector" \
  client-app/src/pages/Player.jsx

# Confirm Player.jsx currently calls TelemetryService (or not)
grep -n "TelemetryService\|trackImpression\|telemetry" \
  client-app/src/pages/Player.jsx

# Confirm BaseRepository.findById exists (needed by play_count increment)
grep -n "findById" ad-server/src/repositories/BaseRepository.js

# Confirm NODE_ENV guard is in place before starting
grep -n "NODE_ENV\|impressionLimiter" ad-server/src/api/telemetry.js
```

**Acceptance criteria:**

**Environment:** `NODE_ENV=development`. Player at `/player` (not `/demo/player`).

| Check | data-testid | Pass condition |
|---|---|---|
| Retailer selector renders | `data-testid="retailer-select"` | Populates from `GET /api/retailers` |
| Store depends on retailer | `data-testid="store-select"` | Disabled until retailer selected; clears on retailer change |
| Screen depends on store | `data-testid="screen-select"` | Disabled until store selected |
| Play Full Day button | `data-testid="play-full-day-btn"` | Cycles loops 1–24 |
| Speed multiplier | `data-testid="speed-select"` | Options: 1×, 10×, 60× |
| Impression counter | `data-testid="impression-counter"` | Increments on each ad play |
| Telemetry fired | Network tab | `POST /api/telemetry/impression` → 201 on each slot |
| No 429 in E2E | `NODE_ENV=test` | Rate limiter bypassed; no 429 during test run |

**Persistence check:** After a playback session, query Firestore `impressions` collection — records matching `screen_id` must be present.

**GUARDRAIL checks:**
- [ ] G1: `TelemetryService.trackImpression()` — verify signature in `TelemetryService.js`
- [ ] G2: `POST /api/telemetry/impression → { screen_id, campaign_id, asset_id?, loop_id?, played_at? }` confirmed
- [ ] G3: Telemetry route uses `requireAuth` (device-level). Confirmed.

---

### S11-7 · Network Map — Fix Blank Render

**Priority:** Medium
**Confidence:** 88%
**TASK ref:** TASK-12
**Files:**
- `client-app/src/pages/admin/NetworkMap.jsx` (4 203 bytes — confirmed ✅)
- `.env` / Cloud Run env config
- `docs/ENVIRONMENT_SETUP.md`

**Context:** The network map renders blank. Root cause is likely a missing `VITE_GOOGLE_MAPS_API_KEY` environment variable or a container with `height: 0`. API key procurement is an external dependency — the fallback message is the mitigation for missing keys.

**Pre-work:**

```bash
# Read the component to find root cause
cat client-app/src/pages/admin/NetworkMap.jsx

# Check if VITE_GOOGLE_MAPS_API_KEY is declared in .env.example
grep -n "GOOGLE_MAPS\|VITE_GOOGLE" .env.example client-app/.env.example 2>/dev/null

# Check if the map container has a CSS height
grep -n "height\|min-height\|style=" \
  client-app/src/pages/admin/NetworkMap.jsx
```

**Acceptance criteria:**

**Case A — API key present:**

| Check | Pass condition |
|---|---|
| Map renders | Google Maps tiles visible |
| Screen pins | At least one pin visible when `GET /api/screens` returns data |
| Pin click | Opens tooltip with screen name and status |

**Case B — API key absent (`VITE_GOOGLE_MAPS_API_KEY` undefined):**

| Check | data-testid | Pass condition |
|---|---|---|
| Fallback renders | `data-testid="map-unavailable-msg"` | Text: "Map unavailable — API key not configured" |
| No blank container | — | Container has `min-height: 400px` |
| No console error | — | No uncaught Google Maps JS exception |

**Documentation:** `docs/ENVIRONMENT_SETUP.md` must include:
```
VITE_GOOGLE_MAPS_API_KEY=your_key_here   # Required for Network Map
```

**GUARDRAIL checks:**
- [ ] G2: No new API routes in this story
- [ ] G4: No enum changes

---

### S11-8 · Tech Ops Dashboard — Network-Wide Screen Data

**Priority:** Medium
**Confidence:** 85%
**TASK ref:** TASK-23
**Files:**
- `client-app/src/pages/tech/` — confirm exact dashboard filename before starting
- `ad-server/src/api/screens.js`
- `ad-server/src/repositories/ScreenRepository.js` (2 885 bytes — confirmed ✅)

**Context:** Tech Ops dashboard shows filtered/incomplete screen data instead of the full network view required by the MVP. `ScreenRepository.js` exists with meaningful content; the work is adding a role-conditional branch to `GET /api/screens`. The `brand` 403 is safe — brand pages do not call `/api/screens` today (confirmed from `BrandDashboard.jsx` imports).

**Pre-work:**

```bash
# Confirm the Tech Ops dashboard file name
ls client-app/src/pages/tech/

# Confirm GET /api/screens has a role-conditional branch
grep -n "requireRole\|router.get\|techops\|retaileradmin" \
  ad-server/src/api/screens.js

# Confirm ScreenRepository has an unfiltered findAll
grep -n "findAll\|getAll\|where.*retailer" \
  ad-server/src/repositories/ScreenRepository.js

# Safety check — confirm brand pages do NOT call /api/screens
grep -rn "api/screens" client-app/src/pages/brand/
# Expected: zero results
```

**Role-conditional implementation:**

```js
// ad-server/src/api/screens.js
router.get('/', requireAuth, async (req, res) => {
  const role = req.user.role;
  if (role === 'techops') {
    const screens = await ScreenRepository.findAll();                          // NEW — unfiltered
    return res.json(screens);
  }
  if (role === 'retaileradmin') {
    const screens = await ScreenRepository.findByRetailer(req.user.retailer_id); // EXISTING behaviour
    return res.json(screens);
  }
  if (role === 'superadmin') {
    const screens = await ScreenRepository.findAll();                          // EXISTING behaviour
    return res.json(screens);
  }
  return res.status(403).json({ error: 'Forbidden' });
});
```

**Acceptance criteria:**

**Environment:** `NODE_ENV=development`.

| Role | Route | Filter | Expected |
|---|---|---|---|
| `techops` | `GET /api/screens` | None | All screens, all retailers — 200 |
| `retaileradmin` | `GET /api/screens` | `retailer_id` from session | Own screens only — 200 (existing behaviour preserved) |
| `superadmin` | `GET /api/screens` | None | All screens — 200 (existing behaviour preserved) |
| `brand` | `GET /api/screens` | — | 403 |

- Dashboard KPIs show: total screens, online count, offline count, screens with active campaigns.
- Screen list is sortable by status and last heartbeat.

**data-testid requirements:**

```
data-testid="total-screens-kpi"
data-testid="online-screens-kpi"
data-testid="offline-screens-kpi"
data-testid="active-campaigns-kpi"
data-testid="screen-table"
data-testid="screen-row-{id}"
data-testid="sort-by-status"
data-testid="sort-by-heartbeat"
```

**GUARDRAIL checks:**
- [ ] G2: `GET /api/screens` (unfiltered) confirmed in `screens.js`
- [ ] G3: `requireRole('techops') confirmed` for unfiltered variant — GUARDRAIL-G3

---

## Cross-Story Dependency Map

```
S11-3 (security + NODE_ENV guard) ── must merge first ──► S11-1 (CRUD writes)
                                                           S11-2 (CRUD writes)
                                  ── NODE_ENV guard ─────► S11-6 unblocked ✅

V3 (telemetry rate limit) ────────── ALREADY DONE ───────► S11-6 no longer blocked by V3 ✅

S9-1 (impression persist) ─────────── already in main ───► S11-6 telemetry wiring ✅

S11-1 (onboard retailer) ──────────── enables ───────────► S11-4 (add location)
                                                            S11-5 (retailer loops need real retailer)

S11-8 (GET /api/screens role branch) ─ verify brand safe ► ScreenManagement.jsx + NetworkMap.jsx
                                                            (superadmin/retaileradmin unchanged ✅)
```

**Recommended merge order:** S11-3 → S11-1 + S11-2 (parallel, split into sub-PRs) → S11-5 + S11-8 (parallel) → S11-4 → S11-7 → S11-6

---

## ⚠️ Genuine Cross-Cutting Risks (2)

### Risk 1 — `telemetry.js` rate limiter × Demo Player speed multiplier

**Affected stories:** S11-3 (confirms limiter is live + adds NODE_ENV guard), S11-6 (drives endpoint at 60×)
**Shared endpoint:** `POST /api/telemetry/impression`
**Problem:** At 60× playback speed, a full-day demo session fires ≈ 288 impression calls. The `impressionLimiter` (100 req/min window) is correctly active in production. Without a test environment bypass, S11-6 E2E tests will begin returning 429s at call #101, making automated testing non-deterministic.
**Fix (add in S11-3):**
```js
router.post('/impression',
  process.env.NODE_ENV !== 'test' ? impressionLimiter : (req, res, next) => next(),
  async (req, res) => { /* ... */ }
);
```
The limiter is fully active in `production` and `staging`. Only the `test` runner bypasses it.

### Risk 2 — `GET /api/screens` role-conditional expansion

**Affected story:** S11-8
**Shared endpoint:** `GET /api/screens` — consumed by `ScreenManagement.jsx`, `NetworkMap.jsx`, and `TechOpsDashboard.jsx`
**Problem:** Adding a role-branch to an existing endpoint risks altering the response shape for existing callers if the branch selector is miscoded.
**Mitigation:** Role branch is strictly conditional. `superadmin` and `retaileradmin` paths return identical result sets to today. Only `techops` gets the new unfiltered view. `brand` 403 is safe — brand pages confirmed to not call `/api/screens`. Always run: `grep -rn "api/screens" client-app/src/pages/brand/` before merging S11-8.

---

## Deferred to Post-MVP (do not schedule this sprint)

- "Report Issue" and "Disconnect/Reestablish" screen actions (TASK-16, TASK-17)
- Notifications feed (`notifications.js` stub — Risk R5)
- Advanced analytics / campaign summary dashboard
- Retailer context selector for Super Admin impersonation (TASK-21)

---

## Story Point Summary

| Story | Priority | Confidence | Effort (est.) | Blocker? |
|---|---|---|---|---|
| S11-3 · Security hardening + NODE_ENV guard | Critical | 97% | S | Yes — merge first |
| S11-1 · Super Admin CRUD — Users & Retailers | Critical | 80% | L | Yes — no real onboarding without it |
| S11-2 · Super Admin CRUD — Advertisers | Critical | 82% | M | Yes |
| S11-4 · Retailer CRUD — Add Location | High | 78% | S | Needs S11-1 |
| S11-5 · Loop preview + approval workflow | High | 83% | M | No |
| S11-6 · Demo Player full wiring | High | 72% | M | Needs S11-3 + NODE_ENV guard |
| S11-7 · Network Map blank render | Medium | 88% | S | No |
| S11-8 · Tech Ops network-wide data | Medium | 85% | S | No |

**Estimated sprint velocity:** 8 stories — recommend splitting S11-1 into two sub-PRs (Users / Retailers) for easier review.

---

*Sprint 12 doc created 2026-06-06. Upgraded 2026-06-06 from task-list format to full sprint spec (matching sprint11.md structure) — added SRE rules, guardrails, blast-radius table, isolation verdict, full story sections with pre-work bash blocks, AC tables, data-testid requirements, cross-story dependency map, NODE_ENV guard implementation, deferred section.*
*Sources: `sprint11-sre-qa-analysis.md` @ codebase `682eb456`, `App.jsx` @ `ec3ea058`, `ad-server/src/api/` @ `24b991c9`.*
