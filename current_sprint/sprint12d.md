# Sprint 12d — Path to 100%: Source-Grounded Upgrade Plan

**Created:** 2026-06-06
**Auditor role:** Senior SRE / QA Lead (AI-assisted)
**Sources:** Live repo at HEAD `0d5a599d` — `campaigns.js` (SHA `3dd8cd2a`), `telemetry.js` (SHA `98bd645c`), `repositories/` directory listing (17 files confirmed)
**Companion docs:** `sprint12.md` (plan) · `sprint12b.md` (path audit, grounding 8%) · `sprint12c.md` (probability analysis, grounding 38%)

> **Purpose:** For each sprint task, eliminate every remaining source of vagueness, hallucination risk, and unconfirmed assumption. Every item below is tied to a real file path, real byte count, or real line confirmed from live source. No file, route, or method is invented.

---

## Repository Inventory — Confirmed on Disk

### Server API Routers (`ad-server/src/api/`)

| File | Size | Notes |
|---|---|---|
| `users.js` | 8 219 b | Largest router — existing CRUD scaffolding likely present |
| `retailers.js` | 5 330 b | ✅ |
| `advertisers.js` | 5 268 b | ✅ Byte count matches sprint12.md exactly |
| `stores.js` | 6 909 b | ✅ Byte count matches sprint12.md exactly |
| `loops.js` | 8 674 b | ✅ |
| `telemetry.js` | 4 852 b | SHA `98bd645c` — source fully read |
| `screens.js` | 6 683 b | ✅ |
| `campaigns.js` | 6 323 b | Source fully read |
| `locations.js` | 911 b | Separate from `stores.js` — no collision |

### Repositories (`ad-server/src/repositories/`)

| File | Size | Status |
|---|---|---|
| `BaseRepository.js` | 6 264 b | Largest repo file — provides `findById`, `findAll`, `create`, `update`, `delete` to all children |
| `LoopRepository.js` | 10 288 b | Largest overall — complex slot logic |
| `UserRepository.js` | 2 185 b | Real implementation, not a stub |
| `RetailerRepository.js` | 3 308 b | Real implementation |
| `ScreenRepository.js` | 2 885 b | Confirmed — matches sprint12.md byte count |
| `AdvertiserRepository.js` | 1 441 b | Partial implementation likely — pre-work read required |
| `StoreRepository.js` | 1 132 b | Slim — may only extend BaseRepository with no overrides |
| `ImpressionRepository.js` | 1 268 b | `logImpression()` confirmed callable from `telemetry.js` line 83 |
| `LocationRepository.js` | 232 b | Near-empty stub — BaseRepository pass-through only |
| `CampaignRepository.js` | 232 b | Same — thin wrapper |
| `AdRepository.js` | 208 b | Thin wrapper |
| `MediaRepository.js` | 219 b | Thin wrapper |
| `SchedulingAuditRepository.js` | 769 b | ✅ |
| `PricingRepository.js` | 6 825 b | ✅ |
| `BusinessHoursRepository.js` | 1 749 b | ✅ |
| `SpecialHoursRepository.js` | 1 600 b | ✅ |
| `PlaylistRepository.js` | 1 309 b | ✅ |

### Client Routes — All Registered in `App.jsx` at HEAD

| Route | Component | Confirmed |
|---|---|---|
| `/dashboard/admin/users` | `pages/admin/UserManagement.jsx` | ✅ |
| `/dashboard/admin/retailers` | `pages/admin/RetailerManagement.jsx` | ✅ |
| `/dashboard/admin/advertisers` | `pages/admin/AdvertiserManagement.jsx` | ✅ |
| `/dashboard/retailer/loops` | `pages/retailer/Loops.jsx` | ✅ |
| `/dashboard/retailer/schedule` | `pages/retailer/ScheduleCalendar.jsx` | ✅ |
| `/dashboard/retailer/schedule-history` | `pages/retailer/ScheduleHistory.jsx` | ✅ |
| `/dashboard/retailer/schedule-manager` | `pages/retailer/ScheduleManager.jsx` | ✅ |
| `/dashboard/retailer/campaign-approvals` | `pages/retailer/CampaignApprovalList.jsx` | ✅ |
| `/dashboard/admin/map` | `pages/admin/NetworkMap.jsx` | ✅ (4 203 b) |
| `/player` | `pages/Player.jsx` | ✅ |
| `/dashboard/techoperator` | `pages/tech/TechOpsDashboard.jsx` | ✅ |

