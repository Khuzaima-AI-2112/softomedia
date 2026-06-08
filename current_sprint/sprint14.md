# Sprint 14 — Advertiser Self-Service Portal

**Sprint:** 14
**Status:** ✅ DONE — All stories implemented and committed
**Commit:** feat(S14): advertiser self-service portal — S14-1 through S14-4 + DECISION-1 closed
**Cross-referenced with:** `client-app/src/App.jsx` @ `335f1c2`, `ad-server/src/api/` @ `3393144`
**Guardrails authority:** [`docs/sprint8-sre-retro-consolidated.md`](./sprint8-sre-retro-consolidated.md)
**Route authority:** [`docs/API_ROUTES.md`](../docs/API_ROUTES.md)
**Schema authority:** [`docs/DATABASE_SCHEMA.md`](../docs/DATABASE_SCHEMA.md)
**MVP reference:** [`docs/Digital Screen Network Management Platform (MVP).md`](<../docs/Digital Screen Network Management Platform (MVP).md>)
**Completion plan:** [`docs/MVP_COMPLETION_SPRINT_PLAN.md`](../docs/MVP_COMPLETION_SPRINT_PLAN.md)

---

## Sprint 14 Close-Out

| Story | Status | Evidence |
|---|---|---|
| **S14-1** · POST /api/campaigns role guard | ✅ DONE | `requireRole('advertiser')` added to `POST /` in `campaigns.js`; `advertiser_id` stamped from `req.user.linked_entity_id` |
| **S14-2** · Campaign CRUD API patch | ✅ DONE | GET / ownership scoping via `req.user?.role === 'advertiser'`; GET /:id ownership guard; VALID_TRANSITIONS state machine replaces flat allowlist |
| **S14-3** · Advertiser portal UI | ✅ DONE | `pages/advertiser/AdvertiserDashboard.jsx`, `AdvertiserCampaigns.jsx`, `AdvertiserNewCampaign.jsx` created |
| **S14-4** · App.jsx route registration | ✅ DONE | 3 lazy imports + 3 routes under `/dashboard/advertiser`; verified file map updated |
| **DECISION-1** · telemetry.js NODE_ENV guard | ✅ CLOSED | Option B — `!== 'production'` is intentional; sink must remain reachable in dev + test. Documented. |
| **DECISION-2** · POST /campaigns guard type | ✅ CLOSED | `requireRole('advertiser')` (hierarchical) — admin oversight preserved |

### Carry-overs to Sprint 15

| Item | Type | Priority | Gate |
|---|---|---|---|
| **S11-1** — Super Admin CRUD Users & Retailers persistence test | Manual QA | Critical | Hard-refresh `UserManagement` form; confirm data survives |
| **S11-2** — Super Admin CRUD Advertisers persistence test | Manual QA | Critical | Hard-refresh `AdvertiserManagement` form; confirm data survives |
| **S11-4** — Add Location persistence test | Manual QA | High | Hard-refresh Add Location form; confirm data survives |
| **`docs/MVP_SPRINT_PLAN.md`** Sprint 13 + 14 entries | Docs | Low | Add links to `current_sprint/sprint13.md` and `current_sprint/sprint14.md` |
| **Firestore composite index** — `campaigns.advertiser_id` | Infra | Medium | Required for `==` query in production; verify on first Firestore deployment |
| **ENUM-AUDIT-3** — `'APPROVED'\|'PENDING'` scan | Audit | Medium | `Select-String -Path "ad-server/src" -Pattern "'APPROVED'\|'PENDING'" -Recurse` |

---

## Decisions Closed This Sprint

### DECISION-1 — NODE_ENV Guard Logic in `telemetry.js` ✅ RESOLVED

**File:** `ad-server/src/api/telemetry.js` ~L49
**Live code:** `if (process.env.NODE_ENV !== 'production') {`

**Resolution: Option B — intentional. No code change.**

The `/sink/*` route is a local dev + test helper that simulates GCS bucket writes. Blocking it only in production (`!== 'production'`) is correct — the sink must be reachable during development and automated tests. Changing to `!== 'test'` would break test-environment sink usage. The existing guard matches the Sprint 11 S11-3 intent documented in the inline comment. GUARDRAIL-10 closed.

---

### DECISION-2 — `POST /api/campaigns` Role Guard Type ✅ RESOLVED

**Resolution: `requireRole('advertiser')` — hierarchical guard.**

Hierarchical guard (ROLE_HIERARCHY level 0) allows advertiser + all higher roles (retaileradmin, contentmanager, techoperator, admin, superadmin) to create campaigns. This preserves admin oversight and matches the existing guard pattern across the codebase. If §3.4 is later tightened to prohibit admin campaign creation, swap to `req.user.role === 'advertiser'` equality check at that time.

---

## Grep Audit Log

| Grep | Finding | Status |
|---|---|---|
| **Grep 4** | `CampaignRepository` is a 6-line thin wrapper; `BaseRepository.findAll({ where })` confirmed | ✅ CLOSED |
| **Grep 5** | JWT payload: `{ id, email, role, linked_entity_id }` | ✅ CLOSED |
| **Grep 6** | Zero `/dashboard/advertiser/*` routes in `App.jsx` pre-Sprint-14 | ✅ CLOSED |
| **Grep 7** | `pages/advertiser/` directory did not exist — created from scratch | ✅ CLOSED |
| **Grep 8** | `ApiService.js` — all four campaign methods present; zero new methods needed | ✅ CLOSED |
| **Grep 9** | `DashboardLayout.jsx` — no `ProtectedRoute`; role enforcement via `getNavItems(persona)`; `advertiser` persona already maps to `BRAND_NAV` | ✅ CLOSED |

