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
 * Browser journeys sign in for real against the Firebase emulators and read
 * and write through the API without interception (tests/fixtures/demo-session.js).
 * Run them under the emulators with MEDIA_EMULATOR_TEST=true.
 */
export default defineConfig({
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

        trace: 'retain-on-failure',

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
            env: emulatorEnv,
        },
        {
            command: 'npx kill-port 5173 && npm run dev --prefix client-app',
            url: 'http://localhost:5173',
            reuseExistingServer: !mediaEmulatorTest,
            timeout: 180_000,
            env: emulatorEnv,
        },
    ],
});
