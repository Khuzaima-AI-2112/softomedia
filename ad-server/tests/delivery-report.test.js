import { describe, expect, test } from '@jest/globals';
import { DEFAULT_DAYPARTS } from '../src/services/Dayparts.js';
import { buildDeliveryReport } from '../src/services/DeliveryReport.js';

const loops = [
    { id: 'north-08', retailer_id: 'freshmart', store_id: 'north', date: '2030-01-16', hour: 8 },
    { id: 'north-12', retailer_id: 'freshmart', store_id: 'north', date: '2030-01-16', hour: 12 },
    { id: 'north-16', retailer_id: 'freshmart', store_id: 'north', date: '2030-01-16', hour: 16 },
    { id: 'south-18', retailer_id: 'beanery', store_id: 'south', date: '2030-01-16', hour: 18 },
];
const stores = [
    { id: 'north', retailer_id: 'freshmart' },
    { id: 'south', retailer_id: 'beanery' },
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
    proofs, loops, stores, campaigns, dayparts: DEFAULT_DAYPARTS, scope, ...extra,
});
const slotsOf = cells => Object.fromEntries(Object.entries(cells).map(([column, cell]) => [column, cell.slots]));
const counts = row => ({ campaign_id: row.campaign_id, ...slotsOf(row.dayparts), total: row.total.slots });