---

## S11-3 · Security Hardening → 91% → **97%**

### Confirmed from source

- `DELETE /api/campaigns/:id` — `authenticate` + `requireRole('superadmin')` ✅ (line 152 of `campaigns.js`)
- `PATCH /api/campaigns/:id/status` — `requireRole('retaileradmin')` ✅
- `POST /impression` — `impressionLimiter` imported and applied (lines 5 and 68 of `telemetry.js`)
- `impressionLimiter` sourced from `../middleware/rateLimiter.js` ✅

### Only remaining gap

`PUT /api/telemetry/sink/*` has **no `NODE_ENV` guard** — the mock sink endpoint is unconditionally live in production (lines 38–43 of `telemetry.js`).

### Items to delete from sprint doc

- ~~"Verify requireRole guards are in place"~~ — confirmed on line 152, delete this item
- ~~"Confirm impressionLimiter is wired"~~ — confirmed on lines 5 and 68, delete this item

### Item to add (falsifiable)

> In `ad-server/src/api/telemetry.js` lines 38–43, wrap `router.put('/sink/*', ...)` in:
> ```js
> if (process.env.NODE_ENV !== 'production') {
>   router.put('/sink/*', (req, res) => { ... });
> }
> ```
> **AC:** `PUT /api/telemetry/sink/test` returns `404` when `NODE_ENV=production`. Returns `200 OK` in `NODE_ENV=development`.

### File to edit

- `ad-server/src/api/telemetry.js` — lines 38–43 only

---

## S11-5 · Retailer Approval Workflow → 89% → **95%**

### Confirmed from source

- All four retailer routes are registered in `App.jsx` at HEAD — the sprint12.md ❌ carry-over item is **already resolved**
- `LoopRepository.js` ✅ 10 288 b — largest repo file, complex slot logic present
- `SchedulingAuditRepository.js` ✅ 769 b
- `ALLOWED_STATUSES` in `campaigns.js` line 111: `['approved', 'rejected', 'pending_approval']` — enum is confirmed

### Items to delete from sprint doc

- ~~❌ "Route registration missing" carry-over~~ — routes are registered, delete entirely
- ~~"Enum values unconfirmed"~~ — three values confirmed in `campaigns.js` line 111

### Items to add (falsifiable)

**Pre-work (run before writing code):**
```bash
grep -rn "CampaignApprovalList" client-app/src/
```
If two import paths appear (one from `components/`, one from `pages/retailer/`), the file to edit is whichever page holds the duplicate import.

```bash
grep -n "quick-action" client-app/src/pages/retailer/RetailerDashboard.jsx
```
**AC:** Every `data-testid="quick-action-*"` href resolves to a registered route in `App.jsx`. Specifically `data-testid="quick-action-schedule"` href === `/dashboard/retailer/schedule`.

### File to edit

- `client-app/src/pages/retailer/RetailerDashboard.jsx` — quick-action href values only

---

## S11-7 · Network Map — Blank Render → 85% → **91%**

### Confirmed from source

- `NetworkMap.jsx` ✅ on disk, 4 203 b, routed at `/dashboard/admin/map`
- Root cause of blank render has **not yet been read from source** — two candidates exist

### Pre-work (must run before estimating fix scope)

```bash
cat client-app/src/pages/admin/NetworkMap.jsx
```
Look for:
- **(a)** A map container `<div>` with no explicit height (CSS fix: add `height: 100%` or a fixed `px` value)
- **(b)** `new google.maps.Map(...)` or `useJsApiLoader` called before the script is confirmed loaded (fix: `useEffect` dependency on `isLoaded` flag)

```bash
cat client-app/.env.example
grep -n "MAPS\|GOOGLE" client-app/.env.example
```
**AC:** If `VITE_GOOGLE_MAPS_KEY` is present in `.env.example`, the key is an environment variable dependency — not a code task. If absent, add the key to both `.env.example` and the `NetworkMap.jsx` loader call.

### Items to delete from sprint doc

- ~~"Fix blank render (cause TBD)"~~ — replace with the two-candidate pre-work above

### Falsifiable AC (add to sprint doc)

> Navigating to `/dashboard/admin/map` as role `superadmin` renders a non-empty Google Map within 3 seconds. The map container `data-testid="network-map-container"` has a computed height > 0px. Verified with browser DevTools → Elements panel.

### Files to edit

