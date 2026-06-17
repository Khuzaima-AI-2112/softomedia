# Lessons Learned

A living document capturing post-incident analysis, root causes, and actionable improvements discovered during development and operation of the Softomedia platform. Entries are added after every significant bug fix, incident, or architectural decision. Most recent entries appear first.

---

## 2026-06-17 — Campaign Approve/Reject 403: Missing `authenticate` on `PATCH /campaigns/:id/status`

**Severity:** High — No user, including SuperAdmin, could approve or reject campaigns. Every click of the Approve or Reject button on the Campaigns page returned `403 Forbidden`.

**Symptom:** Console showed two identical errors on each button click:
```
PATCH https://ad-server-.../api/campaigns/cmp_1781649587645/status  403 (Forbidden)
PATCH https://ad-server-.../api/campaigns/cmp_1781649587645/status  403 (Forbidden)
```
The UI displayed a red "Forbidden" banner. All other campaign operations (list, create, delete) worked normally.

### What Happened

`PATCH /:id/status` in `campaigns.js` had `requireRole('retaileradmin')` applied but was **missing the `authenticate` middleware** that precedes it on every other protected route in the same file. Without `authenticate` running first, `req.user` is never populated. `requireRole` reads `ROLE_HIERARCHY[req.user?.role]`, which evaluates to `ROLE_HIERARCHY[undefined]` → `undefined` → `-1` via the nullish coalescing fallback. A level of `-1` is below every defined role, so the middleware rejected every caller unconditionally.

This meant the route was effectively locked to everyone — not just low-privilege users.

### Root Causes

1. **`authenticate` middleware omitted from `PATCH /:id/status`** — Every other write route in `campaigns.js` (`POST /`, `POST /:id/book`, `DELETE /:id`) correctly chains `authenticate, requireRole(...)`. The status patch route was added in Sprint 8 without following this pattern.
2. **`requireRole` does not assert that `req.user` is populated** — If `requireRole` were to check for the presence of `req.user` first and return `401 Unauthorized` (rather than `403 Forbidden`) when it is absent, the error would have been immediately distinguishable from a privilege issue.
3. **No integration test for the approve/reject flow under any role** — A single test calling `PATCH /api/campaigns/:id/status` with a valid SuperAdmin JWT would have caught this at the PR stage.
4. **`403` surface message gave no hint of missing auth** — The response body `{ error: 'Forbidden' }` looks identical whether the user is authenticated-but-insufficient or unauthenticated-entirely. This slowed diagnosis.

### Fix Applied

| File | Change |
|---|---|
| `ad-server/src/api/campaigns.js` | Added `authenticate` middleware before `requireRole('retaileradmin')` on `PATCH /:id/status` |

**Before:**
```js
router.patch('/:id/status', requireRole('retaileradmin'), async (req, res) => {
```

**After:**
```js
router.patch('/:id/status', authenticate, requireRole('retaileradmin'), async (req, res) => {
```

### Actionable Improvements Going Forward

- **`authenticate` and `requireRole` are an inseparable pair.** `requireRole` is meaningless without `authenticate` — it will always resolve to `-1` and block everyone. Treat any route that has `requireRole` but not `authenticate` as a bug. Consider combining them into a single middleware factory (`requireAuth('retaileradmin')`) so they cannot be separated accidentally.
- **`requireRole` should return `401` not `403` when `req.user` is absent.** `403 Forbidden` implies the caller is known but lacks permission. `401 Unauthorized` signals that authentication is required. Distinguishing these two cases in the middleware makes diagnosis immediate.
- **Audit all routes for the `authenticate` + `requireRole` pairing.** Run a grep across all route files for `requireRole` without a preceding `authenticate` on the same `router.*` call. This is a mechanical check that can be added to CI.
- **Add a smoke test for every status-transition action under each authorised role.** At minimum: SuperAdmin can approve, Admin can approve, retaileradmin can approve, advertiser cannot approve (403). This matrix would have caught this bug before deploy.
- **When adding a new protected route, use an existing route in the same file as a template.** `DELETE /:id` in this file correctly uses `authenticate, requireRole('superadmin')` — copying that pattern for the new route would have avoided the omission.

---

## 2026-06-17 — Campaign Wizard 403: `brand` Role Missing from `ROLE_HIERARCHY`

**Severity:** High — Brand users (and any user whose JWT carried the `brand` role) could not create campaigns. The campaign wizard's Location step failed immediately on load with `403 Forbidden` on `GET /api/screens`, showing "No stores found" and blocking progression through all subsequent steps.

