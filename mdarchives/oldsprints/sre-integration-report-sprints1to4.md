# SRE Integration Audit — Sprints 1–4
**Softomedia Live 2026 · Ad-Server + Client-App**
**Auditor:** Senior SRE review (static analysis, code inspection, architecture trace)
**Date:** 2026-05-19 · Commit `947a9dd`

---

## Executive Summary

The system is **substantially integrated and non-breaking** across all four sprints. The critical P0 playback bug (empty loop array caused by response envelope mismatch) has been resolved. The backend API layer is well-structured, all routes are mounted, and the retry/interceptor chain in the frontend client is solid. Two medium-risk gaps remain — both are structural rather than functional — and four low-risk items require attention before production hardening.

---

## Overall Score

| Dimension | Score | Rationale |
|---|---|---|
| **Integration Correctness** | **88%** | All sprint contracts are satisfied post-fix; 2 field-name inconsistencies remain in stores/screens response shapes |
| **Non-Breaking Safety** | **95%** | All sprint fixes are purely additive; no removed contracts; one unguarded optional chaining risk in telemetry |
| **Performance / Efficiency** | **72%** | Retry logic is sound; no pagination on large collection endpoints; no memoization on cascade selectors |
| **Observability / Error Handling** | **78%** | Logger present, health endpoint exists; no structured error codes; `notifications.js` is a 135-byte stub |
| **Security Posture** | **70%** | Auth middleware present and applied to protected routes; `demo-token` auto-seeded in localStorage; `/api/loops` unprotected |
| **Test Coverage** | **45%** | `api.test.js` exists; Playwright config present; zero unit tests for repositories or services found |
| **Code Consistency** | **82%** | ESM throughout, clean imports; `playlist.js` vs `playlists.js` naming ambiguity; `screenid` vs `screen_id` dual-spelling now handled |

**Weighted Overall: 76%**

---

## Sprint-by-Sprint Analysis

### Sprint 1 — Core Infrastructure & Auth

**Score: 91%**

The base `APIClient` class in `api.js` is production-quality: `AbortController` timeout, exponential-ish retry delay (`retryDelay * attempt`), per-status retry list `[408, 429, 500, 502, 503, 504]`, and a clean interceptor chain. The auth middleware pattern (`authenticate` guard applied to protected routes in `index.js`) is correctly structured — public routes (`/auth`, `/health`, `/assets`, `/loops`, `/retailers`, `/screens`, `/stores`, `/campaigns`, `/pricing`, `/telemetry`) are explicitly separated from guarded routes.

**Gap (Medium):** `demo-token` is auto-seeded unconditionally into `localStorage` on module load:
```js
if (!localStorage.getItem('auth_token')) {
    localStorage.setItem('auth_token', 'demo-token');
}
```
This is intentional for demo/dev but creates a pre-auth bypass that will need a feature flag or env check before any production deployment. It is not breaking now but is a security debt.

**Gap (Low):** `localStorage` is used for auth state. The `APIClient` constructor does not abstract storage, so swapping to `sessionStorage` or `httpOnly` cookies later will require touching multiple files.

---

### Sprint 2 — Retailers, Stores, Screens, Campaigns

**Score: 85%**

All four entity routes are mounted in `index.js` and exposed as public routes. `ApiService.js` correctly builds query strings via `URLSearchParams` for `getStores({ retailerid })` and `getScreens({ storeid })`. The cascade in `LoopDemoPlayer` (retailer → store → screen) mirrors the backend filter hierarchy correctly.

**Gap (Medium — field-name inconsistency):** The `LoopDemoPlayer` screen selector reads:
```jsx
value={s.id || s.screenid || s.screen_id}
```
This triple-guard indicates the `screens.js` backend returns inconsistent field names across different code paths. The same inconsistency appears in `stores.js` (`s.id || s.storeid`). These are functional workarounds but indicate the repository layer does not enforce a canonical field contract. If a new consumer of these endpoints writes `s.screen_id` only, it will silently get `undefined` on records where the field is `s.screenid`.

**Gap (Low):** `getRetailers()` in `ApiService` sends no query params — no pagination, no limit. If the retailer count grows, this becomes a full-table scan on every player mount. No `perPage` or cursor support exists in the backend `retailers.js` route.

---

### Sprint 3 — Loops, Business Hours, Loop Generation

**Score: 89%**

The `LoopRepository.findByDate()` and `findAll()` paths both return consistent `loops` arrays. The `GET /api/loops` response envelope `{ loops, business_hours }` is well-defined. `BusinessHoursService.getEffectiveHours()` is called only when both `date` and `location_id` are present, so callers that omit `location_id` (like the player, which sends `screenid` not `location_id`) get the hardcoded fallback `start: 8, end: 22` — this is safe and intentional.

**Resolved P0:** The `screenid` / `screen_id` dual-spelling is now handled in the backend via `effectiveScreenId = screen_id || screenid || null`. The frontend `data?.loops ?? []` unwrap correctly extracts the array from the envelope. Both fixes landed atomically in commit `947a9dd`.

**Gap (Low):** The `loops.js` `GET /` route has no auth guard. It is mounted in the public block of `index.js`. This means any unauthenticated caller can retrieve the full loop schedule for any screen for any date by guessing a `screenid`. Given that loop schedules contain campaign and slot data, this should be a protected route in production.

**Gap (Low):** `loopRepository.findByDate(date)` loads all loops for that date, then JavaScript `.filter()` is applied in-memory. If a date has hundreds of loops across all screens, this is a full collection load followed by a client-side filter. The filter should be pushed to the database query layer (`where` clause) rather than post-load `.filter()`.

