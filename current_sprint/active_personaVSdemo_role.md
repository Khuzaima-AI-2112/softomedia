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
  auth_token     = 'demo-token'
  demo_role      = 'admin'         ← seeded by api.js bootstrap
  active_persona = (not set)
```

Interceptor evaluates: `'admin' || undefined` → sends `x-demo-role: admin`. ✅ Correct for admin views.

### State After User Switches to Brand Persona

If the persona switcher writes `active_persona` instead of `demo_role`:

```
localStorage after persona switch:
  auth_token     = 'demo-token'
  demo_role      = 'admin'         ← STALE, never cleared
  active_persona = 'brand'         ← written by switcher
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

---

---

## Phase 3: Firebase Transition Strategy

**Status:** 📋 Planned — not yet started
**Dependency:** Phase 2 cleanup (DemoAuthContext module) must be complete first

### The Core Insight: DemoAuthContext Is the Swap Point

The `DemoAuthContext` module recommended in the cleanup steps above is not just a bug fix — it is deliberately designed as a **Firebase drop-in swap point**. Every component in the app will call `DemoAuth.set(role)` and `DemoAuth.get()` rather than touching localStorage directly. When Firebase is ready, `DemoAuthContext.js` is replaced with `FirebaseAuthContext.js` that exposes the identical interface. The persona switcher UI, the interceptor, and every wizard and screen component are completely untouched.

This is the intermediate architecture goal: **one file to swap, zero component changes**.

---

### The Intermediate Architecture

The intermediate state keeps the demo persona switcher fully functional for sales demos and development testing, while making the auth layer Firebase-ready underneath it.

```
┌─────────────────────────────────────────────────────────┐
│                  Persona Switcher UI                    │
│  [SuperAdmin] [Admin] [Retailer] [Brand] [Tech Ops]     │
│                                                         │
│  onClick → AuthProvider.setRole(role)                   │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              AuthProvider (the swap point)              │
│                                                         │
│  Phase 2/3 (now):    DemoAuthContext                    │
│    get()  → reads localStorage('demo_role')             │
│    set()  → writes localStorage('demo_role')            │
│    token() → returns 'demo-token'                       │
│                                                         │
│  Phase 4 (Firebase): FirebaseAuthContext                │
│    get()  → reads firebaseUser.customClaims.role        │
│    set()  → calls Cloud Function setDemoPersona(role)   │
│    token() → returns await firebaseUser.getIdToken()    │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              api.js Request Interceptor                 │
│                                                         │
│  import { AuthProvider } from './AuthProvider';         │
│                                                         │
│  config.headers['x-demo-role'] = AuthProvider.get();   │
│  config.headers['Authorization'] = `Bearer             │
│      ${await AuthProvider.token()}`;                    │
└─────────────────────────────────────────────────────────┘
```

The key change from today: the interceptor imports `AuthProvider` rather than calling `localStorage` directly. `AuthProvider` is the stable public contract. Its implementation is swapped per environment.

---

### The AuthProvider Contract

Define a strict interface that both `DemoAuthContext` and `FirebaseAuthContext` must satisfy. This contract is the only thing the interceptor and all components depend on.

```js
// src/auth/AuthProvider.contract.js
// This file defines the shape. Never imported at runtime — used for documentation
// and as the basis for TypeScript types if/when TS is adopted.

/**
 * @typedef {Object} AuthProviderContract
 * @property {() => string}          get       — Returns the current active role string.
 * @property {(role: string) => void} set      — Sets the active role. Validates against VALID_ROLES.
 * @property {() => Promise<string>}  token    — Returns the auth token for the current session.
 * @property {() => void}             clear    — Clears auth state (used by logout and test teardown).
 * @property {(cb: Function) => Function} onRoleChange — Subscribes to role change events.
 *                                                        Returns an unsubscribe function.
 */
```

The `onRoleChange` subscriber is the reactive connection that replaces the current fire-and-forget localStorage write. The interceptor and any cached-data layer subscribe to role changes and invalidate accordingly.

---

### DemoAuthContext — Phase 2/3 Implementation (localStorage-backed)

