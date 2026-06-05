# Sprint 7 — Playback Gate + Resilience + Content Compliance

**Repo:** `cfroszte/softomedia-live2026`  
**Branch:** `main`  
**Generated:** 2026-06-05  
**Last updated:** 2026-06-05 (post LAN-20260527 fix + TASK_PLAN20260527 review + live-source isolation audit)  
**Duration estimate:** 3 days  
**Risk level:** 🔴 HIGH — `Player.jsx` is the live broadcast engine  
**Source audits:** `sprint7and8.md`, `sprint-7-verification.md`, `BUG_FIX_LAN20260527.md`, `TASK_PLAN20260527.md`, live file-size audit of all major components, live read of `Player.jsx` + `App.jsx` (2026-06-05)  

---

## Sprint Goal

Make the approval workflow *actually gate broadcast* (the core platform promise), harden Player against network failures, add upload-time content validation, and eliminate dead code risk. This is the first sprint that touches production broadcast path code — every task carries regression risk against the currently-passing test suite.

> **New context as of 2026-06-05:** Bug fix `LAN-20260527` has been merged. `BaseRepository.update()` was silently swallowing Firestore errors across all four management pages (Advertisers, Retailers, Screens, Stores). This is now fixed. Tasks 7.3 and 7.5 both touch data persistence paths — read `BUG_FIX_LAN20260527.md` before editing any repository layer.

---

## Isolation Verification — Live Source Audit (2026-06-05)

> This section was added after reading the actual live source of `Player.jsx` and `App.jsx` directly from the repo. Every claim below is sourced from the real file content, not assumptions or prior documentation.

### Verdict: Sprint 7 is non-blocking and fully isolated.

Every task has a confirmed blast radius that does not touch any other working route, component, or shared state. The only cross-cutting concern is documented under **One Genuine Cross-Cutting Risk** below.

---

### Route & Component Isolation (from `App.jsx` live source)

`Player.jsx` is registered at `/player` as a **standalone route with no `DashboardLayout` wrapper**:

```jsx
<Route path="/player" element={<Player />} />
```

It shares zero render tree, zero state, and zero context with any admin, brand, retailer, or tech operator page. Any change to `Player.jsx` is physically incapable of affecting any dashboard route. `Player.jsx` does **not** use `AuthContext` — it reads `screen_id` directly from `searchParams`. There is no shared state mechanism between `Player` and the dashboard.

`LoopManagement.jsx` (Task 7.6) is at `/dashboard/admin/loops` — a completely separate lazy-loaded route under the `DashboardLayout` shell. It does not import `Player.jsx` and `Player.jsx` does not import it.

---

### Per-Task Blast Radius (verified from live source)

| Task | Files Touched | Change Type | Can It Break Anything Else? |
|------|--------------|-------------|----------------------------|
| **7.1** Fix re-registration | `Player.jsx` dep array only | Surgical — removes `currentHour` from one `useEffect` dep array | ❌ No — `Player` is a standalone route; zero shared state |
| **7.2** Retry backoff | `Player.jsx` — wraps existing `try/catch` | Additive — only changes the failure path; success path untouched | ❌ No |
| **7.3** Server-side filter | `Player.jsx` fetch URL + `loops.js` query | Additive query params, backward-compatible (params are conditional) | ❌ No for frontend. Backend must apply params conditionally — see One Genuine Cross-Cutting Risk below |
| **7.4** Offline fallback | `Player.jsx` — additive state branch | Additive — new branch reached only after all retries fail; happy path untouched | ❌ No |
| **7.5** Upload validation | Unknown upload component — `onChange` guard only | Additive — adds a pre-submit check; does not modify the save path | ❌ No |
| **7.6** Status badges | `LoopManagement.jsx` only | Additive — new badge + banner render | ❌ No — separate admin route, no shared state with Player |
| **7.7** Docs | `changelog.md`, `MVP_SPRINT_PLAN.md` | Pure markdown text | ❌ No |
| **7.8** Delete `PlaylistEditor` | Delete one file | Removal | ❌ No — **confirmed** not imported anywhere in `App.jsx` (see below) |
| **V1–V5** Security | `Player.jsx`, `TechOpsDashboard.jsx` | Conditional `NODE_ENV` guards wrapping existing code | ❌ No — guards add conditions, don't change logic |

---

### Live `useEffect` Dep Arrays Confirmed in `Player.jsx`

Reading the actual file confirmed the following dep arrays are live in the codebase:

| Effect | Dep Array | Notes |
|--------|-----------|-------|
| `initializePlayer` (the re-registration bug) | `[searchParams, fetchCurrentLoop, currentHour]` | **R1 confirmed live** — `currentHour` is present and causing hourly re-registration |
| Hour-change detection | `[currentHour]` | Correct — only sets state, no registration call |
| `fetchCurrentLoop` (useCallback) | `[]` | Empty dep array — stable ref, never changes |
| Heartbeat | `[screenId]` | Isolated to heartbeat only |
| Playlist playback | `[status, playbackMode, playlist, currentAdIndex, screenId, playlistMeta]` | **Not touched by any Sprint 7 task** |
| Loop slot playback | `[status, playbackMode, currentLoop, currentSlotIndex, screenId]` | **Not touched by any Sprint 7 task** |

