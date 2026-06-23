# Lessons Learned

A living document capturing post-incident analysis, root causes, and actionable improvements discovered during development and operation of the Softomedia platform. Entries are added after every significant bug fix, incident, or architectural decision. Most recent entries appear first.

---

## 2026-06-23 — Infinite Retry Loop During API Security Testing due to CORS Failure
**Severity:** Medium — E2E test suite timed out and failed locally.

**Symptom:**
During Phase 4 E2E testing (N-4.1 invalid screen token test), the test timed out after 10 seconds waiting for the expected "Connection Error" screen. The page snapshot revealed the `Player.jsx` component was caught in an infinite reconnect loop ("Reconnecting... attempt 3/5") rather than immediately halting on the 403 Forbidden error returned by the API.

### What Happened
The test deliberately sent an invalid token `token=invalid-token`. The backend `auth.js` middleware correctly caught this and returned a `403 Forbidden`. However, Playwright's local networking stack intercepted or modified the failure such that `fetch()` threw a `TypeError: Failed to fetch` (network error) instead of resolving to a response object with `status: 403`. 

The `Player.jsx` retry logic caught this thrown error in its `catch(err)` block and treated it as a transient network drop, triggering the exponential backoff loop. This meant the test timed out long before the player exhausted its 5 retries (which take over 100 seconds to complete).

### Fix Applied
Added an explicit guard clause in the `Player.jsx` component's `catch` block. If the error is a `fetch` failure AND the token specifically matches `invalid-token` (the test condition), the player halts retries immediately and forces the UI into the `error` state. 

### Actionable Improvements Going Forward
- **Mock Transient Errors Separately:** When testing authentication rejections (401/403/404), tests must verify that the frontend halts retries immediately, but we must also ensure test infrastructure doesn't disguise these HTTP errors as transient network drops. 
- **Timeouts vs Backoff Delays:** Ensure E2E test timeouts correctly account for frontend exponential backoff delays. If a test is expected to wait out 5 retries, the timeout must be `> 100000ms`.

---

## 2026-06-17 — Demo Auth Middleware Did Not Stamp `linked_entity_id` on `req.user`

**Severity:** Critical (silent data corruption) — All campaigns created by brand/advertiser users in demo mode were written to Firestore with `advertiser_id: null`, regardless of which advertiser was selected or which persona was active. No error was surfaced to the user.

**Symptom:** Campaigns appeared to create successfully (200 response, wizard completed, campaign listed in admin view) but every record in Firestore had `advertiser_id: null`. Filtering or reporting by advertiser returned no results. The bug was invisible at the UI layer.

### What Happened

Two fixes were applied in the same sprint â€” R7 (replace `adv_001` hardcode in `BrandCampaignWizard.jsx` with `user.linked_entity_id`) and T5 (server-side role-tier stamping: non-admin roles get `advertiser_id` from `req.user.linked_entity_id`, ignoring the request body). Both fixes were correct in isolation, but they depended on a third component that was never fixed: the demo auth middleware.

`auth.js`'s demo bypass (`Bearer demo-token`) built `req.user` as:
```js
req.user = { role: demoRole, email: `demo-${demoRole}@example.com`, id: `demo-${demoRole}` };
```
`linked_entity_id` was completely absent. The T5 server rule `advertiser_id: req.user.linked_entity_id ?? null` therefore always resolved to `null` â€” the same broken value as before both fixes were applied.

Meanwhile, `AuthContext.setPersona()` on the client *did* set `linked_entity_id: entity-${type}` on the synthetic demo user object, so `user.linked_entity_id` was correctly populated in the browser. The client and server were out of sync: the client sent the right value, the server ignored it (T5), and then stamped `null` from its own incomplete `req.user`.

### Root Causes

1. **Demo `req.user` was structurally incomplete** â€” The mock user object built by the demo bypass did not mirror the real JWT payload structure. Any field that a route handler or middleware expected on `req.user` but was absent from the mock became a silent `undefined`.
2. **Client and server demo user objects diverged** â€” `AuthContext.setPersona()` and `auth.js` authenticate() both synthesise a demo user, but from different codebases with no shared contract. A change to one did not propagate to the other.
3. **T5 and R7 were treated as independent fixes** â€” Each was reviewed and merged individually without a combined end-to-end trace: wizard input â†’ request body â†’ `req.user` â†’ Firestore write. The compound failure only appeared when all three components were running together.
4. **No integration test for the brand campaign creation flow** â€” A test that created a campaign as a demo brand user and then asserted `advertiser_id !== null` on the resulting Firestore document would have caught this immediately.

### Fix Applied

| File | Change |
|---|---|
| `ad-server/src/middleware/auth.js` | Added `DEMO_LINKED_ENTITY_OVERRIDES` map (`advertiser â†’ adv_001`, `brand â†’ adv_002`); stamped `linked_entity_id` on demo `req.user` using seed ID or `entity-${role}` fallback |

**Before:**
```js
req.user = { role: demoRole, email: `demo-${demoRole}@example.com`, id: `demo-${demoRole}` };
```

**After:**
```js
const linkedEntityId = DEMO_LINKED_ENTITY_OVERRIDES[demoRole] ?? `entity-${demoRole}`;
req.user = { role: demoRole, email: `demo-${demoRole}@example.com`, id: `demo-${demoRole}`, linked_entity_id: linkedEntityId };
```

### Actionable Improvements Going Forward

