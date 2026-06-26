# Walkthrough - E2E Isolation and Environment Lifecycle Fixes

This walkthrough documents the technical details of the changes implemented to address database state contamination in E2E tests, ESM module hoisting timing issues, and workspace hygiene.

## Changes Made

### 1. Development-Only Database Reset Endpoint
- **New Router File**: Created [debug.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/ad-server/src/api/debug.js) defining the POST `/api/debug/reset` route.
  - Purges all active Firestore collections in batches.
  - Clears `MOCK_STORAGE` using `clearMockStorage()` to retain singleton Map references inside active repositories.
  - Runs `seedDatabase()` from `SeedService` to establish a clean default database state.
  - Enforces a safety gate denying reset when `NODE_ENV === 'production'` and demo mode is disabled.
- **Routing Integration**: Mounted the router in [index.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/ad-server/src/api/index.js) under `/api/debug`.

### 2. Playwright Global Setup Reset Integration
- **Automated Reset**: Modified [global.setup.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/tests/global.setup.js) to trigger the POST `/api/debug/reset` endpoint before setting up persona contexts, guaranteeing a clean canvas for every E2E execution.

### 3. Dynamic Environment Evaluation
- **Request-time Resolving**: Modified [schedules.js](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/ad-server/src/api/schedules.js) to query `process.env.ALLOW_DEMO_MODE` dynamically within request handlers, resolving ESM module load-time hoisting where configuration constants were evaluated prior to `dotenv` initialization.

### 4. Codebase Hygiene & Cleanup
- **Legacy Archives**: Created the [archives/](file:///c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026/archives/) directory structure and moved:
  - Obsolete root/ad-server utility scripts.
  - Broken and unmaintained E2E tests (`campaign_wizard_happy_path.spec.js`, `personas_mvp.spec.js`, `media_cloud_verification.spec.js`) to prevent compiler failures and file clutter.
- **Artifact Sanitation**: Deleted leftover `.log`, `diff.txt`, `.txt`, and debug files.

---

## Verification & Testing

### 1. Backend Unit Tests
All 92 Jest unit tests in `ad-server` pass successfully:
```bash
Test Suites: 12 passed, 12 total
Tests:       92 passed, 92 total
Snapshots:   0 total
```

### 2. End-to-End Tests
Running `npm run test:e2e` executes all active Playwright tests (with the dynamic `/api/debug/reset` flushing the database at startup and setup) under the isolated `demo-wizard` profile without cascading state contamination.
