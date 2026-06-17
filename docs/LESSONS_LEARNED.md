# Lessons Learned

A living document capturing post-incident analysis, root causes, and actionable improvements discovered during development and operation of the Softomedia platform. Entries are added after every significant bug fix, incident, or architectural decision. Most recent entries appear first.

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
