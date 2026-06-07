# Sprint 10 — Pre-Deploy Security Gate

**Repo:** `cfroszte/softomedia-live2026`
**Sprint:** 10 of 10 (final MVP gate)
**Generated:** 2026-06-05
**Author:** Senior SRE / Sprint Master
**Source inputs:** `MVP_SPRINT_PLAN.md` (SHA: f66d51a0e92b32181b76020d1a02d96877679ae4), `BUG_FIX_LAN20260527.md` (SHA: a6efe3bc919d07ec9942357a3d0a0982499b47a9), `sprintWRAPUP.md`, `TASKS.md` (SHA: 1b11ad9fb28f62c4da8616dc95bcbe179ea232f7), `SPRINT_QA_TASKS.md` (SHA: af4a9b40730402b881834c087f9076a7bef6ab2b), live repo file listing at commit `de66cc3768676280178ad832f0a1da245ff6b5c1`

**Duration estimate:** 3 days
**Risk level:** 🔴 HIGH — this sprint gates the production deploy; nothing ships until all DoD items pass

---

## Sprint Goal

Achieve a signed-off, production-deployable build of `softomedia-live2026`. All remaining open security vulnerabilities (V1–V5), the unresolved `LoopRepository` LAN carry-over, the `APPROVED` enum mismatch, all five unguarded public routes, and the full Playwright E2E smoke suite must pass before the `cloudbuild.yaml` production step is unlocked.

---

## LAN Hotfix Impact on This Sprint

### LAN-20260527 — BaseRepository.update() Silent-Catch Fix (MERGED 2026-05-27)

**Status:** ✅ RESOLVED for `BaseRepository`, `RetailerRepository`, `AdvertiserRepository`

**Residual impact on Sprint 10:**

1. `ad-server/src/repositories/LoopRepository.js` was explicitly **NOT audited** in LAN-20260527. It must be audited in Task 10.1 before any sprint 10 security work begins — if it still uses the broken `.update()` pattern, loop approval writes are silently failing in production, which means the Campaign→Validation→Broadcast gating is functionally broken regardless of UI approval actions.
2. The same `.set({merge:true})` pattern fix (Task 1 of LAN-20260527) is the exact template for Task 10.1. No new technique is required.
3. All affected call chains from LAN-20260527 (advertiser, retailer, screen, store) are verified fixed. The `MOCK_STORAGE` dual-write is intentional for offline fallback and should not be removed.

---

## Risk Register

| ID | Description | Area | Status | Evidence |
|----|-------------|------|--------|----------|
| R1 | `Player.jsx` re-registers every hour — `currentHour` in `initializePlayer` dep array causes screen ID churn | `client-app/src/pages/Player.jsx` | **OPEN** | `MVP_SPRINT_PLAN.md` cross-sprint risk table; Sprint 7 task 7.1 never confirmed closed |
| R2 | Loop fetch returns full-day dataset filtered client-side — O(N×screens) data at 100+ screen scale | `server/routes/loops.js`, `LoopRepository.js` | **OPEN** | `MVP_SPRINT_PLAN.md` R2; Sprint 7 task 7.3 open |
| R3 | No retry in `initializePlayer` — one network blip = permanent dark screen | `client-app/src/pages/Player.jsx` | **OPEN** | `MVP_SPRINT_PLAN.md` R3; Sprint 7 task 7.2 open |
| R4 | `'APPROVED'` uppercase vs `'approved'` lowercase enum mismatch between client filter and `LoopRepository` status field | `client-app/src/pages/admin/LoopManagement.jsx`, `ad-server/src/repositories/LoopRepository.js` | **OPEN** | `MVP_SPRINT_PLAN.md` R4; `sprintWRAPUP.md` critical FIXME block |
| R5 | Bulk-approve endpoint `/api/locations/:id/loops/approve-all` unconfirmed — FIXME flag in commit, 404 not surfaced to retailer | `server/routes/loops.js` or `locations.js` | **OPEN** | `MVP_SPRINT_PLAN.md` R5 |
| R6 | `TechOpsDashboard.jsx` reads `user_id` from `localStorage` — fragile in sandboxed iframes and blocks auth in Cloud Run | `client-app/src/pages/admin/TechOpsDashboard.jsx` | **OPEN** | `MVP_SPRINT_PLAN.md` R6; Sprint 7 task V5 open |
| R7 | `PlaylistEditor.jsx` dead code — unrouted, unimported, but present on disk causing bundle confusion | `client-app/src/pages/admin/PlaylistEditor.jsx` | **OPEN** | `MVP_SPRINT_PLAN.md` R7; Sprint 7 task 7.8 open |
| R8 | `LoopRepository.js` not audited for LAN-20260527 silent-catch pattern — loop approval writes may be silently failing | `ad-server/src/repositories/LoopRepository.js` | **OPEN** | `BUG_FIX_LAN20260527.md` explicit note; no follow-up commit confirmed |
| R9 | Five route files mounted publicly in `app.js` with no auth middleware — any caller can mutate data | `ad-server/src/app.js`, `campaigns.js`, `telemetry.js`, `loops.js`, `screens.js`, `stores.js` | **OPEN** | `sprintWRAPUP.md` systemic security gap section |
| R10 | Content library shows all tenants' assets — tenant scoping not applied in `ContentLibrary.jsx` query | `client-app/src/pages/retailer/ContentLibrary.jsx` | **OPEN** | `MVP_SPRINT_PLAN.md` Sprint 9 affected routes |

