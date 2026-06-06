# Sprint 9 — Probability Audit & Pre-Check Revision

> **Audit commit baseline:** `4cde1a8` (2026-06-05).  
> All file reads below are from live repo; no spec claims are taken on trust.

---

## Summary Table

| Task | Old Score | New Score | Key pre-check findings | Remaining risks |
|------|-----------|-----------|------------------------|-----------------|
| 9.1 — Add `data-testid` to `CampaignApprovalList` | 95% | **98%** | Campaign objects use field `c.id` (confirmed line `key={c.id}` and `c => c.id !== id`). No existing `data-testid` present. `StatusBadge` imported. Approve/Reject buttons confirmed in JSX. | `getCampaigns()` with no `?status=` param fetches all campaigns and filters client-side — if Firestore is empty in dev no rows render, but testids can still be verified on the container. |
| 9.2 — Auth split on `/api/campaigns` + guard DELETE | 85% | **82%** | **Critical finding:** `api.js` already sends `Authorization: Bearer demo-token` + `x-demo-role` on **every** request in DEV (interceptor, line ~130). `authenticate` middleware in `auth.js` passes any request with `Bearer demo-token` when `ALLOW_DEMO_MODE=true` OR `NODE_ENV !== production`. So all existing client calls already pass `authenticate`. DELETE is confirmed unguarded (line ~160 of `campaigns.js`). Split-router export pattern will work. | Score drops slightly vs original: `auth.js` throws `403` (not `401`) for invalid/expired JWTs — but returns `401` only for missing `Authorization` header. The verification curl commands in sprint9.md must use `curl` with no header (not an invalid token) to get a clean `401`. Also: `api.js` retry logic retries on `429` — rate-limit test must account for 3 automatic retries before the client surfaces the 429. |
| 9.3 — Implement rate limiter | 90% | **97%** | `express-rate-limit@7.2.0` is **already in `package.json`** (confirmed). `rateLimiter.js` stub exports `rateLimiter` as a named export (not a default). Sprint9 spec assumed it exported nothing — it exports a pass-through. **No `npm install` needed.** | Only risk: `api.js` has `retryOn: [408, 429, 500, 502, 503, 504]` — client will auto-retry 429s up to 3 times with 1s/2s/3s delays. The 61-request shell test bypasses this, but any browser-side test must account for retries inflating apparent request count. |
| 9.4 — Fix dead RetailerDashboard links | 99% | **99%** | Dead paths confirmed in `RetailerDashboard.jsx` lines 42–43 (`schedule/calendar` and `/history`). Correct paths confirmed in `App.jsx`. Zero logic change. | None. |
| 9.5 — Create `Loops.jsx` + register route | 75% | **72%** | `getLoops()` in `ApiService.js` confirmed. BUT `api.js` sends `Authorization: Bearer demo-token` on all DEV requests — `/api/loops` will pass `authenticate` in dev without additional work. However `TelemetryService.js` uses `localStorage` in its constructor (`this.buffer = this.loadBuffer()` → `localStorage.getItem`) — if `Loops.jsx` instantiates TelemetryService at module level in a sandboxed iframe context, it will crash. **TelemetryService must not be imported by Loops.jsx.** | Score drops: `Loops.jsx` doesn't exist yet so its scope is not fully bounded. Risk of discovering that `LoopPreview` component has undocumented required props that cause a runtime error on first render. |
| 9.6 — Wire TelemetryService into Player | 80% | **55%** | **Major finding:** `TelemetryService.js` uses `localStorage` in its constructor on every instantiation (`loadBuffer()` calls `localStorage.getItem`). The sprint9 spec assumed a `fireImpression()` method exists — **it does not**. The service exports `telemetryService` (named singleton) with a `trackImpression(impression)` method, **not** `fireImpression`. The method is `trackImpression`. Additionally, the service buffers impressions locally and only POSTs to `/api/telemetry/upload-url` (GCS signed-URL batch) — it does NOT call `POST /api/telemetry/impression` directly. The Sprint 9 verification steps (`POST /impression → HTTP 201`) describe a different architecture than what is implemented. | Score drops to 55%: the verification steps and method name in sprint9.md are wrong. Task must be respecified before implementation begins. See revised spec below. |

---

## Eliminated Uncertainties

