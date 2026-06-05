# Sprint 9 — softomedia-live2026

> **Grounding snapshot** — all paths, SHAs, and route mounts verified against commit `4cde1a8` (2026-06-05).
> **App.jsx SHA:** `cabbf4b` · **index.js SHA:** `4bbfcc6`
> No filename in this document is unverified. Where a file does not yet exist, a `PRE-WORK` step is explicitly called out.

---

## 🔒 FOUR SRE / QA GUARDRAILS — MANDATORY FOR ALL SPRINTS

> Copy this block unchanged into every future `sprintN.md` before the task list.

### Guardrail 1 — No Filename Without a Confirmed Disk Path
Before any task names a file, confirm it exists at the exact path stated.  
Client: `client-app/src/{pages,components,services}/`  
Server routes: `ad-server/src/api/` **only** — `ad-server/routes/` is legacy/ghost, never reference it.  
If not found: mark `NOT ON DISK`, add a `grep` pre-work step. Never guess.  
Components claimed as "new" must be confirmed absent before creation.

### Guardrail 2 — App.jsx Is the Single Source of Truth for Client Routes
Every new page file must be: (a) on disk, (b) added as a `lazy()` import in `App.jsx`, (c) registered as a `<Route>`, (d) added to the verified-file comment block at the top of `App.jsx`.  
A route not in `App.jsx` does not exist for routing purposes.

### Guardrail 3 — Every Acceptance Criterion Must Be Falsifiable
Banned phrases: "works correctly", "displays properly", "functions as expected", "is handled".  
Every AC must contain at least one of: HTTP status code · response body field · `data-testid` · navigation path · role rejection assertion.

### Guardrail 4 — Blast Radius Must Be Stated for Every Auth / Middleware Change
Any task touching a role guard, `authenticate` call, or middleware order must include:
- Endpoint and mount prefix
- Whether `authenticate` runs before the handler
- Roles that PASS / FAIL
- Adjacent routes affected

---

## Risk Register

| ID | Description | Area | Status | Evidence |
|----|-------------|------|--------|----------|
| R1 | `/api/campaigns` is public-mounted — `requireRole` is the **sole** auth barrier. An unauthenticated request with a spoofed `x-demo-role` header (Phase 1 demo auth) can reach `PATCH /:id/status`. | `ad-server/src/api/index.js` line 39, `ad-server/src/middleware/auth.js` | **OPEN** | `index.js` SHA `4bbfcc6`: `router.use('/campaigns', campaignsRouter)` — no `authenticate` before it. `requireRole` reads `req.user?.role` which is set by `auth.js` demo layer from `x-demo-role` header. |
| R2 | `pages/tickets/TicketDashboard.jsx` and `pages/tickets/TicketDetail.jsx` are marked `❌ NOT ON DISK` in `App.jsx`. Any sprint task referencing them will cause a lazy-import runtime crash. | `client-app/src/App.jsx` comment block SHA `cabbf4b` | **OPEN** | Components exist in `components/` but no page wrappers exist. Pre-work required before routing. |
| R3 | `pages/retailer/Loops.jsx` is marked `❌ NOT ON DISK` in `App.jsx`. No route for `/dashboard/retailer/loops` exists. | `client-app/src/App.jsx` | **OPEN** | Confirmed absent from `client-app/src/pages/retailer/` directory listing SHA `c09a296`. |
| R4 | `RetailerDashboard.jsx` quick-action links navigate to `/dashboard/retailer/schedule/calendar` and `/dashboard/retailer/history` — neither path is registered in `App.jsx` (registered paths are `/dashboard/retailer/schedule` and `/dashboard/retailer/schedule-history`). Silent 404 via the `<NotFound />` catch-all. | `client-app/src/pages/retailer/RetailerDashboard.jsx` lines 42–43, `App.jsx` route table | **OPEN** | SHA `068ae65f`. Dead links confirmed against `App.jsx` SHA `cabbf4b`. |
| R5 | `notifications.js` router (`ad-server/src/api/notifications.js` SHA `786ee5c`) is 135 bytes — effectively a stub. It is `authenticate`-protected but returns no data. Any Sprint 9 feature that assumes a notification feed exists will fail silently. | `ad-server/src/api/notifications.js` | **OPEN** | File size 135 bytes confirms stub. |
| R6 | `TelemetryService.js` on the client (`client-app/src/services/TelemetryService.js` SHA `4e0520b`) exists but is not imported by `Player.jsx` or any page yet confirmed. Impression events fired from the player may be silently dropped if the call site hasn't been wired. | `client-app/src/services/TelemetryService.js` | **OPEN** | Pre-work grep required to confirm call sites: `grep -r "TelemetryService" client-app/src/`. |
| R7 | Sprint 8 AC for S8-5 (`CampaignApprovalList` UI) contained no `data-testid` assertions. The component was shipped but is not regression-testable without them. | `client-app/src/components/CampaignApprovalList.jsx` SHA `6b5f2a0` | **OPEN** | No `data-testid` attributes confirmed present in component — see Task 9.1 below. |

