export const DEMO_RESET_SCOPE = 'phase-1-demo';
export const DEMO_RESET_SCOPE_FIELD = 'demo_reset_scope';
export const DEMO_STORAGE_PREFIX = 'phase-1-demo/';
export const DEMO_BUSINESS_COLLECTIONS = Object.freeze([
    'ads',
    'advertisers',
    'campaigns',
    'daily_schedules',
    'impressions',
    'invoices',
    'locations',
    'loops',
    'media',
    'notifications',
    'playlists',
    'pricing_config',
    'proof_of_play',
    'retailers',
    'scheduling_audits',
    'screens',
    'store_default_hours',
    'store_special_hours',
    'stores',
    'support_tickets',
    'tickets',
]);

const SYNTHETIC_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
);

function isoDateDaysAfter(resetAt, days) {
    const date = new Date(resetAt.getTime());
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function record(collection, id, data, resetAtIso) {
    return {
        collection,
        id,
        data: {
            id,
            ...data,
            [DEMO_RESET_SCOPE_FIELD]: DEMO_RESET_SCOPE,
            created_at: resetAtIso,
            updated_at: resetAtIso,
        },
    };
}

function mediaFixture({ id, category, ownerType, ownerId, bucketName, resetAtIso }) {
    const objectName = `${DEMO_STORAGE_PREFIX}media/${category}.png`;
    return {
        document: record('media', id, {
            filename: `${category}-synthetic-demo.png`,
            title: `Synthetic Demo ${category[0].toUpperCase()}${category.slice(1)} Media`,
            category,
            content_kind: category === 'fallback' ? 'neutral_fallback' : 'campaign',
            duration: 5,
            file_type: 'image/png',
            owner_type: ownerType,
            owner_id: ownerId,
            status: 'approved',
            is_fallback: category === 'fallback',
            storage_path: `gs://${bucketName}/${objectName}`,
            url: `https://storage.googleapis.com/${bucketName}/${objectName}`,
        }, resetAtIso),
        storageObject: {
            name: objectName,
            body: SYNTHETIC_PNG,
            metadata: {
                contentType: 'image/png',
                cacheControl: 'public, max-age=300',
                metadata: {
                    demoResetScope: DEMO_RESET_SCOPE,
                    mediaCategory: category,
                },
            },
        },
    };
}

export function buildDemoBaseline({ resetAt = new Date(), bucketName }) {
    if (!(resetAt instanceof Date) || Number.isNaN(resetAt.getTime())) {
        throw new Error('resetAt must be a valid Date');
    }
    if (!bucketName) {
        throw new Error('A demo assets bucket name is required');
    }

    const resetAtIso = resetAt.toISOString();
    const mediaFixtures = [
        mediaFixture({ id: 'demo-media-paid', category: 'paid', ownerType: 'brand', ownerId: 'demo-advertiser-secondary', bucketName, resetAtIso }),
        mediaFixture({ id: 'demo-media-retailer', category: 'retailer', ownerType: 'retailer', ownerId: 'demo-retailer-freshmart', bucketName, resetAtIso }),
        mediaFixture({ id: 'demo-media-internal', category: 'internal', ownerType: 'platform', ownerId: null, bucketName, resetAtIso }),
        mediaFixture({ id: 'demo-media-fallback', category: 'fallback', ownerType: 'platform', ownerId: null, bucketName, resetAtIso }),
    ];

    const documents = [
        record('advertisers', 'demo-advertiser-bonvie', {
            name: 'BonVie Synthetic Brand',
            industry: 'Synthetic Packaged Goods',
            contactemail: 'brand@demo.softomedia.test',
            budget: 10000,
            status: 'active',
            deleted_at: null,
        }, resetAtIso),
        record('advertisers', 'demo-advertiser-secondary', {
            name: 'Northstar Synthetic Brand',
            industry: 'Synthetic Household Goods',
            contactemail: 'brand-secondary@demo.softomedia.test',
            budget: 8000,
            status: 'active',
            deleted_at: null,
        }, resetAtIso),
        record('retailers', 'demo-retailer-freshmart', {
            name: 'FreshMart Synthetic Retailer',
            contact_email: 'retaileradmin@demo.softomedia.test',
            contract_start: isoDateDaysAfter(resetAt, -30),
            status: 'active',
            deleted_at: null,
        }, resetAtIso),
        record('retailers', 'demo-retailer-secondary', {
            name: 'HarborCart Synthetic Retailer',
            contact_email: 'retaileradmin-secondary@demo.softomedia.test',
            contract_start: isoDateDaysAfter(resetAt, -30),
            status: 'active',
            deleted_at: null,
        }, resetAtIso),
        record('stores', 'demo-store-mtl-north', {
            name: 'FreshMart North Synthetic Store',
            retailer_id: 'demo-retailer-freshmart',
            city: 'Montréal',
            country: 'CA',
            address: '100 Demo Way',
            time_zone: 'America/Toronto',
            location_ids: ['demo-location-mtl-entrance', 'demo-location-mtl-checkout'],
            status: 'active',
        }, resetAtIso),
        record('stores', 'demo-store-phoenix', {
            name: 'HarborCart Desert Synthetic Store',
            retailer_id: 'demo-retailer-secondary',
            city: 'Phoenix',
            country: 'US',
            address: '200 Example Avenue',
            time_zone: 'America/Phoenix',
            location_ids: ['demo-location-phoenix-entrance'],
            status: 'active',
        }, resetAtIso),
        record('locations', 'demo-location-mtl-entrance', {
            name: 'Entrance Placement',
            retailer_id: 'demo-retailer-freshmart',
            store_id: 'demo-store-mtl-north',
            screen_ids: ['demo-screen-north-1'],
        }, resetAtIso),
        record('locations', 'demo-location-mtl-checkout', {
            name: 'Checkout Placement',
            retailer_id: 'demo-retailer-freshmart',
            store_id: 'demo-store-mtl-north',
            screen_ids: ['demo-screen-north-2'],
        }, resetAtIso),
        record('locations', 'demo-location-phoenix-entrance', {
            name: 'Entrance Placement',
            retailer_id: 'demo-retailer-secondary',
            store_id: 'demo-store-phoenix',
            screen_ids: ['demo-screen-secondary-1'],
        }, resetAtIso),
        record('screens', 'demo-screen-north-1', {
            name: 'North Entrance Synthetic Screen',
            retailer_id: 'demo-retailer-freshmart',
            store_id: 'demo-store-mtl-north',
            location_id: 'demo-location-mtl-entrance',
            resolution: '1920x1080',
            orientation: 'landscape',
            status: 'OFFLINE',
            last_seen: null,
        }, resetAtIso),
        record('screens', 'demo-screen-north-2', {
            name: 'North Checkout Synthetic Screen',
            retailer_id: 'demo-retailer-freshmart',
            store_id: 'demo-store-mtl-north',
            location_id: 'demo-location-mtl-checkout',
            resolution: '1920x1080',
            orientation: 'landscape',
            status: 'OFFLINE',
            last_seen: null,
        }, resetAtIso),
        record('screens', 'demo-screen-secondary-1', {
            name: 'Desert Entrance Synthetic Screen',
            retailer_id: 'demo-retailer-secondary',
            store_id: 'demo-store-phoenix',
            location_id: 'demo-location-phoenix-entrance',
            resolution: '1920x1080',
            orientation: 'landscape',
            status: 'OFFLINE',
            last_seen: null,
        }, resetAtIso),
        ...mediaFixtures.map(fixture => fixture.document),
        record('campaigns', 'demo-secondary-campaign-1', {
            name: 'Northstar Pantry Synthetic Campaign',
            advertiser_id: 'demo-advertiser-secondary',
            retailer_id: 'demo-retailer-secondary',
            media_id: 'demo-media-paid',
            creative_url: `https://storage.googleapis.com/${bucketName}/${DEMO_STORAGE_PREFIX}media/paid.png`,
            status: 'approved',
            visibility: 'private',
            start_date: isoDateDaysAfter(resetAt, 1),
            end_date: isoDateDaysAfter(resetAt, 14),
            budget: 2400,
        }, resetAtIso),
        record('campaigns', 'demo-secondary-campaign-2', {
            name: 'Northstar Home Synthetic Campaign',
            advertiser_id: 'demo-advertiser-secondary',
            retailer_id: 'demo-retailer-secondary',
            media_id: 'demo-media-paid',
            creative_url: `https://storage.googleapis.com/${bucketName}/${DEMO_STORAGE_PREFIX}media/paid.png`,
            status: 'pending_approval',
            visibility: 'private',
            start_date: isoDateDaysAfter(resetAt, 7),
            end_date: isoDateDaysAfter(resetAt, 21),
            budget: 1800,
        }, resetAtIso),
    ];

    return {
        resetAt: resetAtIso,
        documents,
        storageObjects: mediaFixtures.map(fixture => fixture.storageObject),
    };
}
