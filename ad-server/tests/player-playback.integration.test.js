import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('../src/utils/firestore.js', () => ({
    getFirestore: jest.fn(() => null),
}));

const { default: apiRouter } = await import('../src/api/index.js');
const { createTestApp } = await import('./fixtures/test-app.js');
const { clearMockStorage } = await import('../src/repositories/BaseRepository.js');
const { screenRepository } = await import('../src/repositories/ScreenRepository.js');
const { locationRepository } = await import('../src/repositories/LocationRepository.js');
const { default: StoreRepository } = await import('../src/repositories/StoreRepository.js');
const { loopRepository, LOOP_STATUS } = await import('../src/repositories/LoopRepository.js');
const { dailyScheduleRepository } = await import('../src/repositories/DailyScheduleRepository.js');
const { mediaRepository } = await import('../src/repositories/MediaRepository.js');
const { campaignRepository } = await import('../src/repositories/CampaignRepository.js');
const { deviceCredentialService } = await import('../src/services/DeviceCredentialService.js');

const app = createTestApp(apiRouter, '/api');
let screenOneDeviceKey;

const screenOnePlayback = () => request(app)
    .get('/api/device/playback')
    .set('Authorization', `Device screen-one:${screenOneDeviceKey}`);

async function seedAssignment() {
    await StoreRepository.create('store-toronto', {
        name: 'Toronto Flagship',
        retailer_id: 'retailer-one',
        time_zone: 'America/Toronto',
    });
    await locationRepository.create('location-entrance', {
        name: 'Entrance',
        retailer_id: 'retailer-one',
        store_id: 'store-toronto',
    });
    const credential = deviceCredentialService.newCredential();
    screenOneDeviceKey = credential.deviceKey;
    await screenRepository.create('screen-one', {
        ...credential.fields,
        name: 'Entrance Screen',
        retailer_id: 'retailer-one',
        store_id: 'store-toronto',
        location_id: 'location-entrance',
        status: 'ONLINE',
    });
}