---

## Security Register

| ID | Vector | File(s) | Mitigation Steps | Environments Affected |
|----|--------|---------|------------------|-----------------------|
| V1 | `PATCH /api/campaigns/:id/status` accepts `x-demo-role` header without token validation — any caller can approve/reject campaigns | `ad-server/src/routes/campaigns.js`, `ad-server/src/middleware/auth.js` (or equivalent) | (1) Move mutation verbs (PATCH, PUT, DELETE) behind `requireRole(['admin','retailer'])` middleware. (2) Replace `x-demo-role` header trust with Firebase ID token verification on mutations. (3) Public GETs may remain unauthenticated during demo phase but must be scoped by tenant. | dev, staging, production |
| V2 | `POST /api/telemetry/impression` is fully public with no rate limit — open to impression fraud | `ad-server/src/routes/telemetry.js` | (1) Add `express-rate-limit` middleware: max 120 req/min per IP on the telemetry route. (2) Require a valid `screen_id` JWT or shared secret in the request body. (3) Log rejected requests to Cloud Logging. | staging, production |
| V3 | `DELETE /api/campaigns/:id` has no role guard — any caller can delete campaigns | `ad-server/src/routes/campaigns.js` | (1) Add `requireRole(['admin'])` before the DELETE handler. (2) Add integration test: `DELETE /api/campaigns/:id` with no auth header must return `401`. (3) Confirm no frontend currently calls this endpoint without a token (grep `DELETE.*campaigns` in `client-app/src`). | dev, staging, production |
| V4 | XSS risk via `react-router` dependency — version audit required before deploy | `client-app/package.json` | (1) Run `npm audit` in `client-app/`. (2) If `react-router` < 6.22.0, upgrade to `^6.22.3`. (3) Add Content-Security-Policy header in Express middleware: `default-src 'self'; script-src 'self'; object-src 'none'`. (4) Add CSP header to `cloudbuild.yaml` deploy step environment config. | staging, production |
| V5 | `TechOpsDashboard.jsx` reads `user_id` from `localStorage` — fails silently in sandboxed Cloud Run iframes, exposes stale auth | `client-app/src/pages/admin/TechOpsDashboard.jsx` | (1) Replace `localStorage.getItem('user_id')` with `useAuth()` hook call. (2) If `useAuth` returns null, redirect to `/login` rather than rendering with null context. (3) Remove all `localStorage` reads from this component — use in-memory React context only. | staging, production |

---

## Task Map Table

| Task ID | Files Touched | Change Type | Est. Effort | Outcome Probability | Biggest Risk |
|---------|--------------|-------------|-------------|---------------------|--------------|
| 10.1 | `ad-server/src/repositories/LoopRepository.js` | Refactor (`.update()` → `.set({merge:true})`) | 30 min | 97% | Method may have custom `.update()` calls not inherited from BaseRepository |
| 10.2 | `ad-server/src/routes/campaigns.js` | Additive (auth middleware on PATCH + DELETE) | 1 hr | 90% | Existing integration tests may expect 200 on unauthenticated requests |
| 10.3 | `ad-server/src/routes/telemetry.js` | Additive (rate-limit middleware) | 45 min | 93% | Rate limit too aggressive for demo multi-screen setup |
| 10.4 | `ad-server/src/routes/campaigns.js`, `loops.js`, `screens.js`, `stores.js` | Additive (role guard on DELETE verbs) | 1.5 hr | 88% | Shared `requireRole` helper may not exist yet — may need to create |
| 10.5 | `client-app/package.json`, `ad-server/src/app.js` | Additive (CSP headers + npm audit fix) | 1 hr | 85% | Strict CSP may break CDN-loaded font or analytics script |
| 10.6 | `client-app/src/pages/admin/TechOpsDashboard.jsx` | Refactor (`localStorage` → `useAuth()`) | 45 min | 95% | `useAuth` hook shape may not expose `user_id` field directly |
| 10.7 | `ad-server/src/repositories/LoopRepository.js`, `client-app/src/pages/admin/LoopManagement.jsx` | Hotfix (enum case normalization) | 30 min | 98% | None — pure string comparison fix |
| 10.8 | `client-app/src/pages/admin/PlaylistEditor.jsx` | Deletion (dead code removal) | 15 min | 99% | Must confirm zero imports before delete (grep required) |
| 10.9 | `client-app/src/pages/Player.jsx` | Refactor (dep array fix + retry backoff) | 2 hr | 80% | Re-registration fix may change subscription timing and affect analytics |
| 10.10 | `server/routes/loops.js` | Refactor (server-side hour+status filter) | 1 hr | 87% | Changing query shape may break loop_builder.spec.js |
| 10.11 | `client-app/`, Playwright spec files | Additive (E2E smoke suite) | 3 hr | 75% | Flaky selectors on dynamic loop slot renders |
| 10.12 | `cloudbuild.yaml` | Additive (production step sign-off) | 30 min | 95% | Cloud Run service account permissions not granted for new CSP env vars |

