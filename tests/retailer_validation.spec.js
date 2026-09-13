/**
 * Retailer Validation E2E Tests
 * Tests for Sprint 3: Retailer Schedule Validation Workflow
 * Business Hours: 8am - 10pm (14 loops)
 */

const { test, expect } = require('./base.fixtures');

test.describe('Retailer Validation - Sprint 3', () => {
    test.beforeEach(async ({ retailerPage: page }) => {
        // Mock the loops API with pending loops
        await page.route('**/api/loops**', route => {
            const url = route.request().url();

            if (url.includes('date=')) {
                // Mock loop list by date
                const loops = [];
                for (let hour = 8; hour < 22; hour++) {
                    loops.push({
                        id: `2026-01-03_${hour}_loc_downtown`,
                        date: '2026-01-03',
                        hour,
                        retailer_id: 'ret_demo',
                        status: hour < 12 ? 'APPROVED' : 'PENDING_APPROVAL',
                        slots: Array.from({ length: 12 }, (_, i) => ({
                            position: i,
                            asset_id: `mock_asset_${i}`,
                            asset_name: `Mock Asset ${i}`,
                            asset_thumbnail: '📦',
                            duration: 5,
                            status: 'PENDING'
                        }))
                    });
                }
                route.fulfill({
                    status: 200,
                    json: { loops, business_hours: { start: 8, end: 22 } }
                });
            } else if (url.includes('/approve')) {
                // Mock loop approval
                route.fulfill({
                    status: 200,
                    json: { status: 'APPROVED' }
                });
            } else if (url.includes('/reject')) {
                // Mock slot rejection
                const slots = Array.from({ length: 12 }, (_, i) => ({
                    position: i,
                    asset_id: `mock_asset_${i}`,
                    status: i === 3 ? 'REJECTED' : 'PENDING',
                    rejection_reason: i === 3 ? 'competitor' : null
                }));
                route.fulfill({
                    status: 200,
                    json: { id: 'test_loop', slots }
                });
            } else if (url.includes('/replace')) {
                // Mock slot replacement
                const slots = Array.from({ length: 12 }, (_, i) => ({
                    position: i,
                    asset_id: i === 3 ? 'replace_001' : `mock_asset_${i}`,
                    status: i === 3 ? 'REPLACED' : 'PENDING'
                }));
                route.fulfill({
                    status: 200,
                    json: { id: 'test_loop', slots }
                });
            } else if (route.request().url().match(/\/api\/loops\/[^/]+$/)) {
                // Mock single loop fetch
                route.fulfill({
                    status: 200,
                    json: {
                        id: '2026-01-03_14_loc_downtown',
                        date: '2026-01-03',
                        hour: 14,
                        status: 'PENDING_APPROVAL',
                        slots: Array.from({ length: 12 }, (_, i) => ({
                            position: i,
                            asset_id: `mock_asset_${i}`,
                            asset_name: `Mock Asset ${i}`,
                            asset_thumbnail: '📦',
                            duration: 5,
                            status: 'PENDING'
                        }))
                      }
                  });
            } else {
                route.continue();
            }
        });

        await page.route('**/api/stores', route => route.fulfill({
            status: 200,
            json: [{ id: 'store_demo', name: 'Demo Store', retailer_id: 'ret_demo', time_zone: 'America/Toronto' }],
        }));
        await page.route('**/api/loops/review/**', route => {
            const loops = [];
            for (let hour = 8; hour < 22; hour++) {
                loops.push({
                    id: `2026-01-03_${hour}_loc_downtown`,
                    date: '2026-01-03',
                    hour,
                    retailer_id: 'ret_demo',
                    store_id: 'store_demo',
                    status: hour < 12 ? 'approved' : 'pending_approval',
                    slots: Array.from({ length: 12 }, (_, i) => ({
                        position: i,
                        asset_id: `mock_asset_${i}`,
                        asset_name: `Mock Asset ${i}`,
                        asset_thumbnail: '📦',
                        duration: 5,
                        status: 'pending',
                    })),
                });
            }
            route.fulfill({
                status: 200,
                json: {
                    store: { id: 'store_demo', name: 'Demo Store', time_zone: 'America/Toronto' },
                    approval_window: {
                        state: 'open',
                        effective_deadline: '2030-01-02T23:00:00.000Z',
                        normal_deadline: '2030-01-02T23:00:00.000Z',
                        first_broadcast: '2030-01-03T13:00:00.000Z',
                    },
                    loops,
                },
            });
        });
    });

    test('Retailer sees Schedule Calendar', async ({ retailerPage: page }) => {
        
        
        
        await page.goto('/dashboard/retailer/schedule');
        await expect(page.getByRole('heading', { name: "Tomorrow's Broadcast Schedule" })).toBeVisible();
    });

    test('Retailer sees 14-hour timeline', async ({ retailerPage: page }) => {
        await page.goto('/dashboard/retailer/schedule');

        await expect(page.locator('[data-testid="schedule-timeline"]')).toBeVisible();

        // Check for business hours
        await expect(page.locator('[data-testid="schedule-hour-8"]')).toBeVisible();
        await expect(page.locator('[data-testid="schedule-hour-14"]')).toBeVisible();
        await expect(page.locator('[data-testid="schedule-hour-21"]')).toBeVisible();
    });

    test('Retailer can click hour to preview loop', async ({ retailerPage: page }) => {
        await page.goto('/dashboard/retailer/schedule');

        // Click on 2pm slot
        await page.locator('[data-testid="schedule-hour-14"]').click();

        // Modal should open
        await expect(page.getByText('2:00 PM — Loop Preview')).toBeVisible();
    });

    test('Retailer sees 12 slots in preview modal', async ({ retailerPage: page }) => {
        await page.goto('/dashboard/retailer/schedule');

        await page.locator('[data-testid="schedule-hour-14"]').click();

        // Should show 12 slots
        await expect(page.locator('[data-testid="loop-slots"]')).toBeVisible();
        await expect(page.locator('[data-testid="preview-slot-0"]')).toBeVisible();
        await expect(page.locator('[data-testid="preview-slot-11"]')).toBeVisible();
    });

    test('Retailer can reject a slot', async ({ retailerPage: page }) => {
        await page.goto('/dashboard/retailer/schedule');

        await page.locator('[data-testid="schedule-hour-14"]').click();
        await expect(page.getByText('Loop Preview')).toBeVisible();

        // Click reject on slot 4
        await page.locator('[data-testid="reject-btn-3"]').click();

        // Rejection modal should appear
        await expect(page.getByText('Reject Slot 4')).toBeVisible();
        await expect(page.locator('[data-testid="rejection-reason-select"]')).toBeVisible();
    });

    test('Retailer must select reason before rejecting', async ({ retailerPage: page }) => {
        await page.goto('/dashboard/retailer/schedule');

        await page.locator('[data-testid="schedule-hour-14"]').click();
        await page.locator('[data-testid="reject-btn-3"]').click();

        // Select a reason
        await page.locator('[data-testid="rejection-reason-select"]').selectOption('competitor');

        // Confirm reject
        await page.locator('[data-testid="confirm-reject-btn"]').click();

        await expect(page.getByText('Replacement requested from Admin')).toBeVisible();
    });

    test('Retailer cannot select an Admin-owned replacement', async ({ retailerPage: page }) => {
        await page.goto('/dashboard/retailer/schedule');

        await page.locator('[data-testid="schedule-hour-14"]').click();
        await page.locator('[data-testid="reject-btn-3"]').click();
        await page.locator('[data-testid="rejection-reason-select"]').selectOption('competitor');
        await page.locator('[data-testid="confirm-reject-btn"]').click();

        await expect(page.getByText('Replacement requested from Admin')).toBeVisible();
        await expect(page.locator('[data-testid="replacement-picker"]')).toHaveCount(0);
    });

    test('Retailer can approve all pending loops', async ({ retailerPage: page }) => {
        await page.goto('/dashboard/retailer/schedule');

        // Click approve all button
        await expect(page.locator('[data-testid="approve-all-btn"]')).toBeVisible();
        await page.locator('[data-testid="approve-all-btn"]').click();

        // Button should show loading
        await expect(page.getByText('Approving...')).toBeVisible();
    });

    test('Retailer can approve single loop from preview', async ({ retailerPage: page }) => {
        await page.goto('/dashboard/retailer/schedule');

        await page.locator('[data-testid="schedule-hour-14"]').click();

        // Approve button should be visible
        await expect(page.locator('[data-testid="approve-loop-btn"]')).toBeVisible();
    });
});
