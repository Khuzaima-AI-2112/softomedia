const { test, expect } = require('./base.fixtures');

test.describe('Persona Switching & Persistence', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should default to Brand persona', async ({ page }) => {
        const brandButton = page.locator('[data-testid="persona-brand"]');
        await expect(brandButton).toHaveClass(/bg-primary/);
        await expect(page.getByText(/brand mode/i)).toBeVisible();
    });

    test('should switch to Admin persona', async ({ page }) => {
        const adminButton = page.locator('[data-testid="persona-admin"]');
        await adminButton.click();
        await expect(adminButton).toHaveClass(/bg-red-600/);
        await expect(page.getByText(/admin mode/i)).toBeVisible();
    });

    test('should switch to Retailer persona', async ({ page }) => {
        const retailerButton = page.locator('[data-testid="persona-retailer"]');
        await retailerButton.click();
        await expect(retailerButton).toHaveClass(/bg-emerald-500/);
        await expect(page.getByText(/retailer mode/i)).toBeVisible();
    });

    test('should persist persona across reloads', async ({ page }) => {
        await page.locator('[data-testid="persona-admin"]').click();
        await expect(page.getByText(/admin mode/i)).toBeVisible();
        await page.reload();
        await expect(page.getByText(/admin mode/i)).toBeVisible();
        await expect(page.locator('[data-testid="persona-admin"]')).toHaveClass(/bg-red-600/);
    });
});

test.describe('Brand Dashboard', () => {
    test.use({ storageState: 'tests/.auth/brand.json' });

    test.beforeEach(async ({ page }) => {
        // Ensure we are on brand page
        await page.goto('/dashboard/brand');
    });

    test('should display KPI cards', async ({ page }) => {
        // KPICard uses data-testid based on label: kpi-card-${label.toLowerCase().replace(/\s+/g, '-')}
        await expect(page.locator('[data-testid="kpi-card-active-campaigns"]')).toBeVisible();
        await expect(page.locator('[data-testid="kpi-card-screens-available"]')).toBeVisible();
        await expect(page.locator('[data-testid="kpi-card-total-spent"]')).toBeVisible();
    });

    test('should display campaign table', async ({ page }) => {
        await expect(page.getByText(/summer sale promo 2024/i)).toBeVisible();
    });

    test('should navigate to new campaign wizard', async ({ page }) => {
        // Use data-test-id for new campaign button
        await page.locator('[data-testid="new-campaign-btn"]').click();
        await expect(page).toHaveURL(/.*campaign\/new/);
    });
});

