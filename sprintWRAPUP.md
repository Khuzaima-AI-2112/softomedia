# Sprint Wrap-Up — softomedia-live2026
**Date:** June 6, 2026 | **Branch:** `main` | **Commit:** `1078994`

---

## Executive Summary

The codebase is **~72% of the way to a shippable MVP**. The architectural backbone is solid: multi-tenant RBAC, multi-role dashboards, scheduling engine, campaign lifecycle, device monitoring, and ad-server are all in place. What remains is primarily three unguarded API mutation routes, one missing Firestore persistence call in the telemetry handler, and functional verification of several UI flows that exist on disk but have not been confirmed end-to-end.

**Corrections from live file reads at commit `1078994`:** `DELETE /api/campaigns/:id` carries `authenticate` + `requireRole('admin')`; `PATCH /api/campaigns/:id/status` carries `requireRole('retaileradmin')` and normalises status to lowercase; `POST /api/telemetry/impression` applies `impressionLimiter` (100 req/min per IP); `pages/retailer/Loops.jsx`, `ScheduleCalendar.jsx`, `ScheduleHistory.jsx`, and `ScheduleManager.jsx` all exist on disk.

---

## What Is Confirmed Done ✅

Based on direct file inspection at commit `1078994`.

### Backend — API Routes (`ad-server/src/api/`)

| File | Status | Evidence |
|---|---|---|
| `campaigns.js` — `PATCH /:id/status` | ✅ Auth guard added | `requireRole('retaileradmin')` applied; status normalised to lowercase before persist |
| `campaigns.js` — `DELETE /:id` | ✅ Guarded | `authenticate` + `requireRole('admin')` both applied |
| `campaigns.js` — `POST /` | ✅ Guarded | `authenticate` applied (S9 Task 9.2) |
| `telemetry.js` — `POST /impression` | ✅ Rate limited | `impressionLimiter` imported from `middleware/rateLimiter.js` and applied |
| `telemetry.js` — validation | ✅ | Returns 400 if `screen_id` or `campaign_id` missing |
| `loops.js` — `POST /generate` | ✅ Guarded | `authenticate` applied; router also behind authenticate in index.js |
| `loops.js` — `PATCH /:id/approve` | ✅ Guarded | `authenticate`; derives `userId` from token only, rejects if null |
| `loops.js` — `PATCH /slots/reject` + `replace` | ✅ Guarded | `authenticate` on both verbs |
| `loops.js` — query scoping | ✅ | Accepts `?screen_id=` and `?screenid=` (normalised); date + location_id filtering applied |
| `advertisers.js` (4.7 KB) | ✅ Exists, non-trivial | Full CRUD file |
| `retailers.js` (4.9 KB) | ✅ Exists, non-trivial | Full CRUD file |
| `users.js` (8.2 KB) | ✅ Exists, non-trivial | Full CRUD file — largest route file |
| `screens.js` (5.4 KB) | ✅ Exists | |
| `stores.js` (6.2 KB) | ✅ Exists | |
| `monitoring.js` (2.8 KB) | ✅ Exists | |
| `schedules.js` (2.6 KB) | ✅ Exists | |

### Client — Pages (`client-app/src/pages/`)

| File | Status | Size |
|---|---|---|
| `retailer/Loops.jsx` | ✅ Exists | 5.8 KB |
| `retailer/ScheduleCalendar.jsx` | ✅ Exists | 14.2 KB |
| `retailer/ScheduleManager.jsx` | ✅ Exists | 24.9 KB |
| `retailer/ScheduleHistory.jsx` | ✅ Exists | 20.4 KB |
| `retailer/RetailerDashboard.jsx` | ✅ Exists | 9.7 KB |
| `retailer/CampaignApprovalList.jsx` | ✅ Exists | 5.1 KB |
| `LoopDemoPlayer.jsx` | ✅ Exists | 36 KB — largest page |
| `Player.jsx` | ✅ Exists | 23.1 KB |

### Infrastructure

- Cloud Run + `cloudbuild.yaml` deployment configured ✅
- Firestore collections defined (retailers, stores, screens, campaigns, loops, impressions) ✅
- `TelemetryService.js` exists for proof-of-play buffering ✅
- `notifications.js` route exists (135 bytes — stub, but file is present) ✅

---

## What Is Still Open ❌

### Priority 1 — MVP Blockers

#### 1. Impression Persistence (`telemetry.js`, ~line 80)
The `POST /api/telemetry/impression` endpoint logs to stdout but **does not write to Firestore**. The comment in the file itself says:

```
// Phase 2 (TODO): persist to impressions Firestore collection and increment
//   campaign play_count via campaignService.
```

Proof-of-play is a listed MVP requirement. Without persistence, no analytics data accumulates across sessions and play counts on campaigns remain at zero.

