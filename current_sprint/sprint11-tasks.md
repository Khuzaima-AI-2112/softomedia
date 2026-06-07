# Sprint 11 — Critical & High Quality Gap Task List

**Generated:** 2026-06-06
**Updated:** 2026-06-06 — added SRE blast-radius audit, isolation verdict, S11-7, S11-8, confidence table, merge order
**Source authority:** `current_sprint/sprint11-sre-qa-analysis.md` @ codebase `682eb456`
**Cross-referenced with:** `current_sprint/sprint11.md`, `client-app/src/App.jsx`, `ad-server/src/api/`

---

## 🔍 Isolation Verdict

**Sprint 11 is PARTIALLY BLOCKING — one genuine cross-cutting risk identified, one env-level risk.**

Six of eight stories are fully isolated: S11-1, S11-2, S11-4, S11-5, S11-7, and S11-8 touch only their own dedicated routes, repositories, and page components with no shared state or shared middleware beyond `requireRole`, which they only add to (never modify). They carry zero blast radius to unrelated features.

**Cross-cutting risk 1 — `telemetry.js` / `impressionLimiter` (S11-3 × S11-6):** `POST /api/telemetry/impression` is the single endpoint shared by both tasks. S11-3 confirms the rate limiter is live; S11-6 drives that same endpoint at 60× speed (≈ 288 req/session). Without a `NODE_ENV !== 'test'` guard around `impressionLimiter`, S11-6 E2E tests will 429-fail mid-session. **Backward-compatible fix:** add the env guard in `telemetry.js` before S11-6 work begins. The limiter stays active in production; only the test runner bypasses it.

**Cross-cutting risk 2 — `GET /api/screens` role-conditional branch (S11-8):** This is an existing endpoint that all three roles (`techops`, `retaileradmin`, `brand`) already call. S11-8 adds a conditional query branch (`techops` → unfiltered, `retaileradmin` → filtered by `retailer_id`, `brand` → 403). This is backward-compatible because the `retaileradmin` path returns the same filtered result set it always did; only `techops` gets an expanded result. The `brand` 403 is new behavior, but brand users do not call `/api/screens` today — confirmed from `BrandDashboard.jsx` imports.

**Blocked dependency:** S11-6 is blocked until S11-3 is merged (the `impressionLimiter` guard must be in place first) and until the `NODE_ENV` env guard is added to `telemetry.js`. All other stories are independently mergeable in parallel.

---

## 💥 Blast-Radius Table