### Task 9.1 — `data-testid` IDs are safe to interpolate
**Uncertainty:** Would `c.id` ever be `undefined`?  
**Resolution:** `campaigns.js` `POST /` generates `id = 'cmp_${Date.now()}'` and passes it to `campaignRepository.create(id, campaignData)`. Firestore documents keyed by this ID. `GET /` returns documents including their ID. The field name used in `CampaignApprovalList.jsx` is `c.id` — consistent with the Firestore document key. Safe.

### Task 9.2 — `authenticate` will not break existing client calls
**Uncertainty (from sprint9.md):** "If `ApiService.js` calls are made without auth token they'll 401."  
**Resolution:** `api.js` (SHA `021b297`) seeds `auth_token = 'demo-token'` and `demo_role = 'admin'` on every DEV page load. Every request from the client already sends `Authorization: Bearer demo-token` + `x-demo-role: admin`. `auth.js` accepts `Bearer demo-token` whenever `NODE_ENV !== production`. **No client-side token change is needed for Task 9.2.** Brand Wizard, CampaignApprovalList, and RetailerDashboard will all continue to work.

### Task 9.3 — `express-rate-limit` does not need installation
**Uncertainty:** "may not be installed."  
**Resolution:** `ad-server/package.json` SHA `ea2c192` lists `"express-rate-limit": "^7.2.0"` in `dependencies`. Already installed.

**Additional finding:** `rateLimiter.js` exports `rateLimiter` (named), not `impressionLimiter`. The sprint9 spec's import line `import { impressionLimiter } from '../middleware/rateLimiter.js'` will fail with `undefined`. The stub must be **replaced** (not augmented) and the new exports must be named `impressionLimiter` and `defaultLimiter`. The old `rateLimiter` export should be kept as an alias or removed — verify no other file imports it first:

```bash
grep -rn "rateLimiter" ad-server/src/ --include="*.js"
```

### Task 9.6 — `fireImpression` does not exist; architecture mismatch confirmed
**Uncertainty (from sprint9.md):** "Player.jsx may already have a custom impression mechanism."  
**Resolution (now a blocking respec):** The actual export is `telemetryService.trackImpression(impression)`. The batch-upload architecture means impressions are buffered to `localStorage` and flushed to GCS via signed URL — they never hit `POST /api/telemetry/impression`. The sprint9 verification step (`POST /impression → HTTP 201`) tests a **different endpoint** than what `TelemetryService` calls. The two must be reconciled:

**Option A (preferred for Sprint 9):** Wire `telemetryService.trackImpression()` into `Player.jsx`. Verify via `window.softomedia_telemetry.buffer` in DevTools, not via Network POST. Keep `POST /api/telemetry/impression` as a separate direct-fire path (Sprint 8 implementation) for real-time counting.

**Option B:** Rewrite `TelemetryService.trackImpression` to immediately POST to `/api/telemetry/impression` (abandoning the buffer-and-batch architecture). This is a larger scope change — not suitable for a single sprint task.

**Recommendation:** Split into two sub-tasks: (a) wire `trackImpression` in Player with buffer verification, (b) reconcile direct-vs-batch telemetry architectures in a dedicated spike.

---

## Revised Task Details (Changed Tasks Only)

---

### Task 9.1 (Revised) — `data-testid` on `CampaignApprovalList`

**Environment:** DEV (`NODE_ENV=development`, `ALLOW_DEMO_MODE=true`). No prod concern.

**Pre-checks (updated):**
```bash
# Confirm zero existing data-testid
grep -c "data-testid" client-app/src/components/CampaignApprovalList.jsx
# Expected: 0

# Confirm c.id is the correct field (not c.campaign_id or c._id)
grep -n "c\.id\b" client-app/src/components/CampaignApprovalList.jsx
# Expected: lines for key={c.id}, filter(c => c.id !== id)

# Confirm StatusBadge renders inside campaign row
grep -n "StatusBadge" client-app/src/components/CampaignApprovalList.jsx
# Expected: 1 line inside the .map() block
```

**Falsifiable ACs:**
1. `GET http://localhost:8080/api/campaigns?status=pending_approval` → HTTP 200, array (may be empty in seeded dev; seed a record if empty before testing).
2. `document.querySelector('[data-testid="campaign-approval-list"]') !== null` — DevTools console.
3. `document.querySelector('[data-testid="approval-queue-count"]').textContent` equals the count shown in the heading badge.
4. With ≥1 pending campaign: `document.querySelector('[data-testid^="approve-btn-"]') !== null`.
5. Clicking `[data-testid="approve-btn-cmp_XXX"]` → Network shows `PATCH /api/campaigns/cmp_XXX/status` with body `{"status":"approved"}` → HTTP 200 → row disappears from DOM without page reload.
6. `document.querySelector('[data-testid="campaign-status-cmp_XXX"]').textContent.trim()` before approval = `"pending_approval"` (or whatever text StatusBadge renders).

