# Lessons Learned

Objectives: Document errors, bugs, and mistakes so we do not make them again.

## Development Lessons

### [2026-01-06] Build-Time vs Runtime Configuration (Vite)
- **Issue**: Vite "bakes" environment variables into the production bundle at build-time, creating environment-specific binaries.
- **Root Cause**: Reliance on `import.meta.env` during the compilation phase creates hardcoded strings in the output assets.
- **Prevention**: Use the "Runtime Configuration Injection" pattern. Generate a dynamic `config.js` script via a container entrypoint and load it in `index.html` BEFORE the main bundle. This enables "build once, deploy many" patterns.

### [2026-01-06] Cloud Build Shell Variable Escaping Conflicts
- **Issue**: Cloud Build misinterprets `$$SHELL_VAR` if the parser identifies prospective tag patterns before shell execution.
- **Root Cause**: First-pass tag resolution attempts to match patterns even when designated as shell-escaped.
- **Prevention**: Use lowercase shell variable names to avoid collision with Cloud Build's uppercase substitution tags. Alternatively, isolate fetch and build logic into discrete steps using standard builder images (e.g., `gcloud` vs `docker`).

### [2026-01-03] Flexible Validation for Creative Assets
- **Issue**: Strict 5-second validation blocked users from uploading potentially valid creatives (e.g., 4.9s or 5.1s).
- **Root Cause**: Hard constraints in UI prevented valid business flows.
- **Prevention**: Use "Soft Validation" (warnings) instead of "Hard Validation" (errors) for business rules that might have exceptions. Allow the user to override if they acknowledge the warning.

### [2026-01-03] Robust URL Construction in Player
- **Issue**: Player failed to load ads when API returned mixed URL formats (relative vs absolute).
- **Root Cause**: Client assumed a specific URL structure.
- **Prevention**: Always sanitize and normalize URLs on the client-side before rendering. Check for protocol prefixes (`http/https`) and append the API base URL if missing.


### [2026-01-01] ETags for API Caching
- **Issue**: API responses can be cached but need invalidation when data changes.
- **Root Cause**: Static cache headers don't know when data changes.
- **Prevention**: Use ETags for conditional requests. Server generates hash of response, client sends `If-None-Match` header, server returns 304 if unchanged. This provides automatic cache invalidation.

### [2026-01-01] Structured Logging vs console.log
- **Issue**: console.log is not searchable or filterable in production.
- **Root Cause**: Plain text logs lack structure and metadata.
- **Prevention**: Use structured logging (Winston, Pino) with JSON format. Include severity levels, timestamps, and context metadata. This enables powerful queries in Cloud Logging like "show all errors from last hour" or "find slow requests".


### [2026-01-01] Validation Middleware Order Matters
- **Issue**: Validation middleware must come before route handler in Express.
- **Root Cause**: Express executes middleware in order, validation must run first.
- **Prevention**: Always place validation middleware as the first parameter after the route path: `app.post('/route', validateMiddleware, handler)`. If validation comes after handler, it never runs.

### [2026-01-01] Security Headers Should Be Global
- **Issue**: Adding security headers to individual routes is repetitive and error-prone.
- **Root Cause**: Security headers should apply to all responses.
- **Prevention**: Use `app.use(securityHeaders)` to apply headers globally. This ensures every response has security headers, even error responses.


### [2026-01-01] Service Layer vs Repository Pattern
- **Issue**: Confusion about when to use service layer vs repository pattern.
- **Root Cause**: Both abstract data access, but serve different purposes.
- **Prevention**: Use repository for data access (CRUD), use service for business logic (validation, orchestration). Routes should call services, services call repositories. Never skip the service layer - it's where business logic belongs.

### [2026-01-01] API Client Retry Logic
- **Issue**: Need to retry failed requests without overwhelming the server.
- **Root Cause**: Network errors and temporary server issues are common.
- **Prevention**: Implement exponential backoff (1s, 2s, 3s delays) and limit retries to 3 attempts. Only retry on specific status codes (408, 429, 5xx). Never retry on 4xx client errors (except 408, 429).

### [2026-01-01] Request Interceptors for Auth
- **Issue**: Every API call needs to include auth token manually.
- **Root Cause**: No centralized way to add auth headers.
- **Prevention**: Use request interceptors to automatically inject auth token from localStorage. This ensures all requests are authenticated without manual header management.


### [2026-01-01] Repository Pattern Benefits
- **Issue**: Direct database access in routes makes testing difficult and creates tight coupling.
- **Root Cause**: Business logic mixed with data access logic.
- **Prevention**: Use repository pattern to abstract database operations. Benefits include:
  1. **Testability**: Easy to mock repositories in unit tests
  2. **Maintainability**: Database changes isolated to repository layer
  3. **Reusability**: Common operations (CRUD) in BaseRepository
  4. **Flexibility**: Can swap databases without changing routes