| Task | Files Touched | Route(s) | Change Type | Shared Infra? | Can It Break Other Features? | Mitigation |
|---|---|---|---|---|---|---|
| **S11-3** Security hardening | `ad-server/src/api/campaigns.js` | `PATCH /api/campaigns/:id/status`, `DELETE /api/campaigns/:id` | Add `requireRole` guards (additive) | **Y** — `campaigns.js` is read by `CampaignManagement.jsx` and `BrandDashboard.jsx` | Only if callers lacked role headers — they do, by design. Unauthenticated callers get 401/403 instead of 200. No regression for authenticated callers. | Verify existing authenticated tests still pass after guard insertion. |
| **S11-1** Super Admin CRUD — Users & Retailers | `ad-server/src/api/users.js`, `ad-server/src/api/retailers.js`, `pages/admin/UserManagement.jsx`, `pages/admin/RetailerManagement.jsx`, `ad-server/src/repositories/UserRepository.js`, `ad-server/src/repositories/RetailerRepository.js` | `POST /api/users`, `DELETE /api/users/:id`, `POST /api/retailers`, `PATCH /api/retailers/:id`, `DELETE /api/retailers/:id` | Wire UI → existing API endpoints; add missing CRUD methods to repos | **N** — `UserRepository` is only imported by `users.js`; `RetailerRepository` only by `retailers.js`. No shared context. | No. New methods are additive. Existing `GET` routes untouched. | Soft-delete (`status: 'inactive'`) pattern — records are never hard-deleted, downstream FK integrity preserved. |
| **S11-2** Super Admin CRUD — Advertisers | `ad-server/src/api/advertisers.js` (5 268 bytes — exists ✅), `pages/admin/AdvertiserManagement.jsx`, `ad-server/src/repositories/AdvertiserRepository.js` | `POST /api/advertisers`, `DELETE /api/advertisers/:id` | Wire UI buttons → existing router; add `findByEmail()` + soft-delete to repo | **N** — `AdvertiserRepository` imported only by `advertisers.js`. | No. Additive methods only. | `findByEmail()` used solely for 409 dupe guard on `POST`; no existing query path is modified. |
| **S11-4** Retailer CRUD — Add Location | `ad-server/src/api/stores.js` (6 909 bytes — exists ✅), `pages/retailer/RetailerDashboard.jsx`, `ad-server/src/repositories/StoreRepository.js` | `POST /api/stores` | Wire UI → existing router; verify/add `create()` to `StoreRepository` | **N** — `stores.js` is its own router, not imported by other routers. `StoreRepository` not shared. | No. Only `POST` (new resource creation) is added. Existing `GET /api/stores` untouched. | `retailer_id` sourced from `req.user` session — not a form field — preventing cross-retailer injection. |
| **S11-5** Retailer Approval — Loop Preview | `pages/retailer/Loops.jsx` (route already registered in App.jsx ✅), `pages/retailer/ScheduleHistory.jsx`, `pages/retailer/RetailerDashboard.jsx`, `ad-server/src/api/loops.js` (8 674 bytes — exists ✅) | `GET /api/locations/:id/loops`, `/dashboard/retailer/loops`, `/dashboard/retailer/schedule-history` | Fix broken hrefs; add `navigate(-1)` to ScheduleHistory; confirm/add `GET /api/locations/:id/loops` backend route | **N** — `loops.js` serves retailer-scoped loop data only. No admin or brand routes share this path. | No. Navigation fixes are client-only. The `GET` route addition is new — it cannot regress existing routes. | Enum audit (`grep -r "'APPROVED'\|'DRAFT'\|'LOCKED'"`) must pass before merge to prevent casing regression. |
| **S11-6** Demo Player — Full Wiring | `pages/Player.jsx` (23 KB), `client-app/src/services/TelemetryService.js`, `ad-server/src/api/telemetry.js`, `ad-server/src/repositories/BaseRepository.js` | `POST /api/telemetry/impression` (existing), `/player` (existing) | Wire cascading selectors + playback loop + impression counter | **Y** — `POST /api/telemetry/impression` is shared with production impression tracking from live screens | **YES — blocked until S11-3 merged + `NODE_ENV` guard added.** At 60× speed = 288 calls/session vs. 100 req/min cap → rate limiter will 429 mid-session during E2E tests. | Add `if (process.env.NODE_ENV !== 'test')` guard around `impressionLimiter` in `telemetry.js` before any S11-6 E2E work. Production behavior unchanged. |
| **S11-7** Network Map — Fix Blank Render | `pages/admin/NetworkMap.jsx`, `docs/ENVIRONMENT_SETUP.md` | `/dashboard/admin/map` (existing), `GET /api/screens` (read-only consumer) | Fix container height and/or add API-key-absent fallback; document env var | **N** — `NetworkMap.jsx` only reads `GET /api/screens`. It does not write, mutate, or share state with any other component. | No. The fix is either a CSS height correction or an `if (!apiKey)` fallback render — both are purely additive. | Two-path implementation (Case A / Case B) ensures the page never throws uncaught JS exceptions regardless of env key state. |
| **S11-8** Tech Ops — Network-Wide Screen Data | `pages/tech/TechOpsDashboard.jsx`, `ad-server/src/api/screens.js`, `ad-server/src/repositories/ScreenRepository.js` | `GET /api/screens` (existing endpoint, new role branch) | Add role-conditional query branch to existing endpoint | **Y** — `GET /api/screens` is consumed by `ScreenManagement.jsx` (admin), `NetworkMap.jsx` (admin), and `TechOpsDashboard.jsx` (techops) | Potential regression for `ScreenManagement.jsx` and `NetworkMap.jsx` if role-branch logic is incorrectly gated. | Role branch is strictly conditional: `superadmin` and `retaileradmin` paths return identical result sets to today. Only `techops` path is new (unfiltered). `brand` 403 is safe — brand pages do not call `/api/screens`. Confirm with: `grep -rn "api/screens" client-app/src/pages/brand/`. |