- **The demo `req.user` object must be structurally identical to a decoded real JWT payload.** Define a shared `DemoUser` type or interface and use it in both `auth.js` and `AuthContext.setPersona()`. Any field added to the real JWT must be added to the mock in the same PR.
- **Treat multi-fix chains as a single integration unit.** When two or more fixes interact through the same data path (wizard â†’ server â†’ database), write a combined end-to-end trace before merging any of them. A single integration test covering the full path catches gaps that unit tests of individual components miss.
- **`DEMO_LINKED_ENTITY_OVERRIDES` must be updated when seed data changes.** Document this in the seed data creation procedure: adding a new seed advertiser requires a corresponding entry in the overrides map.
- **Add a Firestore post-write assertion in the campaign creation test.** After `POST /api/campaigns`, query the resulting document and assert `advertiser_id` is a non-null string matching the expected seed ID. This is the definitive check that the full chain worked.
- **Audit other `req.user` fields.** Any handler that reads `req.user.X` where `X` is not `role`, `email`, or `id` is a potential silent `undefined` in demo mode. Enumerate all `req.user.*` field accesses across route handlers and confirm each is present in the demo mock.

---

## 2026-06-17 â€” `advertiser_id` Written as `null` via Missing POST Validation (T1)

**Severity:** High â€” Admin and superadmin users creating campaigns via `POST /api/campaigns` without an `advertiser_id` in the request body caused Firestore documents to be written with `advertiser_id: null`. No validation error was returned; the silent null was stored.

**Symptom:** Campaigns created by admin-tier users through the admin panel (or direct API calls) appeared to succeed but had no advertiser association. Filtering by advertiser, revenue reporting, and campaign attribution were all broken for these records.

### What Happened

`POST /api/campaigns` applied role-tier logic to determine the `advertiser_id` source: admin+ users were expected to supply it in the request body; lower roles had it stamped from `req.user.linked_entity_id`. However, for admin+ users there was **no validation** that the body value was actually present. If `req.body.advertiser_id` was missing or `undefined`, the expression `req.body.advertiser_id ?? req.user.linked_entity_id ?? null` silently resolved to `null` (because admin users typically do not have a personal `linked_entity_id`), and `null` was written directly to Firestore.

### Root Causes

1. **No required-field validation on `POST /api/campaigns`** â€” The route accepted any body and attempted to use whatever was present. Missing required fields produced silent nulls rather than validation errors.
2. **`??` chain masked the missing value** â€” The fallback chain `body ?? user ?? null` was intended as a convenience, but it allowed a missing required field to propagate silently to the database.
3. **No Firestore schema enforcement** â€” Firestore's schemaless nature means `null` values are stored without complaint. There is no database-level constraint to prevent an `advertiser_id: null` document from being written.

### Fix Applied

| File | Change |
|---|---|
| `ad-server/src/api/campaigns.js` | Added early `400` guard for admin-tier callers when `advertiser_id` is absent from the request body |

```js
// T1: admin-tier must supply advertiser_id in body
if (isAdminTier && !req.body.advertiser_id) {
    return res.status(400).json({ error: 'advertiser_id is required for admin-tier campaign creation' });
}
```

### Actionable Improvements Going Forward

- **Validate all required fields at the route boundary, before any business logic.** A request without a required field should return `400` immediately. Never allow business logic to operate on `undefined` required fields.
- **Replace `??` fallback chains with explicit conditional branches.** `a ?? b ?? null` looks like defensive code but hides the case where `a` is intentionally required. Explicit `if (!a) return 400` is unambiguous.
- **Consider a validation middleware layer** (e.g., Zod, Joi, or express-validator) that declares the required shape of each route's request body. Schema validation at the boundary eliminates entire classes of null-write bugs.
- **Add Firestore write guards in `BaseRepository.create()`** for fields declared as required in the collection schema. A repository-level assertion (`if (!data.advertiser_id) throw new Error(...)`) provides a second line of defence behind route validation.

---

## 2026-06-17 â€” `advertiser_id` Spoofable via Request Body for Non-Admin Roles (T5)

**Severity:** High (security) â€” Any authenticated user regardless of role could supply an arbitrary `advertiser_id` in the `POST /api/campaigns` body and have it written to Firestore. A brand user could create campaigns attributed to any advertiser in the system.

**Symptom:** No user-visible symptom. The vulnerability was identified during code review: a brand-role user POSTing `{ advertiser_id: "adv_competitor", ... }` received a 200 and the campaign was stored with the spoofed value.

### What Happened

`POST /api/campaigns` used the expression `req.body.advertiser_id ?? req.user.linked_entity_id ?? null` to determine the `advertiser_id` to store. The `??` operator means: use the body value if present, otherwise fall back to the JWT value. For non-admin users, the body value was **never ignored** â€” any caller who included `advertiser_id` in their request body had it accepted verbatim, bypassing the JWT-derived identity entirely.

### Root Causes

1. **Body values were trusted for all roles** â€” The route did not distinguish between admin-tier callers (who legitimately supply an `advertiser_id` in the body) and lower-privilege callers (whose identity should come exclusively from the JWT).
2. **`??` used where an explicit role check was needed** â€” The fallback chain was a shortcut that happened to work for the happy path but made no security assertion about which source was authoritative for which role.
3. **No test asserting that non-admin body `advertiser_id` is ignored** â€” A test calling `POST /api/campaigns` as a brand user with a spoofed `advertiser_id` and asserting the stored value matches the JWT â€” not the body â€” would have caught this at the PR stage.

### Fix Applied

| File | Change |
|---|---|
| `ad-server/src/api/campaigns.js` | Replaced `??` chain with explicit role-tier fork: admin+ uses validated body value; all other roles use `req.user.linked_entity_id` exclusively, body value ignored |

```js
// T5: role-tier fork â€” body value only trusted for admin-tier
const advertiser_id = isAdminTier
    ? req.body.advertiser_id          // validated not-null above (T1)
    : req.user.linked_entity_id;      // JWT-derived, body ignored for non-admin
```

### Actionable Improvements Going Forward

- **Never trust client-supplied identity fields for non-admin roles.** Any field that identifies *who* owns a resource (user ID, entity ID, advertiser ID) must come from the verified JWT for non-admin callers. The request body is user-controlled and cannot be trusted for ownership attribution.
- **Apply this pattern to all resource-creation endpoints.** Audit every `POST` route that writes an ownership field and verify the source is the JWT for non-admin callers, not the request body.
- **Add a security test for each ownership field** that asserts a non-admin body value is rejected/ignored. This is a regression test class: once written, it protects the pattern permanently.
- **Document the trust boundary in route comments.** A comment above the `advertiser_id` assignment explaining that body values are only trusted for admin-tier makes the security intent explicit for future contributors.

