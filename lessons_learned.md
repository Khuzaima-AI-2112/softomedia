# Lessons Learned

Objectives: Document errors, bugs, and mistakes so we do not make them again.

## Development Lessons

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

---
*Note: This file is a permanent project record. Do not delete or purge entries.*
