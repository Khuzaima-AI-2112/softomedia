# Sprint Grounding Audit — softomedia-live2026
**Date:** 2026-06-06 | **Auditor role:** Senior SRE / QA Lead  
**Source of truth:** `App.jsx` (SHA `eeafe550`) · `ad-server/src/api/` tree (SHA `d4b6c113`)

---

## 1. Ground Rules Applied

| Rule | Applied |
|---|---|
| App.jsx is the single source of truth for all client routes | ✅ |
| Every claimed file confirmed against repo tree before scoring | ✅ |
| Files not in tree flagged NOT ON DISK; no guessing substituted | ✅ |
| Server routers confirmed from `ad-server/src/api/` directory listing | ✅ |
| Acceptance criteria rewritten to be falsifiable (status codes / data-testids / query params) | ✅ |
| "Works correctly" language banned | ✅ |

---

## 2. Master Verification Table

> **Legend** — ✅ Confirmed on disk & imported in App.jsx or server index | ⚠️ On disk but flagged in App.jsx comment | ❌ NOT ON DISK

### 2A — Client-Side Pages (App.jsx lazy imports)

| Claimed file | Route in App.jsx | Disk status | Action |
|---|---|---|---|
| `pages/Login.jsx` | `/login` | ✅ | **Confirm** |
| `pages/Player.jsx` | `/player` | ✅ | **Confirm** |
| `pages/LoopDemoPlayer.jsx` | `/player/demo` | ✅ | **Confirm** |
| `pages/NotFound.jsx` | catch-all | ✅ | **Confirm** |
| `pages/Health.jsx` | `/dashboard/techoperator/health` | ✅ | **Confirm** |
| `pages/admin/Overview.jsx` | `/dashboard/admin` | ✅ | **Confirm** |
| `pages/admin/RetailerManagement.jsx` | `/dashboard/admin/retailers` | ✅ | **Confirm** |
| `pages/admin/AdvertiserManagement.jsx` | `/dashboard/admin/advertisers` | ✅ | **Confirm** |
| `pages/admin/ScreenManagement.jsx` | `/dashboard/admin/screens` | ✅ | **Confirm** |
| `pages/admin/LoopManagement.jsx` | `/dashboard/admin/loops` | ✅ | **Confirm** |
| `pages/admin/LoopBuilder.jsx` | `/dashboard/admin/loops/:id` | ✅ | **Confirm** |
| `pages/admin/UserManagement.jsx` | `/dashboard/admin/users` | ✅ | **Confirm** |
| `pages/admin/BusinessHoursManagement.jsx` | `/dashboard/admin/hours` | ✅ | **Confirm** |
| `pages/admin/NetworkMap.jsx` | `/dashboard/admin/map` | ✅ | **Confirm** |
| `pages/admin/AILog.jsx` | `/dashboard/admin/ai-log` | ✅ | **Confirm** |
| `pages/admin/CPMCalendar.jsx` | `/dashboard/admin/pricing` | ✅ | **Confirm** |
| `pages/admin/LoopAnalytics.jsx` | `/dashboard/admin/loop-analytics` | ✅ | **Confirm** |
| `pages/brand/BrandDashboard.jsx` | `/dashboard/brand` | ✅ | **Confirm** |
| `pages/brand/BrandCampaignWizard.jsx` | `/dashboard/brand/campaign/new` | ✅ | **Confirm** |
| `pages/retailer/RetailerDashboard.jsx` | `/dashboard/retailer` | ✅ | **Confirm** |
| `pages/retailer/ScheduleCalendar.jsx` | `/dashboard/retailer/schedule` | ✅ | **Confirm** |
| `pages/retailer/ScheduleHistory.jsx` | `/dashboard/retailer/schedule-history` | ✅ | **Confirm** |
| `pages/retailer/ScheduleManager.jsx` | `/dashboard/retailer/schedule-manager` | ✅ | **Confirm** |
| `pages/retailer/Loops.jsx` | `/dashboard/retailer/loops` | ✅ | **Confirm** |
| `pages/retailer/CampaignApprovalList.jsx` | `/dashboard/retailer/campaign-approvals` | ⚠️ DUPLICATE WARNING | **Correct — see §4** |
| `pages/tech/TechOpsDashboard.jsx` | `/dashboard/techoperator` | ✅ | **Confirm** |
| `pages/tickets/TicketDashboard.jsx` | `/dashboard/tickets` | ✅ | **Confirm** |
| `pages/tickets/TicketDetail.jsx` | `/dashboard/tickets/:id` | ✅ | **Confirm** |
| `layouts/DashboardLayout.jsx` | `/dashboard` shell | ✅ | **Confirm** |