---

## Security Register

| ID | Vector | File(s) | Mitigation Steps | Environments |
|----|--------|---------|-----------------|--------------|
| V1 | **Unauthenticated role spoofing on `/api/campaigns`** — Phase 1 demo auth reads `x-demo-role` header directly. Because `/campaigns` is public-mounted with no `authenticate` pre-middleware, any client can set `x-demo-role: retaileradmin` and reach `PATCH /:id/status`. | `ad-server/src/api/index.js` (line 39), `ad-server/src/middleware/auth.js` SHA `77c6bfb`, `ad-server/src/middleware/requireRole.js` SHA `658bcb7` | **Sprint 9 Task 9.2:** Move `authenticate` middleware before `campaignsRouter` mount in `index.js`. Backward-compat: `GET /api/campaigns` is currently consumed by `RetailerDashboard` without auth token — evaluate whether to keep GET public or add token. See Task 9.2 for split-router strategy. | Local dev, staging. Production: Cloud Run with Firebase Auth replaces demo layer, but defence-in-depth is still required. |
| V2 | **`POST /api/telemetry/impression` is fully public** — no rate limit, no auth. A malicious actor can flood the logger/future Firestore collection with arbitrary impression data, inflating campaign `play_count`. | `ad-server/src/api/telemetry.js` SHA `8e481d6`, `ad-server/src/middleware/rateLimiter.js` SHA `9f31b11` | **Sprint 9 Task 9.3:** Add rate limiter to `POST /impression`. `rateLimiter.js` exists but is a stub (107 bytes) — implement `express-rate-limit` at 60 req/min per IP. | All environments. |
| V3 | **`DELETE /api/campaigns/:id` is unguarded** — no role check. Any public caller can delete a campaign document. | `ad-server/src/api/campaigns.js` line ~95, `ad-server/src/api/index.js` | **Sprint 9 Task 9.2 scope extension:** Add `requireRole('admin')` to `DELETE /:id` in `campaigns.js`. | All environments. |

---

## Task Map

