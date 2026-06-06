# Sprint 9 — softomedia-live2026

> **Grounding snapshot** — all paths, SHAs, and route mounts verified against commit `4cde1a8` (2026-06-05).
> **App.jsx SHA:** `cabbf4b` · **index.js SHA:** `4bbfcc6`
> No filename in this document is unverified. Where a file does not yet exist, a `PRE-WORK` step is explicitly called out.

---

## 🔒 SIX SRE / QA GUARDRAILS — MANDATORY FOR ALL SPRINTS

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

### Guardrail 5 — Verify Export Type Before Importing
Before any task references a service import, confirm: (a) is it a default export or named export? (b) does the method you intend to call actually exist?  
Run `grep -n "^export" <file>` and `grep -n "methodName" <file>` as mandatory pre-checks.  
A wrong import type is a silent runtime `undefined` that TypeScript does not catch in `.jsx` files. This was the root cause of the Task 9.6 spec error (`fireImpression` vs `trackImpression`, default vs named export).

### Guardrail 6 — `localStorage` Is Banned in Sandboxed Contexts
Any service that calls `localStorage` in its constructor (e.g. `TelemetryService` — confirmed: `this.buffer = this.loadBuffer()` → `localStorage.getItem` on instantiation) must not be imported at module level in pages that may run in sandboxed iframes.  
Verify the deployment context (`<iframe sandbox>` attributes) before importing.  
Add a `try/catch` around all `localStorage` accesses in service constructors.  
**`Loops.jsx` must not import `TelemetryService`.**

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

> Probabilities reflect `sprint9-probability-audit.md` findings (2026-06-05). Original scores shown for reference.

| Task ID | Files Touched | Change Type | Est. Effort | Outcome Probability | Biggest Risk |
|---------|--------------|-------------|-------------|---------------------|--------------|
| **9.1** | `client-app/src/components/CampaignApprovalList.jsx` | Additive (data-testids + date/budget display hardening) | 1h | ~~95%~~ **98%** | `c.id` is `undefined` in API response → all testids collapse to `campaign-row-undefined`. Confirmed stable (`cmp_${Date.now()}` prefix) but verify with pre-check grep. |
| **9.2** | `ad-server/src/api/index.js`, `ad-server/src/api/campaigns.js` | Refactor (auth split + DELETE guard) | 1.5h | ~~85%~~ **82%** | Dual-export refactor of `campaigns.js` + concurrent-PR merge conflict. Client token risk is **eliminated** — `api.js` already sends `Bearer demo-token` on every DEV request. Freeze `campaigns.js`; implement first. |
| **9.3** | `ad-server/src/middleware/rateLimiter.js`, `ad-server/src/api/telemetry.js` | Additive (rate limit implementation) | 1h | ~~90%~~ **97%** | `express-rate-limit@7.2.0` **already installed** (confirmed). Stub exports named `rateLimiter` — new file replaces it. Pre-check: grep for old import name before replacing. |
| **9.4** | `client-app/src/pages/retailer/RetailerDashboard.jsx` | Fix (dead quick-action link paths) | 30m | **99%** | None — pure string correction, no new imports. |
| **9.5** | `client-app/src/pages/retailer/Loops.jsx` (NEW), `client-app/src/App.jsx` | Additive (new page + route registration) | 2h | ~~75%~~ **72%** | `LoopPreview` required props unknown until live read — a missing required prop causes render error. Pre-check `head -30 LoopPreview.jsx` mandatory. Do NOT import `TelemetryService` (Guardrail 6). |
| **9.6** | `client-app/src/pages/Player.jsx` | Additive (wire impression call in Player) | 1h | ~~80%~~ **55%** ⚠️ | **RESPECIFIED** — method is `trackImpression` (named singleton export), not `fireImpression` (default). Buffer-based verification, not HTTP. Score rises to ~85% after pre-check greps complete. |

---

## Full Task Details

---

### Task 9.1 — Add `data-testid` attributes to `CampaignApprovalList`

**Confirmed files:**
- `client-app/src/components/CampaignApprovalList.jsx` — SHA `6b5f2a0`

