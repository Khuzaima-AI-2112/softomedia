# SRE Preventive QA Report — `main` @ 530a2a8
**Reviewer:** Senior SRE (AI-assisted)  
**Date:** 2026-05-13 10:36 EDT  
**Scope:** `ad-server/src/` — all API routes, auth middleware, commit history sprints 5–10  
**Context:** Cross-referenced against INC-2026-05-13 (secret exposure / Cloud Build deploy failure)

---

## Executive Summary

Five **critical or high-severity** defects were found in the current `main` state. Three of them — unauthenticated write paths, an unbounded impression-fraud vector, and a hardcoded fallback secret — are individually sufficient to cause a production security incident. They are not theoretical; each maps directly to patterns that caused or nearly caused the two incidents already on record. An additional seven medium/low findings round out the picture.

The sprint-velocity cadence (sprints 6–10 all landed in a single day, 2026-05-13) is itself a risk factor: five sprints of new surface area merged without a PR review gate shows up clearly in the commit graph and correlates with every finding below.

---

## Critical Findings

### CRIT-1 — `GET /api/ads`, `GET /api/ads/:id`, `PUT /api/ads/:id/review`, `DELETE /api/ads/:id` — **No authentication whatsoever**

**File:** `ad-server/src/api/ads.js`  
**Sprint introduced:** Sprint 7 (`c72b7f2`)

All four routes are completely unauthenticated. There is no `requireAuth` import and no middleware applied to any handler.

```js
// ads.js — all four handlers look like this:
router.get('/', async (req, res) => { … });           // ← no requireAuth
router.post('/', validateAdUpload, async (req, res) => { … });  // ← no requireAuth
router.put('/:id/review', async (req, res) => { … }); // ← no requireAuth ← CRITICAL
router.delete('/:id', async (req, res) => { … });     // ← no requireAuth
```

`PUT /api/ads/:id/review` lets anyone — unauthenticated, from the internet — approve or reject any ad, set `reviewed_by` to an arbitrary string, and trigger `ReplacementService.handleRejection()`. The `DELETE` route soft-deletes any ad record with no token required.

**Fix:**
```js
import { requireAuth, requireRole } from '../middleware/auth.js';

router.get('/',           requireAuth,                               async (req, res) => { … });
router.post('/',          requireAuth, requireRole(['brand']),       validateAdUpload, async (req, res) => { … });
router.put('/:id/review', requireAuth, requireRole(['admin', 'retailer']), async (req, res) => { … });
router.delete('/:id',     requireAuth, requireRole(['admin']),       async (req, res) => { … });
```

---

### CRIT-2 — `POST /api/analytics/impression` — **Unauthenticated impression injection (billing fraud vector)**

**File:** `ad-server/src/api/analytics.js`  
**Sprint introduced:** Sprint 9 (`27059f9`)

The comment in the file says *"screen player uses service token"* — but `requireAuth` is present, meaning it requires *any* valid JWT, not a scoped service token. There is zero validation that `brand_id`, `campaign_id`, `cost_usd`, or `location_id` in the POST body actually correspond to real Firestore documents. A brand-role user (or anyone who has obtained any valid JWT) can POST arbitrary impression records, inflating their `impressions` count and `spend` figures that flow into the billing dashboard.

```js
// analytics.js
router.post('/impression', requireAuth, async (req, res) => {
    const { ad_id, campaign_id, brand_id, …, cost_usd = 0 } = req.body;
    // ← no verification that campaign_id exists
    // ← no verification that brand_id matches req.user.linked_entity_id
    // ← cost_usd is caller-supplied with no cap or server-side recalculation
    const doc = { …, cost_usd: Number(cost_usd) || 0 };
    await db.collection('impressions').add(doc);
```

**Fix — three layers needed:**
1. Validate `campaign_id` exists in Firestore before writing.
2. Assert `brand_id === req.user.linked_entity_id` (or require `admin`/`screen` role).
3. Remove `cost_usd` from the client payload entirely; compute it server-side from the campaign's CPM rate.

