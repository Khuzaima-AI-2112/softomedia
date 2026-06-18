## Project: SoXomedia Platform (cfroszte/softomedia-live2026)

This Space is exclusively for the SoXomedia platform — a multi-role DOOH ad-network
(React · Node/Express · Firestore · Cloud Run · Playwright E2E · Vite).
Repo: cfroszte/softomedia-live2026.

---

## Rule 1: Repository Boundary Guard
If any pasted content — terminal output, file paths, error messages, stack traces, or
code — references anything other than cfroszte/softomedia-live2026, do NOT answer.
Instead respond:
"This looks like it's from a different project ([detected name/path]).
Did you mean to paste something else?"
Do not pull files from foreign repos to investigate. Ask for clarification first.

## Rule 2: Stack Boundary Guard
The SoXomedia canonical stack is:
React (Vite), Node.js/Express, Firestore, Cloud Run, Playwright, GitHub Actions.
If a question references a technology not on this list (e.g. Terraform, Next.js,
Angular, MySQL, The Hammer, thehammer), flag it before answering:
"This doesn't look like a SoXomedia stack technology — are you asking about
SoXomedia or a different project?"

## Rule 3: Role × Auth Guard
The platform has exactly 7 roles in ROLE_HIERARCHY:
  superadmin (5), admin (4), contentmanager (3), techoperator (2),
  retaileradmin (1), brand (1), advertiser (0).
If a code suggestion adds a new role string anywhere (JWT, UI picker, seed data,
or Firestore), it MUST also update `ad-server/src/middleware/requireRole.js`
ROLE_HIERARCHY in the same response. A role absent from the hierarchy resolves
to -1 and blocks that user from every protected endpoint silently.
(LESSONS_LEARNED.md — Campaign Wizard 403: brand role missing from ROLE_HIERARCHY)

## Rule 4: Demo Auth Contract
The demo bypass in `ad-server/src/middleware/auth.js` builds `req.user` for
Bearer demo-token requests. This object MUST be structurally identical to a
decoded real JWT payload — every field that any route handler reads from
`req.user` must be present in the demo mock, including `linked_entity_id`.
If a suggestion reads a new field from `req.user`, the same response must also
update the demo mock in `auth.js`.
The demo `DEMO_LINKED_ENTITY_OVERRIDES` map must be updated whenever seed
entity IDs change.
(LESSONS_LEARNED.md — Demo Auth Middleware Did Not Stamp linked_entity_id)

## Rule 5: Middleware Pairing Rule
`authenticate` and `requireRole()` are an inseparable pair. `requireRole` without
a preceding `authenticate` on the same route always resolves to -1 and blocks
everyone, returning 403 instead of 401. Never suggest adding `requireRole` to
a route without also confirming `authenticate` precedes it on that same route.
(LESSONS_LEARNED.md — Campaign Approve/Reject 403: Missing authenticate)

## Rule 6: Route Ordering Rule
In Express, static-segment routes MUST be registered before wildcard `/:id`
routes on the same HTTP method. Any suggestion that adds a new static route
(e.g. GET /pending/:retailerId, POST /locations/:id/approve-all) must place it
above all existing `/:id` wildcard handlers in the same file. Failure to do this
causes the wildcard to shadow the static route silently with a 404.

## Rule 7: No Client-Supplied Identity Fields for Non-Admin Roles
For non-admin roles (brand, retaileradmin, advertiser), ownership fields
(`advertiser_id`, `retailer_id`, `linked_entity_id`) MUST be stamped from
`req.user` (JWT-derived), never from `req.body`. Only admin-tier roles may
supply ownership fields in the request body, and those must be validated
not-null before use. Never suggest a `??` chain that allows a body value to
silently reach the database for non-admin callers.
(LESSONS_LEARNED.md — advertiser_id Spoofable via Request Body for Non-Admin Roles)

## Rule 8: No Hardcoded Seed IDs in Application Logic
Seed entity IDs (`adv_001`, `ret_001`, `store_001`, `demo-retailer-freshmart`, etc.)
belong only in test fixtures, seed scripts, and `DEMO_LINKED_ENTITY_OVERRIDES`.
They must never appear in component logic, route handlers, or wizard form state.
All identity values in application code must derive from auth context
(`user.linked_entity_id`) or API responses, never from string literals.
(LESSONS_LEARNED.md — adv_001 Hardcoded in BrandCampaignWizard.jsx)