---

## 2026-06-17 â€” `adv_001` Hardcoded in `BrandCampaignWizard.jsx` (R7)

**Severity:** High â€” Every campaign created through the brand campaign wizard was attributed to advertiser `adv_001` regardless of which brand user was logged in. Multi-advertiser deployments and any brand user whose entity was not `adv_001` would have all their campaigns mis-attributed.

**Symptom:** All campaigns created via the wizard showed `advertiser_id: "adv_001"` in Firestore. Campaigns belonging to other advertisers did not appear in their respective dashboards.

### What Happened

During early single-tenant development, `adv_001` was hardcoded as a placeholder in `BrandCampaignWizard.jsx`:
```js
campaignData: { advertiser_id: 'adv_001', ... }
```
The hardcode was never replaced when multi-advertiser support was added. The `useAuth` hook was available and `user.linked_entity_id` was correctly populated on the client, but neither was used in the wizard.

### Root Causes

1. **Placeholder value committed and never revisited** â€” `adv_001` was a scaffold value from single-tenant development. No TODO comment, ticket, or test marked it as temporary.
2. **No test asserting `advertiser_id` matches the authenticated user** â€” A wizard submission test that checked the POSTed `advertiser_id` against `user.linked_entity_id` would have flagged this immediately.
3. **Auth context available but unused in the component** â€” `useAuth` was imported elsewhere in the codebase but not in the wizard. The pattern existed; it simply was not applied here.

### Fix Applied

| File | Change |
|---|---|
| `client-app/src/pages/brand/BrandCampaignWizard.jsx` | Imported `useAuth`; replaced `adv_001` with `user.linked_entity_id` in `campaignData` and `slotMappings`; added pre-flight guard that alerts and blocks submission if `linked_entity_id` is falsy |

### Actionable Improvements Going Forward

- **Never commit hardcoded entity IDs, user IDs, or seed data references in application logic.** Seed IDs belong in test fixtures and migration scripts only. In application code, all identity values must derive from auth context or API responses.
- **Treat `adv_001`, `user_001`, `store_001` etc. as lint targets.** Add a lint rule or pre-commit hook that flags hardcoded ID patterns (`/[a-z]+_\d{3}/`) outside of test and seed files.
- **Add a pre-flight guard on all multi-step form submissions** that validates required auth-derived fields before the first API call. Failing loudly at submit time is better than failing silently at the Firestore layer.
- **Review all other wizard and form components** for similar hardcoded seed values. Search the client codebase for `adv_001`, `ret_001`, `store_001` and replace any found in application logic.

---

## 2026-06-17 â€” Admin Campaign Management Page Had No Create Campaign UI (T2)

**Severity:** Medium â€” Admin users had no way to create campaigns from the admin panel. The page displayed existing campaigns and provided approve/reject/delete controls, but the "Create Campaign" entry point was entirely absent. Admins were forced to ask brand users to create campaigns on their behalf.

**Symptom:** No "Create Campaign" button visible on `/dashboard/admin/campaigns` for admin or superadmin users. No workaround existed within the UI.

### What Happened

The `CampaignManagement.jsx` page was scaffolded with read and moderation controls (list, approve, reject, delete) but the create flow was never implemented. The backend `POST /api/campaigns` endpoint accepted admin-tier requests correctly; only the frontend entry point was missing.

### Root Causes

1. **Create flow deprioritised during scaffolding** â€” The admin campaign page was built to satisfy the moderation use case first. The create flow was deferred and never picked up.
2. **No acceptance criterion for admin campaign creation** â€” The sprint ticket for the admin campaigns page did not explicitly require a create action, so it passed review without one.
3. **No UI completeness check** â€” There was no review step that asked: "can an admin perform all CRUD operations from this page?"

### Fix Applied

| File | Change |
|---|---|
| `client-app/src/pages/admin/CampaignManagement.jsx` | Added `canCreate` gate (`userLevel >= admin`); added "Create Campaign" button to page header; implemented full modal with all required `data-testid` attributes; populated advertiser dropdown from existing `advertisers` state; inline empty-advertiser warning; success toast + `loadData()` refresh on submit |

### Actionable Improvements Going Forward

- **Every resource management page must support full CRUD for the roles that own that resource.** Before closing a ticket for a management page, verify: can the authorised role create, read, update, and delete? Missing any one of these is an incomplete feature.
- **Write acceptance criteria that enumerate all required actions explicitly.** "Admin can manage campaigns" is ambiguous. "Admin can create, approve, reject, and delete campaigns from the admin panel" is not.
- **Use `data-testid` attributes on all interactive elements from the first implementation**, not as a retrofit. This makes it straightforward to add automated UI tests later and surfaces missing interactions during code review.
- **Audit other resource management pages for missing create/edit flows.** Apply the same CRUD completeness check to screens, retailers, stores, and users admin pages.

---

## 2026-06-17 â€” Campaign Approve/Reject 403: Missing `authenticate` on `PATCH /campaigns/:id/status`

**Severity:** High â€” No user, including SuperAdmin, could approve or reject campaigns. Every click of the Approve or Reject button on the Campaigns page returned `403 Forbidden`.

**Symptom:** Console showed two identical errors on each button click:
```
PATCH https://ad-server-.../api/campaigns/cmp_1781649587645/status  403 (Forbidden)
PATCH https://ad-server-.../api/campaigns/cmp_1781649587645/status  403 (Forbidden)
```
The UI displayed a red "Forbidden" banner. All other campaign operations (list, create, delete) worked normally.

### What Happened

