# Sprint 23 — Massive E2E Pre-Condition Analysis
**Date:** 2026-06-18  
**Repo:** cfroszte/softomedia-live2026  
**Goal:** Unblock all 6 pre-conditions so the 17-phase Playwright suite can run.  
**Done definition:** `npx playwright test --project=demo-wizard` passes Phase 0–3 (MVP Tier 1) with zero failures.

---

## Executive Summary

All spec files for the massive E2E suite are present in `tests/demo_wizard/`. The blocker is not missing tests — it is 6 application-side pre-conditions. Two are already resolved (`playwright.config.js` timeout is set to `60_000` root / `90_000` demo-wizard; teardown wrapper is in place). Four require code or config changes. The highest-risk item is TASK-3: `SeedService.js` orchestration is correct but `LoopGenerationService.js` slot `startTime` format is unverified.

---

## TASK-1 · Set ALLOW_DEMO_MODE (Pre-Condition #0)

### Blast Radius
Zero. Env var only — no routes, no logic, no files change. Production is protected: `auth.js` already gates on `process.env.ALLOW_DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production'`, so the demo bypass is already active locally without the var when `NODE_ENV=development`. The only real action is confirming the Cloud Run staging service has it set.

### Current State
`auth.js` middleware already contains the correct guard:
```js
const isDemoAllowed = process.env.ALLOW_DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production';
if (isDemoAllowed && authHeader === 'Bearer demo-token') { ... }
```
`DEMO_LINKED_ENTITY_OVERRIDES` maps `brand → adv_002`, `advertiser → adv_001` — both present.

### Pseudocode
```bash
# local .env — add if missing
ALLOW_DEMO_MODE=true

# Cloud Run staging — set via GCP Console or cloudbuild.yaml env block
# Verify: curl -H "Authorization: Bearer demo-token" -H "x-demo-role: admin" \
#   https://staging.api/health → 200 (not 401)
```

### Best Solution
Add `ALLOW_DEMO_MODE=true` to `.env` locally and to the Cloud Run staging service environment. No code change required. Optionally add a startup log line to `auth.js` that prints `[DEMO MODE ACTIVE]` when the flag is set, to make it visible in Cloud Run logs.

### Probability of Success
**99%** — The middleware logic is already correct. This is purely an ops config step with no risk of regression.

---

## TASK-2 · Implement campaigns.js POST stub (Pre-Condition #1)

### Blast Radius
Narrow. The `POST /api/campaigns` handler already exists with full logic: `authenticate + requireRole('advertiser')`, T5 role-tier `advertiser_id` stamping, inventory conflict check, and state machine. The only change is adding a narrow demo-mode short-circuit at the top that returns the deterministic `demo-campaign-001` response. Real callers (non-demo tokens) are completely unaffected.

### Current State
The handler currently returns:
```js
const id = `cmp_${Date.now()}`;
// status defaults to 'pending_approval'
res.status(201).json(campaign);
```
The spec (step 3.7) expects `{ id: 'demo-campaign-001', status: 'active' }`. Two mismatches: the generated ID and the initial status. The spec also asserts both `Authorization: Bearer demo-token` AND `x-demo-role: brand` via `page.route()` intercept — both are already sent correctly by `api.js`.

### Pseudocode
```js
router.post('/', authenticate, requireRole('advertiser'), async (req, res) => {
  // Demo short-circuit — deterministic ID for E2E step 3.7 assertion
  const isDemoRequest = process.env.ALLOW_DEMO_MODE === 'true'
    && req.user?.id === 'demo-brand';

  if (isDemoRequest) {
    return res.status(201).json({
      id: 'demo-campaign-001',
      status: 'active',
      advertiser_id: req.user.linked_entity_id,  // JWT-stamped, never from body (Rule 7)
      name: req.body.name || 'BonVie Summer Demo',
      created_at: new Date().toISOString(),
    });
  }
  // ... all existing real logic unchanged below
});
```