describe('Daypart delivery report', () => {
    test('counts each Campaign\'s Proof of Play by the Daypart of its Hourly Loop', () => {
        const { rows, totals } = report({ kind: 'network' });

        expect(rows.map(counts)).toEqual([
            { campaign_id: 'muffin', breakfast: 1, lunch: 0, dinner: 0, outside_dayparts: 0, total: 1 },
            { campaign_id: 'chips', breakfast: 0, lunch: 0, dinner: 1, outside_dayparts: 0, total: 1 },
            { campaign_id: 'cola', breakfast: 2, lunch: 1, dinner: 1, outside_dayparts: 1, total: 5 },
        ]);
        expect(slotsOf(totals)).toEqual({ breakfast: 3, lunch: 1, dinner: 2, outside_dayparts: 1, total: 7 });
    });

    test('names each Campaign and tells a Retailer promotion from paid advertising', () => {
        const { rows } = report({ kind: 'network' });

        expect(rows.map(({ campaign_id, campaign_name, is_retailer_promotion }) => ({ campaign_id, campaign_name, is_retailer_promotion })))
            .toEqual([
                { campaign_id: 'muffin', campaign_name: 'Breakfast muffin', is_retailer_promotion: true },
                { campaign_id: 'chips', campaign_name: 'Chips launch', is_retailer_promotion: false },
                { campaign_id: 'cola', campaign_name: 'Cola summer', is_retailer_promotion: false },
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

        expect(totals.total.slots).toBe(7);
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
        expect(report({ kind: 'retailer', retailerId: 'beanery' }).totals.total.slots).toBe(2);
    });

    test('takes a Store\'s Retailer from the Store, not from the Hourly Loop', () => {
        // A Loop wrongly stamped with FreshMart still plays in the Beanery's Store.
        const misStamped = { id: 'south-09', retailer_id: 'freshmart', store_id: 'south', date: '2030-01-16', hour: 9 };
        const extra = { loops: [...loops, misStamped], proofs: [...proofs, proof('chips', 'south-09')] };

        expect(report({ kind: 'retailer', retailerId: 'freshmart' }, extra).totals.total.slots).toBe(5);
        expect(report({ kind: 'retailer', retailerId: 'beanery' }, extra).totals.total.slots).toBe(3);
    });

    test('shows nothing to a scope it does not recognise', () => {
        expect(report({ kind: 'brand', brandId: null }).rows).toEqual([]);
        expect(report({ kind: 'retailer', retailerId: null }).rows).toEqual([]);
        expect(report(undefined).rows).toEqual([]);
    });
});

describe('Ad Plays', () => {
    // The 08:00 Hourly Loop at North: Paid Slots 9-11 hold a three-file Run of Cola.
    const run = { run_start: 9, run_length: 3 };
    const eightAm = {
        ...loops[0],
        slots: [
            { position: 2, allocated_category: 'retailer', campaign_id: 'muffin' },
            ...[0, 1, 2].map(file => ({
                position: 9 + file, allocated_category: 'paid', campaign_id: 'cola', ...run, run_file: file,
            })),
        ],
    };
    const PASS = Date.parse('2030-01-16T13:00:00.000Z');

    /** The Proof of Play of one Slot, presented `pass` sixty-second passes into the hour. */
    const played = (position, { pass = 0, screen = 'north-screen', campaignId = 'cola', loopId = eightAm.id } = {}) => ({
        ...proof(campaignId, loopId),
        screen_id: screen,
        slot_position: position,
        presentation_started_at: new Date(PASS + pass * 60_000 + position * 5_000).toISOString(),
    });

    const adReport = adProofs => buildDeliveryReport({
        proofs: adProofs, loops: [eightAm], stores, campaigns, dayparts: DEFAULT_DAYPARTS, scope: { kind: 'network' },
    });
    const cola = ({ rows }) => rows.find(row => row.campaign_id === 'cola');

    test('a three-file Run played whole in one pass is 3 Slots and 1 Ad Play', () => {
        const delivered = adReport([played(9), played(10), played(11)]);

        expect(cola(delivered).dayparts.breakfast).toEqual({ slots: 3, ads: 1 });
        expect(cola(delivered).total).toEqual({ slots: 3, ads: 1 });
        expect(delivered.totals.breakfast).toEqual({ slots: 3, ads: 1 });
        expect(delivered.totals.total).toEqual({ slots: 3, ads: 1 });
    });

    test('the same Run on two Screens is 2 Ad Plays', () => {
        const screens = ['north-screen', 'north-screen-2'];
        const delivered = adReport(screens.flatMap(screen => [9, 10, 11].map(position => played(position, { screen }))));

        expect(cola(delivered).total).toEqual({ slots: 6, ads: 2 });
    });

    test('the same Run in two passes of its Hourly Loop is 2 Ad Plays', () => {
        const delivered = adReport([0, 1].flatMap(pass => [9, 10, 11].map(position => played(position, { pass }))));

        expect(cola(delivered).total).toEqual({ slots: 6, ads: 2 });
    });

    test('a single-file Creative in three consecutive Slots is 3 Ad Plays', () => {
        const singles = {
            ...eightAm,
            slots: [9, 10, 11].map(position => ({
                position, allocated_category: 'paid', campaign_id: 'cola', run_start: position, run_length: 1, run_file: 0,
            })),
        };
        const delivered = buildDeliveryReport({
            proofs: [played(9), played(10), played(11)],
            loops: [singles], stores, campaigns, dayparts: DEFAULT_DAYPARTS, scope: { kind: 'network' },
        });

        expect(cola(delivered).total).toEqual({ slots: 3, ads: 3 });
    });

    test('a Run missing one file\'s Proof of Play counts its Slots but no Ad Play', () => {
        expect(cola(adReport([played(9), played(11)])).total).toEqual({ slots: 2, ads: 0 });
    });

    test('each Proof of Play of a Retailer promotion is 1 Slot and 1 Ad Play', () => {
        const delivered = adReport([played(2, { campaignId: 'muffin' }), played(2, { campaignId: 'muffin', pass: 1 })]);

        expect(delivered.rows.find(row => row.campaign_id === 'muffin').total).toEqual({ slots: 2, ads: 2 });
    });

    test('a Paid Slot of an Hourly Loop generated before Runs were recorded counts as a Slot but no Ad Play', () => {
        const before = {
            ...eightAm,
            slots: eightAm.slots.map(({ position, allocated_category, campaign_id }) => ({ position, allocated_category, campaign_id })),
        };
        const delivered = buildDeliveryReport({
            proofs: [played(9), played(10), played(11)],
            loops: [before], stores, campaigns, dayparts: DEFAULT_DAYPARTS, scope: { kind: 'network' },
        });

        expect(cola(delivered).total).toEqual({ slots: 3, ads: 0 });
    });
});