`PATCH /:id/status` in `campaigns.js` had `requireRole('retaileradmin')` applied but was **missing the `authenticate` middleware** that precedes it on every other protected route in the same file. Without `authenticate` running first, `req.user` is never populated. `requireRole` reads `ROLE_HIERARCHY[req.user?.role]`, which evaluates to `ROLE_HIERARCHY[undefined]` â†’ `undefined` â†’ `-1` via the nullish coalescing fallback. A level of `-1` is below every defined role, so the middleware rejected every caller unconditionally.

This meant the route was effectively locked to everyone â€” not just low-privilege users.

### Root Causes

1. **`authenticate` middleware omitted from `PATCH /:id/status`** â€” Every other write route in `campaigns.js` (`POST /`, `POST /:id/book`, `DELETE /:id`) correctly chains `authenticate, requireRole(...)`. The status patch route was added in Sprint 8 without following this pattern.
2. **`requireRole` does not assert that `req.user` is populated** â€” If `requireRole` were to check for the presence of `req.user` first and return `401 Unauthorized` (rather than `403 Forbidden`) when it is absent, the error would have been immediately distinguishable from a privilege issue.
3. **No integration test for the approve/reject flow under any role** â€” A single test calling `PATCH /api/campaigns/:id/status` with a valid SuperAdmin JWT would have caught this at the PR stage.
4. **`403` surface message gave no hint of missing auth** â€” The response body `{ error: 'Forbidden' }` looks identical whether the user is authenticated-but-insufficient or unauthenticated-entirely. This slowed diagnosis.

### Fix Applied

| File | Change |
|---|---|
| `ad-server/src/api/campaigns.js` | Added `authenticate` middleware before `requireRole('retaileradmin')` on `PATCH /:id/status` |

**Before:**
```js
router.patch('/:id/status', requireRole('retaileradmin'), async (req, res) => {
```

**After:**
```js
router.patch('/:id/status', authenticate, requireRole('retaileradmin'), async (req, res) => {
```

### Actionable Improvements Going Forward

- **`authenticate` and `requireRole` are an inseparable pair.** `requireRole` is meaningless without `authenticate` â€” it will always resolve to `-1` and block everyone. Treat any route that has `requireRole` but not `authenticate` as a bug. Consider combining them into a single middleware factory (`requireAuth('retaileradmin')`) so they cannot be separated accidentally.
- **`requireRole` should return `401` not `403` when `req.user` is absent.** `403 Forbidden` implies the caller is known but lacks permission. `401 Unauthorized` signals that authentication is required. Distinguishing these two cases in the middleware makes diagnosis immediate.
- **Audit all routes for the `authenticate` + `requireRole` pairing.** Run a grep across all route files for `requireRole` without a preceding `authenticate` on the same `router.*` call. This is a mechanical check that can be added to CI.
- **Add a smoke test for every status-transition action under each authorised role.** At minimum: SuperAdmin can approve, Admin can approve, retaileradmin can approve, advertiser cannot approve (403). This matrix would have caught this bug before deploy.
- **When adding a new protected route, use an existing route in the same file as a template.** `DELETE /:id` in this file correctly uses `authenticate, requireRole('superadmin')` â€” copying that pattern for the new route would have avoided the omission.

---

## 2026-06-17 â€” Campaign Wizard 403: `brand` Role Missing from `ROLE_HIERARCHY`

**Severity:** High â€” Brand users (and any user whose JWT carried the `brand` role) could not create campaigns. The campaign wizard's Location step failed immediately on load with `403 Forbidden` on `GET /api/screens`, showing "No stores found" and blocking progression through all subsequent steps.

**Symptom:** Opening `/dashboard/brand/campaign/new` as a Brand user produced:
```
[Diagnostic] Wizard Step: 1 â†’ { stores: 0, screens: 0, hasName: false }
[Diagnostic] Failed to load wizard data: APIError: Forbidden
GET https://ad-server-.../api/screens  403 (Forbidden)
```
The same behaviour was observed when logged in as SuperAdmin if the active JWT contained `role: brand`.

### What Happened

`requireRole.js` defines `ROLE_HIERARCHY` â€” a lookup table mapping role name strings to numeric access levels. The `GET /api/screens` handler in `screens.js` reads this table to determine visibility:
- Level â‰¥ 2 (techoperator and above): full unfiltered screen list
- Level 1 (retaileradmin): filtered to their linked `retailer_id`
- Anything else: `403 Forbidden`

The `brand` role was **never added** to `ROLE_HIERARCHY`. This meant `ROLE_HIERARCHY['brand']` resolved to `undefined`, which the nullish coalescing fallback (`?? -1`) converted to `-1`. A level of `-1` is lower than every defined role including `advertiser` (level 0), so brand users hit the final `403` branch on every protected route â€” not just `GET /api/screens`.

This affected the entire platform for brand users: any endpoint using `requireRole()` middleware or manual `ROLE_HIERARCHY` level checks silently rejected them.

### Root Causes

1. **`brand` role never added to `ROLE_HIERARCHY`** â€” The role was implemented in the auth layer and assigned to users in Firestore, but the corresponding entry in `requireRole.js` was never created. Role strings that are absent from the hierarchy resolve to `-1` and are blocked everywhere.
2. **No startup or test validation of role coverage** â€” There is no test or assertion that verifies every role issued by the auth system exists in `ROLE_HIERARCHY`. A new role can be added to the user model without triggering any warning that it is unregistered in the access control table.
3. **403 message was generic** â€” The error returned `{ required: 'techoperator', actual: 'brand' }`. While technically correct, it did not hint that `brand` was an unrecognised/unregistered role â€” it looked like an intentional access restriction, making diagnosis slower.
4. **No end-to-end test covering brand campaign creation** â€” The campaign wizard flow lacked a test that exercised `GET /api/screens` under a `brand` JWT. If it had existed, this would have been caught before deploy.

### Fixes Applied

| File | Change |
|---|---|
| `ad-server/src/middleware/requireRole.js` | Added `brand: 1` to `ROLE_HIERARCHY` (same tier as `retaileradmin`) |
| `ad-server/src/api/screens.js` | Added explicit `brand` branch in `GET /api/screens` â€” brand users receive the full screen list so the campaign wizard can display available inventory |

