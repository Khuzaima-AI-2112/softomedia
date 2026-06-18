# Massive E2E — Gap Closure Plan
**Date:** 2026-06-17
**Status:** Draft — pre-implementation
**Author:** Architecture Review / SRE
**Depends on:** `massivee2e.md` (Phases 0–16) passing first

This document answers one question: **"If all 16 phases in `massivee2e.md` pass, does the whole app work?"**

The answer is: **not yet, but it can be made true.** Four structural gaps remain. Close all four and the following strong statement becomes true:

> *If all steps in `massivee2e.md`, Phase K (API surface smoke), and the Firestore Rules suite pass — then every user-facing flow, every API endpoint, and every data access rule in the application has been exercised at least once with a falsifiable assertion.*

All router mount points confirmed from `ad-server/src/api/index.js` (commit `444577d`).

For the complete 18-file spec register, see the **Spec File Register** section at the bottom of this document.
For pre-conditions and auth reset, see `massivee2e.md` → "Critical Pre-Conditions" and `tests/demo_wizard/demo.fixtures.js`.

---

## What the 16-Phase Workflow Already Proves

When every step in `massivee2e.md` passes, the following is verified:

- Every UI route in `App.jsx` (Sprint 22, 34 routes) renders without crashing
- Every user persona (`admin`, `retaileradmin`, `brand`, `advertiser`, `techop`) authenticates and receives the correct role header
- Every core user-input surface has been exercised: creation, update, delete, file upload, approval
- The full causal business chain is intact: Admin provisions → Retailer approves → Brand submits → Player broadcasts → TechOps confirms
- Cross-phase Firestore state is coherent: data created in step N is visible and correct in step N+1

That is comprehensive UI + integration coverage. **For a demo and regression gate, it is sufficient.** For the strong production-quality statement, four gaps remain.

---

## Gap 1 — 7 Backend API Routers With Zero E2E Coverage

### Problem

Cross-referencing `ad-server/src/api/index.js` against every API call made in `massivee2e.md` reveals 7 mounted routers that are **never touched** by any phase:

| Router | Mount path | Auth required | Size | What it does | Risk if silently broken |
|--------|-----------|---------------|------|-------------|------------------------|
| `ads.js` | `/api/ads` | Public | 761 B | Serves individual ad creative to the player | Player renders blank with no error |
| `audit.js` | `/api/audit` | ✅ Protected | 2,150 B | Audit log entries for all mutations | Silent data loss — no trail of changes |
| `impressions.js` | `/api/impressions` | ✅ Protected | 4,300 B | Records each ad impression shown | Billing and reporting silently wrong |
| `monitoring.js` | `/api/monitoring` | ✅ Protected | 2,795 B | System-level health metrics | TechOps health page shows fake green |
| `notifications.js` | `/api/notifications` | ✅ Protected | 5,216 B | Push/in-app notifications | Users never notified of approvals/rejections |
| `ops.js` | `/api/ops` | ✅ Protected | 880 B | Internal admin ops commands | Admin ops tools silently broken |
| `locations.js` | `/api/locations` | ✅ Protected | 911 B | Location data for stores/screens | Geo-targeting silently fails |

**Note on `playlist` vs `playlists`:** Both are mounted. `index.js` documents the distinction:
- `/api/playlist` (singular) — the **Player endpoint**, public, serves the current slot to a screen device
- `/api/playlists` (plural) — the **Admin CRUD**, protected, manages playlist templates

`/api/playlist` is exercised indirectly by Phase 4 (Player broadcast). `/api/playlists` has zero coverage. Both must be tested separately.

### Resolution: Phase K — API Surface Smoke Test

**Spec file:** `tests/demo_wizard/17_api_surface_smoke.spec.js`
**Persona:** `DEMO_ADMIN` | `x-demo-role: admin` (covers all protected routes)
**Type:** Playwright `request` fixture calls only — no UI navigation required

