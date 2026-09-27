import { test, expect, hasEmulators, signIn } from './fixtures/demo-session.js';

test.skip(!hasEmulators, 'requires Firebase Auth, Firestore, and Storage emulators');

const RETAILER_ID = 'demo-retailer-freshmart';
const STORE_ID = 'demo-store-mtl-north';
const NAME = 'Breakfast muffin upsell';

// #40: the rules are proven at the HTTP seam
// (ad-server/tests/retailer-promotions.integration.test.js). This journey proves
// an Admin schedules a breakfast promotion through the UI, and that the
// schedule the Admin then generates plays it only in the Store's breakfast
// hours, and only in the Retailer's own Slots.
test('Admin schedules a breakfast promotion that plays only in the Retailer\'s breakfast Slots', async ({ page, demo }) => {
    const { campaignRepository } = await import('../ad-server/src/repositories/CampaignRepository.js');
    const { loopRepository } = await import('../ad-server/src/repositories/LoopRepository.js');
    await demo.reset();
    await demo.provisionPersonas();
    let promotion;

    try {
        await signIn(page, 'admin@demo.softomedia.test', /\/dashboard\/admin$/);
        await page.goto('/dashboard/admin/campaigns');
        // The Loops page generates for tomorrow as the browser computes it.
        const tomorrow = await page.evaluate(() => {
            const date = new Date();
            date.setDate(date.getDate() + 1);
            return date.toISOString().split('T')[0];
        });

        await page.getByTestId('schedule-promotion-btn').click();
        await page.getByTestId('promotion-name-input').fill(NAME);
        await page.getByTestId('promotion-retailer-select').selectOption(RETAILER_ID);
        await page.getByTestId('promotion-store-select').selectOption(STORE_ID);
        // Only FreshMart's own media is offered.
        await expect(page.getByTestId('promotion-media-select').locator('option[value="demo-media-paid"]')).toHaveCount(0);
        await page.getByTestId('promotion-media-select').selectOption('demo-media-retailer');
        await page.getByTestId('promotion-start-date').fill(tomorrow);
        await page.getByTestId('promotion-end-date').fill(tomorrow);
        await expect(page.getByText('Breakfast (06:00–11:00)')).toBeVisible();
        await page.getByTestId('promotion-daypart-breakfast').check();
        await page.getByTestId('promotion-submit-btn').click();

        await expect(page.getByText(`Promotion "${NAME}" scheduled. It plays once the Retailer approves it.`)).toBeVisible();
        await expect(page.getByRole('row', { name: new RegExp(NAME) })).toContainText('Retailer promotion');

        promotion = (await campaignRepository.findAll()).find(campaign => campaign.name === NAME);
        expect(promotion).toMatchObject({
            type: 'retailer',
            retailer_id: RETAILER_ID,
            store_id: STORE_ID,
            media_id: 'demo-media-retailer',
            schedule: { dates: [tomorrow], dayparts: ['breakfast'], hours: [] },
            status: 'pending_approval',
        });

        // The Retailer's approval has its own journey (retailer_approval.spec.js).
        await campaignRepository.update(promotion.id, { status: 'approved' });

        await page.goto('/dashboard/admin/loops');
        await page.getByTestId('generate-loops-btn').click();
        await expect(page.getByText(`Loops generated for ${tomorrow} at FreshMart North Synthetic Store.`)).toBeVisible();

        const loops = (await loopRepository.findAll({ where: [['date', '==', tomorrow]] }))
            .filter(loop => loop.store_id === STORE_ID);
        const promoted = loops.flatMap(loop => loop.slots
            .filter(slot => slot.campaign_id === promotion.id)
            .map(slot => ({ hour: loop.hour, category: slot.allocated_category })));
        // Breakfast is 06:00–11:00; the Store opens at 08:00.
        expect([...new Set(promoted.map(({ hour }) => hour))].sort((a, b) => a - b)).toEqual([8, 9, 10]);
        expect(promoted.every(({ category }) => category === 'retailer')).toBe(true);
        // Every breakfast Retailer Slot plays it; no other hour's Retailer Slot does.
        const breakfastRetailerSlots = loops.filter(loop => loop.hour >= 8 && loop.hour < 11)
            .flatMap(loop => loop.slots.filter(slot => slot.allocated_category === 'retailer'));
        expect(promoted).toHaveLength(breakfastRetailerSlots.length);
    } finally {
        // Demo reset does not yet clear app-created Campaigns (#46).
        if (promotion) await campaignRepository.delete(promotion.id);
        await demo.reset();
    }
});