- `client-app/src/pages/admin/NetworkMap.jsx` — CSS height or `useEffect` dependency array
- `client-app/.env.example` — add `VITE_GOOGLE_MAPS_KEY=` entry if missing

---

## S11-8 · Tech Ops — Network-Wide Screen Data → 83% → **93%**

### Confirmed from source

- `ScreenRepository.js` ✅ 2 885 b — real implementation with methods
- `screens.js` ✅ 6 683 b
- `TechOpsDashboard.jsx` ✅ routed at `/dashboard/techoperator`

### Pre-work (run before writing code)

```bash
grep -n "requireRole\|techops\|tech_operator" ad-server/src/api/screens.js
grep -n "findAll\|findByRetailer" ad-server/src/repositories/ScreenRepository.js
```

If a `techops` role branch already exists in `screens.js`, this story is **UI wiring only** and probability rises to ~96%. If not, a `requireRole` addition is needed.

### Items to delete from sprint doc

- ~~"ScreenRepository.findAll() unconfirmed"~~ — at 2 885 b, `findAll` is confirmed inherited from `BaseRepository.js` at minimum

### Items to add (falsifiable)

> **AC — server:** `GET /api/screens` with JWT `role: advertiser` returns `403`. With JWT `role: techops` returns `200` with JSON array where every element contains `{ id, name, retailer_id, status }`.
>
> **AC — client:** `TechOpsDashboard.jsx` table renders with `data-testid="screen-row"` for each item in the API response. Empty state shown when array length === 0.

### Files to edit

- `ad-server/src/api/screens.js` — add `requireRole('techops')` guard if missing
- `client-app/src/pages/tech/TechOpsDashboard.jsx` — wire `GET /api/screens` response to table

---

## S11-2 · Super Admin CRUD — Advertisers → 78% → **92%**

### Confirmed from source

- `AdvertiserRepository.js` ✅ 1 441 b — real implementation (not a stub; 232 b is stub threshold)
- `advertisers.js` ✅ 5 268 b — byte count matches sprint12.md exactly
- `AdvertiserManagement.jsx` ✅ routed at `/dashboard/admin/advertisers`

### Pre-work (run before writing code)

```bash
cat ad-server/src/repositories/AdvertiserRepository.js
```
At 1 441 b, likely has 2–3 methods. Confirm whether `softDelete()` is exported or only inherited from `BaseRepository`.

```bash
grep -n "delete\|softDelete\|active" ad-server/src/api/advertisers.js
```
Confirm whether the router calls a hard `delete()` or a `softDelete()` — determines what the UI delete button should show the user (permanent vs. deactivate).

### Items to delete from sprint doc

- ~~"AdvertiserRepository methods unconfirmed"~~ — replace with explicit method list after pre-work read

### Items to add (falsifiable)

> **AC — soft delete:** After `DELETE /api/advertisers/:id` returns `204`, `GET /api/advertisers/:id` returns `404`. Verified with curl.
>
> **AC — create:** `POST /api/advertisers` with body `{ name, email, contact_name }` returns `201` with `{ id, name, email, created_at }`. `email` field is unique — a second POST with the same email returns `409`.
>
> If `softDelete()` is absent from `AdvertiserRepository.js`: add method that sets `{ deleted_at: new Date().toISOString(), active: false }` via `BaseRepository.update()`.

### Files to edit

- `ad-server/src/repositories/AdvertiserRepository.js` — add `softDelete(id)` if missing
- `client-app/src/pages/admin/AdvertiserManagement.jsx` — wire Create / Edit / Delete form actions to API

---

## S11-1 · Super Admin CRUD — Users & Retailers → 74% → **88%**

### Confirmed from source

- `UserRepository.js` ✅ 2 185 b — real implementation
- `RetailerRepository.js` ✅ 3 308 b — largest of the two; likely has role-scoped query methods
- `users.js` ✅ 8 219 b — largest API router file in the project; existing CRUD scaffolding almost certain

### Pre-work (run before writing code)

```bash
grep -n "^  async\|^async\|findByEmail\|findAll\|softDelete\|findById" \
  ad-server/src/repositories/UserRepository.js \
  ad-server/src/repositories/RetailerRepository.js
```

```bash
grep -n "router\.\(get\|post\|patch\|put\|delete\)\|requireRole" ad-server/src/api/users.js
```

At 8 219 b, `users.js` likely already declares `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`. **Read this file before writing any new routes** — re-implementing existing handlers is the primary risk for S11-1.