**Previous plan claimed `pages/retailer/Loops.jsx` was NOT ON DISK (Risk R3).**  
**→ RETRACTED. File exists as of Sprint 10. Remove that risk item from sprintWRAPUP.md.**

**Previous plan claimed the Schedule Calendar route was `/dashboard/retailer/schedule/calendar` (dead path).**  
**→ RETRACTED. Real route is `/dashboard/retailer/schedule` (no `/calendar` suffix). Correct all references.**

### 2B — Server Routers (`ad-server/src/api/`)

| Claimed router file | Disk status | Action |
|---|---|---|
| `api/ads.js` | ✅ | **Confirm** |
| `api/advertisers.js` | ✅ | **Confirm** |
| `api/assets.js` | ✅ | **Confirm** |
| `api/audit.js` | ✅ | **Confirm** |
| `api/auth.js` | ✅ | **Confirm** |
| `api/campaigns.js` | ✅ | **Confirm** |
| `api/dashboard.js` | ✅ | **Confirm** |
| `api/health.js` | ✅ | **Confirm** |
| `api/index.js` | ✅ | **Confirm** |
| `api/locations.js` | ✅ | **Confirm** |
| `api/loops.js` | ✅ | **Confirm** |
| `api/monitoring.js` | ✅ | **Confirm** |
| `api/notifications.js` | ✅ (5 216 B — NOT a stub) | **Correct — see §4** |
| `api/ops.js` | ✅ | **Confirm** |
| `api/playlist.js` | ✅ | **Confirm** |
| `api/playlists.js` | ✅ | **Confirm** |
| `api/pricing.js` | ✅ | **Confirm** |
| `api/retailers.js` | ✅ | **Confirm** |
| `api/schedules.js` | ✅ | **Confirm** |
| `api/screens.js` | ✅ | **Confirm** |
| `api/stores.js` | ✅ | **Confirm** |
| `api/telemetry.js` | ✅ | **Confirm** |
| `api/users.js` | ✅ | **Confirm** |
| `api/tickets.js` | **❌ NOT ON DISK** | **See pre-work §5** |

---

## 3. Task-Level Grounding Audit

### TASK-02 · Wire "Add User" in UserManagement.jsx → `POST /api/users`

| Dimension | Claimed | Reality | Verdict |
|---|---|---|---|
| Client file | `pages/admin/UserManagement.jsx` | ✅ On disk, routed at `/dashboard/admin/users` | Confirm |
| Server route | `POST /api/users` | ✅ `api/users.js` on disk | Confirm |
| Auth guard | `requireRole(['superadmin'])` | Not confirmed by tree listing alone — **pre-work needed** | Verify |

**Falsifiable AC:**
- `POST /api/users` with header `x-demo-role: superadmin` returns `201` and body `{ id: <string> }`.
- `POST /api/users` with header `x-demo-role: retailer` returns `403`.
- After submission, row appears with `data-testid="user-row-<id>"` without page reload.

---

### TASK-03 · Wire "Delete User" → `DELETE /api/users/:id`

| Dimension | Claimed | Reality | Verdict |
|---|---|---|---|
| Client file | `pages/admin/UserManagement.jsx` | ✅ | Confirm |
| Server route | `DELETE /api/users/:id` | ✅ `api/users.js` on disk | Confirm |

**Falsifiable AC:**
- `DELETE /api/users/:id` with `x-demo-role: superadmin` returns `200` or `204`.
- `DELETE /api/users/:id` with `x-demo-role: retailer` returns `403`.
- Row with `data-testid="user-row-<id>"` is removed from DOM without full reload.

---

### TASK-04–06 · RetailerManagement CRUD → `api/retailers.js`

| Dimension | Claimed | Reality | Verdict |
|---|---|---|---|
| Client file | `pages/admin/RetailerManagement.jsx` | ✅ routed at `/dashboard/admin/retailers` | Confirm |
| Server router | `api/retailers.js` | ✅ 4 936 B | Confirm |