**Pre-checks:**
```bash
# Confirm no data-testid already present (expected: 0)
grep -c "data-testid" client-app/src/components/CampaignApprovalList.jsx

# Confirm c.id is the correct field (not c.campaign_id or c._id)
grep -n "c\.id\b" client-app/src/components/CampaignApprovalList.jsx

# Confirm StatusBadge is imported (SHA 2b7bfa3)
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
- `document.querySelector('[data-testid="approval-queue-count"]').textContent` equals the count shown in the heading badge.
- With ≥1 pending campaign: `document.querySelector('[data-testid^="approve-btn-"]') !== null`.
- Clicking `[data-testid="approve-btn-{id}"]` triggers `PATCH /api/campaigns/{id}/status` with body `{ status: "approved" }` → response HTTP 200 with `{ status: "approved" }` field.
- After approve, `[data-testid="campaign-status-{id}"]` text content changes to `"approved"` without full page reload (optimistic UI).

**Outcome probability:** 98%  
**Biggest risk:** If Firestore is empty in dev, no rows render — seed one `pending_approval` campaign before testing testids.

---

### Task 9.2 — Harden `/api/campaigns` auth: split public GET from protected mutations + guard DELETE

**Confirmed files:**
- `ad-server/src/api/index.js` — SHA `4bbfcc6`
- `ad-server/src/api/campaigns.js` — SHA `33c74d6`
- `ad-server/src/middleware/auth.js` — SHA `77c6bfb`
- `ad-server/src/middleware/requireRole.js` — SHA `658bcb7`

> **Confirmed (probability-audit):** `api.js` sends `Authorization: Bearer demo-token` + `x-demo-role` on every DEV request via interceptor. `auth.js` accepts `Bearer demo-token` when `NODE_ENV !== production`. **Zero client-side changes are required.** BrandCampaignWizard, CampaignApprovalList, and RetailerDashboard all continue to work without modification.

> **Confirmed (probability-audit):** `auth.js` returns `401` for missing `Authorization` header, and `403` for invalid/expired JWT. Verification curls below use no-header (not invalid token) to test `401`.

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
# Confirm no other server file imports from campaigns.js as named export
grep -rn "from.*campaigns" ad-server/src/ --include="*.js"
# Expected: only ad-server/src/api/index.js — default import only

# Confirm authenticate export name
grep -n "^export const authenticate" ad-server/src/middleware/auth.js

# Confirm auth.js 401 vs 403 split
grep -n "401\|403\|Authorization header\|Invalid.*token" ad-server/src/middleware/auth.js
```

**Implementation — split router strategy in `campaigns.js`:**

```js
// At top of campaigns.js, after existing imports:
import { authenticate } from '../middleware/auth.js';

// Create a protected sub-router
const protectedRouter = express.Router();
protectedRouter.use(authenticate);

protectedRouter.post('/', async (req, res) => { /* existing POST handler */ });
protectedRouter.post('/:id/book', async (req, res) => { /* existing book handler */ });
protectedRouter.put('/:id', async (req, res) => { /* existing PUT handler */ });
protectedRouter.patch('/:id/status', requireRole('retaileradmin'), async (req, res) => { /* existing PATCH handler */ });
protectedRouter.delete('/:id', requireRole('admin'), async (req, res) => { /* existing DELETE handler */ });

export { router as publicCampaignsRouter, protectedRouter as protectedCampaignsRouter };
export default router; // keep default for backward compat of GET routes
```

**In `index.js`** — replace single mount with two:
```js
import campaignsRouter, { protectedCampaignsRouter } from './campaigns.js';

router.use('/campaigns', campaignsRouter);           // Public (read-only)
router.use('/campaigns', protectedCampaignsRouter);  // Protected mutations — authenticate runs inside protectedRouter
```

**Verification:**
```bash
# 200 — public GET preserved
curl http://localhost:8080/api/campaigns

# 401 — no Authorization header
curl -X POST http://localhost:8080/api/campaigns -H "Content-Type: application/json" -d '{"name":"test"}'

# 403 — wrong role
curl -X PATCH http://localhost:8080/api/campaigns/cmp_123/status \
  -H "Authorization: Bearer demo-token" -H "x-demo-role: brand" \
  -H "Content-Type: application/json" -d '{"status":"approved"}'

# 200 — correct role
curl -X PATCH http://localhost:8080/api/campaigns/cmp_123/status \
  -H "Authorization: Bearer demo-token" -H "x-demo-role: retaileradmin" \
  -H "Content-Type: application/json" -d '{"status":"approved"}'

# 401 — DELETE no token
curl -X DELETE http://localhost:8080/api/campaigns/cmp_123

# 403 — DELETE wrong role (retaileradmin is not admin)
curl -X DELETE http://localhost:8080/api/campaigns/cmp_123 \
  -H "Authorization: Bearer demo-token" -H "x-demo-role: retaileradmin"

# 204 — DELETE correct role
curl -X DELETE http://localhost:8080/api/campaigns/cmp_123 \
  -H "Authorization: Bearer demo-token" -H "x-demo-role: admin"
```

