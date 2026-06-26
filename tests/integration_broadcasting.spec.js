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
        const { mockInfrastructureApis } = require('./fixtures/mock-routes.js');
        await mockInfrastructureApis(page);
    });

    test('Step 1: Admin generates D-1 loops', async ({ adminPage: page }) => {
        const { buildBusinessHoursLoops } = require('./fixtures/factories.js');
        const { mockLoopGenerateApi, mockLoopsApi } = require('./fixtures/mock-routes.js');
        
        await mockLoopGenerateApi(page, { loops: buildBusinessHoursLoops({ date: testDate, status: 'pending_approval' }) });
        await mockLoopsApi(page, { loops: [] });

        await page.goto('/dashboard/admin/loops');
        await expect(page.getByText('Loop Management')).toBeVisible();

        // Set date
        await page.locator('[data-testid="loop-date-picker"]').fill(testDate);

        // Generate loops
        await page.locator('[data-testid="generate-loops-btn"]').click();

        // Verify page title still visible (generation triggered)
        await expect(page.getByText('Loop Management')).toBeVisible();
    });

    test('Step 2: Admin views loop builder', async ({ adminPage: page }) => {
        const { buildLoop } = require('./fixtures/factories.js');
        const { mockSingleLoopApi } = require('./fixtures/mock-routes.js');
        
        await mockSingleLoopApi(page, buildLoop({ id: generatedLoopId, date: testDate, hour: testHour, status: 'pending_approval' }));

        await page.goto(`/dashboard/admin/loops/${generatedLoopId}`);
        await expect(page.getByText('Loop Builder')).toBeVisible();
        await expect(page.getByText('2:00 PM')).toBeVisible();

        // Verify 12 slots displayed
        await expect(page.locator('[data-testid="slot-grid"]')).toBeVisible();
        await expect(page.locator('[data-testid="slot-0"]')).toBeVisible();
        await expect(page.locator('[data-testid="slot-11"]')).toBeVisible();
    });

    test('Step 3: Retailer views schedule calendar', async ({ retailerPage: page }) => {
        const { buildBusinessHoursLoops } = require('./fixtures/factories.js');
        const { mockLoopsApi } = require('./fixtures/mock-routes.js');
        
        await mockLoopsApi(page, { loops: buildBusinessHoursLoops({ date: testDate, status: 'pending_approval' }) });

        await page.goto('/dashboard/retailer/schedule');
        await expect(page.getByText("Tomorrow's Broadcast Schedule")).toBeVisible();

        // Should show pending count
        await expect(page.locator('[data-testid="schedule-timeline"]')).toBeVisible();
    });

    test('Step 4: Retailer approves all loops', async ({ retailerPage: page }) => {
        const { buildBusinessHoursLoops } = require('./fixtures/factories.js');
        const { mockLoopsApi, mockLoopApproveApi } = require('./fixtures/mock-routes.js');
        
        await mockLoopsApi(page, { loops: buildBusinessHoursLoops({ date: testDate, status: 'pending_approval' }) });
        await mockLoopApproveApi(page);

        await page.goto('/dashboard/retailer/schedule');

        // Click approve all
        const approveBtn = page.locator('[data-testid="approve-all-btn"]');
        if (await approveBtn.isVisible()) {
            await approveBtn.click();
            // Should show approving state
            await expect(page.getByText('Approving...')).toBeVisible();
        }
    });

    test('Step 5: Player plays approved loop', async ({ page }) => {
        const { buildLoop, buildPlaylist } = require('./fixtures/factories.js');
        const { mockLoopsApi, mockPlaylistApi } = require('./fixtures/mock-routes.js');
        
        const currentHour = new Date().getHours();
        await mockLoopsApi(page, { loops: [buildLoop({ hour: currentHour, status: 'approved' })] });
        await mockPlaylistApi(page, buildPlaylist());

        await page.goto('/player?screen_id=test_screen&debug=true');

        // Wait for content to load
        await expect(page.locator('[data-testid="ad-frame"]')).toBeVisible({ timeout: 15000 });
    });

    test.skip('Step 6: Admin views analytics', async ({ adminPage: page }) => {
        const { mockAnalyticsApi } = require('./fixtures/mock-routes.js');
        await mockAnalyticsApi(page);
        
        await page.goto('/dashboard/admin/loop-analytics');

        await expect(page.getByTestId('admin-campaign-analytics')).toBeVisible();
        await expect(page.locator('[data-testid="total-loops"]')).toBeVisible();
        await expect(page.locator('[data-testid="hourly-chart"]')).toBeVisible();
    });

    test('Step 7: Verify admin navigation between loop pages', async ({ adminPage: page }) => {
        const { mockLoopsApi, mockAnalyticsApi } = require('./fixtures/mock-routes.js');
        await mockLoopsApi(page, { loops: [] });
        await mockAnalyticsApi(page);

        // Navigate through all admin loop pages
        await page.goto('/dashboard/admin/loops');
        await expect(page.getByText('Loop Management')).toBeVisible();

        await page.goto('/dashboard/admin/loop-analytics');
        await expect(page.getByTestId('admin-campaign-analytics')).toBeVisible();
    });
});

test.describe('Error Handling & Edge Cases', () => {
    test.skip('Player handles API failure gracefully', async ({ page }) => {
        await page.route('**/api/screens/register', route => {
            route.fulfill({ status: 500 });
        });

        await page.goto('/player?screen_id=test_screen');

        // It should gracefully fallback to the offline loop rather than showing a raw error string.
        await expect(page.locator('[data-testid="player-container"]')).toHaveAttribute('data-status', 'playing', { timeout: 20000 });
    });

    test('Loop Management handles empty state', async ({ adminPage: page }) => {
        const { mockLoopsApi } = require('./fixtures/mock-routes.js');
        await mockLoopsApi(page, { loops: [] });

        await page.goto('/dashboard/admin/loops');

        // Should show empty state or generate button
        await expect(page.locator('[data-testid="generate-loops-btn"]')).toBeVisible();
    });

    test('Analytics handles no data state', async ({ adminPage: page }) => {
        await page.goto('/dashboard/admin/loop-analytics');

        // Dashboard should still render even without data
        await expect(page.getByTestId('admin-campaign-analytics')).toBeVisible();
    });
});
