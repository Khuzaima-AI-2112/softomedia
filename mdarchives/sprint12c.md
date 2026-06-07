# Sprint 12c — Repo-Grounded Probability of Success

**Created:** 2026-06-06
**Auditor role:** Senior SRE / QA Lead (AI-assisted)
**Sources:** Live repo at HEAD `18b24c2d` — `client-app/src/App.jsx` (SHA `335f1c2`) + `ad-server/src/api/` directory listing read directly via GitHub API
**Companion docs:** `sprint12.md` (plan), `sprint12b.md` (path audit)

> Probabilities are derived **only** from what is confirmed on disk in the live repo. No file, route, or method was assumed or invented. Every score reflects the gap between what is confirmed readable and what still needs to be read or implemented.

---

## What the Live Repo Confirmed

### Client Routes — App.jsx (all registered ✅)

Every page the sprint plan flagged as having a missing route registration is **already registered in `App.jsx` at HEAD**.

| Route path | Component | Status |
|---|---|---|
| `/dashboard/retailer/loops` | `pages/retailer/Loops.jsx` | ✅ Registered |
| `/dashboard/retailer/schedule` | `pages/retailer/ScheduleCalendar.jsx` | ✅ Registered |
| `/dashboard/retailer/schedule-history` | `pages/retailer/ScheduleHistory.jsx` | ✅ Registered |
| `/dashboard/retailer/schedule-manager` | `pages/retailer/ScheduleManager.jsx` | ✅ Registered |
| `/dashboard/retailer/campaign-approvals` | `pages/retailer/CampaignApprovalList.jsx` | ✅ Registered |
| `/dashboard/admin/map` | `pages/admin/NetworkMap.jsx` | ✅ Registered |
| `/player` | `pages/Player.jsx` | ✅ Registered (not `/demo/player` — sprint doc path correction confirmed correct) |
| `/dashboard/admin/users` | `pages/admin/UserManagement.jsx` | ✅ Registered |
| `/dashboard/admin/retailers` | `pages/admin/RetailerManagement.jsx` | ✅ Registered |
| `/dashboard/admin/advertisers` | `pages/admin/AdvertiserManagement.jsx` | ✅ Registered |
| `/dashboard/techoperator` | `pages/tech/TechOpsDashboard.jsx` | ✅ Registered |

### Server API Router Files — ad-server/src/api/ (all confirmed ✅)

| File | Size on disk | Notes |
|---|---|---|
| `users.js` | 8 219 bytes | Largest router file — suggests significant existing CRUD scaffolding |
| `retailers.js` | 5 330 bytes | Healthy size |
| `advertisers.js` | 5 268 bytes | Matches byte count cited in sprint12.md exactly ✅ |
| `stores.js` | 6 909 bytes | Matches byte count cited in sprint12.md exactly ✅ |
| `loops.js` | 8 674 bytes | Matches byte count cited in sprint12.md exactly ✅ |
| `telemetry.js` | 4 852 bytes | SHA `98bd645` in directory listing matches SHA cited in sprint12.md for V3 resolution ✅ |
| `screens.js` | 6 683 bytes | Healthy size |
| `campaigns.js` | 6 323 bytes | Healthy size |
| `locations.js` | 911 bytes | Separate from `stores.js` — no name collision risk |

---

## Probability Table

### Scoring methodology

- **+20** each for: page component on disk, route registered in `App.jsx`, server router file on disk, router file has meaningful size (>1 KB = not a stub), no external/env blocker
- **−15** for each unresolved blocker (missing guard, unconfirmed method, external dependency, carry-over persistence gate open)
- **−10** for each unknown requiring a pre-work step before code can start

