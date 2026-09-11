import { describe, expect, test } from '@jest/globals';

const {
    DEMO_RESET_SCOPE,
    DEMO_STORAGE_PREFIX,
    buildDemoBaseline,
} = await import('../src/services/DemoBaseline.js');

function recordsByCollection(baseline, collection) {
    return baseline.documents.filter(document => document.collection === collection);
}

describe('deterministic Phase 1 demo baseline', () => {
    test('builds the accepted organization, media, and relative-date fixture set', () => {
        const baseline = buildDemoBaseline({
            resetAt: new Date('2030-01-15T10:30:00.000Z'),
            bucketName: 'softomedia-demo-assets',
        });

        const advertisers = recordsByCollection(baseline, 'advertisers');
        const retailers = recordsByCollection(baseline, 'retailers');
        const stores = recordsByCollection(baseline, 'stores');
        const locations = recordsByCollection(baseline, 'locations');
        const screens = recordsByCollection(baseline, 'screens');
        const media = recordsByCollection(baseline, 'media');
        const campaigns = recordsByCollection(baseline, 'campaigns');
        const loops = recordsByCollection(baseline, 'loops');

        expect(retailers).toHaveLength(2);
        expect(stores.map(({ data }) => data.time_zone)).toEqual([
            'America/Toronto',
            'America/Phoenix',
        ]);
        expect(locations.filter(({ data }) => data.store_id === 'demo-store-mtl-north')).toHaveLength(2);
        expect(screens.filter(({ data }) => data.store_id === 'demo-store-mtl-north')).toHaveLength(2);
        expect(screens.filter(({ data }) => data.store_id === 'demo-store-phoenix')).toHaveLength(1);

        expect(media.map(({ data }) => data.category)).toEqual([
            'paid',
            'retailer',
            'internal',
            'fallback',
        ]);
        expect(media.every(({ data }) => data.status === 'approved')).toBe(true);
        expect(media.map(({ data }) => data.storage_path)).toEqual(
            baseline.storageObjects.map(object => `gs://softomedia-demo-assets/${object.name}`)
        );
        expect(baseline.storageObjects.every(object => object.name.startsWith(DEMO_STORAGE_PREFIX))).toBe(true);

        expect(campaigns).toHaveLength(2);
        expect(campaigns.every(({ data }) => data.advertiser_id === 'demo-advertiser-secondary')).toBe(true);
        expect(campaigns.map(({ data }) => [data.start_date, data.end_date])).toEqual([
            ['2030-01-16', '2030-01-29'],
            ['2030-01-22', '2030-02-05'],
        ]);
        expect(loops).toHaveLength(1);
        expect(loops[0].data.date).toBe('2030-01-16');
        expect(loops[0].data.slots).toHaveLength(12);

        expect([...advertisers, ...retailers].every(({ data }) => !('deleted_at' in data))).toBe(true);

        expect(baseline.documents.every(({ data }) => data.demo_reset_scope === DEMO_RESET_SCOPE)).toBe(true);
        expect(JSON.stringify(baseline)).not.toMatch(/password|token|secret|service.?account/i);
        expect(buildDemoBaseline({
            resetAt: new Date('2030-01-15T10:30:00.000Z'),
            bucketName: 'softomedia-demo-assets',
        })).toEqual(baseline);
    });
});
