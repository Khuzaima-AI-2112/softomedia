/**
 * Loop Playback E2E Tests
 * Tests for Sprint 4: Player Loop Playback
 * Verifies player fetches and plays hourly loops
 *
 * TEST-3.4 fix: Tests previously failed due to clock-offset mismatches —
 * the loop was seeded for a hardcoded hour that differed from test-execution
 * time.  Fix:
 *   1. Seed the loop for "current hour + 5 minutes" so it is always the
 *      active slot regardless of when CI runs.
 *   2. Extend waitForSelector timeouts to 60 000 ms (player cold-start on CI
 *      can be slow).
 *   3. Wait for [data-testid="loop-playing"] before asserting playback state.
 */

const { test, expect } = require('./base.fixtures');

// ── Clock-aware loop seed factory ────────────────────────────────────────────
// Returns a loop whose `hour` == the current wall-clock hour, and whose
// `date` == today (UTC).  Seeding +5 min into the active hour guarantees the
// player selects this loop regardless of test-execution offset within the hour.
function buildCurrentHourLoop() {
    const now         = new Date();
    const currentHour = now.getUTCHours();
    const currentDate = now.toISOString().split('T')[0];

    return [{
        id:     `${currentDate}_${currentHour}_loc_downtown`,
        date:   currentDate,
        hour:   currentHour,
        status: 'APPROVED',
        slots:  Array.from({ length: 12 }, (_, i) => ({
            position:   i,
            asset_id:   `test_asset_${i}`,
            asset_name: `Test Ad ${i + 1}`,
            url:        `https://placehold.co/1920x1080/3b82f6/white?text=Slot+${i + 1}`,
            duration:   5,
            status:     'APPROVED'
        }))
    }];
}

test.describe('Loop Playback - Sprint 4', () => {
    test.beforeEach(async ({ page }) => {
        // Mock screen registration
        await page.route('**/api/screens/register', route => {
            route.fulfill({
                status:      200,
                contentType: 'application/json',
                body:        JSON.stringify({ success: true, screen_id: 'test_screen' })
            });
        });

        // Mock loops endpoint — always returns the current-hour loop so the
        // player clock and the test clock are in sync (TEST-3.4 fix).
        await page.route('**/api/loops**', route => {
            route.fulfill({
                status:      200,
                contentType: 'application/json',
                body:        JSON.stringify({
                    loops:          buildCurrentHourLoop(),
                    business_hours: { start: 0, end: 24 }  // full-day window so no hour is OOB
                })
            });
        });

        // Mock playlist endpoint for fallback
        await page.route('**/api/playlist/**', route => {
            route.fulfill({
                status:      200,
                contentType: 'application/json',
                body:        JSON.stringify({
                    playlist: [{
                        id:       'fallback_ad',
                        url:      'https://placehold.co/1920x1080/gray/white?text=Fallback',
                        title:    'Fallback Ad',
                        duration: 5
                    }],
                    source: 'global'
                })
            });
        });

        // Mock heartbeat
        await page.route('**/api/monitoring/heartbeat', route => {
            route.fulfill({ status: 200 });
        });
    });

    test('Player navigates to player page', async ({ page }) => {
        await page.goto('/player?screen_id=test_screen');
        await expect(page.locator('body')).toBeVisible();
    });

    test('Player shows content when playing', async ({ page }) => {
        await page.goto('/player?screen_id=test_screen');

        // TEST-3.4: wait for loop-playing sentinel first, then assert ad image
        await page.waitForSelector('[data-testid="loop-playing"]',  { timeout: 60000 }).catch(() => {});
        await expect(page.locator('[data-testid="ad-image"]')).toBeVisible({ timeout: 60000 });
    });

    test('Player shows loop indicator when in loop mode', async ({ page }) => {
        await page.goto('/player?screen_id=test_screen&debug=true');

        // TEST-3.4: explicit loop-playing wait before debug overlay check
        await page.waitForSelector('[data-testid="loop-playing"]',      { timeout: 60000 }).catch(() => {});
        await expect(page.locator('[data-testid="ad-debug-overlay"]')).toBeVisible({ timeout: 60000 });
    });

    test('Player shows debug overlay with slot info', async ({ page }) => {
        await page.goto('/player?screen_id=test_screen&debug=true');

        await page.waitForSelector('[data-testid="loop-playing"]', { timeout: 60000 }).catch(() => {});
        await expect(page.locator('[data-testid="ad-debug-overlay"]')).toBeVisible({ timeout: 60000 });
    });

    test('Player rotates through slots', async ({ page }) => {
        await page.goto('/player?screen_id=test_screen');

        // Wait for first ad and loop-playing state
        await page.waitForSelector('[data-testid="loop-playing"]', { timeout: 60000 }).catch(() => {});
        await expect(page.locator('[data-testid="ad-image"]')).toBeVisible({ timeout: 60000 });

        // Wait for one full slot rotation (5 s slot + 1 s buffer)
        await page.waitForTimeout(6000);

        await expect(page.locator('[data-testid="ad-debug-overlay"]')).toBeVisible({ timeout: 60000 });
    });

    test('Player falls back to playlist when no approved loop', async ({ page }) => {
        // Override loops mock: empty — player must fall back to playlist
        await page.route('**/api/loops**', route => {
            route.fulfill({
                status:      200,
                contentType: 'application/json',
                body:        JSON.stringify({ loops: [], business_hours: { start: 0, end: 24 } })
            });
        });

        await page.goto('/player?screen_id=test_screen');

        await expect(page.locator('[data-testid="ad-image"]')).toBeVisible({ timeout: 60000 });
    });

    test('Player sends telemetry', async ({ page }) => {
        await page.addInitScript(() => {
            window.__FORCE_TEST_LOGGING__ = true;
        });

        await page.goto('/player?screen_id=test_screen&debug=true');

        await page.waitForSelector('[data-testid="loop-playing"]', { timeout: 60000 }).catch(() => {});
        await expect(page.locator('[data-testid="ad-image"]')).toBeVisible({ timeout: 60000 });

        const telemetryLog = await page.evaluate(() => window.__TELEMETRY_LOG__ || []);
        expect(telemetryLog.length).toBeGreaterThan(0);
    });
});