**Symptom:** Opening `/dashboard/brand/campaign/new` as a Brand user produced:
```
[Diagnostic] Wizard Step: 1 → { stores: 0, screens: 0, hasName: false }
[Diagnostic] Failed to load wizard data: APIError: Forbidden
GET https://ad-server-.../api/screens  403 (Forbidden)
```
The same behaviour was observed when logged in as SuperAdmin if the active JWT contained `role: brand`.

### What Happened

`requireRole.js` defines `ROLE_HIERARCHY` — a lookup table mapping role name strings to numeric access levels. The `GET /api/screens` handler in `screens.js` reads this table to determine visibility:
- Level ≥ 2 (techoperator and above): full unfiltered screen list
- Level 1 (retaileradmin): filtered to their linked `retailer_id`
- Anything else: `403 Forbidden`

The `brand` role was **never added** to `ROLE_HIERARCHY`. This meant `ROLE_HIERARCHY['brand']` resolved to `undefined`, which the nullish coalescing fallback (`?? -1`) converted to `-1`. A level of `-1` is lower than every defined role including `advertiser` (level 0), so brand users hit the final `403` branch on every protected route — not just `GET /api/screens`.

This affected the entire platform for brand users: any endpoint using `requireRole()` middleware or manual `ROLE_HIERARCHY` level checks silently rejected them.

### Root Causes

1. **`brand` role never added to `ROLE_HIERARCHY`** — The role was implemented in the auth layer and assigned to users in Firestore, but the corresponding entry in `requireRole.js` was never created. Role strings that are absent from the hierarchy resolve to `-1` and are blocked everywhere.
2. **No startup or test validation of role coverage** — There is no test or assertion that verifies every role issued by the auth system exists in `ROLE_HIERARCHY`. A new role can be added to the user model without triggering any warning that it is unregistered in the access control table.
3. **403 message was generic** — The error returned `{ required: 'techoperator', actual: 'brand' }`. While technically correct, it did not hint that `brand` was an unrecognised/unregistered role — it looked like an intentional access restriction, making diagnosis slower.
4. **No end-to-end test covering brand campaign creation** — The campaign wizard flow lacked a test that exercised `GET /api/screens` under a `brand` JWT. If it had existed, this would have been caught before deploy.

### Fixes Applied

| File | Change |
|---|---|
| `ad-server/src/middleware/requireRole.js` | Added `brand: 1` to `ROLE_HIERARCHY` (same tier as `retaileradmin`) |
| `ad-server/src/api/screens.js` | Added explicit `brand` branch in `GET /api/screens` — brand users receive the full screen list so the campaign wizard can display available inventory |

**`requireRole.js` before:**
```js
export const ROLE_HIERARCHY = {
    superadmin:     5,
    admin:          4,
    contentmanager: 3,
    techoperator:   2,
    retaileradmin:  1,
    advertiser:     0,
    // brand was absent — resolved to -1
};
```

**`requireRole.js` after:**
```js
export const ROLE_HIERARCHY = {
    superadmin:     5,
    admin:          4,
    contentmanager: 3,
    techoperator:   2,
    retaileradmin:  1,
    brand:          1,   // fix: brand was missing — level 1 (same tier as retaileradmin)
    advertiser:     0,
};
```

**`screens.js` addition inside `GET /api/screens`:**
```js
if (role === 'brand') {
    // brand — sees all screens so campaign wizard can show available inventory
    const storeId = req.query.store_id || req.query.storeId || req.query.storeid;
    const screens = storeId
        ? await screenRepository.findByLocation(storeId)
        : await screenRepository.findAll();
    return res.json(screens);
}
```

### Actionable Improvements Going Forward

- **`ROLE_HIERARCHY` is the single source of truth — every role string issued by auth must exist in it.** Treat any role absent from the hierarchy as a misconfiguration, not a silent fallback to `-1`. Consider adding an assertion at server startup that validates all known roles are registered.
- **Add a test for every role × every protected endpoint.** At minimum, a smoke test that exercises each role against each route category (read, write, admin) will catch missing role registrations immediately.
- **Make unregistered roles distinguishable from insufficient-privilege roles.** When `ROLE_HIERARCHY[role]` is `undefined`, return a different error or log message (e.g., `unregistered_role`) so that diagnosis is immediate rather than requiring a code search.
- **When adding a new role anywhere in the system** (user model, JWT, UI role picker), open a corresponding PR that also adds it to `ROLE_HIERARCHY` with its level. Treat these as an atomic pair — one without the other is incomplete.
- **Review all other route handlers for similar level-based checks.** Any handler that manually reads `ROLE_HIERARCHY[role]` (rather than using `requireRole()` middleware) is a potential site for the same bug — the brand fix in `screens.js` is one such case and should be the pattern to follow.

---

## 2026-06-17 — Entity Persistence Loss: Firestore Silent Mock-Mode Fallback