### [2026-01-01] Firestore Async Patterns
- **Issue**: Firestore SDK is entirely async, requiring async/await everywhere.
- **Root Cause**: Firestore operations are network calls that return Promises.
- **Prevention**: Always use `async/await` with Firestore operations. Wrap in try/catch for error handling. Never use `.then()` chains - they're harder to read and debug.

### [2026-01-01] Firestore Auto-Timestamps
- **Issue**: Manually managing `created_at` and `updated_at` timestamps is error-prone.
- **Root Cause**: Developers forget to add timestamps or use inconsistent formats.
- **Prevention**: Implement auto-timestamps in BaseRepository:
  - `created_at` set automatically on `create()`
  - `updated_at` set automatically on `create()` and `update()`
  - Use ISO 8601 format (`new Date().toISOString()`)

### [2026-01-01] Idempotent Seed Scripts
- **Issue**: Running seed scripts multiple times can create duplicate data.
- **Root Cause**: Seed scripts that always insert without checking existence.
- **Prevention**: Make seed scripts idempotent by checking if data exists before creating:
  ```javascript
  const exists = await repository.exists(id);
  if (!exists) {
      await repository.create(id, data);
  }
  ```


### [2026-01-01] Environment Variable Configuration with Vite
- **Issue**: Vite doesn't expose all environment variables to the browser by default.
- **Root Cause**: Vite only exposes variables prefixed with `VITE_` to prevent accidentally leaking server-side secrets to the client.
- **Prevention**: Always prefix client-side environment variables with `VITE_` (e.g., `VITE_API_URL`). Use `import.meta.env.VITE_*` in client code, not `process.env`.

### [2026-01-01] ES Modules and __dirname
- **Issue**: `__dirname` is not available in ES modules (when using `"type": "module"` in package.json).
- **Root Cause**: ES modules use `import.meta.url` instead of CommonJS `__dirname` and `__filename`.
- **Prevention**: Use `fileURLToPath` and `dirname` from Node.js built-ins:
  ```javascript
  import { fileURLToPath } from 'url';
  import { dirname } from 'path';
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  ```

### [2026-01-01] PowerShell Command Chaining
- **Issue**: PowerShell doesn't support `&&` operator for command chaining (common in bash).
- **Root Cause**: PowerShell uses `;` for command separation, not `&&`.
- **Prevention**: Use `;` instead of `&&` in PowerShell commands, or use bash/WSL for cross-platform scripts.

### [2026-01-01] Default Secrets in Production
- **Issue**: Using default/fallback secrets (e.g., `JWT_SECRET || 'default-secret'`) is a critical security vulnerability.
- **Root Cause**: Developers forget to set environment variables in production, and the app silently uses insecure defaults.
- **Prevention**: **Never use fallback secrets**. Always fail fast with `process.exit(1)` if required secrets are missing. This forces proper configuration and prevents production security incidents.


### [2026-01-01] Ad Rotation Safety
- **Issue**: Client player rotation was ambiguous (defaulting to 10s) and lacked background syncing for hourly schedules.
- **Root Cause**: Hardcoded fallback values in `Player.jsx` and missing polling mechanism.
- **Prevention**: Forces 5-second rotation and implemented 60-second back-end polling to stay synced with `hourlyLoop`.

### [2026-01-01] Auth to Persona Refactoring
- **Issue**: Traditional login/redirect patterns blocked the seamless switching required for "Persona Mode" demos.
- **Root Cause**: `ProtectedRoute` was hardcoded to check for a `user` object and return a `/login` redirect.
- **Prevention**: Removed `ProtectedRoute` entirely. Refactored `AuthContext` to manage `persona` state with local storage persistence, ensuring all routes are accessible while the UI adapts based on the active persona.

### [2026-01-01] E2E Testing & UI Accessibility
- **Issue**: Playwright tests were brittle due to Material Icon text leaking into button accessible names (e.g., getting "shield_person Brand" instead of just "Brand").
- **Root Cause**: Reliance on `getByRole('button', { name: 'Label' })` without explicit `aria-label` when icons are used inside buttons.
- **Prevention**: Always add `aria-label` to buttons containing Material Icons and use regex or `exact: false` in Playwright selectors.

### [2026-01-01] E2E State Isolation
- **Issue**: Tests were failing non-deterministically when run in sequence or parallel because persona state in `localStorage` persisted between tests.
- **Root Cause**: Previous tests changing the active persona without resetting it for the next test block.
- **Prevention**: Use `page.addInitScript` in `beforeEach` hooks to explicitly set the required `localStorage` state (e.g., `active_persona`) before the page loads.