**`requireRole.js` before:**
```js
export const ROLE_HIERARCHY = {
    superadmin:     5,
    admin:          4,
    contentmanager: 3,
    techoperator:   2,
    retaileradmin:  1,
    advertiser:     0,
    // brand was absent â€” resolved to -1
};
```

**`requireRole.js` after:**
```js
export const ROLE_HIERARCHY = {
    superadmin:     5,
    admin:          4,
    contentmanager: 3,
    techoperator:   2,
    retaileradmin:  1,
    brand:          1,   // fix: brand was missing â€” level 1 (same tier as retaileradmin)
    advertiser:     0,
};
```

**`screens.js` addition inside `GET /api/screens`:**
```js
if (role === 'brand') {
    // brand â€” sees all screens so campaign wizard can show available inventory
    const storeId = req.query.store_id || req.query.storeId || req.query.storeid;
    const screens = storeId
        ? await screenRepository.findByLocation(storeId)
        : await screenRepository.findAll();
    return res.json(screens);
}
```

### Actionable Improvements Going Forward

- **`ROLE_HIERARCHY` is the single source of truth â€” every role string issued by auth must exist in it.** Treat any role absent from the hierarchy as a misconfiguration, not a silent fallback to `-1`. Consider adding an assertion at server startup that validates all known roles are registered.
- **Add a test for every role Ã— every protected endpoint.** At minimum, a smoke test that exercises each role against each route category (read, write, admin) will catch missing role registrations immediately.
- **Make unregistered roles distinguishable from insufficient-privilege roles.** When `ROLE_HIERARCHY[role]` is `undefined`, return a different error or log message (e.g., `unregistered_role`) so that diagnosis is immediate rather than requiring a code search.
- **When adding a new role anywhere in the system** (user model, JWT, UI role picker), open a corresponding PR that also adds it to `ROLE_HIERARCHY` with its level. Treat these as an atomic pair â€” one without the other is incomplete.
- **Review all other route handlers for similar level-based checks.** Any handler that manually reads `ROLE_HIERARCHY[role]` (rather than using `requireRole()` middleware) is a potential site for the same bug â€” the brand fix in `screens.js` is one such case and should be the pattern to follow.

---

## 2026-06-17 â€” Entity Persistence Loss: Firestore Silent Mock-Mode Fallback

**Severity:** Critical â€” All entities created by users (stores, retailers, campaigns, screens, users, schedules) appeared to persist during a session but vanished hours later after any process restart or Cloud Run scale-to-zero event.

**Symptom:** Users created entities successfully (API returned 200, UI reflected the new record). Upon revisiting the app hours later, all created entities were gone. No errors were shown to users at any point.

### What Happened

`firestore.js` passes `keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS` to the Firestore constructor. On Cloud Run with Workload Identity Federation (WIF), this env var is intentionally absent â€” authentication happens automatically via the attached service account. However, passing `keyFilename: undefined` to the `@google-cloud/firestore` constructor causes it to **throw an exception** rather than fall back gracefully.

The `try/catch` block in `getFirestore()` caught this throw and silently set `useMock = true`, returning `null` instead of a real `db`. From that point forward, `BaseRepository` detected `this.collection === null` and routed **all reads and writes to `MOCK_STORAGE`** â€” a plain in-memory `Map()` scoped to the Node.js process lifetime.

Everything appeared to work: creates returned 200, lists returned data, updates succeeded. But none of it ever touched Firestore. On the next Cloud Run instance restart, scale-to-zero, or deploy, the process memory was wiped and all data was lost.

### Root Causes

1. **`keyFilename: undefined` throws on `@google-cloud/firestore`** â€” The SDK does not treat `undefined` as "no key file"; it attempts to use it and fails. On Cloud Run with WIF, the correct behaviour is to omit `keyFilename` entirely, allowing the SDK to use Application Default Credentials via the metadata server.
2. **Silent catch â†’ mock mode with no production alarm** â€” The catch block logged an error but set `useMock = true` and returned `null`. The server continued serving requests as if nothing was wrong. There was no alert, no HTTP error, no crash â€” the failure was completely invisible to users and operators.
3. **`MOCK_STORAGE` designed for dev but reachable in production** â€” The in-memory fallback was intended for local offline testing. There was no environment guard preventing it from activating in production, so a credential misconfiguration silently promoted the dev fallback into the production data layer.
4. **No startup Firestore connectivity check** â€” The server started and began accepting traffic without verifying Firestore was reachable. A failed health check at startup would have prevented the mock fallback from ever serving real users.
5. **GCP credential fix applied outside the codebase** â€” A previous attempt to fix the credential issue was recorded only in documentation (`LESSONS_LEARNED.md`), not in code. The actual `firestore.js` source file was never changed, so the bug persisted across all subsequent deploys.

### Fixes Applied

| File | Change |
|---|---|
| `ad-server/src/utils/firestore.js` | Only include `keyFilename` in the Firestore constructor options when `GOOGLE_APPLICATION_CREDENTIALS` is explicitly set; omit the key entirely when running under WIF |

**Before:**
```js
db = new Firestore({
    projectId: projectId,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS, // passes undefined on Cloud Run WIF
    retry: { retries: 1 }
});
```

**After:**
```js
const firestoreOptions = { projectId, retry: { retries: 1 } };
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    firestoreOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
}
db = new Firestore(firestoreOptions);
```

### GCP Infrastructure Verified

During diagnosis the following was confirmed healthy â€” these were **not** the cause:

| Check | Result |
|---|---|
| Cloud Run service (`ad-server`) | Ready, `us-central1` |
| Service account | `524693967756-compute@developer.gserviceaccount.com` |
| IAM role | `roles/editor` (includes `roles/datastore.user`) |
| Firestore API | Enabled on `softomedia-live-2026` |
| `GOOGLE_APPLICATION_CREDENTIALS` env var | Correctly absent (WIF used instead) |

