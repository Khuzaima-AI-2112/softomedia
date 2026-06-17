# `active_persona` vs `demo_role`: The Competing Keys Problem

**Document type:** Architecture Decision Record / QA Reference  
**Sprint:** current_sprint  
**Status:** 🔴 Partially Mitigated — root cause requires full cleanup  
**Author:** SRE / Architecture Review  
**Related PR:** fix/brand-wizard-403-persona-key-race

---

## Executive Summary

The client application maintains two separate `localStorage` keys that both claim to represent the current user's active role in the demo/development environment: `demo_role` and `active_persona`. The API request interceptor in `api.js` reads both with a `||` short-circuit, meaning whichever key is **set first** wins — regardless of which one the user most recently changed. This creates a class of silent, hard-to-reproduce auth failures where the wrong `x-demo-role` header is sent to the backend, producing 403 responses that surface to the user only as empty UI states rather than explicit error messages.

The Phase 2 security hardening commit seeded `demo_role = 'admin'` as the new safe default. Several persona-switching components (notably the Brand persona switcher and HamburgerMenu) were not simultaneously updated to write `demo_role` — some continued writing `active_persona`. Because `demo_role` is set first and the interceptor evaluates left-to-right, `active_persona = 'brand'` is permanently shadowed by `demo_role = 'admin'`. The brand campaign wizard's `loadData()` then fires with `x-demo-role: admin`, and the backend's brand-scoped screen query is never reached.

---

## Background: How The Keys Were Introduced

### `demo_role` — The Canonical Key (Phase 2)

`demo_role` was introduced as part of the Phase 2 auth hardening effort. Its purpose was to replace the unconditional `superadmin` seeding that had existed in the original DEV bootstrap block. The intent was explicit: a single, controlled localStorage key representing the current demo persona's role, writable only through deliberate persona-switching actions (the HamburgerMenu), not silently on every page load.

```js
// api.js — Phase 2 seeding
if (import.meta.env.DEV) {
    if (!localStorage.getItem('auth_token')) {
        localStorage.setItem('auth_token', 'demo-token');
    }
    if (!localStorage.getItem('demo_role')) {
        localStorage.setItem('demo_role', 'admin');  // Phase 2: was 'superadmin'
    }
}
```

The interceptor was written to read it:

```js
const demoRole = localStorage.getItem('demo_role') || localStorage.getItem('active_persona');
```

The `|| active_persona` fallback was added as a safety net for legacy sessions that might still carry the old key. This safety net became the source of the bug.

### `active_persona` — The Legacy / Parallel Key

`active_persona` appears to have originated from an earlier iteration of the persona switching UI — possibly pre-dating the Phase 2 auth hardening — where the switcher component tracked the "currently displayed" persona separately from the auth layer. Its value was used to drive UI state (tab highlight, visible menu items) as much as to drive auth headers.

Over time, two distinct responsibilities were collapsed into what should have been one key:

1. **UI state**: which persona tab is visually active
2. **Auth context**: which role header to send with API requests

`active_persona` tried to serve both. `demo_role` was introduced to own responsibility #2. But no single commit cleaned up all the write sites, leaving some components writing `active_persona` and others writing `demo_role`.

---

## The Failure Mechanism in Detail

### State at First DEV Page Load (Post-Phase 2)

```
localStorage after first load:
  auth_token    = 'demo-token'
  demo_role     = 'admin'         ← seeded by api.js bootstrap
  active_persona = (not set)
```

Interceptor evaluates: `'admin' || undefined` → sends `x-demo-role: admin`. ✅ Correct for admin views.

### State After User Switches to Brand Persona

If the persona switcher writes `active_persona` instead of `demo_role`:

```
localStorage after persona switch:
  auth_token    = 'demo-token'
  demo_role     = 'admin'         ← STALE, never cleared
  active_persona = 'brand'        ← written by switcher
```

Interceptor evaluates: `'admin' || 'brand'` → sends `x-demo-role: admin`. ❌ **Wrong role sent.**

### What the Backend Sees

The backend `auth.js` middleware reads `x-demo-role` and sets `req.user.role = 'admin'`. The brand campaign wizard's first call is `GET /api/screens`. The `screens.js` route handler checks:

```js
if (req.user.role === 'brand') {
    // return brand-scoped screen list
}
```

Since `role === 'admin'`, this condition is false. The handler falls through to the techop/admin path, which may return a different dataset or a 403 depending on its own guard chain. The wizard's `loadData()` catch block swallowed the error, rendering an empty store list with no user-visible feedback.

### Why It Was Hard to Reproduce