| Task ID | Files Touched | Change Type | Est. Effort | Outcome Probability | Biggest Risk |
|---------|--------------|-------------|-------------|---------------------|--------------|
| **9.1** | `client-app/src/components/CampaignApprovalList.jsx` | Additive (data-testids + date/budget display hardening) | 1h | 95% | Wrong `data-testid` string differs from test file → tests pass locally, fail in CI |
| **9.2** | `ad-server/src/api/index.js`, `ad-server/src/api/campaigns.js` | Refactor (auth split + DELETE guard) | 1.5h | 85% | Moving `GET /campaigns` behind `authenticate` breaks `RetailerDashboard` load — must verify token is sent by `ApiService.getLoops()`-equivalent call |
| **9.3** | `ad-server/src/middleware/rateLimiter.js`, `ad-server/src/api/telemetry.js` | Additive (rate limit implementation) | 1h | 90% | `rateLimiter.js` is a stub — if it currently exports nothing, importing it in `telemetry.js` before implementation causes a silent no-op |
| **9.4** | `client-app/src/pages/retailer/RetailerDashboard.jsx` | Fix (dead quick-action link paths) | 30m | 99% | None — pure string correction, no new imports |
| **9.5** | `client-app/src/pages/retailer/RetailerDashboard.jsx` (pre-work page scaffold: NEW FILE `client-app/src/pages/retailer/Loops.jsx`), `client-app/src/App.jsx` | Additive (new page + route registration) | 2h | 75% | Forgetting to add lazy import AND route AND App.jsx comment block → runtime crash on navigation |
| **9.6** | `client-app/src/services/TelemetryService.js`, `client-app/src/pages/Player.jsx` (pending grep confirmation) | Additive (wire impression call in Player) | 1h | 80% | `Player.jsx` may already have a custom impression mechanism — grep required before editing |

---

## Full Task Details

---

### Task 9.1 — Add `data-testid` attributes to `CampaignApprovalList`

**Confirmed files:**
- `client-app/src/components/CampaignApprovalList.jsx` — SHA `6b5f2a0`

**Pre-checks:**
```bash
# Confirm no data-testid already present
grep -n "data-testid" client-app/src/components/CampaignApprovalList.jsx

# Confirm StatusBadge is imported (it is — SHA 2b7bfa3)
grep "StatusBadge" client-app/src/components/CampaignApprovalList.jsx
```

**Exact insertion points:**
1. The outer container `<div>` wrapping the approval list → add `data-testid="campaign-approval-list"`
2. Each campaign row `<div>` or `<li>` element → add `data-testid="campaign-row-{campaign.id}"` (interpolated)
3. The Approve button → `data-testid="approve-btn-{campaign.id}"`
4. The Reject button → `data-testid="reject-btn-{campaign.id}"`
5. The `<StatusBadge>` element inside each row → `data-testid="campaign-status-{campaign.id}"`
6. The campaign count badge (queue depth) → `data-testid="approval-queue-count"`

**Verification:**
- `document.querySelector('[data-testid="campaign-approval-list"]')` returns non-null in browser DevTools.
- `document.querySelectorAll('[data-testid^="campaign-row-"]').length` equals number of `pending_approval` campaigns returned by `GET /api/campaigns?status=pending_approval` (HTTP 200).
- Clicking `[data-testid="approve-btn-{id}"]` triggers `PATCH /api/campaigns/{id}/status` with body `{ status: "approved" }` → response HTTP 200 with `{ status: "approved" }` field.
- After approve, `[data-testid="campaign-status-{id}"]` text content changes to `"approved"` without full page reload (optimistic UI).

**Outcome probability:** 95%  
**Biggest risk:** Interpolated `data-testid` values require the component to have a stable `id` field on each campaign object — if the API returns `undefined` for `id`, all testids collapse to `campaign-row-undefined`.

---

### Task 9.2 — Harden `/api/campaigns` auth: split public GET from protected mutations + guard DELETE

**Confirmed files:**
- `ad-server/src/api/index.js` — SHA `4bbfcc6`
- `ad-server/src/api/campaigns.js` — SHA `33c74d6`
- `ad-server/src/middleware/auth.js` — SHA `77c6bfb`
- `ad-server/src/middleware/requireRole.js` — SHA `658bcb7`

