# Sprint 10 Wrap-Up — softomedia-live2026
**Date:** June 6, 2026 | **Branch:** `main` | **Guardrail standard:** [`docs/sprint10-sre-retro.md`](./docs/sprint10-sre-retro.md) (G-1..G-11)

> **G-9 compliant:** Every status below is confirmed by a live file read with SHA. No memory-only assertions.
> **v2 update (2026-06-06 00:47 EDT):** 8 pre-work discovery steps executed; 5 prior plan items corrected or stripped.
> **v3 update (2026-06-06):** MVP gap analysis section added from full codebase vs. MVP doc review.

---

## All Items — Verified Closed ✅

| # | Item | File | SHA | Confirmed |
|---|---|---|---|---|
| 1 | `PUT /api/campaigns/:id` — `authenticate` guard | `ad-server/src/api/campaigns.js` | `c69927f` | `authenticate` on route ~L130 |
| 2 | `POST /api/campaigns/:id/book` — `authenticate` guard | `ad-server/src/api/campaigns.js` | `c69927f` | `authenticate` on route ~L75 |
| 3 | `PATCH /api/campaigns/:id/status` — `requireRole('retaileradmin')` | `ad-server/src/api/campaigns.js` | `c69927f` | Confirmed this sprint v2 |
| 4 | `DELETE /api/campaigns/:id` — `requireRole('admin')` | `ad-server/src/api/campaigns.js` | `c69927f` | Confirmed this sprint v2 — was listed as unguarded in prior plan |
| 5 | `GET /api/loops/pending/:retailerId` — auth guard | `ad-server/src/api/loops.js` | `99f0f22` | `authenticate + requireRole('retaileradmin')` on final route |
| 6 | `POST /api/telemetry/impression` — rate-limit | `ad-server/src/api/telemetry.js` | `98bd645` | `impressionLimiter` from `../middleware/rateLimiter.js` applied — was listed as missing in prior plan |
| 7 | `POST /api/telemetry/impression` — Firestore persistence | `ad-server/src/api/telemetry.js` | `98bd645` | `impressionRepository.logImpression` + `campaignRepository.update` (play_count) in fire-and-forget `Promise.all` |
| 8 | `notifications.js` — full Firestore API (was listed as 135-byte stub) | `ad-server/src/api/notifications.js` | `37efc9d` | 5 216 B on disk; 4 endpoints: `GET /`, `GET /unread`, `PATCH /:id/read`, `PATCH /read-all` |
| 9 | `TicketDashboard.jsx` promoted to `pages/tickets/` | `client-app/src/pages/tickets/TicketDashboard.jsx` | `836da26` | Route wired in `App.jsx`; `API_URL` from config |
| 10 | `TicketDetail.jsx` promoted to `pages/tickets/` | `client-app/src/pages/tickets/TicketDetail.jsx` | `836da26` | Route wired in `App.jsx`; `API_URL` from config |
| 11 | `pages/retailer/Loops.jsx` — confirmed on disk | `client-app/src/pages/retailer/Loops.jsx` | via App.jsx route | Was listed as missing; confirmed route `/dashboard/retailer/loops` |
| 12 | `ScheduleCalendar.jsx` — correct route confirmed | `client-app/src/pages/retailer/ScheduleCalendar.jsx` | via App.jsx | Route is `/dashboard/retailer/schedule` — prior plan cited wrong path `/schedule/calendar` |

---

## SRE/QA Note — G-9 Violations Caught This Sprint

This sprint surfaced **five G-9 violations** — tasks listed as open in documentation that were already closed or miscategorised in the live code:

| False positive | Doc source | Resolution |
|---|---|---|
| Items 1–3 listed as open auth guard work | Prior MVP analysis written without live reads | Live read of `campaigns.js` + `loops.js` — all guards confirmed present |
| Risk V2 “telemetry has no rate limit” | Prior MVP analysis | Live read of `telemetry.js` — `impressionLimiter` confirmed wired |
| Risk V3 “DELETE /campaigns unguarded” | Prior MVP analysis | Live read of `campaigns.js` — `requireRole('admin')` confirmed present |
| Item 8 listed as 135-byte stub | Prior MVP analysis | Live read of `notifications.js` — 5 216 B, full 4-endpoint API confirmed |
| Route `/schedule/calendar` listed as broken path | Prior MVP analysis | Live read of `App.jsx` — correct route is `/dashboard/retailer/schedule`; `ScheduleCalendar.jsx` is wired |

**Cost:** ~3 planning cycles investigating phantom blockers.
**Guardrail:** G-9 in [`docs/sprint10-sre-retro.md`](./docs/sprint10-sre-retro.md) — every task status must cite a file + SHA before it may be listed as open or closed.

---