| Step | Endpoint | Method | Headers | Acceptance Criterion |
|------|----------|--------|---------|---------------------|
| K.1 | `GET /api/ads` | GET | none (public) | Status `200` or `404`; must not be `500` or connection refused |
| K.2 | `GET /api/audit` | GET | `x-demo-role: admin` | Status `200`; body is array (may be empty); no `500` |
| K.3 | `GET /api/impressions` | GET | `x-demo-role: admin` | Status `200`; body is array or paginated object; no `500` |
| K.4 | `GET /api/monitoring` | GET | `x-demo-role: admin` | Status `200`; body contains at least one health/metric key; no `500` |
| K.5 | `GET /api/notifications` | GET | `x-demo-role: admin` | Status `200`; body is array (may be empty); no `500` |
| K.6 | `GET /api/ops` | GET | `x-demo-role: admin` | Status `200` or `204`; no `500` |
| K.7 | `GET /api/locations` | GET | `x-demo-role: admin` | Status `200`; body is array; FreshMart store locations visible; no `500` |
| K.8 | `GET /api/playlists` | GET | `x-demo-role: admin` | Status `200`; body is array; no `500`; confirms `/api/playlists` (Admin CRUD) is distinct from `/api/playlist` (Player endpoint) |
| K.9 | `GET /api/dashboard` | GET | `x-demo-role: admin` | Status `200`; body is non-null object; no `500` |
| K.10 | `GET /api/audit` | GET | no headers | Status `401`; body contains `{ error: 'Unauthorized' }` or equivalent — proves protected routes reject unauthenticated callers |

```js
import { test, expect } from '@playwright/test';
import { DEMO_ADMIN, BASE_URL, DEMO_TOKEN } from './demo.fixtures.js';

test.describe.serial('Phase K — API Surface Smoke', () => {
  let request;

  test.beforeAll(async ({ playwright }) => {
    request = await playwright.request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: {
        'Authorization': `Bearer ${DEMO_TOKEN}`,
        'x-demo-role': DEMO_ADMIN.role,
      },
    });
  });

  test('K.1 — /api/ads responds (public)', async () => {
    const res = await request.get('/api/ads');
    expect([200, 404]).toContain(res.status());
  });

  test('K.10 — /api/audit rejects unauthenticated', async () => {
    const unauthReq = await playwright.request.newContext({ baseURL: BASE_URL });
    const res = await unauthReq.get('/api/audit');
    expect(res.status()).toBe(401);
    await unauthReq.dispose();
  });

  // K.2–K.9: same pattern with admin headers

  test.afterAll(async () => { await request.dispose(); });
});
```

---

## Gap 2 — Error Paths Are Untested (Happy Path Only)

### Problem

Every step in `massivee2e.md` assumes success. No step intentionally triggers:
- A **form validation error** (submit wizard with no screens selected)
- A **403** by calling a write endpoint with the wrong role
- A **404** on a missing or deleted resource
- A **network failure** surfaced by `NetworkErrorBanner` (mounted in `App.jsx`, never triggered)

The Sprint 11 `BaseRepository.update()` silent-catch lesson proves this codebase has a history of swallowing errors. A suite that only runs happy paths will not catch regressions where the UI silently fails.

### Resolution: One Negative Assertion Per Phase

Add one negative `test` block to each existing phase spec. No new files required.