test.describe('Brand Campaign Wizard E2E', () => {
    test.use({ storageState: 'tests/.auth/brand.json' });

    test.beforeEach(async ({ page }) => {
        // Setup environment
        await page.setViewportSize({ width: 1440, height: 900 });
        page.on('dialog', dialog => dialog.dismiss().catch(() => { }));

        page.on('console', msg => {
            if (msg.type() === 'error') console.error(`[Browser Error] ${msg.text()}`);
            else if (msg.type() === 'warning') console.warn(`[Browser Warning] ${msg.text()}`);
            else console.log(`[Browser Log] ${msg.text()}`);
        });

        // Use a truthy relative URL to avoid fallbacks in config.js
        await page.addInitScript(() => {
            window.ENV = { VITE_API_URL: window.location.origin };
        });

        // Consolidated Mocks using specific globs
        await page.route(/\/api\/retailers/, route => route.fulfill({
            status: 200, contentType: 'application/json',
            body: JSON.stringify([{ id: 'ret_001', name: 'Retailer1', logo: '🏬' }])
        }));
        await page.route(/\/api\/stores/, route => route.fulfill({
            status: 200, contentType: 'application/json',
            body: JSON.stringify([{ id: 'store_001', name: 'Store1', retailer_id: 'ret_001', address: '123 Main St' }])
        }));
        await page.route(/\/api\/screens/, route => route.fulfill({
            status: 200, contentType: 'application/json',
            body: JSON.stringify([{ id: 'scr_001', name: 'Screen1', store_id: 'store_001', status: 'online', resolution: '1920x1080', orientation: 'landscape' }])
        }));
        await page.route(/\/api\/pricing\/config/, route => route.fulfill({
            status: 200, contentType: 'application/json',
            body: JSON.stringify({
                baseCPM: 15.00,
                traffic_tiers: {
                    veryLow: { multiplier: 0.5, label: 'Very Low', color: '#94a3b8', hours: [8, 9, 20, 21] },
                    low: { multiplier: 0.75, label: 'Low', color: '#60a5fa', hours: [10, 11, 19] },
                    medium: { multiplier: 1.0, label: 'Medium', color: '#fbbf24', hours: [14, 15, 16] },
                    high: { multiplier: 1.5, label: 'High', color: '#22c55e', hours: [12, 13, 17, 18] }
                }
            })
        }));
        await page.route(/\/api\/loops/, route => route.fulfill({
            status: 200, contentType: 'application/json',
            body: JSON.stringify({
                loops: [],
                business_hours: { start: 8, end: 22, is_closed: false }
            })
        }));
        await page.route(/\/api\/assets\/upload/, route => route.fulfill({
            status: 201, contentType: 'application/json',
            body: JSON.stringify({ id: 'mock-asset-001', filename: 'demo-ad.mp4', duration: 5, status: 'ready' })
        }));
        await page.route(/\/api\/assets/, route => route.fulfill({
            status: 200, contentType: 'application/json',
            body: JSON.stringify([{ id: 'mock-asset-001', name: 'demo-ad.mp4', url: 'demo.mp4', duration: 5 }])
        }));
        await page.route(/\/api\/campaigns/, route => {
            if (route.request().method() === 'POST') {
                route.fulfill({
                    status: 201, contentType: 'application/json',
                    body: JSON.stringify({ id: `campaign-${Date.now()}`, title: 'Test Campaign', status: 'active' })
                });
            } else route.continue();
        });

        await page.goto('/dashboard/brand/campaign/new');
        await page.waitForTimeout(1000);
    });

    test('should complete Step 1: Location & Screen', async ({ page }) => {
        await page.locator('[data-testid^="store-"]').first().click({ force: true });
        await page.locator('[data-testid^="screen-"]').first().waitFor({ state: 'visible' });
        await page.locator('[data-testid^="screen-"]').first().click({ force: true });
        await page.locator('[data-testid="step-1-next-btn"]').click({ force: true });
        await expect(page.locator('[data-testid="campaign-name-input"]')).toBeVisible({ timeout: 10000 });
    });

    test('should complete Step 2: Schedule & Budget', async ({ page }) => {
        await page.locator('[data-testid^="store-"]').first().click({ force: true });
        await page.locator('[data-testid^="screen-"]').first().waitFor({ state: 'visible' });
        await page.locator('[data-testid^="screen-"]').first().click({ force: true });
        await page.locator('[data-testid="step-1-next-btn"]').click({ force: true });

        await expect(page.locator('[data-testid="campaign-name-input"]')).toBeVisible();
        await page.fill('[data-testid="campaign-name-input"]', 'Test Campaign E2E');
        await page.locator('[data-testid="step-2-next-btn"]').click({ force: true });

        await expect(page.getByText(/select loops/i)).toBeVisible({ timeout: 15000 });
    });

    test('should complete full Wizard flow (Steps 1-5)', async ({ page }) => {
        // Step 1
        await page.locator('[data-testid^="store-"]').first().click({ force: true });
        await page.locator('[data-testid^="screen-"]').first().waitFor({ state: 'visible' });
        await page.locator('[data-testid^="screen-"]').first().click({ force: true });
        await page.locator('[data-testid="step-1-next-btn"]').click({ force: true });

        // Step 2
        await expect(page.locator('[data-testid="campaign-name-input"]')).toBeVisible();
        await page.fill('[data-testid="campaign-name-input"]', 'E2E Full Flow');
        await page.locator('[data-testid="step-2-next-btn"]').click({ force: true });

        // Step 3
        await expect(page.getByText(/select loops/i)).toBeVisible();
        await page.locator('[data-testid="hour-row-8"]').click({ force: true });
        await page.locator('[data-testid="slot-0"]').first().click({ force: true });
        // Using common selector for Step 3 since ID might be wizard-next-step
        await page.locator('button:has-text("Continue")').click({ force: true });

        // Step 4
        await expect(page.getByText(/upload creative/i)).toBeVisible();
        await page.locator('[data-testid^="demo-creative-"]').first().click({ force: true });
        // Step 4 button is currently data-testid="wizard-next-step"
        await page.locator('[data-testid="wizard-next-step"]').click({ force: true });

        // Step 5
        await expect(page.getByText(/review & confirm/i)).toBeVisible();
        await page.locator('[data-testid="confirm-booking-btn"]').click({ force: true });

        await expect(page).toHaveURL(/.*dashboard\/brand/);
        await expect(page.getByText(/active campaigns/i)).toBeVisible();
    });
});