### Best Solution
Add the demo short-circuit at the very top of the POST handler body, guarded by both `ALLOW_DEMO_MODE` and `req.user.id === 'demo-brand'`. This makes the guard maximally narrow — only a demo-mode brand token triggers it. `advertiser_id` must still come from `req.user.linked_entity_id` (never `req.body`) to comply with Rule 7. Do not change the default `pending_approval` status for the real path — it is used by the state machine in `VALID_TRANSITIONS`.

### Probability of Success
**96%** — Handler exists and is solid. Small risk: if the spec's `page.route()` intercept checks response body fields beyond `id` and `status`, those must also match. The `name` field inclusion in the stub response is a safeguard for step 3.8's DOM assertion.

---

## TASK-3 · Fix SeedService dynamic slot timing (Pre-Condition #2)

### Blast Radius
Moderate. `SeedService.js` and potentially `LoopGenerationService.js`. The `SeedService` orchestration is already correct — it calls `generateDailyLoops` with `new Date().toISOString().split('T')[0]` and auto-approves the current-hour loop. The risk is inside `LoopGenerationService.js` (7.8 KB, unread): if slot `startTime` is written as a human-readable string (e.g. `'08:00 AM'` — as seen in the ad seed data) rather than a `Date.now()` epoch integer, the player's time comparison will silently fail and Phase 4 will show "Waiting for Scheduled Slot".

### Current State
`SeedService.js` correctly:
- Calls `loopGenerationService.generateDailyLoops(currentTargetDate, 'ent_costco', 'loc_downtown_01')`
- Filters for `currentHourLoops` using `l.hour === currentTargetHour`
- Auto-approves those loops with `LOOP_STATUS.APPROVED`

**Unverified:** Whether `LoopGenerationService.generateDailyLoops()` writes slots with `startTime = Date.now()` (epoch ms) or an ISO/human-readable string.

### Pseudocode
```js
// LoopGenerationService.js — slot construction must be:
const slot = {
  startTime: Date.now(),                  // ✅ epoch ms — player compares correctly
  endTime:   Date.now() + 3600000,        // ✅ +1 hour
  // NOT: startTime: '2026-06-18T08:00:00Z'   ❌ stale ISO string
  // NOT: scheduled_slot: '08:00 AM'           ❌ unparseable by player
};

// Phase 0 acceptance criterion check:
assert(slot.startTime >= Date.now());
assert(slot.startTime <= Date.now() + 3600000);
```

### Best Solution
1. Read `LoopGenerationService.js` to confirm slot `startTime` format.
2. If using ISO strings: change slot construction to `startTime: Date.now()`.
3. If the player reads `startTime` and compares to `Date.now()`, ensure no timezone offset is introduced.
4. The `SeedService` auto-approve logic (current-hour filter) is correct and should not change.

### Probability of Success
**88%** — Highest risk task due to the unread `LoopGenerationService`. If `startTime` format is already epoch ms, this task is done with zero changes. If it uses ISO strings, a single field change in the slot constructor resolves it. Risk drops to ~5% once `LoopGenerationService.js` is confirmed.

---

## TASK-4 · Confirm PlaylistManagement excluded (Pre-Condition #3)

### Blast Radius
Zero. Comment-only change on an explicitly excluded component. No routes, no tests, no logic affected.

### Current State
`PlaylistManagement.jsx` exists in the client. No spec in `tests/demo_wizard/` should reference it — this needs a grep confirmation.

### Pseudocode
```bash
# Confirm no spec references playlist-management
grep -r "playlist-management" tests/demo_wizard/
# Expected: no output

# Add exclusion comment to component — PlaylistManagement.jsx line 1:
// Explicitly excluded from demo wizard (massivee2e.md Pre-Condition #3)
```

### Best Solution
Run the grep, confirm zero matches, add the comment. Two-minute task.

### Probability of Success
**99%** — Trivial. Only risk is if a spec accidentally references the route, which can be fixed with a one-line spec edit.

---

## TASK-5 · npm audit fix (Pre-Condition #4)