**Outcome probability:** 82%  
**Biggest risk:** Dual-export refactor complexity + concurrent-PR merge conflict on `campaigns.js`. Implement this task **first** in the sprint; freeze `campaigns.js` during implementation window.

---

### Task 9.3 — Implement rate limiter for `POST /api/telemetry/impression`

**Confirmed files:**
- `ad-server/src/middleware/rateLimiter.js` — SHA `9f31b11` (107 bytes — stub, exports named `rateLimiter`)
- `ad-server/src/api/telemetry.js` — SHA `8e481d6`

> **Confirmed (probability-audit):** `express-rate-limit@7.2.0` is already in `ad-server/package.json`. No `npm install` needed.

**Pre-checks:**
```bash
# See current stub export name — will be replaced
grep -n "export" ad-server/src/middleware/rateLimiter.js

# Confirm nothing else imports the old 'rateLimiter' name before replacing
grep -rn "rateLimiter\b" ad-server/src/ --include="*.js"
# If any file imports it, add: export { impressionLimiter as rateLimiter }
```

**Implementation — `rateLimiter.js` (full replacement):**
```js
import rateLimit from 'express-rate-limit';

export const impressionLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
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

// Backwards-compat alias — remove after Sprint 11
export { impressionLimiter as rateLimiter };
```

**In `telemetry.js`:**
```js
import { impressionLimiter } from '../middleware/rateLimiter.js';

// Change:
router.post('/impression', (req, res) => {
// To:
router.post('/impression', impressionLimiter, (req, res) => {
```

**Note on `api.js` retry behaviour:** The browser client auto-retries `429` responses up to 3 times with 1s/2s/3s delays (`retryOn: [429]`). Browser-side E2E tests must account for this. Shell curl tests bypass client retry logic entirely.

**Verification:**
```bash
for i in $(seq 1 61); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/api/telemetry/impression \
    -H "Content-Type: application/json" \
    -d '{"screen_id":"s1","campaign_id":"cmp_1"}'
done
# Requests 1–60: 201. Request 61: 429.

# Confirm other telemetry endpoints are NOT rate-limited after the 429
curl http://localhost:8080/api/telemetry/upload-url
# Expected: 200 (unaffected)
```

**Outcome probability:** 97%  
**Biggest risk:** Another file importing the old `rateLimiter` named export — eliminated by pre-check grep before replacing the stub.

---

### Task 9.4 — Fix dead quick-action links in `RetailerDashboard`

**Confirmed file:**
- `client-app/src/pages/retailer/RetailerDashboard.jsx` — SHA `068ae65f`

**Pre-checks:**
```bash
grep -n "schedule/calendar\|/history" client-app/src/pages/retailer/RetailerDashboard.jsx
grep -n "retailer" client-app/src/App.jsx
```

**Exact changes** in the `quickActions` array (lines ~42–43):

| Current (broken) | Correct (matches App.jsx) |
|---|---|
| `/dashboard/retailer/schedule/calendar` | `/dashboard/retailer/schedule` |
| `/dashboard/retailer/history` | `/dashboard/retailer/schedule-history` |

**Verification:**
- Click "Schedule Calendar" → URL `/dashboard/retailer/schedule`, `ScheduleCalendar` renders (not `NotFound`).
- Click "Approval History" → URL `/dashboard/retailer/schedule-history`, `ScheduleHistory` renders (not `NotFound`).
- Hard-refresh at `/dashboard/retailer/schedule-history` → page loads.

**Outcome probability:** 99%  
**Biggest risk:** None.

---

### Task 9.5 — Create `pages/retailer/Loops.jsx` page + register route in `App.jsx`

> **Guardrail 6 applies:** Do NOT import `TelemetryService` in `Loops.jsx`. The service calls `localStorage` in its constructor and will crash in sandboxed iframe contexts.

**Pre-work (REQUIRED before writing code):**
```bash
# 1. Confirm page does NOT exist (Guardrail 1)
ls client-app/src/pages/retailer/Loops.jsx 2>&1
# Expected: "No such file or directory"

# 2. Read LoopPreview props before writing JSX — required prop omission = render error
grep -n "props\|function LoopPreview\|const LoopPreview\|PropTypes" client-app/src/components/LoopPreview.jsx | head -20

# 3. Confirm getLoops return shape
grep -A5 "getLoops" client-app/src/pages/retailer/RetailerDashboard.jsx

# 4. Confirm App.jsx retailer route group path prefix
grep -n "retailer\|path=\"retailer" client-app/src/App.jsx | head -20
```