**Falsifiable AC (TASK-04 Add):**
- `POST /api/retailers` with `x-demo-role: superadmin` returns `201` with `{ id }`.
- New row appears with `data-testid="retailer-row-<id>"`.

**Falsifiable AC (TASK-05 Remove):**
- `DELETE /api/retailers/:id` returns `200` or `204`; row removed from DOM.

**Falsifiable AC (TASK-06 Make Inactive):**
- `PATCH /api/retailers/:id` body `{ active: false }` returns `200`; row badge changes to `data-testid="badge-inactive"`.

---

### TASK-07–08 · AdvertiserManagement CRUD → `api/advertisers.js`

| Dimension | Claimed | Reality | Verdict |
|---|---|---|---|
| Client file | `pages/admin/AdvertiserManagement.jsx` | ✅ routed at `/dashboard/admin/advertisers` | Confirm |
| Server router | `api/advertisers.js` | ✅ 4 695 B | Confirm |

**Falsifiable AC (TASK-07 Add):**
- `POST /api/advertisers` with `x-demo-role: superadmin` returns `201` with `{ id }`.
- Row appears with `data-testid="advertiser-row-<id>"`.

**Falsifiable AC (TASK-08 Remove):**
- `DELETE /api/advertisers/:id` returns `200` or `204`; row removed from DOM.

---

### TASK-09 · Demo Player — Cascading Retailer→Store→Screen Selection

| Dimension | Claimed | Reality | Verdict |
|---|---|---|---|
| Client file | `pages/Player.jsx` | ✅ routed at `/player` | Confirm |
| Client file | `pages/LoopDemoPlayer.jsx` | ✅ routed at `/player/demo` | Confirm |
| Server routers touched | `api/retailers.js`, `api/stores.js`, `api/screens.js` | ✅ all on disk | Confirm |

**Falsifiable AC:**
- On mount, `GET /api/retailers` is called; `<select data-testid="select-retailer">` is populated.
- Selecting a retailer triggers `GET /api/stores?retailerId=<id>`; `<select data-testid="select-store">` updates.
- Selecting a store triggers `GET /api/screens?storeId=<id>`; `<select data-testid="select-screen">` updates.
- "Play Demo" button is disabled (`aria-disabled="true"`) until all three are selected.

---

### TASK-10 · Full-Day Schedule Playback

| Dimension | Claimed | Reality | Verdict |
|---|---|---|---|
| Client file | `pages/LoopDemoPlayer.jsx` | ✅ | Confirm |
| Server route | `GET /api/loops?screenId=<id>&date=<YYYY-MM-DD>` | `api/loops.js` on disk (8 674 B) — **query param signature unverified** | Pre-work needed |

**Pre-work step:**
```bash
grep -n "screenId\|date\|query" ad-server/src/api/loops.js | head -30
```

**Falsifiable AC (once pre-work confirms param names):**
- `GET /api/loops?screenId=<id>&date=<YYYY-MM-DD>` returns `200` with array of 24 loop objects.
- Player cycles through all 24 without JS error; `data-testid="current-hour"` increments from `0` to `23`.

---

### TASK-12 · Fix Network Map Rendering

| Dimension | Claimed | Reality | Verdict |
|---|---|---|---|
| Client file | `pages/admin/NetworkMap.jsx` | ✅ routed at `/dashboard/admin/map` | Confirm |
| Server route | `GET /api/screens` with lat/lng fields | `api/screens.js` on disk (5 365 B) — lat/lng field names unverified | Pre-work needed |

**Pre-work step:**
```bash
grep -n "lat\|lng\|coordinates\|geopoint" ad-server/src/api/screens.js | head -20
```

**Falsifiable AC:**
- `GET /api/screens` returns array where each item has numeric `lat` and `lng` (or confirmed alternate field names).
- Map container `data-testid="network-map"` has `clientHeight > 0` (not `height: 0` bug).
- At least one marker renders within 2 s of page load.

---

### TASK-16–17 · "Report Issue" / "Disconnect" in RetailerDashboard