---

## Implementation Notes

### Back End — `ad-server/src/api/campaigns.js`

**S14-1:** `requireRole('advertiser')` added to `POST /`. `advertiser_id` stamped from `req.user.linked_entity_id` (not from request body) to prevent spoofing. Request body `advertiser_id` is accepted as override for admin callers via `??` coalescing.

**S14-2 — Three patches applied:**

1. **GET / scoping** — Advertiser callers (`req.user?.role === 'advertiser'`) receive only campaigns where `advertiser_id === req.user.linked_entity_id`. Optional `?status=` filter stacks on top via a second `where` clause. Non-advertiser callers (including unauthenticated) continue to use the existing `advertiserId` / `status` query param logic unchanged.

2. **GET /:id ownership guard** — After fetching by ID, if caller is `advertiser` and `campaign.advertiser_id !== req.user.linked_entity_id`, return `403 Forbidden`. `req.user` optional chaining prevents TypeError for unauthenticated callers.

3. **VALID_TRANSITIONS state machine** — Replaces flat `ALLOWED_STATUSES` array. Transition is validated against the campaign's current status. Invalid transitions return `400 { error, from, to, allowed }` for unambiguous debugging. All six status values are covered; `completed` and `rejected` are terminal (empty array).

### Front End — New Pages

**`pages/advertiser/AdvertiserDashboard.jsx`** — Landing page. Loads all campaigns via `apiService.getCampaigns()` (back end scopes to caller). Renders status summary cards (6 statuses) + recent campaigns table (10 rows). Empty state with CTA. Skeleton loaders during fetch.

**`pages/advertiser/AdvertiserCampaigns.jsx`** — Full campaign list. Status filter tabs (All + 6 statuses). Table with name, status badge, budget, play_count, last_played_at, created_at. Empty state per filter. Refetches on filter change.

**`pages/advertiser/AdvertiserNewCampaign.jsx`** — Creation form. Fields: name (required), description, budget, start_date, end_date, creative_url. Client-side validation (name required; end_date ≥ start_date). On submit → `apiService.createCampaign(payload)` → redirect to `/dashboard/advertiser/campaigns`. Server error surfaced inline. Empty optional fields stripped before POST.

### App.jsx — S14-4

Three lazy imports added under `// ── Advertiser pages` block. Three routes registered:
```
/dashboard/advertiser                → AdvertiserDashboard
/dashboard/advertiser/campaigns      → AdvertiserCampaigns
/dashboard/advertiser/campaigns/new  → AdvertiserNewCampaign
```
Verified file map comment updated with Sprint 14 entries. No existing routes modified.

### ApiService.js

No changes required. All needed methods were already present:
- `getCampaigns(params)` — used by dashboard + campaigns list
- `getCampaign(id)` — available for future detail view
- `createCampaign(data)` — used by new campaign form
- `updateCampaignStatus(id, status)` — available for future status actions
- `bookSlots(campaignId, slots)` — available for future slot booking

---

## Step 4 — Isolation Audit (pre-implementation, now archived)

### Files read in Step 4

| File | SHA | Finding |
|---|---|---|
| `campaigns.js` | `3dd8cd2` | GET / and GET /:id have no auth middleware — `req.user` optional chaining required |
| `App.jsx` | `335f1c2` | No existing `/dashboard/advertiser/*` routes — zero collision |
| `ApiService.js` | `bc13dca` | All campaign methods present — no new methods needed |
| `DashboardLayout.jsx` | `f4a7bff` | No ProtectedRoute — role enforcement via `getNavItems(persona)`; `advertiser` already mapped to `BRAND_NAV` |
| `telemetry.js` | `9496f84` | `!== 'production'` guard intentional — DECISION-1 resolved Option B |

---

## Step 3 — Outcome Probability Tightening (archived)

### Files read in Step 3

| File | SHA | Size | Why read |
|---|---|---|---|
| `ad-server/src/services/AuthService.js` | `de215c1` | 1 381 B | Confirm JWT payload fields |
| `ad-server/src/repositories/CampaignRepository.js` | `4e3585d` | 232 B | Confirm `findAll` scoping support |
| `ad-server/src/repositories/BaseRepository.js` | `6e3338e` | 6 264 B | Confirm `findAll({ where })` in both Firestore and memory |
| `ad-server/src/services/CampaignService.js` | `4cb64bb` | 1 882 B | Confirm no ownership logic in service layer |
| `ad-server/src/api/auth.js` | `e53a73f` | 937 B | Confirm login handler delegates to `authService.login()` |

---

## Sprint 13 Carry-Overs (resolved or re-carried)

| Item | Resolution |
|---|---|
| **DECISION-1** — NODE_ENV guard | ✅ Closed this sprint — Option B, intentional |
| **S11-1** persistence test | 🔄 Re-carried to Sprint 15 |
| **S11-2** persistence test | 🔄 Re-carried to Sprint 15 |
| **S11-4** persistence test | 🔄 Re-carried to Sprint 15 |
| **`docs/MVP_SPRINT_PLAN.md`** Sprint 13 entry | 🔄 Re-carried to Sprint 15 |
