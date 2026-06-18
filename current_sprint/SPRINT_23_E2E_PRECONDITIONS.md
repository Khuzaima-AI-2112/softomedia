# Sprint 23 — Massive E2E Pre-Condition Resolution
**Date:** 2026-06-18
**Goal:** Unblock all 6 pre-conditions in massivee2e.md so the full 17-phase suite can run.
**Done definition:** `npx playwright test --project=demo-wizard` passes Phase 0–3 (MVP Tier 1) with zero failures.

---

## Tickets

### TASK-1 · Set ALLOW_DEMO_MODE (Pre-Condition #0)
**Priority:** P0 — hard gate, every API call returns 401 without this
**File:** `.env` / Cloud Run staging env vars
- Confirm `ALLOW_DEMO_MODE=true` is set in local `.env`
- Confirm staging Cloud Run service has the env var set
- Verify `process.env.ALLOW_DEMO_MODE === 'true'` in `ad-server/src/middleware/auth.js` demo bypass path
- **Done:** `Bearer demo-token` requests return non-401 on staging

---

### TASK-2 · Implement campaigns.js POST stub (Pre-Condition #1)
**Priority:** P0 — Phase 3 step 3.7 fails with 404 without this
**File:** `ad-server/src/routes/campaigns.js`
- Add POST `/api/campaigns` handler returning `{ id: 'demo-campaign-001', status: 'active' }`
- Must require `authenticate` + `requireRole('brand', 'admin')` — do not skip auth
- Route must be registered **above** any `/:id` wildcard handlers (Rule 6)
- `advertiser_id` must be stamped from `req.user.linked_entity_id`, not `req.body` (Rule 7)
- **Done:** `POST /api/campaigns` with `x-demo-role: brand` → `201 { id: 'demo-campaign-001', status: 'active' }`

---

### TASK-3 · Fix SeedService dynamic slot timing (Pre-Condition #2)
**Priority:** P0 — Phase 4 player broadcast times out without this
**File:** `ad-server/src/services/SeedService.js` (or equivalent seed script)
- Replace any hardcoded ISO slot `startTime` with `Date.now()`
- Slot must satisfy: `startTime >= Date.now()` AND `startTime <= Date.now() + 3600000`
- **Done:** Phase 0 acceptance criterion passes; Phase 4 step 4.1 no longer shows "Waiting for Scheduled Slot"

---

### TASK-4 · Confirm PlaylistManagement excluded (Pre-Condition #3)
**Priority:** P1 — confirmation only, no code change
- Verify `PlaylistManagement.jsx` is not referenced in any Phase 0–16 spec step
- Add `// Explicitly excluded from demo wizard` comment at top of component
- **Done:** No spec file references `/dashboard/*/playlist-management`

---

### TASK-5 · Run npm audit fix (Pre-Condition #4)
**Priority:** P1
**Directory:** repo root + `ad-server/` + `client-app/`
- Run `npm audit fix` in each directory
- Commit the resulting lockfile changes
- **Done:** `npm audit --audit-level=high` exits 0 in all three directories

---

### TASK-6 · Playwright global timeout + waitForSelector guards (Pre-Condition #5)
**Priority:** P1
**File:** `playwright.config.js`
- Set `timeout: 60000` globally
- Add `await page.waitForSelector('.main-content-loaded')` guard in `demo.fixtures.js` `loginAs()` helper, after navigation, on all `React.lazy` routes
- **Done:** No test times out on cold React.lazy load during Phase 1 provisioning steps

---

## Completion Order (Critical Path)

1. **TASK-1** (env) — unblocks all API calls
2. **TASK-2** (campaigns POST) — unblocks Phase 3
3. **TASK-3** (seed timing) — unblocks Phase 4
4. **TASK-6** (timeouts) — unblocks CI stability
5. **TASK-4 + TASK-5** — parallel, no dependencies

## MVP Gate
TASK-1 + TASK-2 + TASK-3 resolved = Phases 0–3 runnable (Tier 1 MVP).
All 6 tasks resolved = Full 17-phase suite runnable (Tier 2).