| Phase | Spec file | Negative step | How to trigger | Acceptance Criterion |
|-------|-----------|---------------|----------------|---------------------|
| Phase 1 (Admin) | `01_admin_provision.spec.js` | Wrong-role write | `POST /api/retailers` with `x-demo-role: brand` | Response `403`; UI shows error banner; Firestore does not contain a new retailer doc |
| Phase 2 (Retailer) | `02_retailer_schedule.spec.js` | Missing required field | Submit schedule override with no time range | Client-side validation fires; `POST /api/schedules/override` is **not** called; error message visible |
| Phase 3 (Brand Wizard) | `03_brand_campaign_wizard.spec.js` | Submit with no screens | Clear all screen checkboxes, click Next on Step 1 | "Next" disabled OR inline validation appears; `wizardData.selectedScreens` is empty; no route advance |
| Phase 4 (Player) | `04_player_broadcast.spec.js` | Invalid screen token | Open `/player?screen=nonexistent-screen` | Player shows "Screen not found" error state; `GET /api/screens/nonexistent-screen/playback-loop` returns `404` |
| Phase 8 (Approval) | `08_retailer_approval.spec.js` | Reject instead of approve | Click Reject on BonVie campaign | `POST /api/campaigns/demo-campaign-001/reject` returns `200`; status → "Rejected"; `test.afterAll` restores to `approved` before Phase 9 |
| Phase 11 (Advertiser) | `11_advertiser_dashboard.spec.js` | Access admin route as advertiser | Navigate to `/dashboard/admin/retailers` as `x-demo-role: advertiser` | `403` or redirect to `/dashboard/advertiser`; admin content not rendered |
| Phase 14 (Tickets) | `14_ticket_system.spec.js` | Access nonexistent ticket | `GET /api/tickets/nonexistent-ticket-id` | Response `404`; no ticket content rendered; no `500` |
| Phase K (API Smoke) | `17_api_surface_smoke.spec.js` | Unauthenticated access | `GET /api/audit` with no headers | Response `401`; body contains error key; not `200` |

**Note on Phase 8 reject path:** Run as the **last step of Phase 8**, after all approval assertions pass. `test.afterAll` must restore `demo-campaign-001` to `approved` status before Phase 9 runs.

---

## Gap 3 — `playlist.js` / `playlists.js` Naming Ambiguity

### Problem

Two routers with nearly identical names are both mounted in `index.js`. This is the same naming pattern that caused the `TicketDashboard`/`CampaignApprovalList` duplicate-file CI failure. If a developer accidentally routes a new feature to `/api/playlist` instead of `/api/playlists`, the Retailer Loops page silently returns Player data.

### Resolution: Pre-flight Disambiguation Check

**Location:** `test.beforeAll` in `07_retailer_loops.spec.js`

```js
test.beforeAll('playlist/playlists disambiguation pre-flight', async ({ request }) => {
  // Public Player endpoint — no auth required
  const playerRes = await request.get('/api/playlist');
  expect(playerRes.status()).not.toBe(500);

  // Admin CRUD endpoint — requires auth
  const adminRes = await request.get('/api/playlists', {
    headers: { 'Authorization': `Bearer ${DEMO_TOKEN}`, 'x-demo-role': 'admin' },
  });
  expect(adminRes.status()).toBe(200);

  // Prove they return different shapes
  const adminBody = await adminRes.json();
  expect(Array.isArray(adminBody)).toBe(true); // Admin CRUD always returns array of templates
});
```

**Additional hygiene check:** Add to `/hygiene` workflow — assert no two files in `ad-server/src/api/` have names that differ only by plurality. Emit a warning (not a failure) when found, requiring a disambiguating comment in `index.js`.

---

## Gap 4 — Firestore Security Rules Are Never Exercised

### Problem

The entire E2E suite uses `demo-token` + `x-demo-role` which routes through Express middleware only — it does **not** exercise Firestore Security Rules. If Rules deny `brand` role reads on the `campaigns` collection, the Brand Dashboard will appear empty in production even though every E2E phase passes.

This is not hypothetical: real-time Firestore listeners (slot fill updates, screen heartbeat, impression counters) are denied by Rules silently — the UI shows stale data with no error.

### Resolution: Firestore Rules Unit Test Suite

**New file:** `tests/firestore-rules/rules.test.js`
**Tool:** `@firebase/rules-unit-testing`
**Runs:** Separately — `npm run test:rules` (not part of Playwright)

**Test matrix:**

| Collection | Admin R | Admin W | Brand R | Brand W | Retailer R | Retailer W | Public R |
|------------|---------|---------|---------|---------|-----------|-----------|----------|
| `retailers` | ✅ | ✅ | ❌ | ❌ | ✅ own | ❌ | ❌ |
| `stores` | ✅ | ✅ | ❌ | ❌ | ✅ own | ✅ own | ❌ |
| `screens` | ✅ | ✅ | ❌ | ❌ | ✅ own | ❌ | ❌ |
| `campaigns` | ✅ | ✅ | ✅ own | ✅ own | ✅ own | ❌ | ❌ |
| `loops` | ✅ | ✅ | ❌ | ❌ | ✅ own | ❌ | ❌ |
| `users` | ✅ | ✅ | ✅ own | ✅ own | ✅ own | ❌ | ❌ |
| `telemetry` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ (device write) |
| `impressions` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ (device write) |