## Rule 9: Firestore Mock Mode Is Production-Blocked
The in-memory `MOCK_STORAGE` fallback in `BaseRepository` exists for local
offline development only. Any suggestion that touches `firestore.js` or
`BaseRepository.js` must preserve the guard: if Firestore init fails in
`NODE_ENV=production`, the process must throw and crash — not silently activate
mock mode. A crashed Cloud Run instance is immediately visible; a silently broken
one writes data to memory that vanishes on the next scale-to-zero.
(LESSONS_LEARNED.md — Entity Persistence Loss: Firestore Silent Mock-Mode Fallback)

## Rule 10: Never Pass `undefined` as an SDK Option
Conditional assignment (`if (value) { options.key = value; }`) is required for
all optional SDK constructor fields. Always-present assignment
(`options.key = value || undefined`) causes SDK throws that are caught silently.
This pattern is mandatory in `firestore.js` and any future SDK initialisation.
(LESSONS_LEARNED.md — Entity Persistence Loss: Firestore Silent Mock-Mode Fallback)

## Rule 11: PowerShell Line Continuations
When writing PowerShell commands, avoid backtick (`) line continuations wherever
possible. Use `cmd /c "..."` wrapping for Playwright CLI calls to ensure
stdout+stderr merge before PowerShell sees them. Trailing whitespace after a
backtick silently breaks the continuation.

## Rule 12: Playwright globalTeardown Syntax
Playwright's `globalSetup` and `globalTeardown` config keys accept a file path only.
The `file#namedExport` fragment syntax is NOT supported — Node's module resolver
treats the fragment as part of the filename and throws `MODULE_NOT_FOUND` before
any test runs. Always use a wrapper file that re-exports the function as `default`.

## Rule 13: Circuit Breaker Semantics
When a `CIRCUIT_BREAKER_OPEN` error reaches an HTTP route handler, it must return
`503 Service Unavailable` with a `Retry-After` header — not `500`. Never surface
raw internal error strings to the UI. `failureThreshold` for Firestore operations
starts at 5 (not 3) to account for Cloud Run cold-start jitter.
(LESSONS_LEARNED.md — Circuit Breaker Tripping on Screen Registration)

## Rule 14: CRUD Completeness on Resource Management Pages
Every resource management page must support full CRUD for the roles that own
that resource. Before any admin page ticket is considered Done, verify:
can the authorised role create, read, update, and delete from the page?
All interactive elements must carry `data-testid` attributes from first
implementation — not as a retrofit.
(LESSONS_LEARNED.md — Admin Campaign Management Page Had No Create Campaign UI)

## Rule 15: Sprint Awareness
Active sprint: see `current_sprint/` directory for the current sprint plan.
All answers must be consistent with current sprint scope. Flag anything that
belongs to a future sprint before suggesting it. `massivee2e.md` is the canonical
Phases 0–16 demo wizard doc — do not create parallel docs for demo wizard phases.

## Rule 16: docs/LESSONS_LEARNED.md Is Always Current
`docs/LESSONS_LEARNED.md` must be updated in the same commit as any significant
bug fix. New entries go at the top (most recent first). Format:
`YYYY-MM-DD — Short title`. A fix that is described only in a PR comment but not
in LESSONS_LEARNED.md is incomplete.

---

## Key Docs
- `docs/LESSONS_LEARNED.md` — real mistakes from this repo's history; read before every sprint
- `current_sprint/massivee2e.md` — canonical demo wizard spec (Phases 0–16)
- `current_sprint/active_personaVSdemo_role.md` — persona ↔ demo role mapping
- `.agent/workflows/demo.md` — demo run workflow and registry
- `playwright.config.js` — Playwright project config (demo-wizard project, port 3001/5173)
- `tests/demo_wizard/00_seed.setup.js` — demo seed + persona constants (single source of truth)
- `ad-server/src/middleware/requireRole.js` — ROLE_HIERARCHY (authoritative role list)
- `ad-server/src/middleware/auth.js` — demo auth bypass + DEMO_LINKED_ENTITY_OVERRIDES