This is the implementation to build during the cleanup sprint. It satisfies the full `AuthProvider` contract using localStorage — no Firebase dependency.

```js
// src/auth/DemoAuthContext.js

const VALID_ROLES = ['superadmin', 'admin', 'techop', 'retaileradmin', 'brand', 'advertiser'];
const CANONICAL_KEY = 'demo_role';
const LEGACY_KEY = 'active_persona';

// In-memory subscriber list — replaces the missing reactive contract
const subscribers = new Set();

export const DemoAuthContext = {
    get: () => {
        const role = localStorage.getItem(CANONICAL_KEY) || localStorage.getItem(LEGACY_KEY);
        return VALID_ROLES.includes(role) ? role : 'admin';
    },

    set: (role) => {
        if (!VALID_ROLES.includes(role)) throw new Error(`Invalid demo role: ${role}`);
        localStorage.setItem(CANONICAL_KEY, role);
        localStorage.removeItem(LEGACY_KEY);
        // Notify all subscribers (interceptor, cache layer, UI)
        subscribers.forEach(cb => cb(role));
    },

    token: async () => {
        // Returns the demo token. Same shape as FirebaseAuthContext.token()
        // so the interceptor can await this call identically in both implementations.
        return localStorage.getItem('auth_token') || 'demo-token';
    },

    clear: () => {
        localStorage.removeItem(CANONICAL_KEY);
        localStorage.removeItem(LEGACY_KEY);
        localStorage.removeItem('auth_token');
        subscribers.forEach(cb => cb(null));
    },

    onRoleChange: (cb) => {
        subscribers.add(cb);
        return () => subscribers.delete(cb); // unsubscribe function
    }
};
```

---

### FirebaseAuthContext — Phase 4 Implementation (Firebase-backed)

This is the file that replaces `DemoAuthContext.js` on Firebase day. It exposes an **identical interface**. The persona switcher calls `set()` — which in this implementation calls a Firebase Cloud Function that stamps a custom claim on the user's token. The token is a real Firebase ID token.

```js
// src/auth/FirebaseAuthContext.js  (written now, activated on Firebase day)

import { getAuth, onIdTokenChanged } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

const auth = getAuth();
const functions = getFunctions();
const setDemoPersonaFn = httpsCallable(functions, 'setDemoPersona');

const VALID_ROLES = ['superadmin', 'admin', 'techop', 'retaileradmin', 'brand', 'advertiser'];
const subscribers = new Set();

// Mirror the demo token refresh via Firebase ID token listener
onIdTokenChanged(auth, async (user) => {
    if (user) {
        const claims = (await user.getIdTokenResult()).claims;
        if (claims.role) subscribers.forEach(cb => cb(claims.role));
    }
});

export const FirebaseAuthContext = {
    get: () => {
        // Reads from the cached ID token claims — synchronous for interceptor use
        const user = auth.currentUser;
        return user?._tokenResponse?.customAttributes
            ? JSON.parse(user._tokenResponse.customAttributes).role
            : 'admin';
    },

    set: async (role) => {
        if (!VALID_ROLES.includes(role)) throw new Error(`Invalid demo role: ${role}`);
        // Calls a Cloud Function that sets a custom claim on the Firebase user
        await setDemoPersonaFn({ role });
        // Force token refresh so get() immediately reflects the new claim
        await auth.currentUser?.getIdToken(true);
        subscribers.forEach(cb => cb(role));
    },

    token: async () => {
        return auth.currentUser?.getIdToken() ?? null;
    },

    clear: async () => {
        await auth.signOut();
        subscribers.forEach(cb => cb(null));
    },

    onRoleChange: (cb) => {
        subscribers.add(cb);
        return () => subscribers.delete(cb);
    }
};
```

---

### The Single Swap — AuthProvider.js

A one-line environment switch is all that changes when Firebase is enabled. The rest of the codebase never knows which implementation is active.

```js
// src/auth/AuthProvider.js — the only file components import

import { DemoAuthContext }     from './DemoAuthContext';
import { FirebaseAuthContext } from './FirebaseAuthContext';

// Toggle: flip to true when Firebase is live
const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';

export const AuthProvider = USE_FIREBASE ? FirebaseAuthContext : DemoAuthContext;
```