**Task 7.1 touches exactly one dep array** (`initializePlayer`) and **two of six total effects** (splitting into Effect A + Effect B). The playlist playback and loop slot playback effects are untouched.

---

### Two-Function Finding: `fetchCurrentLoop` vs Inline Fetch

The live source confirms that `fetchCurrentLoop` (useCallback, lines ~39–53) and the inline fetch inside `initializePlayer` (lines ~103–116) are **structurally different functions**, not copies of each other:

- `fetchCurrentLoop` calls `getCurrentHour()` fresh at each invocation (useCallback with `[]` deps)
- The inline version uses `const hour = getCurrentHour()` scoped to the `initializePlayer` block

At page load / mount time both resolve to the same value. **Effect B (the new hour-change effect from Task 7.1) must call `fetchCurrentLoop` (the useCallback), not duplicate the inline logic.** This is documented in Task 7.1 detail below and is the primary implementation risk for that task.

---

### `PlaylistEditor` Dead-Code Confirmation (Task 7.8)

`App.jsx` maintains an explicit **verified file map** in its header comment (updated 2026-06-05). `PlaylistEditor` does not appear in:
- Any `lazy(() => import(...))` declaration
- Any `<Route ... element={...}>` definition
- The verified file map in the `App.jsx` header comment

The `App.jsx` header also lists files confirmed **not on disk** (`pages/tickets/TicketDashboard.jsx`, `pages/retailer/Loops.jsx`). `PlaylistEditor` is not in that list — it exists on disk but is fully orphaned. **Deleting it has zero build impact.**

Pre-delete grep must still be run at delete time (the codebase changes between sessions):
```bash
grep -r "PlaylistEditor" client-app/src --include="*.jsx" --include="*.js"
# Expected: zero results outside the file itself
```

---

### One Genuine Cross-Cutting Risk (Task 7.3 Backend)

The **only cross-cutting concern in the entire sprint** is the `server/routes/loops.js` backend change in Task 7.3. Adding `hour` and `status` query params touches a shared API endpoint used by more than just `Player.jsx`.

**Mitigation (already specified in Task 7.3):** params must be applied **conditionally**:
```js
if (req.query.hour)   query.where('hour', req.query.hour);
if (req.query.status) query.where('status', req.query.status);
```

Any caller that hits `/api/loops?date=X` without those params must still receive the full dataset. As long as this conditional pattern is followed, no other consumer of that endpoint is affected. This is the only task touching shared backend infrastructure.

---

## Pre-Sprint SRE Risk Register

> These are **not tasks**. They are live risks that could silently invalidate sprint work if not understood first. Read before touching any file.

| ID | Severity | File | Risk | Must-Read Before |
|----|----------|------|------|------------------|
| R1 | 🔴 HIGH | `Player.jsx` L91 | `initializePlayer` re-runs on every `currentHour` change — screen re-registers every hour, causing ID churn and duplicate heartbeats. **Confirmed live in dep array `[searchParams, fetchCurrentLoop, currentHour]`** | Tasks 7.1, 7.2 |
| R2 | 🔴 HIGH | `Player.jsx` L45 | Loop fetch returns ALL loops for the day, filtered client-side. At 100+ screens polling hourly, this is N×full-dataset queries with no scope filter | Task 7.3 |
| R3 | 🔴 HIGH | `Player.jsx` L128 | `initializePlayer` has zero retry logic — one network blip on startup permanently sets `status='error'`, screen stays dark with no recovery | Task 7.2 |
| R4 | 🟡 MEDIUM | `Player.jsx` L53, `LoopRepository.js` | `'APPROVED'` string-matched client-side only — `LoopRepository` uses mixed-case status strings, mismatch silently fails | Task 7.3 |
| R5 | 🟡 MEDIUM | `ScheduleManager.jsx` | Bulk-approve calls `/api/locations/:id/loops/approve-all` — endpoint unconfirmed (FIXME in commit). 404 not surfaced to retailer | Awareness only |
| R6 | 🟡 MEDIUM | `TechOpsDashboard.jsx` | `user_id` read from `localStorage` — blocked in sandboxed iframes, fragile in production | Task V5 |
| R7 | 🟢 LOW | `PlaylistEditor.jsx` | Dead code (no route, no imports) — confirmed via live `App.jsx` read. May cause silent import-time errors in some bundlers | Task 7.8 |
| R8 | 🟡 MEDIUM | `BaseRepository.js` (RESOLVED) | ~~`update()` swallowed Firestore errors silently — all UI edits appeared to succeed but were never persisted to Firestore~~ **Fixed in LAN-20260527** | Read `BUG_FIX_LAN20260527.md` |

---

