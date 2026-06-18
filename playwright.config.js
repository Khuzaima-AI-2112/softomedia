import { defineConfig, devices } from '@playwright/test';

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
 * 4. ad-server port corrected: 8080 → 3001 to match API_BASE_URL convention
 *    used throughout the codebase and in 00_seed.setup.js seedViaApi calls.
 */
export default defineConfig({
    globalSetup:    './tests/global.setup.js',
    globalTeardown: './tests/demo_wizard/00_seed.teardown.js',

    testDir: './tests',

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
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
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
                baseURL:       'http://localhost:5173',
                actionTimeout: 30_000,
                trace:         'on',
                screenshot:    'only-on-failure',
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
            /* Port corrected: 8080 → 3001 to match API_BASE_URL convention. */
            command:              'npx kill-port 3001 && npm start --prefix ad-server',
            url:                  'http://localhost:3001/health',
            reuseExistingServer:  true,
            timeout:              180_000,
        },
        {
            command:              'npx kill-port 5173 && npm run dev --prefix client-app',
            url:                  'http://localhost:5173',
            reuseExistingServer:  true,
            timeout:              180_000,
        },
    ],
});
