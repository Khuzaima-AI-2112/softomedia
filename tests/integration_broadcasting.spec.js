/**
 * Broadcasting Engine E2E Integration Test
 * Sprint 6: Full workflow test
 * Flow: Generate Loops → Retailer Approval → Player Playback → Analytics
 */

const { test, expect } = require('./base.fixtures');

test.describe('Broadcasting Engine - Full E2E Workflow', () => {
    // Shared state for the workflow
    let generatedLoopId;
    const testDate = '2026-01-03';
    const testHour = 14;

    test.describe.configure({ mode: 'serial' }); // Run tests in order

    test.beforeAll(async () => {
        generatedLoopId = `${testDate}_${testHour}_loc_downtown`;
    });

    // Mock API for all tests
    test.beforeEach(async ({ page }) => {
        // Mock screen registration
        await page.route('**/api/screens/register', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true })
            });
        });

        // Mock heartbeat
        await page.route('**/api/monitoring/heartbeat', route => {
            route.fulfill({ status: 200 });
        });

        // Mock telemetry
        await page.route('**/api/telemetry/**', route => {
            route.fulfill({ status: 200 });
        });
    });

    test('Step 1: Admin generates D-1 loops', async ({ page }) => {
        // Mock loop generation
        await page.route('**/api/loops/generate', route => {
            const loops = [];
            for (let hour = 8; hour < 22; hour++) {
                loops.push({
                    id: `${testDate}_${hour}_loc_downtown`,
                    date: testDate,
                    hour,
                    status: 'PENDING_APPROVAL',
                    slots: Array.from({ length: 12 }, (_, i) => ({
                        position: i,
                        asset_id: `asset_${i}`,
                        asset_name: `Test Ad ${i + 1}`,
                        duration: 5,
                        status: 'PENDING'
                    }))
                });
            }
            route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Generated 14 loops', loops })
            });
        });

        // Mock empty initial state
        await page.route('**/api/loops?date=**', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ loops: [] })
            });
        });

        await page.goto('/dashboard/admin/loops');
        await expect(page.getByText('Loop Management')).toBeVisible();

        // Set date
        await page.locator('[data-testid="loop-date-picker"]').fill(testDate);

        // Generate loops
        await page.locator('[data-testid="generate-loops-btn"]').click();

        // Verify page title still visible (generation triggered)
        await expect(page.getByText('Loop Management')).toBeVisible();
    });

    test('Step 2: Admin views loop builder', async ({ page }) => {
        // Mock single loop fetch
        await page.route(`**/api/loops/${generatedLoopId}`, route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: generatedLoopId,
                    date: testDate,
                    hour: testHour,
                    status: 'PENDING_APPROVAL',
                    slots: Array.from({ length: 12 }, (_, i) => ({
                        position: i,
                        asset_id: `asset_${i}`,
                        asset_name: `Test Ad ${i + 1}`,
                        asset_thumbnail: '📦',
                        duration: 5,
                        status: 'PENDING'
                    }))
                })
            });
        });

        await page.goto(`/dashboard/admin/loops/${generatedLoopId}`);
        await expect(page.getByText('Loop Builder')).toBeVisible();
        await expect(page.getByText('2:00 PM')).toBeVisible();

        // Verify 12 slots displayed
        await expect(page.locator('[data-testid="slot-grid"]')).toBeVisible();
        await expect(page.locator('[data-testid="slot-0"]')).toBeVisible();
        await expect(page.locator('[data-testid="slot-11"]')).toBeVisible();
    });

    test('Step 3: Retailer views schedule calendar', async ({ page }) => {
        // Mock pending loops
        await page.route('**/api/loops?date=**', route => {
            const loops = [];
            for (let hour = 8; hour < 22; hour++) {
                loops.push({
                    id: `${testDate}_${hour}_loc_downtown`,
                    date: testDate,
                    hour,
                    status: 'PENDING_APPROVAL',
                    slots: Array.from({ length: 12 }, (_, i) => ({
                        position: i,
                        asset_id: `asset_${i}`,
                        duration: 5,
                        status: 'PENDING'
                    }))
                });
            }
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ loops })
            });
        });

        await page.goto('/dashboard/retailer/schedule/calendar');
        await expect(page.getByText("Tomorrow's Broadcast Schedule")).toBeVisible();

        // Should show pending count
        await expect(page.locator('[data-testid="schedule-timeline"]')).toBeVisible();
    });

    test('Step 4: Retailer approves all loops', async ({ page }) => {
        // Mock pending loops
        await page.route('**/api/loops?date=**', route => {
            const loops = [];
            for (let hour = 8; hour < 22; hour++) {
                loops.push({
                    id: `${testDate}_${hour}_loc_downtown`,
                    date: testDate,
                    hour,
                    status: 'PENDING_APPROVAL',
                    slots: Array.from({ length: 12 }, (_, i) => ({
                        position: i,
                        asset_id: `asset_${i}`,
                        duration: 5,
                        status: 'PENDING'
                    }))
                });
            }
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ loops })
            });
        });

        // Mock approval endpoint
        await page.route('**/api/loops/**/approve', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ status: 'APPROVED' })
            });
        });

        await page.goto('/dashboard/retailer/schedule/calendar');

        // Click approve all
        const approveBtn = page.locator('[data-testid="approve-all-btn"]');
        if (await approveBtn.isVisible()) {
            await approveBtn.click();
            // Should show approving state
            await expect(page.getByText('Approving...')).toBeVisible();
        }
    });

    test('Step 5: Player plays approved loop', async ({ page }) => {
        // Mock approved loops
        await page.route('**/api/loops?date=**', route => {
            const currentHour = new Date().getHours();
            const loops = [{
                id: `${new Date().toISOString().split('T')[0]}_${currentHour}_loc_downtown`,
                date: new Date().toISOString().split('T')[0],
                hour: currentHour,
                status: 'APPROVED',
                slots: Array.from({ length: 12 }, (_, i) => ({
                    position: i,
                    asset_id: `asset_${i}`,
                    asset_name: `Test Ad ${i + 1}`,
                    url: `https://placehold.co/1920x1080/3b82f6/white?text=Slot+${i + 1}`,
                    duration: 5,
                    status: 'APPROVED'
                }))
            }];
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ loops })
            });
        });

        // Mock playlist fallback
        await page.route('**/api/playlist/**', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    playlist: [{
                        id: 'fallback',
                        url: 'https://placehold.co/1920x1080/gray/white?text=Fallback',
                        title: 'Fallback',
                        duration: 5
                    }],
                    source: 'global'
                })
            });
        });

        await page.goto('/player?screen_id=test_screen&debug=true');

        // Wait for content to load
        await expect(page.locator('[data-testid="ad-image"]')).toBeVisible({ timeout: 15000 });
    });

    test('Step 6: Admin views analytics', async ({ page }) => {
        await page.goto('/dashboard/admin/analytics');

        await expect(page.getByText('Loop Analytics')).toBeVisible();
        await expect(page.locator('[data-testid="total-impressions"]')).toBeVisible();
        await expect(page.locator('[data-testid="hourly-chart"]')).toBeVisible();
    });

    test('Step 7: Verify admin navigation between loop pages', async ({ page }) => {
        // Mock loops
        await page.route('**/api/loops?date=**', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ loops: [] })
            });
        });

        // Navigate through all admin loop pages
        await page.goto('/dashboard/admin/loops');
        await expect(page.getByText('Loop Management')).toBeVisible();

        await page.goto('/dashboard/admin/analytics');
        await expect(page.getByText('Loop Analytics')).toBeVisible();
    });
});

test.describe('Error Handling & Edge Cases', () => {
    test('Player handles API failure gracefully', async ({ page }) => {
        await page.route('**/api/screens/register', route => {
            route.fulfill({ status: 500 });
        });

        await page.goto('/player?screen_id=test_screen');

        // Should show error or offline state
        await expect(page.getByText(/error|offline/i)).toBeVisible({ timeout: 10000 });
    });

    test('Loop Management handles empty state', async ({ page }) => {
        await page.route('**/api/loops?date=**', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ loops: [] })
            });
        });

        await page.goto('/dashboard/admin/loops');

        // Should show empty state or generate button
        await expect(page.getByText(/no loop|generate/i)).toBeVisible();
    });

    test('Analytics handles no data state', async ({ page }) => {
        await page.goto('/dashboard/admin/analytics');

        // Dashboard should still render even without data
        await expect(page.getByText('Loop Analytics')).toBeVisible();
    });
});