---

### CRIT-3 — Hardcoded fallback secret in `auth.js` middleware AND `users.js`

**Files:** `ad-server/src/middleware/auth.js` (line 3) · `ad-server/src/api/users.js` (line 15) · `ad-server/src/api/auth.js` (line 9)

```js
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';
```

This fallback is present in **three separate files**. If `JWT_SECRET` is absent from the Cloud Run environment — which happened this morning (INC-2026-05-13, RCA-1) — the server silently falls back to a known public string. Any attacker can sign a valid JWT with `dev-secret-key-change-in-prod`, set `role: "admin"`, and gain full admin access to every authenticated route.

The fix from the incident report addressed the *deployment* side (GCP Secret Manager). But the *code-side* fallback is still present and will re-arm itself any time the secret is absent.

**Fix:**
```js
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('[FATAL] JWT_SECRET is not set. Refusing to start.');
    process.exit(1);
}
```
Remove the fallback string from all three files. Fail-fast on startup; do not silently degrade to an insecure state.

---

## High Findings

### HIGH-1 — `GET /api/analytics/campaigns` — **Retailer role not scoped; sees all-brand impression data**

**File:** `ad-server/src/api/analytics.js`

The `/summary` endpoint has retailer-scoping logic. The `/campaigns` endpoint does not:

```js
// /summary — correctly scoped
if (role === 'retailer' && !location_id) { … }

// /campaigns — retailer falls through with NO scope applied
router.get('/campaigns', requireAuth, async (req, res) => {
    if (role === 'brand') brand_id = linked_entity_id;
    // ← no 'retailer' branch
```

A logged-in retailer user can call `GET /api/analytics/campaigns` and receive impression, click, and spend data for every brand in the system.

---

### HIGH-2 — `PUT /api/campaigns/:campaignId` — **`status` in allowlist; brand can self-activate paused/rejected campaigns**

**File:** `ad-server/src/api/campaigns.js`

```js
const allowedUpdates = ['name', 'description', 'status', 'budget', 'target_screens', 'end_date'];
```

`status` is in the brand-accessible update allowlist with no role gate. A brand user can set their own campaign `status` back to `'active'` even if an admin paused or rejected it.

**Fix:**
```js
if (updates.status && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can change campaign status.' });
}
```

---

### HIGH-3 — `auth.js` login — **`linked_entity_id` missing from JWT payload**

**File:** `ad-server/src/api/auth.js`

```js
const token = jwt.sign(
    { uid: user.id, email: user.email, role: user.role },
    // ← linked_entity_id missing
    JWT_SECRET, { expiresIn: '24h' }
);
```

`linked_entity_id` is returned in the response body but not embedded in the JWT. Every middleware and route that reads `req.user.linked_entity_id` receives `undefined`. This causes broken ownership checks, unscoped queries, and inconsistent behaviour depending on whether the token came from login vs. invitation acceptance (which does include it correctly in `users.js`).

**Fix:**
```js
const token = jwt.sign(
    { uid: user.id, email: user.email, role: user.role, linked_entity_id: user.linked_entity_id || null },
    JWT_SECRET, { expiresIn: '24h' }
);
```

---

## Medium Findings

### MED-1 — `campaigns.js` — `blob.makePublic()` makes all uploaded videos world-readable