### [2026-01-01] Selector Standardization (data-test vs data-testid)
- **Issue**: Gold Path integration test failing because UI components used `data-test` while tests expected `data-testid`.
- **Root Cause**: Inconsistent attribute naming conventions across components (`PersonaSwitcher` vs `HamburgerMenu`).
- **Prevention**: Standardize all test selectors on `data-testid`. Update all components to use the same convention and verify with `grep_search` before adding new tests.

### [2026-01-01] Duplicate Selectors in Dual Persona Switchers
- **Issue**: Playwright tests for persona switching failed with "strict mode violation" - selectors matched multiple elements.
- **Root Cause**: Both `PersonaSwitcher.jsx` (header) and `HamburgerMenu.jsx` (sidebar) used identical `data-testid="persona-{role}"` attributes. With two switchers on screen, Playwright couldn't find a unique element.
- **Prevention**: Use component-scoped test IDs: `persona-{role}` for header, `menu-persona-{role}` for hamburger. Always run `grep_search` for `data-testid=` before adding new test selectors to detect duplicates.

### [2026-01-01] Persona Switch Navigation Timing
- **Issue**: Integration tests failed intermittently after switching personas - assertions ran before page navigation completed.
- **Root Cause**: SPA navigation from persona switch is asynchronous; clicking the button doesn't wait for route change.
- **Prevention**: After any persona switch in tests, add `await page.waitForURL()` and `await page.waitForLoadState('networkidle')` before asserting page content.

### [2026-01-01] UI Elements That Pollute Playwright Testing
- **Issue**: Buttons with Material Icons like `<span>add</span>` pollute accessible names, causing `getByRole('button', { name: 'New Campaign' })` to fail because Playwright sees "add New Campaign".
- **Root Cause**: Icon fonts render text content (like "add", "menu", "shield_person") that gets included in the button's accessible name.
- **Prevention**:
  1. **Always use `aria-hidden="true"`** on decorative icons inside interactive elements
  2. **Always add `data-testid`** to critical buttons/links for reliable test targeting
  3. **Prefer `data-testid` over role+name** in tests for buttons containing icons
  4. **Audit before deploy**: Run `grep_search` for Material Icons inside `<button>` without `aria-hidden`

### [2026-01-01] CI-Aware Pre-deployment Scripts
- **Issue**: `verify_predeploy.js` failed in Cloud Build because it checked for a `dist/` folder that hadn't been built yet.
- **Root Cause**: Scripts designed for local pre-commit or pre-push checks often assume a local build state that doesn't exist in early CI steps.
- **Prevention**: Use environment variables (like `CI`, `PROJECT_ID`, or `BUILD_ID`) to detect the environment and skip local-only checks. Ensure `cloudbuild.yaml` passes these variables explicitly if they aren't available by default.

### [2026-01-01] Cloud Run Public Access (IAM)
- **Issue**: Deployment succeeded but the app returned "403 Forbidden" (error: 403 Forbidden - Access is forbidden to the requested page).
- **Root Cause**: New Cloud Run services default to authenticated-only access if "Allow unauthenticated" isn't properly applied or if IAM policies are missing.
- **Prevention**: Explicitly grant `roles/run.invoker` to `allUsers` for public-facing services using `gcloud run services add-iam-policy-binding`.

### [2026-01-01] The "Admin SDK" False Sense of Security
- **Issue**: Missing Firestore security rules because the server uses Admin SDK.
- **Root Cause**: Assumption that server-side bypass makes rules unnecessary.
- **Prevention**: Even with Admin SDK, define global "deny all" rules (`allow read, write: if false;`) to protect against direct client access or leaks.

### [2026-01-01] Inefficient Counting in Firestore
- **Issue**: `count()` implemented using `docs.length` after fetching all docs.
- **Root Cause**: Using high-level abstraction (`findAll`) for a metadata query.
- **Prevention**: Always use the native `.count()` aggregation query in Firestore Admin SDK for O(1)/O(log n) efficiency instead of O(n) client-side counting.

### [2026-01-01] Pipeline "Glue" and Dynamic Configuration
- **Issue**: Hardcoded service URLs in `cloudbuild.yaml` caused a brittle dependency between front-end and back-end deployments.
- **Root Cause**: Manual inclusion of a specific URL for CORS whitelist.
- **Prevention**: Use `gcloud` commands within build steps to dynamically retrieve service URLs (e.g., `gcloud run services describe ... --format='value(status.url)'`). This ensures the "glue" between components survives service renames or project migrations.

### [2026-01-01] Domain-Driven Routing Consistency
- **Issue**: Unused but existing API files in `src/api/` led to developer confusion and "dead code" risk.
- **Root Cause**: Routes were being defined directly in `index.js` while "work-in-progress" files sat unmounted in the API directory.
- **Prevention**: Always isolate route definitions into domain routers and mount them via a central index. Delete any API files that are not active in the production `index.js` to ensure the file system reflects the active application state.