Components, the interceptor, and the persona switcher all import from `AuthProvider` only:

```js
// PersonaSwitcher.jsx
import { AuthProvider } from '../auth/AuthProvider';

const handlePersonaSwitch = (role) => {
    AuthProvider.set(role);   // same call in demo mode and Firebase mode
};

// api.js interceptor
import { AuthProvider } from './auth/AuthProvider';

axiosInstance.interceptors.request.use(async (config) => {
    const role  = AuthProvider.get();
    const token = await AuthProvider.token();
    if (role)  config.headers['x-demo-role']   = role;
    if (token) config.headers['Authorization'] = `Bearer ${token}`;
    return config;
});
```

---

### Persona Switcher: What Stays, What Changes

The five-persona switcher UI (SuperAdmin, Admin, Retailer, Brand, Tech Ops) is a **demo and development asset** that should be preserved indefinitely. Even in Firebase production, internal teams need to quickly impersonate any persona for QA, sales demos, and support walkthroughs. The switcher does not go away — its backing implementation does.

| Layer | Phase 2/3 (now) | Phase 4 (Firebase) |
|---|---|---|
| Switcher UI component | ✅ Unchanged | ✅ Unchanged |
| `AuthProvider.set(role)` call | ✅ Unchanged | ✅ Unchanged |
| Backing store | `localStorage('demo_role')` | Firebase custom claim via Cloud Function |
| Token sent to backend | `'demo-token'` (static) | Firebase ID token (signed, expiring) |
| Backend validates role via | `x-demo-role` header (trust-on-header) | ID token custom claim (cryptographically verified) |
| Who can use the switcher | Any DEV session | Firebase users with `isDemoUser: true` claim |

The backend `auth.js` middleware will need a parallel update: in Phase 4 it verifies the Firebase ID token and reads `req.user.role` from the decoded claims rather than from the `x-demo-role` header. The header-based approach is removed entirely in production. In DEV the header fallback can remain as a convenience.

---

### Firebase Cloud Function: `setDemoPersona`

This function is the gatekeeper that prevents arbitrary role escalation. Only users with the `isDemoUser` claim can call it, and the role must be in the valid set.

```js
// functions/src/setDemoPersona.js

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const VALID_ROLES = ['superadmin', 'admin', 'techop', 'retaileradmin', 'brand', 'advertiser'];

exports.setDemoPersona = onCall(async (request) => {
    const { uid, token: { isDemoUser } } = request.auth ?? {};

    if (!uid)         throw new HttpsError('unauthenticated', 'Must be signed in.');
    if (!isDemoUser)  throw new HttpsError('permission-denied', 'Not a demo user.');

    const { role } = request.data;
    if (!VALID_ROLES.includes(role)) {
        throw new HttpsError('invalid-argument', `Invalid role: ${role}`);
    }

    await admin.auth().setCustomUserClaims(uid, { role, isDemoUser: true });
    return { success: true, role };
});
```

Demo users are seeded in Firebase with `isDemoUser: true` during onboarding. All other Firebase users receive `isDemoUser: false` (the default) and the persona switcher is hidden from their UI by a guard:

```jsx
// PersonaSwitcher.jsx
{currentUser?.claims?.isDemoUser && <PersonaSwitcherPanel />}
```

---

### Migration Path Summary

| Phase | What ships | Auth mechanism | Persona switcher |
|---|---|---|---|
| **Phase 2** (current) | `DemoAuthContext` (localStorage) | `x-demo-role` header, `demo-token` | ✅ Works |
| **Phase 3** (next sprint) | `AuthProvider` wrapper + full cleanup | Same as Phase 2 | ✅ Works, now calls `AuthProvider.set()` |
| **Phase 4** (Firebase) | `FirebaseAuthContext`, Cloud Function, Firebase user seeding | Firebase ID token + custom claims | ✅ Works, unchanged UI |
| **Phase 5** (hardening) | Remove `x-demo-role` header support from backend middleware | ID token claims only | ✅ Works |