---

## Full Task Details

---

### Task 10.1 — LoopRepository LAN-20260527 Carry-Over Audit

**Pre-checks:**
```bash
# Confirm file exists
ls ad-server/src/repositories/LoopRepository.js

# Find all .update() calls — any direct docRef.update() is the bug
grep -n "\.update(" ad-server/src/repositories/LoopRepository.js

# Confirm whether LoopRepository extends BaseRepository
grep -n "extends BaseRepository" ad-server/src/repositories/LoopRepository.js
```

**Fix instructions:**
1. Open `ad-server/src/repositories/LoopRepository.js`
2. For every method that calls `docRef.update(data)` or `this.collection.doc(id).update(data)`, replace with:
   ```js
   await this.collection.doc(id).set(data, { merge: true });
   ```
3. If the method is inherited from `BaseRepository` and uses `super.update()`, the base fix (LAN-20260527 Task 1) already covers it — no change needed. Only direct `.update()` calls inside `LoopRepository` itself need patching.
4. If `LoopRepository` has its own `updateStatus()` or `approveLoop()` method, apply the same `.set({merge:true})` pattern as `RetailerRepository.updateStatus()` in LAN-20260527 Task 2.

**Verification:**
- Approve a loop via the UI → hard refresh → loop status must remain `APPROVED` in Firestore console
- Check the `loops` Firestore collection directly: document `updated_at` timestamp must be newer than before the action
- HTTP response on `PATCH /api/loops/:id/status` must return `200` with the updated object

**Outcome probability:** 97%
**Biggest risk:** `LoopRepository` may override `update()` with custom merge logic that conflicts with `set({merge:true})` — read the full method before replacing.

---

### Task 10.2 — Protect Campaign Mutation Endpoints (V1, V3)

**Pre-checks:**
```bash
# Find all verb handlers in campaigns.js
grep -n "router\.\(patch\|put\|delete\|post\)" ad-server/src/routes/campaigns.js

# Check if requireRole middleware exists
find ad-server/src/middleware -name "*.js" | xargs grep -l "requireRole" 2>/dev/null

# Check current auth header handling
grep -n "x-demo-role\|requireRole\|req.user\|req.headers" ad-server/src/routes/campaigns.js
```

**Fix instructions:**
1. Locate the `requireRole` middleware. If it exists at `ad-server/src/middleware/auth.js` or similar, import it at the top of `campaigns.js`:
   ```js
   const { requireRole } = require('../middleware/auth');
   ```
2. If `requireRole` does not exist, create `ad-server/src/middleware/requireRole.js`:
   ```js
   module.exports = function requireRole(roles) {
     return (req, res, next) => {
       const role = req.headers['x-demo-role'];
       if (!role || !roles.includes(role)) {
         return res.status(401).json({ error: 'Unauthorized' });
       }
       next();
     };
   };
   ```
   > **Note:** This is the demo-phase auth pattern. For production, replace `x-demo-role` header check with Firebase Admin SDK `verifyIdToken()`.
3. Add middleware to the PATCH status route:
   ```js
   router.patch('/:id/status', requireRole(['admin', 'retailer']), async (req, res) => { ... });
   ```
4. Add middleware to the DELETE route:
   ```js
   router.delete('/:id', requireRole(['admin']), async (req, res) => { ... });
   ```
5. Confirm GET routes remain public (no middleware added) for backward compatibility.

**Verification:**
- `curl -X PATCH /api/campaigns/test123/status -d '{"status":"approved"}'` with no `x-demo-role` header → must return `401`
- `curl -X DELETE /api/campaigns/test123` with no header → must return `401`
- `curl -X PATCH /api/campaigns/test123/status -H "x-demo-role: retailer"` → must return `200` or `404` (not `401`)
- `GET /api/campaigns` with no header → must still return `200`

**Outcome probability:** 90%
**Biggest risk:** Existing test files (`campaign.spec.js` or equivalent) that fire mutations without an auth header will now fail — find and fix them before pushing.

---

### Task 10.3 — Rate-Limit Telemetry Endpoint (V2)