**New file to create:** `client-app/src/pages/retailer/Loops.jsx`

This file must:
1. `import apiService from '../../services/ApiService'`
2. `import LoopPreview from '../../components/LoopPreview'` (SHA `b8bfc2d` — confirmed on disk)
3. Call `apiService.getLoops()` on mount via `useEffect`
4. Render a list with `data-testid="retailer-loops-page"` on outer container
5. Render each loop card with `data-testid="loop-card-{loop.id}"`
6. **NOT import `TelemetryService`** (Guardrail 6)

**Changes to `App.jsx` (SHA `cabbf4b`) — THREE places, ONE atomic commit:**

1. Update verified-file comment block: replace `pages/retailer/Loops.jsx ❌ NOT ON DISK` with:
   ```
    *   pages/retailer/Loops.jsx             ✅  (served at /dashboard/retailer/loops)
   ```
2. Add lazy import (after `const ScheduleManager = lazy(...)`):
   ```js
   const RetailerLoops = lazy(() => import('./pages/retailer/Loops'));
   ```
3. Add route inside `<Route path="retailer" ...>` group:
   ```jsx
   <Route path="retailer/loops" element={<RetailerLoops />} />
   ```

**Verification:**
1. `ls client-app/src/pages/retailer/Loops.jsx` exits 0.
2. `grep "RetailerLoops" client-app/src/App.jsx` returns exactly 2 lines (lazy import + Route).
3. `grep "Loops.jsx.*✅" client-app/src/App.jsx` matches.
4. Navigate to `/dashboard/retailer/loops` → component renders, not `NotFound`.
5. Hard-refresh at `/dashboard/retailer/loops` → no white-screen, no console error.
6. `document.querySelector('[data-testid="retailer-loops-page\"]') !== null`.
7. `GET http://localhost:8080/api/loops` with `Authorization: Bearer demo-token` → HTTP 200, array response.

**Outcome probability:** 72%  
**Biggest risk:** `LoopPreview` required props unknown until pre-check read. If it requires a prop with no sensible default (e.g. `storeId`), time-box this task to 3h and fall back to a simpler list view without `LoopPreview`.

---

### Task 9.6 — Wire `TelemetryService.js` impression call in `Player.jsx`

> ⚠️ **RESPECIFIED** — Original `sprint9.md` spec contained two errors confirmed by `sprint9-probability-audit.md` live-read of `TelemetryService.js` (SHA `4e0520b`):
> 1. Method name was `fireImpression` — **actual method is `trackImpression`**
> 2. Import was `import TelemetryService from ...` (default) — **actual export is named singleton: `export const telemetryService = new TelemetryService()`**
> 3. Verification steps referenced `POST /api/telemetry/impression → HTTP 201` — **`TelemetryService` does not call this endpoint**; it buffers to `localStorage` and flushes via GCS signed-URL batch upload. The direct-fire `POST /impression` endpoint (Sprint 8, Task S8-7) and `TelemetryService`'s batch path are **parallel, non-conflicting paths** — no reconciliation needed this sprint.

**What `TelemetryService.js` actually does (confirmed live):**
- Exports named singleton `telemetryService` (not a default export).
- Method: `trackImpression(impression)`.
- Buffers impressions to `localStorage` under key `softomedia_impression_buffer`.
- Flushes to GCS via `GET /api/telemetry/upload-url` → `PUT <signedUrl>` when buffer ≥ 50 or every 60 minutes.
- Exposes `window.softomedia_telemetry` in test/debug mode.
- **Calls `localStorage` in its constructor** — see Guardrail 6.

**Pre-work (REQUIRED before touching `Player.jsx`):**
```bash
# Confirm Player does not already call trackImpression
grep -n "trackImpression\|telemetryService\|TelemetryService\|impression" client-app/src/pages/Player.jsx

# Confirm export type and method name
grep -n "^export" client-app/src/services/TelemetryService.js
# Expected: export const telemetryService = new TelemetryService();

# Confirm Player's ad-play handler name
grep -n "onPlay\|adStart\|playAd\|currentAd" client-app/src/pages/Player.jsx | head -20

# Confirm Player is NOT in a sandboxed iframe context (Guardrail 6)
grep -rn "sandbox" client-app/src/ --include="*.jsx" --include="*.html"
```

