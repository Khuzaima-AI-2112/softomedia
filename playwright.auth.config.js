import { defineConfig, devices } from '@playwright/test';

const repoRoot = __dirname;

export default defineConfig({
    testDir: `${repoRoot}/tests`,
    testMatch: 'firebase_auth.spec.js',
    fullyParallel: false,
    workers: 1,
    timeout: 60_000,
    reporter: 'list',
    use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:5173',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    webServer: [
        {
            command: 'npm start',
            cwd: `${repoRoot}/ad-server`,
            url: 'http://127.0.0.1:8081/health',
            reuseExistingServer: false,
            timeout: 120_000,
            env: {
                NODE_ENV: 'development',
                PORT: '8081',
                CORS_ORIGINS: 'http://127.0.0.1:5173',
                FIREBASE_PROJECT_ID: 'softomedia-demo',
            },
        },
        {
            command: 'npm run dev -- --host=127.0.0.1',
            cwd: `${repoRoot}/client-app`,
            url: 'http://127.0.0.1:5173',
            reuseExistingServer: false,
            timeout: 120_000,
            env: {
                VITE_API_URL: 'http://127.0.0.1:8081',
                VITE_FIREBASE_API_KEY: 'demo-api-key',
                VITE_FIREBASE_AUTH_DOMAIN: 'softomedia-demo.firebaseapp.com',
                VITE_FIREBASE_PROJECT_ID: 'softomedia-demo',
                VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
            },
        },
    ],
});