async function seedLoop({
    id = 'loop-current',
    date = '2030-07-15',
    hour = 8,
    retailerId = 'retailer-one',
    storeId = 'store-toronto',
    status = LOOP_STATUS.APPROVED,
} = {}) {
    for (let position = 0; position < 12; position += 1) {
        await mediaRepository.create(`asset-${position}`, {
            title: `Campaign creative ${position}`,
            category: 'paid',
            owner_type: 'brand',
            owner_id: 'brand-one',
            approval_status: 'approved',
            eligible_for_playback: true,
            status: 'ready',
        });
        await campaignRepository.create(`campaign-${position}`, {
            status: 'approved',
            advertiser_id: 'brand-one',
            retailer_id: retailerId,
            store_id: storeId,
            asset_id: `asset-${position}`,
            start_date: date,
            end_date: date,
        });
    }
    const loop = await loopRepository.create(id, {
        date,
        hour,
        retailer_id: retailerId,
        store_id: storeId,
        status,
        slots: Array.from({ length: 12 }, (_, position) => ({
            position,
            allocated_category: 'paid',
            asset_id: `asset-${position}`,
            asset_name: `Campaign creative ${position}`,
            campaign_id: `campaign-${position}`,
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
    return loop;
}

describe('GET /api/device/playback', () => {
    beforeEach(() => {
        clearMockStorage();
        jest.useFakeTimers({
            now: new Date('2030-07-15T12:30:00.000Z'),
            doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval'],
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('plays the assigned approved loop for the current Store-local hour', async () => {
        await seedAssignment();
        await seedLoop();

        const response = await screenOnePlayback();

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            screen_id: 'screen-one',
            retailer_id: 'retailer-one',
            store_id: 'store-toronto',
            location_id: 'location-entrance',
            broadcast_date: '2030-07-15',
            hour: 8,
            connectivity_status: 'ONLINE',
            schedule_status: 'approved',
            playback_mode: 'approved_schedule',
            loop_id: 'loop-current',
        });
        expect(response.body.slots).toHaveLength(12);
        expect(response.body.slots[0]).toMatchObject({
            presentation_type: 'campaign',
            counts_as_delivery: true,
            campaign_id: 'campaign-0',
        });
    });

    test('reports missing approval independently from Screen connectivity', async () => {
        await seedAssignment();
        await seedLoop({ status: LOOP_STATUS.PENDING_APPROVAL });

        const response = await screenOnePlayback();

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            connectivity_status: 'ONLINE',
            schedule_status: 'No approved schedule',
            playback_mode: 'holding_slide',
            presentation_type: 'holding_slide',
            counts_as_delivery: false,
            loop_id: null,
            slots: [],
        });
    });

    test('replaces an ineligible reserved-position asset with approved fallback media', async () => {
        await seedAssignment();
        const loop = await seedLoop();
        await loopRepository.update(loop.id, {
            slots: [{
                position: 0,
                allocated_category: 'retailer',
                asset_id: 'rejected-fallback',
                content_kind: 'fallback',
                is_fallback: true,
                duration: 5,
            }],
        });
        await mediaRepository.create('rejected-fallback', {
            title: 'Rejected fallback',
            category: 'fallback',
            content_kind: 'neutral_fallback',
            approval_status: 'rejected',
            status: 'rejected',
        });
        await mediaRepository.create('approved-fallback', {
            title: 'Approved neutral fallback',
            category: 'fallback',
            content_kind: 'neutral_fallback',
            owner_type: 'platform',
            owner_id: null,
            approval_status: 'approved',
            eligible_for_playback: true,
            status: 'ready',
            url: 'https://cdn.example.test/approved-fallback.png',
        });

        const response = await screenOnePlayback();

        expect(response.status).toBe(200);
        expect(response.body.slots[0]).toMatchObject({
            allocated_category: 'retailer',
            asset_id: 'approved-fallback',
            asset_name: 'Approved neutral fallback',
            url: 'https://cdn.example.test/approved-fallback.png',
            presentation_type: 'fallback',
            counts_as_delivery: false,
        });
    });

    test('points the Player at the device media route for stored media, never at the Storage object', async () => {
        await seedAssignment();
        const loop = await seedLoop();
        await loopRepository.update(loop.id, {
            slots: [{
                position: 0,
                allocated_category: 'retailer',
                asset_id: 'stored-fallback',
                content_kind: 'fallback',
                is_fallback: true,
                duration: 5,
            }],
        });
        await mediaRepository.create('stored-fallback', {
            title: 'Stored neutral fallback',
            category: 'fallback',
            content_kind: 'neutral_fallback',
            owner_type: 'platform',
            owner_id: null,
            approval_status: 'approved',
            eligible_for_playback: true,
            status: 'ready',
            storage_path: 'gs://softomedia-demo.firebasestorage.app/phase-1-demo/uploads/stored-fallback.png',
            url: 'https://storage.googleapis.com/softomedia-demo.firebasestorage.app/phase-1-demo/uploads/stored-fallback.png',
        });

        const response = await screenOnePlayback();

        expect(response.status).toBe(200);
        expect(response.body.slots[0]).toMatchObject({
            asset_id: 'stored-fallback',
            url: '/api/device/media/stored-fallback',
        });
    });

    test('does not claim Campaign delivery for approved category media', async () => {
        await seedAssignment();
        const loop = await seedLoop();
        await loopRepository.update(loop.id, {
            slots: [{
                position: 0,
                allocated_category: 'retailer',
                asset_id: 'retailer-media',
                content_kind: 'media',
                campaign_id: null,
                is_fallback: false,
                duration: 5,
            }],
        });
        await mediaRepository.create('retailer-media', {
            title: 'Retailer promotion',
            category: 'retailer',
            owner_type: 'retailer',
            owner_id: 'retailer-one',
            approval_status: 'approved',
            eligible_for_playback: true,
            status: 'ready',
        });

        const response = await screenOnePlayback();

        expect(response.body.slots[0]).toMatchObject({
            presentation_type: 'media',
            counts_as_delivery: false,
            campaign_id: null,
        });
    });

    test('uses approved fallback when Campaign content is rejected', async () => {
        await seedAssignment();
        const loop = await seedLoop();
        await loopRepository.update(loop.id, {
            slots: [{
                position: 0,
                allocated_category: 'paid',
                asset_id: 'expired-campaign-asset',
                campaign_id: 'expired-campaign',
                content_kind: 'campaign',
                is_fallback: false,
                duration: 5,
            }],
        });
        await mediaRepository.create('expired-campaign-asset', {
            title: 'Expired Campaign Creative',
            category: 'paid',
            approval_status: 'approved',
            eligible_for_playback: true,
            status: 'ready',
        });
        await campaignRepository.create('expired-campaign', {
            status: 'rejected',
            retailer_id: 'retailer-one',
            store_id: 'store-toronto',
            asset_id: 'expired-campaign-asset',
            start_date: '2030-07-01',
            end_date: '2030-07-14',
        });
        await mediaRepository.create('campaign-fallback', {
            title: 'Campaign replacement fallback',
            category: 'fallback',
            content_kind: 'neutral_fallback',
            owner_type: 'platform',
            owner_id: null,
            approval_status: 'approved',
            eligible_for_playback: true,
            status: 'ready',
        });

        const response = await screenOnePlayback();

        expect(response.body.slots[0]).toMatchObject({
            allocated_category: 'paid',
            asset_id: 'campaign-fallback',
            campaign_id: null,
            presentation_type: 'fallback',
            counts_as_delivery: false,
            fallback_for_category: 'paid',
        });
    });

    test('uses approved fallback when Campaign content is expired', async () => {
        await seedAssignment();
        const loop = await seedLoop();
        await campaignRepository.update('campaign-0', {
            status: 'approved',
            start_date: '2030-07-01',
            end_date: '2030-07-14',
        });
        await mediaRepository.create('expiry-fallback', {
            title: 'Expiry fallback',
            category: 'fallback',
            content_kind: 'neutral_fallback',
            owner_type: 'platform',
            owner_id: null,
            approval_status: 'approved',
            eligible_for_playback: true,
            status: 'ready',
        });

        const response = await screenOnePlayback();

        expect(response.body.slots[0]).toMatchObject({
            allocated_category: 'paid',
            asset_id: 'expiry-fallback',
            campaign_id: null,
            presentation_type: 'fallback',
            counts_as_delivery: false,
        });
        expect(response.body.loop_id).toBe(loop.id);
    });

    test('uses approved fallback for rejected non-Campaign media', async () => {
        await seedAssignment();
        const loop = await seedLoop();
        await loopRepository.update(loop.id, {
            slots: [{
                position: 0,
                allocated_category: 'retailer',
                asset_id: 'rejected-retailer-media',
                content_kind: 'media',
                campaign_id: null,
                is_fallback: false,
                duration: 5,
            }],
        });
        await mediaRepository.create('rejected-retailer-media', {
            title: 'Rejected retailer media',
            category: 'retailer',
            owner_type: 'retailer',
            owner_id: 'retailer-one',
            approval_status: 'rejected',
            eligible_for_playback: true,
            status: 'ready',
        });
        await mediaRepository.create('media-fallback', {
            title: 'Media fallback',
            category: 'fallback',
            content_kind: 'neutral_fallback',
            owner_type: 'platform',
            owner_id: null,
            approval_status: 'approved',
            eligible_for_playback: true,
            status: 'ready',
        });

        const response = await screenOnePlayback();

        expect(response.body.slots[0]).toMatchObject({
            allocated_category: 'retailer',
            asset_id: 'media-fallback',
            presentation_type: 'fallback',
            counts_as_delivery: false,
        });
    });

    test('uses approved fallback for a Campaign owned by another organization', async () => {
        await seedAssignment();
        await seedLoop();
        await campaignRepository.update('campaign-0', { advertiser_id: 'brand-two' });
        await mediaRepository.create('organization-fallback', {
            title: 'Organization fallback',
            category: 'fallback',
            content_kind: 'neutral_fallback',
            owner_type: 'platform',
            owner_id: null,
            approval_status: 'approved',
            eligible_for_playback: true,
            status: 'ready',
        });

        const response = await screenOnePlayback();

        expect(response.body.slots[0]).toMatchObject({
            allocated_category: 'paid',
            asset_id: 'organization-fallback',
            campaign_id: null,
            presentation_type: 'fallback',
            counts_as_delivery: false,
        });
    });

    test('uses approved fallback for a Campaign targeting another same-Store Screen', async () => {
        await seedAssignment();
        await seedLoop();
        await campaignRepository.update('campaign-0', {
            inventory_selection: [{
                retailer_id: 'retailer-one',
                store_id: 'store-toronto',
                location_id: 'location-entrance',
                screen_id: 'screen-two',
            }],
        });
        await mediaRepository.create('targeting-fallback', {
            title: 'Targeting fallback',
            category: 'fallback',
            content_kind: 'neutral_fallback',
            owner_type: 'platform',
            owner_id: null,
            approval_status: 'approved',
            eligible_for_playback: true,
            status: 'ready',
        });

        const response = await screenOnePlayback();

        expect(response.body.slots[0]).toMatchObject({
            asset_id: 'targeting-fallback',
            presentation_type: 'fallback',
            counts_as_delivery: false,
        });
    });

    test('rejects organization-owned media presented as neutral platform fallback', async () => {
        await seedAssignment();
        const loop = await seedLoop();
        await loopRepository.update(loop.id, {
            slots: [{
                position: 0,
                allocated_category: 'internal',
                asset_id: 'retailer-owned-fallback',
                content_kind: 'fallback',
                is_fallback: true,
                duration: 5,
            }],
        });
        await mediaRepository.create('retailer-owned-fallback', {
            title: 'Not platform neutral',
            category: 'fallback',
            content_kind: 'neutral_fallback',
            owner_type: 'retailer',
            owner_id: 'retailer-one',
            approval_status: 'approved',
            eligible_for_playback: true,
            status: 'ready',
        });

        const response = await screenOnePlayback();

        expect(response.body).toMatchObject({
            schedule_status: 'No approved schedule',
            playback_mode: 'holding_slide',
            counts_as_delivery: false,
        });
    });

    test('rejects an invalid Screen assignment without exposing playback data', async () => {
        await seedAssignment();
        await seedLoop();
        await locationRepository.update('location-entrance', { retailer_id: 'retailer-two' });

        const response = await screenOnePlayback();

        expect(response.status).toBe(409);
        expect(response.body).toEqual({ error: 'Screen assignment is invalid' });
        expect(response.body).not.toHaveProperty('slots');
    });

    test('uses the Holding Slide when an approved loop has no approved fallback for a reserved position', async () => {
        await seedAssignment();
        const loop = await seedLoop();
        await loopRepository.update(loop.id, {
            slots: [{
                position: 0,
                allocated_category: 'internal',
                asset_id: 'unapproved-fallback',
                content_kind: 'fallback',
                is_fallback: true,
                duration: 5,
            }],
        });

        const response = await screenOnePlayback();

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            connectivity_status: 'ONLINE',
            schedule_status: 'No approved schedule',
            playback_mode: 'holding_slide',
            presentation_type: 'holding_slide',
            counts_as_delivery: false,
        });
    });

    test('never substitutes rejected, expired, cross-Store, or cross-organization loops after reload', async () => {
        await seedAssignment();
        const rejected = await seedLoop({ id: 'rejected-current', status: LOOP_STATUS.REJECTED });
        const previousHour = await seedLoop({ id: 'approved-previous-hour', hour: 7 });
        const previousDate = await seedLoop({ id: 'approved-previous-date', date: '2030-07-14' });
        const foreignStore = await seedLoop({ id: 'approved-foreign-store', storeId: 'store-foreign' });
        const foreignOrganization = await seedLoop({
            id: 'approved-foreign-organization',
            retailerId: 'retailer-two',
        });
        await dailyScheduleRepository.save('store-toronto', '2030-07-15', {
            retailer_id: 'retailer-one',
            operating_hours: [8],
            loop_ids: [
                rejected.id,
                previousHour.id,
                previousDate.id,
                foreignStore.id,
                foreignOrganization.id,
            ],
        });

        const firstLoad = await screenOnePlayback();
        const reloaded = await screenOnePlayback();

        expect(firstLoad.body).toMatchObject({
            schedule_status: 'No approved schedule',
            playback_mode: 'holding_slide',
            connectivity_status: 'ONLINE',
        });
        expect(reloaded.body).toEqual(firstLoad.body);
    });
});