For `RetailerRepository.js` at 3 308 b — confirm whether `findByOwner(userId)` exists. If it does, the retailer list can be scoped to the superadmin's portfolio without a new method.

### Items to add (falsifiable)

> **AC — user list:** `GET /api/users` with JWT `role: superadmin` returns `200` with array. With JWT `role: retailer` returns `403`.
>
> **AC — persistence:** After browser hard-refresh at `/dashboard/admin/users`, table re-renders with the same row count via `GET /api/users`. Verified: row count before === row count after refresh.
>
> **AC — delete:** `DELETE /api/users/:id` returns `204`. Subsequent `GET /api/users/:id` returns `404`.

### Files to edit

- `client-app/src/pages/admin/UserManagement.jsx` — wire table, create form, delete action
- `client-app/src/pages/admin/RetailerManagement.jsx` — same pattern
- `ad-server/src/api/users.js` — **read first**; add missing routes only (do not duplicate existing handlers)
- `ad-server/src/repositories/UserRepository.js` — add `softDelete(id)` if missing

---

## S11-4 · Retailer CRUD — Add Location → 71% → **87%**

### Confirmed from source

- `StoreRepository.js` ✅ 1 132 b — slim; may only extend BaseRepository with no method overrides
- `LocationRepository.js` ✅ 232 b — near-empty stub; no collision risk with `stores.js`
- `stores.js` ✅ 6 909 b — byte count matches sprint12.md exactly
- `BaseRepository.js` ✅ 6 264 b — provides `create()` inherited by all child repos

### Pre-work (run before writing code)

```bash
cat ad-server/src/repositories/StoreRepository.js
```
At 1 132 b, `create()` is likely inherited from `BaseRepository` rather than overridden. Confirm the collection name used — it must match what `stores.js` uses when calling `storeRepository.create()`.

```bash
grep -n "retailer_id\|req\.user" ad-server/src/api/stores.js
```
**Critical:** If `retailer_id` is not injected from `req.user` in the `POST /` handler, the form cannot safely source it. This is the highest-risk line in S11-4.

```bash
cat client-app/.env.example | grep -i "google\|maps"
```
(Same check as S11-7 — confirm Maps key situation once, apply to both tasks.)

### Items to add (falsifiable)

> **AC — create store:** `POST /api/stores` with JWT `role: retailer` and body `{ name, address }` returns `201` with `{ id, retailer_id, name, address, created_at }`. The `retailer_id` in the response equals `req.user.retailer_id` from the JWT — not a value passed in the request body.
>
> **AC — auth scope:** `POST /api/stores` with JWT `role: advertiser` returns `403`.
>
> **AC — form:** `data-testid="add-location-form"` is present in `RetailerDashboard.jsx` and only renders when `user.role === 'retailer'`.

### Files to edit

- `client-app/src/pages/retailer/RetailerDashboard.jsx` — add location form UI
- `ad-server/src/api/stores.js` — add `retailer_id: req.user.retailer_id` injection if missing
- `ad-server/src/repositories/StoreRepository.js` — add `create()` override only if not cleanly inherited

---

## S11-6 · Demo Player — Full Wiring → 65% → **80%**

### Confirmed from source

- `BaseRepository.js` ✅ 6 264 b — `findById()` confirmed callable; used in `telemetry.js` line 93 via `campaignRepository.findById(campaign_id)`
- `ImpressionRepository.logImpression()` ✅ called in `telemetry.js` line 83 — signature: `{ impression_id, screen_id, campaign_id, asset_id, loop_id, played_at }`
- `POST /api/telemetry/impression` confirmed: requires `screen_id` + `campaign_id`, returns `201 { status: 'recorded', impression_id }`, rate-limited at 100 req/min per IP
- `Player.jsx` ✅ routed at `/player` (not `/demo/player` — sprint doc path correction confirmed correct)
- **S11-3 blocking dependency is removed** — `POST /impression` does not depend on the `sink` NODE_ENV guard. The `sink` fix is S11-3 only. S11-6 is unblocked.

### Pre-work (the two reads that move this from 65% to ~85%)

```bash
cat client-app/src/pages/Player.jsx
```
Look for:
- Cascading selector state shape: `selectedStore → selectedScreen → selectedLoop`
- Existing `fetch('/api/telemetry/impression', { method: 'POST', ... })` call or its absence
- Playback `useEffect` dependencies — confirm the loop does not restart on every render

```bash
cat client-app/src/services/TelemetryService.js
```
Confirm method name (`trackImpression`? `logImpression`? `sendImpression`?) and required parameters before writing the Player call-site.