The bug is **session-order-dependent**. A QA tester who:
1. Opened the app for the first time → logged in directly as Brand (never hitting the admin default) would not see it, because `active_persona = 'brand'` would be set before `demo_role` was seeded.
2. Refreshed after any admin session would always reproduce it, because `demo_role = 'admin'` persists across refreshes.
3. Ran an incognito session would not reproduce it if the brand persona switcher was the first write.

This made the bug appear intermittent.

---

## Impact by Role

### QA Tester

| Scenario | Behaviour | Root cause |
|---|---|---|
| Fresh incognito session, navigate directly to Brand wizard | ✅ May work if `active_persona` set before `demo_role` seeds | Race between page mount and bootstrap block |
| Existing session with prior admin use, switch to Brand | ❌ 403 on screen load, empty wizard, no error shown | `demo_role='admin'` stale, wins `\|\|` |
| Clear localStorage, hard refresh, switch to Brand | ✅ Works if switcher writes `demo_role` | Depends on component implementation |
| Run E2E tests in sequence (admin suite → brand suite) | ❌ Brand tests fail if test runner does not clear `demo_role` between suites | Shared localStorage state across test runs |

**Actionable for QA:** Always run `localStorage.clear()` in the browser console (or add a `beforeEach` hook in E2E tests) when switching between persona test suites. The current mitigation guard in `api.js` (migration block) will auto-promote `active_persona → demo_role` on first load after the fix is deployed, but a clean state is always more reliable.

**Diagnostic command:**
```js
// Paste in browser console to inspect auth state
console.table({
    auth_token:     localStorage.getItem('auth_token'),
    demo_role:      localStorage.getItem('demo_role'),
    active_persona: localStorage.getItem('active_persona'),
    'interceptor resolves to': localStorage.getItem('demo_role') || localStorage.getItem('active_persona')
});
```

### Production User

Direct production impact is **zero**. The `demo_role` / `active_persona` mechanism is entirely wrapped in `import.meta.env.DEV` guards in `api.js` — neither key is seeded, read, or sent to the backend in a production build. Production requests authenticate via real JWTs in the `Authorization: Bearer <token>` header only.

However, there are two indirect production concerns:

1. **Trust in the auth layer**: If the DEV/demo auth shim is poorly maintained, it undermines confidence in the real auth layer's correctness. Bugs in the shim can mask backend permission logic errors that would have been caught during dev testing.
2. **Staging environments**: If a staging deployment uses `NODE_ENV=development` or `VITE_MODE=development` rather than `production` (a common misconfiguration), the `demo_role` shim activates and real users on staging could hit the same persona-key races. Staging auth behaviour would then diverge from production.

### Architect

The core architectural failure is **single-responsibility violation at the storage layer**. Two keys encode the same logical concern (active demo auth role) with no formal contract between them. This creates the following systemic risks:

#### 1. Implicit Key Contract with No Enforcement

There is no type, interface, or enum defining valid persona/role values. Any component can write any string to either key at any time. The correct key name and the set of valid role strings exist only as informal knowledge in developer heads and in scattered comments.

**Recommendation:** Introduce a thin `AuthContext` module (or a Zustand/Jotai atom in a state management layer) that owns all reads and writes to the demo auth state. No component should ever call `localStorage.getItem('demo_role')` directly — they should call `authContext.getDemoRole()`. The context module enforces the canonical key, validates the role string against an enum, and provides a single write function `authContext.setDemoRole(role)` that clears both keys atomically.

```js
// Proposed: src/services/DemoAuthContext.js
const VALID_ROLES = ['superadmin', 'admin', 'techop', 'retaileradmin', 'brand', 'advertiser'];
const CANONICAL_KEY = 'demo_role';
const LEGACY_KEY = 'active_persona';

export const DemoAuth = {
    get: () => {
        // Single read point — legacy migration handled here, not scattered
        const role = localStorage.getItem(CANONICAL_KEY) || localStorage.getItem(LEGACY_KEY);
        return VALID_ROLES.includes(role) ? role : 'admin';
    },
    set: (role) => {
        if (!VALID_ROLES.includes(role)) throw new Error(`Invalid demo role: ${role}`);
        localStorage.setItem(CANONICAL_KEY, role);
        localStorage.removeItem(LEGACY_KEY);  // Atomic cleanup of legacy key
    },
    clear: () => {
        localStorage.removeItem(CANONICAL_KEY);
        localStorage.removeItem(LEGACY_KEY);
    }
};
```

#### 2. The `||` Operator as a False Safety Net