**Blast Radius:**
| Endpoint | Current Auth | After Task 9.2 | Roles affected |
|---|---|---|---|
| `GET /api/campaigns` | Public (no token needed) | **Remains public** (split router strategy) | None |
| `GET /api/campaigns/:id` | Public | **Remains public** | None |
| `POST /api/campaigns` | Public | `authenticate` required | brand clients must send token |
| `POST /api/campaigns/:id/book` | Public | `authenticate` required | brand clients must send token |
| `PATCH /api/campaigns/:id/status` | `requireRole('retaileradmin')` only | `authenticate` + `requireRole('retaileradmin')` | No change for authenticated retaileradmins |
| `PUT /api/campaigns/:id` | Public | `authenticate` required | brand clients must send token |
| `DELETE /api/campaigns/:id` | **Unguarded — no role check** | `authenticate` + `requireRole('admin')` | Only admin+ can delete |

**Pre-checks:**
```bash
# Confirm GET /campaigns is called without auth token in client
grep -n "getCampaigns\|getLoops\|campaigns" client-app/src/services/ApiService.js

# Confirm authenticate middleware signature
grep -n "authenticate\|req.user" ad-server/src/middleware/auth.js

# Confirm no other file imports campaignsRouter directly (should only be index.js)
grep -rn "campaigns" ad-server/src/api/index.js
```

**Implementation — split router strategy in `campaigns.js`:**

In `ad-server/src/api/campaigns.js`, create a second mini-router for protected mutations:

```js
// At top of campaigns.js, after existing imports:
import { authenticate } from '../middleware/auth.js';

// Create a protected sub-router
const protectedRouter = express.Router();
protectedRouter.use(authenticate);

// Move POST /, POST /:id/book, PUT /:id, PATCH /:id/status, DELETE /:id
// to protectedRouter. Keep GET / and GET /:id on the existing public `router`.

protectedRouter.post('/', async (req, res) => { /* existing POST handler */ });
protectedRouter.post('/:id/book', async (req, res) => { /* existing book handler */ });
protectedRouter.put('/:id', async (req, res) => { /* existing PUT handler */ });
protectedRouter.patch('/:id/status', requireRole('retaileradmin'), async (req, res) => { /* existing PATCH handler */ });
protectedRouter.delete('/:id', requireRole('admin'), async (req, res) => { /* existing DELETE handler */ });

// Export both
export { router as publicCampaignsRouter, protectedRouter as protectedCampaignsRouter };
export default router; // keep default for backward compat of GET routes
```

**In `index.js`** — replace single mount with two:
```js
import campaignsRouter, { protectedCampaignsRouter } from './campaigns.js';

// Public (read-only)
router.use('/campaigns', campaignsRouter);
// Protected mutations — same /campaigns prefix, authenticate runs first
router.use('/campaigns', authenticate, protectedCampaignsRouter);
```

**Backward compatibility:** `GET /api/campaigns` and `GET /api/campaigns/:id` remain public — `RetailerDashboard`, `CampaignApprovalList`, and `BrandDashboard` continue to load without token changes.

**Verification:**
```bash
# Should return 200 (public)
curl http://localhost:8080/api/campaigns

# Should return 401 (no token, now protected)
curl -X POST http://localhost:8080/api/campaigns -H "Content-Type: application/json" -d '{"name":"test"}'

# Should return 403 (wrong role)
curl -X PATCH http://localhost:8080/api/campaigns/cmp_123/status \
  -H "x-demo-role: brand" -H "Content-Type: application/json" -d '{"status":"approved"}'

# Should return 200 (correct role)
curl -X PATCH http://localhost:8080/api/campaigns/cmp_123/status \
  -H "x-demo-role: retaileradmin" -H "Content-Type: application/json" -d '{"status":"approved"}'

# DELETE with no role → 401
curl -X DELETE http://localhost:8080/api/campaigns/cmp_123

# DELETE with admin role → 204
curl -X DELETE http://localhost:8080/api/campaigns/cmp_123 -H "x-demo-role: admin"
```

**Outcome probability:** 85%  
**Biggest risk:** If `ApiService.js` `createCampaign()` / `bookSlots()` calls are made from the Brand wizard without attaching an auth token, they will now get 401. Confirm with `grep -n "createCampaign\|bookSlots\|Authorization" client-app/src/services/ApiService.js` before merging.

