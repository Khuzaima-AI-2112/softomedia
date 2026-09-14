import { test, expect } from './base.fixtures.js';

const hasEmulators = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST
    && process.env.FIREBASE_AUTH_EMULATOR_HOST
);
test.skip(!hasEmulators, 'requires Firebase Auth and Firestore emulators');

test('Player refreshes approved Campaign, fallback, and Holding Slide state truthfully', async ({ techoperatorPage: page, brandPage }) => {
    const suffix = `${Date.now()}`;
    const retailerId = `player-retailer-${suffix}`;
    const storeId = `player-store-${suffix}`;
    const locationId = `player-location-${suffix}`;
    const screenId = `player-screen-${suffix}`;
    const loopId = `player-loop-${suffix}`;
    const assetId = `browser-asset-${suffix}`;
    const campaignId = `browser-campaign-${suffix}`;
    const brandId = 'demo-advertiser-bonvie';
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
    const { impressionRepository } = await import('../ad-server/src/repositories/ImpressionRepository.js');
    const { playbackObservationRepository } = await import('../ad-server/src/repositories/PlaybackObservationRepository.js');

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
        url: 'http://localhost:8080/assets/demo_ad_1.png',
        category: 'paid',
        owner_type: 'brand',
        owner_id: brandId,
        approval_status: 'approved',
        eligible_for_playback: true,
        status: 'ready',
    });
    await campaignRepository.create(campaignId, {
        status: 'approved',
        brand_id: brandId,
        advertiser_id: brandId,
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

    await page.goto(`/player?screen_id=${screenId}`);
    await expect(page.getByTestId('campaign-presentation')).toBeVisible();
    await expect(page.getByTestId('player-container')).toHaveAttribute('data-schedule-status', 'approved');
    await expect.poll(async () => (await impressionRepository.findProofsOfPlayByCampaign(campaignId)).length, {
        timeout: 30000,
    }).toBeGreaterThan(0);
    const [proof] = await impressionRepository.findProofsOfPlayByCampaign(campaignId);
    expect(proof).toEqual(expect.objectContaining({
        event_id: expect.any(String),
        screen_id: screenId,
        location_id: locationId,
        loop_id: loopId,
        slot_position: 0,
        campaign_id: campaignId,
        asset_id: assetId,
        presentation_started_at: expect.any(String),
        intended_duration_seconds: 5,
    }));
    await page.reload();
    await expect(page.getByTestId('campaign-presentation')).toBeVisible();

    await mediaRepository.create(fallbackId, {
        title: 'Browser Approved Fallback',
        url: 'http://localhost:8080/assets/demo_ad_2.png',
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
    await expect.poll(async () => (await playbackObservationRepository.findAll())
        .filter(item => item.screen_id === screenId && item.presentation_type === 'holding_slide').length).toBeGreaterThan(0);

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
    const fallbackProofCount = (await impressionRepository.findProofsOfPlayByCampaign(campaignId)).length;
    await page.waitForTimeout(5500);
    expect((await impressionRepository.findProofsOfPlayByCampaign(campaignId)).length).toBe(fallbackProofCount);
    await expect.poll(async () => (await playbackObservationRepository.findAll())
        .filter(item => item.screen_id === screenId && item.presentation_type === 'fallback').length).toBeGreaterThan(0);

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

    await locationRepository.update(locationId, { retailer_id: retailerId });
    await campaignRepository.update(campaignId, {
        brand_id: brandId,
        advertiser_id: brandId,
        end_date: date,
    });

    await page.goto('/dashboard/techoperator');
    await expect(page.getByTestId('delivery-report')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('campaign-delivery')).not.toHaveText('0');
    await expect(page.getByTestId('fallback-playback')).not.toHaveText('0');
    await expect(page.getByTestId('holding-slide-playback')).not.toHaveText('0');
    await expect(page.getByTestId('recent-proof-of-play')).toContainText(proof.event_id);
    await page.reload();
    await expect(page.getByTestId('recent-proof-of-play')).toContainText(proof.event_id);

    await brandPage.goto('/dashboard/brand');
    await expect(brandPage.getByTestId(`proof-events-${campaignId}`)).toContainText(proof.event_id, { timeout: 30000 });
    await brandPage.reload();
    await expect(brandPage.getByTestId(`proof-events-${campaignId}`)).toContainText(proof.event_id);
});