### [2026-01-01] Metadata-First Validation
- **Issue**: Deep physical file validation (ffprobe) can be slow and add infrastructure complexity for early MVP.
- **Root Cause**: Desire for strict compliance vs development speed.
- **Prevention**: Use metadata-based validation for early iterations. Store duration, dimensions, and type in a JSON metadata field. This allows the UI and API to enforce strict rules (like the 5-second rule) instantly without waiting for expensive transcoding or inspection processes.

### [2026-01-01] Multi-tenant Data Isolation in Repositories
- **Issue**: Risk of "leaking" data between tenants if queries aren't scoped.
- **Root Cause**: Generic `findAll` queries without entity filters.
- **Prevention**: Standardize filter methods in repositories (e.g., `findByRetailer(id)`, `findByAdvertiser(id)`). In middleware, always extract the `linked_entity_id` from the auth token and pass it as a mandatory filter to these repo methods. Never trust a `tenant_id` passed via request body if it hasn't been validated against the user's allowed scope.

### [2026-01-01] JSX Parsing Ambiguity with Operators
- **Issue**: Using the less-than symbol `<` directly in JSX text (e.g., `< 2m`) can cause parser errors or linting warnings as it's mistaken for the start of a tag.
- **Root Cause**: Ambiguity between character literals and tag delimiters.
- **Prevention**: Always wrap comparison strings in curly braces as string literals: `{ '< 2m' }`.

### [2026-01-01] Telemetry Enrichment at the Edge
- **Issue**: Frontend dashboards struggle with performance when doing cross-tenant data joins for analytics.
- **Root Cause**: Storing raw telemetry (Screen ID only) without environmental context.
- **Prevention**: Enrich telemetry (heartbeats/impressions) at the API layer with `location_id` and `retailer_id` before saving. This enables O(1) clustering by location/retailer in the database, significantly speeding up both Tech Ops and Retailer analytics views.

### [2026-01-01] Case-Insensitive UI Testing
- **Issue**: Playwright tests fail when UI styling changes casing (e.g., "ADMIN" vs "Admin") even if text content is correct.
- **Root Cause**: Reliance on exact string matching in `getByText`.
- **Prevention**: Always use case-insensitive regex for text assertions: `getByText(/admin mode/i)`. This makes tests resilient to CSS-driven casing changes.

### [2026-01-01] UI Handler Completeness
- **Issue**: Instrumentalizing components with `data-testid` can reveal underlying bugs (e.g., missing `handleDrag` causing ReferenceError).
- **Root Cause**: Incomplete implementation of UI event handlers.
- **Prevention**: Ensure all bound handlers in JSX (onClick, onDrag, etc.) are at least defined as empty functions before adding test hooks or running E2E suites.

### [2026-01-01] Refactoring Import Integrity
- **Issue**: Bulk find/replace in test files can accidentally delete critical CJS/ESM imports (e.g., `test` from `@playwright/test`).
- **Root Cause**: Over-aggressive pattern matching during bulk updates.
- **Prevention**: Always verify the top of the file after bulk replacements. Tests will fail with `ReferenceError: test is not defined` if imports are lost.

### [2026-01-01] Async Event-Loop Blockage (Firestore)
- **Issue**: Backend server hung indefinitely during initialization in local/test environments.
- **Root Cause**: Firestore Admin SDK connection attempts (even within try/catch) proved to be blocking the Node.js event loop when credentials were missing, causing cascading timeouts in Playwright tests.
- **Prevention**: Explicitly gate cloud resource initialization. If `GOOGLE_APPLICATION_CREDENTIALS` is missing in non-production, return `null` immediately and fail-over to in-memory mocks to keep the event loop responsive.

### [2026-01-01] Import Integrity in Seeding Services
- **Issue**: Bulk database seeding intermittently failed with `ReferenceError`.
- **Root Cause**: Missing imports for specific repositories (e.g., `screenRepository`) in `SeedService.js` after refactoring.
- **Prevention**: Always verify the import block when adding new entity-types to a seeding service. Ensure the index export in `repositories/index.js` matches the usage in the service.

### [2026-01-01] Data Truncation and Validation Locks
- **Issue**: "Proceed" buttons in wizard flows remained disabled despite "correct" user input.
- **Root Cause**: The underlying reference data (e.g., `timeSlots` array) was accidentally truncated during a UI edit, leaving the component with no valid options to select.
- **Prevention**: Use unit tests or "Data Integrity" checks for static component data. Avoid bulk editing large arrays in JSX without verifying the start/end lines.

### [2026-01-01] Async Race Conditions in E2E Tests
- **Issue**: Playwright tests reported "element is not enabled" for buttons that should be clickable.
- **Root Cause**: The async `fetch()` inside click handlers completed AFTER Playwright attempted to click the next button. State wasn't updated in time.
- **Prevention**: Add loading states (`isUploading`) that disable buttons during async operations. In tests, use `waitFor()` on button enabled state instead of fixed `waitForTimeout()`.