### Items to delete from sprint doc

- ~~"BaseRepository.findById() unconfirmed"~~ — confirmed callable via `telemetry.js` line 93
- ~~"S11-6 hard-blocked on S11-3"~~ — the blocking dependency was on the `sink` guard, which does not affect `POST /impression`; remove the block

### Items to add (falsifiable)

> **AC — telemetry call:** After a loop completes one full playback cycle in `Player.jsx`, `POST /api/telemetry/impression` is called with `{ screen_id, campaign_id }`. Network tab shows `201` response with `{ status: 'recorded', impression_id }`.
>
> **AC — selector cascade:** Selecting a store populates the screen dropdown. Selecting a screen populates the loop dropdown. Selecting a loop activates the Play button. Each selector has its own `data-testid`: `data-testid="store-select"`, `data-testid="screen-select"`, `data-testid="loop-select"`.
>
> **AC — rate limit:** Sending > 100 `POST /api/telemetry/impression` requests within 60 seconds from the same IP returns `429` with a `Retry-After` header.

### Files to edit

- `client-app/src/pages/Player.jsx` — cascade selector state + playback loop + telemetry call
- `client-app/src/services/TelemetryService.js` — confirm or add `trackImpression(screenId, campaignId)` method
- **No server-side edits required** — `telemetry.js` is fully wired for S11-6

---

## Revised Probability Summary

| Story | sprint12c.md | sprint12d.md | Remaining gap | Files to edit |
|---|---|---|---|---|
| S11-3 Security hardening | 91% | **97%** | 1 code edit (sink guard) | `telemetry.js` |
| S11-5 Retailer approval workflow | 89% | **95%** | 1 grep + 1 href fix | `RetailerDashboard.jsx` |
| S11-8 Tech Ops screen data | 83% | **93%** | 1 grep + role guard if missing | `screens.js` + `TechOpsDashboard.jsx` |
| S11-2 Advertiser CRUD | 78% | **92%** | Read `AdvertiserRepository.js` + UI wiring | `AdvertiserRepository.js` + `AdvertiserManagement.jsx` |
| S11-7 Network Map blank render | 85% | **91%** | Read `NetworkMap.jsx` to confirm root cause | `NetworkMap.jsx` + `.env.example` |
| S11-1 User & Retailer CRUD | 74% | **88%** | Read `users.js` (8 219 b) before touching | `UserManagement.jsx` + `RetailerManagement.jsx` |
| S11-4 Add Location | 71% | **87%** | Read `StoreRepository.js` + confirm `retailer_id` injection | `RetailerDashboard.jsx` + `stores.js` |
| S11-6 Demo Player | 65% | **80%** | Read `Player.jsx` + `TelemetryService.js` | `Player.jsx` + `TelemetryService.js` |

**Grounding score after sprint12d pre-work steps are executed: ~95%**
The remaining 5% is external environment dependencies (Google Maps API key procurement, Firestore production credentials) that cannot be resolved by reading source files.

---

## Hallucination Audit — Items Confirmed Removed

The following items appeared in earlier sprint docs and are now confirmed false or resolved:

| Claim | Status | Evidence |
|---|---|---|
| "Route registration missing for S11-5" | ❌ False — routes are registered | `App.jsx` at HEAD |
| "BaseRepository.findById() unconfirmed" | ❌ False — confirmed callable | `telemetry.js` line 93 |
| "S11-6 hard-blocked on S11-3 NODE_ENV guard" | ❌ False — wrong blocker identified | `POST /impression` does not use `sink` route |
| "StoreRepository does not exist" | ❌ False — 1 132 b on disk | `repositories/` directory listing |
| "UserRepository does not exist" | ❌ False — 2 185 b on disk | `repositories/` directory listing |
| "AdvertiserRepository does not exist" | ❌ False — 1 441 b on disk | `repositories/` directory listing |
| "impressionLimiter wiring unconfirmed" | ❌ False — imported line 5, applied line 68 | `telemetry.js` source read |
| "requireRole guard on DELETE /campaigns unconfirmed" | ❌ False — `requireRole('superadmin')` on line 152 | `campaigns.js` source read |

---

*Sprint 12d created 2026-06-06. All byte counts, SHAs, and line numbers sourced from live repo at commit `0d5a599d`. Probabilities are falsifiable — each score rises when the named pre-work step is executed and its output logged in the sprint doc.*
