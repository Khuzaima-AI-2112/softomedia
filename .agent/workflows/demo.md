# /demo — Full E2E Demo Wizard Workflow

> **Trigger**: `/demo`  
> **File**: `.agent/workflows/demo.md`  
> **Suite**: `tests/demo_wizard/` — 6 phase spec files, 33 serial steps, 5 personas  
> **Purpose**: Prove every user-input surface works end-to-end with real Firestore seed data

---

## Overview

This workflow executes the 16-phase demo suite documented in `current_sprint/massivee2e.md`.
The MVP tier (Phases 1–6, spec files `01`–`06`) exercises the full business loop:
Admin provisions → Retailer schedules → Brand books a campaign → Player broadcasts →
TechOps verifies → Admin validates and tears down.

---

## Pre-Flight Checks

Run these in order before invoking Playwright. Abort and fix if any check fails.

### 1. Environment guard
```bash
echo $ALLOW_DEMO_MODE
# Must print: true
# If empty or 'false': export ALLOW_DEMO_MODE=true before proceeding.
# The seed will throw a fatal error if this is not set.
```

### 2. API port
```bash
curl -s http://localhost:3001/health | grep -i ok
# Must return a JSON body containing 'ok' or status 200.
# If not running: npm start --prefix ad-server
```

### 3. Client app
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
# Must return 200.
# If not running: npm run dev --prefix client-app
```

### 4. Test creative asset
```bash
ls -lh tests/test-ad.png
# Must exist. Phase 3 step 3.6 uploads this file.
# If missing: copy any PNG into tests/test-ad.png
```

### 5. /validate-testids (strongly recommended before first run)
```
Run /validate-testids workflow.
This confirms every data-testid referenced in the spec files exists in JSX.
A missing testid produces a timeout, not a clear selector error.
```

### 6. /hygiene (recommended)
```
Run /hygiene workflow.
Ensures no stale console.log, bare imports, or CJS require calls that could
cause the ad-server to fail to start before the suite runs.
```

---

## Run Command

```bash
ALLOW_DEMO_MODE=true npx playwright test --project=demo-wizard
```

To run a single phase during development:
```bash
ALLOW_DEMO_MODE=true npx playwright test --project=demo-wizard tests/demo_wizard/03_brand_campaign_wizard.spec.js
```

To run with the full HTML report:
```bash
ALLOW_DEMO_MODE=true npx playwright test --project=demo-wizard && npx playwright show-report
```

---

## Phase Summary

| File | Phase | Persona | Steps | Key assertions |
|------|-------|---------|-------|----------------|
| `00_seed.setup.js` | 0 — Seed | — | globalSetup | Slots at `Date.now()`, all 4 personas auth-stated |
| `01_admin_provision.spec.js` | 1 — Admin | `admin` | 10 | Retailer, 2 stores, 4 screens, biz hours, advertiser, loop, pricing, 2 users created |
| `02_retailer_schedule.spec.js` | 2 — Retailer | `retaileradmin` | 4 | Schedule calendar renders all screens; override id starts `sched_demo_` |
| `03_brand_campaign_wizard.spec.js` | 3 — Brand Wizard | `brand` | 8 | All 5 wizard steps complete; POST /api/campaigns fires with brand role header |
| `04_player_broadcast.spec.js` | 4 — Player | public | 4 | Ad plays in current-hour slot; transition fires; telemetry heartbeat asserted |
| `05_techops_health.spec.js` | 5 — TechOps | `techop` | 3 | Health chips render green; demo campaign visible in status panel |
| `06_admin_validate.spec.js` | 6 — Validate | `admin` | 4 | Campaign in Admin Overview; screens in Network Map; campaign deleted cleanly |
| `00_seed.setup.js` | — | — | globalTeardown | All seed documents deleted from Firestore |

**Total: 33 serial steps across 5 personas.**

---

## Pass Criteria

The suite is considered passing when:

- [ ] Playwright reports `0 failed` for the `demo-wizard` project
- [ ] `globalTeardown` log line appears: `[00_seed.setup.js] Demo teardown complete.`
- [ ] No `[teardown] fetch error` warnings in console output
- [ ] Firestore is clean: no `demo-*` documents remain (spot-check via Firebase Console)
- [ ] HTML report shows all 33 steps green with no retries on the first attempt

A suite with retries that ultimately passes is **not** a clean pass. Retries indicate
a flaky assertion or a timing issue that must be fixed before declaring the demo stable.

---

## Expected Runtime

| Environment | Expected runtime |
|-------------|------------------|
| Local (warmed dev servers) | 4–6 minutes |
| CI (cold start, Chromium only) | 8–12 minutes |
| CI with `--retries=2` on failure | up to 25 minutes |

Phase 3 is the longest phase (~45s) because each step re-runs all preceding wizard
steps to maintain test isolation. This is by design — see spec file comment.

---

## First-Run Failure Triage

Use this table before opening issues. Most first-run failures have a known cause.

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `[00_seed] ALLOW_DEMO_MODE env var is not set` | Env var missing | `export ALLOW_DEMO_MODE=true` |
| `Seed failed [POST /api/retailers]: ECONNREFUSED` | ad-server not running on port 3001 | `npm start --prefix ad-server` |
| `loginAs: demo_role mismatch` | DemoAuthProvider key conflict (PR #46 regression) | Check `authToken` vs `auth_token` in DemoAuthProvider.jsx |
| `Timeout waiting for [data-testid="wizard-step-2"]` | testid missing from JSX | Run `/validate-testids`; add missing testid |
| `player-waiting-state visible` (Phase 4) | Slot timing drift — seed ran before `buildDemoSlots()` fix | Confirm `00_seed.setup.js` has `currentHourStart = now - (now % 3_600_000)` |
| `assertRoleHeader: no request matching '/api/campaigns' intercepted` | campaigns.js POST stub not running | Confirm ad-server started cleanly; check `npm start` output for port conflict |
| `sched_demo_` prefix assertion fails (Phase 2 step 2.3) | ad-server running without `ALLOW_DEMO_MODE=true` | Restart ad-server with env var set |
| Phase 6 teardown warning `404` on campaign DELETE | Campaign was already deleted by a prior partial run | Safe to ignore; teardown treats 404 as success |
| `globalTeardown: fetch error` for any endpoint | ad-server shut down before teardown completed | Increase `webServer.timeout` in `playwright.config.js` |

---

## Scope Notes

**In scope (MVP tier, Phases 1–6):**
All 19 routed screens touched by a user input or creation action. Every POST,
upload, and form submission asserted via role header or response inspection.

**Explicitly out of scope for this workflow:**
- Phases 7–16 (loop inventory, campaign approval gate, schedule manager, advertiser
  dashboard, tickets, analytics, pricing config, login flows) — documented in
  `current_sprint/massivee2e.md` for future spec files `07`–`16`.
- `LoopBuilder.jsx`, `PlaylistManagement.jsx`, `TechOpsDashboard.jsx` — zero routes;
  excluded until wired up.
- AI Log assertions — `AILog.jsx` renders a static placeholder; no live log data.
- Firefox and WebKit — demo project uses Chromium only. Cross-browser coverage
  is the responsibility of the `/bigtest` workflow.

---

## Relationship to Other Workflows

| Workflow | When to run relative to `/demo` |
|----------|---------------------------------|
| `/validate-testids` | Always before first run on a new branch |
| `/hygiene` | Always before first run on a new branch |
| `/smoke-test` | Run first if you suspect dev servers are broken |
| `/bigtest` | Run after `/demo` passes to confirm no regression in existing specs |
| `/security` | Run independently — not a dependency of `/demo` |

---

*Workflow version: 1.0.0 — created 2026-06-17*  
*Spec files: `tests/demo_wizard/01`–`06_*.spec.js`*  
*Config: `playwright.config.js` → project `demo-wizard`*