**Updated probability: 98%**  
The campaign `id` field is confirmed stable (`cmp_${Date.now()}` prefix). The only residual risk is an empty Firestore collection in dev — mitigated by seeding one record before testing.

---

### Task 9.2 (Revised) — Auth split + DELETE guard

**Environment:**
- DEV: `ALLOW_DEMO_MODE=true` (or `NODE_ENV=development`) — demo bypass active. `Bearer demo-token` accepted by `authenticate`.
- PROD: `ALLOW_DEMO_MODE` unset, `NODE_ENV=production` — real JWT required.

**Critical pre-check (new — run before any code change):**
```bash
# Confirm no other server file imports from campaigns.js as named export
grep -rn "from.*campaigns" ad-server/src/ --include="*.js"
# Expected: only ad-server/src/api/index.js — default import only

# Confirm authenticate export name is exactly 'authenticate'
grep -n "^export const authenticate" ad-server/src/middleware/auth.js
# Expected: line 1 of exports

# Confirm auth.js 401 vs 403 behaviour:
# Missing header → 401 (line: "Authorization header required")
# Invalid/expired JWT → 403 (line: "Invalid or expired token")
# This affects verification curl commands below.
```

**Falsifiable ACs:**
1. `curl http://localhost:8080/api/campaigns` (no header) → HTTP 200 (public GET preserved).
2. `curl -X POST http://localhost:8080/api/campaigns -H "Content-Type: application/json" -d '{"name":"t"}'` (no `Authorization` header) → HTTP **401** (`{"error":"Authorization header required"}`).
3. `curl -X PATCH .../status -H "Authorization: Bearer demo-token" -H "x-demo-role: brand" -H "Content-Type: application/json" -d '{"status":"approved"}'` → HTTP **403** (`{"error":"Forbidden","required":"retaileradmin","actual":"brand"}`).
4. `curl -X PATCH .../status -H "Authorization: Bearer demo-token" -H "x-demo-role: retaileradmin" ...` → HTTP **200** with `{"status":"approved"}` in body.
5. `curl -X DELETE .../cmp_123 -H "Authorization: Bearer demo-token" -H "x-demo-role: retaileradmin"` → HTTP **403** (requires `admin`).
6. `curl -X DELETE .../cmp_123 -H "Authorization: Bearer demo-token" -H "x-demo-role: admin"` → HTTP **204**.
7. Existing client flows (BrandCampaignWizard `createCampaign`, RetailerDashboard `getCampaigns`, CampaignApprovalList `updateCampaignStatus`) all continue to work in dev without any client-side changes — confirmed by the fact that `api.js` already sends `Bearer demo-token` on every request.

**Updated probability: 82%** (down 3 points)  
Confirmed the client already sends auth tokens so the blast-radius risk from sprint9.md is eliminated — raising base confidence. However the export refactor (splitting `campaigns.js` into two routers) is non-trivial and introduces a merge-complexity risk: if `campaigns.js` is touched by another PR between spec and implementation, the dual-export pattern could conflict. Scheduling this task first in the sprint mitigates that.

---

### Task 9.3 (Revised) — Rate limiter

**Environment:** All environments. `express-rate-limit` is already installed.

**Pre-checks (updated):**
```bash
# Confirm current stub export name (will be replaced)
grep -n "export" ad-server/src/middleware/rateLimiter.js
# Expected: export const rateLimiter = ...

# Confirm nothing else imports the old 'rateLimiter' name
grep -rn "rateLimiter\b" ad-server/src/ --include="*.js"
# If any file imports it, add a backwards-compat re-export: export { impressionLimiter as rateLimiter }

# Confirm express-rate-limit version supports v7 import syntax
grep "express-rate-limit" ad-server/package.json
# Expected: "express-rate-limit": "^7.2.0" ✓
```