### [2026-01-01] Parallel Tests Overwhelming Mock Servers
- **Issue**: E2E tests failed randomly when run with multiple workers.
- **Root Cause**: 8 parallel workers making concurrent requests to a single-threaded mock server caused resource contention and timeouts.
- **Prevention**: Set `workers: 1` in `playwright.config.js` until backend can handle concurrent load. Alternatively, use `page.route()` to mock API responses entirely within the test.

### [2026-01-01] API Mocking in Playwright Tests
- **Issue**: Tests depended on backend API endpoints that weren't fully implemented.
- **Root Cause**: Tests assumed all API routes were production-ready.
- **Prevention**: Use `page.route('**/api/endpoint', route => route.fulfill({...}))` in `beforeEach` to mock API responses. This isolates tests from backend state and makes them deterministic.

### [2026-01-01] Feature Gaps vs Test Issues
- **Issue**: Tests failed, but debugging showed the test infrastructure was correct.
- **Root Cause**: The UI lacked the expected text ("campaign approval portal"), navigation links were conditionally hidden, or AuthContext wasn't integrated with PersonaSwitcher.
- **Prevention**: When tests fail, first verify the UI actually renders what the test expects. Use `test.skip()` for tests that depend on unimplemented features, and document them as "feature gaps, not test issues."

### [2026-01-01] Custom Hooks for Consistent Async State Management
- **Issue**: Multiple components had duplicate async state management code (isLoading, error handling, try/catch).
- **Root Cause**: Each component implemented its own loading state logic, leading to inconsistency and redundant code.
- **Prevention**: Create a reusable `useAsyncAction` hook that wraps async functions and automatically manages `isLoading`, `error`, and `data` states. This ensures consistent behavior across all components and reduces boilerplate by ~15 lines per component.

### [2026-01-02] Firestore Count Optimization
- **Issue**: `count()` implemented by fetching all documents in memory.
- **Root Cause**: Reliance on high-level `findAll` abstraction for metadata.
- **Prevention**: Use Firestore's native `.count()` aggregation query for O(1) performance. This significantly reduces memory pressure and network egress.

### [2026-01-02] Hourly Playlist Caching
- **Issue**: Identical playlist requests from multiple screens caused redundant database reads.
- **Root Cause**: Lack of a temporal cache for high-frequency, read-heavy endpoints.
- **Prevention**: Implement in-memory caching with hourly expiration for data that only changes at slot intervals. This protects against "thundering herd" database spikes.

### [2026-01-02] Management API Security
- **Issue**: Admin/Dashboard routes were exposed without authentication middleware.
- **Root Cause**: Assumptions about Cloud Run visibility vs explicit middleware enforcement.
- **Prevention**: Always apply `authenticate` middleware to management routes in the central API router. Never rely solely on infra-level gating for security-critical endpoints.

### [2026-01-02] API Contract Drift
- **Issue**: Shallow API stubs caused "silent" frontend failures (missing fields in payloads).
- **Root Cause**: Lack of automated contract testing and reliance on initial wireframe stubs during rapid UI development.
- **Prevention**: Perform a formal API-Frontend "Contract Audit" before moving to integrated testing. Ensure all optional/mandatory fields in `fetch` calls are explicitly mirrored in backend handlers.

### [2026-01-02] Scalable Side-Effects via Service Layer
- **Issue**: Campaign-to-Ad conversion was initially overlooked in simple CRUD repositories.
- **Root Cause**: Mixing business logic (state transitions) with data access (CRUD).
- **Prevention**: Use a dedicated `Service` layer (e.g., `CampaignService`) to orchestrate multi-step processes like status transitions and secondary document generation. This keeps repositories lean and focused on I/O.

### [2026-01-02] Circuit Breaker Calibration
- **Issue**: Transient Firestore timeouts can block the entire event loop if many requests wait for the same failing resource.
- **Root Cause**: Lack of fail-fast mechanisms for external dependencies.
- **Prevention**: Implement a Circuit Breaker for every external resource. This prevents resource exhaustion by failing fast after a threshold (e.g., 3 failures) and allows the system to recover during the "HALF_OPEN" window.

### [2026-01-02] Retry with Jitter
- **Issue**: Simultaneous retries from multiple clients/services can overload a recovering database.
- **Root Cause**: Fixed-interval retries creating "spikes" of traffic.
- **Prevention**: Always use exponential backoff with random jitter. This spreads out the retry load over time, increasing the chance of successful recovery for the target system.