**Severity:** Critical — All entities created by users (stores, retailers, campaigns, screens, users, schedules) appeared to persist during a session but vanished hours later after any process restart or Cloud Run scale-to-zero event.

**Symptom:** Users created entities successfully (API returned 200, UI reflected the new record). Upon revisiting the app hours later, all created entities were gone. No errors were shown to users at any point.

### What Happened

`firestore.js` passes `keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS` to the Firestore constructor. On Cloud Run with Workload Identity Federation (WIF), this env var is intentionally absent — authentication happens automatically via the attached service account. However, passing `keyFilename: undefined` to the `@google-cloud/firestore` constructor causes it to **throw an exception** rather than fall back gracefully.

The `try/catch` block in `getFirestore()` caught this throw and silently set `useMock = true`, returning `null` instead of a real `db`. From that point forward, `BaseRepository` detected `this.collection === null` and routed **all reads and writes to `MOCK_STORAGE`** — a plain in-memory `Map()` scoped to the Node.js process lifetime.

Everything appeared to work: creates returned 200, lists returned data, updates succeeded. But none of it ever touched Firestore. On the next Cloud Run instance restart, scale-to-zero, or deploy, the process memory was wiped and all data was lost.

### Root Causes

1. **`keyFilename: undefined` throws on `@google-cloud/firestore`** — The SDK does not treat `undefined` as "no key file"; it attempts to use it and fails. On Cloud Run with WIF, the correct behaviour is to omit `keyFilename` entirely, allowing the SDK to use Application Default Credentials via the metadata server.
2. **Silent catch → mock mode with no production alarm** — The catch block logged an error but set `useMock = true` and returned `null`. The server continued serving requests as if nothing was wrong. There was no alert, no HTTP error, no crash — the failure was completely invisible to users and operators.
3. **`MOCK_STORAGE` designed for dev but reachable in production** — The in-memory fallback was intended for local offline testing. There was no environment guard preventing it from activating in production, so a credential misconfiguration silently promoted the dev fallback into the production data layer.
4. **No startup Firestore connectivity check** — The server started and began accepting traffic without verifying Firestore was reachable. A failed health check at startup would have prevented the mock fallback from ever serving real users.
5. **GCP credential fix applied outside the codebase** — A previous attempt to fix the credential issue was recorded only in documentation (`LESSONS_LEARNED.md`), not in code. The actual `firestore.js` source file was never changed, so the bug persisted across all subsequent deploys.

### Fixes Applied

| File | Change |
|---|---|
| `ad-server/src/utils/firestore.js` | Only include `keyFilename` in the Firestore constructor options when `GOOGLE_APPLICATION_CREDENTIALS` is explicitly set; omit the key entirely when running under WIF |

**Before:**
```js
db = new Firestore({
    projectId: projectId,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS, // passes undefined on Cloud Run WIF
    retry: { retries: 1 }
});
```

**After:**
```js
const firestoreOptions = { projectId, retry: { retries: 1 } };
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    firestoreOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
}
db = new Firestore(firestoreOptions);
```

### GCP Infrastructure Verified

During diagnosis the following was confirmed healthy — these were **not** the cause:

| Check | Result |
|---|---|
| Cloud Run service (`ad-server`) | Ready, `us-central1` |
| Service account | `524693967756-compute@developer.gserviceaccount.com` |
| IAM role | `roles/editor` (includes `roles/datastore.user`) |
| Firestore API | Enabled on `softomedia-live-2026` |
| `GOOGLE_APPLICATION_CREDENTIALS` env var | Correctly absent (WIF used instead) |

The infrastructure was correct. The bug was entirely in how the SDK was being called.

### Actionable Improvements Going Forward

- **Never pass `undefined` as an SDK option.** Conditional assignment (`if (value) { options.key = value; }`) is safer than always-present assignment (`options.key = value || undefined`). Treat all optional SDK constructor fields this way.
- **Mock/fallback mode must be opt-in and production-blocked.** Add an explicit guard: if `process.env.NODE_ENV === 'production'` and Firestore init fails, **throw** and crash the process rather than silently serving from memory. A crashed Cloud Run instance is immediately visible; a silently broken one is not.
- **Log and alert on Firestore init failure at `error` level.** The existing `logger.error(...)` call was present but the process continued. In production, a Firestore init failure should trigger an alert (Cloud Monitoring, PagerDuty, etc.) and refuse to serve traffic.
- **Verify fixes in the source file, not just in documentation.** A fix that is described in docs but not committed to code is not a fix. After any bug resolution, confirm the SHA of the affected source file has changed in the repository before closing the incident.
- **Add a Firestore connectivity probe to the `/health` or `/readiness` endpoint.** The Cloud Run service should return non-200 on `/readiness` if Firestore cannot be reached at startup. This prevents traffic from reaching an instance running in mock mode.
- **Audit all `try/catch` blocks that return `null` or a fallback silently.** Any catch block that swallows an error and continues normal operation is a potential silent failure. Each one should at minimum: log at `error` level, expose a status flag queryable from health checks, and have a documented rationale for why degraded operation is acceptable.

