# Fix Plan — Loops Query Param & Response Unwrapping
**Sprint 4 · Softomedia Live 2026**
**Date:** 2026-05-19

---

## Problem Statement

Two bugs block the LoopDemoPlayer from rendering loops correctly:

1. **`GET /api/loops` query param** — the frontend sends `?screenid=<id>` but the backend only reads `screen_id`, so filters are silently ignored and all loops are returned unfiltered.
2. **Response unwrapping** — the backend returns `{ loops, business_hours }` but `LoopDemoPlayer.jsx` treats the response as a bare array, causing `.map is not a function` crash.

---

## Fix 1 — `loops.js` (Backend)

**File:** `ad-server/src/api/loops.js`

**Change:** Destructure both spellings from `req.query` and normalise to a single `effectiveScreenId`.

```js
// BEFORE
const { date, retailer_id, location_id, screen_id, status } = req.query;

// AFTER
const { date, retailer_id, location_id, screen_id, screenid, status } = req.query;
const effectiveScreenId = screen_id || screenid || null;
```

Then use `effectiveScreenId` in both the `date` branch filter and the `where` array:

```js
// date branch
if (effectiveScreenId) loops = loops.filter(l => l.screen_id === effectiveScreenId);

// non-date branch
if (effectiveScreenId) where.push(['screen_id', '==', effectiveScreenId]);
```

**Risk:** None — purely additive. Existing callers using `screen_id` are unaffected.

---

## Fix 2 — `LoopDemoPlayer.jsx` (Frontend)

**File:** `client-app/src/components/LoopDemoPlayer.jsx`

**Change:** Replace bare array assumption with two-step envelope unwrap.

```js
// BEFORE
const loops = Array.isArray(data) ? data : [];

// AFTER
const loops = Array.isArray(data?.loops)
  ? data.loops
  : Array.isArray(data)
    ? data
    : [];

const businessHours = data?.business_hours ?? null;
```

**Risk:** None — falls back to bare array for any legacy caller.

---

## Fix 3 — Date Format Sanity Check

```js
// CORRECT
const today = new Date().toLocaleDateString('en-CA'); // → "2026-05-19"

// WRONG
const today = new Date().toISOString(); // → "2026-05-19T13:00:00.000Z"
```

**Risk:** Zero — read-only check.

---

## Deployment

- All three fixes are non-breaking
- No coordinated deploy required
- No DB migrations, no env var changes

---

## Verification Steps

1. `GET /api/loops?screenid=1&date=2026-05-19` → `loops` filtered to screen 1
2. `GET /api/loops?screen_id=1&date=2026-05-19` → identical result
3. Open LoopDemoPlayer → select Retailer/Store/Screen → click Play → no `.map is not a function`
4. Loop list renders or shows empty state — no blank screen