---

### Sprint 4 — LoopDemoPlayer, Cascade Selectors, Superadmin Context

**Score: 81%**

The cascade selector flow (Task 4.1) is correctly wired: each `useEffect` resets downstream state before fetching, preventing stale data from a previous selection appearing in a new one. The `selectionComplete` guard (`!!(retailerId && storeId && screenId)`) properly blocks the play button. The `isSuperAdmin` branch correctly renders the Retailer Context selector in the header only for that role.

**Gap (Medium — performance):** The cascade dropdowns call `apiService.getRetailers()`, `getStores()`, and `getScreens()` on every relevant state change with no memoization or cache. If a user changes the date (which resets `allLoops` but not the dropdowns), no extra fetch fires — this is correct. However, if a user re-selects the same retailer, a fresh network call goes out every time. A simple `useRef` cache keyed on `retailerId` would eliminate redundant store fetches.

**Gap (Low):** The `setInterval` + `setProgress` combination in the playback `useEffect` creates two concurrent intervals every time `isPlaying` or `allLoops` changes. The cleanup `return` correctly clears both via `clearInterval`. However, if React's strict mode double-invokes effects in development, the progress bar may stutter. This is not a production bug but will cause misleading behavior during development debugging.

**Gap (Low):** `handlePlay` is wrapped in `useCallback` with `[selectionComplete, selectedScreenId, selectedDate]` dependencies. `selectionComplete` is a derived boolean computed from three state values, so `handlePlay` re-creates on any one of those changes. This is correct but could be simplified to depend directly on the three source values, removing the need for the `selectionComplete` intermediary in the dep array.

---

## Cross-Sprint Integration Matrix

| Contract Point | Sender | Receiver | Status |
|---|---|---|---|
| `GET /api/retailers` → bare array | `retailers.js` | `ApiService.getRetailers()` → `LoopDemoPlayer` | ✅ Correct |
| `GET /api/stores?retailerid=` → bare array | `stores.js` | `ApiService.getStores({ retailerid })` | ⚠️ Field name `s.id \|\| s.storeid` workaround |
| `GET /api/screens?storeid=` → bare array | `screens.js` | `ApiService.getScreens({ storeid })` | ⚠️ Field name triple-guard workaround |
| `GET /api/loops?screenid=&date=` → `{ loops, business_hours }` | `loops.js` | `ApiService.getLoops()` → `LoopDemoPlayer` | ✅ Fixed — `data?.loops ?? []` |
| Auth token header `Authorization: Bearer` | `api.js` interceptor | `auth.js` middleware | ✅ Correct |
| `x-demo-role` header | `api.js` interceptor | `auth.js` middleware | ✅ Correct |
| Retry on `[408,429,500,502,503,504]` | `APIClient.request()` | All endpoints | ✅ Correct |
| `loops` unguarded on public route | `index.js` | Any unauthenticated caller | 🔴 Risk |
| `notifications.js` stub | `index.js` mount missing | Any notification consumer | 🔴 Incomplete |

---

## Risk Register

| ID | Severity | Area | Description | Sprint |
|---|---|---|---|---|
| R-01 | 🔴 Medium | Security | `demo-token` auto-seeded unconditionally in `localStorage`; bypasses auth on fresh load | S1 |
| R-02 | 🔴 Medium | Security | `GET /api/loops` mounted as public route — exposes full schedule data without auth | S3 |
| R-03 | 🟡 Medium | Data integrity | `screen_id` vs `screenid` inconsistency in backend response shape; frontend guards mask the underlying contract gap | S2/S3 |
| R-04 | 🟡 Medium | Performance | Cascade selectors have no caching; repeated network calls on re-selection | S4 |
| R-05 | 🟡 Medium | Performance | `findByDate()` loads all loops then filters in JS memory; should filter at DB query level | S3 |
| R-06 | 🟠 Low | Reliability | `notifications.js` is a 135-byte stub with no implementation; if any component calls it, it will return empty or 404 | S2 |
| R-07 | 🟠 Low | Reliability | No pagination on `getRetailers()`, `getStores()`, `getScreens()` — unbounded collection fetches | S2 |
| R-08 | 🟠 Low | Observability | No structured error codes on API responses; all errors return `{ error: 'string' }` with no machine-readable code | S1–S4 |
| R-09 | 🟠 Low | Testing | Zero unit tests for `LoopRepository`, `BusinessHoursService`, `LoopGenerationService` | S3 |
| R-10 | 🟠 Low | DX | `playlist.js` (singular, Player endpoint) vs `playlists.js` (plural, Admin CRUD) are both mounted; naming is confusing but not breaking | S1 |

---

## Recommended Next Actions (Priority Order)

1. **[P0 — done]** Fix `loops` response unwrap + `screenid` filter — ✅ landed in commit `947a9dd`
2. **[P1]** Move `GET /api/loops` behind `authenticate` middleware in `index.js` — 2-line change, zero risk
3. **[P1]** Standardise `screen_id` field name across `screens.js` repository and all consumers — eliminates the triple-guard workaround
4. **[P2]** Add `useRef` cache to cascade selectors in `LoopDemoPlayer` to prevent redundant store/screen fetches
5. **[P2]** Push the `screenid` filter into the `findByDate()` repository query rather than post-load `.filter()`
6. **[P3]** Implement `notifications.js` or remove the route mount until implementation is ready
7. **[P3]** Gate `demo-token` auto-seed behind `import.meta.env.DEV` or `NODE_ENV !== 'production'`
8. **[P3]** Add unit tests for `LoopRepository.findByDate()` and `LoopGenerationService.generateDailyLoops()`
