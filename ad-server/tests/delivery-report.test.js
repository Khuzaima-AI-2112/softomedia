import { describe, expect, test } from '@jest/globals';
import { DEFAULT_DAYPARTS } from '../src/services/Dayparts.js';
import { buildDeliveryReport } from '../src/services/DeliveryReport.js';

const loops = [
    { id: 'north-08', retailer_id: 'freshmart', store_id: 'north', date: '2030-01-16', hour: 8 },
    { id: 'north-12', retailer_id: 'freshmart', store_id: 'north', date: '2030-01-16', hour: 12 },
    { id: 'north-16', retailer_id: 'freshmart', store_id: 'north', date: '2030-01-16', hour: 16 },
    { id: 'south-18', retailer_id: 'beanery', store_id: 'south', date: '2030-01-16', hour: 18 },
];
const campaigns = [
    { id: 'cola', name: 'Cola summer', brand_id: 'fizz' },
    { id: 'chips', name: 'Chips launch', advertiser_id: 'crunch' },
    { id: 'muffin', name: 'Breakfast muffin', type: 'retailer', retailer_id: 'freshmart' },
];

let sequence = 0;
const proof = (campaignId, loopId) => ({
    id: `pop-${++sequence}`,
    campaign_id: campaignId,
    loop_id: loopId,
    playback_kind: 'campaign_delivery',
});

const proofs = [
    proof('cola', 'north-08'),
    proof('cola', 'north-08'),
    proof('cola', 'north-12'),
    proof('cola', 'north-16'),
    proof('cola', 'south-18'),
    proof('chips', 'south-18'),
    proof('muffin', 'north-08'),
];

const report = (scope, extra = {}) => buildDeliveryReport({
    proofs, loops, campaigns, dayparts: DEFAULT_DAYPARTS, scope, ...extra,
});
const counts = row => ({ campaign_id: row.campaign_id, ...row.dayparts, total: row.total });

describe('Daypart delivery report', () => {
    test('counts each Campaign\'s Proof of Play by the Daypart of its Hourly Loop', () => {
        const { rows, totals } = report({ kind: 'network' });

        expect(rows.map(counts)).toEqual([
            { campaign_id: 'muffin', breakfast: 1, lunch: 0, dinner: 0, outside_dayparts: 0, total: 1 },
            { campaign_id: 'chips', breakfast: 0, lunch: 0, dinner: 1, outside_dayparts: 0, total: 1 },
            { campaign_id: 'cola', breakfast: 2, lunch: 1, dinner: 1, outside_dayparts: 1, total: 5 },
        ]);
        expect(totals).toEqual({ breakfast: 3, lunch: 1, dinner: 2, outside_dayparts: 1, total: 7 });
    });

    test('names each Campaign and tells a Retailer promotion from paid advertising', () => {
        const { rows } = report({ kind: 'network' });

        expect(rows.map(({ campaign_id, campaign_name, is_promotion }) => ({ campaign_id, campaign_name, is_promotion })))
            .toEqual([
                { campaign_id: 'muffin', campaign_name: 'Breakfast muffin', is_promotion: true },
                { campaign_id: 'chips', campaign_name: 'Chips launch', is_promotion: false },
                { campaign_id: 'cola', campaign_name: 'Cola summer', is_promotion: false },
            ]);
    });

    test('never counts Fallback Content or other playback that is not Campaign delivery', () => {
        const { totals } = report({ kind: 'network' }, {
            proofs: [
                ...proofs,
                { ...proof(null, 'north-08'), playback_kind: 'fallback' },
                { ...proof('cola', 'north-08'), playback_kind: undefined },
                { ...proof('cola', 'north-08'), is_fallback: true },
            ],
        });

        expect(totals.total).toBe(7);
    });

    test('follows the Super Administrator\'s Dayparts', () => {
        const { rows } = report({ kind: 'network' }, {
            dayparts: { ...DEFAULT_DAYPARTS, lunch: { start: 11, end: 17 } },
        });

        expect(counts(rows.find(row => row.campaign_id === 'cola')))
            .toEqual({ campaign_id: 'cola', breakfast: 2, lunch: 2, dinner: 1, outside_dayparts: 0, total: 5 });
    });

    test('shows a Brand only its own Campaigns', () => {
        expect(report({ kind: 'brand', brandId: 'crunch' }).rows.map(counts)).toEqual([
            { campaign_id: 'chips', breakfast: 0, lunch: 0, dinner: 1, outside_dayparts: 0, total: 1 },
        ]);
        expect(report({ kind: 'brand', brandId: 'nobody' }).rows).toEqual([]);
    });

    test('shows a Retailer Administrator only delivery in its own Stores', () => {
        expect(report({ kind: 'retailer', retailerId: 'freshmart' }).rows.map(counts)).toEqual([
            { campaign_id: 'muffin', breakfast: 1, lunch: 0, dinner: 0, outside_dayparts: 0, total: 1 },
            { campaign_id: 'cola', breakfast: 2, lunch: 1, dinner: 0, outside_dayparts: 1, total: 4 },
        ]);
        expect(report({ kind: 'retailer', retailerId: 'beanery' }).totals.total).toBe(2);
    });

    test('shows nothing to a scope it does not recognise', () => {
        expect(report({ kind: 'brand', brandId: null }).rows).toEqual([]);
        expect(report({ kind: 'retailer', retailerId: null }).rows).toEqual([]);
        expect(report(undefined).rows).toEqual([]);
    });
});