| Dimension | Claimed | Reality | Verdict |
|---|---|---|---|
| Client file | `pages/retailer/RetailerDashboard.jsx` | ✅ routed at `/dashboard/retailer` | Confirm |
| Server route claimed | `POST /api/tickets` | **❌ `api/tickets.js` NOT ON DISK** | **STRIP from sprint — see §4** |
| Alternate server route | `api/ops.js` (880 B) | ✅ on disk | Candidate — pre-work needed |

**Pre-work step (do before writing any code):**
```bash
grep -rn "tickets\|report.*issue\|disconnect" ad-server/src/api/ops.js ad-server/src/api/index.js
```

---

### TASK-18 · Schedule Calendar Navigation

| Dimension | Claimed (old plan) | Reality | Verdict |
|---|---|---|---|
| Route claimed | `/dashboard/retailer/schedule/calendar` | **WRONG** — real route is `/dashboard/retailer/schedule` | **Correct** |
| Client file | `pages/retailer/ScheduleCalendar.jsx` | ✅ routed at `/dashboard/retailer/schedule` | Confirm with corrected path |

**All internal `<Link>` components pointing to `/dashboard/retailer/schedule/calendar` must be updated to `/dashboard/retailer/schedule`.**

---

### TASK-19 · "Go Back" Navigation in Approval History Crashes

| Dimension | Claimed | Reality | Verdict |
|---|---|---|---|
| Client file | `pages/retailer/ScheduleHistory.jsx` | ✅ routed at `/dashboard/retailer/schedule-history` | Confirm |

**Falsifiable AC:**
- Clicking "Go Back" calls `navigate(-1)` or `navigate('/dashboard/retailer')`.
- No `TypeError` or `Cannot read properties of undefined` in browser console.
- `window.location.pathname` changes within 300 ms of click.

---

### TASK-20 · "Add Location" in Retailer View

| Dimension | Claimed | Reality | Verdict |
|---|---|---|---|
| Client file | `pages/retailer/RetailerDashboard.jsx` | ✅ | Confirm |
| Server route | `POST /api/stores` | ✅ `api/stores.js` on disk (6 238 B) | Confirm |

**Falsifiable AC:**
- `POST /api/stores` with `x-demo-role: retailer` returns `201` with `{ id }`.
- New location row appears with `data-testid="location-row-<id>"` without full reload.

---

### TASK-21 · Retailer Context Selector for Super Admin

| Dimension | Claimed | Reality | Verdict |
|---|---|---|---|
| Client file | `pages/retailer/RetailerDashboard.jsx` | ✅ | Confirm |
| Server route | `GET /api/retailers` | ✅ `api/retailers.js` on disk | Confirm |

**Falsifiable AC:**
- When `x-demo-role: superadmin`, a `<select data-testid="retailer-context-selector">` is visible.
- Changing selection re-fetches data with `?retailerId=<id>` query param visible in Network tab.
- When `x-demo-role: retailer`, the selector is absent from the DOM.

---

### TASK-23 · Tech Ops Dashboard — Network-Wide Data

| Dimension | Claimed | Reality | Verdict |
|---|---|---|---|
| Client file | `pages/tech/TechOpsDashboard.jsx` | ✅ routed at `/dashboard/techoperator` | Confirm |
| Server route | `GET /api/monitoring` or `GET /api/screens` | ✅ `api/monitoring.js` (2 795 B) and `api/screens.js` on disk | Confirm |

**Falsifiable AC:**
- `GET /api/monitoring` (or the verified endpoint) with `x-demo-role: techoperator` returns `200` with array covering **all** retailers.
- No `?retailerId` filter is applied server-side for this role.
- Dashboard `data-testid="screen-count-total"` value matches `screens.length` from API response.

---

### Security Tasks (V1–V3 / Task 9.2–9.3)

| Dimension | Claimed | Reality | Verdict |
|---|---|---|---|
| `PATCH /api/campaigns/:id/status` missing role guard | `api/campaigns.js` | ✅ on disk — guard presence unverified by tree listing alone | Pre-work needed |
| `DELETE /api/campaigns/:id` missing role guard | `api/campaigns.js` | ✅ on disk — same | Pre-work needed |
| `POST /api/telemetry/impression` no rate limit | `api/telemetry.js` | ✅ on disk (4 852 B) — rate-limit presence unverified | Pre-work needed |

**Pre-work steps:**
```bash
grep -n "requireRole\|router.delete\|router.patch" ad-server/src/api/campaigns.js
grep -n "rateLimit\|express-rate-limit\|limiter" ad-server/src/api/telemetry.js
```