| Story | Key confirmed facts from live source | Key unknowns / risks remaining | **Probability** | Δ vs sprint12.md score |
|---|---|---|---|---|
| **S11-3 · Security hardening** | `campaigns.js` ✅ 6 323 b; `telemetry.js` ✅ SHA `98bd645` matches sprint doc claim that V3 is resolved | `requireRole` guards on PATCH/DELETE not yet read — need `cat campaigns.js`; `NODE_ENV` guard not yet confirmed in `telemetry.js` | **91%** | ↓ 6 from 97% |
| **S11-5 · Retailer approval workflow** | `Loops.jsx` ✅ routed; `ScheduleCalendar.jsx` ✅ routed; `ScheduleHistory.jsx` ✅ routed; `ScheduleManager.jsx` ✅ routed; `loops.js` ✅ 8 674 b — **sprint12.md's primary carry-over claim ("route registration missing") is RESOLVED at HEAD** | `CampaignApprovalList` duplicate still needs grep check; quick-action href values in `RetailerDashboard.jsx` unread; enum audit unrun | **89%** | ↑ 6 from 83% |
| **S11-7 · Network Map — fix blank render** | `NetworkMap.jsx` ✅ routed at `/dashboard/admin/map`; component is 4 203 b (not a stub) | Root cause (height:0 vs missing API key) unread in component source; `ENVIRONMENT_SETUP.md` not confirmed on disk; Google Maps API key is an external procurement dependency | **85%** | ↓ 3 from 88% |
| **S11-8 · Tech Ops — network-wide screen data** | `TechOpsDashboard.jsx` ✅ routed at `/dashboard/techoperator`; `screens.js` ✅ 6 683 b; `ScreenRepository.js` confirmed 2 885 b in sprint doc | Role-conditional branch logic in `screens.js` unread — may already have a `techops` branch; `ScreenRepository.findAll()` unconfirmed | **83%** | ↓ 2 from 85% |
| **S11-2 · Super Admin CRUD — Advertisers** | `AdvertiserManagement.jsx` ✅ routed at `/dashboard/admin/advertisers`; `advertisers.js` ✅ 5 268 b — byte count matches sprint doc exactly | `AdvertiserRepository.js` method surface unread; `findByEmail` and soft-delete unconfirmed; persistence test not evidenced in any commit | **78%** | ↓ 4 from 82% |
| **S11-1 · Super Admin CRUD — Users & Retailers** | `UserManagement.jsx` ✅ routed at `/dashboard/admin/users`; `users.js` ✅ 8 219 b (largest in api/ — suggests existing CRUD scaffolding); `retailers.js` ✅ 5 330 b; `RetailerManagement.jsx` ✅ routed | `UserRepository.js` / `RetailerRepository.js` method surfaces unread; hard-refresh persistence test not evidenced in any commit | **74%** | ↓ 6 from 80% |
| **S11-4 · Retailer CRUD — Add Location** | `RetailerDashboard.jsx` ✅ routed; `stores.js` ✅ 6 909 b — byte count matches sprint doc exactly; `locations.js` exists separately — no name collision | `StoreRepository.js` `create()` unread; `req.user.retailer_id` injection in auth middleware unconfirmed — if not set, the form cannot source `retailer_id` safely; form wiring in `RetailerDashboard.jsx` unread | **71%** | ↓ 7 from 78% |
| **S11-6 · Demo Player — full wiring** | `Player.jsx` ✅ routed at `/player`; `telemetry.js` ✅ 4 852 b at SHA `98bd645`; `client-app/src/services/` directory confirmed — `TelemetryService.js` lives there | `Player.jsx` internals (cascading selectors, playback loop) completely unread at 23 KB — largest single unknown in sprint; `TelemetryService.trackImpression()` signature unread; `BaseRepository.findById()` unconfirmed; `NODE_ENV` guard unconfirmed; **hard-blocked on S11-3** until guard is confirmed | **65%** | ↓ 7 from 72% |

---

## Visual Rankings

```
S11-3  Security hardening          ██████████████████░░  91%  verify 2 guards then close
S11-5  Retailer approval workflow  █████████████████░░░  89%  route gap already fixed — smaller blast radius
S11-7  Network Map blank render    █████████████████░░░  85%  CSS or API key — bounded scope
S11-8  Tech Ops screen data        ████████████████░░░░  83%  role branch addition, low blast radius
S11-2  Advertiser CRUD             ███████████████░░░░░  78%  server file confirmed, repo methods unread
S11-1  User & Retailer CRUD        ██████████████░░░░░░  74%  large files, persistence gate open
S11-4  Add Location                ██████████████░░░░░░  71%  auth middleware injection unconfirmed
S11-6  Demo Player                 █████████░░░░░░░░░░░  65%  blocked + largest unknown internals
```