The `||` short-circuit was added as a defensive fallback during Phase 2, but it inverted the priority semantics: the _older_ key (`demo_role`, set at boot) always wins over the _newer_ write (`active_persona`, set by user action). A correct implementation would prioritise the **most recently written** key. Using `||` to merge two competing sources of truth is architecturally unsound — it implies the keys have different priority levels, but the comments and code history show no such intent.

If a fallback chain is needed during the migration period, it should be time-stamped:

```js
// Better: prefer the key written most recently
const getRoleWithTimestamp = () => {
    const demoTs    = parseInt(localStorage.getItem('demo_role_ts') || '0', 10);
    const personaTs = parseInt(localStorage.getItem('active_persona_ts') || '0', 10);
    return demoTs >= personaTs
        ? localStorage.getItem('demo_role')
        : localStorage.getItem('active_persona');
};
```

Though the cleanest solution remains eliminating `active_persona` entirely, as the current fix does.

#### 3. Missing Auth State Contract Between UI and API Layer

The persona switcher UI component and the API client interceptor are decoupled by localStorage — there is no event, callback, or reactive subscription connecting them. This means:

- A persona switch updates localStorage synchronously, but any in-flight requests that were already past the interceptor stage carry the old role.
- There is no mechanism to cancel or retry in-flight requests when the role changes.
- Components that cache API responses (retailers list, screens list) will hold role-scoped data from the old persona until unmounted.

**Recommendation:** The persona switch should dispatch a custom DOM event (`api:persona-changed`) or update a reactive store that the API client subscribes to. In-flight requests should be aborted via `AbortController`. Cached data should be invalidated on role change.

#### 4. Test Surface Gap

Because the two-key interaction is invisible at the component level (no component renders the current `demo_role` value), there are no existing unit or integration tests that assert the role sent in request headers. The bug survived multiple PRs — including the Phase 2 security hardening PR itself — because no test checked `x-demo-role` against the active persona.

**Recommendation:** Add an interceptor-level unit test:

```js
it('sends x-demo-role matching the active persona after a persona switch', async () => {
    localStorage.setItem('demo_role', 'admin');
    DemoAuth.set('brand');  // Use the context module, not direct localStorage
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    global.fetch = mockFetch;
    await apiClient.get('/api/screens');
    expect(mockFetch.mock.calls[0][1].headers['x-demo-role']).toBe('brand');
});
```

---

## Current Mitigation vs. Full Fix

| Item | Current state (post-PR #46) | Full fix required |
|---|---|---|
| Interceptor reads both keys | ✅ Fixed — reads `demo_role` only | Maintain |
| Migration guard (active_persona → demo_role) | ✅ In place, auto-promotes on first load | Remove after one sprint |
| Wizard self-correction guard | ✅ In place as safety net | Remove once all switchers write `demo_role` |
| Persona switcher writes `active_persona` | ⚠️ Not yet audited / fixed in all components | Audit all persona switch call sites and migrate to `DemoAuth.set()` |
| `active_persona` key removed from codebase | ❌ Not done | Delete after audit confirms no remaining write sites |
| `DemoAuth` context module | ❌ Not yet created | Create and enforce via ESLint `no-restricted-syntax` rule |
| Interceptor unit test | ❌ Not yet added | Add to regression suite |

---

## Recommended Cleanup Steps (Next Sprint)

1. **Audit all write sites**: `grep -r "active_persona" client-app/src` — identify every component still writing the legacy key.
2. **Create `DemoAuthContext.js`** with the canonical `get` / `set` / `clear` interface shown above.
3. **Migrate all write sites** to `DemoAuth.set(role)`.
4. **Add ESLint rule** to forbid direct `localStorage.setItem('active_persona', ...)` and `localStorage.setItem('demo_role', ...)` calls outside `DemoAuthContext.js`.
5. **Delete** the migration guard from `api.js` bootstrap block.
6. **Delete** the wizard self-correction guard from `Step1LocationScreen.jsx` once step 3 is confirmed complete.
7. **Add interceptor unit test** asserting `x-demo-role` matches `DemoAuth.get()` after a `DemoAuth.set()` call.
8. **Add E2E `beforeEach` hook** calling `DemoAuth.clear()` to guarantee test isolation across persona suites.

---

## Summary

The `active_persona` vs `demo_role` conflict is a textbook example of **implicit shared mutable state without a contract**. Two keys, one logical concern, zero enforcement. The `||` fallback in the interceptor was intended as a safety net but inverted write-time priority, silently breaking every persona that wasn't the boot-time default. The immediate fix eliminates the fallback and adds a migration guard and wizard safety net. The full fix requires consolidating all reads and writes behind a single `DemoAuthContext` module, removing the legacy key, and adding test coverage at the interceptor level.
