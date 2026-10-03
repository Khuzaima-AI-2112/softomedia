import { test, expect, hasEmulators, signIn, signOut } from './fixtures/demo-session.js';

test.skip(!hasEmulators, 'requires Firebase Auth, Firestore, and Storage emulators');

const DATE = '2030-01-16';

// FreshMart North plays Bonvie at breakfast and dinner; the Phoenix Store plays
// Bonvie and the secondary Brand's Campaign at lunch. At breakfast Bonvie's two-file
// Creative plays whole across its Run in Slots 0 and 1: 2 Slots and 1 Ad Play (#75).
const LOOPS = [
    ['report-north-08', 'demo-retailer-freshmart', 'demo-store-mtl-north', 8],
    ['report-north-18', 'demo-retailer-freshmart', 'demo-store-mtl-north', 18],
    ['report-phoenix-12', 'demo-retailer-secondary', 'demo-store-phoenix', 12],
];
const PROOFS = [
    ['report-bonvie', 'report-north-08'],
    ['report-bonvie', 'report-north-08'],
    ['report-bonvie', 'report-north-18'],
    ['report-bonvie', 'report-phoenix-12'],
    ['demo-secondary-campaign-1', 'report-phoenix-12'],
    ['demo-secondary-campaign-1', 'report-phoenix-12'],
    ['demo-secondary-campaign-1', 'report-phoenix-12'],
];

const BONVIE_RUN = [0, 1].map(file => ({
    position: file, allocated_category: 'paid', campaign_id: 'report-bonvie', run_start: 0, run_length: 2, run_file: file,
}));

async function seedDelivery() {
    const { getFirestore } = await import('../ad-server/src/utils/firestore.js');
    const { impressionRepository } = await import('../ad-server/src/repositories/ImpressionRepository.js');
    const firestore = getFirestore();
    const batch = firestore.batch();
    batch.set(firestore.collection('campaigns').doc('report-bonvie'), {
        id: 'report-bonvie', name: 'Bonvie Morning Coffee', advertiser_id: 'demo-advertiser-bonvie', status: 'approved',
    });
    for (const [id, retailerId, storeId, hour] of LOOPS) {
        batch.set(firestore.collection('loops').doc(id), {
            id, retailer_id: retailerId, store_id: storeId, date: DATE, hour,
            slots: id === 'report-north-08' ? BONVIE_RUN : [],
        });
    }
    PROOFS.forEach(([campaignId, loopId], index) => {
        const eventId = `report-pop-${index}`;
        batch.set(firestore.collection('impressions').doc(eventId), impressionRepository.buildProofOfPlay({
            event_id: eventId, campaign_id: campaignId, loop_id: loopId, slot_position: index,
            presentation_started_at: `${DATE}T12:00:00.000Z`, intended_duration_seconds: 5,
        }));
    });
    // Fallback Content playback is reported separately and never counts as delivery.
    batch.set(firestore.collection('playback_observations').doc('report-fallback'), {
        presentation_type: 'fallback', loop_id: 'report-north-08', slot_position: 11,
    });
    await batch.commit();
}

const cells = row => row.locator('td');

// #41: the counting and role scoping are proven at the HTTP seam
// (ad-server/tests/delivery-report.integration.test.js). This journey proves the
// report renders from real Proof of Play for each persona that reads it.
test('Brand, Retailer Administrator and Admin each see delivery by Daypart in their own scope', async ({ page, demo }) => {
    await demo.reset();
    await demo.provisionPersonas();

    try {
        await seedDelivery();

        await signIn(page, 'brand@demo.softomedia.test', /\/dashboard\/brand$/);
        await page.getByTestId('nav-delivery-report').click();
        await expect(page.getByRole('heading', { name: 'Delivery by Daypart' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'Breakfast 06:00–11:00' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'Slots' })).toHaveCount(5);
        // Campaign, then Slots and Ads for Breakfast, Lunch, Dinner, Other hours and Total.
        await expect(cells(page.getByTestId('delivery-row-report-bonvie')))
            .toHaveText(['Bonvie Morning Coffee', '2', '1', '1', '0', '1', '0', '0', '0', '4', '1']);
        await expect(page.getByText('Northstar Pantry Synthetic Campaign')).toHaveCount(0);
        await signOut(page);

        await signIn(page, 'retaileradmin@demo.softomedia.test', /\/dashboard\/retailer$/);
        await page.getByTestId('nav-delivery-report').click();
        // Only FreshMart's Stores: Bonvie's lunch in Phoenix is not FreshMart's.
        await expect(cells(page.getByTestId('delivery-row-report-bonvie')))
            .toHaveText(['Bonvie Morning Coffee', '2', '1', '0', '0', '1', '0', '0', '0', '3', '1']);
        await expect(page.getByText('Northstar Pantry Synthetic Campaign')).toHaveCount(0);
        await signOut(page);

        await signIn(page, 'admin@demo.softomedia.test', /\/dashboard\/admin$/);
        await page.getByTestId('nav-delivery-report').click();
        await expect(cells(page.getByTestId('delivery-row-demo-secondary-campaign-1')))
            .toHaveText(['Northstar Pantry Synthetic Campaign', '0', '0', '3', '0', '0', '0', '0', '0', '3', '0']);
        await expect(cells(page.getByTestId('delivery-row-total')))
            .toHaveText(['Total', '2', '1', '4', '0', '1', '0', '0', '0', '7', '1']);
    } finally {
        await demo.reset();
    }
});