**Pre-checks:**
```bash
# Confirm telemetry route file
ls ad-server/src/routes/telemetry.js
grep -n "router\.post\|impression" ad-server/src/routes/telemetry.js

# Check if express-rate-limit is already installed
grep "express-rate-limit" ad-server/package.json
```

**Fix instructions:**
1. If `express-rate-limit` is not in `ad-server/package.json`, add it:
   ```bash
   cd ad-server && npm install express-rate-limit
   ```
2. At the top of `ad-server/src/routes/telemetry.js`:
   ```js
   const rateLimit = require('express-rate-limit');
   const impressionLimiter = rateLimit({
     windowMs: 60 * 1000,       // 1-minute window
     max: 120,                  // 2 impressions/sec per IP (60-second loop × 2 screens sharing an IP)
     standardHeaders: true,
     legacyHeaders: false,
     message: { error: 'Too many impression requests' }
   });
   ```
3. Apply to the POST route only:
   ```js
   router.post('/impression', impressionLimiter, async (req, res) => { ... });
   ```
4. Do NOT apply the rate limiter to any GET routes on the telemetry router.

**Verification:**
- Fire 130 rapid POSTs to `/api/telemetry/impression` → requests 121–130 must return `429 Too Many Requests`
- Fire 1 POST to `/api/telemetry/impression` with a valid body → must return `200`
- Wait 60 seconds → the same IP can send requests again without `429`

**Outcome probability:** 93%
**Biggest risk:** In a demo environment where multiple screens share one NAT IP (e.g., LAN demo at a trade show), `max: 120` may be too low. Increase to `max: 300` for demo events; revert to `120` before production deploy.

---

### Task 10.4 — Guard All Remaining DELETE Verbs (R9)

**Pre-checks:**
```bash
# Find all unguarded DELETE handlers across all route files
for f in ad-server/src/routes/*.js; do
  echo "=== $f ==="; grep -n "router\.delete" "$f"
done

# Confirm which routes are mounted in app.js
grep -n "app\.use\|require.*routes" ad-server/src/app.js
```

**Fix instructions:**
Apply `requireRole(['admin'])` to all DELETE verb handlers in the following files:

| File | Handler to guard |
|------|-----------------|
| `ad-server/src/routes/campaigns.js` | `router.delete('/:id', ...)` |
| `ad-server/src/routes/loops.js` | `router.delete('/:id', ...)` if present |
| `ad-server/src/routes/screens.js` | `router.delete('/:id', ...)` if present |
| `ad-server/src/routes/stores.js` | `router.delete('/:id', ...)` if present |

```js
// BEFORE
router.delete('/:id', async (req, res) => { ... });

// AFTER
router.delete('/:id', requireRole(['admin']), async (req, res) => { ... });
```

**Backward-compatibility strategy:** All DELETE routes are destructive mutations. There are no legitimate unauthenticated callers. Adding `requireRole(['admin'])` is a non-breaking change for any client that already passes the demo role header.

**Verification:**
- For each route: `curl -X DELETE /api/<resource>/fake-id` → must return `401`
- For each route: `curl -X DELETE /api/<resource>/fake-id -H "x-demo-role: admin"` → must return `200`, `404`, or `204` (not `401`)

**Outcome probability:** 88%
**Biggest risk:** A route may not import `requireRole` yet — ensure the import is added at the top of each file.

---

### Task 10.5 — CSP Headers + npm audit Fix (V4)

**Pre-checks:**
```bash
# Run npm audit in client-app
cd client-app && npm audit 2>&1 | head -60

# Check current react-router version
grep "react-router" client-app/package.json

# Check if CSP is already set in Express app
grep -rn "Content-Security-Policy\|helmet\|csp" ad-server/src/ 2>/dev/null
```

**Fix instructions:**

**Part A — npm audit:**
1. Run `npm audit fix` in `client-app/`. Do not use `--force` on first pass.
2. If `react-router` is below `6.22.0`, upgrade: `npm install react-router-dom@^6.22.3`
3. Re-run `npm audit` — any remaining HIGH or CRITICAL items must be resolved before closing this task.

**Part B — CSP headers in Express:**
1. In `ad-server/src/app.js`, after the existing middleware block and before route mounting:
   ```js
   app.use((req, res, next) => {
     res.setHeader(
       'Content-Security-Policy',
       [
         "default-src 'self'",
         "script-src 'self' 'unsafe-inline'",
         "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
         "font-src 'self' https://fonts.gstatic.com",
         "img-src 'self' data: blob:",
         "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com",
         "object-src 'none'",
         "frame-ancestors 'none'"
       ].join('; ')
     );
     res.setHeader('X-Frame-Options', 'DENY');
     res.setHeader('X-Content-Type-Options', 'nosniff');
     next();
   });
   ```
2. This must be inserted **before** `app.use('/api', ...)` route mounts.