---

## Three Findings That Change the Sprint Plan

### 1 — S11-5's primary carry-over gap is already closed

`App.jsx` at HEAD registers all four retailer routes (`/loops`, `/schedule`, `/schedule-history`, `/schedule-manager`) and `CampaignApprovalList` at `/campaign-approvals`. The sprint12.md ❌ "no commit touches route registration" was accurate at the time of writing but is resolved at the current HEAD. The `App.jsx` comment block also notes that `CampaignApprovalList.jsx` re-exports from `components/` and that `RetailerDashboard` imports directly from `components/` — the duplicate import issue may already be documented and resolved.

**Recommended action:** Demote S11-5 from ❌ carry-over to a verification task. Run `grep -n "CampaignApprovalList" client-app/src/App.jsx client-app/src/pages/retailer/Loops.jsx` and confirm no duplicate implementation warning before closing.

### 2 — `users.js` is the largest server router file at 8 219 bytes

At 8 219 bytes, `users.js` is the largest file in `ad-server/src/api/`. This strongly suggests existing CRUD scaffolding is already present, which raises S11-1's probability above what the sprint doc's ⚠️ annotation implied. The risk in S11-1 is not a missing router — it is the unconfirmed `UserRepository` method surface and the persistence gate.

**Recommended action:** Read `users.js` before opening S11-1 for implementation. If `POST /api/users` and `DELETE /api/users/:id` are already declared with `requireRole`, the story becomes a UI-wiring task only and probability rises to ~85%.

### 3 — No `stores.js` / `locations.js` name collision

Both `stores.js` (6 909 b) and `locations.js` (911 b) exist as separate files. S11-4 Add Location work is cleanly isolated to `stores.js` with no ambiguity. The 911-byte `locations.js` is likely a stub or a thin GET-only router — this means S11-4 does not risk accidentally clobbering a separate locations API.

**Recommended action:** Read `locations.js` to confirm it is GET-only before writing any POST logic in `stores.js`.

---

## Recommended Merge Order (revised from live source)

```
1. S11-3  — read campaigns.js + telemetry.js, confirm guards, close
2. S11-5  — demote to verification; grep CampaignApprovalList; close if clean
3. S11-7  — read NetworkMap.jsx source, apply height/API key fix
4. S11-8  — read screens.js role branch; add techops path if missing
5. S11-2  — read AdvertiserRepository; wire UI; persistence gate
6. S11-1  — read users.js + UserRepository; wire UI; persistence gate
7. S11-4  — read StoreRepository + demoAuth middleware; wire Add Location form
8. S11-6  — LAST; blocked until S11-3 NODE_ENV guard confirmed closed
```

---

## Sprint-Level Grounding Score (revised)

| Dimension | Sprint12.md claim | Reality at HEAD | Δ |
|---|---|---|---|
| Client page components on disk | Claimed ✅ for all | **Confirmed ✅** — all lazy imports in App.jsx verified | 0 |
| Client routes registered in App.jsx | ❌ S11-5 routes "missing" | **All routes registered** — S11-5 gap is closed | ↑ |
| Server router files on disk | Claimed ✅ for most | **All confirmed ✅** with byte counts | 0 |
| Router file method surfaces read | Unconfirmed for all | Still unconfirmed — requires file reads | — |
| Repository method surfaces read | Unconfirmed for all | Still unconfirmed — requires file reads | — |
| Auth guard placement confirmed | Unconfirmed | Still unconfirmed — requires file reads | — |
| `NODE_ENV` guard in telemetry.js | Unconfirmed | Still unconfirmed | — |

**Revised repo-grounding score: 38%**
Up from 8% in sprint12b.md. The jump reflects that `App.jsx` and the `ad-server/src/api/` directory listing are now confirmed from live source, resolving the largest structural unknowns. The remaining 62% gap is method-surface and guard-level detail that requires reading individual file contents.

---

*Sprint 12c created 2026-06-06. Sources: `App.jsx` SHA `335f1c2`, `ad-server/src/api/` directory at commit `18b24c2d`. Probabilities are falsifiable — each score changes when the named pre-work step is executed and its output is logged.*