## Completed Work Merged Into This Sprint

### ✅ LAN-20260527 — BaseRepository.update() Silent-Catch Fix

**Merged:** 2026-05-27  
**Files changed:** `ad-server/src/repositories/BaseRepository.js`, `RetailerRepository.js`, `AdvertiserRepository.js`

This fix is a **prerequisite** for Sprint 7's test stabilisation. Before this merge, any integration test that called an update or toggle action would pass the UI assertion but fail the persistence assertion on re-fetch — causing cascading false negatives in `integration_gold_path.spec.js` and any spec that edits loop or screen state.

**What was fixed:**
- `BaseRepository.update()`: removed silent `catch` block; switched from Firestore `.update()` to `.set({ merge: true })` — prevents `NOT_FOUND` throws on documents that only existed in mock storage
- `RetailerRepository.softDelete()` and `updateStatus()`: same `.update()` → `.set({ merge: true })` replacement
- `AdvertiserRepository.softDelete()`: same fix (it already re-threw, but still used `.update()`)

**Impact on Sprint 7 tasks:**
- Task 7.3 (server-side loop fetch): `LoopRepository` should be audited for the same `.update()` pattern — it may have the same silent-catch bug on loop status writes
- Task 7.5 (upload validation): the upload component likely calls a `create()` or `update()` path — verify the fixed `BaseRepository` is in the call chain, not a custom Firestore write bypassing it
- `integration_gold_path.spec.js`: previously produced unknown-count failures likely caused by this bug — re-run after merge before attributing failures to Player refactor

---

## Security Vulnerabilities Addressed This Sprint

| ID | Type | Location | Description |
|----|------|----------|-------------|
| V1 | Information disclosure | `Player.jsx` debug overlay | `data-testid="ad-debug-overlay"` renders loop hour, slot position, and duration on-screen in production builds |
| V2 | Auth bypass risk | `Player.jsx` L74 | `screen_id` read from `?screen_id=` URL param with `'demo-screen-01'` fallback — any browser can register as an arbitrary screen |
| V3 | Unvalidated redirect | `Player.jsx` asset inject | `slot.url` used directly without sanitisation — compromised backend could inject `javascript:` URI |
| V5 | localStorage fragility | `TechOpsDashboard.jsx` | `user_id` from `localStorage` — blocked in sandboxed iframes, should use auth context |

---

## Task Map

| Task | Type | Files Touched | Estimated Effort | Outcome Likelihood |
|------|------|---------------|-----------------|-------------------|
| 7.1 | Bug fix | `Player.jsx` | 1–2 hrs | 🟢 85% |
| 7.2 | Resilience | `Player.jsx` | 2–3 hrs | 🟢 80% |
| 7.3 | Perf + correctness | `Player.jsx`, `server/routes/loops.js` | 2–3 hrs | 🟡 65% |
| 7.4 | Feature | `Player.jsx`, `config.js` (read-only) | 1–2 hrs | 🟢 78% |
| 7.5 | Feature | Unknown upload component (grep required) | 2–4 hrs | 🟡 60% |
| 7.6 | UX / observability | `LoopManagement.jsx`, `LoopBuilder.jsx` (or new `StatusBadge.jsx`) | 1–2 hrs | 🟢 88% |
| 7.7 | Documentation | `docs/changelog.md`, `docs/MVP_SPRINT_PLAN.md` | 30 min | 🟢 95% |
| 7.8 | Dead code removal | `PlaylistEditor.jsx` (delete) | 15 min | 🟢 92% |
| V1–V3, V5 | Security | `Player.jsx`, `TechOpsDashboard.jsx` | 1 hr | 🟢 82% |

---

## Task Detail

### Task 7.1 — Fix Player Re-Registration on Hour Change

**Type:** Bug fix (SRE R1)  
**Files edited:**
- `client-app/src/pages/Player.jsx`

**Lines of concern:**
- `useEffect` dep array: ~L91 (includes `currentHour` — **confirmed live** in dep array `[searchParams, fetchCurrentLoop, currentHour]`)
- `initializePlayer` function body: ~L91–L150
- `fetchCurrentLoop` useCallback: ~L39 (dep array `[]` — stable ref)
- Inline loop-fetch logic duplicated inside `initializePlayer`: ~L103–L116 ⚠️ **NOT identical to `fetchCurrentLoop`** — confirmed from live source

**Problem in plain terms:**  
Every time the clock ticks to a new hour, `initializePlayer` fires again. This means `POST /api/screens/register` is called 14 times per business day per screen. At 100 screens that's 1,400 unnecessary registration calls and potential screen ID churn where a screen briefly appears offline between re-registration and re-handshake.

**Exact fix:**
1. Split into **two separate `useEffect` blocks**:
   - Effect A: `initializePlayer` — dep array `[searchParams]` (runs once on mount, and only if search params change). Contains registration + first loop fetch.
   - Effect B: `switchLoop` — dep array `[currentHour]`. Calls `fetchCurrentLoop()` (the useCallback at L39, **not** the inline version at L103–L116). Calls `setCurrentLoop()` and `setCurrentSlotIndex(0)`. No registration call.
