import { expect, test } from '@playwright/test';

test('Player emits a device heartbeat immediately and every thirty seconds', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-09-12T03:00:00.000Z') });
    let heartbeatRequests = 0;
    page.on('request', request => {
        if (request.method() === 'POST' && request.url().includes('/api/device/heartbeat')) {
            heartbeatRequests += 1;
        }
    });

    await page.goto('/player?screen_id=controlled-clock-screen#key=controlled-clock-device-key');
    await expect.poll(() => heartbeatRequests).toBeGreaterThanOrEqual(1);

    await page.clock.fastForward(30_000);
    await expect.poll(() => heartbeatRequests).toBeGreaterThanOrEqual(2);

    await page.clock.fastForward(30_000);
    await expect.poll(() => heartbeatRequests).toBeGreaterThanOrEqual(3);
});