---

## ⚠️ Genuine Cross-Cutting Risks (2)

### Risk 1 — `telemetry.js` rate limiter × Demo Player speed multiplier

**Affected stories:** S11-3 (confirms limiter is live), S11-6 (drives endpoint at 60×)
**Shared endpoint:** `POST /api/telemetry/impression`
**Problem:** At 60× playback speed, a full-day demo session fires ≈ 288 impression calls. The `impressionLimiter` (100 req/min window) is correctly active in production. Without a test environment bypass, S11-6 E2E tests will begin returning 429s at call #101, making automated testing non-deterministic.
**Backward-compatible fix:**
```js
// ad-server/src/api/telemetry.js
router.post('/impression',
  process.env.NODE_ENV !== 'test' ? impressionLimiter : (req, res, next) => next(),
  async (req, res) => { /* ... */ }
);
```
The limiter is fully active in `production` and `staging`. Only the `test` runner bypasses it.

---

### Risk 2 — `GET /api/screens` role-conditional expansion

**Affected story:** S11-8
**Shared endpoint:** `GET /api/screens` — consumed by `ScreenManagement.jsx`, `NetworkMap.jsx`, and `TechOpsDashboard.jsx`
**Problem:** Adding a role-branch to an existing endpoint risks altering response shape for existing callers if the branch selector is miscoded.
**Backward-compatible design:**
```js
// ad-server/src/api/screens.js
router.get('/', requireAuth, async (req, res) => {
  const role = req.user.role;
  if (role === 'techops') {
    const screens = await ScreenRepository.findAll();          // NEW — unfiltered
    return res.json(screens);
  }
  if (role === 'retaileradmin') {
    const screens = await ScreenRepository.findByRetailer(req.user.retailer_id); // EXISTING behaviour
    return res.json(screens);
  }
  if (role === 'superadmin') {
    const screens = await ScreenRepository.findAll();          // EXISTING behaviour
    return res.json(screens);
  }
  return res.status(403).json({ error: 'Forbidden' });
});
```
`superadmin` and `retaileradmin` return the same data they always did. Only `techops` gets the new unfiltered view.

---

## Confidence Score Summary

| Story | Confidence | Priority | Effort | Merge order |
|---|---|---|---|---|
| S11-3 · Security hardening | **97%** | Critical | S | 1 — merge first |
| S11-7 · Network Map blank render | **88%** | Medium | S | 6 |
| S11-8 · Tech Ops network-wide data | **85%** | Medium | S | 5 |
| S11-5 · Retailer approval workflow | **83%** | High | M | 4 |
| S11-2 · Super Admin CRUD — Advertisers | **82%** | Critical | M | 3 |
| S11-1 · Super Admin CRUD — Users & Retailers | **80%** | Critical | L | 2 |
| S11-4 · Retailer CRUD — Add Location | **78%** | High | S | after S11-1 |
| S11-6 · Demo Player full wiring | **72%** | High | M | last — blocked on S11-3 + NODE_ENV guard |

**Recommended merge order:** S11-3 → S11-1 + S11-2 (parallel) → S11-5 + S11-8 (parallel) → S11-7 → S11-6

---

## Critical Gaps

---

### S11-3 · Security Hardening — ⟵ MERGE FIRST (97% confidence)

Two auth guards missing from `campaigns.js`. V3 (telemetry rate limit) is already resolved.