2. Add a `const hasInitialized = useRef(false)` guard at the top of Effect A to prevent double-fire in React 18 StrictMode (`useEffect` fires twice in dev).
3. **Read both `fetchCurrentLoop` (L39) and the inline version (L103–L116) before editing** — they are structurally different. Effect B must use `fetchCurrentLoop` (the useCallback), not the inline logic. This is confirmed from live source — see the Isolation Verification section above.

**Untouched effects (confirmed from live source — do not modify):**
- Heartbeat effect: `[screenId]`
- Playlist playback effect: `[status, playbackMode, playlist, currentAdIndex, screenId, playlistMeta]`
- Loop slot playback effect: `[status, playbackMode, currentLoop, currentSlotIndex, screenId]`

**Verification:** Open Network tab in DevTools. Load Player. Manually advance clock by 1 hour in dev tools or mock `currentHour`. Confirm `POST /api/screens/register` fires exactly **once** at page load and **zero times** on hour tick.

**Outcome likelihood: 🟢 85%**  
This is a clean architectural fix with a well-understood scope. The main risk is the duplicated inline fetch logic at L103–L116 — if the developer assumes `fetchCurrentLoop` and the inline version are equivalent without reading both, Effect B may behave differently to Effect A. The `hasInitialized` ref guard is also easy to forget in StrictMode. Both risks are documented and avoidable with a read-first policy.

---

### Task 7.2 — Startup Retry with Exponential Backoff

**Type:** Resilience (SRE R3)  
**Files edited:**
- `client-app/src/pages/Player.jsx`

**Problem in plain terms:**  
If the server is slow on first boot (cold start, brief outage, deployment in progress), `initializePlayer` catches the error once and sets `status='error'` permanently. The screen goes dark and stays dark until someone manually refreshes it — there is no automatic recovery.

**Exact fix:**
1. Wrap `initializePlayer`'s network calls in a retry loop: **max 5 attempts**, delays `[2000, 4000, 8000, 16000, 30000]` ms.
2. Add a `status='retrying'` state — display "Reconnecting... attempt N of 5" on-screen during retry (not a blank screen).
3. After all 5 attempts fail: attempt a **playlist-only fallback** (fetch playlist without loop context) before finally setting `status='error'`.
4. **Do NOT retry telemetry/heartbeat** — those use `sendBeacon` which is fire-and-forget by design.
5. **No external retry library** — implement inline with `setTimeout` in a loop or recursive async function. No such utility exists in this codebase.
6. **Clean up retry timeouts on unmount** via `useEffect` cleanup to prevent memory leaks if the component unmounts mid-retry cycle.

**Sequencing note:** This task must be done **after** Task 7.1 or as a single coordinated edit — both tasks modify `initializePlayer`. Doing them independently risks a merge conflict in the same function body.

**Verification:** In a test, mock `fetch` to throw `TypeError: network error` 3 times, then resolve on the 4th call. Confirm player reaches `status='playing'` on the 4th attempt without manual refresh.

**Outcome likelihood: 🟢 80%**  
Straightforward implementation with no external dependencies. Risk factors: (1) integrating with the Effect A / Effect B split from 7.1 — must be sequenced or done as one coordinated edit. (2) The retry timeout array uses `setTimeout` and must be cleaned up on unmount via `useEffect` cleanup to avoid memory leaks.

---

### Task 7.3 — Server-Side Loop Fetch Scoping

**Type:** Performance + correctness (SRE R2, R4)  
**Files edited:**
- `client-app/src/pages/Player.jsx`
- `server/routes/loops.js` *(ORM pattern unknown — read before editing)*

**⚠️ New context from LAN-20260527:** Before editing `server/routes/loops.js`, audit `LoopRepository.js` for the same silent-catch pattern that was fixed in `BaseRepository`. If `LoopRepository` overrides `update()` with its own Firestore call and a silent catch, loop status writes (e.g. marking a loop `APPROVED`) may not be persisting — this would explain any unexplained `APPROVED` filter misses that appear as R4.

**Problem in plain terms:**  
`Player.jsx` fetches `/api/loops?date=2026-06-05` — the complete set of all loops for the entire day. Each screen does this every hour. At 100 screens, that's 100 × 14 = 1,400 full-day-dataset fetches per day. The actual filter (`hour === currentHour && status === 'APPROVED'`) is applied client-side after the response arrives.

**Exact fix — frontend (`Player.jsx`):**
- Update fetch URL to: `` `/api/loops?date=${date}&hour=${currentHour}&status=APPROVED` ``
- Remove (or guard) the existing client-side filter since it is now redundant.
- Add `FIXME` comment: `// FIXME: confirm 'APPROVED' case matches LoopRepository status enum`