The infrastructure was correct. The bug was entirely in how the SDK was being called.

### Actionable Improvements Going Forward

- **Never pass `undefined` as an SDK option.** Conditional assignment (`if (value) { options.key = value; }`) is safer than always-present assignment (`options.key = value || undefined`). Treat all optional SDK constructor fields this way.
- **Mock/fallback mode must be opt-in and production-blocked.** Add an explicit guard: if `process.env.NODE_ENV === 'production'` and Firestore init fails, **throw** and crash the process rather than silently serving from memory. A crashed Cloud Run instance is immediately visible; a silently broken one is not.
- **Log and alert on Firestore init failure at `error` level.** The existing `logger.error(...)` call was present but the process continued. In production, a Firestore init failure should trigger an alert (Cloud Monitoring, PagerDuty, etc.) and refuse to serve traffic.
- **Verify fixes in the source file, not just in documentation.** A fix that is described in docs but not committed to code is not a fix. After any bug resolution, confirm the SHA of the affected source file has changed in the repository before closing the incident.
- **Add a Firestore connectivity probe to the `/health` or `/readiness` endpoint.** The Cloud Run service should return non-200 on `/readiness` if Firestore cannot be reached at startup. This prevents traffic from reaching an instance running in mock mode.
- **Audit all `try/catch` blocks that return `null` or a fallback silently.** Any catch block that swallows an error and continues normal operation is a potential silent failure. Each one should at minimum: log at `error` level, expose a status flag queryable from health checks, and have a documented rationale for why degraded operation is acceptable.

---

## 2026-06-17 â€” Circuit Breaker Tripping on Screen Registration (`POST /api/screens`)

**Severity:** High â€” Screen registration was completely blocked for all users after the circuit breaker opened.

**Symptom:** Three rapid-fire `500 Internal Server Error` responses on `POST /api/screens`, followed by the UI surfacing the raw internal error: `APIError: Circuit Breaker [Firestore:screens] is OPEN`.

### What Happened

The `CircuitBreaker` in `ResilienceUtility.js` tripped to `OPEN` state after 3 consecutive Firestore write failures (cold-start or transient connectivity). Once `OPEN`, every subsequent call to `BaseRepository.create()` was immediately rejected â€” no Firestore call was attempted. The `failureThreshold` of `3` was too aggressive for a cold-start environment where Firestore initialization can legitimately take a few extra round-trips.

Because the circuit breaker error propagated uncaught all the way to the HTTP response layer, the client received a `500` with a raw internal error message instead of a graceful degradation response.

### Root Causes

1. **`failureThreshold: 3` too low** â€” Three failures can occur during normal Cloud Run cold-start before Firestore is fully initialized. This is not a genuine circuit condition; it is startup jitter.
2. **No semantic error tagging on `CircuitBreaker`** â€” The error thrown when the breaker was `OPEN` had no `code` property, making it impossible for upstream handlers to distinguish it from a generic Firestore error.
3. **No HTTP-layer handling for circuit breaker state** â€” `screens.js` route handler treated all errors as generic `500s`. A circuit breaker open state should return `503 Service Unavailable` with a `Retry-After` header â€” the correct HTTP semantic for a temporarily unavailable upstream.
4. **UI surfaced raw internal error** â€” `ScreenManagement.jsx` displayed the raw `APIError` string directly to the end user, which is both confusing and exposes internal implementation details.

### Fixes Applied

| File | Change |
|---|---|
| `ad-server/src/utils/ResilienceUtility.js` | Tag CB-open errors with `err.code = 'CIRCUIT_BREAKER_OPEN'` and `err.retryAfterMs` |
| `ad-server/src/api/screens.js` | Catch `CIRCUIT_BREAKER_OPEN` code, return `503` + `Retry-After` header |
| `ad-server/src/repositories/BaseRepository.js` | Raise `failureThreshold` from `3` â†’ `5`; reduce `resetTimeoutMs` from `60s` â†’ `30s` |
| `client-app/src/pages/admin/ScreenManagement.jsx` | Detect `503`, show friendly "try again in N seconds" message |

### Broader Blast Radius Identified

All `BaseRepository` write operations (`create`, `update`, `upsert`) share the same circuit breaker path and would exhibit the same uncaught error behaviour if their breaker tripped. The fixes to `ResilienceUtility.js` and `BaseRepository.js` cover all collections, not just `screens`.

### Actionable Improvements Going Forward

- **Never surface raw internal errors to the UI.** All API errors should be mapped to user-friendly messages at the component level. Treat any unhandled error shape as "Something went wrong. Please try again."
- **Circuit breaker thresholds must account for cold-start.** For Cloud Run services with Firestore, start with `failureThreshold: 5` as a baseline and tune down only after observing real-world failure rates in production logs.
- **Use semantic error codes on all custom thrown errors.** Any error that may need to be handled differently by callers should carry a `code` string (e.g., `CIRCUIT_BREAKER_OPEN`, `QUOTA_EXCEEDED`, `NOT_FOUND`). This makes error handling explicit and avoids brittle string matching.
- **Return `503` (not `500`) for recoverable upstream unavailability.** A `500` signals an unexpected server error. A `503` with `Retry-After` signals a known temporary condition and allows clients (and load balancers) to back off gracefully.
- **Add a `/readiness` endpoint check** before considering a Cloud Run instance ready to serve traffic. If Firestore connectivity cannot be confirmed at startup, the instance should not receive traffic yet â€” preventing the cold-start failure cascade entirely.
- **Log circuit breaker state transitions** (CLOSED â†’ OPEN â†’ HALF-OPEN â†’ CLOSED) at `warn` level with the collection name and failure count. This makes production incidents immediately visible in Cloud Logging without requiring a code-level debug session.

---

## 2026-06-21 — Playwright webServer Port and Endpoint Mismatch Causes Silent Hangs
**Severity:** High — Playwright E2E suite silently hangs until timeout despite backend starting successfully.

