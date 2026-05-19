# Fix Plan — Sprint 4 Loops API Mismatch

> **Priority:** P0 — Playback is dead on arrival until both fixes are applied  
> **Affects:** `ad-server/src/api/loops.js` · `client-app/src/pages/LoopDemoPlayer.jsx`  
> **Repo:** `cfroszte/softomedia-live2026`  
> **Date:** 2026-05-19

---

## Root Cause Summary

Two independent bugs compound to produce zero playback output. Neither can be fixed in isolation — both must land together.

| # | File | Bug | Symptom |
|---|---|---|---|
| 1 | `loops.js` | `screenid` query param is not recognized — backend only accepts `location_id` and `retailer_id` | All loops are returned unfiltered (or empty), never scoped to the selected screen |
| 2 | `LoopDemoPlayer.jsx` | `handlePlay()` does `Array.isArray(data) ? data : []` — but backend returns `{ loops: [...], business_hours: {...} }` (an object), so the check always resolves to `[]` | Player always shows "No loops scheduled for this screen and date" regardless of what the backend returns |

---

## Fix 1 — Backend: Add `screenid` filter to `GET /api/loops`

**File:** `ad-server/src/api/loops.js`

### What to change

The `GET /` handler destructures `{ date, retailer_id, location_id, status }` from `req.query`. Add `screen_id` (or `screenid` — match whatever the frontend sends) to the destructure, and add it as a filter condition.

### Before

```js
// loops.js — GET /api/loops handler
const { date, retailer_id, location_id, status } = req.query;

let loops;
if (date) {
    loops = await loopRepository.findByDate(date);
    if (location_id) {
        loops = loops.filter(l => l.location_id === location_id);
    }
} else {
    const where = [];
    if (retailer_id) where.push(['retailer_id', '==', retailer_id]);
    if (location_id) where.push(['location_id', '==', location_id]);
    if (status)      where.push(['status',      '==', status]);
    loops = await loopRepository.findAll({ where });
}
```

### After

```js
// loops.js — GET /api/loops handler
const { date, retailer_id, location_id, screen_id, screenid, status } = req.query;

// Normalise — accept both ?screen_id= and ?screenid= from legacy callers
const effectiveScreenId = screen_id || screenid || null;

let loops;
if (date) {
    loops = await loopRepository.findByDate(date);
    if (location_id)      loops = loops.filter(l => l.location_id === location_id);
    if (effectiveScreenId) loops = loops.filter(l => l.screen_id === effectiveScreenId);
} else {
    const where = [];
    if (retailer_id)      where.push(['retailer_id', '==', retailer_id]);
    if (location_id)      where.push(['location_id', '==', location_id]);
    if (effectiveScreenId) where.push(['screen_id',  '==', effectiveScreenId]);
    if (status)           where.push(['status',      '==', status]);
    loops = await loopRepository.findAll({ where });
}
```

### Why dual param names?

The frontend currently sends `?screenid=` (no underscore). Accepting both `screen_id` and `screenid` makes the fix backward-compatible if any other caller uses either variant, without requiring a simultaneous frontend deploy.

---

## Fix 2 — Frontend: Unwrap `data.loops` in `handlePlay()`

**File:** `client-app/src/pages/LoopDemoPlayer.jsx`

### What to change

`handlePlay()` calls `GET /api/loops` and stores the result. Currently it treats the response as a bare array. The backend returns `{ loops: [...], business_hours: {...} }`. The fix is to unwrap `data.loops` before storing.

### Before

```js
// LoopDemoPlayer.jsx — handlePlay()
const response = await fetch(`/api/loops?screenid=${selectedScreen}&date=${today}`);
const data = await response.json();

const loopsArray = Array.isArray(data) ? data : [];
setAllLoops(loopsArray);
```

### After

```js
// LoopDemoPlayer.jsx — handlePlay()
const response = await fetch(`/api/loops?screenid=${selectedScreen}&date=${today}`);
const data = await response.json();

// Backend returns { loops: [...], business_hours: {...} } — unwrap accordingly
const loopsArray = Array.isArray(data)        ? data          // bare array (legacy safety)
                 : Array.isArray(data?.loops) ? data.loops    // expected shape
                 : [];

setAllLoops(loopsArray);

// Optional: surface business hours to the UI
if (data?.business_hours) {
    setBusinessHours(data.business_hours); // only if this state var exists / is needed
}
```

### Why keep the legacy `Array.isArray(data)` branch?

The guard costs nothing and makes the component resilient if any other endpoint ever feeds it loops as a bare array (e.g., mock fixtures, future endpoints). Remove it only once the team confirms no other call path exists.

---

## Fix 3 — (Recommended) Align `date` param to today in the player

While in `handlePlay()`, confirm `today` is being derived correctly. A common mistake is using `new Date().toISOString()` which produces `2026-05-19T12:34:56.789Z` — but `loopRepository.findByDate()` likely expects `YYYY-MM-DD` format.

```js
// Safe date derivation — produces "2026-05-19"
const today = new Date().toLocaleDateString('en-CA'); // en-CA gives ISO 8601 YYYY-MM-DD
```

If loops were generated for `2026-05-19` but the query sends the full ISO timestamp, `findByDate` will return zero results even after Fix 1 and Fix 2 are applied.

---

## Delivery Checklist

- [ ] **`loops.js`** — add `screen_id` / `screenid` destructure and filter in both `date` and non-`date` branches
- [ ] **`LoopDemoPlayer.jsx`** — unwrap `data.loops` in `handlePlay()`; guard with `Array.isArray`
- [ ] **`LoopDemoPlayer.jsx`** — verify `today` is formatted `YYYY-MM-DD` (not ISO timestamp)
- [ ] **Manual smoke test** — select Retailer → Store → Screen → click "Play Full Day" → confirm loop array populates and playback advances
- [ ] **Edge cases to test:**
  - No loops generated for the selected screen + date → should render empty state, not crash
  - `business_hours.is_closed = true` → player should reflect closed day
  - Selecting a new Retailer mid-session resets state (already implemented — verify it still works post-fix)
- [ ] **Commit** both files together in one atomic commit with message: `fix(player): unwrap loops response + add screenid filter to GET /api/loops`

---

## Roll-forward, not Roll-back

There is no backward-incompatible contract change here. The backend response shape `{ loops, business_hours }` was already the spec — the frontend was simply misreading it. No other consumers of `GET /api/loops` are broken by adding a new optional `screenid` filter param.