### [2026-01-02] Global Playlist Implementation & Forced Rotation
- **Issue**: System required a fallback for screens without specific assignments, with a fixed 5s ad rotation for such a "global" pool.
- **Root Cause**: Missing "Global" state in the playlist domain model and lack of fallback logic in the service layer.
- **Prevention**: 
  1. **Flag-based Fallback**: Added `is_global` boolean to the Playlist model.
  2. **Service Orchestration**: Modified `PlaylistService` to query for a global playlist if no specific assignment exists.
  3. **Forced Domain Constraints**: Hardcoded `duration: 5` in the service hydrant logic for global playlists to enforce the business rule regardless of user input.

### [2026-01-02] CI/CD Optimization
- **Issue**: Standardizing on Docker multi-stage builds instead of redundant Cloud Build steps significantly increases pipeline reliability and reduces environment-specific failures.
- **Root Cause**: Redundant Cloud Build steps and environment-specific failures.
- **Prevention**: Standardize on Docker multi-stage builds.

### [2026-01-02] Rollback Readiness
- **Issue**: Implementing unique `$BUILD_ID` or SHA-based image tagging is critical for MVP deployments to allow instant rollbacks when `:latest` is overwritten by failing builds.
- **Root Cause**: Overwriting `:latest` tag with failing builds.
- **Prevention**: Implement unique `$BUILD_ID` or SHA-based image tagging.

### [2026-01-02] Health Gating
- **Issue**: Using post-deployment health checks (`/health`) as a build gate prevents "blind" successful deployments where the service is up but the application is crashing.
- **Root Cause**: Deployments marked successful even if the application inside the container is unhealthy.
- **Prevention**: Use post-deployment health checks (`/health`) as a build gate.

### [2026-01-02] Multipart Upload with Multer in ES Modules
- **Issue**: Implementing file uploads in an ESM-based Node.js project required careful handling of paths and middleware.
- **Root Cause**: Standard `multer` configurations often assume CommonJS `__dirname`.
- **Prevention**: Use the existing `assets/` directory for static serving and ensure `multer.diskStorage` points to a relative path that Express serves. Always validate file extensions (`.png`, `.jpg`, `.mp4`) at the middleware level to prevent malicious uploads.

### [2026-01-02] Auth-Protected Endpoints in Playwright Tests
- **Issue**: Player E2E tests timed out because `/api/screens/register` was protected by auth middleware.
- **Root Cause**: Player initialization required a successful registration call, which failed without auth headers in the test context.
- **Prevention**: Use `page.route()` to mock protected endpoints in Playwright tests. This decouples the test from auth dependencies and allows isolated verification of UI behavior.

### [2026-01-02] Playlist Priority Chain (Assigned → Global → Legacy)
- **Issue**: Needed clear precedence when multiple content sources exist (assigned playlists, global fallback, legacy slot-based ads).
- **Root Cause**: Missing explicit priority logic in `PlaylistService`.
- **Prevention**: Implement a cascading priority chain:
  1. Assigned playlist (screen-specific)
  2. Global playlist (system fallback)
  3. Legacy hourly slot logic (backward compatibility)
  Include `source` and `playlist_id` in the response for telemetry differentiation.

### [2026-01-02] D-1 Loop Scheduling Logic
- **Issue**: Managing a 14-hour broadcast window with 12 slots per hour across multiple screens is complex to orchestrate.
- **Root Cause**: Ad-hoc generation in route handlers creates performance bottlenecks and inconsistent states.
- **Prevention**: Use a dedicated `LoopGenerationService` and `LoopRepository` to pre-calculate the D-1 schedule. Implement a standard document ID format (e.g., `YYYY-MM-DD_HH_locationId`) for O(1) retrieval by the player.

### [2026-01-02] Player Loop/Playlist Transitions
- **Issue**: Player needs to switch between approved hourly loops (during business hours) and fallback playlists (after hours) without interruption.
- **Root Cause**: Complexity in tracking "real" time vs "broadcast" time in the React state.
- **Prevention**: Use a simple `getCurrentHour()` utility and an `useEffect` hook that triggers on hour changes. The player should check for an approved loop *first*; if missing or outside business hours (8AM-10PM), it falls back to the playlist mode. This "Dual Mode" playback ensures the screen never goes black.

### [2026-01-02] Playwright Test Scaling & Batching
- **Issue**: Running a large suite of 50+ E2E tests concurrently caused timeouts and resource exhaustion in the local dev environment.
- **Root Cause**: Single-worker limitation (`workers: 1`) combined with the overhead of running both `ad-server` and `client-app` locally.
- **Prevention**: When developing complex features, run spec files individually (`npx playwright test tests/spec_name.js`) during the TDD loop. Only run the full suite at key milestones. Use `test.describe.configure({ mode: 'serial' })` for workflows that depend on shared state (like Generate → Approve → Play).