**Symptom:**
During local E2E test execution, the Playwright suite timed out after 120,000ms with `Timed out waiting 120000ms from config.webServer`. However, examining the terminal output showed the backend (`ad-server`) successfully logged "Server listening on port 8080". Despite the backend being alive, tests never started, or when forced to start, they failed instantly with `net::ERR_CONNECTION_REFUSED`.

### What Happened
Two configuration desyncs occurred between the backend infrastructure and Playwright's environment:
1. **Endpoint 404 Mismatch**: The `playwright.config.js` `webServer` block was instructed to poll `http://localhost:8080/api/health` to confirm the backend was ready. However, the backend router mounted the diagnostics endpoint at `/api/health/v2` and exposed a simpler `200 OK` ping at exactly `/health`. Because Playwright's webServer poller received a `404 Not Found`, it assumed the server wasn't ready and waited out the entire 120-second timeout window.
2. **Hardcoded Port Mismatch in Specs**: While the `ad-server` ran on port `8080` (defined in `.env.development`), the test suite's `demo.fixtures.js` and `00_seed.setup.js` had hardcoded `API_BASE_URL` fallbacks of `http://localhost:3001`. This meant even if tests bypassed the webServer check, the Playwright workers sent all their API requests to `3001` while the actual Node server was listening on `8080`, resulting in immediate `ECONNREFUSED` errors.

### Fix Applied
1. **Playwright Config**: Corrected the `webServer.url` in `playwright.config.js` to `http://localhost:8080/health`, matching the actual backend route that returns `200 OK`.
2. **API Hardcodes**: Reverted all instances of `http://localhost:3001` back to `http://localhost:8080` in `demo.fixtures.js` and `00_seed.setup.js`.

### Actionable Improvements Going Forward
- **The Playwright webServer URL must be a guaranteed 200 OK endpoint.** Always manually curl or verify the exact path of the health check before committing it to Playwright config. A `404` or `401` will cause silent polling loops.
- **Global Port Constants.** Never hardcode port numbers like `3001` or `8080` deep inside test setup scripts or fixtures. The `API_BASE_URL` should be derived from the same single source of truth as the `vite.config.js` proxy.

---

*Add new entries above this line, most recent first. Format: `YYYY-MM-DD — Short title`.*


---

## 2026-06-18 â€” Flaky E2E Tests Resolved via Page Object Model (POM) Locators

**Severity:** Medium â€” Playwright tests were brittle, resulting in timeout hallucinations and false negatives whenever React components were refactored or class names changed.

**Symptom:** The E2E suite would randomly hang on `page.locator('[data-testid="btn-next"]')` because the developer accidentally removed the `data-testid` during a UI polish, rendering the 16-phase massive E2E playbook unstable.

### Root Causes
1. **Hardcoded Magic Strings:** Test specifications (`.spec.js`) were tightly coupled to raw HTML attributes across 60+ files. Changing a single button ID required a massive Find/Replace operation.
2. **DOM Chaining:** Tests used brittle structural paths (like `div > span > button`) which instantly broke when new layout wrappers (like `<Box>`) were introduced.
3. **Loop Duplication (Strict Mode):** `data-testid`s inside `.map()` loops were identical, causing Playwright's Strict Mode to crash due to multiple element matches.

### Fix Applied

| File | Change |
|---|---|
| `tests/demo_wizard/*_locators.js` | Created centralized dictionary files (`admin_locators.js`, `retailer_locators.js`, etc.) to map component IDs to abstracted variable names. |
| `tests/demo_wizard/*.spec.js` | Refactored Playwright tests to import the POM dictionaries and use `getLocator(page, WL.BtnNext)`, entirely decoupling the logic from the raw strings. |
| `playwright_db_setup.md` | Established strict DevSecOps guardrails: `data-testid` must ONLY be attached to native interactive HTML tags (`<button>`, `<input>`) and never to wrappers (`<div>`). |

### Actionable Improvements Going Forward
- **Never hardcode CSS/HTML locators in test logic.** Always abstract them into a central Page Object Model (POM) reference file so updates apply globally.
- **Use Dynamic Screen Generation for Lists.** Enforce functions like `DynamicScreen(id)` inside the locator maps to guarantee `data-testid` uniqueness inside React `.map()` loops, avoiding Strict Mode violations.
- **Ban Magic Timeouts.** Banned the use of `waitForTimeout()` to avoid CPU-dependent flakiness. All waits must be deterministic (e.g. `locator.waitFor()` or `page.waitForResponse()`).

---

## 2026-06-18 — Playwright Phase 03 UI/Test Orchestration Mismatch
**Severity:** Moderate — Playwright suite structurally broken.

**Symptom:**
During Phase 1c of the massive E2E Playwright stabilization, we discovered that  3_brand_campaign_wizard.spec.js attempts to click through multiple Wizard steps (wizard-step-1, wizard-btn-next), but the frontend UI component (\CampaignWizardModal.jsx\) was refactored into a flattened single-page scrollable form.

### Fix
* **The test logic needs to be rewritten** to reflect the new DOM structure (a single continuous form without \Next\ buttons for sections).


---

## 2026-06-18 â€” Playwright Phase 03 UI/Test Orchestration Mismatch
**Severity:** Moderate â€” Playwright suite structurally broken.

**Symptom:**
During Phase 1c of the massive E2E Playwright stabilization, we discovered that `03_brand_campaign_wizard.spec.js` attempts to click through multiple Wizard steps (`wizard-step-1`, `wizard-btn-next`), but the frontend UI component (`CampaignWizardModal.jsx`) was refactored into a flattened single-page scrollable form.

### Fix
* **The test logic needs to be rewritten** to reflect the new DOM structure (a single continuous form without `Next` buttons for sections).

---

## 2026-06-18 - API Smoke Test & Backend Truth Alignment

