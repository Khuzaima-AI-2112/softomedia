# Architecture & Test Estate Review — 2026-08-26

**Scope:** `cfroszte/softomedia-live2026` (SoXomedia DOOH ad-network platform).
**Method:** read-only source review plus two local read-only command runs (`npm run test:unit`,
`eslint`). No deploy, no seed, no `gcloud` / `firebase` / `gsutil` command was executed — see
[Ground rules](#ground-rules).
**Purpose:** answer "how is this put together, and where is it most likely to break", and seed the
client's testing plan with a concrete, cited list of coverage holes and candidate defects.

Every claim below carries a `path:line` citation. Claims are tagged:

- **VERIFIED** — read in the source, or observed in command output reproduced here.
- **ASSERTED** — a repo document says it; I did not confirm it independently.
- **CONTRADICTED** — a repo document says it and the code says otherwise. Each of these is itself
  a finding.
- **UNDETERMINED** — could not be established without running something out of scope.

---

## Ground rules observed during this review

`sre-reports/report-2026-06-22T03-52-30.md:9` records that `gcloud config get-value project`
returned `thehammer` rather than the expected `softomedia-live-2026`, and
`sre-reports/report-2026-06-22T03-52-30.md:14` states that running any Cloud CLI, Firebase CLI or
deploy operation in that state risks severe cross-project contamination. The report closes at
`sre-reports/report-2026-06-22T03-52-30.md:23` noting the fix was deliberately **not** applied.

No `gcloud`, `firebase`, `gsutil` or deploy command was run for this review. All deploy-path
conclusions come from reading `cloudbuild.yaml`, `firebase.json`, `verify_predeploy.js` and the
Dockerfiles. Whether the misconfiguration still exists today is **UNDETERMINED** — I did not run
even the read-only `gcloud config get-value project`, because the finding below (Finding 2) makes
that question moot for the most serious risk it creates.

`.agent/SPACE_INSTRUCTIONS.md:9-15` (Rule 1) and `.agent/SPACE_INSTRUCTIONS.md:17-23` (Rule 2)
confine this workspace to this repository and its stack. Nothing outside the repo was consulted.

---

## 1. Runtime architecture

### 1.1 Shape

A two-service monorepo plus a shared Firestore database.

```
                    browser
                       │
              ┌────────┴────────┐
              │   client-app    │  React 18 + Vite SPA, served by nginx in prod
              │  (Cloud Run)    │  client-app/src/main.jsx → App.jsx
              └────────┬────────┘
                       │  fetch(API_URL + '/api/...')
                       │  Authorization: Bearer <token>
                       │  x-demo-role: <role>
              ┌────────┴────────┐
              │    ad-server    │  Node 20 + Express 4 (ESM)
              │  (Cloud Run)    │  ad-server/index.js → src/api/index.js
              └────────┬────────┘
                       │  @google-cloud/firestore (Admin SDK)
              ┌────────┴────────┐
              │    Firestore    │  project hardcoded: softomedia-live-2026
              └─────────────────┘
```

- **ad-server entry point:** `ad-server/index.js`. Loads `.env.development` from the repo root
  (`ad-server/index.js:10`), validates env via `validateEnv()` (`ad-server/index.js:12`), configures
  CORS (`ad-server/index.js:49-74`), compression and a 10 MB JSON body limit
  (`ad-server/index.js:76-77`), security headers (`ad-server/index.js:81`), request logging
  (`ad-server/index.js:84`), then mounts the API router at `/api` (`ad-server/index.js:111`).
  It hard-exits if `JWT_SECRET` is absent (`ad-server/index.js:90-93`). VERIFIED.
- **client-app entry point:** `client-app/src/main.jsx`, routes in `client-app/src/App.jsx`.
  API base URL resolves at runtime from `window.ENV.VITE_API_URL`, falling back to the Vite build
  var and then `http://localhost:8080` (`client-app/src/config.js:6`). In the container,
  `window.ENV` is generated at boot by `client-app/entrypoint.sh:6-11`. VERIFIED.
- **`ads/`** is a directory of four static PNG creatives (`ads/bakery_fresh.png`,
  `ads/demo_ad_1.png`, `ads/demo_ad_coffee.png`, `ads/seasonal_sale.png`). They are duplicated
  inside `ad-server/assets/`, which is what the server actually serves via
  `ad-server/index.js:118` (`app.use('/assets', cacheControl(3600), express.static('assets'))`).
  The top-level `ads/` directory is not referenced by any server or client code. VERIFIED.

### 1.2 Request path

1. `ad-server/index.js:111` mounts `src/api/index.js` at `/api`.
2. `ad-server/src/api/index.js:33-46` mounts a **public** block of routers with no router-level
   `authenticate`: `/auth`, `/debug`, `/health`, `/assets`, `/playlist`, `/playlists`,
   `/telemetry`, `/stores`, `/pricing`, `/campaigns`, `/retailers`, `/advertisers`, `/screens`.
3. `ad-server/src/api/index.js:64-76` mounts a **protected** block, each with `authenticate`
   inline: `/loops`, `/monitoring`, `/dashboard`, `/locations`, `/notifications`, `/schedules`,
   `/users`, `/ops`, `/audit`, `/impressions`, `/invoices`, `/tickets`, `/analytics`.
4. Routers in the public block are expected to apply `authenticate` per-route. Most do for
   mutating routes; several do not at all (see Findings 4, 5, 6).
5. A separate AI router is mounted outside `/api` at `ad-server/index.js:115`
   (`app.use('/ghost-api', ghostRouter)`), with no auth middleware anywhere in
   `ad-server/routes/ghost-api.js` (routes at `:93`, `:271`, `:302`, `:322`, `:359`, `:402`,
   `:488`). VERIFIED.

### 1.3 Auth

There are three layered mechanisms and they do not agree with each other.

| Mechanism | Where | What it does |
|---|---|---|
| `authenticate` | `ad-server/src/middleware/auth.js:34-72` | Demo bypass, else `jwt.verify` |
| `requireRole(min)` | `ad-server/src/middleware/requireRole.js:22-51` | Numeric hierarchy floor |
| `authorize([roles])` | `ad-server/src/middleware/auth.js:78-96` | Allow-list, with a demo bypass |

- **Role hierarchy.** `ad-server/src/constants/roles.js:13-21` defines seven roles:
  superadmin 5, admin 4, contentmanager 3, techoperator 2, retaileradmin 1, brand 1, advertiser 0.
  `ad-server/src/middleware/requireRole.js:13-15` re-exports it; `client-app/src/constants/roles.js:13-21`
  is a byte-identical mirror. This matches `.agent/SPACE_INSTRUCTIONS.md:26-29` exactly. VERIFIED.
- **Unknown role → level −1.** `ad-server/src/middleware/requireRole.js:37` computes
  `ROLE_HIERARCHY[role] ?? -1`, so any role string outside the table is blocked from every guarded
  endpoint with a 403 that says only `Forbidden`. This is the failure mode
  `.agent/SPACE_INSTRUCTIONS.md:30-33` (Rule 3) exists to prevent. VERIFIED.
- **Missing `authenticate` → 500, not 403.** `ad-server/src/middleware/requireRole.js:28-33`
  returns HTTP 500 with `Misconfigured route: authentication middleware missing` when `req.user`
  is absent, which is a genuinely good guard and satisfies the diagnosis half of Rule 5
  (`.agent/SPACE_INSTRUCTIONS.md:46-51`). VERIFIED.
- **`normalizeRole` only handles superadmin.** `ad-server/src/constants/roles.js:24-28` collapses
  `super_admin` / `SUPER ADMIN` variants to `superadmin` and returns every other input unchanged.
  So `retailer`, `RetailerAdmin`, `Brand` etc. all pass through unnormalised to the −1 path.
  VERIFIED.
- **Demo bypass.** `ad-server/src/middleware/auth.js:39-56`: when demo is allowed and the header is
  exactly `Authorization: Bearer demo-token`, `req.user` is synthesised from the `x-demo-role`
  request header (defaulting to `admin` at `ad-server/src/middleware/auth.js:40`), with
  `linked_entity_id` resolved from `DEMO_LINKED_ENTITY_OVERRIDES`
  (`ad-server/src/middleware/auth.js:23-28`, `:46-48`). VERIFIED.
- **Real JWT.** `ad-server/src/middleware/auth.js:65` verifies against `JWT_SECRET`; issuance is
  `ad-server/src/services/AuthService.js:20-24`. VERIFIED.

### 1.4 Where state lives

- **Firestore** is the only durable store. `ad-server/src/utils/firestore.js:7-34` constructs a
  single `Firestore` client. `ad-server/src/repositories/BaseRepository.js:21-33` gives every
  collection a repository with a `CircuitBreaker`.
- **An in-process `MOCK_STORAGE` map** shadows every collection
  (`ad-server/src/repositories/BaseRepository.js:9`). Every successful write is mirrored into it
  (`:55`, `:126`, `:162`) and every read falls back to it on error (`:68`, `:96`).
- **The browser's `localStorage`** holds the entire client-side session: `auth_token`,
  `auth_user`, `active_persona`, `demo_role` (`client-app/src/contexts/AuthContext.jsx:31-33`,
  `:39-45`). The API client reads them back and stamps the outbound headers
  (`client-app/src/services/api.js:200-217`).
- **Firestore Security Rules** (`ad-server/firestore.rules`) are, in practice, not part of the
  runtime path — see Finding 9.

### 1.5 Repository map — where to look for what

| Area | Path |
|---|---|
| HTTP routes | `ad-server/src/api/*.js` (28 routers, mount table in `ad-server/src/api/index.js`) |
| Middleware | `ad-server/src/middleware/` — `auth.js`, `requireRole.js`, `error.js`, `rateLimiter.js`, `security.js`, `performance.js`, `validation.js` |
| Data access | `ad-server/src/repositories/` — all extend `BaseRepository.js` |
| Business logic | `ad-server/src/services/` — Loop generation, Playlist, Campaign, BusinessHours, Seed, Backup, Heartbeat |
| Resilience | `ad-server/src/utils/ResilienceUtility.js` (`withRetry`, `CircuitBreaker`) |
| AI (isolated) | `ad-server/routes/ghost-api.js`, `ad-server/services/ai-guardrails.js` |
| Client pages | `client-app/src/pages/{admin,advertiser,brand,retailer,tech,tickets}/` |
| Client API layer | `client-app/src/services/api.js` (interceptors), `ApiService.js`, `authAPI.js`, `screenAPI.js` |
| E2E | `tests/` (Playwright) |
| Unit | `ad-server/tests/` (Jest), `client-app/src/**/*.test.js*` (Vitest) |
| Rules tests | `tests/firestore-rules/rules.test.js` |

---

## 2. The test estate

### 2.1 The three suites and how they are wired

| Script | Definition | Runner | Root dir |
|---|---|---|---|
| `test:unit` | `package.json:16` | Jest 29 (ESM via `--experimental-vm-modules`) | `ad-server/` |
| `test:e2e` | `package.json:17` | Playwright | repo root |
| `test:e2e:ui` | `package.json:18` | Playwright `--ui` | repo root |
| `test:e2e:mock` | `package.json:19` | Playwright `--grep-invert @seed` | repo root |
| `test:e2e:seed` | `package.json:20` | Playwright `--grep @seed` | repo root |
| `pretest:e2e` | `package.json:21` | `scripts/test-preflight.js` | repo root |
| `test:rules` | `package.json:22` | `firebase emulators:exec --project softomedia-demo` + Jest | repo root |
| `lint` | `package.json:23` | `scripts/lint-tests.js` then ESLint in both sub-packages | repo root |

`package.json:15` defines `test` as `test:unit && test:e2e`. There is a fourth suite nobody wires
into the root scripts: Vitest, declared at `client-app/package.json:11` (`"test": "vitest run"`),
covering exactly three files — `client-app/src/components/GlassCard.test.jsx`,
`client-app/src/hooks/useAsyncAction.test.js`, `client-app/src/services/api.test.js`. VERIFIED.

**There is no CI.** `.github/` contains a single file, `.github/tags/sprint1to4.md`. There is no
`.github/workflows/` directory, so no suite runs automatically on push or PR. VERIFIED.

### 2.2 Jest — what is actually covered

Twelve suites run. `ad-server/jest.config.js:18` sets `testMatch: ['**/tests/**/*.test.js']`.

| Suite | Covers |
|---|---|
| `ad-server/tests/BusinessHours.test.js` | `BusinessHoursService` defaults, special-hours override, open<close validation, closed state |
| `ad-server/tests/content-compliance.test.js` | `/api/assets/upload` file-type filter and the 5-second video duration rule |
| `ad-server/tests/ghost-api.test.js` | `/ghost-api` analyze + tickets CRUD + rating — 12 cases, the single best-covered module |
| `ad-server/tests/health.test.js` | `/api/health/v2` healthy and breaker-open (degraded) responses |
| `ad-server/tests/loop.test.js` | `LoopRepository` — 12-slot creation, hour validation, find/approve/reject/replace |
| `ad-server/tests/mvp-roles-functionality.test.js` | Role smoke across 5 personas |
| `ad-server/tests/PricingRepository.test.js` | Config get/update, CPM tier calculation, date overrides, snake/camel parity |
| `ad-server/tests/rbac-creation.test.js` | POST-only RBAC on `/users`, `/retailers`, `/screens`, `/campaigns`, `/schedules` |
| `ad-server/tests/resilience.test.js` | `withRetry` and `CircuitBreaker` trip/block |
| `ad-server/tests/scheduler-campaign-flow.test.js` | `GET /api/retailers?for=campaign` filtering |
| `ad-server/tests/schedules.test.js` | `GET /api/schedules/preview` validation and open/closed store |
| `ad-server/tests/soft-delete-lifecycle.test.js` | Soft-delete on retailers + advertisers, resurrection guard |

Three files in `ad-server/tests/` are **never executed** because their names do not match
`testMatch`: `ad-server/tests/pricing_billing.spec.js` (a `.spec.js`),
`ad-server/tests/verify_performance.js` and `ad-server/tests/verify-special-hours-persistence.js`
(no `.test.` segment). ESLint still lints them, which is how they stay superficially alive —
see §2.8. VERIFIED.

#### Observed run

```
$ npm run test:unit
Test Suites: 2 failed, 10 passed, 12 total
Tests:       10 failed, 82 passed, 92 total
Time:        59.216 s
All files                      |   35.17 |    27.72 |   33.42 |    35.9
```

Failures: 3 in `ad-server/tests/rbac-creation.test.js`, 7 in
`ad-server/tests/mvp-roles-functionality.test.js`. Root cause is Finding 3 below. VERIFIED.

Coverage thresholds are set at `ad-server/jest.config.js:10-17` to branches 25 / functions 30 /
lines 35 / statements 35. The observed run passes all four by margins of 2.7, 3.4, 0.9 and 0.17
points. A single new uncovered route file will break the build on the statements gate. VERIFIED.

### 2.3 Playwright — what is actually covered

`playwright.config.js:28` sets `testDir: './tests'`; `playwright.config.js:29` excludes
`**/firestore-rules/**`. 33 spec files, ~250 declared tests.

**Root suite** (`tests/*.spec.js`) — 15 files covering the player, loops, playlists, telemetry
and personas. **Demo-wizard suite** (`tests/demo_wizard/01..17_*.spec.js`) — 17 files walking the
canonical 16-phase demo: admin provisioning, retailer scheduling, brand campaign wizard, player
broadcast, techops health, admin validation, retailer loops/approval/schedule-manager/history,
advertiser dashboard/campaigns/invoices, tickets, admin analytics, login, API surface smoke.

**13 tests are switched off** and will not report:

| Location | Mechanism |
|---|---|
| `tests/ad_player.spec.js:5` | `test.fixme` |
| `tests/demo_wizard/09_retailer_schedule_manager.spec.js:66` | `test.skip(true, 'Shift-slot control not found')` |
| `tests/demo_wizard/16_login_feature.spec.js:19` | `test.skip(true, 'Disabled in Demo Mode')` |
| `tests/integration_broadcasting.spec.js:108`, `:134` | `test.skip` |
| `tests/integration_gold_path.spec.js:33`, `:63` | `test.fixme` |
| `tests/loop_builder.spec.js:149` | `test.fixme` |
| `tests/loop_persistence.spec.js:81` | conditional `test.skip` |
| `tests/player_demo.spec.js:7` | `test.skip` |
| `tests/telemetry.spec.js:50`, `:101`, `:116` | `test.skip` / `test.fixme` |

VERIFIED. Notably `tests/demo_wizard/16_login_feature.spec.js:19` disables the *entire* login
feature suite, and `tests/telemetry.spec.js` has 3 of 5 tests disabled — telemetry emission is
effectively untested end-to-end.

### 2.4 `tests/firestore-rules/` and `test:rules`

`package.json:22` runs:

```
firebase emulators:exec --project softomedia-demo --only firestore "npx jest tests/firestore-rules/"
```

`tests/firestore-rules/rules.test.js:29-36` initialises `@firebase/rules-unit-testing` against
`projectId: 'softomedia-demo'`, loading rules from `ad-server/firestore.rules`
(`tests/firestore-rules/rules.test.js:32`). Contexts are built for admin, brand, retaileradmin,
advertiser and unauthenticated at `:49-62`, and the file asserts read/write per collection.

Three problems, all VERIFIED:

1. **The emulator host/port does not match `firebase.json`.**
   `tests/firestore-rules/rules.test.js:34` targets `port: 8080`. `firebase.json` declares the
   Firestore emulator on `port: 8090, host: 127.0.0.1`. Port 8080 is the ad-server's own dev port
   (`playwright.config.js:113`, `.env.example:18`). The rules tests therefore point at either
   nothing or at the ad-server, never at the emulator that `emulators:exec` starts.
2. **`firebase.json` is UTF-16LE with a BOM**, not UTF-8. `file firebase.json` reports
   `Unicode text, UTF-16, little-endian text, with CRLF line terminators`, and
   `JSON.parse(fs.readFileSync('firebase.json','utf8'))` fails with
   `Unexpected token '<BOM>', "<BOM>{  " ... is not valid JSON`. Whether the Firebase CLI tolerates
   this is **UNDETERMINED** — confirming it would require running `firebase`, which is out of
   scope here. If it does not, `test:rules` cannot start at all.
3. **The rules test asserts a field-naming convention the application does not use** — see
   Finding 9.

The file's own header comment at `tests/firestore-rules/rules.test.js:15` still shows a *different*
`test:rules` command from the one in `package.json:22` (no `--project`, single-quoted). Minor
staleness. CONTRADICTED.

### 2.5 The `@seed` tag

**The tag does not exist.** A repo-wide search for `@seed` returns matches only in
`package.json:19` and `package.json:20` — the two scripts that filter on it. No spec file, no
`test.describe` title, no annotation anywhere in `tests/` carries it. VERIFIED.

Consequences:

- `npm run test:e2e:mock` (`package.json:19`, `--grep-invert @seed`) **excludes nothing**. Its
  entire premise — "run the suite without the seeding tests" — does not hold.
- `npm run test:e2e:seed` (`package.json:20`, `--grep @seed`) **matches nothing** and runs zero
  tests.

What `test:e2e:mock` *does* change is `ALLOW_DEMO_MODE`. `package.json:17` and `package.json:20`
wrap Playwright in `cross-env ALLOW_DEMO_MODE=true`; `package.json:19` does not. Because
`playwright.config.js:83` gates the entire `demo-wizard` project behind
`process.env.ALLOW_DEMO_MODE === 'true'`, `test:e2e:mock` silently drops the `demo-wizard`
*project* — which is the real (accidental) mechanism behind the "mock" name. VERIFIED.

### 2.6 Project overlap — demo_wizard specs run twice under `test:e2e`

`playwright.config.js:64-68` declares a `chromium` project with **no `testMatch` and no
`testIgnore`**. `playwright.config.js:28` sets `testDir: './tests'`, which includes
`tests/demo_wizard/`. `playwright.config.js:83-99` then declares a second `demo-wizard` project
scoped to `**/demo_wizard/**/*.spec.js`.

Under `npm run test:e2e` (`ALLOW_DEMO_MODE=true`), every demo-wizard spec therefore executes
**twice**: once under `chromium` with `fullyParallel: true` and a 60 s timeout
(`playwright.config.js:32`, `:35`), and once under `demo-wizard` with `fullyParallel: false`,
`workers: 1` and a 90 s timeout (`playwright.config.js:86-88`). The `chromium` pass runs a
16-phase strictly-serial demo flow under the wrong isolation and timeout settings.

The root `workers: 1` at `playwright.config.js:44` limits the damage (no two files run
concurrently), but the duplication is real and the `chromium` copies will behave differently from
the `demo-wizard` copies. VERIFIED.

### 2.7 `scripts/test-preflight.js`

`package.json:21` registers it as `pretest:e2e`. It loads `.env.development`
(`scripts/test-preflight.js:1`), then does exactly one thing: `GET http://localhost:<PORT>/health`
and `process.exit(1)` if it is not 200 (`scripts/test-preflight.js:22-31`).

Issues, all VERIFIED:

- **It fires only for `test:e2e`.** npm runs `pre<script>` for the exact script name.
  `test:e2e:mock`, `test:e2e:seed`, `test:e2e:ui` and `test:e2e:headed` have no `pre` hooks
  defined, so three of the five E2E entry points skip preflight entirely.
- **It fights `webServer`.** `playwright.config.js:109-128` declares Playwright's own `webServer`
  entries that start `ad-server` and `client-app`. But the preflight runs *before* Playwright,
  demanding the backend already be up. On CI (`reuseExistingServer: !process.env.CI` at
  `playwright.config.js:114`) Playwright would start a fresh server — except preflight has already
  exited 1. **`npm run test:e2e` cannot succeed from a cold start.** This is masked today only
  because there is no CI (§2.1).
- **It does not check the client.** No probe of port 5173 despite `baseURL` pointing there
  (`playwright.config.js:49`). It does not check the Firestore emulator either.

### 2.8 `scripts/lint-tests.js`

An AST-based fixture guardrail with two rules:

- **Rule 2** (`scripts/lint-tests.js:9`, `:38-44`): rejects
  `localStorage.setItem('demo_role'|'active_persona', ...)` in specs, steering authors to
  `loginAs()` / `authReset()`.
- **Rule 1** (`scripts/lint-tests.js:53-82`): rejects `page.route(...)` calls containing an inline
  `JSON.stringify`, steering authors to `tests/fixtures/factories.js`.

Gaps, all VERIFIED:

- **Only `.spec.js` is linted** (`scripts/lint-tests.js:24`). `tests/global.setup.js`,
  `tests/demo_wizard/00_seed.setup.js`, `tests/demo_wizard/00_seed.teardown.js`,
  `tests/base.fixtures.js` and every `*_locators.js` file are invisible to it. The seed setup is
  the single highest-leverage file in the suite and it is unlinted.
- **`fixtures/` and `mocks/` directories are skipped** (`scripts/lint-tests.js:21`).
- **A parse failure is a warning, not an error** (`scripts/lint-tests.js:83-85`): a spec that the
  Babel parser cannot read prints `⚠️ [Parser Error]` and is treated as clean. `errorsFound` is
  never incremented on that path.

### 2.9 `ALLOW_DEMO_MODE=true`

**What it switches on.** `ad-server/src/middleware/auth.js:38`:

```js
const isDemoAllowed = process.env.ALLOW_DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production';
```

When true, three things become live:

1. `ad-server/src/middleware/auth.js:39-56` — `Authorization: Bearer demo-token` mints a `req.user`
   with whatever role the caller puts in the `x-demo-role` header.
2. `ad-server/src/middleware/auth.js:81-84` — `authorize()` returns `next()` unconditionally for
   any `req.user.email` starting with `demo-`, bypassing its allow-list. The demo user's email is
   always `demo-${role}@example.com` (`ad-server/src/middleware/auth.js:52`), so `authorize()` is a
   no-op for every demo caller.
3. `ad-server/src/api/campaigns.js:138-141` — a demo short-circuit in `POST /api/campaigns`.

Separately, `ad-server/src/api/debug.js:59-62` reuses the same expression to gate
`POST /api/debug/reset`.

**Where it is set.** `.env.example:25` (local), `playwright.config.js:117` and
`playwright.config.js:126` (both Playwright web servers), `package.json:17` and `package.json:20`
(the e2e scripts), and `cloudbuild.yaml:97` (Cloud Run).

**Does anything stop it reaching production? No.** See Finding 2 — this is the single most
serious result of this review.

### 2.10 Where the coverage holes are

Server-side coverage from the observed run, worst first. These are the modules a testing plan
should target.

**Zero coverage (0–15 % statements):**

| Module | Stmts | What is untested |
|---|---|---|
| `ad-server/src/services/SeedService.js` | 0 % | The entire seed path (lines 32-157 uncovered) |
| `ad-server/src/services/PlaylistService.js` | 4.9 % | Playlist resolution, global fallback, assignment priority (17-207) |
| `ad-server/src/services/LoopGenerationService.js` | 4.7 % | D-1 loop generation — the core scheduling engine (36-208) |
| `ad-server/src/api/impressions.js` | 5.9 % | Every branch of role-scoped impression querying (30-109) |
| `ad-server/src/services/HeartbeatService.js` | 5 % | Screen liveness (11-44) |
| `ad-server/src/services/CampaignService.js` | 6.7 % | Campaign status transitions (12-43) |
| `ad-server/src/services/AuthService.js` | 7.7 % | JWT issuance and verification (14-43) |
| `ad-server/src/services/BackupService.js` | 7.7 % | `POST /api/ops/backup` (12-35) |
| `ad-server/src/api/analytics.js` | 7.7 % | `GET /api/analytics/loops` (9-52) |
| `ad-server/src/api/debug.js` | 10.3 % | The destructive reset endpoint (28-53, 59-85) |
| `ad-server/src/api/locations.js` | 12 % | All five routes (10-14, 19-25, 30-34, 43-57, 62-92) |
| `ad-server/src/api/monitoring.js` | 12.5 % | Heartbeat, impression, status (13-21, 30-56, 65-83) |
| `ad-server/src/api/pricing.js` | 14.5 % | Every pricing route (16-24, 40-45, 55-67, 78-83, 91-102, 111-119, 129-141) |
| `ad-server/src/api/notifications.js` | 14.9 % | All four routes (47, 56-72, 81-95, 105-118, 132-148) |
| `ad-server/src/api/loops.js` | 15.7 % | Approve, reject-slot, replace-slot, generate (45-92, 108-113, 124-135, 148-157, 177-207, 240-251, 266-279, 290-305, 319-335) |
| `ad-server/src/api/campaigns.js` | 15.7 % | The whole T1/T5 ownership-stamping block, `/book`, `/status`, PUT, DELETE (142-174, 194-207, 226, 242-315, 332-365, 376-385, 396-400) |
| `ad-server/src/api/telemetry.js` | 17.6 % | Impression ingest and rate limiting (19-37, 51-55, 80-129, 137-149) |
| `ad-server/src/api/stores.js` | 21 % | Weekly hours, special hours, all CRUD bodies |
| `ad-server/src/middleware/rateLimiter.js` | 21.7 % | The limiter body itself (28-67) |
| `ad-server/src/api/users.js` | 23.3 % | PUT, PATCH, DELETE bodies (91-143, 152-185, 194-204) |
| `ad-server/src/api/invoices.js` | 24.2 % | Generation and PDF (29-74, 117-134, 145-165) |
| `ad-server/src/api/tickets.js` | 25 % | Both routes (7-16, 21-32) |
| `ad-server/src/api/ops.js` | 25 % | `POST /backup` (10-20) |
| `ad-server/src/api/dashboard.js` | 25 % | `GET /stats` (11-23) |
| `ad-server/src/api/playlist.js` | 28.6 % | The **player-facing** endpoint (11-16) |
| `ad-server/src/repositories/ScreenRepository.js` | 8.7 % | Nearly all of it (14-88) |
| `ad-server/src/repositories/PlaylistRepository.js` | 22.2 % | 18-41 |
| `ad-server/src/repositories/BusinessHoursRepository.js` | 20 % | 17-50 |
| `ad-server/src/repositories/StoreRepository.js` | 25 % | 15-39 |
| `ad-server/src/repositories/SpecialHoursRepository.js` | 28.6 % | 18-49 |
| `ad-server/src/repositories/UserRepository.js` | 26 % | 14-27, 56-73 |

**Modules with no test file at all** (no `ad-server/tests/*.test.js` names them):
`ad-server/src/middleware/error.js`, `ad-server/src/middleware/security.js`,
`ad-server/src/middleware/performance.js`, `ad-server/src/middleware/validation.js`,
`ad-server/src/utils/cron.js`, `ad-server/src/utils/storage.js`,
`ad-server/src/config/env.js`, `ad-server/src/schemas/PricingSchema.js`,
`ad-server/src/services/LoopGenerator.js`, `ad-server/src/services/BusinessHoursService.js`
(covered only incidentally via `BusinessHours.test.js`). VERIFIED.

**Dead code that no test could catch:**

- `ad-server/src/api/ads.js` is **not mounted anywhere**. No `import` of it exists in
  `ad-server/src/api/index.js` or `ad-server/index.js`. `GET /api/ads` is a 404. VERIFIED.
- `ad-server/routes/geminiRoutes.js` is likewise not mounted. VERIFIED.
- `ad-server/src/middleware/validation.js` is imported by nothing. VERIFIED.
- `ad-server/src/utils/firestore.js:36` exports `isMockMode()`; nothing calls it. VERIFIED.
- `bcryptjs` is declared at `ad-server/package.json:20` and imported nowhere in `ad-server/src`.
  There is no password hashing, comparison or storage anywhere in the server. VERIFIED.

**Failure modes with no test anywhere:**

| Failure mode | Guard location | Test? |
|---|---|---|
| Demo mode active in production | none (Finding 2) | no |
| `CIRCUIT_BREAKER_OPEN` → 503 on non-screens routes | none (Finding 8) | no |
| Firestore mock-mode fallback in production | none (Finding 7) | no |
| Unauthenticated `POST /api/debug/reset` | `ad-server/src/api/debug.js:59` only | no |
| Unauthenticated `POST /api/assets/upload` | none | no |
| Unauthenticated `/api/playlists` CRUD | none | no |
| `req.user.linkedentityid` typo | none (Finding 10) | no |
| `PUT /api/campaigns/:id` state-machine bypass | none (Finding 6) | no |
| `/ghost-api/*` unauthenticated | none | partial (`ghost-api.test.js` tests behaviour, not auth) |
| Role string outside `ROLE_HIERARCHY` | `requireRole.js:37` | no |
| CORS origin rejection | `ad-server/index.js:60-65` | no |
| Rate limiting on `/api/telemetry/impression` | `ad-server/src/api/telemetry.js:79` | no |
| Nightly cron loop generation | `ad-server/src/utils/cron.js:13` | no |

**Structural blind spot in the unit suite.** Most Jest suites build an app with
`createTestApp(router, path)` (`ad-server/tests/fixtures/test-app.js:34-53`), mounting a *single*
router directly. They therefore never see `ad-server/src/api/index.js`'s mount table, which is
where the missing `authenticate` calls live. Only `ad-server/tests/rbac-creation.test.js:10` and
`:26` import the real `src/api/index.js` — and only for POST routes. **No test exercises any GET,
PUT, PATCH or DELETE through the real mount table.** VERIFIED. This is why Findings 4, 5 and 6 are
invisible to a green suite.

**Weak assertions that cannot fail.** `tests/demo_wizard/17_api_surface_smoke.spec.js:9` states
its purpose as "Prove each router is mounted". Its assertions are
`expect(res.status()).not.toBe(500)` and `.not.toBe(0)`
(`tests/demo_wizard/17_api_surface_smoke.spec.js:56-57`). A 404 from the unmounted `/api/ads`
router passes both. K.1 is a permanently-green test for a route that does not exist. The same
pattern appears in Jest at `ad-server/tests/rbac-creation.test.js:53`
(`expect([201, 400]).toContain(res.status)`). VERIFIED.

---

## 3. The deploy path

### 3.1 What a deploy does

Trigger, per `docs/Deployment_Guide.md:38`: `gcloud builds submit --config cloudbuild.yaml
--project=softomedia-live-2026 .` ASSERTED (not executed).

`cloudbuild.yaml` runs eight steps:

| Step | id | Action |
|---|---|---|
| 0 | `verify-predeploy` (`:6-23`) | `node verify_predeploy.js`, then `gcloud secrets describe` for `JWT_SECRET` and `GEMINI_API_KEY` |
| 1-2 | `build/push-client-image` (`:26-45`) | Docker build `client-app/Dockerfile`, push to Artifact Registry |
| 3-4 | `build/push-adserver-image` (`:48-65`) | Docker build `ad-server/Dockerfile`, push |
| 5 | `deploy-adserver` (`:68-117`) | `gcloud run deploy` with env vars + secrets, then poll `/health` 30× at 2 s |
| 6 | `deploy-indexes` (`:120-135`) | Parse `ad-server/firestore.indexes.json` with python3, create each composite index; `allowFailure: true` |
| 7 | `deploy-firestore-rules` (`:138-150`) | `npm install -g firebase-tools`, `firebase deploy --only firestore:rules`; `allowFailure: true` |
| 8 | `deploy-client` (`:153-187`) | `gcloud run deploy` client with the ad-server URL, then re-lock `CORS_ORIGINS` on the ad-server |

VERIFIED by reading. Steps 6 and 7 both carry `allowFailure: true` (`cloudbuild.yaml:134`,
`cloudbuild.yaml:149`) and step 7 additionally pipes stderr to `/dev/null` with a
`|| echo "⚠️ Firestore rules deploy skipped (non-critical)"` fallback
(`cloudbuild.yaml:147`) — **a rules-deploy failure is silent and non-fatal**.

### 3.2 What it checks first

`verify_predeploy.js` checks four things and nothing else:

1. `docs/LESSONS_LEARNED.md` and `docs/CHANGELOG.md` exist (`verify_predeploy.js:7-14`).
2. `ad-server/package.json` and `client-app/package.json` exist (`verify_predeploy.js:18-24`).
3. `.env.example` exists (`verify_predeploy.js:28-31`).
4. If not in CI, warn when no local `.env` file is present (`verify_predeploy.js:34-45`).

**CONTRADICTED.** `docs/Deployment_Guide.md:23-28` claims this script checks:
"Client build exists (`client-app/dist/`)", "Ad-server entry point exists", "No hardcoded localhost
without env fallback", "ESLint config in place", "Dockerfiles present". It checks **none** of
these. It runs no test, no lint, no build. The pre-deploy gate is a documentation-permanence check
wearing the costume of a quality gate.

Note also that `verify_predeploy.js:34` treats the presence of `PROJECT_ID` as evidence of CI —
`const isCI = process.env.BUILD_ID || process.env.CI || process.env.PROJECT_ID`. Any developer
with `PROJECT_ID` exported locally silently skips check 4.

### 3.3 Secrets, credentials and env vars

| Name | Consumed at | Supplied from | Notes |
|---|---|---|---|
| `JWT_SECRET` | `ad-server/index.js:87`, `ad-server/src/middleware/auth.js:5`, `ad-server/src/services/AuthService.js:22` | Secret Manager → `cloudbuild.yaml:98`; local `.env.development` per `.env.example:9` | Server exits 1 if unset (`ad-server/index.js:90-93`). Existence verified in Secret Manager at `cloudbuild.yaml:15-20` |
| `GEMINI_API_KEY` | `ad-server/routes/ghost-api.js`, `ad-server/services/ai-guardrails.js` | Secret Manager → `cloudbuild.yaml:98`; `.env.example:31` | Existence verified at `cloudbuild.yaml:15-20` |
| `NODE_ENV` | throughout | `cloudbuild.yaml:97` (ad-server), `cloudbuild.yaml:168` (client) | Set to `production` in both |
| `ALLOW_DEMO_MODE` | `ad-server/src/middleware/auth.js:38`, `:81`; `ad-server/src/api/debug.js:59`; `ad-server/src/api/campaigns.js:139` | `cloudbuild.yaml:97` from substitution `_ALLOW_DEMO_MODE`, **default `'true'`** (`cloudbuild.yaml:194`) | See Finding 2 |
| `CORS_ORIGINS` | `ad-server/index.js:40` | Computed at deploy time (`cloudbuild.yaml:78-88`), re-locked at `cloudbuild.yaml:182-184` | Falls back to `"*"` when the client URL lookup fails (`cloudbuild.yaml:82-83`) |
| `VITE_API_URL` | `client-app/src/config.js:6` via `window.ENV` | `cloudbuild.yaml:168` → `client-app/entrypoint.sh:8` | Build-arg pathway at `cloudbuild.yaml:30` is fed the empty substitution `_VITE_API_URL: ''` (`cloudbuild.yaml:195`) |
| `BUILD_ID` | `cloudbuild.yaml:97`, `:168`; `client-app/entrypoint.sh:9` | Cloud Build built-in | Labels and runtime config |
| `PORT` | `ad-server/index.js:86` | Cloud Run injects; `.env.example:18` locally | Default 8080 |
| `GOOGLE_APPLICATION_CREDENTIALS` | `ad-server/src/utils/firestore.js:21-23` | Absent on Cloud Run (Workload Identity) | Conditionally assigned — correctly implements Rule 10 |
| `PROJECT_ID` | `cloudbuild.yaml` throughout | Cloud Build built-in | **Not** read by application code — see Finding 12 |

### 3.4 What a human must do by hand

ASSERTED from `docs/Deployment_Guide.md:59-67` and `README.md:16-24`: create the Artifact Registry
repository, install the gcloud SDK and Firebase CLI, populate `JWT_SECRET` and `GEMINI_API_KEY` in
Secret Manager, and grant IAM (see `docs/DEVELOPER_ONBOARDING_IAM.md`). None of this was executed
or verified.

VERIFIED from code: a human must also flip `_ALLOW_DEMO_MODE` to `'false'` on the production
trigger. `cloudbuild.yaml:194` carries the comment `# Set to 'false' in production Cloud Build
triggers` — i.e. the safe value is a manual, per-trigger, out-of-repo action, and the in-repo
default is the unsafe one. Whether the live production trigger overrides it is **UNDETERMINED**
without a `gcloud` call.

### 3.5 Firestore index divergence

Two index manifests exist and they do not match:

- `firestore.indexes.json` (root) declares 6 indexes: `invoices` × 2, `loops` × 3, `retailers` × 1.
- `ad-server/firestore.indexes.json` declares 2: `ads` × 1, `campaigns` × 1.

`firebase.json` points `firestore.indexes` at the **root** file. `cloudbuild.yaml:131` reads the
**ad-server** file. So the deploy pipeline creates only the `ads` and `campaigns` indexes, and
never creates the `invoices (advertiserId, generatedAt)`, `loops (retailer_id, status, date)` or
`retailers (deleted_at, status)` indexes that the root file's own comment says are required.
VERIFIED.

The root file's comment block is stale in a way that proves the divergence: `firestore.indexes.json`
states *"Pre-check B: firebase.json is absent from this repo"* — `firebase.json` is present.
CONTRADICTED.

The root file also documents at `firestore.indexes.json` (comment block) that
`retailers (deleted_at, status)` is *"required by GET /api/retailers?for=campaign (S21-4). Without
this index, Firestore throws FAILED_PRECONDITION under load (RISK-S22-2)."* That index is not in
the manifest cloudbuild reads. This is a documented, named production risk with a deploy path that
cannot mitigate it.

---

## 4. Known failure modes — SPACE_INSTRUCTIONS rules mapped to code

`.agent/SPACE_INSTRUCTIONS.md` is a bug list written by the people who hit the bugs. Below, each
rule is checked against the code as it stands today.

| Rule | Guard exists? | Where | Tested? |
|---|---|---|---|
| 3 — Role hierarchy | Partly | `ad-server/src/constants/roles.js:13-21`, `requireRole.js:37` | Indirectly, `rbac-creation.test.js` |
| 4 — Demo auth field parity | **No** | `ad-server/src/middleware/auth.js:50-55` | **No** |
| 5 — `authenticate` + `requireRole` pairing | Yes (diagnostic) | `ad-server/src/middleware/requireRole.js:28-33` | **No** |
| 6 — Route ordering | Yes, observed | `ad-server/src/api/loops.js:107` before `:123` | **No** |
| 7 — No client-supplied identity | Partly | `ad-server/src/api/campaigns.js:219-221` | **No** |
| 8 — No hardcoded seed IDs | **No** | `ad-server/src/api/campaigns.js:142-155` | n/a |
| 9 — Mock mode production-blocked | **No** | absent from `firestore.js` and `BaseRepository.js` | **No** |
| 10 — Never pass `undefined` to SDK | **Yes** | `ad-server/src/utils/firestore.js:21-23` | **No** |
| 12 — `globalTeardown` wrapper | **Yes** | `tests/demo_wizard/00_seed.teardown.js:15` | n/a |
| 13 — Circuit breaker 503 | **Only in one file** | `ad-server/src/api/screens.js:13-24` | Partly, `health.test.js:36` |
| 14 — CRUD completeness + `data-testid` | Partly | see below | Partly |
| 16 — LESSONS_LEARNED current | Yes | `docs/LESSONS_LEARNED.md` (803 lines, newest first) | n/a |

### Rule 3 — role hierarchy and silent 403s

**Guard exists**, at `ad-server/src/middleware/requireRole.js:37`
(`ROLE_HIERARCHY[role] ?? -1`), and the hierarchy at `ad-server/src/constants/roles.js:13-21`
matches `.agent/SPACE_INSTRUCTIONS.md:26-29` exactly, in both server and client mirrors.

**But a role string outside the hierarchy is live in the codebase today.**
`tests/demo_wizard/00_seed.setup.js:28` defines `export const DEMO_RETAILER = 'retailer'`, and
`tests/demo_wizard/00_seed.setup.js:131` seeds a user with `{ role: DEMO_RETAILER, linked_entity_id:
DEMO_RETAILER_ID }`. `'retailer'` is **not** a key in `ROLE_HIERARCHY`
(`ad-server/src/constants/roles.js:13-21`), and `normalizeRole` does not map it
(`ad-server/src/constants/roles.js:24-28`). Any request carrying `x-demo-role: retailer` resolves
to level −1 and is silently 403'd from every `requireRole`-guarded endpoint. This is Rule 3's
exact failure mode, reproduced in the seed data that Rule 3's own key-docs list
(`.agent/SPACE_INSTRUCTIONS.md:140`) calls the single source of truth. VERIFIED.

`tests/fixtures/personas.js:67-74` uses the *correct* `'retaileradmin'` for the same persona. The
two seed files disagree, and `ad-server/src/middleware/auth.js:26-27` papers over it by keying
`DEMO_LINKED_ENTITY_OVERRIDES` on **both** `retailer` and `retaileradmin` — which fixes
`linked_entity_id` but does nothing for the hierarchy lookup. VERIFIED.

**Tested?** No. No test asserts that every role emitted by any fixture is a key in
`ROLE_HIERARCHY`. That single assertion would be the cheapest high-value test in the repo.

### Rule 4 — demo-auth field parity

Rule 4 (`.agent/SPACE_INSTRUCTIONS.md:35-44`) requires the demo `req.user` to be structurally
identical to a decoded JWT: every field any handler reads must be present in the mock.

The demo mock provides exactly four fields — `role`, `email`, `id`, `linked_entity_id`
(`ad-server/src/middleware/auth.js:50-55`). Enumerating every `req.user.*` read in the server:

| Field read | Count | In demo mock? |
|---|---|---|
| `req.user.linked_entity_id` | 6 | ✅ |
| `req.user.role` | 5 | ✅ |
| `req.user.id` | 2 | ✅ |
| `req.user.email` | 2 | ✅ |
| `req.user.uid` | 3 | ❌ |
| `req.user.retailer_id` | 2 | ❌ |
| `req.user.linkedentityid` | 2 | ❌ (and is not a field anywhere) |

**Three parity breaks, all VERIFIED:**

1. `ad-server/src/api/impressions.js:55` — `req.user.linkedentityid || req.user.retailer_id`.
   Neither field is ever set. Every retaileradmin querying impressions falls into the
   `if (!retailerId)` branch at `ad-server/src/api/impressions.js:56` and receives
   `403 Forbidden — retaileradmin account has no linked retailer_id`. The correct field,
   `linked_entity_id`, is right there in `req.user`.
2. `ad-server/src/api/screens.js:155` — the identical expression, in the retaileradmin branch of
   `GET /api/screens`. Same outcome: `403 Forbidden` at
   `ad-server/src/api/screens.js:72-77` for every retaileradmin listing their screens.
3. `ad-server/src/api/locations.js:78` — `const userId = req.user?.uid || null` in the bulk
   loop-approval handler. In demo mode `uid` is undefined, so `approved_by` is persisted as `null`
   for every bulk approval (`ad-server/src/api/locations.js:83`). The audit trail is silently empty.

The comments acknowledge the ambiguity without resolving it —
`ad-server/src/api/notifications.js:44` says "and `req.user.uid` for real JWTs", but
`ad-server/src/services/AuthService.js:20-24` signs `{ id, email, role, linked_entity_id }`. There
is no `uid` in a real JWT either. VERIFIED.

**Tested?** No. `ad-server/src/api/impressions.js` sits at 5.88 % statement coverage and
`ad-server/src/api/screens.js` at 38.58 %, with lines 147-151 and 162-175 uncovered.

### Rule 5 — middleware pairing

The diagnostic half is implemented well: `ad-server/src/middleware/requireRole.js:28-33` returns a
500 with an explicit message rather than a misleading 403.

`ad-server/src/api/locations.js:42` and `:61` use `requireRole('retaileradmin')` with **no inline
`authenticate`**. This works today only because the router is mounted behind `authenticate` at
`ad-server/src/api/index.js:67`. Every other router with role guards
(`campaigns.js:136`, `screens.js:80`, `stores.js:69`, `retailers.js:71`, `advertisers.js:53`,
`loops.js:107`) pairs them inline for defence-in-depth; `locations.js` is the outlier. If it were
ever moved into the public mount block, every call would 500. VERIFIED, no test.

### Rule 6 — Express route ordering

**No violation found.** The two cases Rule 6 names by name are both correctly ordered:

- `ad-server/src/api/loops.js:107` registers `GET /pending/:retailerId` **before**
  `GET /:id` at `ad-server/src/api/loops.js:123`. The file even documents the constraint at
  `ad-server/src/api/loops.js:20`.
- `ad-server/src/api/locations.js:61` registers `POST /:id/loops/approve-all`; it has a distinct
  segment depth from `DELETE /:id` at `:29`, so no shadowing is possible.

Other static-before-wildcard pairs also check out: `ad-server/src/api/screens.js:32`
(`POST /register`) before `:80` (`POST /`); `ad-server/src/api/invoices.js:28` (`POST /generate`)
before `:116` (`GET /:id`); `ad-server/src/api/notifications.js:131` (`PATCH /read-all`) versus
`:104` (`PATCH /:id/read`) — different depths, no conflict. VERIFIED.

One readability trap, not a bug: `ad-server/src/api/locations.js:38` places
`export default router;` **above** the route registrations at `:42` and `:61`. ES module bodies
evaluate fully before consumers use the binding, so the routes do register — but it reads as
though they will not, and a future refactor to CommonJS `module.exports` would break silently.

**Tested?** No test asserts route ordering or the resulting status codes. A 404 on a shadowed
static route would be indistinguishable from any other 404 in the current suite.

### Rule 7 — ownership fields spoofable from the request body

**The guard exists in one place and is correct there.** `ad-server/src/api/campaigns.js:219-221`:

```js
advertiser_id: isAdminTier
    ? req.body.advertiser_id
    : (req.user.linked_entity_id ?? null),
```

with `isAdminTier` computed at `ad-server/src/api/campaigns.js:181-182` and the admin-tier
not-null validation at `:185-189`. That is precisely what `.agent/SPACE_INSTRUCTIONS.md:61-67`
asks for, and it is the only route in the codebase that does it.

**But `PUT /api/campaigns/:id` bypasses it entirely.**
`ad-server/src/api/campaigns.js:375` is guarded by `authenticate` only — no `requireRole`, no
ownership check — and its body is `campaignRepository.update(id, req.body)`
(`ad-server/src/api/campaigns.js:382`). Any authenticated caller, including an `advertiser`
(level 0), can overwrite **any** campaign wholesale, setting `advertiser_id`, `retailer_id` and
`status` to anything. This also bypasses the `VALID_TRANSITIONS` state machine that
`ad-server/src/api/campaigns.js:23-30` and `:347-359` carefully enforce on
`PATCH /:id/status`. VERIFIED.

Similarly, `ad-server/src/api/playlists.js:53` (`PUT /:id`) passes `req.body` straight to
`update()` with no auth and no field filtering at all.

**Tested?** No. `ad-server/src/api/campaigns.js` lines 376-385 are listed as uncovered in the
observed coverage run.

### Rule 8 — no hardcoded seed IDs in application logic

**Violated, in the campaign creation handler.**
`ad-server/src/api/campaigns.js:142-155` embeds a fully-formed demo campaign literal in the
production route: `id: 'demo-campaign-001'`, `retailer_id: 'demo-retailer-freshmart'`,
`name: 'BonVie Summer Demo'`, `creative_url: 'https://cdn.softomedia.demo/bonvie-ad-1.mp4'`,
`budget: 5000`, `cpm: 12.5`, `impressions_delivered: 120000`.

Worse, the handler is destructive: on `ALREADY_EXISTS` it **deletes** the existing
`demo-campaign-001` and recreates it (`ad-server/src/api/campaigns.js:165-166`).

The gate is `process.env.ALLOW_DEMO_MODE === 'true' && req.user?.id === 'demo-brand'`
(`ad-server/src/api/campaigns.js:139-140`). Given Finding 2, that gate is open in production by
default. VERIFIED.

The header comment at `ad-server/src/api/campaigns.js:133` describes the guard as "maximally
narrow". It is narrow in *who* can trigger it; it is not narrow in *where* it runs.

Two lesser instances: `client-app/src/pages/Login.jsx:30` and
`client-app/src/contexts/AuthContext.jsx:54` both synthesise
`linked_entity_id: \`entity-${role}\`` in component logic. These are harmless today because the
server re-stamps from `DEMO_LINKED_ENTITY_OVERRIDES`, but they are exactly the string literals
Rule 8 forbids in application code.

### Rule 9 — Firestore mock mode silently swallowing writes in production

**The guard does not exist.** Rule 9 (`.agent/SPACE_INSTRUCTIONS.md:77-84`) requires that if
Firestore init fails under `NODE_ENV=production`, the process must throw and crash.

`ad-server/src/utils/firestore.js:29-33` does the opposite:

```js
} catch (error) {
    logger.error('Firestore initialization failed, switching to mock mode', { error: error.message });
    useMock = true;
    return null;
}
```

No `NODE_ENV` check. It returns `null`. `ad-server/src/repositories/BaseRepository.js:35-37` then
makes `this.collection` null, and `create()` at `:47-56` skips the Firestore write entirely and
writes only to `MOCK_STORAGE`, returning a **201-shaped success object** to the caller. Same for
`update()` (`:116-127`) and `upsert()` (`:150-163`).

`ad-server/src/utils/firestore.js:36` exports `isMockMode()` so a caller *could* detect the state.
Nothing calls it — not `ad-server/index.js`, not `ad-server/src/api/health.js`, not any
repository. The one signal that mock mode is active is a single `logger.error` line at container
start. VERIFIED.

This is precisely the incident Rule 9 was written from: a silently-broken Cloud Run instance that
accepts writes into memory which vanish on the next scale-to-zero.

**Partial mitigations that do exist and are worth crediting:**
- Rule 10 **is** correctly implemented — `ad-server/src/utils/firestore.js:21-23` conditionally
  assigns `keyFilename` rather than assigning `undefined`, with a comment explaining exactly why.
  This closes the most likely *cause* of init failure on Cloud Run.
- `ad-server/src/repositories/BaseRepository.js:47-56` and `:116-127` do **not** swallow write
  errors when `this.collection` is non-null — the breaker rejection propagates to the route. The
  comments at `:48-50` and `:118-120` are accurate. Divergence only happens when `db` is null
  from the start.
- But `findById` (`:65-67`), `findAll` (`:91-93`) and `delete` (`:135-141`) **do** swallow errors
  and fall back to `MOCK_STORAGE` with bare `catch (e) { /* Fallback to memory */ }`. A read that
  silently returns stale in-memory data during a Firestore outage is a data-correctness hazard the
  route cannot see.

**Tested?** No. There is no test that sets `NODE_ENV=production`, forces a Firestore init failure
and asserts a crash — nor one that asserts a write returns an error rather than a fake success.

### Rule 13 — circuit-breaker 503-vs-500 semantics

The error object is constructed correctly. `ad-server/src/utils/ResilienceUtility.js:65-69` sets
`err.code = 'CIRCUIT_BREAKER_OPEN'` and `err.retryAfterMs`. The threshold is 5, not 3, exactly as
`.agent/SPACE_INSTRUCTIONS.md:109` requires — set at
`ad-server/src/repositories/BaseRepository.js:26` with the explanatory comment, defaulted at
`ad-server/src/utils/ResilienceUtility.js:50`.

**The 503 mapping exists in exactly one file.**
`ad-server/src/api/screens.js:13-24` implements `handleCircuitBreakerError()`, correctly setting
`Retry-After` and returning 503 with a safe message. A repo-wide search for `CIRCUIT_BREAKER_OPEN`
finds it in only two places: where it is thrown
(`ad-server/src/utils/ResilienceUtility.js:67`) and where it is handled
(`ad-server/src/api/screens.js:14`).

Everywhere else, the error reaches either a local `catch` that does
`res.status(500).json({ error: error.message })` — e.g.
`ad-server/src/api/campaigns.js:227-228`, `ad-server/src/api/playlists.js:12-13`,
`ad-server/src/api/locations.js:13-14` — or the global handler at
`ad-server/src/middleware/error.js:23`, which reads `err.status || err.statusCode || 500`. The
breaker error carries `code`, not `status`, so it defaults to 500 with no `Retry-After` header.
VERIFIED.

The local `catch` blocks are additionally a Rule 13 violation on the second count: Rule 13 says
"Never surface raw internal error strings to the UI", and `error.message` for an open breaker is
`Circuit Breaker [Firestore:campaigns] is OPEN`. The global handler at
`ad-server/src/middleware/error.js:28` gets this right (`statusCode === 500 ? 'Internal Server
Error' : err.message`); the per-route handlers bypass it entirely.

**Tested?** Partially. `ad-server/tests/health.test.js:36` asserts `/api/health/v2` returns
degraded when the breaker is open, and `ad-server/tests/resilience.test.js:33-46` tests the breaker
mechanics. **No test asserts that any data route returns 503 with `Retry-After` when the breaker
opens.** `ad-server/src/api/screens.js` line 15-21 is listed as uncovered in the observed run —
the one correct implementation is itself untested.

### Rule 14 — CRUD completeness

`ad-server/src/api/tickets.js` exposes only `GET /:id` (`:6`) and `POST /:id/replies` (`:20`) —
there is no `GET /`, no `POST /`, no update, no delete, despite
`client-app/src/pages/tickets/TicketDashboard.jsx` being a list page and
`tests/demo_wizard/14_ticket_system.spec.js` asserting "14.3 — Admin creates a ticket; POST 201
returned". Ticket creation appears to route to `ad-server/routes/ghost-api.js:302`
(`POST /ghost-api/tickets`) instead — two ticket APIs on different mount points.
VERIFIED as a structural inconsistency; whether the UI works is **UNDETERMINED** without running it.

`data-testid` discipline is good in the components inspected — e.g.
`client-app/src/components/PersonaSwitcher.jsx:33` (`data-testid={`persona-${p.id}`}`).
`scripts/scan_locators.js` and `.agent/workflows/validate-testids.md` exist to enforce it.

---

## 5. Doc-vs-code disagreements found

Each of these is a finding in its own right, because a stale doc is how the next bug gets written.

| Doc claim | Reality |
|---|---|
| `.env.example:23` — *"auth.js blocks demo mode when NODE_ENV=production regardless of this flag"* | `ad-server/src/middleware/auth.js:38` uses `\|\|`, so `ALLOW_DEMO_MODE=true` **enables** demo mode in production. The comment states the exact inverse of the code. |
| `docs/Deployment_Guide.md:23-28` — five things `verify_predeploy.js` checks | It checks none of them (`verify_predeploy.js:6-45`). |
| `firestore.indexes.json` comment — *"firebase.json is absent from this repo"* | `firebase.json` exists at the repo root. |
| `ad-server/src/api/campaigns.js:37` — *"advertiser = 1, brand = 2, retaileradmin = 3, admin = 4, superadmin = 5"* | `ad-server/src/constants/roles.js:13-21` says advertiser 0, brand 1, retaileradmin 1, techoperator 2, contentmanager 3. The comment is wrong on four of five values. |
| `docs/TESTING.md:25` — `node tests/verify_observability.js` | That file lives at `archives/tests/verify_observability.js`; there is no `tests/verify_observability.js`. |
| `docs/TESTING.md:10` — `npx -y kill-port 8080 5174` | The client dev server is 5173 (`playwright.config.js:49`, `:121`); 5174 is only a CORS fallback origin (`ad-server/index.js:31`). |
| `docs/TESTING.md` overall | Mentions neither `test:rules`, `test:e2e:mock`, `@seed`, nor `ALLOW_DEMO_MODE` — i.e. it documents none of the actual test-suite structure. |
| `tests/firestore-rules/rules.test.js:15` — suggested `test:rules` command | Differs from the one actually in `package.json:22`. |
| `tests/demo_wizard/17_api_surface_smoke.spec.js:9` — *"Prove each router is mounted"* | Its assertions cannot detect an unmounted router (`:56-57`); `/api/ads` is unmounted and K.1 passes. |
| `ad-server/src/api/notifications.js:44` — *"`req.user.uid` for real JWTs"* | `ad-server/src/services/AuthService.js:20-24` signs `{ id, email, role, linked_entity_id }` — no `uid`. |
| `tests/demo_wizard/16_login_feature.spec.js:44`, `:67` — assert `POST /api/auth/login` returns 401/200 | `client-app/src/pages/Login.jsx:50-54` never calls the API; it calls `login()` locally. The whole file is skipped at `:19`, which is how this stays hidden. |

---

## 6. Prioritised candidate QA findings

Ordered by severity. Each is a candidate defect with the evidence behind it.

---

### P0-1 — Unauthenticated `POST /api/debug/reset` deletes 15 Firestore collections, and is enabled in production by default

**Evidence.** `ad-server/src/api/index.js:34` mounts `/debug` in the public block with no
`authenticate`. `ad-server/src/api/debug.js:57` declares `POST /reset` with no middleware. Its only
gate is `ad-server/src/api/debug.js:59`:
`process.env.ALLOW_DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production'`.
`cloudbuild.yaml:97` sets `ALLOW_DEMO_MODE=${_ALLOW_DEMO_MODE}` and `cloudbuild.yaml:194` defaults
that substitution to `'true'`.

The handler then iterates the 15 collections listed at `ad-server/src/api/debug.js:9-25` — `users`,
`ads`, `screens`, `retailers`, `advertisers`, `locations`, `impressions`, `playlists`, `campaigns`,
`media`, `scheduling_audits`, `loops`, `stores`, `pricing`, `invoices` — batch-deleting every
document (`ad-server/src/api/debug.js:27-55`, `:70-72`), clears `MOCK_STORAGE`
(`:76`) and reseeds (`:79`).

**Impact.** An unauthenticated HTTP POST wipes the production database.
**Test coverage.** None. `ad-server/src/api/debug.js` is at 10.25 % statement coverage, lines 28-53
and 59-85 uncovered.
**Status.** VERIFIED by reading. Not executed.

---

### P0-2 — `ALLOW_DEMO_MODE=true` reaches production and grants superadmin to any caller

**Evidence.** `ad-server/src/middleware/auth.js:38`:

```js
const isDemoAllowed = process.env.ALLOW_DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production';
```

The disjunction means `ALLOW_DEMO_MODE=true` wins over `NODE_ENV=production`.
`cloudbuild.yaml:97` sets **both** (`NODE_ENV=production` and `ALLOW_DEMO_MODE=${_ALLOW_DEMO_MODE}`),
and `cloudbuild.yaml:194` defaults `_ALLOW_DEMO_MODE: 'true'`.

With demo mode live, `ad-server/src/middleware/auth.js:39-56` accepts the literal string
`Bearer demo-token` and builds `req.user` from the caller-supplied `x-demo-role` header. Sending
`x-demo-role: superadmin` yields level 5 and passes every `requireRole` guard in the codebase.
`ad-server/src/middleware/auth.js:81-84` additionally makes `authorize()` a no-op for any user whose
email starts with `demo-`, which is every demo user (`ad-server/src/middleware/auth.js:52`).

`.env.example:21-25` documents the opposite behaviour — *"NEVER set this in production — auth.js
blocks demo mode when NODE_ENV=production regardless of this flag."* CONTRADICTED.

**Impact.** Full unauthenticated superadmin on the production API. Everything the `users`,
`campaigns`, `retailers`, `advertisers`, `screens`, `stores` and `pricing` routers protect is open.
**Test coverage.** None. No test sets `NODE_ENV=production` and asserts the demo token is rejected.
`ad-server/src/middleware/auth.js` is at 50 % statement coverage with lines 63-70 (the real JWT
path) and 81-94 (`authorize`) uncovered.
**Note.** Whether the live production Cloud Build trigger overrides `_ALLOW_DEMO_MODE` to `'false'`
is **UNDETERMINED** — establishing it requires a `gcloud` call, which is out of scope. The in-repo
default is unsafe either way, and `cloudbuild.yaml:194`'s own comment
(*"Set to 'false' in production Cloud Build triggers"*) confirms the safe value lives outside the
repo where no review can see it.

---

### P0-3 — Login is passwordless; any email string grants the matching role

**Evidence.** `client-app/src/pages/Login.jsx` has no password field. `resolveRole()` at
`client-app/src/pages/Login.jsx:40-48` maps an email by substring: contains `superadmin` →
`superadmin`, contains `admin` → `admin`, contains `retailer` → `retaileradmin`, contains `tech` →
`techoperator`, default `advertiser`. `doLogin()` at `:50-54` then calls
`login(makeMockUser(role), 'demo-token')` — no network request, no credential check.
`QUICK_LOGINS` at `:15-21` renders one-click buttons for all five roles including Super Admin.
`AuthContext.login()` (`client-app/src/contexts/AuthContext.jsx:30-36`) persists the token and role
to `localStorage`, and `client-app/src/services/api.js:200-217` stamps them onto every outbound
request as `Authorization: Bearer demo-token` and `x-demo-role: <role>`.

Server-side is no better: `ad-server/src/services/AuthService.js:13-27` issues a signed JWT for any
email found in the `users` collection, with **no password comparison**. `bcryptjs` is declared at
`ad-server/package.json:20` and imported nowhere; a repo-wide search for `password` in
`ad-server/src` and `ad-server/seed.js` returns nothing.

**Impact.** Combined with P0-2, typing `superadmin@x.com` into the deployed login page yields a
working superadmin session against the production API.
**Test coverage.** The one suite that would catch it —
`tests/demo_wizard/16_login_feature.spec.js` — is entirely skipped at `:19` with the reason
*"Disabled in Demo Mode (password input is bypassed in favor of Quick Access)"*, and its two
substantive tests (`:44`, `:67`) assert a `POST /api/auth/login` flow that the client does not
perform.
**Status.** VERIFIED by reading.

---

### P0-4 — `PersonaSwitcher` is rendered unconditionally in production builds

**Evidence.** `client-app/src/layouts/DashboardLayout.jsx:158` renders `<PersonaSwitcher />` with
no environment guard. `client-app/src/components/PersonaSwitcher.jsx:7-13` lists Super Admin,
Admin, Brand, Retailer and Tech Op. `handleSwitch()` at
`client-app/src/components/PersonaSwitcher.jsx:19-25` writes `demo_role` to `localStorage` and calls
`setPersona()`, and `client-app/src/contexts/AuthContext.jsx:43-45` sets `auth_token` to
`'demo-token'` when none exists — **with no `import.meta.env.DEV` guard**.

For contrast, `client-app/src/services/api.js:189-197` *is* correctly DEV-guarded, and its comment
block at `:180-188` explicitly documents the earlier version of this exact bug
(*"meaning any DEV page load silently gained super-admin API access"*). The fix was applied to
`api.js` and not to `AuthContext.jsx` or `DashboardLayout.jsx`.

**Impact.** One click in the production UI escalates any visitor to Super Admin.
**Test coverage.** `tests/personas.spec.js` tests persona switching *works*; nothing tests that it
is unavailable in a production build.
**Status.** VERIFIED by reading.

---

### P1-5 — The Jest "unit" suite writes to live Firestore

**Evidence.** Running `npm run test:unit` produced 10 failures, all with the same root cause:

```
error: Failed to create user: Could not load the default credentials.
  at GoogleAuth.getApplicationDefaultAsync (...)
  at UserRepository.create (.../src/repositories/BaseRepository.js:51:32)
  at .../src/api/users.js:77:50
info: Firestore initialized {"projectId":"softomedia-live-2026", ...}
```

`ad-server/tests/rbac-creation.test.js:10` imports the **real** `src/api/index.js`, which reaches
the real `BaseRepository` (`ad-server/src/repositories/BaseRepository.js:51`) and the real Firestore
client (`ad-server/src/utils/firestore.js:25`). The file imports `jest` at
`ad-server/tests/rbac-creation.test.js:1` and `mock-repos.js` at `:6`, but **never calls
`jest.unstable_mockModule`** — ESLint confirms it: `rbac-creation.test.js 1:10 warning 'jest' is
defined but never used`. The mock repositories at `ad-server/tests/fixtures/mock-repos.js` are
imported for side effects that do not exist.

**Impact.** On this machine the tests fail closed (no ADC). On any machine *with* working ADC, the
suite writes `Test Name` users, screens and campaigns into whatever project ADC resolves to. Given
`sre-reports/report-2026-06-22T03-52-30.md:9` records the local gcloud project as `thehammer`,
running `npm run test:unit` is a live cross-project write hazard — the exact contamination that
report warns about, reachable through a command that looks entirely safe.

Note also `ad-server/src/utils/firestore.js:11` hardcodes
`const projectId = 'softomedia-live-2026'`, so the SDK targets that project regardless of
environment, credentials permitting.

**Status.** VERIFIED — reproduced locally, output above.

---

### P1-6 — Nine routers accept unauthenticated writes

**Evidence.** `ad-server/src/api/index.js:33-46` mounts these without `authenticate`, and the
routers below do not add it per-route:

| Route | Declaration | Guard |
|---|---|---|
| `POST /api/playlists` | `ad-server/src/api/playlists.js:29` | none |
| `PUT /api/playlists/:id` | `ad-server/src/api/playlists.js:53` | none |
| `DELETE /api/playlists/:id` | `ad-server/src/api/playlists.js:63` | none |
| `GET /api/playlists` | `ad-server/src/api/playlists.js:8` | none |
| `POST /api/assets/upload` | `ad-server/src/api/assets.js:57` | none — writes to disk (`:15-23`) and to GCS (`:76`) |
| `GET /api/assets` | `ad-server/src/api/assets.js:44` | none |
| `POST /ghost-api/analyze` | `ad-server/routes/ghost-api.js:93` | none — invokes Gemini, a metered paid API |
| `GET /ghost-api/admin/logs` | `ad-server/routes/ghost-api.js:402` | none |
| `GET /ghost-api/admin/stats` | `ad-server/routes/ghost-api.js:488` | none |
| `POST /ghost-api/tickets` | `ad-server/routes/ghost-api.js:302` | none |
| `GET /api/campaigns` | `ad-server/src/api/campaigns.js:53` | none |
| `GET /api/campaigns/:id` | `ad-server/src/api/campaigns.js:88` | none |
| `GET /api/retailers`, `GET /api/retailers/:id` | `ad-server/src/api/retailers.js:27`, `:52` | none |
| `GET /api/advertisers`, `GET /api/advertisers/:id` | `ad-server/src/api/advertisers.js:15`, `:32` | none |
| `GET /api/stores` and its hours endpoints | `ad-server/src/api/stores.js:21`, `:43`, `:147`, `:165`, `:218` | none |
| `GET /api/pricing`, `GET /api/pricing/overrides/:date`, `GET /api/pricing/calculate` | `ad-server/src/api/pricing.js:15`, `:110`, `:128` | none |
| `POST /api/telemetry/error` | `ad-server/src/api/telemetry.js:136` | none |
| `GET /api/auth/me` | `ad-server/src/api/auth.js:29` | none — returns `req.user`, always `undefined` |

`POST /api/assets/upload` and `/ghost-api/analyze` are the sharpest: an anonymous file-upload sink
and an anonymous LLM-billing sink.

**Impact.** Unauthenticated read of the entire commercial dataset (campaigns, advertisers,
retailers, stores, pricing) and unauthenticated write to playlists, assets and AI tickets.
**Test coverage.** None. No test exercises any GET/PUT/DELETE through the real mount table (§2.10).
**Status.** VERIFIED by reading.

---

### P1-7 — `GET /api/campaigns` advertiser scoping is dead code

**Evidence.** `ad-server/src/api/campaigns.js:59` scopes results when
`req.user?.role === ROLES.ADVERTISER`, and `ad-server/src/api/campaigns.js:96-101` returns 403 when
an advertiser requests a campaign they do not own. Both were introduced as "Sprint 14 — S14-2"
per the comments at `:45` and `:85`.

Neither can ever fire. `ad-server/src/api/index.js:43` mounts `/campaigns` with **no
`authenticate`**, and neither route adds it (`ad-server/src/api/campaigns.js:53`, `:88`). `req.user`
is therefore always `undefined`, the optional chaining at `:59` and `:97` short-circuits, and every
caller — authenticated or not — falls through to the unscoped `findAll()` at `:72`.

The comment at `ad-server/src/api/campaigns.js:50-51` even acknowledges this
(*"req.user may be undefined for unauthenticated callers"*) without recognising that it makes the
guard unreachable.

**Impact.** A named, documented, sprint-tracked tenancy control that does nothing. Every advertiser
sees every other advertiser's campaigns; so does the public.
**Test coverage.** None — `ad-server/src/api/campaigns.js` lines 54-77 and 89-105 are uncovered.
**Status.** VERIFIED by reading.

---

### P1-8 — `PUT /api/campaigns/:id` bypasses ownership and the status state machine

**Evidence.** `ad-server/src/api/campaigns.js:375` — `authenticate` only. Body:
`campaignRepository.update(id, req.body)` (`ad-server/src/api/campaigns.js:382`) with no field
filter. An `advertiser` (level 0) can set `advertiser_id`, `retailer_id` and `status` on any
campaign, sidestepping both the Rule 7 stamping at `:219-221` and the `VALID_TRANSITIONS` machine
at `:23-30` / `:347-359`.

**Impact.** Ownership spoofing and arbitrary state transitions (e.g. `rejected` → `live`).
**Test coverage.** None — lines 376-385 uncovered.
**Status.** VERIFIED by reading.

---

### P2-9 — `CIRCUIT_BREAKER_OPEN` returns 500 everywhere except `/api/screens`

**Evidence.** Thrown at `ad-server/src/utils/ResilienceUtility.js:65-69` with `code` (not `status`).
Handled at `ad-server/src/api/screens.js:13-24` — the only handler in the codebase. Elsewhere it
hits per-route `catch` blocks that emit `res.status(500).json({ error: error.message })`
(`ad-server/src/api/campaigns.js:227-228`, `ad-server/src/api/playlists.js:12-13`,
`ad-server/src/api/locations.js:13-14`, and ~25 more) or the global handler at
`ad-server/src/middleware/error.js:23`, which finds no `status` and defaults to 500.

Rule 13 (`.agent/SPACE_INSTRUCTIONS.md:105-110`) requires 503 with `Retry-After`. Those local
catches also leak the raw string `Circuit Breaker [Firestore:campaigns] is OPEN` to the UI, which
Rule 13 forbids in the same breath.

**Impact.** During a Firestore incident, clients see 500s with no back-off signal.
`client-app/src/services/api.js:13` sets `retryOn: [408, 429, 500, 502, 503, 504]` — so the client
retries the 500 immediately at `retryDelay: 1000`, hammering an already-open breaker.
**Test coverage.** None on any data route. `ad-server/tests/health.test.js:36` covers the health
endpoint only; `ad-server/src/api/screens.js:15-21` (the one correct implementation) is uncovered.
**Status.** VERIFIED by reading.

---

### P2-10 — Firestore mock-mode fallback has no production guard

**Evidence.** `ad-server/src/utils/firestore.js:29-33` catches init failure, sets `useMock = true`
and returns `null` with no `NODE_ENV` check. `ad-server/src/repositories/BaseRepository.js:35-37`
turns that into `this.collection === null`; `create()` (`:47-56`), `update()` (`:116-127`) and
`upsert()` (`:150-163`) then skip Firestore and return success from memory.
`ad-server/src/utils/firestore.js:36` exports `isMockMode()`; nothing calls it.

Rule 9 (`.agent/SPACE_INSTRUCTIONS.md:77-84`) requires a crash instead.

Compounding it, `findById` (`ad-server/src/repositories/BaseRepository.js:65-67`), `findAll`
(`:91-93`) and `delete` (`:135-141`) swallow Firestore errors with empty `catch` blocks and return
in-memory data — so during a partial outage the API serves stale reads with a 200.

**Impact.** Writes accepted, acknowledged, and lost on the next scale-to-zero, with no HTTP signal.
**Test coverage.** None.
**Mitigating.** Rule 10 *is* implemented (`ad-server/src/utils/firestore.js:21-23`), which removes
the most likely trigger on Cloud Run.
**Status.** VERIFIED by reading.

---

### P2-11 — `req.user.linkedentityid` typo 403s every retaileradmin on two endpoints

**Evidence.** `ad-server/src/api/impressions.js:55` and `ad-server/src/api/screens.js:155` both read
`req.user.linkedentityid || req.user.retailer_id`. Neither field exists: the demo mock provides
`linked_entity_id` (`ad-server/src/middleware/auth.js:54`) and real JWTs are signed with
`linked_entity_id` (`ad-server/src/services/AuthService.js:21`).

Result: `ad-server/src/api/impressions.js:56-61` returns
`403 Forbidden — retaileradmin account has no linked retailer_id` for every retaileradmin
impressions query, and `ad-server/src/api/screens.js:72-77` does the same for every retaileradmin
screen list.

**Impact.** The retaileradmin role cannot see its own screens or impressions — a broken core
journey presenting as an authorization error, which is exactly the diagnostic trap Rule 4 exists to
close.
**Test coverage.** None. `ad-server/src/api/impressions.js` is at 5.88 % coverage.
**Status.** VERIFIED by reading.

---

### P2-12 — `test:e2e:seed` runs zero tests; `test:e2e:mock` excludes nothing

**Evidence.** `@seed` appears nowhere in the repository except `package.json:19` and
`package.json:20`. `--grep @seed` (`package.json:20`) therefore matches no test, and
`--grep-invert @seed` (`package.json:19`) excludes no test. Two of the five documented E2E entry
points do not do what their names say.

**Impact.** Anyone running `npm run test:e2e:seed` to verify the seeding path gets a green result
from zero executed tests.
**Status.** VERIFIED.

---

### P2-13 — `pretest:e2e` makes `npm run test:e2e` impossible from a cold start

**Evidence.** `package.json:21` registers `scripts/test-preflight.js` as `pretest:e2e`. It exits 1
if `http://localhost:8080/health` is not already 200 (`scripts/test-preflight.js:24-31`). But
`playwright.config.js:109-119` is what starts that server, and it runs *after* the pre-hook. On CI,
`reuseExistingServer: !process.env.CI` (`playwright.config.js:114`) means Playwright would start a
fresh server — but preflight has already killed the run.

**Impact.** The canonical E2E command cannot run in a clean environment. Masked today only because
there is no CI (`.github/` contains no `workflows/` directory).
**Status.** VERIFIED by reading.

---

### P2-14 — `test:rules` targets port 8080, not the emulator on 8090

**Evidence.** `tests/firestore-rules/rules.test.js:34` sets `port: 8080`. `firebase.json` declares
the Firestore emulator on port 8090. Port 8080 is the ad-server (`playwright.config.js:113`,
`.env.example:18`).

Compounding: `firebase.json` is UTF-16LE with a BOM (`file firebase.json` →
`Unicode text, UTF-16, little-endian`), and `JSON.parse` on its UTF-8 decoding fails. Whether the
Firebase CLI tolerates that encoding is **UNDETERMINED** — confirming it requires running
`firebase`, which is out of scope.

**Impact.** The Firestore rules suite tests nothing, or tests against the wrong service.
**Status.** VERIFIED (port mismatch, encoding); UNDETERMINED (CLI tolerance).

---

### P2-15 — Firestore rules use camelCase fields; the application writes snake_case

**Evidence.** `ad-server/firestore.rules:18`, `:23`, `:29`, `:41` gate on `retailerId`;
`ad-server/firestore.rules:34`, `:36` gate on `advertiserId`. The application writes
`retailer_id` and `advertiser_id` — e.g. `ad-server/src/api/campaigns.js:219`,
`ad-server/src/api/impressions.js:67`, `tests/demo_wizard/00_seed.setup.js:190`. Counting
occurrences across `ad-server/src`: 43 `retailer_id` / 29 `advertiser_id` versus 42 `retailerId` /
15 `advertiserId`, and the camelCase hits are overwhelmingly local variable names, not document
fields (the one genuine camelCase document field is in `ad-server/src/api/invoices.js:63`, `:99`).

`tests/firestore-rules/rules.test.js:53`, `:56`, `:59` set custom claims `advertiserId` and
`retailerId` — matching the rules, not the data. **The rules tests validate the rules against a
schema the application does not use.** They can pass while the rules deny every real request.

**Additional context that changes the severity.** `client-app/package.json` declares no `firebase`
dependency, and no `client-app/src` file imports `firebase/app` or `firebase/firestore`. The only
Firestore client is the **Admin SDK** in the ad-server
(`ad-server/src/utils/firestore.js:1`, `ad-server/package.json:16`), which **bypasses security
rules entirely**. So `ad-server/firestore.rules` is not currently enforcing anything at runtime —
the real authorization boundary is the Express middleware, which is where P0-2, P1-6, P1-7 and
P1-8 live.

**Impact.** `test:rules` is a green signal for a layer that is (a) inert today and (b) mis-specified
if it is ever activated. Worse, its greenness may be read as evidence that authorization is tested.
**Status.** VERIFIED.

---

### P3-16 — demo_wizard specs execute twice under `npm run test:e2e`

**Evidence.** `playwright.config.js:64-68` declares `chromium` with no `testMatch`/`testIgnore`
against `testDir: './tests'` (`playwright.config.js:28`), which includes `tests/demo_wizard/`.
`playwright.config.js:83-99` declares `demo-wizard` over the same files. Under `ALLOW_DEMO_MODE=true`
both projects are active.

**Impact.** The 16-phase serial demo runs once under the correct settings (serial, 90 s) and once
under the wrong ones (`fullyParallel: true`, 60 s), roughly doubling suite runtime and producing
duplicate, differently-behaving results for ~110 tests.
**Status.** VERIFIED by reading.

---

### P3-17 — `verify_predeploy.js` is not a quality gate

**Evidence.** `verify_predeploy.js:6-45` checks only that two markdown files, two package.json
files and `.env.example` exist. No build, no lint, no test.
`docs/Deployment_Guide.md:23-28` claims five entirely different checks. `cloudbuild.yaml:12` is the
sole pre-deploy step besides secret existence (`cloudbuild.yaml:15-20`).

Additionally `verify_predeploy.js:34` counts `PROJECT_ID` as a CI marker, silently skipping the
local-env warning for any developer with it exported.

**Impact.** Nothing in the deploy path can fail a broken build. Combined with the absence of CI,
**no automated check runs between a commit and production.**
**Status.** VERIFIED.

---

### P3-18 — Firestore composite indexes the code needs are never deployed

**Evidence.** `firebase.json` points at root `firestore.indexes.json` (6 indexes);
`cloudbuild.yaml:131` reads `ad-server/firestore.indexes.json` (2 indexes). The `invoices`,
`loops` and `retailers` composite indexes exist only in the file the pipeline ignores. The step is
`allowFailure: true` (`cloudbuild.yaml:134`) so even a hard error passes.

The root file's comment documents the consequence: without the `retailers (deleted_at, status)`
index, `GET /api/retailers?for=campaign` throws `FAILED_PRECONDITION` under load (RISK-S22-2).

**Impact.** A documented, named production failure mode with a deploy path structurally unable to
prevent it.
**Test coverage.** `ad-server/tests/scheduler-campaign-flow.test.js:127` covers the *query* but
against mocked/in-memory data, so index absence is invisible.
**Status.** VERIFIED.

---

### P3-19 — `x-demo-role: retailer` silently 403s (Rule 3 reproduced in the seed data)

**Evidence.** `tests/demo_wizard/00_seed.setup.js:28` (`DEMO_RETAILER = 'retailer'`) and `:131`
seed a user with role `'retailer'`, which is absent from `ROLE_HIERARCHY`
(`ad-server/src/constants/roles.js:13-21`) and unmapped by `normalizeRole`
(`ad-server/src/constants/roles.js:24-28`). `requireRole` resolves it to −1
(`ad-server/src/middleware/requireRole.js:37`) and 403s.
`tests/fixtures/personas.js:69` uses the correct `'retaileradmin'` for the same persona — the two
"single sources of truth" disagree. `ad-server/src/middleware/auth.js:26-27` keys the overrides map
on both spellings, which masks the `linked_entity_id` half of the problem but not the hierarchy half.

**Impact.** Any spec or caller using the `00_seed.setup.js` constant is silently blocked.
**Fix cost.** One line, plus one test asserting every fixture role is a `ROLE_HIERARCHY` key.
**Status.** VERIFIED.

---

### P3-20 — Hardcoded demo campaign in the production create handler, with a destructive delete

**Evidence.** `ad-server/src/api/campaigns.js:142-155` embeds `demo-campaign-001` and eight other
seed literals in `POST /api/campaigns`; `:165-166` **deletes and recreates** the existing document
on conflict. Gated only by `ALLOW_DEMO_MODE === 'true' && req.user?.id === 'demo-brand'`
(`:139-140`) — open in production by default (P0-2). Direct violation of Rule 8
(`.agent/SPACE_INSTRUCTIONS.md:69-75`).

**Status.** VERIFIED.

---

### P3-21 — Thirteen E2E tests and three Jest files are silently inactive

**Evidence.** 13 `test.skip` / `test.fixme` markers (locations listed in §2.3), including the
entire login-feature suite (`tests/demo_wizard/16_login_feature.spec.js:19`) and 3 of 5 telemetry
tests (`tests/telemetry.spec.js:50`, `:101`, `:116`). Three Jest files never match `testMatch`
(`ad-server/jest.config.js:18`): `ad-server/tests/pricing_billing.spec.js`,
`ad-server/tests/verify_performance.js`, `ad-server/tests/verify-special-hours-persistence.js`.

**Impact.** The suite reports green over a login feature, a telemetry pipeline and a
pricing-billing file that are not being exercised at all.
**Status.** VERIFIED.

---

### P3-22 — `CORS_ORIGINS` can silently become `*`

**Evidence.** `cloudbuild.yaml:82-83`: if `gcloud run services describe` returns an empty primary
client URL, `CORS_VALUE="*"`. That value is then set on the ad-server at `cloudbuild.yaml:97`, and
`ad-server/index.js:55` honours `CORS_ORIGINS.includes('*')` as allow-everything. Both `describe`
calls at `cloudbuild.yaml:78-79` suppress errors with `2>/dev/null || echo ""`, so a transient
lookup failure on a first-ever deploy silently opens CORS.

Also, `ad-server/index.js:35-37` hardcodes a production origin
(`https://client-app-524693967756.us-central1.run.app`) which is honoured unconditionally at
`ad-server/index.js:57` regardless of `CORS_ORIGINS`.

**Test coverage.** None.
**Status.** VERIFIED.

---

### P3-23 — `orderBy` is silently dropped in the memory fallback

**Evidence.** Six call sites pass `orderBy` to `findAll()` —
`ad-server/src/api/impressions.js:69`, `:79`, `:100`;
`ad-server/src/api/notifications.js:65`; `ad-server/src/api/screens.js:209`;
`ad-server/src/repositories/ImpressionRepository.js:30`, `:41`;
`ad-server/src/repositories/SchedulingAuditRepository.js:26`. `BaseRepository.findAll()`
(`ad-server/src/repositories/BaseRepository.js:71-110`) handles only `where` and `limit`. The option
is dropped on **both** paths — it is never translated into a Firestore `.orderBy()` at `:76-87`,
and never applied to the memory fallback at `:96-108`.

**Impact.** "Newest first" is not guaranteed anywhere it is requested: notification lists, screen
logs, impression queries and scheduling audits return in arbitrary order.
**Test coverage.** None.
**Status.** VERIFIED.

---

### P3-24 — `scripts/lint-tests.js` passes files it cannot parse

**Evidence.** `scripts/lint-tests.js:83-85` catches Babel parse errors, prints
`⚠️ [Parser Error]`, and does **not** increment `errorsFound`. A spec with a syntax error the parser
rejects is reported as clean. `scripts/lint-tests.js:24` also restricts linting to `.spec.js`,
exempting `tests/global.setup.js`, `tests/demo_wizard/00_seed.setup.js`, `tests/base.fixtures.js`
and all locator modules.

**Status.** VERIFIED.

---

### P3-25 — Playwright `globalSetup` swallows a failed database reset

**Evidence.** `tests/global.setup.js:33` POSTs `/api/debug/reset`; `tests/global.setup.js:39-41`
catches any failure, logs `❌ Warning: Database reset failed during globalSetup`, and returns
normally. The suite then runs against whatever state the database happens to be in.

**Impact.** Test isolation is best-effort. A failed reset produces confusing, non-reproducible
failures downstream rather than an immediate, honest abort.
**Status.** VERIFIED.

---

### P3-26 — `GET /api/auth/me` always returns `{ user: undefined }`

**Evidence.** `ad-server/src/api/auth.js:29-32` returns `req.user`, but `/auth` is mounted publicly
at `ad-server/src/api/index.js:33` and the route adds no `authenticate`. `req.user` is always
undefined. The body of the handler is a comment: *"Session check logic would go here"*
(`ad-server/src/api/auth.js:30`).

**Status.** VERIFIED.

---

### P4-27 — Dead code

`ad-server/src/api/ads.js` (unmounted; `GET /api/ads` 404s, yet
`tests/demo_wizard/17_api_surface_smoke.spec.js:54` claims to prove it is mounted),
`ad-server/routes/geminiRoutes.js` (unmounted),
`ad-server/src/middleware/validation.js` (unimported),
`ad-server/src/utils/firestore.js:36` `isMockMode()` (uncalled),
`bcryptjs` (`ad-server/package.json:20`, unimported),
top-level `ads/` (duplicated into `ad-server/assets/`). All VERIFIED.

---

## 7. What I could not determine

- **Whether the live production Cloud Build trigger overrides `_ALLOW_DEMO_MODE`.**
  `cloudbuild.yaml:194` defaults it to `'true'` and its own comment says the safe value is set on
  the trigger, outside the repo. Establishing the live value needs a `gcloud` call, which is out of
  scope. **This is the single most important open question from this review** — it decides whether
  P0-1 and P0-2 are live or latent.
- **Whether the `gcloud` project misconfiguration in
  `sre-reports/report-2026-06-22T03-52-30.md:9` still exists.** Not checked, per the ground rules.
  P1-5 makes it actively dangerous regardless of its current value.
- **Whether the Firebase CLI parses the UTF-16LE `firebase.json`.** Would require running
  `firebase`.
- **Whether the E2E suite currently passes.** Running it requires `ALLOW_DEMO_MODE=true`, a live
  ad-server, a live client and a database reset against `/api/debug/reset`. Not run.
- **Whether `client-app` lints or builds cleanly.** `client-app/node_modules` was absent; only
  `ad-server` dependencies were installed for this review, so only the ad-server ESLint pass and
  the Jest suite were executed.
- **Whether the Vitest suite passes.** Same reason.
- **Runtime behaviour of the ticket system** (two ticket APIs on different mount points, §Rule 14).

---

## 8. Commands run for this review

All read-only. No deploy, no seed, no GCP/Firebase call.

```
$ cd ad-server && npm install --no-audit --no-fund
  (exit 0 — node_modules was absent from all three packages)

$ npm run test:unit
  Test Suites: 2 failed, 10 passed, 12 total
  Tests:       10 failed, 82 passed, 92 total
  Time:        59.216 s
  All files    |   35.17 |    27.72 |   33.42 |    35.9

$ cd ad-server && ./node_modules/.bin/eslint . --ext .js
  ✖ 30 problems (0 errors, 30 warnings)

$ node -e "JSON.parse(require('fs').readFileSync('firebase.json','utf8'))"
  PARSE FAIL: Unexpected token '<BOM>', "<BOM>{  " ... is not valid JSON

$ file firebase.json
  firebase.json: Unicode text, UTF-16, little-endian text, with CRLF line terminators

$ grep -rn "@seed" tests/ scripts/ *.js *.json
  package.json:19, package.json:20   (no matches anywhere in tests/)
```

`npm run lint` at the repo root was **not** run: it requires root `node_modules`
(`@babel/parser`, `@babel/traverse` per `package.json:33-34`) and then recurses into
`client-app`, whose dependencies were also absent. Only the `ad-server` half was executed, above.