**Correct import and implementation:**
```js
// CORRECT import:
import { telemetryService } from '../services/TelemetryService';

// WRONG (do not use — no default export):
// import TelemetryService from '../services/TelemetryService';

// Inside the ad-play handler (exact function name confirmed by grep above):
try {
    telemetryService.trackImpression({
        screen_id: screenId,
        campaign_id: currentAd.campaign_id,
        asset_id: currentAd.asset_id || null,
        loop_id: currentAd.loop_id || null,
    });
} catch (e) {
    // Telemetry must NEVER interrupt playback
    console.warn('[Telemetry] trackImpression failed silently', e);
}
```

**Verification (buffer-based — not HTTP-based):**
1. `grep "telemetryService.trackImpression" client-app/src/pages/Player.jsx` returns exactly 1 line.
2. Navigate to `/player/demo?debug=true` → `window.softomedia_telemetry` is defined in DevTools console.
3. Play one ad → `window.softomedia_telemetry.buffer.length === 1`.
4. Play a second ad → `window.softomedia_telemetry.buffer.length === 2`.
5. Each buffer entry contains fields: `screen_id`, `campaign_id`, `timestamp` (ISO string), `uuid` (UUID v4 pattern `/^[0-9a-f-]{36}$/`).
6. Two consecutive impressions produce distinct `uuid` values.
7. `JSON.parse(localStorage.getItem('softomedia_impression_buffer')).length >= 1` after first play (hard-refresh and re-check to confirm persistence).
8. Mock `telemetryService.trackImpression = () => { throw new Error('test') }` in DevTools → player continues playing without pause, skip, or crash.

**Outcome probability:** 55% (rises to ~85% after pre-check greps confirm ad-play handler name and no existing impression call)  
**Biggest risk:** `Player.jsx` may already have a custom impression mechanism — if grep reveals an existing call, this task becomes a refactor, not a pure addition. Reassess scope before writing any code.

---

## Isolation & Blast Radius

| Task | Files | Change Type | Can It Break Anything Else? | Why / Mitigation |
|------|-------|-------------|----------------------------|-----------------|
| 9.1 | `CampaignApprovalList.jsx` | Additive | No | Adding HTML attributes only; no logic, no import changes |
| 9.2 | `index.js`, `campaigns.js` | Refactor | **Yes — guarded** | POST/PUT/DELETE move behind `authenticate`. Client already sends `Bearer demo-token` in DEV — zero regressions. Freeze `campaigns.js` during implementation window. |
| 9.3 | `rateLimiter.js`, `telemetry.js` | Additive | No | Rate limiter scoped to `POST /impression` only; other telemetry endpoints unaffected |
| 9.4 | `RetailerDashboard.jsx` | Fix | No | String constants only; no new components or API calls |
| 9.5 | `Loops.jsx` (NEW), `App.jsx` | Additive | **Yes — low risk** | `lazy()` pointing to missing file crashes entire dashboard Suspense tree. Mitigation: atomic commit — file must exist before `App.jsx` is edited. |
| 9.6 | `Player.jsx` | Additive | No | `try/catch` wraps all telemetry calls; playback loop is unchanged. Uses named import `telemetryService.trackImpression` — not `TelemetryService.fireImpression`. |

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
| `client-app/src/pages/Player.jsx` | EDIT (conditional on pre-check grep) | 9.6 | Verify SHA before editing |

**Files explicitly NOT touched this sprint (confirmed stable):**
- `ad-server/src/middleware/requireRole.js` SHA `658bcb7` — no changes
- `client-app/src/services/ApiService.js` SHA `bc13dca` — read-only reference
- `client-app/src/services/TelemetryService.js` SHA `4e0520b` — read-only (no changes to service; Player calls it)
- `client-app/src/components/StatusBadge.jsx` SHA `2b7bfa3` — no changes
- `client-app/src/pages/brand/BrandCampaignWizard.jsx` SHA `1c9c110` — no changes

---

## Test Stabilisation Order