- [ ] Run `grep -n "requireRole\|router.patch\|router.delete" ad-server/src/api/campaigns.js` — confirm current guard state
- [ ] Add `requireRole('retaileradmin')` middleware to `PATCH /api/campaigns/:id/status`
- [ ] Add `requireRole('superadmin')` middleware to `DELETE /api/campaigns/:id`
- [ ] Verify `impressionLimiter` is wired (not a dead import): `grep -n "impressionLimiter" ad-server/src/api/telemetry.js`
- [ ] Test: unauthenticated `PATCH` → must return 401/403; `DELETE` with `x-demo-role: brand` → must return 403
- [ ] Test: 101 rapid POSTs to `/api/telemetry/impression` → 101st must return `429 { error: 'Too Many Requests' }` (title case — not lowercase)

---

### S11-1 · Super Admin CRUD — Users & Retailers (80% confidence)

All CRUD forms are UI-only — nothing persists to Firestore.

- [ ] `ls client-app/src/pages/admin/` — confirm `UserManagement.jsx` and `RetailerManagement.jsx` (not `Users.jsx` / `Retailers.jsx`)
- [ ] `ls ad-server/src/api/users.js ad-server/src/api/retailers.js` — if either is missing, **create the router file first** before any UI wiring
- [ ] `grep -n "create\|update\|softDelete\|deactivate" ad-server/src/repositories/UserRepository.js ad-server/src/repositories/RetailerRepository.js` — add any missing methods
- [ ] `grep -n "console.log.*TODO\|// TODO\|stub" client-app/src/pages/admin/UserManagement.jsx` — locate unwired buttons
- [ ] Wire `POST /api/users` with `requireRole('superadmin')` → 201 `{ user_id }`; 409 on email dupe
- [ ] Wire `DELETE /api/users/:id` with `requireRole('superadmin')` → 200 `{ status: 'inactive' }`
- [ ] Wire `POST /api/retailers` with `requireRole('superadmin')` → 201 `{ retailer_id }`; 409 on dupe
- [ ] Wire `PATCH /api/retailers/:id` with `requireRole('superadmin')` → 200
- [ ] Wire `DELETE /api/retailers/:id` with `requireRole('superadmin')` → 200 `{ status: 'inactive' }`
- [ ] Add `data-testid` attributes: `add-user-btn`, `user-row-{id}`, `delete-user-btn-{id}`, `add-retailer-btn`, `retailer-row-{id}`, `delete-retailer-btn-{id}`
- [ ] **Persistence check:** hard-refresh after every create/delete — record must survive the reload

---

### S11-2 · Super Admin CRUD — Advertisers (82% confidence)

"Add Advertiser" and "Remove Advertiser" buttons are not wired to any API.

- [ ] `ls ad-server/src/api/advertisers.js` — if missing, create router file before UI wiring
- [ ] `grep -n "create\|delete\|deactivate" ad-server/src/repositories/AdvertiserRepository.js` — at 1 441 bytes it may be missing soft-delete and `findByEmail`
- [ ] Add `findByEmail()` to `AdvertiserRepository.js` if absent (needed for 409 email-dupe guard)
- [ ] Wire `POST /api/advertisers` with `requireRole('superadmin')` → 201 `{ advertiser_id }`; 409 on email dupe
- [ ] Wire `DELETE /api/advertisers/:id` with `requireRole('superadmin')` → 200 `{ status: 'inactive' }`
- [ ] Add `data-testid` attributes: `add-advertiser-btn`, `advertiser-row-{id}`, `delete-advertiser-btn-{id}`, `advertiser-email-input`
- [ ] **Persistence check:** hard-refresh after create/delete

---

## High Priority Gaps

---

### S11-6 · Demo Player — Full Wiring (72% confidence — lowest in sprint)

`Player.jsx` is 23 KB and unread. Speed-multiplier will collide with rate limiter at 60×.

> ⛔ **BLOCKED** — do not start until S11-3 is merged AND `NODE_ENV !== 'test'` guard is added to `telemetry.js`.