**Verification:**
- `npm audit` in `client-app/` exits with 0 HIGH/CRITICAL findings
- `curl -I http://localhost:3001/api/campaigns` → response headers include `Content-Security-Policy`
- Load client app in browser → DevTools Console shows no CSP violation warnings on the main dashboard views

**Outcome probability:** 85%
**Biggest risk:** `connect-src` may need additional Firebase domain entries — check browser console for CSP violations after applying and adjust `connect-src` accordingly.

---

### Task 10.6 — Replace localStorage in TechOpsDashboard (V5, R6)

**Pre-checks:**
```bash
# Find all localStorage reads in TechOpsDashboard
grep -n "localStorage" client-app/src/pages/admin/TechOpsDashboard.jsx

# Confirm useAuth hook exists and its exported shape
grep -n "export\|user_id\|userId\|uid" client-app/src/context/AuthContext.jsx 2>/dev/null || \
  grep -rn "export.*useAuth" client-app/src/

# Confirm the import path for useAuth in an adjacent component
grep -n "useAuth" client-app/src/pages/admin/LoopManagement.jsx 2>/dev/null | head -5
```

**Fix instructions:**
1. Add or confirm import at top of `TechOpsDashboard.jsx`:
   ```js
   import { useAuth } from '../../context/AuthContext';
   ```
2. Inside the component function, replace:
   ```js
   // BEFORE
   const userId = localStorage.getItem('user_id');
   ```
   with:
   ```js
   // AFTER
   const { user } = useAuth();
   const userId = user?.uid ?? null;
   ```
3. Add a null guard immediately after:
   ```js
   if (!userId) {
     return <Navigate to="/login" replace />;
   }
   ```
4. Remove all remaining `localStorage.getItem` / `localStorage.setItem` calls from this file.

**Verification:**
- Load `/dashboard/admin/tech-ops` while logged in → dashboard renders correctly
- Clear browser localStorage → dashboard redirects to `/login`
- In a sandboxed iframe → no crash with `Cannot read property 'getItem' of undefined`

**Outcome probability:** 95%
**Biggest risk:** `useAuth` may expose `user.uid` (Firebase Auth UID) while the component may check for a custom `user_id` Firestore field — confirm the field name used in downstream API calls.

---

### Task 10.7 — Fix APPROVED Enum Case Mismatch (R4)

**Pre-checks:**
```bash
# Find all status string references in LoopRepository
grep -n "APPROVED\|approved\|REJECTED\|rejected\|PENDING\|pending" \
  ad-server/src/repositories/LoopRepository.js

# Find the client-side filter
grep -n "APPROVED\|approved" client-app/src/pages/admin/LoopManagement.jsx

# Check what the PATCH route writes to Firestore
grep -n "status\|APPROVED\|approved" ad-server/src/routes/loops.js
```

**Fix instructions:**
Normalize to **UPPERCASE** throughout:

1. `ad-server/src/repositories/LoopRepository.js` — any query/comparison using `'approved'` (lowercase) → `'APPROVED'`
2. `ad-server/src/routes/loops.js` — normalize incoming status at the route level:
   ```js
   const status = (req.body.status || '').toUpperCase();
   if (!['APPROVED', 'REJECTED', 'PENDING', 'DRAFT'].includes(status)) {
     return res.status(400).json({ error: 'Invalid status value' });
   }
   ```
3. `client-app/src/pages/admin/LoopManagement.jsx` — any filter checking `=== 'approved'` → `=== 'APPROVED'`

**Post-fix data migration:** Any existing Firestore documents written with lowercase `'approved'` will not match the uppercase filter. Manually uppercase affected `status` fields in the `loops` collection in Firebase Console.

**Verification:**
- Approve a loop → `LoopManagement` grid shows `APPROVED` badge without page reload
- Firestore `loops` collection shows `status: "APPROVED"` (uppercase)
- `GET /api/loops?status=APPROVED` returns the approved loop

**Outcome probability:** 98%
**Biggest risk:** None significant — pure string fix.

---

### Task 10.8 — Delete PlaylistEditor.jsx Dead Code (R7)

**Pre-checks:**
```bash
# Confirm file exists
ls -la client-app/src/pages/admin/PlaylistEditor.jsx

# CRITICAL: confirm zero imports — abort if any result returned
grep -rn "PlaylistEditor" client-app/src/
grep -rn "PlaylistEditor" client-app/src/App.jsx
```

**Fix instructions:**
1. Only proceed if grep returns **zero results**.
2. Delete:
   ```bash
   git rm client-app/src/pages/admin/PlaylistEditor.jsx
   ```
3. Run `npm run build` → must exit zero.

**Verification:**
- `npm run build` exits 0
- `grep -rn "PlaylistEditor" client-app/src/` returns empty

**Outcome probability:** 99%
**Biggest risk:** Dynamic `React.lazy(() => import('./PlaylistEditor'))` string — check `App.jsx` manually.

---