Phase 3 is the critical preparation step. It costs one sprint, produces no user-visible change, and makes Phase 4 a single `VITE_USE_FIREBASE=true` environment variable flip.

---

### Phase 3 Checklist (Pre-Firebase Preparation)

- [ ] Create `src/auth/AuthProvider.contract.js` — document the interface
- [ ] Create `src/auth/DemoAuthContext.js` — localStorage implementation with `onRoleChange` subscribers
- [ ] Create `src/auth/FirebaseAuthContext.js` — Firebase implementation (written now, not yet activated)
- [ ] Create `src/auth/AuthProvider.js` — environment toggle (`VITE_USE_FIREBASE`)
- [ ] Migrate interceptor (`api.js`) to `import { AuthProvider } from './auth/AuthProvider'`
- [ ] Migrate persona switcher components to call `AuthProvider.set(role)`
- [ ] Migrate all remaining `active_persona` write sites (from grep audit)
- [ ] Subscribe cache-invalidation logic to `AuthProvider.onRoleChange()`
- [ ] Add ESLint rule forbidding direct `localStorage` access for auth keys
- [ ] Add `VITE_USE_FIREBASE=false` to `.env.development`, `VITE_USE_FIREBASE=true` to `.env.firebase` (future)
- [ ] Write `setDemoPersona` Cloud Function (deployed to Firebase emulator for testing)
- [ ] Seed Firebase emulator with demo users carrying `isDemoUser: true`
- [ ] Verify persona switcher works end-to-end against emulator with `VITE_USE_FIREBASE=true`
- [ ] Remove `active_persona` key and all legacy migration guards

---

## Pre-Transition QA Gate

> 🚦 **This gate must be fully signed off before `VITE_USE_FIREBASE=true` is set in any environment.**
>
> All five personas must pass every scenario below. A single failure blocks the Firebase cutover. Run this suite against `VITE_USE_FIREBASE=false` first to establish the baseline, then re-run against `VITE_USE_FIREBASE=true` (Firebase emulator) to confirm parity.

---

### Gate 1 — Persona Switching Correctness

Verify that switching to each persona sends the correct `x-demo-role` header and loads the correct data scope. Open DevTools → Network tab and inspect request headers on each switch.

| Persona | Switch action | Expected `x-demo-role` header | Expected landing view |
|---|---|---|---|
| SuperAdmin | Click SuperAdmin tab | `superadmin` | Full platform dashboard, all tenants visible |
| Admin | Click Admin tab | `admin` | Admin dashboard, platform-level controls |
| Retailer | Click Retailer tab | `retaileradmin` | Retailer dashboard, store management |
| Brand | Click Brand tab | `brand` | Brand dashboard, campaign and screen tools |
| Tech Ops | Click Tech Ops tab | `techop` | Tech ops dashboard, device/screen status |

**Pass criteria:** Header matches expected value on the very first request after each switch. No stale role from a previous persona bleeds through.

---

### Gate 2 — Session Persistence After Refresh

