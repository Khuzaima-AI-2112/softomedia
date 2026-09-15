# Testing Protocol

**Goal**: Ensure reproducible test results by managing environment state strictly.

Tests use the real seams: backend HTTP suites sign in through the Firebase Auth
emulator (`ad-server/tests/fixtures/emulator-sign-in.js`), browser journeys sign in
through the login page (`tests/fixtures/demo-session.js`), and nothing fakes a
signed-in user or intercepts the API. `node scripts/lint-tests.js` enforces this
for browser specs.

## ⚠️ Critical Rule: "Stop the World"
Before running ANY test suite (Unit, Integration, or E2E), you **MUST** stop all running logic servers to prevent port conflicts and state pollution.

```bash
# Windows (PowerShell)
npx -y kill-port 8080 5173
```

## 1. Backend (Jest) with the Firebase emulators

```bash
firebase emulators:exec --config firebase.json --project softomedia-demo --only auth,firestore,storage \
  "npm --prefix ad-server test -- --runInBand --coverage=false"
```

Set these first: `NODE_ENV=test MEDIA_EMULATOR_TEST=true GOOGLE_CLOUD_PROJECT=softomedia-demo
FIREBASE_PROJECT_ID=softomedia-demo DEMO_PROJECT_ID=softomedia-demo
DEMO_ASSETS_BUCKET=softomedia-demo.firebasestorage.app FIRESTORE_EMULATOR_HOST=127.0.0.1:8090
STORAGE_EMULATOR_HOST=http://127.0.0.1:9199 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`.
Suites that need the emulators skip themselves without these variables.

## 2. Firestore and Storage security rules

```bash
npm run test:rules
```

## 3. E2E Regression (Frontend + Backend)
Uses Playwright to test the full user journey. The script starts the emulators and both dev servers.

```bash
npm run test:e2e
```

On a machine with little memory, run specs in batches of three or four inside
`firebase emulators:exec` with `npx playwright test <specs> --project=chromium`.

## 4. Client

```bash
cd client-app && npx vitest run && npm run lint && npm run build
```