### Task 10.9 — Fix Player.jsx Re-registration + Add Retry Backoff (R1, R3)

**Pre-checks:**
```bash
grep -n "initializePlayer\|useEffect\|currentHour\|screenId" \
  client-app/src/pages/Player.jsx | head -40
grep -n "subscribe\|register\|screenId" client-app/src/pages/Player.jsx | head -20
```

**Fix instructions:**

**Part A — Dep array fix (R1):**
1. Locate the `useEffect` calling `initializePlayer`. Remove `currentHour` from the dependency array.
2. If `currentHour` is needed inside the effect for loop selection, pass it as a parameter to the loop-selection function rather than including it in the dep array.
3. Correct dep array: `[screenId]` (or `[]` if screenId is stable from props).

**Part B — Retry with exponential backoff (R3):**
```js
async function initializeWithRetry(screenId, maxAttempts = 5) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      await initializePlayer(screenId);
      return;
    } catch (err) {
      attempt++;
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // cap at 30s
      console.warn(`Player init attempt ${attempt} failed. Retrying in ${delay}ms`, err);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  console.error('Player failed to initialize after maximum attempts — showing offline fallback');
  setPlayerState('offline');
}
```
After `maxAttempts` exhausted, render the offline fallback slate.

**Verification:**
- No `initializePlayer` re-registration logs in browser console between hour boundaries
- Network offline simulation → player shows offline fallback within 60 seconds
- Network restored → player recovers without manual page reload

**Outcome probability:** 80%
**Biggest risk:** Removing `currentHour` from dep array may break hour-change loop-slot transition logic if it was intentionally included for that purpose — read full `initializePlayer` logic before editing.

---

### Task 10.10 — Server-Side Loop Fetch Scoping (R2)

**Pre-checks:**
```bash
grep -n "router\.get\|findAll\|findByHour\|status\|hour" ad-server/src/routes/loops.js | head -30
grep -n "function\|async\|findBy\|where\|hour\|status" \
  ad-server/src/repositories/LoopRepository.js | head -40
```

**Fix instructions:**
1. Update `GET /api/loops` in `ad-server/src/routes/loops.js` to accept `hour`, `status`, and `screenId` query params:
   ```js
   router.get('/', async (req, res) => {
     const { hour, status, screenId } = req.query;
     const loops = await loopRepository.findByHourAndStatus({
       hour: hour ? parseInt(hour, 10) : undefined,
       status: status || 'APPROVED',
       screenId: screenId || undefined
     });
     res.json(loops);
   });
   ```
2. Add `findByHourAndStatus()` to `LoopRepository.js`:
   ```js
   async findByHourAndStatus({ hour, status, screenId }) {
     let query = this.collection.where('status', '==', status || 'APPROVED');
     if (hour !== undefined) query = query.where('hour', '==', hour);
     if (screenId) query = query.where('screenId', '==', screenId);
     const snapshot = await query.get();
     return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
   }
   ```

**Backward-compatibility strategy:** `GET /api/loops` with no params returns all APPROVED loops — same as before. Only the filter location changes (Firestore → client). No client-side code changes required.

**Firestore index requirement:** Create a composite index for `(status, hour)` in Firebase Console before testing. Firestore will return an error with the index creation URL on first query if it does not exist.

**Verification:**
- `GET /api/loops?hour=14&status=APPROVED` returns only hour-14 APPROVED loops
- `GET /api/loops` returns all APPROVED loops — not 404, not empty
- Network tab in Player.jsx shows significantly smaller payload than the full-day dataset

**Outcome probability:** 87%
**Biggest risk:** Missing Firestore composite index — create it before testing.

---

### Task 10.11 — Playwright E2E Smoke Suite

**Pre-checks:**
```bash
ls client-app/playwright.config.js 2>/dev/null || ls playwright.config.js 2>/dev/null
find . -name "*.spec.js" -path "*/e2e/*" | head -20
cd client-app && npx playwright test --dry-run 2>&1 | head -50
```

**Required spec files** (create in `client-app/tests/e2e/` if not present):

| Spec File | Test | Pass Condition |
|-----------|------|----------------|
| `auth.spec.js` | Login as each of 5 roles | Dashboard route renders without 401 |
| `campaign_approval.spec.js` | Brand creates campaign → Retailer approves | Status becomes `APPROVED` in Firestore |
| `loop_broadcast.spec.js` | Approved loop plays in Player | No console errors, first slot renders within 3s |
| `admin_crud.spec.js` | Create advertiser → edit → soft delete | Hard refresh shows persisted state |
| `retailer_crud.spec.js` | Create store → add screen → assign loop | All three records appear in Firestore |
| `telemetry.spec.js` | Player emits impression on slot advance | `POST /api/telemetry/impression` returns 200 |
| `rate_limit.spec.js` | 130 rapid POSTs to telemetry | 121st returns 429 |
| `auth_guard.spec.js` | DELETE /api/campaigns with no header | Returns 401 |

