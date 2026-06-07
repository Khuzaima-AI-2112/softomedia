# Open Items — Sprints 1–4
**SRE verified:** 2026-05-19 | **Commit reviewed:** `719a226` (main)
**Method:** 100% line-verified against live source code — no assumptions.

---

## Status Summary

| # | Item | Severity | Status | File |
|---|------|----------|--------|------|
| 1 | `GET /api/loops` publicly accessible — no auth | 🔴 P0 | **OPEN** | `src/api/index.js:36` |
| 2 | `PATCH /loops/:id/approve` publicly accessible — no auth | 🔴 P0 | **OPEN** | `src/api/index.js:36` + `loops.js:83` |
| 3 | `POST /loops/generate` publicly accessible — no auth | 🔴 P0 | **OPEN** | `src/api/index.js:36` + `loops.js:53` |
| 4 | Zero unit tests for `LoopRepository`, `BusinessHoursService`, `LoopGenerationService` | 🟡 P1 | **OPEN** | `src/repositories/` + `src/services/` |
| 5 | `screenid`/`screen_id` normalisation | ✅ | **CLOSED** | `loops.js:18–21` |
| 6 | `{ loops, business_hours }` response unwrap (frontend) | ✅ | **CLOSED** | `LoopDemoPlayer.jsx:134–139` |
| 7 | `useRef` cascade dedup cache | ✅ | **CLOSED** | `LoopDemoPlayer.jsx:63–64` |
| 8 | Date format UTC drift (`toLocaleDateString('en-CA')`) | ✅ | **CLOSED** | `LoopDemoPlayer.jsx:28–31` |

---

## Open Item 1 — `GET /api/loops` Unauthenticated

**Risk:** Any caller without a token can read full broadcast schedules, slot statuses, campaign names, and creative URLs for any screen.

**Root cause:** `loopsRouter` is mounted in the public block of `src/api/index.js` with no `authenticate` middleware:
```js
// src/api/index.js line 36 — currently in PUBLIC block
router.use('/loops', loopsRouter);
```

**Fix — `ad-server/src/api/index.js`:**
```js
// Option A (recommended — preserves demo-player read access):
// Add authenticate only to write handlers inside loops.js (see Item 2 below).

// Option B (full gate — only if demo player uses a real JWT):
router.use('/loops', authenticate, loopsRouter);
```

**Pre-fix check:** Verify `ad-server/src/middleware/auth.js` accepts the `x-demo-role` header used by the demo player before gating reads.

---

## Open Item 2 — `PATCH /loops/:id/approve` + Write Endpoints Unauthenticated

**Risk:** Any unauthenticated caller can:
- Approve any loop (`PATCH /:id/approve`) — `userId` falls back to `"anonymous"`
- Reject any slot (`PATCH /:id/slots/:pos/reject`)
- Replace any slot (`PATCH /:id/slots/:pos/replace`)
- Trigger loop generation for any retailer/location, overwriting Firestore records (`POST /generate`)

**Root cause:** Same public block mount as Item 1. All four mutating handlers in `loops.js` have no route-level auth guard.

**Fix — `ad-server/src/api/loops.js`:**
```js
import { authenticate } from '../middleware/auth.js';

// Add authenticate to each mutating handler:
router.patch('/:id/approve',                   authenticate, async (req, res) => { ... });
router.patch('/:id/slots/:position/reject',    authenticate, async (req, res) => { ... });
router.patch('/:id/slots/:position/replace',   authenticate, async (req, res) => { ... });
router.post('/generate',                       authenticate, async (req, res) => { ... });
```

This is the **recommended approach** — it gates only writes, leaving `GET /` and `GET /:id` public for the demo player without any JWT requirement.

---

## Open Item 3 — `POST /loops/generate` Unauthenticated

Covered by the fix in Item 2 above. No separate change needed.

---

## Open Item 4 — Missing Unit Tests (P1)

**Risk:** No automated regression coverage for the three core backend services. A logic bug in loop generation or business hours calculation would only surface in production.

**What's missing:**

| File | What to test |
|------|-------------|
| `src/repositories/LoopRepository.js` | `findByDate()` returns correct loops; `approveLoop()` sets status; `rejectSlot()` writes reason |
| `src/services/BusinessHoursService.js` | `getEffectiveHours()` returns override when present; falls back to default hours; marks `is_closed` correctly |
| `src/services/LoopGenerationService.js` | `generateDailyLoops()` produces exactly 14 loops (8am–10pm); `generateMockLoops()` returns correct slot count |

**Suggested test file locations:**
```
ad-server/src/repositories/LoopRepository.test.js
ad-server/src/services/BusinessHoursService.test.js
ad-server/src/services/LoopGenerationService.test.js
```

Use the existing `api.test.js` as a pattern reference.

---

## Confirmed Closed — Evidence

| Item | Verified in file | Lines |
|------|-----------------|-------|
| `screenid`/`screen_id` dual-spelling normalised | `src/api/loops.js` | 18–21 |
| `{ loops, business_hours }` envelope unwrap | `src/pages/LoopDemoPlayer.jsx` | 134–139 |
| Cascade dedup `useRef` guards | `src/pages/LoopDemoPlayer.jsx` | 63–64, 78, 96 |
| Date format uses `toLocaleDateString('en-CA')` | `src/pages/LoopDemoPlayer.jsx` | 28–31 |
| `screens.js` triple-spelling store param guard | `src/api/screens.js` | 43–45 |
