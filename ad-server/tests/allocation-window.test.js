import { jest, describe, test, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../src/utils/firestore.js', () => ({
    getFirestore: jest.fn(() => null),
}));

const { LoopGenerationService, SLOT_CONFIG } = await import('../src/services/LoopGenerationService.js');
const { BusinessHoursService } = await import('../src/services/BusinessHoursService.js');
const { clearMockStorage } = await import('../src/repositories/BaseRepository.js');
const { campaignRepository } = await import('../src/repositories/CampaignRepository.js');
const { mediaRepository } = await import('../src/repositories/MediaRepository.js');

describe('five-loop Allocation Window', () => {
    let service;

    beforeEach(() => {
        clearMockStorage();
        jest.restoreAllMocks();
        service = new LoopGenerationService();
    });

    test('reserves exactly 42 Paid, 12 Retailer, and 6 Internal positions', () => {
        const campaigns = [
            { id: 'paid-1', type: 'paid', asset_id: 'paid-asset' },
            { id: 'retailer-1', type: 'retailer', asset_id: 'retailer-asset' },
            { id: 'internal-1', type: 'internal', asset_id: 'internal-asset' },
        ];
        const fallback = { id: 'fallback-asset', title: 'Neutral fallback' };

        const slots = Array.from({ length: 5 }, (_, loopIndex) =>
            service.buildSlots(campaigns, {
                sequenceStart: loopIndex * SLOT_CONFIG.SLOTS_PER_LOOP,
                fallback,
            })
        ).flat();

        expect(slots).toHaveLength(60);
        expect(slots.every((slot, index) =>
            slot.position === index % 12 && slot.duration === 5
        )).toBe(true);
        expect(slots.reduce((counts, slot) => ({
            ...counts,
            [slot.allocated_category]: (counts[slot.allocated_category] || 0) + 1,
        }), {})).toEqual({ paid: 42, retailer: 12, internal: 6 });
    });

    test('continues persisted sequence across open hours and a closed day', async () => {
        const campaigns = [
            { id: 'paid-1', type: 'paid', asset_id: 'paid-asset' },
            { id: 'retailer-1', type: 'retailer', asset_id: 'retailer-asset' },
            { id: 'internal-1', type: 'internal', asset_id: 'internal-asset' },
        ];
        jest.spyOn(BusinessHoursService, 'getEffectiveHours').mockImplementation(async (_storeId, date) => {
            if (date === '2030-01-02') return { is_closed: true };
            if (date === '2030-01-01') return { is_closed: false, open_time: '08:00', close_time: '10:00' };
            return { is_closed: false, open_time: '08:00', close_time: '11:00' };
        });
        jest.spyOn(service, 'getAvailableContent').mockResolvedValue(campaigns);

        const firstDay = await service.generateDailyLoops('2030-01-01', 'retailer-1', 'store-1');
        expect(firstDay.map(loop => loop.slots[0].allocation_sequence_position)).toEqual([0, 12]);

        const reloadedService = new LoopGenerationService();
        jest.spyOn(reloadedService, 'getAvailableContent').mockResolvedValue(campaigns);
        expect(await reloadedService.generateDailyLoops('2030-01-02', 'retailer-1', 'store-1')).toEqual([]);

        const thirdDay = await reloadedService.generateDailyLoops('2030-01-03', 'retailer-1', 'store-1');
        expect(thirdDay.map(loop => loop.slots[0].allocation_sequence_position)).toEqual([24, 36, 48]);
    });

    test('uses approved neutral fallback without reassigning a deficient category', async () => {
        jest.spyOn(BusinessHoursService, 'getEffectiveHours').mockResolvedValue({
            is_closed: false,
            open_time: '08:00',
            close_time: '09:00',
        });
        await campaignRepository.create('paid-1', {
            type: 'paid',
            asset_id: 'paid-asset',
            status: 'approved',
            retailer_id: 'retailer-1',
            store_id: 'store-1',
            start_date: '2030-01-01',
            end_date: '2030-01-31',
        });
        await mediaRepository.create('paid-asset', {
            category: 'paid', approval_status: 'approved', eligible_for_playback: true,
            owner_type: 'brand', owner_id: 'brand-1', status: 'ready',
        });
        await mediaRepository.create('fallback-asset', {
            title: 'Approved neutral fallback',
            category: 'fallback',
            content_kind: 'neutral_fallback',
            owner_type: 'platform',
            owner_id: null,
            approval_status: 'approved',
            eligible_for_playback: true,
            status: 'ready',
        });

        const [loop] = await service.generateDailyLoops('2030-01-04', 'retailer-1', 'store-1');
        const reservedRetailer = loop.slots.find(slot => slot.allocated_category === 'retailer');

        expect(reservedRetailer).toMatchObject({
            allocated_category: 'retailer',
            asset_id: 'fallback-asset',
            campaign_id: null,
            content_kind: 'fallback',
            is_fallback: true,
        });
    });

    test('uses eligible category media and excludes Campaigns selected for another Store', async () => {
        await mediaRepository.create('local-paid', {
            category: 'paid', approval_status: 'approved', eligible_for_playback: true,
            owner_type: 'brand', owner_id: 'brand-1', status: 'ready',
        });
        await mediaRepository.create('other-paid', {
            category: 'paid', approval_status: 'approved', eligible_for_playback: true,
            owner_type: 'brand', owner_id: 'brand-2', status: 'ready',
        });
        await mediaRepository.create('retailer-media', {
            category: 'retailer', approval_status: 'approved', eligible_for_playback: true,
            owner_type: 'retailer', owner_id: 'retailer-1', status: 'ready',
        });
        await mediaRepository.create('internal-media', {
            category: 'internal', approval_status: 'approved', eligible_for_playback: true,
            owner_type: 'platform', owner_id: null, status: 'ready',
        });
        await campaignRepository.create('local-campaign', {
            media_id: 'local-paid', status: 'approved',
            start_date: '2030-01-01', end_date: '2030-01-31',
            inventory_selection: [{ retailer_id: 'retailer-1', store_id: 'store-1' }],
        });
        await campaignRepository.create('other-campaign', {
            media_id: 'other-paid', status: 'approved',
            start_date: '2030-01-01', end_date: '2030-01-31',
            inventory_selection: [{ retailer_id: 'retailer-2', store_id: 'store-2' }],
        });
        await campaignRepository.create('missing-media-campaign', {
            media_id: 'missing-media', status: 'approved',
            start_date: '2030-01-01', end_date: '2030-01-31',
            inventory_selection: [{ retailer_id: 'retailer-1', store_id: 'store-1' }],
        });

        const content = await service.getAvailableContent('retailer-1', 'store-1', '2030-01-04');

        expect(content.map(item => item.asset_id).sort()).toEqual([
            'internal-media', 'local-paid', 'retailer-media'
        ]);
        expect(content.find(item => item.asset_id === 'retailer-media')).toMatchObject({
            type: 'retailer', campaign_id: null, content_kind: 'media',
        });
        expect(content.some(item => item.asset_id === 'missing-media')).toBe(false);
    });

    test('generates only whole hourly loops inside minute-level operating hours', () => {
        expect(BusinessHoursService.getOperatingHourRange({
            is_closed: false, open_time: '08:30', close_time: '22:30',
        })).toEqual({ start: 9, end: 22, is_closed: false, total_loops: 13 });
    });
});