Use `data-testid` attributes (per `SPRINT_QA_TASKS.md`) for all Player and LoopManagement assertions — not CSS selectors.

**Verification:**
- `npx playwright test` exits 0 with all 8 spec files passing
- No spec is skipped or marked `.only`

**Outcome probability:** 75%
**Biggest risk:** Flaky selectors on dynamic loop slot renders.

---

### Task 10.12 — cloudbuild.yaml Production Deploy Sign-Off

**Pre-checks:**
```bash
grep -n "step\|name\|args\|env\|_DEPLOY_REGION" cloudbuild.yaml | head -40
grep -n "waitFor\|prod\|production\|staging" cloudbuild.yaml | head -20
```

**Fix instructions:**
1. Gate the production deploy step behind the E2E suite:
   ```yaml
   - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
     id: 'deploy-production'
     entrypoint: gcloud
     args:
       - run
       - deploy
       - softomedia-live
       - --region=$_DEPLOY_REGION
       - --image=gcr.io/$PROJECT_ID/softomedia-live:$COMMIT_SHA
       - --set-env-vars=NODE_ENV=production
     waitFor: ['e2e-smoke-test']
   ```
2. Add CSP environment variable if not handled in Express middleware: `--set-env-vars=CSP_ENABLED=true`
3. Confirm Cloud Run service account has `roles/datastore.user` and `roles/firebase.sdkAdminServiceAgent` IAM roles.

**Verification:**
- Build triggered on non-`main` branch → production step skipped
- Build triggered on `main` with all steps passing → Cloud Run URL responds with `200`
- `curl -I <cloud-run-url>/api/campaigns` → response includes `Content-Security-Policy` header

**Outcome probability:** 95%
**Biggest risk:** Cloud Run service account may lack `roles/datastore.user` — verify in GCP Console before triggering the production build.

---

## Isolation & Blast Radius

| Task | Files | Change Type | Can It Break Anything Else? | Why / Mitigation |
|------|-------|-------------|----------------------------|------------------|
| 10.1 | `LoopRepository.js` | Refactor | Yes — `LoopManagement`, `Player.jsx`, approval workflow | All loop write consumers affected. Run `loop_builder.spec.js` after change before pushing. |
| 10.2 | `campaigns.js` + `requireRole` | Additive | Yes — unauthenticated mutation tests will return 401 | Fix test headers before pushing. |
| 10.3 | `telemetry.js` | Additive | Low | Only affects `POST /impression`. GET routes unaffected. |
| 10.4 | `loops.js`, `screens.js`, `stores.js`, `campaigns.js` | Additive | Yes — same as 10.2 per route | Fix test auth headers per route. |
| 10.5 | `app.js`, `package.json` | Additive | Yes — strict CSP may break CDN fonts or analytics | Start with `Report-Only` mode; validate all dashboard pages before switching to enforce mode. |
| 10.6 | `TechOpsDashboard.jsx` | Refactor | Low — standalone component | Auth context is global but read-only here. |
| 10.7 | `LoopRepository.js`, `LoopManagement.jsx`, `loops.js` | Hotfix | Yes — existing lowercase Firestore docs stop matching | Run Firestore data migration before deploying. |
| 10.8 | `PlaylistEditor.jsx` | Deletion | Low — confirmed unrouted | Verify zero imports first; abort if any dynamic import found. |
| 10.9 | `Player.jsx` | Refactor | Yes — live broadcast engine, highest blast radius | Test in isolation on a dedicated screen before deploying to all screens. |
| 10.10 | `loops.js`, `LoopRepository.js` | Refactor | Yes — changes GET /api/loops query shape | Backward-compatible by default. Firestore index required first. |
| 10.11 | Playwright spec files | Additive | No | Tests only. May surface failures in other tasks. |
| 10.12 | `cloudbuild.yaml` | Additive | Yes — gates entire production deploy | Misconfigured `waitFor` blocks all deploys. Test with dry-run first. |

---

## File Inventory (Sprint 10 Only)

| File | Operation | Linked Task(s) |
|------|-----------|----------------|
| `ad-server/src/repositories/LoopRepository.js` | Edit | 10.1, 10.7, 10.10 |
| `ad-server/src/routes/campaigns.js` | Edit | 10.2, 10.4 |
| `ad-server/src/routes/telemetry.js` | Edit | 10.3 |
| `ad-server/src/routes/loops.js` | Edit | 10.4, 10.7, 10.10 |
| `ad-server/src/routes/screens.js` | Edit | 10.4 |
| `ad-server/src/routes/stores.js` | Edit | 10.4 |
| `ad-server/src/middleware/requireRole.js` | Create (if not exists) | 10.2, 10.4 |
| `ad-server/src/app.js` | Edit | 10.5 |
| `client-app/package.json` | Edit (npm audit fix) | 10.5 |
| `client-app/src/pages/admin/TechOpsDashboard.jsx` | Edit | 10.6 |
| `client-app/src/pages/admin/LoopManagement.jsx` | Edit | 10.7 |
| `client-app/src/pages/admin/PlaylistEditor.jsx` | Delete (after grep confirms zero imports) | 10.8 |
| `client-app/src/pages/Player.jsx` | Edit | 10.9 |
| `client-app/tests/e2e/*.spec.js` | Create (8 spec files) | 10.11 |
| `cloudbuild.yaml` | Edit | 10.12 |