- [ ] `grep -n "retailer.*store\|store.*screen\|cascad\|selector" client-app/src/pages/Player.jsx` — confirm cascading selector scaffolding exists or needs building from scratch
- [ ] `grep -n "TelemetryService\|trackImpression\|telemetry" client-app/src/pages/Player.jsx` — confirm or add `TelemetryService.trackImpression()` call site
- [ ] `grep -n "trackImpression\|function track\|export" client-app/src/services/TelemetryService.js` — confirm method signature before wiring
- [ ] `grep -n "findById" ad-server/src/repositories/BaseRepository.js` — confirm exists (needed by `play_count` increment)
- [ ] **Fix rate-limiter collision:** add `if (process.env.NODE_ENV !== 'test')` guard around `impressionLimiter` in `ad-server/src/api/telemetry.js` — 60× speed = 288 calls/session vs. 100 req/min cap → will fail E2E without this guard
- [ ] Wire cascading selectors: retailer → store → screen (each dropdown disabled until parent selected; clears on parent change)
- [ ] Wire "Play Full Day" to cycle 24 hourly loops with speed options 1×, 10×, 60×
- [ ] Ensure impression counter (`data-testid="impression-counter"`) increments on each ad slot
- [ ] Add all `data-testid` attributes: `retailer-select`, `store-select`, `screen-select`, `play-full-day-btn`, `speed-select`, `impression-counter`
- [ ] **Persistence check:** after playback session, query Firestore `impressions` collection for records matching `screen_id`

---

### S11-4 · Retailer CRUD — Add Location (78% confidence)

`LocationRepository.js` is a 232-byte stub; `stores.js` router confirmed on disk at 6 909 bytes ✅.

- [ ] `cat ad-server/src/repositories/StoreRepository.js` — read full file to confirm `create()` method exists; add if missing
- [ ] `grep -rn "Add Location\|addLocation\|add-location" client-app/src/pages/retailer/RetailerDashboard.jsx` — locate button entry point in the UI
- [ ] Confirm demo auth middleware sets `req.user.retailer_id` — `retailer_id` must come from session context, **not** a form field
- [ ] Wire `POST /api/stores` with `requireRole('retaileradmin')` → 201 `{ store_id }`; body: `{ name, address, city, province, postal_code, retailer_id }`
- [ ] Add `data-testid` attributes: `add-location-btn`, `location-name-input`, `location-address-input`, `location-submit-btn`, `location-row-{id}`
- [ ] **Persistence check:** hard-refresh retailer dashboard after submit — new location must appear in list

---

### S11-5 · Retailer Approval Workflow — Loop Preview (83% confidence)

`Loops.jsx` confirmed registered in `App.jsx` at `/dashboard/retailer/loops` ✅. Route registration is not a blocker.

- [ ] `grep -n "router.get\|locations.*loops\|retailer.*loops" ad-server/src/api/loops.js` — confirm `GET /api/locations/:id/loops` exists on the backend; create if absent
- [ ] `grep -n "schedule/calendar\|/history\|Go Back\|goBack" client-app/src/pages/retailer/RetailerDashboard.jsx` — find broken quick-action hrefs (TASK-19) and correct them to registered routes
- [ ] Fix "Go Back" crash in `ScheduleHistory.jsx` — use `navigate(-1)` or an explicit route path
- [ ] Read `Loops.jsx` — confirm or add `data-testid` attributes: `loops-list`, `loop-row-{id}`, `loop-status-badge-{id}`, `schedule-calendar-container`
- [ ] Verify loop status badge only renders lowercase `draft` | `approved` | `locked`: `grep -rn "'APPROVED'\|'DRAFT'\|'LOCKED'" client-app/src/pages/retailer/` — must return zero results
- [ ] Resolve duplicate `CampaignApprovalList` ambiguity before merge: `grep -r "CampaignApprovalList" client-app/src --include="*.jsx" -n` (flagged in App.jsx ⚠️)

---

## Medium Priority Gaps

---

### S11-7 · Network Map — Fix Blank Render (88% confidence)

Map renders blank — likely a missing `VITE_GOOGLE_MAPS_API_KEY` env var or a zero-height container.

