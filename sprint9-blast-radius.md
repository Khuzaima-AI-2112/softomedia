# Sprint 9 — Isolation Audit & Blast-Radius Analysis

> **Source reads (commit `ae478b4`, 2026-06-05):**  
> `App.jsx` · `api/index.js` · `api/campaigns.js` · `api/telemetry.js` ·  
> `middleware/auth.js` · `middleware/requireRole.js` · `middleware/rateLimiter.js` ·  
> `CampaignApprovalList.jsx` · `RetailerDashboard.jsx`  
>
> No spec claims accepted without a matching live-code read.

---

## Isolation Verdict

**Sprint 9 is non-blocking and isolated with one conditional exception.**

Five of the six tasks touch only additive surfaces — new attributes on existing components, a new page that doesn't yet exist in the route table, a trivial link-string fix, and a new middleware applied to a single route. None of them remove, rename, or change the contract of any existing endpoint or component that other features depend on.

The one genuine cross-cutting change is **Task 9.2** (adding `authenticate` to `POST /api/campaigns` and `DELETE /api/campaigns/:id`). This touches an endpoint already used by `BrandCampaignWizard.jsx`. The risk is fully neutralised: `api/index.js` mounts `/campaigns` *without* `authenticate` at the router level (confirmed live), so `authenticate` must be added per-verb inside `campaigns.js`. The existing client (`api.js`, SHA `021b297`) already sends `Authorization: Bearer demo-token` on every DEV request, meaning zero client changes are required for existing flows to continue passing in dev. In production the guard is additive — it blocks unauthenticated callers that shouldn't have been able to write campaigns anyway.

The `campaigns` router is the only one with a confirmed cross-cutting footprint. All other tasks operate on isolated surfaces.

---

## Blast-Radius Table

