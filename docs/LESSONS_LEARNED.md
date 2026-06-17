# Lessons Learned

A living document capturing post-incident analysis, root causes, and actionable improvements discovered during development and operation of the Softomedia platform. Entries are added after every significant bug fix, incident, or architectural decision. Most recent entries appear first.

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