---

## 2026-06-17 — Circuit Breaker Tripping on Screen Registration (`POST /api/screens`)

**Severity:** High — Screen registration was completely blocked for all users after the circuit breaker opened.

**Symptom:** Three rapid-fire `500 Internal Server Error` responses on `POST /api/screens`, followed by the UI surfacing the raw internal error: `APIError: Circuit Breaker [Firestore:screens] is OPEN`.

### What Happened

The `CircuitBreaker` in `ResilienceUtility.js` tripped to `OPEN` state after 3 consecutive Firestore write failures (cold-start or transient connectivity). Once `OPEN`, every subsequent call to `BaseRepository.create()` was immediately rejected — no Firestore call was attempted. The `failureThreshold` of `3` was too aggressive for a cold-start environment where Firestore initialization can legitimately take a few extra round-trips.

Because the circuit breaker error propagated uncaught all the way to the HTTP response layer, the client received a `500` with a raw internal error message instead of a graceful degradation response.

### Root Causes

1. **`failureThreshold: 3` too low** — Three failures can occur during normal Cloud Run cold-start before Firestore is fully initialized. This is not a genuine circuit condition; it is startup jitter.
2. **No semantic error tagging on `CircuitBreaker`** — The error thrown when the breaker was `OPEN` had no `code` property, making it impossible for upstream handlers to distinguish it from a generic Firestore error.
3. **No HTTP-layer handling for circuit breaker state** — `screens.js` route handler treated all errors as generic `500s`. A circuit breaker open state should return `503 Service Unavailable` with a `Retry-After` header — the correct HTTP semantic for a temporarily unavailable upstream.
4. **UI surfaced raw internal error** — `ScreenManagement.jsx` displayed the raw `APIError` string directly to the end user, which is both confusing and exposes internal implementation details.

### Fixes Applied

| File | Change |
|---|---|
| `ad-server/src/utils/ResilienceUtility.js` | Tag CB-open errors with `err.code = 'CIRCUIT_BREAKER_OPEN'` and `err.retryAfterMs` |
| `ad-server/src/api/screens.js` | Catch `CIRCUIT_BREAKER_OPEN` code, return `503` + `Retry-After` header |
| `ad-server/src/repositories/BaseRepository.js` | Raise `failureThreshold` from `3` → `5`; reduce `resetTimeoutMs` from `60s` → `30s` |
| `client-app/src/pages/admin/ScreenManagement.jsx` | Detect `503`, show friendly "try again in N seconds" message |

### Broader Blast Radius Identified

All `BaseRepository` write operations (`create`, `update`, `upsert`) share the same circuit breaker path and would exhibit the same uncaught error behaviour if their breaker tripped. The fixes to `ResilienceUtility.js` and `BaseRepository.js` cover all collections, not just `screens`.

### Actionable Improvements Going Forward

- **Never surface raw internal errors to the UI.** All API errors should be mapped to user-friendly messages at the component level. Treat any unhandled error shape as "Something went wrong. Please try again."
- **Circuit breaker thresholds must account for cold-start.** For Cloud Run services with Firestore, start with `failureThreshold: 5` as a baseline and tune down only after observing real-world failure rates in production logs.
- **Use semantic error codes on all custom thrown errors.** Any error that may need to be handled differently by callers should carry a `code` string (e.g., `CIRCUIT_BREAKER_OPEN`, `QUOTA_EXCEEDED`, `NOT_FOUND`). This makes error handling explicit and avoids brittle string matching.
- **Return `503` (not `500`) for recoverable upstream unavailability.** A `500` signals an unexpected server error. A `503` with `Retry-After` signals a known temporary condition and allows clients (and load balancers) to back off gracefully.
- **Add a `/readiness` endpoint check** before considering a Cloud Run instance ready to serve traffic. If Firestore connectivity cannot be confirmed at startup, the instance should not receive traffic yet — preventing the cold-start failure cascade entirely.
- **Log circuit breaker state transitions** (CLOSED → OPEN → HALF-OPEN → CLOSED) at `warn` level with the collection name and failure count. This makes production incidents immediately visible in Cloud Logging without requiring a code-level debug session.

---

*Add new entries above this line, most recent first. Format: `YYYY-MM-DD — Short title`.*