**Exact fix — backend (`server/routes/loops.js`):**
- **Read the file first.** It may use raw SQL, Knex, Sequelize, or Mongoose. Do not assume.
- Params must be **conditional** — backward-compatible with callers that don't send them:
  ```js
  if (req.query.hour)   query.where('hour', req.query.hour);
  if (req.query.status) query.where('status', req.query.status);
  ```
- Callers that hit `/api/loops?date=X` without `hour` or `status` must still receive the full day dataset.

**Verification:** In dev, hit `/api/loops?date=TODAY&hour=9&status=APPROVED` directly. Confirm response contains only loops for hour 9 with APPROVED status. Confirm `/api/loops?date=TODAY` (no hour/status) still returns all loops for backward compatibility.

**Outcome likelihood: 🟡 65%**  
The frontend change is straightforward. The backend change carries meaningful risk because the ORM/query pattern is unknown until the file is read. The case-sensitivity issue (R4) between `'APPROVED'` in the client and potentially `'approved'` in `LoopRepository` is not fixed by this task alone — it requires checking the actual stored values.

---

### Task 7.4 — Offline Fallback Loop

**Type:** Feature (MVP §4.5)  
**Files edited:**
- `client-app/src/pages/Player.jsx`
- `client-app/src/config.js` *(read-only — check for existing fallback URL constant before hardcoding)*

**Problem in plain terms:**  
When the network is down during Player startup (or at an hour boundary), the player currently enters `status='error'` or `status='no_content'` and goes dark. The MVP spec requires a fallback loop of static Softomedia-branded assets that plays without any network dependency.

**Exact fix:**
1. Check `config.js` first for any `FALLBACK_URL` or `DEFAULT_CONTENT` constant. **There is none** as of the last audit — do not import a non-existent constant.
2. Define at the top of `Player.jsx`:
```js
const FALLBACK_SLOTS = Array.from({ length: 12 }, (_, i) => ({
  id: `fallback-${i}`,
  url: 'data:image/svg+xml,...', // Softomedia branded placeholder SVG
  duration: 5,
  type: 'image',
}));
```
3. After all retries in `initializePlayer` are exhausted, before setting `status='error'`:
```js
setCurrentLoop({ id: 'fallback', hour: null, slots: FALLBACK_SLOTS });
setPlaybackMode('loop');
setStatus('playing');
```
4. In the Player JSX, add:
```jsx
{currentLoop?.id === 'fallback' && (
  <div data-testid="fallback-mode-banner" className="fallback-banner">
    ⚠️ Offline — playing fallback content
  </div>
)}
```
5. Heartbeat must **continue** during fallback mode — the screen is still online from the server's perspective, just showing static content.

**Verification:** Open Player in DevTools → Network tab → Block all requests. Confirm after retry cycle exhausted, fallback content plays. Confirm heartbeat POSTs continue (check Network tab). Confirm `data-testid="fallback-mode-banner"` is present in DOM.

**Outcome likelihood: 🟢 78%**  
Self-contained change. Main risk is integration with the retry logic from 7.2 — the fallback must trigger *after* all retries fail, meaning it's coupled to the retry implementation. If 7.2 is done first and uses a clean async pattern, 7.4 is straightforward.

---

### Task 7.5 — Content Spec Validation on Asset Upload

**Type:** Feature (MVP §4.4)  
**Files edited:**
- **Unknown upload component** — must be located via grep before editing
  ```
  grep -r "<input" client-app/src --include="*.jsx" -l | xargs grep -l "type=\"file\""
  ```
  Likely candidates: `AdvertiserManagement.jsx` (36,181 bytes) or `RetailerManagement.jsx` (50,256 bytes)

**⚠️ New context from LAN-20260527:** The upload component's save path goes through `BaseRepository` — the fixed version (`.set({ merge: true })`) must be in the call chain. If `AdvertiserManagement` or `RetailerManagement` uses an older direct Firestore write that bypasses `BaseRepository`, the LAN-20260527 fix does not protect it. Confirm the upload save action calls through `BaseRepository.update()` or `BaseRepository.create()`, not a raw `docRef.set()` or `docRef.update()`.

**Problem in plain terms:**  
The MVP spec mandates MP4/JPG/PNG only, maximum 5 seconds per video, and specific screen resolution. Currently, any file type and any duration can be uploaded — a 2-minute MP4 or a `.gif` passes silently. Client-side validation is required before the upload request fires.

**Exact fix:**
1. On file `<input>` `onChange` event:
   - Check `file.type` against `['video/mp4', 'image/jpeg', 'image/png']` — reject immediately with inline error if not matched.
2. For MP4 files specifically:
   - Create a `<video>` element, set `src = URL.createObjectURL(file)`, listen for `onloadedmetadata`.
   - If `video.duration > 5.5` (0.5s tolerance for encoding variance), reject with: `"Video must be exactly 5 seconds (max 5.5s allowed)"`.
   - Revoke the object URL after reading: `URL.revokeObjectURL(src)`.