---

### Task 9.3 — Implement rate limiter for `POST /api/telemetry/impression`

**Confirmed files:**
- `ad-server/src/middleware/rateLimiter.js` — SHA `9f31b11` (107 bytes — stub)
- `ad-server/src/api/telemetry.js` — SHA `8e481d6`

**Pre-checks:**
```bash
# See what the stub currently exports
cat ad-server/src/middleware/rateLimiter.js

# Confirm express-rate-limit is in package.json
grep "express-rate-limit" ad-server/package.json
```

**Implementation — `rateLimiter.js`:**
Replace stub with:
```js
import rateLimit from 'express-rate-limit';

export const impressionLimiter = rateLimit({
    windowMs: 60 * 1000,         // 1 minute window
    max: 60,                      // 60 requests per IP per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many impression events. Retry after 60 seconds.' },
});

export const defaultLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
});
```

**In `telemetry.js`** — add at the route level only (not globally):
```js
import { impressionLimiter } from '../middleware/rateLimiter.js';

// Change:
router.post('/impression', (req, res) => {
// To:
router.post('/impression', impressionLimiter, (req, res) => {
```

**Backward compatibility:** Only `POST /impression` is rate-limited. `GET /upload-url`, `PUT /sink/*`, and `POST /error` are unaffected.

**Verification:**
```bash
# Fire 61 requests in rapid succession — 61st must return 429
for i in $(seq 1 61); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/api/telemetry/impression \
    -H "Content-Type: application/json" \
    -d '{"screen_id":"s1","campaign_id":"cmp_1"}'
done
# Last line must be: 429
```

**Outcome probability:** 90%  
**Biggest risk:** `express-rate-limit` may not be installed — if `grep` finds it missing from `package.json`, run `npm install express-rate-limit --workspace=ad-server` before implementing.

---

### Task 9.4 — Fix dead quick-action links in `RetailerDashboard`

**Confirmed file:**
- `client-app/src/pages/retailer/RetailerDashboard.jsx` — SHA `068ae65f`

**Pre-checks:**
```bash
# Confirm broken paths (lines 42–43)
grep -n "schedule/calendar\|/history" client-app/src/pages/retailer/RetailerDashboard.jsx

# Confirm correct registered route paths from App.jsx
grep -n "retailer" client-app/src/App.jsx
```

**Exact changes** in the `quickActions` array (lines ~42–43):

| Current (broken) | Correct (matches App.jsx) |
|---|---|
| `/dashboard/retailer/schedule/calendar` | `/dashboard/retailer/schedule` |
| `/dashboard/retailer/history` | `/dashboard/retailer/schedule-history` |

**Verification:**
- Navigate to `/dashboard/retailer` as `retaileradmin` persona.
- Click "Schedule Calendar" → URL changes to `/dashboard/retailer/schedule`, `ScheduleCalendar` component renders (not `NotFound`).
- Click "Approval History" → URL changes to `/dashboard/retailer/schedule-history`, `ScheduleHistory` component renders (not `NotFound`).
- Hard-refresh at `/dashboard/retailer/schedule-history` → page loads without 404.

**Outcome probability:** 99%  
**Biggest risk:** None — pure string correction, zero new imports, zero logic change.

---

### Task 9.5 — Create `pages/retailer/Loops.jsx` page + register route in `App.jsx`

**Pre-work (REQUIRED before writing code):**
```bash
# 1. Confirm page does NOT exist (Guardrail 1)
ls client-app/src/pages/retailer/

# 2. Understand what data loops need — confirm loops API signature
grep -n "getLoops\|GET.*loops" client-app/src/services/ApiService.js

# 3. Confirm LoopPreview and LoopVisualisationBar component APIs
head -30 client-app/src/components/LoopPreview.jsx
head -30 client-app/src/components/LoopVisualisationBar.jsx
```