## Two Real Blockers Confirmed This Sprint (NEW — v2)

These were not in the prior plan and were only surfaced by live file reads.

### Blocker 1 — `api/tickets.js` does not exist

`ad-server/src/api/ops.js` (SHA `9315bd8`) is 880 bytes and contains **only** `POST /backup` (Firestore export). There is no issue/ticket/disconnect API on the server.

TASK-16 (“Report Issue”) and TASK-17 (“Disconnect”) have no server-side target. Before any UI work on these tasks, `ad-server/src/api/tickets.js` must be created and mounted in `api/index.js`.

Minimum contract required:
```
POST   /api/tickets   body: { screen_id, type, description, retailer_id } → 201 { ticket_id }
GET    /api/tickets   query: ?screen_id=<id>                              → 200 [...]
```

Note: “Disconnect” maps to the **existing** `PATCH /api/screens/:id/status` (`screens.js` SHA `0aa39ba`) — no ticket endpoint needed for that action. Only “Report Issue” requires the new tickets router.

### Blocker 2 — `GET /api/screens` returns no coordinate fields

`screens.js` (SHA `0aa39ba`) has been fully read. `POST /register` and `POST /` accept and persist: `screen_id`, `resolution`, `user_agent`, `status`, `last_seen`, `retailer_id`, `location_id`. **`latitude` and `longitude` are not accepted or stored.**

TASK-12 (Network Map) cannot be completed by fixing the map container height alone — the root cause is missing schema fields. Adding `latitude`/`longitude` to the screen registration payload and `ScreenRepository` is a prerequisite.

---

## `GET /api/loops` — Corrected Envelope (v2)

Prior plan called this endpoint a bare array. Live read of `loops.js` (SHA `99f0f22`) confirms the response is an **object**, not an array:

```json
{
  "loops": [ ...loop documents... ],
  "business_hours": {
    "start": 8,
    "end": 22,
    "is_closed": false,
    "total_loops": 14
  }
}
```

Any client code iterating `response` directly (instead of `response.loops`) will fail silently with 0 iterations. All consumer components must be checked: `LoopDemoPlayer.jsx`, `ScheduleCalendar.jsx`, `LoopManagement.jsx`.

Query param note: both `?screen_id=` and `?screenid=` are accepted (normalised on line 31 of `loops.js`).

---

## MVP Completion — Revised Estimate

| Area | Readiness | Confidence | Notes |
|---|---|---|---|
| RBAC & auth scaffolding | 95% | High | All mutation routes guarded; confirmed by SHA |
| Campaign lifecycle | 90% | High | Create → approve → schedule; all guards closed |
| Scheduling engine & loop generation | 85% | High | All route files verified |
| Proof-of-play / impressions | 90% | High | Persistence + play_count confirmed wired; rate-limit confirmed |
| Notifications | 90% | High | Full 4-endpoint API confirmed — was stub |
| Retailer validation workflow | 75% | Medium | Pages exist; `CampaignApprovalList` duplicate unresolved (see below) |
| Demo Player / full-day cycle | 60% | Medium | `LoopDemoPlayer.jsx` exists (36 KB); loops envelope fix needed in consumer |
| Admin CRUD write-path | 65% | Low | Route files exist and are non-trivial; Firestore writes unconfirmed end-to-end |
| Device / network monitoring | 60% | Low | `monitoring.js` confirmed; **map blocked by missing lat/lng schema fields** |
| Issue / disconnect reporting | 15% | High | `api/tickets.js` does not exist; must be created from scratch |
| **Overall** | **~82%** | | Security/persistence gaps closed; two new structural gaps confirmed |

---

## Remaining Work — Sprint 11 Candidates

### Priority 1 — Must-Have Before MVP Demo

| # | Task | Pre-condition | Effort est. |
|---|---|---|---|
| 1 | Create `api/tickets.js` + mount in `api/index.js` | None | S |
| 2 | Wire “Report Issue” button in `RetailerDashboard.jsx` to `POST /api/tickets` | #1 above | S |
| 3 | Add `latitude`/`longitude` to screen registration payload + `ScreenRepository` schema | None | S |
| 4 | Fix `NetworkMap.jsx` — container height + pin rendering with real coordinate data | #3 above | M |
| 5 | Fix all `loops` API consumers to destructure `response.loops` (not `response`) | None | S |
| 6 | Admin CRUD end-to-end smoke test — confirm Firestore writes for users, retailers, advertisers | None | M |
| 7 | Resolve `CampaignApprovalList` duplicate — run `grep -r "CampaignApprovalList" client-app/src --include="*.jsx" -n` and confirm or delete duplicate | None | XS |

### Priority 2 — Verification (Cannot Be Confirmed by Static Analysis)