3. For images:
   - Create an `<img>` element, set `src = URL.createObjectURL(file)`, read `naturalWidth × naturalHeight` on `onload`.
   - If dimensions don't match expected screen resolution: **warn only, do not block**. Resolution rejection is a backend concern per spec.
4. Display all errors **inline** (next to the upload input), not as toasts or alerts.

**Verification:**
- Upload `.gif` → rejected immediately with type error.
- Upload 10-second `.mp4` → rejected with duration error.
- Upload valid 5-second `.mp4` → passes validation, upload proceeds.
- Upload image at wrong resolution → warning displayed, upload not blocked.
- After valid upload, hard-refresh page → confirm asset persists (tests the LAN-20260527 fix is in the chain).

**Outcome likelihood: 🟡 60%**  
Highest-uncertainty task in Sprint 7. Upload component location is unknown and must be found via grep. If embedded inside `RetailerManagement.jsx` (50,256 bytes), any edit carries significant risk of collateral breakage. The `onloadedmetadata` pattern for MP4 duration validation is asynchronous and requires careful handling.

---

### Task 7.6 — Approval Status Badges in LoopManagement Grid

**Type:** UX / Observability  
**Files edited:**
- `client-app/src/pages/admin/LoopManagement.jsx` (13,683 bytes)
- Either: import `StatusBadge` from `LoopBuilder.jsx` (21,218 bytes) **if it is exported**, OR create `client-app/src/components/StatusBadge.jsx` (new file)

**Problem in plain terms:**  
Admins have no at-a-glance view of which loops for today are approved vs pending. If all loops for an upcoming hour are still `PENDING`, screens will silently fall back to the playlist — no admin alert, no visibility.

**Exact fix:**
1. Verify `StatusBadge` export from `LoopBuilder.jsx` before importing:
   ```
   grep -n "export" client-app/src/pages/admin/LoopBuilder.jsx | grep -i status
   ```
   If not exported: extract to `src/components/StatusBadge.jsx` first.
2. `StatusBadge` props: `status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'DRAFT'`
   - `APPROVED` → green badge
   - `PENDING` → amber badge  
   - `REJECTED` → red badge
   - `DRAFT` → grey badge
3. Render badge next to the hour label in the loop grid row.
4. Add a warning banner at the **top of the page** (above the grid) when any loop for today's **remaining hours** has `status !== 'APPROVED'`. Banner text: `"⚠️ N loop(s) for upcoming hours are not yet approved. Screens may play fallback content."`

**Verification:** Set a loop to `PENDING` status in the DB/API. Load `LoopManagement.jsx` → confirm amber badge appears. Confirm warning banner appears. Set to `APPROVED` → confirm badge turns green, banner disappears. Hard-refresh after each toggle — confirms LAN-20260527 persistence fix is working.

**Outcome likelihood: 🟢 88%**  
Well-scoped, isolated to `LoopManagement.jsx` with no broadcast path changes. The only meaningful risk is the `StatusBadge` export check — if a developer imports from `LoopBuilder.jsx` without verifying the export exists, the build will fail. The warning banner logic (filtering for remaining hours of today) requires a date comparison that must account for timezone if the server and client are in different timezones.

---

### Task 7.7 — Documentation Debt

**Type:** Documentation  
**Files edited:**
- `changelog.md` *(exists at repo root — 35,165 bytes)*
- `docs/MVP_SPRINT_PLAN.md`

> **Note:** `changelog.md` is at the **repo root**, not under `docs/`. Confirmed in current file listing.

**`changelog.md` additions:**

```markdown
## LAN-20260527 — BaseRepository.update() Silent-Catch Fix
- `BaseRepository.update()`: silent catch removed, `.update()` → `.set({merge:true})`
- `RetailerRepository.softDelete()` + `updateStatus()`: same fix
- `AdvertiserRepository.softDelete()`: same fix
- Affected: all edit/toggle/delete actions on Advertisers, Retailers, Screens, Stores, BusinessHours
- Root cause: Firestore NOT_FOUND on mock-only documents was silently swallowed; MOCK_STORAGE always returned success

## Sprint 7 — Playback Gate + Resilience
- Player re-registration bug fixed (7.1)
- Startup retry with exponential backoff added (7.2)
- Loop fetch scoped server-side by hour+status (7.3)
- Offline fallback loop implemented (7.4)
- Asset upload content spec validation added (7.5)
- Approval status badges in LoopManagement (7.6)
- PlaylistEditor.jsx dead code removed (7.8)
- Security: V1/V2/V3/V5 patched
```

**`docs/MVP_SPRINT_PLAN.md` corrections:**
- Sprint 5 route: change `/admin/analytics` → `/dashboard/admin/loop-analytics`
- Sprint 6: append `⚠️ Tests UNVERIFIED — spec files not confirmed in commit history`
- Sprint 3 note: clarify `ScheduleManager.jsx` and `ScheduleHistory.jsx` are Sprint 6 additions, not Sprint 3
- Add LAN-20260527 as a completed hotfix between Sprint 6 and Sprint 7

