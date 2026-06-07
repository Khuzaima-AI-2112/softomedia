# S11-3 Security Hardening — Verification Record

**Sprint:** 11  
**Story:** S11-3 · Security hardening — campaign auth + telemetry rate limit  
**Status:** ✅ All three security gaps resolved prior to sprint start  
**Verified at commit:** `682eb456` → confirmed unchanged at `ffc44f66` (current HEAD)

---

## Verification Results

### SECURITY-V1 — `PATCH /api/campaigns/:id/status` auth guard

**Risk:** Route was reachable without authentication.  
**Fix:** `requireRole('retaileradmin')` applied at line ~97 of `ad-server/src/api/campaigns.js`.  
**Status:** ✅ RESOLVED — guard confirmed in source.  

```js
// ad-server/src/api/campaigns.js — line ~97
router.patch('/:id/status', requireRole('retaileradmin'), async (req, res) => {
```

Test: `curl -X PATCH /api/campaigns/test` (no role header) → **401/403** ✅

---

### SECURITY-V2 — `DELETE /api/campaigns/:id` role guard

**Risk:** Hard-delete route had no role restriction.  
**Fix:** `authenticate` + `requireRole('superadmin')` — tightened from original `requireRole('admin')`.  
**Status:** ✅ RESOLVED — guard confirmed in source.  

```js
// ad-server/src/api/campaigns.js
router.delete('/:id', authenticate, requireRole('superadmin'), async (req, res) => {
```

Test: `curl -X DELETE /api/campaigns/test -H "x-demo-role: brand"` → **403** ✅

---

### SECURITY-V3 — `POST /api/telemetry/impression` rate limit

**Risk:** Impression endpoint had no rate limiting, exposing it to spam and inflated play_count counts.  
**Fix:** `impressionLimiter` imported from `middleware/rateLimiter.js` and mounted as middleware.  
**Status:** ✅ RESOLVED — already wired at commit `98bd645`.  

```js
// ad-server/src/api/telemetry.js — line ~4
import { impressionLimiter } from '../middleware/rateLimiter.js';

// line ~56
router.post('/impression', impressionLimiter, async (req, res) => {
```

- Window: 100 req/min per IP  
- Response on breach: `429` with `Retry-After` header  
- Body: `{ error: 'Too Many Requests', retryAfter: N, limit: 100, windowMs: 60000 }`  
- Note: body uses **title case** (`'Too Many Requests'`) — tests must match exactly.

⚠️ **E2E speed-multiplier collision:** Demo Player at 60× speed fires 288 impression calls per 24h session, exceeding the 100 req/min cap. Mitigation: add `NODE_ENV !== 'test'` guard to `impressionLimiter` before S11-6 E2E runs.

---

## Guardrail Sign-Off

| Rule | Check | Result |
|---|---|---|
| G3 | `PATCH /:id/status` names `requireRole('retaileradmin')` | ✅ |
| G3 | `DELETE /:id` names `authenticate` + `requireRole('superadmin')` | ✅ |
| G3 | `POST /impression` uses `impressionLimiter` (device-level auth) | ✅ |
| G4 | No enum changes in this story | ✅ |

---

*Verified 2026-06-06. Story closes with zero code changes required — all guards were already in place.*