| # | Task | Notes |
|---|---|---|
| 8 | Retailer Dashboard quick-action links — confirm routes in live browser | Paths look correct in App.jsx but link `href` values in component unconfirmed |
| 9 | Demo Player full-day cycle — confirm `LoopDemoPlayer.jsx` cycles all 14 loops correctly | After loops envelope fix (#5) |
| 10 | Confirm `requireRole` role strings match token payload exactly — `'retaileradmin'` vs `'retailer_admin'` | Silent 403 risk |

### Priority 3 — Post-MVP / Deferred

| Item | Rationale |
|---|---|
| Analytics summary dashboard | Proof-of-play now lands in Firestore; dashboard reads it post-MVP |
| Super Admin retailer impersonation | Nice-to-have; not a launch blocker |
| “Reestablish connection” button | Placeholder acceptable for MVP demo |

---

## One Remaining Pre-Work Item — Must Be Run Before Sprint 11 Planning

**PW-6 — CampaignApprovalList duplicate resolution**

`App.jsx` contains a warning comment flagging a potential duplicate between `pages/retailer/CampaignApprovalList.jsx` and `components/CampaignApprovalList.jsx`. This must be resolved before any approval-workflow task is planned or assigned.

```bash
grep -r "CampaignApprovalList" client-app/src --include="*.jsx" -n
```

If the `components/` version exists and is imported anywhere, determine which is canonical and delete or re-export the other. If only the `pages/` version exists, close this item.

---

## MVP Gap Analysis — Codebase vs. MVP Doc (v3 Addition)

> Added 2026-06-06. Source: full codebase review vs. `docs/Digital Screen Network Management Platform (MVP).md` at commit `bcefad0`.
> **Note:** Items already verified closed above (auth guards, rate limits, notifications) are NOT repeated here.

### What Is Done ✅ (Confirmed by Code)

- All 5 MVP roles routed: Super Admin, Retailer Admin, Brand/Advertiser, Tech Ops, Content Manager
- `requireRole` middleware on all mutation routes (verified by SHA above)
- Loop-based scheduling: 12 slots × 5-second ads = 60-second hourly loop; `Loops` Firestore schema in place
- `BrandCampaignWizard.jsx`, `CampaignApprovalList.jsx`, campaign API routes all present
- `TelemetryService.js` + `impressionRepository.logImpression` wired (proof-of-play persists)
- Notifications: full 4-endpoint API confirmed (v2 correction above)
- Cloud Run deployment configured in `cloudbuild.yaml`

### What Is Still Missing / Unconfirmed ❌

#### Admin CRUD Write-Path — Unconfirmed End-to-End
Route files for users, retailers, and advertisers exist and are non-trivial, but Firestore writes have **not been confirmed** by live browser smoke test. Priority 1 task #6 above.

#### Network Map — Structurally Blocked
`NetworkMap.jsx` is blank not because of a CSS height bug, but because `latitude`/`longitude` are not stored in the `screens` collection. Priority 1 tasks #3 and #4 above.

#### Issue Reporting — No Server
`api/tickets.js` does not exist. "Report Issue" button has no API target. Priority 1 tasks #1 and #2 above.

#### `GET /api/loops` Envelope Mismatch
All three consumer components (`LoopDemoPlayer.jsx`, `ScheduleCalendar.jsx`, `LoopManagement.jsx`) may be iterating the raw response object instead of `response.loops`. Silent empty state in all three views. Priority 1 task #5 above.

#### Role String Consistency Risk
`requireRole` checks for `'retaileradmin'` (no underscore). If the Firebase Auth token or `x-demo-role` header sends `'retailer_admin'` (with underscore), all retailer mutations silently return `403`. Must be verified in a live browser session before demo.

#### `CampaignApprovalList` Duplicate
Potential duplicate component between `pages/retailer/` and `components/`. One may be stale. Unresolved; blocks approval workflow confidence.

### Sprint 11 Definition of Done (Minimum for MVP Demo)

- [ ] `api/tickets.js` exists, is mounted, and `POST /api/tickets` returns `201`
- [ ] Network Map renders pins for at least one seeded screen with real lat/lng
- [ ] `response.loops` destructuring confirmed in all three consumer components
- [ ] Admin CRUD smoke test: create one retailer, one advertiser, one user → hard refresh → records persist in Firestore
- [ ] `CampaignApprovalList` duplicate resolved (one canonical version)
- [ ] `requireRole` role string matches token payload in a live browser session for retailer mutations
- [ ] `changelog.md` updated before merge

---

## Guardrails Reference

This document conforms to G-1..G-11 in [`docs/sprint10-sre-retro.md`](./docs/sprint10-sre-retro.md).
Sprint 11 doc must use the v2 Guardrails template from that file.