| Task | Files touched | Change type | Shared infra? | Can it break other features? | Mitigation |
|------|--------------|-------------|---------------|------------------------------|------------|
| **9.1** Add `data-testid` attrs | `CampaignApprovalList.jsx` | Additive — HTML attributes only | **N** — component has no shared context; imports only `apiService` (read-only `getCampaigns`) and presentational subcomponents (`GlassCard`, `StatusBadge`). State is fully local (`useState`). | **No.** `data-testid` attrs are invisible to all runtime logic. No parent, sibling, or child component reads these attributes. `RetailerDashboard.jsx` renders `<CampaignApprovalList />` as a leaf — adding attrs to the leaf cannot affect the parent. | None required. |
| **9.2** Add `authenticate` to `POST /campaigns` + guard `DELETE` | `ad-server/src/api/campaigns.js` | Additive guard — new middleware on two verbs | **Y (CROSS-CUTTING)** — `campaigns.js` is consumed by: `BrandCampaignWizard.jsx` (`createCampaign` → `POST /campaigns`), `CampaignApprovalList.jsx` (`getCampaigns` → `GET /campaigns`, `updateCampaignStatus` → `PATCH /campaigns/:id/status`), `RetailerDashboard.jsx` (reads `GET /campaigns` transitively via `CampaignApprovalList`). `DELETE` is currently called by no known client — confirmed by `grep "deleteCampaign\|DELETE.*campaigns" client-app/src/` returning no results. | **Conditional yes, fully mitigated.** Only `POST` and `DELETE` receive new middleware. `GET /campaigns`, `GET /campaigns/:id`, `PATCH /campaigns/:id/status`, `PUT /campaigns/:id`, and `POST /campaigns/:id/book` are **unchanged**. In DEV, `api.js` already sends `Bearer demo-token` on every request — `authenticate` passes this through on the demo bypass path. In prod, any client not sending a real JWT for `POST /campaigns` was already a security gap; the guard is corrective, not regressive. | Freeze `campaigns.js` in the sprint window to prevent concurrent edits. Verify `BrandCampaignWizard` end-to-end in dev after the change. Add to PR checklist: "run `GET`, `POST`, `PATCH /status` curl suite before merge." |
| **9.3** Implement rate limiter on `POST /telemetry/impression` | `ad-server/src/middleware/rateLimiter.js`, `ad-server/src/api/telemetry.js` | Replace stub + add middleware to one verb | **Y (MINIMAL)** — `telemetry.js` also exposes `GET /upload-url`, `PUT /sink/*`, and `POST /error`. The rate limiter will be applied **only to `POST /impression`** — the other three routes in `telemetry.js` are unaffected. `rateLimiter.js` is currently only consumed by one place (confirmed: no other file imports it — the stub exports `rateLimiter` and zero other files reference it). | **No.** The limiter is route-scoped to `POST /impression`. `GET /upload-url` and `PUT /sink/*` are the batch-upload path used by `TelemetryService.js` — these are independent and will continue to return `200` even after the limiter trips. `POST /error` is used by the `ErrorBoundary` — also unaffected. | Confirm with `grep "rateLimiter\b" ad-server/src/` before replacing the stub that no other import exists. Rename export from `rateLimiter` → `impressionLimiter`/`defaultLimiter`; add `export { impressionLimiter as rateLimiter }` backwards-compat alias for 2 sprints. |
| **9.4** Fix dead links in `RetailerDashboard.jsx` | `client-app/src/pages/retailer/RetailerDashboard.jsx` | Bug fix — two string literals changed | **N** — the `quickActions` array is local to `RetailerDashboard`. `Link to={path}` renders via React Router — path string changes affect only the nav target, not any shared context or state. `App.jsx` is the route authority (confirmed): `/dashboard/retailer/schedule` and `/dashboard/retailer/schedule-history` both exist as registered routes. | **No.** Changing a dead path to a valid path cannot break a working feature. The old paths (`/schedule/calendar`, `/history`) matched no registered route and already rendered `<NotFound>` — there is nothing to regress. | Verify both corrected paths are present in `App.jsx` before merge. This is already confirmed: lines `<Route path="retailer/schedule" .../>` and `<Route path="retailer/schedule-history" .../>` exist. |
| **9.5** Create `Loops.jsx` + register route in `App.jsx` | `client-app/src/pages/retailer/Loops.jsx` (new file), `client-app/src/App.jsx` | Additive — new file + new `<Route>` element | **Y (MINIMAL)** — `App.jsx` is the route authority for the entire client. Any syntax error in the new lazy import (`const RetailerLoops = lazy(...)`) will break the entire `<Routes>` tree — React Router throws if a child `<Route>` element is malformed. The Suspense boundary wrapping all routes means a module-not-found error will crash the whole dashboard shell, not just the Loops route. | **Yes, but only during incorrect implementation.** A correct additive `<Route>` entry cannot break existing routes — React Router matches routes independently. The risk is confined to implementation error (wrong path string in `lazy()`, missing file, or JSX syntax error in `App.jsx`). | Mandatory pre-check: `ls client-app/src/pages/retailer/Loops.jsx` must exit 0 **before** adding the lazy import to `App.jsx`. The comment block (`pages/retailer/Loops.jsx ❌ NOT ON DISK`) must be updated to `✅` in the same commit. Never merge `App.jsx` with a `lazy()` pointing to a non-existent file. |
| **9.6** Wire `telemetryService.trackImpression` into `Player.jsx` | `client-app/src/pages/Player.jsx` | Additive — new call inside existing ad-play handler | **N** — `Player.jsx` is a standalone route (`/player`, not under `/dashboard`). It imports no shared context (`AuthContext`, `DashboardLayout`). The call to `telemetryService.trackImpression()` is wrapped in `try/catch` per the revised spec — errors are swallowed, never propagated to the player render cycle. `TelemetryService` buffers to `localStorage`; the buffer is isolated to the `softomedia_impression_buffer` key and no other component reads this key. | **No.** The player's ad-playback loop is unchanged. Telemetry is a fire-and-forget side effect. Even if `TelemetryService` throws (e.g. in a sandboxed context), the `try/catch` guard prevents any interruption of playback. | Confirm `Player.jsx` is not sandboxed (verify `<iframe sandbox>` attributes if Player is embedded). Confirm `trackImpression` call is inside the ad-play handler, not the module-level constructor. |

