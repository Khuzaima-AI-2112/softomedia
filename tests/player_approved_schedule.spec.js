import { test, expect } from '@playwright/test';

const hasEmulators = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST
    && process.env.FIREBASE_AUTH_EMULATOR_HOST
);
test.skip(!hasEmulators, 'requires Firebase Auth and Firestore emulators');

test('Player refreshes approved Campaign, fallback, and Holding Slide state truthfully', async ({ page }) => {
    const suffix = `${Date.now()}`;
    const retailerId = `player-retailer-${suffix}`;
    const storeId = `player-store-${suffix}`;
    const locationId = `player-location-${suffix}`;
    const screenId = `player-screen-${suffix}`;
    const loopId = `player-loop-${suffix}`;
    const assetId = `browser-asset-${suffix}`;
    const campaignId = `browser-campaign-${suffix}`;
    const fallbackId = `browser-fallback-${suffix}`;
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const hour = now.getUTCHours();

    const { default: StoreRepository } = await import('../ad-server/src/repositories/StoreRepository.js');
    const { locationRepository } = await import('../ad-server/src/repositories/LocationRepository.js');
    const { screenRepository } = await import('../ad-server/src/repositories/ScreenRepository.js');
    const { loopRepository, LOOP_STATUS } = await import('../ad-server/src/repositories/LoopRepository.js');
    const { dailyScheduleRepository } = await import('../ad-server/src/repositories/DailyScheduleRepository.js');
    const { mediaRepository } = await import('../ad-server/src/repositories/MediaRepository.js');
    const { campaignRepository } = await import('../ad-server/src/repositories/CampaignRepository.js');

    await StoreRepository.create(storeId, {
        name: 'Player Browser Store',
        retailer_id: retailerId,
        time_zone: 'UTC',
    });
    await locationRepository.create(locationId, {
        name: 'Player Browser Entrance',
        retailer_id: retailerId,
        store_id: storeId,
    });
    await screenRepository.create(screenId, {
        name: 'Player Browser Screen',
        retailer_id: retailerId,
        store_id: storeId,
        location_id: locationId,
        status: 'ONLINE',
    });
    await mediaRepository.create(assetId, {
        title: 'Browser Campaign Creative',
        category: 'paid',
        owner_type: 'brand',
        owner_id: `browser-brand-${suffix}`,
        approval_status: 'approved',
        eligible_for_playback: true,
        status: 'ready',
    });
    await campaignRepository.create(campaignId, {
        status: 'approved',
        advertiser_id: `browser-brand-${suffix}`,
        retailer_id: retailerId,
        store_id: storeId,
        asset_id: assetId,
        start_date: date,
        end_date: date,
    });
    const loop = await loopRepository.create(loopId, {
        date,
        hour,
        retailer_id: retailerId,
        store_id: storeId,
        status: LOOP_STATUS.APPROVED,
        slots: Array.from({ length: 12 }, (_, position) => ({
            position,
            allocated_category: 'paid',
            asset_id: assetId,
            asset_name: `Browser Campaign ${position}`,
            campaign_id: campaignId,
            content_kind: 'campaign',
            is_fallback: false,
            duration: 5,
        })),
    });
    await dailyScheduleRepository.save(storeId, date, {
        retailer_id: retailerId,
        operating_hours: [hour],
        loop_ids: [loop.id],
    });

    await page.addInitScript(() => {
        window.ENV = { VITE_API_URL: 'http://localhost:8080' };
        localStorage.setItem('authToken', 'demo-token');
        localStorage.setItem('demo_role', 'techoperator');
    });

    await page.goto(`/player?screen_id=${screenId}`);
    await expect(page.getByTestId('campaign-presentation')).toBeVisible();
    await expect(page.getByTestId('player-container')).toHaveAttribute('data-schedule-status', 'approved');
    await page.reload();
    await expect(page.getByTestId('campaign-presentation')).toBeVisible();

    await mediaRepository.create(fallbackId, {
        title: 'Browser Approved Fallback',
        category: 'fallback',
        content_kind: 'neutral_fallback',
        owner_type: 'platform',
        owner_id: null,
        approval_status: 'approved',
        eligible_for_playback: true,
        status: 'ready',
    });
    await loopRepository.update(loopId, {
        slots: [{
            position: 0,
            allocated_category: 'retailer',
            asset_id: fallbackId,
            asset_name: 'Browser Approved Fallback',
            campaign_id: null,
            content_kind: 'fallback',
            is_fallback: true,
            duration: 5,
        }],
    });
    await page.reload();
    await expect(page.getByTestId('fallback-presentation')).toContainText('Reserved retailer position');
    await expect(page.getByTestId('campaign-presentation')).toHaveCount(0);

    await loopRepository.update(loopId, { status: LOOP_STATUS.REJECTED });
    await expect(page.getByTestId('holding-slide')).toContainText('No approved schedule', { timeout: 15000 });
    await expect(page.getByTestId('player-container')).toHaveAttribute('data-connectivity-status', 'ONLINE');
    await expect(page.getByTestId('campaign-presentation')).toHaveCount(0);

    const campaignSlots = Array.from({ length: 12 }, (_, position) => ({
        position,
        allocated_category: 'paid',
        asset_id: assetId,
        asset_name: `Browser Campaign ${position}`,
        campaign_id: campaignId,
        content_kind: 'campaign',
        is_fallback: false,
        duration: 5,
    }));
    await loopRepository.update(loopId, { status: LOOP_STATUS.APPROVED, slots: campaignSlots });
    await campaignRepository.update(campaignId, { end_date: '2000-01-01' });
    await page.reload();
    await expect(page.getByTestId('fallback-presentation')).toBeVisible();
    await expect(page.getByTestId('campaign-presentation')).toHaveCount(0);

    await campaignRepository.update(campaignId, {
        end_date: date,
        advertiser_id: 'foreign-brand',
    });
    await page.reload();
    await expect(page.getByTestId('fallback-presentation')).toBeVisible();
    await expect(page.getByTestId('campaign-presentation')).toHaveCount(0);

    await locationRepository.update(locationId, { retailer_id: 'foreign-retailer' });
    const invalidAssignment = await page.request.get(`http://localhost:8080/api/screens/${screenId}/playback-loop`);
    expect(invalidAssignment.status()).toBe(409);
    expect(await invalidAssignment.json()).toEqual({ error: 'Screen assignment is invalid' });
});