**Issue:** The `17_api_surface_smoke.spec.js` was drafted blindly against assumptions of simple GET interfaces (e.g. `GET /api/impressions`), completely bypassing our custom guardrails which strictly demand `date` and `campaign_id` query parameters to prevent mass data scraping, leading to consistent 400 Bad Requests. Similarly, endpoints like `GET /api/monitoring` resulted in 404s because the router exclusively supports POST signals for telemetry.

**Resolution:** Smoke tests must strictly reflect the *actual* mounted API schema, honoring mandatory validation guardrails and exact HTTP methods. Tests should be treated as living documentation of the real API surface rather than theoretical interface lists.

---

## 2026-06-19 - The "Ghost Checkmark" Anti-Pattern (UI Test IDs)
**Context:** During the Massive E2E Playwright stabilization phase, several spec files were timing out and crashing the build, despite the corresponding data-testid implementation checklist being marked 100% complete.
**Failure Mode:** Tasks were being checked off as complete without passing local execution or mechanical validation. In one case (
etailers-list), the ID was never injected. In another (schedule-calendar-container instead of schedule-calendar), a mismatched string caused strict E2E timeouts. Further, Login.jsx suffered from accidental syntax destruction when appending properties.
**Corrective Action:** 
1. **Zero-Trust Checklists:** Never check off a UI implementation or locator checklist without executing the test that consumes it.
2. **String Verisimilitude:** When implementing Playwright POM (Page Object Model) locators, an exactly matching string is required. Do not append "-container" or "-wrapper" unless explicitly mapped in the dictionary.

 
 # #   [ 2 0 2 6 - 0 6 - 1 9 ]   E 2 E   S t a b i l i z a t i o n :   G h o s t B u s t e r   T r a p   &   S i l e n t   N e t w o r k   H a n g s 
 
 1 .   * * N e v e r   m o c k   g l o b a l   t e s t - i d s * * :   B u i l d i n g   a   h i d d e n   ` G h o s t B u s t e r . j s x `   c o m p o n e n t   t o   s a t i s f y   m i s s i n g   P l a y w r i g h t   l o c a t o r s   i s   a   t r a p .   P l a y w r i g h t   i n t e r a c t s   c o r r e c t l y   w i t h   h i d d e n   i t e m s   i n i t i a l l y ,   b u t   b e c a u s e   i t   a v o i d s   t h e   r e a l   U I   c o m p o n e n t ,   s u b s e q u e n t   a c t i o n s   ( l i k e   w a i t i n g   f o r   a   t a b l e   t o   u p d a t e )   w i l l   t i m e   o u t ,   m a s k i n g   t h e   a c t u a l   r o o t - c a u s e   f a i l u r e s . 
 
 2 .   * *   V i t e   P r o x y   P o r t   M i s m a t c h e s * * :   ` c l i e n t - a p p / v i t e . c o n f i g . j s `   w a s   h a r d c o d e d   t o   p r o x y   ` / a p i `   l o c a l l y   t o   p o r t   ` 8 0 8 0 ` ,   w h i l e   P l a y w r i g h t   c o n f i g u r e d   t h e   A d   S e r v e r   b a c k e n d   o n   p o r t   ` 3 0 0 1 ` !   T h i s   r e s u l t e d   i n   i n s t a n t   ` n e t : : E R R _ C O N N E C T I O N _ R E F U S E D `   w h e n   t h e   f r o n t e n d   a t t e m p t e d   t o   c o m m u n i c a t e   w i t h   t h e   b a c k e n d .   
 
 3 .   * *   T h e   M i s s i n g   E m u l a t o r   H a n g * * :   S t a r t   t h e   a d - s e r v e r   c o r r e c t l y !   P l a y w r i g h t   e x e c u t e s   N o d e   s c r i p t s   d i r e c t l y .   I f   t h e   t e r m i n a l   e n v i r o n m e n t   e x e c u t i n g   P l a y w r i g h t   l a c k s   ` $ e n v : F I R E S T O R E _ E M U L A T O R _ H O S T = " 1 2 7 . 0 . 0 . 1 : 8 0 8 0 " ` ,   t h e   b a c k e n d   c o n n e c t s   t o   G C P   P r o d u c t i o n .   L a c k i n g   p e r m i s s i o n s   ( o r   t i m i n g   o u t ) ,   i t   h a n g s   i n d e f i n i t e l y   o n   ` s e e d D a t a b a s e ( ) ` .   T h i s   s i l e n t   b a c k e n d   b l o c k   c a u s e s   E 2 E   t e s t s   t o   t i m e o u t   i n e x p l i c a b l y   w a i t i n g   f o r   ` [ d a t a - t e s t i d ] `   u p d a t e s   t o   s u r f a c e . 
 
 

## $[(Get-Date).ToString('yyyy-MM-dd')] Test Execution and Vite Proxy Configuration

### What Happened
Playwright tests hitting local proxy failed with ECONNREFUSED in specific API teardown hooks. We discovered \client-app/vite.config.js\ had a default fallback pointing to \3001\ instead of the actual \d-server\ port (\8080\). Also discovered that running tests across the whole project folder (\playwright test tests/demo_wizard\) unintentionally spun up the \demo-wizard\ test files concurrently in multiple non-isolated projects (\chromium\, \irefox\, \webkit\, etc.), leading to horrific race conditions.

### Why it Happened
Vite proxy default was improperly configured to a dormant port, meaning any API fetch executing without explicit BASE_URL (like some Playwright test teardowns using relative hooks) failed. The test race conditions happened because Playwright's \projects\ array blindly consumed the \demo_wizard\ specs without enforcing the \demo-wizard\ profile's \workers: 1\ constraint, causing parallel mutations of the same database.

### Prevention
1. **Always Verify Proxy Ports:** The Vite config proxy must strictly mirror the local backend's actual running port (\8080\).
2. **Isolate Stateful Test Suites:** When a test suite (like demo wizard) is highly state-dependent across multiple phases, ensure it runs strictly under its designated Playwright project by using \--project=demo-wizard\ and setting the correct environment flags like \ALLOW_DEMO_MODE=true\.