- [ ] `cat client-app/src/pages/admin/NetworkMap.jsx` — read full file to identify root cause (key check vs. container height vs. missing `useEffect`)
- [ ] `grep -n "GOOGLE_MAPS\|VITE_GOOGLE" .env.example client-app/.env.example 2>/dev/null` — confirm key is documented
- [ ] `grep -n "height\|min-height\|style=" client-app/src/pages/admin/NetworkMap.jsx` — confirm map container has a non-zero height (CSS `height: 0` is a common blank-map cause)
- [ ] **Case A — API key present:** verify Google Maps tiles render; at least one pin visible when `GET /api/screens` returns data; pin click opens tooltip with screen name and status
- [ ] **Case B — API key absent:** add `data-testid="map-unavailable-msg"` fallback — text must read `"Map unavailable — API key not configured"`; container must have `min-height: 400px`; no uncaught Google Maps JS exception in console
- [ ] Add `VITE_GOOGLE_MAPS_API_KEY=your_key_here  # Required for Network Map` to `docs/ENVIRONMENT_SETUP.md`

---

### S11-8 · Tech Ops Dashboard — Network-Wide Screen Data (85% confidence)

Dashboard shows filtered/incomplete data instead of the full network view.

- [ ] `ls client-app/src/pages/tech/` — confirm exact Tech Ops dashboard filename before starting
- [ ] `grep -n "requireRole\|router.get\|techops\|retaileradmin" ad-server/src/api/screens.js` — confirm role-conditional branch exists or add it
- [ ] `grep -n "findAll\|getAll\|where.*retailer" ad-server/src/repositories/ScreenRepository.js` — confirm unfiltered `findAll()` exists; add if missing
- [ ] Implement role-conditional query branch:
  - `techops` → `GET /api/screens` returns **all screens, all retailers** — 200
  - `retaileradmin` → filtered by `retailer_id` from session — 200 (existing behaviour preserved)
  - `brand` → 403 (safe — brand pages do not call `/api/screens`)
- [ ] Dashboard KPIs must show: total screens, online count, offline count, screens with active campaigns
- [ ] Screen list must be sortable by status and last heartbeat
- [ ] Add `data-testid` attributes: `total-screens-kpi`, `online-screens-kpi`, `offline-screens-kpi`, `active-campaigns-kpi`, `screen-table`, `screen-row-{id}`, `sort-by-status`, `sort-by-heartbeat`
- [ ] **GUARDRAIL-G3:** `requireRole('techops')` confirmed on unfiltered variant

---

## Pre-Sprint Checklist (resolve before planning meeting)

- [ ] Run `ls ad-server/src/api/` — confirm which of `users.js`, `retailers.js`, `advertisers.js`, `stores.js` exist *(all four confirmed present at audit time)*
- [ ] Run `grep -n "requireRole" ad-server/src/api/campaigns.js` — confirm or add V1/V2 guards
- [ ] Read `client-app/src/pages/Player.jsx` — confirm or add `TelemetryService.trackImpression()` call site
- [ ] Run `grep -n "Loops\|ScheduleCalendar" client-app/src/App.jsx` — confirm route registration *(both confirmed registered at audit time)*
- [ ] Add `NODE_ENV !== 'test'` guard to `impressionLimiter` before S11-6 E2E tests run
- [ ] Confirm `BaseRepository.findById()` exists — needed by telemetry `play_count` increment
- [ ] Confirm `ENUM-AUDIT-3`: `grep -r "'APPROVED'\|'PENDING'" --include="*.js" --include="*.jsx"` returns zero results
- [ ] Resolve `CampaignApprovalList` duplicate: `grep -r "CampaignApprovalList" client-app/src --include="*.jsx" -n`

---

*Task list generated 2026-06-06 from `sprint11-sre-qa-analysis.md` cross-referenced with `sprint11.md`.*
*Updated 2026-06-06 — added S11-7 (Network Map), S11-8 (Tech Ops), confidence score summary table, and recommended merge order.*
*Updated 2026-06-06 — SRE blast-radius audit added: isolation verdict, blast-radius table, cross-cutting risk detail (telemetry rate limiter × Demo Player; GET /api/screens role expansion). Source of truth: App.jsx @ ec3ea058, ad-server/src/api/ @ 24b991c9.*