**Files NOT touched in Sprint 10:**
- `ad-server/src/repositories/BaseRepository.js` — LAN-20260527 already fixed
- `ad-server/src/repositories/RetailerRepository.js` — LAN-20260527 already fixed
- `ad-server/src/repositories/AdvertiserRepository.js` — LAN-20260527 already fixed
- `client-app/src/App.jsx` — route structure unchanged this sprint
- `client-app/src/context/AuthContext.jsx` — read-only reference; no edits

---

## Test Stabilization Order

Run in this exact sequence. Do not parallelize until Step 4.

**Step 1 — Repository layer (no HTTP, no browser):**
```bash
cd ad-server && npm test -- --grep "LoopRepository"
```
If this fails, loop approval is broken at persistence layer — stop and fix before proceeding.

**Step 2 — Route-level auth guards (HTTP, no browser):**
```bash
cd ad-server && npm test -- --grep "campaigns|telemetry|auth"
```
Any `200` on an unauthenticated DELETE is a test failure.

**Step 3 — Unit tests for Player and LoopManagement:**
```bash
cd client-app && npm test -- --grep "Player|LoopManagement"
```
Task 10.7 enum fix will cause any test asserting lowercase `'approved'` to fail — update those tests to uppercase.

**Step 4 — E2E smoke suite (full browser, staging environment):**
```bash
cd client-app && npx playwright test --project=chromium
```
Must run against staging Cloud Run URL — CSP headers only apply in the Express server context.

**Step 5 — Build verification:**
```bash
cd client-app && npm run build
```
Must exit 0 with no `PlaylistEditor` reference errors (Task 10.8 confirmation).

**Step 6 — cloudbuild.yaml dry run:**
```bash
gcloud builds submit --config cloudbuild.yaml --no-source --dry-run
```
Confirm production step has correct `waitFor` and no missing substitution variables.

---

## Definition of Done

- [ ] `grep -n "\.update(" ad-server/src/repositories/LoopRepository.js` returns zero direct `.update()` calls (Task 10.1)
- [ ] `curl -X PATCH /api/campaigns/test/status` with no `x-demo-role` header returns HTTP `401` (Task 10.2)
- [ ] `curl -X DELETE /api/campaigns/test` with no `x-demo-role` header returns HTTP `401` (Task 10.2, 10.4)
- [ ] `curl -X DELETE /api/loops/test` with no `x-demo-role` header returns HTTP `401` (Task 10.4)
- [ ] 130 rapid POSTs to `POST /api/telemetry/impression` — the 121st returns HTTP `429` (Task 10.3)
- [ ] `curl -I <app-url>/api/campaigns` response headers contain `Content-Security-Policy` (Task 10.5)
- [ ] `npm audit` in `client-app/` exits with zero HIGH or CRITICAL findings (Task 10.5)
- [ ] `localStorage.getItem` does not appear anywhere in `client-app/src/pages/admin/TechOpsDashboard.jsx` (Task 10.6)
- [ ] Approve a loop via UI → hard refresh → Firestore `loops` collection shows `status: "APPROVED"` (uppercase) (Task 10.7)
- [ ] `grep -rn "PlaylistEditor" client-app/src/` returns zero results (Task 10.8)
- [ ] `npm run build` in `client-app/` exits 0 (Task 10.8)
- [ ] Player.jsx browser console shows zero `initializePlayer` re-registration logs between hour boundaries (Task 10.9)
- [ ] Network offline simulation → Player renders offline fallback within 60 seconds (Task 10.9)
- [ ] `GET /api/loops?hour=14&status=APPROVED` returns only hour-14 APPROVED loops (Task 10.10)
- [ ] All 8 Playwright E2E spec files pass: `npx playwright test` exits 0 (Task 10.11)
- [ ] `cloudbuild.yaml` production step has `waitFor: ['e2e-smoke-test']` or equivalent gate (Task 10.12)
- [ ] Cloud Run staging URL responds with HTTP `200` on `/api/campaigns` after deploy (Task 10.12)
- [ ] `changelog.md` updated with Sprint 10 entries before PR merge

---

*Sprint 10 closes the MVP definition of done. No sprint 11 is planned. All post-MVP items (content library tenant scoping, advanced analytics, notification feed) are deferred to the post-launch backlog.*
