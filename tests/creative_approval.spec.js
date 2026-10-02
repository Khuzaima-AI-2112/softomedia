import { test, expect, hasEmulators, signIn, signOut } from './fixtures/demo-session.js';

test.skip(!hasEmulators, 'requires Firebase Auth, Firestore, and Storage emulators');

const BRAND_ID = 'demo-advertiser-bonvie';
const RETAILER_ID = 'demo-retailer-freshmart';
const demoStoragePath = category => `gs://${process.env.DEMO_ASSETS_BUCKET}/phase-1-demo/media/${category}.png`;

/**
 * A Brand's Creative, booked in FreshMart's Stores, is approved once by the
 * Super Administrator and then by FreshMart for its Stores (ADR 0007).
 */
test('the Super Administrator then the Retailer preview and approve a Creative, and the Brand sees both approvals', async ({ page, demo }) => {
    const suffix = Date.now();
    const creativeId = `crv_browser_${suffix}`;
    const assetId = `ast_browser_${suffix}`;
    const title = `Browser approval latte ${suffix}`;
    const { mediaRepository } = await import('../ad-server/src/repositories/MediaRepository.js');
    const { creativeRepository } = await import('../ad-server/src/repositories/CreativeRepository.js');
    const { campaignRepository } = await import('../ad-server/src/repositories/CampaignRepository.js');
    await demo.reset();
    await demo.provisionPersonas();

    try {
        await mediaRepository.create(assetId, {
            title, storage_path: demoStoragePath('paid'), mime_type: 'image/png', category: 'paid',
            owner_type: 'brand', owner_id: BRAND_ID, creative_id: creativeId, status: 'ready', duration: 5,
        });
        await creativeRepository.create(creativeId, {
            title, brand_id: BRAND_ID, media_ids: [assetId], approval_status: 'pending',
            decided_by: null, decided_at: null, reason: null,
        });
        await campaignRepository.create(`cmp_browser_${suffix}`, {
            name: 'Browser approval booking', type: 'paid', status: 'scheduled',
            brand_id: BRAND_ID, advertiser_id: BRAND_ID, creative_id: creativeId, media_id: assetId,
            inventory_selection: [{ retailer_id: RETAILER_ID, store_id: 'demo-store-mtl-north' }],
        });

        // The Retailer isn't asked before the Super Administrator has approved.
        await signIn(page, 'retaileradmin@demo.softomedia.test', /\/dashboard\/retailer$/);
        await page.getByTestId('nav-creative-approvals').click();
        await expect(page.getByTestId('creative-approvals-empty')).toBeVisible();
        await signOut(page);

        // The Super Administrator previews the file and approves the Creative for the network.
        await signIn(page, 'superadmin@demo.softomedia.test', /\/dashboard\//);
        await page.getByTestId('nav-creative-approvals').click();
        const waiting = page.getByTestId(`creative-approval-${creativeId}`);
        await expect(waiting.getByTestId(`creative-preview-${assetId}`).locator('img')).toBeVisible();
        await waiting.getByTestId(`approve-creative-${creativeId}`).click();
        await expect(page.getByRole('status')).toHaveText(`Approved “${title}”.`);
        await expect(waiting).toHaveCount(0);
        await signOut(page);

        // FreshMart, whose Stores it is booked in, then approves it for them.
        await signIn(page, 'retaileradmin@demo.softomedia.test', /\/dashboard\/retailer$/);
        await page.getByTestId('nav-creative-approvals').click();
        const forRetailer = page.getByTestId(`creative-approval-${creativeId}`);
        await expect(forRetailer.getByTestId(`creative-preview-${assetId}`).locator('img')).toBeVisible();
        await forRetailer.getByTestId(`approve-creative-${creativeId}`).click();
        await expect(page.getByRole('status')).toHaveText(`Approved “${title}”.`);
        await signOut(page);

        // The Brand sees both approvals.
        await signIn(page, 'brand@demo.softomedia.test', /\/dashboard\/brand$/);
        await expect(page.getByTestId(`creative-status-${creativeId}`)).toHaveText('Approved by Super Admin');
        await expect(page.getByTestId(`creative-retailer-${creativeId}-${RETAILER_ID}`))
            .toHaveText('FreshMart Synthetic Retailer: Approved');
        const decided = await creativeRepository.findById(creativeId);
        expect(decided.retailer_approvals[RETAILER_ID]).toMatchObject({ status: 'approved' });
    } finally {
        await demo.reset();
    }
});