```
Step 1 — Infrastructure baseline (no app code changes)
  client-app/src/services/api.test.js   (SHA f52077421)
  Purpose: Confirm base API fetch/error handling is not regressed.
  Expected: All pass before any Sprint 9 code is written.

Step 2 — Auth middleware unit test (after Task 9.2)
  Manual: curl tests from Task 9.2 verification block above.
  Purpose: Confirm 401 (missing header) vs 403 (wrong role) for all campaign mutations.

Step 3 — Rate limiter test (after Task 9.3)
  Shell: 61-request loop against POST /api/telemetry/impression.
  Purpose: Confirm 429 fires on request 61; requests 1–60 return 201.

Step 4 — CampaignApprovalList testid smoke test (after Task 9.1)
  Browser DevTools: document.querySelectorAll('[data-testid^="campaign-row-"]').length > 0
  Purpose: Confirm testids present in DOM before writing Playwright/Cypress specs.

Step 5 — Route navigation smoke (after Tasks 9.4 and 9.5)
  Manual: Click each RetailerDashboard quick-action link.
  Manual: Hard-refresh at /dashboard/retailer/loops.
  Purpose: Confirm no NotFound renders and no lazy-import crash.

Step 6 — Telemetry impression buffer verification (after Task 9.6)
  Browser DevTools: window.softomedia_telemetry.buffer.length after playing one ad.
  Purpose: Confirm trackImpression call fires and buffer grows. NOT a Network-tab check.

Step 7 — Regression: GlassCard component (existing spec)
  client-app/src/components/GlassCard.test.jsx (SHA 2827ebff)
  Purpose: Canary — if this breaks, a shared import or CSS token was accidentally modified.
```

---

## Definition of Done

- [ ] `CampaignApprovalList.jsx` has `data-testid="campaign-approval-list"` on its root element.
- [ ] Every campaign row renders `data-testid="campaign-row-{id}"` where `{id}` is a non-empty, non-undefined string.
- [ ] `document.querySelector('[data-testid="approval-queue-count"]').textContent` equals the pending campaign count shown in the heading badge.
- [ ] `PATCH /api/campaigns/:id/status` returns HTTP `401` when called with no `Authorization` header.
- [ ] `PATCH /api/campaigns/:id/status` returns HTTP `403` when called with `x-demo-role: brand`.
- [ ] `GET /api/campaigns` returns HTTP `200` with no auth token (public read preserved).
- [ ] `DELETE /api/campaigns/:id` returns HTTP `403` when called with `x-demo-role: retaileradmin`.
- [ ] `DELETE /api/campaigns/:id` returns HTTP `204` when called with `x-demo-role: admin`.
- [ ] The 61st `POST /api/telemetry/impression` within a 60-second window returns HTTP `429` with body `{ "error": "Too many impression events. Retry after 60 seconds." }`.
- [ ] `GET /api/telemetry/upload-url` returns HTTP `200` after the rate limit trips (route-scoped limiter confirmed).
- [ ] Clicking "Schedule Calendar" in `RetailerDashboard` navigates to `/dashboard/retailer/schedule` and renders `ScheduleCalendar` (not `NotFound`).
- [ ] Clicking "Approval History" in `RetailerDashboard` navigates to `/dashboard/retailer/schedule-history` and renders `ScheduleHistory` (not `NotFound`).
- [ ] `ls client-app/src/pages/retailer/Loops.jsx` exits 0.
- [ ] `grep "RetailerLoops" client-app/src/App.jsx` returns exactly 2 lines (lazy import + Route element).
- [ ] `App.jsx` comment block lists `pages/retailer/Loops.jsx ✅`.
- [ ] Hard-refresh at `/dashboard/retailer/loops` renders the Loops page (no white-screen, no `NotFound`).
- [ ] `document.querySelector('[data-testid="retailer-loops-page"]') !== null`.
- [ ] `grep "telemetryService.trackImpression" client-app/src/pages/Player.jsx` returns exactly 1 line.
- [ ] `window.softomedia_telemetry.buffer.length === 1` after playing one ad in `/player/demo?debug=true`.
- [ ] Two consecutive ad plays produce entries with distinct `uuid` values (UUID v4 pattern).
- [ ] `JSON.parse(localStorage.getItem('softomedia_impression_buffer')).length >= 1` after first play, survives hard-refresh.
- [ ] Mocking `telemetryService.trackImpression = () => { throw new Error('test') }` in DevTools does not pause, skip, or crash ad playback.
- [ ] `GlassCard.test.jsx` passes without modification (regression canary).
- [ ] Risk register items R4 and V1 updated to `RESOLVED`.
- [ ] Security register items V2 and V3 updated to `RESOLVED`.
- [ ] No occurrence of "works correctly", "displays properly", or "functions as expected" in any AC text added this sprint.
- [ ] `App.jsx` verified-file comment block has no `❌` entries corresponding to files touched this sprint.
