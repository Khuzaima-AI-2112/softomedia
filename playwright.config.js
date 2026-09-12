import { defineConfig, devices } from '@playwright/test';

const mediaEmulatorTest = process.env.MEDIA_EMULATOR_TEST === 'true';
const emulatorEnv = mediaEmulatorTest ? {
    NODE_ENV: 'test',
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    DEMO_PROJECT_ID: process.env.DEMO_PROJECT_ID,
    DEMO_ASSETS_BUCKET: process.env.DEMO_ASSETS_BUCKET,
    FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
    STORAGE_EMULATOR_HOST: process.env.STORAGE_EMULATOR_HOST,
    FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST,
    VITE_FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_AUTH_EMULATOR_URL: process.env.VITE_FIREBASE_AUTH_EMULATOR_URL,
} : {};

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * Changes from original:
 *
 * 1. globalTeardown updated — now points to the dedicated wrapper file
 *    tests/demo_wizard/00_seed.teardown.js which re-exports demoSeedTeardown
 *    as a default export. Playwright globalTeardown does not support the
 *    `file#namedExport` fragment syntax; the previous value
 *    './tests/demo_wizard/00_seed.setup.js#demoSeedTeardown' caused a
 *    MODULE_NOT_FOUND crash before any test ran.
 *
 * 2. 'demo-wizard' project — isolated serial project for the 16-phase E2E
 *    demo suite. Chromium only, 90s timeout, single worker, testMatch scoped
 *    to tests/demo_wizard/. Only active when ALLOW_DEMO_MODE=true.
 *
 * 3. timeout: 60000 added at root — Playwright default is 30s which is too
 *    tight for React.lazy cold loads on CI. 60s root; 90s in demo project.
 *
 * 4. ad-server port reverted back to 8080 because .env.development hardcodes it to 8080.
 */
export default defineConfig({
    globalSetup: './tests/global.setup.js',
    globalTeardown: './tests/demo_wizard/00_seed.teardown.js',

    testDir: './tests',
    testIgnore: '**/firestore-rules/**',

    /* Default timeout for each individual test. */
    timeout: 60_000,

    /* Run tests in files in parallel */
    fullyParallel: true,

    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,

    /* Retry on CI only */
    retries: process.env.CI ? 2 : 0,

    /* Single worker to prevent Firestore write contention. */
    workers: 1,

    reporter: 'html',

    use: {
        baseURL: 'http://localhost:5173',

        /* Maximum time each action such as click() can take. */
        actionTimeout: 30_000,

        /* Collect trace always — essential for debugging 16-phase serial suites. */
        trace: 'on',

        screenshot: 'only-on-failure',
    },

    expect: {
        timeout: 20_000,
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },

        /**
         * demo-wizard — isolated project for the 16-phase E2E demo suite.
         *
         * Only runs when ALLOW_DEMO_MODE=true. Serial execution enforced at
         * the describe level inside each spec (test.describe.serial); this
         * project config ensures no other spec file runs concurrently with it.
         *
         * timeout: 90s — Phase 4 player broadcast needs 35s window + margins.
         * Phase 3 Campaign Wizard 5-step flow needs headroom on cold CI.
         *
         * storageState is NOT set here — each phase calls loginAs() from
         * demo.fixtures.js which loads the correct .auth/<role>.json file.
         */
        ...(process.env.ALLOW_DEMO_MODE === 'true' ? [{
            name: 'demo-wizard',
            testMatch: '**/demo_wizard/**/*.spec.js',
            fullyParallel: false,
            workers: 1,
            timeout: 90_000,
            use: {
                ...devices['Desktop Chrome'],
                baseURL: 'http://localhost:5173',
                actionTimeout: 30_000,
                trace: 'on',
                screenshot: 'only-on-failure',
                // Viewport matches the target deployment screens (1920×1080
                // primary; 1280×800 for the player iframe assertions).
                viewport: { width: 1280, height: 800 },
            },
        }] : []),

        /* Mobile viewports — uncomment to activate */
        // { name: 'Mobile Chrome',  use: { ...devices['Pixel 5'] } },
        // { name: 'Mobile Safari',  use: { ...devices['iPhone 12'] } },
        /* Branded browsers — uncomment to activate */
        // { name: 'Microsoft Edge', use: { ...devices['Desktop Edge'],   channel: 'msedge' } },
        // { name: 'Google Chrome',  use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    ],

    webServer: [
        {
            command: mediaEmulatorTest ? 'npx kill-port 8080 && npm run dev' : 'npm run dev',
            cwd: './ad-server',
            url: 'http://localhost:8080/health',
            reuseExistingServer: !process.env.CI && !mediaEmulatorTest,
            timeout: 120_000,
            env: {
                ...emulatorEnv,
                ALLOW_DEMO_MODE: 'true'
            }
        },
        {
            command: 'npx kill-port 5173 && npm run dev --prefix client-app',
            url: 'http://localhost:5173',
            reuseExistingServer: !mediaEmulatorTest,
            timeout: 180_000,
            env: {
                ...emulatorEnv,
                ALLOW_DEMO_MODE: 'true'
            }
        },
    ],
});