For each persona, switch to it, then hard-refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`). The correct persona must be restored without requiring a re-switch.

| Persona | After hard refresh | Expected behaviour |
|---|---|---|
| SuperAdmin | Refresh | Lands on SuperAdmin view, header still `superadmin` |
| Admin | Refresh | Lands on Admin view, header still `admin` |
| Retailer | Refresh | Lands on Retailer view, header still `retaileradmin` |
| Brand | Refresh | Lands on Brand view, header still `brand` |
| Tech Ops | Refresh | Lands on Tech Ops view, header still `techop` |

**Pass criteria:** No persona reverts to `admin` default after refresh. This is the exact scenario the original bug broke.

---

### Gate 3 — Cross-Persona Switching (The Original Bug Scenario)

This gate specifically re-tests the failure mode that triggered this ADR. Run in order without clearing localStorage between steps.

1. Start a fresh session (clear localStorage first)
2. Default loads as Admin → confirm `x-demo-role: admin`
3. Switch to Brand → confirm `x-demo-role: brand` immediately
4. Navigate to Brand Campaign Wizard → confirm screen list loads (not empty, not 403)
5. Switch to Retailer → confirm `x-demo-role: retaileradmin`
6. Switch back to Brand → confirm `x-demo-role: brand` again (not reverted to admin)
7. Refresh → confirm Brand persona is still active

**Pass criteria:** All seven steps pass in sequence. Step 4 (wizard loads) is the direct regression test for PR #46.

---

### Gate 4 — Role-Scoped Data Isolation

Each persona must see only the data it is authorised to see. Switch between personas and verify that data from the previous persona does not bleed into the next.

| Switch sequence | Data to verify |
|---|---|
| Admin → Brand | Brand view shows only brand-scoped screens, not the full admin screen list |
| Brand → Retailer | Retailer view shows only retailer-scoped stores, not brand campaigns |
| Retailer → Tech Ops | Tech Ops view shows device/screen status, not retailer store data |
| Tech Ops → SuperAdmin | SuperAdmin sees all tenants, all data (broadest scope) |

**Pass criteria:** No cross-persona data leakage. If a component shows data from the wrong role scope after a switch, the `onRoleChange` cache invalidation is not working correctly.

---

### Gate 5 — In-Flight Request Handling

Switch persona while a data-loading operation is in progress (e.g., navigate to a page that triggers a slow API call, then immediately switch persona before it resolves).

**Pass criteria:**
- [ ] The in-flight request is aborted (network tab shows `cancelled`, not a completed response with stale role data)
- [ ] The new persona's data loads correctly after the switch
- [ ] No console errors about rendering stale data from the previous persona

---

### Gate 6 — E2E Test Suite Parity

Run the full E2E test suite for all five persona suites in sequence **without** calling `localStorage.clear()` between suites (to simulate the worst-case real-world session state). All suites must pass.

```bash
# Run all persona suites in sequence
npx playwright test --grep "@superadmin"
npx playwright test --grep "@admin"
npx playwright test --grep "@retailer"
npx playwright test --grep "@brand"
npx playwright test --grep "@techops"
```

**Pass criteria:** Zero failures across all suites when run sequentially. If brand tests fail after admin tests, the `beforeEach` `DemoAuth.clear()` hook is missing or the `onRoleChange` cache invalidation is incomplete.

---

### Gate 7 — Staging Environment Guard

Confirm that staging does **not** accidentally activate the demo shim.

```bash
# On the staging deployment, open the browser console and run:
console.log(localStorage.getItem('demo_role'));       // must be null
console.log(localStorage.getItem('active_persona'));  // must be null
console.log(localStorage.getItem('auth_token'));      // must be null (no demo-token)
```

**Pass criteria:** All three values are `null` on staging. If any are set, the staging build is running with `VITE_MODE=development` — a misconfiguration that must be corrected before the Firebase cutover proceeds.

---

### Sign-Off Record

| Gate | Tester | Date | VITE_USE_FIREBASE=false | VITE_USE_FIREBASE=true (emulator) |
|---|---|---|---|---|
| Gate 1 — Persona Switching Correctness | | | ☐ Pass / ☐ Fail | ☐ Pass / ☐ Fail |
| Gate 2 — Session Persistence After Refresh | | | ☐ Pass / ☐ Fail | ☐ Pass / ☐ Fail |
| Gate 3 — Cross-Persona Switching | | | ☐ Pass / ☐ Fail | ☐ Pass / ☐ Fail |
| Gate 4 — Role-Scoped Data Isolation | | | ☐ Pass / ☐ Fail | ☐ Pass / ☐ Fail |
| Gate 5 — In-Flight Request Handling | | | ☐ Pass / ☐ Fail | ☐ Pass / ☐ Fail |
| Gate 6 — E2E Test Suite Parity | | | ☐ Pass / ☐ Fail | ☐ Pass / ☐ Fail |
| Gate 7 — Staging Environment Guard | | | ☐ Pass / ☐ Fail | N/A |

**Cutover authorised by:** _________________ **Date:** _________________

> All gates must show ✅ Pass in both columns before `VITE_USE_FIREBASE=true` is merged to `main`.
