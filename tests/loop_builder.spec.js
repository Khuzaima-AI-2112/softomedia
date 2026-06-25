/**
 * Loop Builder E2E Tests
 * Tests for Sprint 2: Admin Loop Management UI
 * Business Hours: 8am - 10pm (14 loops)
 */

const { test, expect } = require('./base.fixtures');

test.describe('Loop Management - Sprint 2', () => {
    test.beforeEach(async ({ adminPage: page }) => {
        // Mock the loops API
        await page.route('**/api/loops**', route => {
            const url = route.request().url();

            if (url.includes('/generate') && route.request().method() === 'POST') {
                // Mock loop generation
                const loops = [];
                for (let hour = 8; hour < 22; hour++) {
                    loops.push({
                        id: `2026-01-03_${hour}_loc_downtown`,
                        date: '2026-01-03',
                        hour,
                        retailer_id: 'ret_demo',
                        location_id: 'loc_downtown',
                        status: 'pending_approval',
                        slots: Array.from({ length: 12 }, (_, i) => ({
                            position: i,
                            asset_id: `mock_asset_${i}`,
                            duration: 5,
                            status: 'pending'
                        }))
                    });
                }
                route.fulfill({
                    status: 201,
                    contentType: 'application/json',
                    body: JSON.stringify( Object.assign({},  { message: 'Generated 14 loops', loops } ) )
                });
            } else if (url.includes('date=')) {
                // Mock loop list by date
                const loops = [];
                for (let hour = 8; hour < 22; hour++) {
                    loops.push({
                        id: `2026-01-03_${hour}_loc_downtown`,
                        date: '2026-01-03',
                        hour,
                        status: 'pending_approval',
                        slots: Array.from({ length: 12 }, (_, i) => ({
                            position: i,
                            asset_id: `mock_asset_${i}`,
                            duration: 5,
                            status: 'pending'
                        }))
                    });
                }
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(loops)
                });
            } else if (route.request().url().match(/\/api\/loops\/[^/]+$/)) {
                // Mock single loop fetch
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify( Object.assign({},  {
                        id: '2026-01-03_14_loc_downtown',
                        date: '2026-01-03',
                        hour: 14,
                        status: 'pending_approval',
                        slots: Array.from({ length: 12 }, (_, i) => ({
                            position: i,
                            asset_id: i < 8 ? `mock_asset_${i}` : null,
                            asset_name: i < 8 ? `Mock Asset ${i}` : null,
                            asset_thumbnail: i < 8 ? '📦' : null,
                            duration: 5,
                            status: 'pending'
                        }))
                      }))
                  });
            } else if (url.includes('/api/assets')) {
                // Mock assets for picker
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([
                        { id: 'asset_001', name: 'Mock Asset 1', type: 'image', thumbnail: '📦' },
                        { id: 'asset_002', name: 'Mock Asset 2', type: 'video', thumbnail: '🎬' }
                    ])
                });
            } else {
                route.continue();
            }
        });
    });

    test('Admin can navigate to Loop Management', async ({ adminPage: page }) => {
        await page.goto('/dashboard/admin/loops');
        await expect(page.getByText('Loop Management')).toBeVisible();
        await expect(page.getByText('8AM - 10PM')).toBeVisible();
    });

    test('Admin can see 14-hour grid', async ({ adminPage: page }) => {
        await page.goto('/dashboard/admin/loops');

        // Wait for grid to load
        await expect(page.locator('[data-testid="loop-grid"]')).toBeVisible();

        // Check for business hours (8am to 9pm = 14 slots)
        await expect(page.locator('[data-testid="loop-hour-8"]')).toBeVisible();
        await expect(page.locator('[data-testid="loop-hour-14"]')).toBeVisible();
        await expect(page.locator('[data-testid="loop-hour-21"]')).toBeVisible();
    });

    test('Admin can generate loops for a date', async ({ adminPage: page }) => {
        await page.goto('/dashboard/admin/loops');

        // Click generate button
        await page.locator('[data-testid="generate-loops-btn"]').click();

        // Should show loops in grid
        await expect(page.getByText('12 slots filled').first()).toBeVisible({ timeout: 5000 });
    });

    test('Admin can click hour to open Loop Builder', async ({ adminPage: page }) => {
        await page.goto('/dashboard/admin/loops');

        // Wait for loops to load
        await expect(page.locator('[data-testid="loop-grid"]')).toBeVisible();

        // Click on 2pm slot
        await page.locator('[data-testid="loop-hour-14"]').click();

        // Should navigate to loop builder
        await expect(page).toHaveURL(/.*admin\/loops\/.*/);
        await expect(page.getByText('Loop Builder')).toBeVisible();
    });

    test('Loop Builder shows 12 slots', async ({ adminPage: page }) => {
        await page.goto('/dashboard/admin/loops/2026-01-03_14_loc_downtown');

        // Wait for slot grid
        await expect(page.locator('[data-testid="slot-grid"]')).toBeVisible();

        // Should have 12 slots
        for (let i = 0; i < 12; i++) {
            await expect(page.locator(`[data-testid="slot-${i}"]`)).toBeVisible();
        }
    });

    test.fixme('Loop Builder shows timeline preview', async ({ adminPage: page }) => {
        await page.goto('/dashboard/admin/loops/2026-01-03_14_loc_downtown');

        await expect(page.getByText('Timeline Preview (60 seconds)')).toBeVisible();
        await expect(page.getByText('0s')).toBeVisible();
        await expect(page.getByText('60s')).toBeVisible();
    });

    test('Admin can click slot to open asset picker', async ({ adminPage: page }) => {
        await page.goto('/dashboard/admin/loops/2026-01-03_14_loc_downtown');

        // Click on first slot
        await page.locator('[data-testid="slot-0"]').click();

        // Asset picker modal should appear
        await expect(page.getByText('Select Asset for Slot 1')).toBeVisible();
    });

    test('Admin can select asset for slot', async ({ adminPage: page }) => {
        await page.goto('/dashboard/admin/loops/2026-01-03_14_loc_downtown');

        // Click on empty slot (slot 10)
        await page.locator('[data-testid="slot-10"]').click();

        // Select an asset
        await page.locator('[data-testid="asset-asset_001"]').click();

        // Modal should close
        await expect(page.getByText('Select Asset for Slot')).not.toBeVisible();
    });
});
