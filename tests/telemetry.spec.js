import { test, expect } from '@playwright/test';

/**
 * Softomedia MVP - Telemetry & Player Tests
 * Validates real-time heartbeats and Proof-of-Play logging.
 */

test.describe('Softomedia MVP: Player Telemetry', () => {
    test.beforeEach(async ({ page }) => {
        // SRE Fix: Standard mocks for Player state machine
        await page.route('**/api/screens/register', async route => {
            await route.fulfill({
                status: 200,
                json: { id: 'test-screen', status: 'ACTIVE' }
            });
        });

        await page.route('**/api/loops?date=**', async route => {
            await route.fulfill({
                status: 200,
                json: {
                    loops: [{
                        hour: 10,
                        status: 'APPROVED',
                        slots: Array(12).fill({
                            asset_id: 'mock-asset',
                            asset_url: 'https://placehold.co/600x400?text=Mock+Ad',
                            duration: 5
                        })
                    }]
                  }
              });
        });

        // Mock Date to 10 AM
        await page.addInitScript(() => {
            const mockDate = new Date('2026-01-02T10:00:00');
            const OriginalDate = window.Date;
            class MockDate extends OriginalDate {
                constructor(...args) {
                    if (args.length > 0) return new OriginalDate(...args);
                    return mockDate;
                }
                static now() { return mockDate.getTime(); }
            }
            window.Date = MockDate;
        });
    });

    test.skip('Player emits Heartbeat and Impression events', async ({ page, request }) => {
        const screenId = 'e2e-telemetry-screen'; // SRE: Deterministic Identity

        // 1. Login & Provision Screen (Deterministic Setup)
        const loginRes = await request.post('http://localhost:8080/api/auth/login', {
            data: { email: 'admin@softomedia.com' }
        });
        expect(loginRes.ok()).toBeTruthy();
        const token = (await loginRes.json()).token;

        await request.post('http://localhost:8080/api/screens/register', {
            headers: { 'Authorization': `Bearer ${token}` },
            data: {
                screen_id: screenId,
                resolution: '1920x1080',
                user_agent: 'Playwright E2E'
            }
        });

        // 2. Launch Player (No network mocks needed for telemetry validation now)
        // Add debug=true to enable internal logging buffer
        await page.goto(`/player?screen_id=${screenId}&debug=true`);

        // 3. White-Box Assertion (SRE Pattern)
        // Wait for the application to push logs to our exposed buffer
        await expect.poll(async () => {
            return await page.evaluate(() => window.__TELEMETRY_LOG__);
        }, { timeout: 10000 }).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ type: 'HEARTBEAT' }),
                // We also expect the queueing event from TelemetryService
                expect.objectContaining({ type: 'IMPRESSION_QUEUED' })
            ])
        );

        // Verify specific payload integrity
        const logs = await page.evaluate(() => window.__TELEMETRY_LOG__);
        const heartbeat = logs.find(l => l.type === 'HEARTBEAT');
        expect(heartbeat.payload.screenId).toBe(screenId);

        const impression = logs.find(l => l.type === 'IMPRESSION_QUEUED');
        expect(impression.payload.campaignId).toBeDefined();

        // 4. Verify Local Storage Persistence (The "Buffer" Check)
        const buffer = await page.evaluate(() => {
            return JSON.parse(localStorage.getItem('softomedia_impression_buffer') || '[]');
        });
        expect(buffer.length).toBeGreaterThan(0);
        expect(buffer[0].screenId).toBe(screenId);
    });

    test.fixme('Player rotates content every 5 seconds', async ({ page }) => {
        await page.goto('/player?screen_id=demo-screen-01');

        // Get the title of the first ad
        const adTitle1 = await page.getByTestId('ad-debug-overlay').innerText();

        // Wait for at least 6 seconds to ensure rotation
        await page.waitForTimeout(6000);

        // Verify title has changed (or at least index shifted)
        const adTitle2 = await page.getByTestId('ad-debug-overlay').innerText();
        // This assumes the demo loop has at least 2 different ads
        // In a seeded env, this is guaranteed
    });

    test.fixme('Player batches and uploads impressions (Audit Trail)', async ({ page }) => {
        // 1. Launch Player
        await page.goto('/player?screen_id=e2e-batch-test&debug=true');

        // Wait for SRE hooks to initialize (Race Condition Fix)
        await page.waitForFunction(() => window.softomedia_telemetry);

        // 2. Simulate Impressions (Fake Data via SRE Hooks)
        await page.evaluate(async () => {
            // Queue 5 fake impressions
            for (let i = 0; i < 5; i++) {
                window.softomedia_telemetry.trackImpression({
                    screenId: 'e2e-batch-test',
                    campaignId: `camp-${i}`,
                    mediaId: `media-${i}`,
                    duration: 5
                });
            }
        });

        // 3. Verify Buffer state
        const bufferSize = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('softomedia_impression_buffer')).length
        );
        expect(bufferSize).toBe(5);

        // 4. Force Upload (Trigger the "Drop-off")
        await page.evaluate(async () => {
            await window.softomedia_telemetry.forceUpload();
        });

        // 5. Verify Successful Upload (Buffer cleared + Log event)
        await expect.poll(async () => {
            return await page.evaluate(() => window.__TELEMETRY_LOG__);
        }, { timeout: 10000 }).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ type: 'BATCH_UPLOAD_SUCCESS', count: 5 })
            ])
        );

        const finalBufferSize = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('softomedia_impression_buffer')).length
        );
        expect(finalBufferSize).toBe(0);
    });
});