```js
await blob.makePublic();
const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${filename}`;
```

Campaign videos are stored at guessable paths (`campaigns/{brandId}/{timestamp}_{filename}`). Replace with signed URLs using the existing `utils/storage.js` helper (already used in `ads.js`).

---

### MED-2 — `campaigns.js` `/:campaignId/report` — **N+1 Firestore reads with no timeout guard**

The report endpoint fires 2–3 sequential Firestore reads per `target_screens` entry in a `for` loop. A 100-screen campaign issues ~200–300 sequential reads — reliable Cloud Run timeout territory. No per-iteration try/catch; one hanging read kills the entire response.

---

### MED-3 — `schedules.js` `isScheduleActive()` — **`toTimeString()` returns server local time, not UTC**

```js
const currentTimeString = currentTime.toTimeString().substring(0, 5); // server-local ← BUG
```

Cloud Run runs UTC. Schedule rules authored by Montreal clients (EDT = UTC−4) will activate 4 hours late/early depending on DST. Silent incorrect ad serving.

**Fix:**
```js
const currentTimeString = currentTime.toISOString().substring(11, 16); // always UTC
```

---

### MED-4 — `users.js` `POST /` — **`superadmin` is a ghost role**

```js
requireRole(['admin', 'superadmin'])
```

`superadmin` is accepted but never issued by any invite, login, or token path. Dead code that creates confusion without actual privilege separation.

---

## Low Findings

### LOW-1 — `ads.js` `DELETE /:id` — Soft delete does not cascade to loop slots

Deleted ads (`status: 'deleted'`) are still referenced in schedule previews and potentially in active loops until the loop regenerates. Add a `status !== 'deleted'` filter to the preview query.

---

### LOW-2 — `auth.js` login — Demo password comment present in production handler

```js
// All demo users share the password 'password' for easy persona switching during testing.
```

This comment is on the production login handler in `main`. If any seeded demo account has `role: 'admin'`, authentication is bypassed. Audit Firestore for demo accounts and rotate or remove them.

---

## Risk Matrix

| ID | File | Severity | Exploitable Without Auth? | Sprint |
|---|---|---|---|---|
| CRIT-1 | `ads.js` | 🔴 Critical | **Yes** | Sprint 7 |
| CRIT-2 | `analytics.js` | 🔴 Critical | No (any JWT) | Sprint 9 |
| CRIT-3 | `middleware/auth.js` | 🔴 Critical | **Yes (when secret absent)** | Pre-sprint |
| HIGH-1 | `analytics.js` | 🟠 High | No (retailer JWT) | Sprint 9 |
| HIGH-2 | `campaigns.js` | 🟠 High | No (brand JWT) | Sprint 6 |
| HIGH-3 | `auth.js` | 🟠 High | No (causes broken auth) | Sprint 6 |
| MED-1 | `campaigns.js` | 🟡 Medium | No | Sprint 6 |
| MED-2 | `campaigns.js` | 🟡 Medium | No (DoS via legitimate use) | Sprint 6 |
| MED-3 | `schedules.js` | 🟡 Medium | No (logic bug) | Sprint 8 |
| MED-4 | `users.js` | 🟡 Medium | No | Sprint 5 |
| LOW-1 | `ads.js` | 🔵 Low | No | Sprint 7 |
| LOW-2 | `auth.js` | 🔵 Low | No (documented risk) | Sprint 6 |

---

## Recommended Immediate Actions (Today)

1. **CRIT-1** — Add `requireAuth` + `requireRole` to all four `ads.js` routes.
2. **CRIT-3** — Remove fallback JWT strings from all three files; add `process.exit(1)` on missing secret.
3. **HIGH-3** — Add `linked_entity_id` to the login-issued JWT in `auth.js`.
4. **CRIT-2** — Server-validate impression POST fields; remove caller-supplied `cost_usd`.

## Recommended This Sprint

5. **HIGH-1** — Backport retailer scoping to `GET /api/analytics/campaigns`.
6. **HIGH-2** — Gate `status` updates to admin role only in `PUT /api/campaigns/:id`.
7. **MED-1** — Replace `makePublic()` with signed URL generation.
8. **MED-3** — Replace `toTimeString()` with `toISOString().substring(11,16)`.
9. **LOW-2** — Audit and rotate/remove demo admin accounts in Firestore.

---

## Process Observation

Sprints 6–10 all landed on `main` within a 6-hour window on 2026-05-13 with no visible PR review gap in the commit log. Five of twelve findings were introduced in this window. A lightweight PR checklist requiring (a) `requireAuth` on every new route, (b) a passing `grep` count diff, and (c) one peer review would have caught CRIT-1, HIGH-2, HIGH-3, and CRIT-2 before merge.