### [2026-01-02] Telemetry with Broadcast Context
- **Issue**: Simple "impression logged" events aren't enough for advertisers paying for specific hourly slots.
- **Root Cause**: Standard telemetry only captured the asset ID, not the schedule context.
- **Prevention**: Enrich the telemetry payload with `loop_id`, `loop_hour`, and `slot_position`. This allows the Analytics dashboard to report on "Delivery Rate" (how many scheduled slots actually played) vs just raw impression counts.

### [2026-01-05] localStorage Prototyping for MVP Development
- **Issue**: Rapid UI development blocked on backend API completion for complex multi-entity data flows.
- **Root Cause**: Frontend development outpaced API implementation, and demo scenarios needed interconnected entities (retailers → stores → screens → loops).
- **Prevention**: Use a centralized `LocalStorageService` with realistic seed data and proper relationships. This enables full UI development including CRUD operations, filtering, and cross-entity queries without backend dependency. When backend is ready, replace localStorage calls with API calls using the same interface.

### [2026-01-05] Wizard Step Progress as Navigation Aid
- **Issue**: Multi-step wizards without visual progress indicators caused user confusion about remaining steps and completed work.
- **Root Cause**: Wizard implementations focused on logic flow but neglected UX for navigation awareness.
- **Prevention**: Always include a visual step progress indicator showing: (1) completed steps with checkmarks, (2) current step highlighted, (3) future steps with icons. Allow clicking completed steps to go back without losing data.

### [2026-01-05] Traffic Tier Pricing Model
- **Issue**: Flat CPM pricing doesn't reflect actual advertising value differences across time-of-day.
- **Root Cause**: Ignoring the reality that peak hours (lunch, rush hour) have higher foot traffic and advertising value.
- **Prevention**: Implement traffic tiers (VeryLow, Low, Medium, High) with CPM multipliers (0.5x to 1.5x). Map specific hours to tiers based on business patterns. Support retailer-level and date-level overrides for special events or partner negotiations.

### [2026-01-05] API Contract Strictness (Object vs Array)
- **Issue**: Backend returned `{ loops: [] }` but frontend expected `[]`. This caused a silent crash in the map/reduce logic.
- **Root Cause**: Backend framework wrapper automatically wrapped responses in an object, which the frontend API client didn't unwrap.
- **Prevention**: 
  1. **Flexible Client**: Update API clients to handle both formats (`response.data || response`).
  2. **Schema Tests**: Verify response shapes in integration tests (e.g., specific test for "is array").