**New file to create:** `client-app/src/pages/retailer/Loops.jsx`

This is a CREATE operation. The file must:
1. `import apiService from '../../services/ApiService'`
2. `import LoopPreview from '../../components/LoopPreview'` (SHA `b8bfc2d` — confirmed on disk)
3. Call `apiService.getLoops()` on mount via `useEffect`
4. Render a list with `data-testid="retailer-loops-page"` on outer container
5. Render each loop card with `data-testid="loop-card-{loop.id}"`

**Changes to `App.jsx` (SHA `cabbf4b`) — THREE places:**

1. Add to the verified-file comment block:
```
 *   pages/retailer/Loops.jsx             ✅  (served at /dashboard/retailer/loops)
```
(Replace the current `❌ NOT ON DISK` line)

2. Add lazy import:
```js
const RetailerLoops = lazy(() => import('./pages/retailer/Loops'));
```
(After line: `const ScheduleManager = lazy(...)`)

3. Add route inside `<Route path="retailer" ...>` group:
```jsx
<Route path="retailer/loops" element={<RetailerLoops />} />
```

**Verification:**
- `ls client-app/src/pages/retailer/Loops.jsx` exits 0.
- Navigate to `/dashboard/retailer/loops` → component renders (not `NotFound`).
- Hard-refresh at `/dashboard/retailer/loops` → does not white-screen (Suspense fallback appears then resolves).
- `document.querySelector('[data-testid="retailer-loops-page"]')` non-null.
- `GET /api/loops` returns HTTP 200 (requires `authenticate` — confirm token is sent).

**Outcome probability:** 75%  
**Biggest risk:** `GET /api/loops` is `authenticate`-protected (`router.use('/loops', authenticate, loopsRouter)` in `index.js`). If `ApiService.getLoops()` does not attach an auth token for the retailer persona, the page will silently load with an empty list or 401. Verify token header in `ApiService.js` before marking Done.

---

### Task 9.6 — Wire `TelemetryService.js` impression call in `Player.jsx`

**Pre-work (REQUIRED):**
```bash
# Determine if Player already fires an impression
grep -n "impression\|telemetry\|TelemetryService" client-app/src/pages/Player.jsx

# Confirm TelemetryService.js exports and method name
grep -n "export\|impression\|fireImpression" client-app/src/services/TelemetryService.js

# Confirm Player's ad-play event name/handler
grep -n "onPlay\|adStart\|playAd\|currentAd" client-app/src/pages/Player.jsx | head -20
```

**Confirmed files:**
- `client-app/src/services/TelemetryService.js` — SHA `4e0520b` — EXISTS
- `client-app/src/pages/Player.jsx` — SHA confirmed via tree read

**Implementation pattern** (conditional on grep results):

If `Player.jsx` has no impression call, add inside the ad-play handler:
```js
import TelemetryService from '../services/TelemetryService';

// Inside the handler that fires when an ad slot begins playing:
TelemetryService.fireImpression({
    screen_id: screenId,    // from Player's existing screen state
    campaign_id: ad.campaign_id,
    asset_id: ad.asset_id || null,
    loop_id: ad.loop_id || null,
});
```

`TelemetryService.fireImpression` must call:
```
POST /api/telemetry/impression
Body: { screen_id, campaign_id, asset_id, loop_id }
```
And return `{ status: 'recorded', impression_id: <uuid> }` (HTTP 201).

**Verification:**
- Play an ad in the demo player at `/player/demo`.
- In Network tab, observe `POST /api/telemetry/impression` fires with HTTP 201.
- Response body contains `impression_id` matching UUID v4 pattern (`/^[0-9a-f-]{36}$/`).
- Server logs show `[INFO] Impression { type: 'impression', impression_id: ... }`.
- Playing the same ad twice produces two distinct `impression_id` values.