```js
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'softomedia-demo',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: 'localhost',
      port: 8090,
    },
  });
});

test('Brand can read own campaigns', async () => {
  const db = testEnv
    .authenticatedContext('demo-brand-uid', { role: 'brand', advertiserId: 'demo-bonvie' })
    .firestore();
  await assertSucceeds(
    db.collection('campaigns').where('advertiserId', '==', 'demo-bonvie').get()
  );
});

test('Brand cannot read other advertisers campaigns', async () => {
  const db = testEnv
    .authenticatedContext('demo-brand-uid', { role: 'brand', advertiserId: 'demo-bonvie' })
    .firestore();
  await assertFails(
    db.collection('campaigns').where('advertiserId', '==', 'other-advertiser').get()
  );
});

afterAll(async () => { await testEnv.cleanup(); });
```

**CI integration:**
```json
"scripts": {
  "test:rules": "firebase emulators:exec --only firestore 'jest tests/firestore-rules/'"
}
```
Add `test:rules` as a required CI step before the Playwright suite runs.

---

## Effort Summary

| Gap | Work required | Estimated effort | Blocks strong statement? |
|-----|--------------|-----------------|-------------------------|
| **Gap 1** — 7 uncovered routers | Phase K: 10 `request` fixture calls in `17_api_surface_smoke.spec.js` | ~1 hour | Yes |
| **Gap 2** — Error paths | 8 negative steps added to existing spec files | ~2 hours | Yes |
| **Gap 3** — playlist/playlists ambiguity | `beforeAll` in `07_retailer_loops.spec.js` + hygiene rule | ~30 min | Partial |
| **Gap 4** — Firestore Rules | `tests/firestore-rules/rules.test.js` + emulator CI step | ~4 hours | Yes |
| **Total** | | **~7–8 hours** | Zero new application code required |

---

## Spec File Register (Complete Suite — Single Source of Truth)

```
tests/
  firestore-rules/
    rules.test.js                          ← Gap 4: Firestore Rules
  demo_wizard/
    demo.fixtures.js                       ← shared personas, beforeEach auth reset
    00_seed.setup.js
    01_admin_provision.spec.js             + negative: wrong-role write (Gap 2)
    02_retailer_schedule.spec.js           + negative: missing field (Gap 2)
    03_brand_campaign_wizard.spec.js       + negative: no screens selected (Gap 2)
    04_player_broadcast.spec.js            + negative: invalid screen token (Gap 2)
    05_techops_health.spec.js
    06_admin_validate.spec.js
    07_retailer_loops.spec.js              + pre-flight: playlist disambiguation (Gap 3)
    08_retailer_approval.spec.js           + negative: reject path + afterAll restore (Gap 2)
    09_retailer_schedule_manager.spec.js
    10_retailer_schedule_history.spec.js
    11_advertiser_dashboard.spec.js        + negative: wrong-role route access (Gap 2)
    12_advertiser_campaigns.spec.js
    13_advertiser_invoices.spec.js
    14_ticket_system.spec.js               + negative: nonexistent ticket (Gap 2)
    15_admin_campaign_analytics.spec.js
    16_login_feature.spec.js
    17_api_surface_smoke.spec.js           ← Gap 1: 7 uncovered routers + Gap 2: unauth
```

---

## The Strong Statement

When every file in the register above passes on a clean Firestore emulator with `ALLOW_DEMO_MODE=true`:

> **Every user-facing flow, every mounted API router, every data access rule, and every documented error path in `softomedia-live2026` has been exercised at least once with a falsifiable assertion.**

Register as `/demo-consolidated` in `workflows.md`.