**Verification:** Both files parse as valid Markdown. No broken table syntax. No TODO stubs left in.

**Outcome likelihood: 🟢 95%**

---

### Task 7.8 — Delete PlaylistEditor.jsx

**Type:** Dead code removal (SRE R7)  
**Files edited:**
- `client-app/src/pages/admin/PlaylistEditor.jsx` — **DELETED** (15,681 bytes)

**Problem in plain terms:**  
`PlaylistEditor.jsx` has no route in `App.jsx` and no imports anywhere in the codebase — **confirmed by reading the live `App.jsx` source on 2026-06-05**. It is 15,681 bytes of dead code that imports services which may have changed since the file was last touched — some bundlers may throw silent import-time errors.

**Pre-delete verification (ALL must pass — re-run at delete time, not based on this audit):**
```bash
# 1. No imports anywhere in the codebase
grep -r "PlaylistEditor" client-app/src --include="*.jsx" --include="*.js" --include="*.ts"
# Expected: zero results outside the file itself

# 2. Not in App.jsx route list
grep "PlaylistEditor" client-app/src/App.jsx
# Expected: no match

# 3. No open PR referencing this file
# Check GitHub PRs manually
```

**Do not delete** if any grep returns a result. The codebase changes between sessions — re-run the grep at delete time, not based on a previous audit.

**Verification:** After delete, run `npm run build` in `client-app/` and confirm zero import errors.

**Outcome likelihood: 🟢 92%**

---

### Security Tasks V1–V5 (Sprint 7 Portion)

**Files edited:**
- `client-app/src/pages/Player.jsx` (V1, V2, V3)
- `client-app/src/pages/admin/TechOpsDashboard.jsx` (V5)

**V1 — Remove debug overlay from production:**
- Wrap `data-testid="ad-debug-overlay"` render block in `{process.env.NODE_ENV === 'development' && (...)}` guard.
- Alternatively, delete if no longer needed for local debugging.

**V2 — Harden screen_id registration:**
- In production (`NODE_ENV !== 'development'`), do not accept `screen_id` from the URL query string.
- Require `screen_id` to come from an authenticated session/token instead.
- For MVP: add a warning log and fallback to `null` if no authenticated ID is available, blocking registration until a valid ID is provided.

**V3 — Validate slot.url before inject:**
- Before setting an asset URL into an `<img src>` or `<video src>`: check `url.startsWith('https://')` — reject if not HTTPS.
- Explicitly block `javascript:` and `data:` prefixes.

**V5 — Replace localStorage user_id in TechOpsDashboard:**
- Replace `localStorage.getItem('user_id')` with the value from the existing auth context (locate via `grep -r "useAuth\|AuthContext" client-app/src --include="*.jsx" -l`).
- If no auth context pattern exists yet, use an in-memory module-level variable as a temporary bridge.

**Outcome likelihood: 🟢 82%**  
V1 and V3 are simple guards. V2 carries risk: changing how `screen_id` is sourced may break demo/staging environments where the query-param approach is the only available mechanism. A feature flag or `NODE_ENV` guard is strongly recommended. V5 depends on whether an auth context pattern already exists in the codebase — if not, the fix becomes more complex.

---

## Test Stabilization (Sprint 7)

These are pre-existing regressions, not new tests. They must be resolved before Sprint 7 tasks can be considered stable.

> **Updated note:** Several regressions in `integration_gold_path.spec.js` previously attributed to the Player refactor were likely caused by the `BaseRepository.update()` persistence bug (LAN-20260527). Re-run all specs after the LAN-20260527 merge before assuming a Sprint 7 regression.

| Spec File | Regressions | Root Cause | Action |
|-----------|-------------|------------|--------|
| `loop_playback.spec.js` | 10 timeout failures | Player state machine refactor from Sprint 4/6 | Update test expectations to match new dual-effect architecture after 7.1 fix |
| `telemetry.spec.js` | Unknown count | Likely telemetry path changed | Audit after 7.1/7.2 changes are stable |
| `ad_player.spec.js` | Unknown count | Player refactor | Audit after 7.1/7.2 |
| `loop_builder.spec.js` | 3 regressions | Post-refactor state shape change | Audit after 7.6 (StatusBadge extraction) |
| `integration_gold_path.spec.js` | Unknown count | Likely mix of Player refactor + LAN-20260527 persistence bug (now fixed) | Re-run first after LAN-20260527 merge — remaining failures attributed to Player only |

**Order of test repair:** LAN-20260527 merge verify → `integration_gold_path.spec.js` baseline re-run → 7.1 → 7.2 → `loop_playback.spec.js` → `telemetry.spec.js` → `ad_player.spec.js` → 7.3 → `integration_gold_path.spec.js` → 7.6 → `loop_builder.spec.js`

---

## Full File Inventory