**Outcome probability:** 80%  
**Biggest risk:** `Player.jsx` may already have a custom impression mechanism that differs from `TelemetryService` — if grep reveals an existing call, this task becomes a refactor (route both through `TelemetryService`) rather than a pure addition. Scope must be reassessed before starting.

---

## Isolation & Blast Radius

| Task | Files | Change Type | Can It Break Anything Else? | Why / Mitigation |
|------|-------|-------------|----------------------------|-----------------|
| 9.1 | `CampaignApprovalList.jsx` | Additive | No | Adding HTML attributes only; no logic, no import changes |
| 9.2 | `index.js`, `campaigns.js` | Refactor | **Yes — high risk** | Moving POST/PUT/DELETE behind `authenticate` will 401 any Brand wizard calls made without a token. Mitigation: grep `ApiService.js` for token attachment before merging. `GET /campaigns` stays public — no risk to read-only callers. |
| 9.3 | `rateLimiter.js`, `telemetry.js` | Additive | No | Rate limiter scoped to `POST /impression` only; other telemetry endpoints unaffected |
| 9.4 | `RetailerDashboard.jsx` | Fix | No | String constants only; no new components or API calls |
| 9.5 | `Loops.jsx` (NEW), `App.jsx` | Additive | **Yes — low risk** | Adding a `lazy()` import of a non-existent file before the file is created will crash the entire app at startup (Vite/React will throw on the import). Mitigation: create the file before modifying `App.jsx`. |
| 9.6 | `TelemetryService.js`, `Player.jsx` | Additive | **Yes — medium risk** | Player is a critical path. Any import error or exception in `TelemetryService.fireImpression` must be wrapped in try/catch so a telemetry failure never interrupts playback. |

---

## File Inventory — Sprint 9 Only

| File | Operation | Linked Tasks | SHA (pre-sprint) |
|------|-----------|-------------|-----------------|
| `client-app/src/components/CampaignApprovalList.jsx` | EDIT | 9.1 | `6b5f2a0` |
| `ad-server/src/api/index.js` | EDIT | 9.2 | `4bbfcc6` |
| `ad-server/src/api/campaigns.js` | EDIT | 9.2 | `33c74d6` |
| `ad-server/src/middleware/rateLimiter.js` | EDIT (stub → implementation) | 9.3 | `9f31b11` |
| `ad-server/src/api/telemetry.js` | EDIT | 9.3 | `8e481d6` |
| `client-app/src/pages/retailer/RetailerDashboard.jsx` | EDIT | 9.4 | `068ae65f` |
| `client-app/src/pages/retailer/Loops.jsx` | **CREATE** | 9.5 | N/A — NOT ON DISK |
| `client-app/src/App.jsx` | EDIT | 9.5 | `cabbf4b` |
| `client-app/src/services/TelemetryService.js` | EDIT (conditional on grep) | 9.6 | `4e0520b` |
| `client-app/src/pages/Player.jsx` | EDIT (conditional on grep) | 9.6 | Verify SHA before editing |

**Files explicitly NOT touched this sprint (confirmed stable):**
- `ad-server/src/middleware/requireRole.js` SHA `658bcb7` — no changes
- `client-app/src/services/ApiService.js` SHA `bc13dca` — read-only reference
- `client-app/src/components/StatusBadge.jsx` SHA `2b7bfa3` — no changes
- `client-app/src/pages/brand/BrandCampaignWizard.jsx` SHA `1c9c110` — no changes

---

## Test Stabilisation Order

Run in this sequence to separate infrastructure bugs from feature bugs:

```
Step 1 — Infrastructure baseline (no app code changes)
  client-app/src/services/api.test.js   (SHA f52077421)
  Purpose: Confirm base API fetch/error handling is not regressed.
  Expected: All pass before any Sprint 9 code is written.

Step 2 — Auth middleware unit test (after Task 9.2)
  ad-server/src/middleware/auth.js        (manual: curl tests above)
  ad-server/src/middleware/requireRole.js (manual: curl tests above)
  Purpose: Confirm 401 vs 403 behaviour for all campaign mutations.

Step 3 — Rate limiter test (after Task 9.3)
  Shell: 61-request loop against POST /api/telemetry/impression (see Task 9.3 verification).
  Purpose: Confirm 429 fires on request 61, not before or after.

Step 4 — CampaignApprovalList testid smoke test (after Task 9.1)
  Browser DevTools:
    document.querySelectorAll('[data-testid^="campaign-row-"]').length > 0
  Purpose: Confirm testids are present in DOM before writing Playwright/Cypress specs.

Step 5 — Route navigation smoke (after Tasks 9.4 and 9.5)
  Manual: Click each RetailerDashboard quick-action link.
  Manual: Hard-refresh at /dashboard/retailer/loops.
  Purpose: Confirm no NotFound renders and no lazy-import crash.

Step 6 — Telemetry impression E2E (after Task 9.6)
  Manual: Play ad in /player/demo, observe Network tab for POST /impression 201.
  Purpose: Confirm full pipeline from player action to server log.

Step 7 — Regression: GlassCard component (existing spec)
  client-app/src/components/GlassCard.test.jsx (SHA 2827ebff)
  Purpose: Canary — if this breaks, a shared import or CSS token was accidentally modified.
```

---

## Definition of Done

- [ ] `CampaignApprovalList.jsx` has `data-testid="campaign-approval-list"` on its root element, confirmed with `document.querySelector` in browser DevTools.
- [ ] Every campaign row in `CampaignApprovalList` renders `data-testid="campaign-row-{id}"` where `{id}` is a non-empty, non-undefined string.
- [ ] `PATCH /api/campaigns/:id/status` returns HTTP `401` when called with no auth token (after Task 9.2).
- [ ] `PATCH /api/campaigns/:id/status` returns HTTP `403` when called with role `brand` (after Task 9.2).
- [ ] `GET /api/campaigns` returns HTTP `200` with no auth token (public read preserved after Task 9.2).
- [ ] `DELETE /api/campaigns/:id` returns HTTP `403` when called with role `retaileradmin` (requires `admin` or higher after Task 9.2).
- [ ] The 61st `POST /api/telemetry/impression` within a 60-second window returns HTTP `429` with body `{ error: "Too many impression events..." }`.
- [ ] Clicking "Schedule Calendar" in `RetailerDashboard` navigates to `/dashboard/retailer/schedule` and renders `ScheduleCalendar` (not `NotFound`).
- [ ] Clicking "Approval History" in `RetailerDashboard` navigates to `/dashboard/retailer/schedule-history` and renders `ScheduleHistory` (not `NotFound`).
- [ ] `client-app/src/pages/retailer/Loops.jsx` exists on disk (confirmed with `ls`).
- [ ] `App.jsx` lazy import `const RetailerLoops = lazy(() => import('./pages/retailer/Loops'))` is present.
- [ ] `App.jsx` route `<Route path="retailer/loops" element={<RetailerLoops />} />` is registered.
- [ ] `App.jsx` comment block lists `pages/retailer/Loops.jsx ✅`.
- [ ] Hard-refresh at `/dashboard/retailer/loops` does not white-screen or render `NotFound`.
- [ ] `POST /api/telemetry/impression` during ad playback in `/player/demo` returns HTTP `201` with `{ status: "recorded", impression_id: "<uuid>" }`.
- [ ] Two consecutive ad plays produce two distinct `impression_id` values (UUID v4 format).
- [ ] `GlassCard.test.jsx` passes without modification (regression canary).
- [ ] All risk register items R4 (dead links) and V1 (unguarded campaigns) are resolved — status updated to `RESOLVED` in this document.
- [ ] No occurrence of "works correctly", "displays properly", or "functions as expected" appears in any AC text added this sprint.
- [ ] `App.jsx` verified-file comment block has no `❌` entries that correspond to files touched this sprint.
