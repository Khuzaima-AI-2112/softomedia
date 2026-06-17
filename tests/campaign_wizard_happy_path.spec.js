const { test, expect } = require('@playwright/test');

test.describe('Campaign Wizard E2E Happy Path', () => {

    test('should allow a brand user to create a campaign and list it', async ({ page }) => {
        // Mock Auth
        await page.route('**/api/auth/me', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    uid: 'test-brand-user',
                    role: 'advertiser',
                    linked_entity_id: 'adv-001',
                    email: 'brand@test.com',
                    name: 'Brand Tester'
                })
            });
        });

        // Mock Retailers Data for Campaign dropdown
        await page.route('**/api/retailers?for=campaign', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    { id: 'ret-101', name: 'SuperMart' },
                    { id: 'ret-102', name: 'MegaStore' }
                ])
            });
        });

        // Mock created campaign returning 201
        await page.route('**/api/campaigns', async route => {
            if (route.request().method() === 'POST') {
                const reqBody = JSON.parse(route.request().postData());
                await route.fulfill({
                    status: 201,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        id: `cmp-${Date.now()}`,
                        ...reqBody,
                        status: 'pending_approval'
                    })
                });
            } else if (route.request().method() === 'GET') {
                // Return campaign list
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([
                        {
                            id: 'cmp-mock-1',
                            name: 'Summer Sale 2026',
                            retailer_id: 'ret-101',
                            start_date: new Date().toISOString().split('T')[0],
                            end_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                            status: 'pending_approval'
                        }
                    ])
                });
            }
        });

        // Mock Dashboard API which the frontend might hit
        await page.route('**/api/dashboard/kpis**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ campaignsActive: 0, campaignsPending: 1 })
            });
        });

        // Navigate to advertiser campaigns dashboard
        await page.goto('/dashboard/advertiser/campaigns');

        // Find "New Campaign" or related button to open Modal
        // Wait, the client code might have different buttons but it triggers `CampaignWizardModal`
        // Let's assume there is a button with text "New Campaign" or "Create Campaign"
        await page.waitForSelector('text=/new campaign|create campaign/i', { timeout: 5000 });
        const createBtn = page.locator('button', { hasText: /new campaign|create campaign/i }).first();
        await createBtn.click();

        // Ensure modal is open by checking for wizard-title
        await expect(page.locator('#wizard-title')).toBeVisible();

        // Retailer Selection -> Valid Dates -> Submission
        await page.fill('#wiz-name', 'Summer Sale 2026');

        // Select 'SuperMart'
        await page.selectOption('#wiz-retailer', 'ret-101');

        const todayStr = new Date().toISOString().split('T')[0];
        const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

        // Fill dates
        await page.fill('#wiz-start', todayStr);
        await page.fill('#wiz-end', tomorrowStr);

        // Fill optional
        await page.fill('#wiz-budget', '5000');
        await page.fill('#wiz-creative', 'https://examples.com/ad.jpg');

        // Submit form
        await page.locator('button[type="submit"][form="campaign-wizard-form"]').click();

        // Modal should close (onSuccess triggered)
        await expect(page.locator('#wizard-title')).toBeHidden();

        // The campaign list should be refreshed. Let's look for the new campaign name on screen
        await expect(page.getByText('Summer Sale 2026')).toBeVisible();
    });
});