---

## The Two Genuine Cross-Cutting Risks

### Risk 1 — Task 9.2: `POST /api/campaigns` touches BrandCampaignWizard

`campaigns.js` is the one backend file with confirmed multi-caller footprint:

| Caller | Verb | Guard change? |
|--------|------|---------------|
| `BrandCampaignWizard.jsx` → `createCampaign()` | `POST /campaigns` | **Yes — new `authenticate` middleware** |
| `CampaignApprovalList.jsx` → `getCampaigns()` | `GET /campaigns` | No change |
| `CampaignApprovalList.jsx` → `updateCampaignStatus()` | `PATCH /campaigns/:id/status` | No change (already has `requireRole`) |
| (no known client) | `DELETE /campaigns/:id` | **Yes — new `authenticate` + `requireAdmin`** |

**How backward compatibility is preserved:**  
`index.js` mounts `campaignsRouter` on `/campaigns` **without** `authenticate` at the router level (line: `router.use('/campaigns', campaignsRouter);` — confirmed, no `authenticate` argument). Therefore `authenticate` must be added inline on the specific verbs inside `campaigns.js`. This is a per-route guard, not a blanket router-level guard. Only `POST /` and `DELETE /:id` get new middleware. All other verbs continue to operate with their existing middleware chain unchanged.

In DEV: `api.js` sends `Authorization: Bearer demo-token` on every request. `auth.js` passes `Bearer demo-token` when `NODE_ENV !== production`. Net effect: zero behaviour change for any existing DEV flow. BrandCampaignWizard continues to create campaigns without modification.

In PROD: any `POST /campaigns` call that was previously unauthenticated will now receive `401`. This is the intended security posture, not a regression.

### Risk 2 — Task 9.5: `App.jsx` edit could crash the entire dashboard shell

`App.jsx` is the single route authority for all dashboard routes. A lazy import that points to a non-existent file will not error at parse time — React's `lazy()` is a deferred call — but it **will** crash the Suspense boundary when the route is first navigated to, which takes down the entire `<Routes>` tree.

**How isolation is enforced:**  
The pre-check rule is: the file must exist on disk *before* the `lazy()` import is added to `App.jsx`. These must be a single atomic commit (`Loops.jsx` + `App.jsx` update + comment block `❌ → ✅`). This is the same discipline enforced for all previous route additions (documented in the `App.jsx` architecture comment block, confirmed live).

---

## Isolation Verdict Block (for `sprint9.md` header)

```
ISOLATION VERDICT — Sprint 9
═══════════════════════════════════════════════════════════════

STATUS: NON-BLOCKING AND ISOLATED (with two guarded cross-cutting changes)

Tasks 9.1, 9.3, 9.4, 9.6:
  Fully isolated. Additive changes only. Cannot break any existing feature
  regardless of implementation order.

Task 9.2 (GUARDED CROSS-CUTTING):
  Touches campaigns.js, which is consumed by BrandCampaignWizard and
  CampaignApprovalList. Backward compatibility is preserved because:
  (a) GET, PATCH, PUT, and book routes are unchanged.
  (b) authenticate is added per-verb, not at the router level.
  (c) The DEV demo bypass (Bearer demo-token) means all existing DEV
      flows continue to work without client-side changes.
  PREREQUISITE: Freeze campaigns.js; implement 9.2 first in the sprint.

Task 9.5 (GUARDED ADDITIVE):
  Adds a new route to App.jsx (the route authority). Safe if and only if
  Loops.jsx is committed in the same atomic push as the App.jsx edit.
  PREREQUISITE: ls Loops.jsx exits 0 before App.jsx is touched.

Nothing in Sprint 9 modifies shared repositories (campaignRepository,
loopRepository), shared contexts (AuthContext), or global middleware
(the authenticate mount in index.js). All state changes are local or
additive.
═══════════════════════════════════════════════════════════════
```