| File | Size | Operation | Task(s) |
|------|------|-----------|--------|
| `client-app/src/pages/Player.jsx` | 15,479 bytes | **Edit (multiple passes)** | 7.1, 7.2, 7.3, 7.4, V1, V2, V3 |
| `server/routes/loops.js` | Unknown | **Edit** | 7.3 |
| `ad-server/src/repositories/LoopRepository.js` | Unknown | **Audit** | 7.3 (check for silent-catch variant per LAN-20260527) |
| `client-app/src/pages/admin/LoopManagement.jsx` | 13,683 bytes | **Edit** | 7.6 |
| `client-app/src/pages/admin/LoopBuilder.jsx` | 21,218 bytes | **Read / possibly edit** | 7.6 (StatusBadge export check) |
| `client-app/src/components/StatusBadge.jsx` | — | **Create (if not in LoopBuilder)** | 7.6 |
| Upload component (unknown path) | Unknown | **Edit** | 7.5 |
| `client-app/src/config.js` | Unknown | **Read-only** | 7.4 (fallback URL check) |
| `client-app/src/pages/admin/TechOpsDashboard.jsx` | Unknown | **Edit** | V5 |
| `changelog.md` | 35,165 bytes | **Append** | 7.7 (confirmed at repo root) |
| `docs/MVP_SPRINT_PLAN.md` | 2,853 bytes | **Edit** | 7.7 |
| `client-app/src/pages/admin/PlaylistEditor.jsx` | 15,681 bytes | **DELETE** | 7.8 |

---

## Outcome Likelihood Summary

| Task | Score | Confidence Basis |
|------|-------|------------------|
| 7.7 — Docs update | **95%** | No code changes. Pure markdown. `changelog.md` confirmed at repo root. |
| 7.8 — Delete PlaylistEditor | **92%** | Confirmed dead code via live `App.jsx` read. One failure mode: another file added post-audit that imports it — re-run grep at delete time. |
| 7.6 — Status badges | **88%** | Well-isolated to `LoopManagement.jsx`. Risk: `StatusBadge` export assumption + timezone edge case in hour filter. |
| 7.1 — Fix re-registration | **85%** | R1 confirmed live in dep array. Risk: two-function finding (L39 vs L103 inline fetch) — use `fetchCurrentLoop` in Effect B only. |
| V1–V5 — Security patches | **82%** | V1/V3 trivial. V2 (screen_id hardening) may break demo env. V5 depends on auth context existing. |
| 7.2 — Retry backoff | **80%** | Straightforward. Must sequence after 7.1. Risk: cleanup on unmount during retry cycle. |
| 7.4 — Fallback loop | **78%** | Depends on 7.2 being clean. Risk: SVG data URI validity, heartbeat continuity through fallback state. |
| 7.3 — Server-side filter | **65%** | Backend ORM unknown. Case-sensitivity bug (R4) remains as FIXME. LoopRepository silent-catch audit added. |
| 7.5 — Upload validation | **60%** | **Highest risk task.** Upload component location unknown. May be embedded in 50KB file. Async MP4 duration check is fragile. |

**Sprint-level composite outcome: ~79%** (average, weighted for task complexity)

All 9 task groups completing cleanly within 3 days requires no unknown-unknowns surfacing in the backend ORM (7.3), the upload component being reasonably accessible (7.5), and `LoopRepository` not having its own silent-catch variant. The most likely slip scenario is 7.5 + 7.3 overrunning into a 4th day due to discovery work.

---

## Definition of Done

- [ ] `POST /api/screens/register` fires exactly once per Player page load — verified by DevTools network log
- [ ] Player reaches `status='playing'` after 3 simulated network failures (mock test)
- [ ] `GET /api/loops?date=X&hour=Y&status=APPROVED` returns only matching loops
- [ ] `GET /api/loops?date=X` (no hour/status) still returns full day dataset — backward-compat confirmed
- [ ] Offline fallback loop plays when all network requests are blocked in DevTools; heartbeat continues
- [ ] Upload rejects `.gif`, rejects MP4 > 5.5s, warns on resolution mismatch, accepts valid 5s MP4
- [ ] Uploaded asset persists after hard-refresh (verifies LAN-20260527 fix is in upload call chain)
- [ ] `LoopManagement.jsx` shows status badges (green/amber/red/grey) and warning banner for upcoming unapproved hours
- [ ] Loop status toggle (PENDING → APPROVED) persists after hard-refresh (verifies LAN-20260527 fix in loop path)
- [ ] `changelog.md` includes LAN-20260527 fix entry and Sprint 7 entries
- [ ] `docs/MVP_SPRINT_PLAN.md` route and test-status corrections committed
- [ ] `PlaylistEditor.jsx` deleted — grep pre-check passed and committed
- [ ] `data-testid="ad-debug-overlay"` not rendered in production build
- [ ] `slot.url` validated against HTTPS before inject
- [ ] All test regressions in `loop_playback.spec.js` resolved
- [ ] `integration_gold_path.spec.js` baseline re-run post LAN-20260527 — remaining failures documented
- [ ] `npm run build` in `client-app/` exits with zero errors