**Fix:** Call `campaignRepository.incrementPlayCount(campaign_id)` and `impressionRepository.create(...)` inside the handler, after the 400-guard.

#### 2. `PUT /api/campaigns/:id` — No Auth Guard
The full-replacement update for a campaign document has **no `authenticate` or `requireRole` guard**. Any unauthenticated caller can overwrite a campaign record, including its status, advertiser ID, and creative URL.

```js
// campaigns.js — current state
router.put('/:id', async (req, res) => { ... });  // ← no guard
```

**Fix:** Add `authenticate` at minimum; add `requireRole('admin')` or scope to campaign owner.

#### 3. `POST /api/campaigns/:id/book` — No Auth Guard
The slot-booking endpoint has no authentication guard. Any caller knowing a campaign ID can book inventory slots on its behalf.

```js
router.post('/:id/book', async (req, res) => { ... });  // ← no guard
```

**Fix:** Add `authenticate`; optionally verify the caller's `advertiser_id` matches `campaign.advertiser_id`.

#### 4. `GET /api/loops/pending/:retailerId` — No Auth Guard
The pending-loops list for retailer validation is publicly readable. This exposes all unapproved campaign content to unauthenticated callers.

```js
router.get('/pending/:retailerId', async (req, res) => { ... });  // ← no guard
```

**Fix:** Add `authenticate` + `requireRole('retaileradmin')`.

#### 5. `notifications.js` — Stub Only
The file is 135 bytes. No notification feed is implemented for any role. The MVP doc lists notifications as a required feature for approval workflow feedback.

**Fix:** Implement `GET /api/notifications?role=&userId=` returning paginated notification records from Firestore.

---

### Priority 2 — Functional Gaps (Verification Required)

#### 6. Admin CRUD — Persistence Unconfirmed
`users.js`, `retailers.js`, and `advertisers.js` exist and are non-trivial in size, but their internal write operations have not been verified against the Firestore repository layer. **Verify by running the admin flows end-to-end** — creating a user, retailer, and advertiser — and confirming records appear in Firestore.

#### 7. Network Map — Rendering Unconfirmed
The Tech Ops network map rendering depends on a Google Maps API key being set in the environment. Cannot be confirmed from static analysis. Must be verified in the running app.

#### 8. Retailer Dashboard — Navigation Links
`RetailerDashboard.jsx` (9.7 KB) contains quick-action links. Whether these navigate to the correct paths (`/retailer/loops`, `/retailer/schedule/calendar`, `/retailer/history`) needs to be confirmed via a browser test.

#### 9. Demo Player — Full-Day Cycle
`LoopDemoPlayer.jsx` (36 KB) exists. Whether it cycles through all 14 hourly loops for a full-day playback simulation (MVP requirement) needs to be verified by reading the component logic or running it.

---

### Priority 3 — Post-MVP / Deferred

| Item | Rationale |
|---|---|
| `notifications.js` full implementation | Stub acceptable for MVP demo; full feed is post-MVP |
| Analytics summary dashboard | Proof-of-play logging must land first (Priority 1 above) |
| Report Issue / Disconnect / Reestablish actions | UI-only placeholders acceptable for MVP demo |
| Super Admin retailer impersonation / context selector | Nice-to-have for demo; not a launch blocker |

---

## MVP Completion Estimate

| Area | Estimated Readiness | Confidence |
|---|---|---|
| RBAC & Authentication scaffolding | 90% | High — files verified |
| Campaign lifecycle (create → approve → schedule) | 80% | High — guards confirmed; persistence gap on impression |
| Scheduling engine & loop generation | 85% | High — all route files verified |
| Retailer validation workflow | 75% | Medium — pages exist; navigation UX unconfirmed |
| Demo Player / Proof-of-play | 60% | Medium — player exists; Firestore write missing |
| Admin CRUD (users/retailers/advertisers) | 65% | Low — files exist but write-path unconfirmed |
| Device/network monitoring | 70% | Medium — monitoring.js exists; map rendering unconfirmed |
| Notifications | 10% | High — confirmed stub only |
| **Overall** | **~72%** | |

---

## Immediate Next Actions

1. **Add auth guard to `PUT /api/campaigns/:id`** — one line, 10 minutes
2. **Add auth guard to `POST /api/campaigns/:id/book`** — one line, 10 minutes
3. **Add auth guard to `GET /api/loops/pending/:retailerId`** — one line, 10 minutes
4. **Wire impression persistence** in `telemetry.js` `POST /impression` handler — ~1 hour
5. **Run admin CRUD flows end-to-end** and confirm Firestore writes — verification sprint
6. **Verify network map rendering** in a running environment with a valid Maps API key
7. **Verify Retailer Dashboard navigation links** now that destination pages exist
8. **Implement `notifications.js`** — scope to post-MVP or include if sprint capacity allows
