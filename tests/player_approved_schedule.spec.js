import { test, expect, hasEmulators, signedInPage } from './fixtures/demo-session.js';

test.skip(!hasEmulators, 'requires Firebase Auth, Firestore, and Storage emulators');

const API = 'http://localhost:8080';

// The demo reset uploads these private images; the Player reads them through its device media route.
const demoStoragePath = category => `gs://${process.env.DEMO_ASSETS_BUCKET}/phase-1-demo/media/${category}.png`;

test('Player authenticates as its Screen and reports approved Campaign, fallback, and Holding Slide state truthfully', async ({ page, browser, demo }) => {
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
    // Schedule the current and next UTC hour so a run that crosses the hour boundary stays approved.
    const now = new Date();
    const hours = [now, new Date(now.getTime() + 60 * 60 * 1000)].map((moment, index) => ({
        loopId: index === 0 ? loopId : `${loopId}-next`,
        date: moment.toISOString().slice(0, 10),
        hour: moment.getUTCHours(),
    }));
    const date = hours[0].date;
    const lastDate = hours[1].date;
    const loopIds = hours.map(slot => slot.loopId);

    const { retailerRepository } = await import('../ad-server/src/repositories/RetailerRepository.js');
    const { default: StoreRepository } = await import('../ad-server/src/repositories/StoreRepository.js');
    const { locationRepository } = await import('../ad-server/src/repositories/LocationRepository.js');
    const { loopRepository, LOOP_STATUS } = await import('../ad-server/src/repositories/LoopRepository.js');
    const { dailyScheduleRepository } = await import('../ad-server/src/repositories/DailyScheduleRepository.js');
    const { mediaRepository } = await import('../ad-server/src/repositories/MediaRepository.js');
    const { campaignRepository } = await import('../ad-server/src/repositories/CampaignRepository.js');
    const { impressionRepository } = await import('../ad-server/src/repositories/ImpressionRepository.js');
    const { playbackObservationRepository } = await import('../ad-server/src/repositories/PlaybackObservationRepository.js');
    await demo.reset();
    await demo.provisionPersonas();
    const personaPages = [];
    const signedInPersona = async (email, landing) => {
        const persona = await signedInPage(browser, email, landing);
        personaPages.push(persona);
        return persona;
    };

    try {
        await retailerRepository.create(retailerId, { name: 'Player Browser Retailer', status: 'active' });
        await StoreRepository.create(storeId, { name: 'Player Browser Store', retailer_id: retailerId, city: 'Test City', time_zone: 'UTC' });
        await locationRepository.create(locationId, { name: 'Player Browser Entrance', retailer_id: retailerId, store_id: storeId });
        await mediaRepository.create(assetId, {
            title: 'Browser Campaign Creative',
            storage_path: demoStoragePath('paid'),
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
            end_date: lastDate,
        });
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
        for (const scheduled of hours) {
            await loopRepository.create(scheduled.loopId, {
                date: scheduled.date,
                hour: scheduled.hour,
                retailer_id: retailerId,
                store_id: storeId,
                status: LOOP_STATUS.APPROVED,
                slots: campaignSlots,
            });
        }
        for (const scheduleDate of new Set(hours.map(scheduled => scheduled.date))) {
            const sameDay = hours.filter(scheduled => scheduled.date === scheduleDate);
            await dailyScheduleRepository.save(storeId, scheduleDate, {
                retailer_id: retailerId,
                operating_hours: sameDay.map(scheduled => scheduled.hour),
                loop_ids: sameDay.map(scheduled => scheduled.loopId),
            });
        }
        const updateLoops = patch => Promise.all(loopIds.map(id => loopRepository.update(id, patch)));

        // Technical Operator signs in, registers the Screen and receives its one-time device key.
        const operator = await signedInPersona('techoperator@demo.softomedia.test', /\/dashboard\/techoperator$/);
        await operator.getByTestId('nav-screens').click();
        await operator.getByTestId('btn-add-screen').click();
        const screenForm = operator.getByTestId('modal-screen-form');
        await screenForm.getByLabel('Screen Hardware ID').fill(screenId);
        await screenForm.getByLabel('Retailer').selectOption(retailerId);
        await screenForm.getByLabel('Store').selectOption(storeId);
        await screenForm.getByLabel('Location').selectOption(locationId);
        await operator.getByTestId('btn-screen-form-submit').click();
        await expect(operator.getByTestId('screen-device-credential')).toContainText(screenId);
        const deviceKey = (await operator.getByTestId('screen-device-key').textContent()).trim();
        expect(deviceKey).not.toBe('');

        await page.goto(`/player?screen_id=${screenId}`);
        await expect(page.getByTestId('player-error')).toContainText('Device key required');
        await page.goto(`/player?screen_id=${screenId}#key=not-this-screens-key`);
        await page.reload();
        await expect(page.getByTestId('player-error')).toContainText('Access Denied (401)');
        await expect.poll(async () => (await impressionRepository.findProofsOfPlayByCampaign(campaignId)).length).toBe(0);

        await page.goto(`/player?screen_id=${screenId}#key=${deviceKey}`);
        await page.reload();
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
            loop_id: expect.stringMatching(new RegExp(`^${loopId}`)),
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
            storage_path: demoStoragePath('fallback'),
            category: 'fallback',
            content_kind: 'neutral_fallback',
            owner_type: 'platform',
            owner_id: null,
            approval_status: 'approved',
            eligible_for_playback: true,
            status: 'ready',
        });
        await updateLoops({
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

        await updateLoops({ status: LOOP_STATUS.REJECTED });
        await expect(page.getByTestId('holding-slide')).toContainText('No approved schedule', { timeout: 15000 });
        await expect(page.getByTestId('player-container')).toHaveAttribute('data-connectivity-status', 'ONLINE');
        await expect(page.getByTestId('campaign-presentation')).toHaveCount(0);
        await expect.poll(async () => (await playbackObservationRepository.findAll())
            .filter(item => item.screen_id === screenId && item.presentation_type === 'holding_slide').length).toBeGreaterThan(0);

        await updateLoops({ status: LOOP_STATUS.APPROVED, slots: campaignSlots });
        await campaignRepository.update(campaignId, { end_date: '2000-01-01' });
        await page.reload();
        await expect(page.getByTestId('fallback-presentation')).toBeVisible();
        await expect(page.getByTestId('campaign-presentation')).toHaveCount(0);
        const fallbackProofCount = (await impressionRepository.findProofsOfPlayByCampaign(campaignId)).length;
        const fallbackPresentations = async () => (await playbackObservationRepository.findAll())
            .filter(item => item.screen_id === screenId && item.presentation_type === 'fallback').length;
        await expect.poll(fallbackPresentations).toBeGreaterThan(0);
        // Wait for the next five-second slot to present fallback too, then confirm no delivery was recorded.
        const presentedSoFar = await fallbackPresentations();
        await expect.poll(fallbackPresentations, { timeout: 15000 }).toBeGreaterThan(presentedSoFar);
        expect((await impressionRepository.findProofsOfPlayByCampaign(campaignId)).length).toBe(fallbackProofCount);

        await campaignRepository.update(campaignId, { end_date: lastDate, advertiser_id: 'foreign-brand' });
        await page.reload();
        await expect(page.getByTestId('fallback-presentation')).toBeVisible();
        await expect(page.getByTestId('campaign-presentation')).toHaveCount(0);
        await locationRepository.update(locationId, { retailer_id: 'foreign-retailer' });
        const invalidAssignment = await page.request.get(`${API}/api/device/playback`, {
            headers: { Authorization: `Device ${screenId}:${deviceKey}` },
        });
        expect(invalidAssignment.status()).toBe(409);
        expect(await invalidAssignment.json()).toEqual({ error: 'Screen assignment is invalid' });

        await locationRepository.update(locationId, { retailer_id: retailerId });
        await campaignRepository.update(campaignId, { brand_id: brandId, advertiser_id: brandId, end_date: lastDate });

        await operator.goto('/dashboard/techoperator');
        await expect(operator.getByTestId('delivery-report')).toBeVisible({ timeout: 30000 });
        await expect(operator.getByTestId('campaign-delivery')).not.toHaveText('0');
        await expect(operator.getByTestId('fallback-playback')).not.toHaveText('0');
        await expect(operator.getByTestId('holding-slide-playback')).not.toHaveText('0');
        await expect(operator.getByTestId('recent-proof-of-play')).toContainText(proof.event_id);
        await operator.reload();
        await expect(operator.getByTestId('recent-proof-of-play')).toContainText(proof.event_id);

        const brand = await signedInPersona('brand@demo.softomedia.test', /\/dashboard\/brand$/);
        await expect(brand.getByTestId(`proof-events-${campaignId}`)).toContainText(proof.event_id, { timeout: 30000 });
        await brand.reload();
        await expect(brand.getByTestId(`proof-events-${campaignId}`)).toContainText(proof.event_id);
    } finally {
        await Promise.all(personaPages.map(persona => persona.context().close()));
        // Not demo-scoped, so the reset would leave it for the Screen form of later journeys.
        await retailerRepository.delete(retailerId).catch(() => null);
        await demo.reset();
    }
});