### Blast Radius
Lockfile changes in most cases. `client-app` (React/Vite) carries the highest risk of a semver bump pulling in a breaking peer dep change. `ad-server` (Node/Express) is lower risk — security patches for Express and its middleware tend to be non-breaking patch releases.

### Pseudocode
```bash
# Run in order — do NOT use --force unless reviewed
cd /repo        && npm audit fix
cd ad-server    && npm audit fix
cd client-app   && npm audit fix --legacy-peer-deps  # React peer dep safety net

# Gate: only merge if:
npm audit --audit-level=high  # exits 0 in all three dirs
# Moderate/low vulns can be deferred to a future sprint
```

### Best Solution
Run `npm audit fix` (not `--force`) in all three directories. Review the diff — if only `package-lock.json` changes with no `package.json` version bumps, commit directly. If any `package.json` version changes, run `npm test` and the Playwright smoke suite before committing. Scope the CI gate to `--audit-level=high` only.

### Probability of Success
**90%** — High confidence for `ad-server` and root. `client-app` has a ~10% chance of a React peer dep conflict requiring `--legacy-peer-deps` or manual resolution.

---

## TASK-6 · Playwright timeout + waitForSelector guards (Pre-Condition #5)

### Blast Radius
Minimal. `playwright.config.js` is already correct — `timeout: 60_000` at root, `timeout: 90_000` on the `demo-wizard` project. The `demo-wizard` project is conditional on `ALLOW_DEMO_MODE=true`. The only remaining action is verifying `demo.fixtures.js` `loginAs()` has a `waitForSelector` guard after navigation.

### Current State — Config Already Done ✅
```js
// playwright.config.js — confirmed correct
timeout: 60_000,           // root
// demo-wizard project:
timeout: 90_000,           // Phase 4 needs 35s + margins
```
The `globalTeardown` wrapper (`00_seed.teardown.js`) is also in place, resolving the `file#namedExport` MODULE_NOT_FOUND issue.

### Pseudocode
```js
// demo.fixtures.js — loginAs() should contain:
export async function loginAs(page, persona) {
  await page.evaluate((role) => localStorage.setItem('demo_role', role), persona.role);
  await page.goto('/dashboard');
  // Guard against React.lazy cold load — use data-testid (confirmed in massivee2e.md step 16.4)
  await page.waitForSelector('[data-testid="dashboard-shell"]', { timeout: 60000 });
  // NOT '.main-content-loaded' — CSS class not confirmed in codebase
}
```

### Best Solution
Read `demo.fixtures.js` to confirm the `waitForSelector` guard exists. If missing, add `await page.waitForSelector('[data-testid="dashboard-shell"]', { timeout: 60000 })` after navigation. Use `data-testid="dashboard-shell"` rather than a CSS class, as it is referenced in spec acceptance criteria.

### Probability of Success
**97%** — Config is already done. Risk is only whether `data-testid="dashboard-shell"` is consistently rendered across all persona dashboards.

---

## Completion Order (Critical Path)

| Order | Task | Dependency | Est. Time |
|-------|------|------------|-----------|
| 1 | TASK-1 `ALLOW_DEMO_MODE` | None — unblocks all API calls | 5 min |
| 2 | TASK-2 `campaigns.js` stub | TASK-1 (needs demo mode to test) | 30 min |
| 3 | TASK-3 `SeedService` timing | TASK-1 (seed runs via API) | 30–60 min |
| 4 | TASK-6 `waitForSelector` guard | TASK-1 (needs app running) | 10 min |
| 5 | TASK-4 Playlist exclusion | None — parallel | 5 min |
| 5 | TASK-5 `npm audit fix` | None — parallel | 15 min |

## MVP Gate

| Tier | Phases | Required Tasks | Pass Probability |
|------|--------|----------------|-----------------|
| MVP (Tier 1) | 0–3 | TASK-1 + TASK-2 + TASK-3 | ~97% |
| Full (Tier 2) | 0–16 + teardown | All 6 tasks | ~90% |