### [2026-01-05] Environment Variable Consistency (Local vs Cloud)
- **Issue**: `JWT_SECRET` was missing in `ad-server` local `.env`, blocking local testing of protected routes (`/api/audit`).
- **Root Cause**: Reliance on defaults or assuming `.env` exists from repo cloning (it's gitignored).
- **Prevention**: Use a `verify-env.js` script that runs before `npm start`, checking against an `.env.example` list of required keys.

### [2026-01-05] React Hook Imports in Production
- **Issue**: `LoopDemoPlayer.jsx` crashed in production build due to missing `useMemo` import.
- **Root Cause**: Local dev server (Vite) sometimes masks missing imports or tree-shaking behaves differently.
- **Prevention**: 
  1. **Strict Linting**: Ensure ESLint enforces import existence for all hooks.
  2. **Production Build Test**: Always run `npm run build && npm run preview` locally before deploying to catch build-time errors.

### [2026-01-05] Cloud Run Health & Secrets
- **Issue**: Service deployed "successfully" but health check failed because it couldn't connect to APIs due to configuration.
- **Root Cause**: Health checks only ping the server up status, not deep dependency checks.
- **Prevention**: Implement "Deep Health" endpoints that check DB/Cache connectivity and fail the health probe if critical dependencies are unreachable.

### [2026-01-05] React Hook Temporal Dead Zone (TDZ)
- **Issue**: Component crashed with `ReferenceError: Cannot access 'variable' before initialization`.
- **Root Cause**: `useEffect` dependency array referenced a variable (`slotContent`) that was defined *after* the hook in the component body.
- **Prevention**: Always define computed values (`useMemo`, variables) *before* the `useEffect` hooks that verify or consume them. Enable `react-hooks/exhaustive-deps` linting to catch some dependency issues, though TDZ is a runtime JS scope issue.

### [2026-01-05] Seed Script Environment Parity
- **Issue**: Uncertainty if production database has required data after initial deployment.
- **Root Cause**: Deployment pipelines often handle code but not data state.
- **Prevention**: design `seed.js` scripts to accept a `projectId` or environment variable. This allows the exact same script to populate local emulators (`demo-project`) and production clouds (`softomedia-live-2026`) without code changes, ensuring data consistency across environments.

### [2026-01-05] Observability Blind Spot (The "Silent Player")
- **Issue**: Client-side crash (TDZ bug) was invisible to backend monitoring because no error reporter existed.
- **Root Cause**: Reliance on user reports for client-side issues.
- **Prevention**: Implement a "Global Error Handler" on the backend to catch unhandled exceptions, and a "Client Telemetry" endpoint (`POST /api/telemetry/error`) to receive reports from `ErrorBoundary`.

### [2026-01-09] Frontend-Backend Naming Conventions (camelCase vs snake_case)
- **Issue**: The application crashed with `TypeError: Cannot read properties of undefined (reading 'high')` on the pricing page.
- **Root Cause**: The backend API (ad-server) returned data with `snake_case` keys (e.g., `traffic_tiers`, `base_cpm`), while the frontend components (client-app) were hardcoded to expect `camelCase` keys (`trafficTiers`, `baseCPM`).
- **Prevention**: 
  1. **Standardization**: Enforce a project-wide convention. In this project, the frontend expects `camelCase`. 
  2. **Normalization Layer**: Implement a normalization layer in the backend repositories or services to ensure consistency regardless of the underlying database schema.
  3. **Defensive Coding**: In the frontend, use optional chaining (`?.`) and provide sensible fallbacks for all data coming from the API. This prevents "Total Failure" crashes in favor of "Graceful Degradation".
  4. **Contract Testing**: Implement basic snapshot testing for API responses to detect casing changes early.

### 2026-01-11: Frontend-Backend State Synchronization with Singletons
**Issue**: Base CPM update showed correct value in UI header ($12) but incorrect price for hourly slots ($11).
**Root Cause**: `PricingService` singleton held stale `retailerOverrides` that caused average to be incorrect.
**Prevention**: 
- Call `pricingService.init(true)` after any pricing update to force refresh
- Clear `retailerOverrides` when `baseCPM` changes in backend
- Add `validateConfiguration()` to detect unusual discount percentages

### 2026-01-11: Hidden Pricing Multipliers Cause Confusion
**Issue**: "Avg Slot CPM" showed $13.50 when user expected $12.00 for Medium tier.
**Root Cause**: `storeTrafficMultiplier` (1.25x for high-traffic stores) was applied but NOT visible in UI.
**Prevention**:
- **Golden Rule**: If the user can't see it, the user can't debug it
- Removed hidden `storeTrafficMultiplier` from calculations
- Created `/pricing-visibility` workflow for future multiplier additions
- All pricing factors must be visible and editable in Super Admin UI before implementation

### [2026-01-12] Ghost Base CPM & Retailer Override Synchronization
- **Issue**: Pricing calculations in the cloud were anchored to stale retailer overrides, causing a $1.00 - $1.50 mismatch between UI header ($12) and slot prices ($11).
- **Root Cause**:
    1. **State Invalidation Gap**: Global `baseCPM` updates did not automatically clear specific `retailerOverrides` in the database, leading to "zombie" prices from early testing.
    2. **Hidden Multipliers**: Legacy `storeTrafficMultiplier` (1.25x) was active in calculation logic but hidden from UI, making it impossible for users to debug discrepancies.
    3. **Singleton Stale-out**: `PricingService` singleton in the frontend failed to refresh internal state after API updates.
- **Resolution Implementation**:
    1. **Cascading Invalidation**: Hardened `PricingRepository.updateConfig` to explicitly clear `retailerOverrides` when `baseCPM` changes.
    2. **Zod Schema Governance**: Introduced `PricingSchema.js` to enforce strict data types and valid multiplier ranges (0.5x - 2.0x).
    3. **Reactive Pulse**: Instrumented `CPMCalendar.jsx` to force `pricingService.init(true)` on every save operation.
- **Prevention**:
    1. **Cascading Invalidation**: Repositories must clear dependent overrides when global anchor values (like base pricing) change.
    2. **WYSIWYP Principle**: "What You See Is What You Price." All multipliers must be visible in the Super Admin UI.
    3. **Reactive Pulse**: Force `init(true)` on all service singletons after state-changing API operations.

## [2026-01-12] - CMP Pricing Resilience Hardening
### Fixed
- **Retailer Override Sync**: Hardened `PricingRepository` with explicit `clearOverridesOnBaseCPMChange` logic to eliminate "ghost" prices.
- **Hidden Multiplier Removal**: Stripped legacy `storeTrafficMultiplier` from the pricing engine; implemented explicit calculation logging for 100% transparency.
- **Frontend State Pulse**: Refactored `CPMCalendar` to force `PricingService` re-initialization on every save (Base CPM, Tiers, Overrides).

### Added
- **Governance Workflows**: 
    - `/schema`: Automated Zod validation for pricing configuration.
    - `/parity`: Environment audit tool to detect drift between local and cloud.
- **SRE Tooling**: Created `scripts/verify_schema.js` and `scripts/parity_audit.js` for CI/CD and manual audits.
- **SRE Incident Report**: Finalized `incidents/2026-01-12-cmp-cloud-discrepancy.md`.

---
*Note: This file is a permanent project record. Do not delete or purge entries.*