**Falsifiable ACs:**
1. `ad-server/src/middleware/rateLimiter.js` exports `impressionLimiter` (named) — confirmed with `grep "export.*impressionLimiter" ad-server/src/middleware/rateLimiter.js`.
2. `ad-server/src/api/telemetry.js` line for `POST /impression` includes `impressionLimiter` as middleware argument.
3. Shell test: 61 sequential `curl -s -o /dev/null -w "%{http_code}\n"` calls to `POST /api/telemetry/impression` — the **61st response** is `429`. (Requests 1–60 are `201`.)
4. Response body of 429: `{"error":"Too many impression events. Retry after 60 seconds."}`.
5. `GET /api/telemetry/upload-url` (different endpoint) returns HTTP 200 after the 429 — rate limit is route-scoped, not global.
6. After 60 seconds, `POST /api/telemetry/impression` returns 201 again (window resets).

**Note on `api.js` retry behavior:** The browser client auto-retries 429 responses up to 3 times (`retryOn: [429]`). Browser-side E2E tests will see the client absorb the first 429 and retry — the 4th request in a series that has hit the limit will still 429 (server-side count doesn't reset). This does not affect shell-based curl verification.

**Updated probability: 97%** (up 7 points)  
`express-rate-limit` is already installed. Only risk is whether another file imports the old `rateLimiter` named export — pre-check grep eliminates this before writing code.

---

### Task 9.4 (Revised) — Fix RetailerDashboard links

No changes to spec. Probability unchanged: **99%**.

---

### Task 9.5 (Revised) — Create `Loops.jsx` + register in `App.jsx`

**Environment:** DEV. Auth token already sent by `api.js` — `GET /api/loops` will pass `authenticate`.

**Critical constraint discovered:**  
`TelemetryService.js` uses `localStorage` in its constructor. **Do not import `TelemetryService` in `Loops.jsx`** — it is not needed and would fail in sandboxed iframe environments.

**Pre-checks (updated):**
```bash
# Confirm Loops.jsx does not exist
ls client-app/src/pages/retailer/Loops.jsx 2>&1
# Expected: "No such file or directory"

# Confirm LoopPreview props interface
grep -n "props\|function LoopPreview\|const LoopPreview\|PropTypes" client-app/src/components/LoopPreview.jsx | head -20

# Confirm getLoops return shape (look at what RetailerDashboard does with it)
grep -A5 "getLoops" client-app/src/pages/retailer/RetailerDashboard.jsx
# RetailerDashboard uses loops.filter(...) — confirms array return ✓

# Confirm App.jsx retailer route group path prefix
grep -n "retailer\|path=\"retailer" client-app/src/App.jsx | head -20
```

**Falsifiable ACs:**
1. `ls client-app/src/pages/retailer/Loops.jsx` exits 0.
2. `grep "RetailerLoops" client-app/src/App.jsx` returns exactly 2 lines (lazy import + Route element).
3. `grep "Loops.jsx.*✅" client-app/src/App.jsx` — comment block updated.
4. Navigate to `/dashboard/retailer/loops` in dev → component renders, heading visible, NOT the `NotFound` component.
5. Hard-refresh at `/dashboard/retailer/loops` → Suspense fallback briefly renders then Loops page appears (no white screen, no console error).
6. `document.querySelector('[data-testid="retailer-loops-page"]') !== null`.
7. `GET http://localhost:8080/api/loops` with `Authorization: Bearer demo-token` → HTTP 200, response is array.

**Updated probability: 72%** (down 3 points)  
Auth is confirmed non-blocking. Score stays below 80% because `LoopPreview`'s required props are unknown until a live code read — a missing required prop causes a React render error on first real data. Pre-check grep on LoopPreview's props before writing the page eliminates this risk at implementation time.

---

### Task 9.6 (Revised) — Wire TelemetryService into Player

**⚠️ Major respec required — sprint9.md verification steps describe wrong endpoint.**

**What `TelemetryService.js` actually does:**
- Exports named singleton `telemetryService` (not a default export, not a class).
- Method is `trackImpression(impression)` — **not** `fireImpression`.
- Buffers impressions to `localStorage` under key `softomedia_impression_buffer`.
- Flushes to GCS via `GET /api/telemetry/upload-url` → `PUT <signedUrl>` when buffer ≥ 50 or every 60 minutes.
- Does **not** call `POST /api/telemetry/impression` at all.
- Exposes `window.softomedia_telemetry` in test/debug mode for SRE inspection.

**Import pattern:**
```js
// CORRECT:
import { telemetryService } from '../services/TelemetryService';

// WRONG (from sprint9.md):
import TelemetryService from '../services/TelemetryService';  // no default export
```

**Pre-checks (required before touching Player.jsx):**
```bash
# Confirm Player.jsx does not already call trackImpression or telemetryService
grep -n "trackImpression\|telemetryService\|TelemetryService\|impression" client-app/src/pages/Player.jsx

# Confirm Player.jsx exposes screenId and current ad object
grep -n "screenId\|currentAd\|campaign_id\|adSlot" client-app/src/pages/Player.jsx | head -20

# Confirm TelemetryService export type
grep -n "^export" client-app/src/services/TelemetryService.js
# Expected: export const telemetryService = new TelemetryService(); (named, not default)
```

**Revised implementation:**
```js
// In Player.jsx — at top:
import { telemetryService } from '../services/TelemetryService';

// Inside the ad-play handler (exact function name TBD by grep above):
try {
    telemetryService.trackImpression({
        screen_id: screenId,
        campaign_id: currentAd.campaign_id,
        asset_id: currentAd.asset_id || null,
        loop_id: currentAd.loop_id || null,
    });
} catch (e) {
    // Telemetry must never interrupt playback
    console.warn('[Telemetry] trackImpression failed silently', e);
}
```

**Falsifiable ACs (revised — buffer-based, not HTTP-based):**
1. `grep "telemetryService.trackImpression" client-app/src/pages/Player.jsx` returns exactly 1 line.
2. Navigate to `/player/demo?debug=true` → `window.softomedia_telemetry` is defined in DevTools console.
3. Play one ad → `window.softomedia_telemetry.buffer.length === 1`.
4. Play a second ad → `window.softomedia_telemetry.buffer.length === 2`.
5. Each buffer entry contains fields: `screen_id`, `campaign_id`, `timestamp` (ISO string), `uuid` (UUID v4 pattern).
6. Two consecutive impressions produce distinct `uuid` values.
7. `JSON.parse(localStorage.getItem('softomedia_impression_buffer')).length >= 1` after first play (persistence check — hard-refresh and verify buffer survived).
8. A thrown error inside `trackImpression` does not pause, skip, or crash the ad playback (verify by mocking `telemetryService.trackImpression = () => { throw new Error('test') }` in DevTools and confirming player continues).

**⚠️ Note on `POST /api/telemetry/impression`:** Sprint 8 wired `POST /impression` as a direct-fire endpoint (Task S8-7). This endpoint and `TelemetryService`'s batch-upload mechanism are **parallel, non-conflicting paths**. They do not need to be reconciled in Sprint 9. The direct-fire endpoint remains usable by other callers (e.g., screen-side player in future).

**Updated probability: 55%** (down 25 points)  
The method name and export type were wrong in the spec. Once the pre-check grep confirms the Player's ad-play handler name and that no existing impression call exists, the implementation is straightforward — but that grep is mandatory before writing a single line. Score would rise to ~85% after a successful pre-check run. Keeping at 55% until pre-checks are completed.

---

## Tasks That Cannot Reasonably Exceed ~90%

**Task 9.2 (82%):** Depends on the dual-export refactor of `campaigns.js` not conflicting with any concurrent PR. If the repo is active during the sprint, another author could touch `campaigns.js` between spec-write and implementation. Coordinate with the team to freeze `campaigns.js` during this task window.

**Task 9.5 (72%):** `LoopPreview.jsx`'s required props are not yet read. If it requires a prop that has no sensible default (e.g., a required `storeId`), the page will error on render. The pre-check grep on `LoopPreview` is mandatory — if it reveals complex required props, the page scaffold complexity increases and this task should be time-boxed to 3h with a fallback to a simpler list view.

**Task 9.6 (55%):** Cannot exceed ~80% until the Player.jsx grep is completed and confirms the ad-play handler name. The `localStorage` usage in `TelemetryService`'s constructor also means the service will silently fail in any sandboxed iframe context — verify `/player/demo` is not sandboxed before starting this task.

---

## Guardrail Additions (from this audit)

> Append to the Four SRE/QA Guardrails block in sprint9.md and all future sprint docs.

**Guardrail 5 — Verify Export Type Before Importing**  
Before any task references a service import, confirm: (a) is it a default export or named export? (b) does the method you intend to call actually exist? Run `grep -n "^export" <file>` and `grep -n "methodName" <file>` as part of pre-checks. A wrong import type is a silent runtime `undefined` that no TypeScript error catches in a `.jsx` file.

**Guardrail 6 — `localStorage` Is Banned in Sandboxed Contexts**  
Any service that calls `localStorage` in its constructor (like `TelemetryService`) must not be imported at module level in pages that may run in sandboxed iframes. Verify the deployment context before importing. Add a try/catch around all `localStorage` accesses in service constructors.