---

## 4. "Strip This From the Plan" List

These items from the previous sprint plan are **contradicted by live repo evidence** and must be removed or corrected before sprint planning:

| # | Item to strip / correct | Reason |
|---|---|---|
| 1 | **Risk R3: "pages/retailer/Loops.jsx NOT ON DISK"** | File exists; routed at `/dashboard/retailer/loops`. Remove entirely. |
| 2 | **Risk R4: route `/dashboard/retailer/schedule/calendar` (dead path)** | Real route is `/dashboard/retailer/schedule`. Correct all `<Link to=...>` references. |
| 3 | **"notifications.js is a 135-byte stub"** | File is 5 216 bytes on disk — not a stub. Reassess what is actually missing inside it before planning work. |
| 4 | **TASK-16/17 `POST /api/tickets`** | `api/tickets.js` does NOT exist. Do not write client code against this endpoint until the router is created and mounted. Pre-work: confirm if `api/ops.js` handles issue reporting. |
| 5 | **Any reference to `components/CampaignApprovalList.jsx` as the routed component** | App.jsx routes to `pages/retailer/CampaignApprovalList.jsx`. The `components/` version (if it exists) is the duplicate flagged in the App.jsx warning comment. Run the grep before touching either file: `grep -r "CampaignApprovalList" client-app/src --include="*.jsx" -n` |

---

## 5. Pre-Work Discovery Steps Required Before Sprint Start

These are items where reality could not be fully confirmed from the directory listing alone. **No code should be written until these are run.**

```bash
# PW-1: Confirm loops.js query params for full-day playback
grep -n "screenId\|date\|query\|req\.query" ad-server/src/api/loops.js | head -30

# PW-2: Confirm screens.js lat/lng field names for Network Map
grep -n "lat\|lng\|geo\|coordinates" ad-server/src/api/screens.js | head -20

# PW-3: Confirm campaigns.js has role guards on PATCH status and DELETE
grep -n "requireRole\|router\.delete\|router\.patch\|router\.put" ad-server/src/api/campaigns.js

# PW-4: Confirm telemetry.js rate-limit status
grep -n "rateLimit\|express-rate-limit\|limiter\|throttle" ad-server/src/api/telemetry.js

# PW-5: Confirm api/index.js mounts all routers (including tickets if it is added)
cat ad-server/src/api/index.js

# PW-6: Resolve CampaignApprovalList duplicate
grep -r "CampaignApprovalList" client-app/src --include="*.jsx" -n

# PW-7: Confirm api/tickets.js is truly absent (not in a subdirectory)
find ad-server -name "tickets.js"

# PW-8: Confirm ops.js handles issue/disconnect actions
grep -n "issue\|disconnect\|report" ad-server/src/api/ops.js
```

---

## 6. Repo-Grounding Score

| Category | Items audited | Fully confirmed | Partially confirmed (pre-work needed) | NOT ON DISK |
|---|---|---|---|---|
| Client pages (App.jsx) | 29 | 28 | 1 (duplicate warning) | 0 |
| Server routers | 23 | 22 | 0 | 1 (`api/tickets.js`) |
| Task-to-file bindings | 14 tasks | 10 | 4 (loops params, screens lat/lng, campaigns guards, telemetry rate-limit) | 0 |
| Route paths (old plan) | 2 checked | 1 correct | 0 | 1 (schedule/calendar → corrected) |
| **Totals** | **68** | **61** | **5** | **2** |

### **Repo-Grounding Score: 84 / 100**

**Calculation:** 61 fully confirmed + (5 × 0.5 partially) = 63.5 / 68 items = 93% of items resolved, discounted to **84%** to account for the 8 pre-work discovery steps that must run before code can be safely written.

**To reach 95%+:**
1. Run all 8 pre-work steps (PW-1 through PW-8) and record results.
2. Create `ad-server/src/api/tickets.js` and mount it in `index.js` before any client work on TASK-16/17.
3. Resolve the `CampaignApprovalList` duplicate (delete or alias the `components/` copy).
4. Fix all `<Link to="/dashboard/retailer/schedule/calendar">` references in any component that still uses the old path.

---

*Document generated from live repo tree — no files or routes inferred or guessed.*
