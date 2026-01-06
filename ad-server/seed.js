import { getFirestore, closeFirestore } from './src/utils/firestore.js';
import logger from './src/utils/logger.js';
import {
    userRepository,
    adRepository,
    screenRepository,
    retailerRepository,
    advertiserRepository,
    campaignRepository,
    loopRepository,
    StoreRepository,
    PricingRepository as pricingRepository,
    locationRepository,
    mediaRepository,
    playlistRepository
} from './src/repositories/index.js';
import { PERSONAS } from './src/utils/constants.js';

const ROLES = {
    SUPER_ADMIN: PERSONAS.ADMIN,
    RETAILER_ADMIN: PERSONAS.RETAILER,
    ADVERTISER: PERSONAS.BRAND,
    SOFTOMEDIA_MANAGER: 'manager',
    TECH_OPERATOR: PERSONAS.TECH
};

const seedData = {
    retailers: [
        { id: 'ret_001', name: 'Metro Supermarkets', logo: '🛒', contact_email: 'admin@metrosuper.com', status: 'active' },
        { id: 'ret_002', name: 'FreshMart Express', logo: '🥬', contact_email: 'ops@freshmart.com', status: 'active' },
        { id: 'ret_003', name: 'QuickStop Convenience', logo: '⚡', contact_email: 'manager@quickstop.com', status: 'active' }
    ],
    locations: [
        { id: 'loc_downtown', name: 'Downtown District', type: 'region' },
        { id: 'loc_uptown', name: 'Uptown Mall', type: 'region' },
        { id: 'loc_suburbs', name: 'Suburban Centers', type: 'region' }
    ],
    stores: [
        { id: 'str_001', retailer_id: 'ret_001', name: 'Metro Downtown', address: '123 Main St, NYC', city: 'New York', screen_count: 4, traffic_level: 'high', status: 'active', location_id: 'loc_downtown' },
        { id: 'str_002', retailer_id: 'ret_001', name: 'Metro Midtown', address: '456 5th Ave, NYC', city: 'New York', screen_count: 3, traffic_level: 'high', status: 'active', location_id: 'loc_downtown' },
        { id: 'str_006', retailer_id: 'ret_002', name: 'FreshMart SoHo', address: '111 Prince St, NYC', city: 'New York', screen_count: 2, traffic_level: 'high', status: 'active', location_id: 'loc_downtown' },
        { id: 'str_011', retailer_id: 'ret_003', name: 'QuickStop Penn Station', address: '31st St & 7th Ave, NYC', city: 'New York', screen_count: 2, traffic_level: 'high', status: 'active', location_id: 'loc_downtown' }
    ],
    advertisers: [
        { id: 'adv_001', name: 'TechGear Electronics', industry: 'Electronics', contact_email: 'marketing@techgear.com', budget: 50000, status: 'active' },
        { id: 'adv_002', name: 'NutriBoost Beverages', industry: 'Food & Beverage', contact_email: 'ads@nutriboost.com', budget: 35000, status: 'active' }
    ],
    users: [
        { id: 'admin_001', email: 'admin@demo.com', role: ROLES.SUPER_ADMIN, name: 'Global Admin' },
        { id: 'retailer_001', email: 'retailer@demo.com', role: ROLES.RETAILER_ADMIN, name: 'Retailer Admin', linked_entity_id: 'ret_001' },
        { id: 'advertiser_001', email: 'advertiser@demo.com', role: ROLES.ADVERTISER, name: 'Brand Manager', linked_entity_id: 'adv_001' },
        { id: 'tech_001', email: 'tech@demo.com', role: ROLES.TECH_OPERATOR, name: 'Technical Support' },
    ],
    campaigns: [
        {
            id: 'cmp_001',
            advertiser_id: 'adv_001',
            name: 'TechGear Summer Sale',
            status: 'live',
            creative_url: 'https://picsum.photos/seed/tech1/1920/1080',
            duration: 5,
            start_date: '2026-01-01',
            end_date: '2026-01-31',
            budget: 5000,
            spent: 1250,
            booked_slots: 0
        }
    ],
    media: [
        { id: 'asset_001', filename: 'Summer Sale Banner', file_type: 'image', duration: 10, url: 'https://picsum.photos/seed/sum1/1920/1080' },
        { id: 'asset_002', filename: 'Tech Deal Video', file_type: 'video', duration: 15, url: 'https://www.w3schools.com/html/mov_bbb.mp4' },
        { id: 'asset_003', filename: 'Fashion Promo', file_type: 'image', duration: 10, url: 'https://picsum.photos/seed/fas1/1920/1080' }
    ],
    playlists: [
        {
            id: 'ply_001',
            name: 'Global Morning Rotation',
            description: 'Essential morning announcements',
            status: 'ACTIVE',
            is_global: true,
            assignments: ['ALL'],
            items: [
                { media_id: 'asset_001', duration: 5, order: 1 },
                { media_id: 'asset_003', duration: 5, order: 2 }
            ]
        }
    ],
    screens: [
        { id: 'scr_001_01', screen_id: 'scr_001_01', name: 'Main Lobby Screen', status: 'online', location_id: 'str_001', store_id: 'str_001', retailer_id: 'ret_001', last_seen: new Date().toISOString(), resolution: '1920x1080' },
        { id: 'scr_001_02', screen_id: 'scr_001_02', name: 'Aisle 5 Screen', status: 'online', location_id: 'str_001', store_id: 'str_001', retailer_id: 'ret_001', last_seen: new Date().toISOString(), resolution: '1920x1080' }
    ],
    pricing: {
        id: 'global',
        base_cpm: 2.50,
        traffic_tiers: {
            veryLow: { multiplier: 0.5, label: 'Very Low', color: '#94a3b8', hours: [8, 9, 20, 21] },
            low: { multiplier: 0.75, label: 'Low', color: '#60a5fa', hours: [10, 11, 19] },
            medium: { multiplier: 1.0, label: 'Medium', color: '#fbbf24', hours: [14, 15, 16] },
            high: { multiplier: 1.5, label: 'High', color: '#22c55e', hours: [12, 13, 17, 18] }
        }
    }
};

async function seed() {
    try {
        logger.info('[Seed] Starting Firestore seed...');

        // Initialize Firestore
        getFirestore();

        // Production safety guard
        if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
            logger.error('[Seed] ❌ SEEDING DENIED: Running in production without SEED_ALLOW_PRODUCTION=true');
            process.exit(1);
        }

        const stats = { created: 0, skipped: 0, failed: 0 };

        async function safeCreate(repo, id, data, name) {
            try {
                await repo.create(id, data);
                logger.info(`[Seed] ✅ Created ${name}: ${id}`);
                stats.created++;
            } catch (error) {
                if (error.code === 6 || error.message.includes('already exists')) {
                    logger.info(`[Seed] ⏭️  Skipped ${name} (already exists): ${id}`);
                    stats.skipped++;
                } else {
                    logger.error(`[Seed] ❌ Failed to create ${name}: ${id}`, { error: error.message });
                    stats.failed++;
                }
            }
        }

        // Seed retailers
        logger.info('[Seed] Seeding retailers...');
        for (const retailer of seedData.retailers) {
            await safeCreate(retailerRepository, retailer.id, retailer, 'retailer');
        }

        // Seed locations
        logger.info('[Seed] Seeding locations...');
        for (const loc of seedData.locations) {
            await safeCreate(locationRepository, loc.id, loc, 'location');
        }

        // Seed stores
        logger.info('[Seed] Seeding stores...');
        for (const store of seedData.stores) {
            await safeCreate(StoreRepository, store.id, store, 'store');
        }

        // Seed advertisers
        logger.info('[Seed] Seeding advertisers...');
        for (const advertiser of seedData.advertisers) {
            await safeCreate(advertiserRepository, advertiser.id, advertiser, 'advertiser');
        }

        // Seed users
        logger.info('[Seed] Seeding users...');
        for (const user of seedData.users) {
            await safeCreate(userRepository, user.id, user, 'user');
        }

        // Seed campaigns
        logger.info('[Seed] Seeding campaigns...');
        for (const campaign of seedData.campaigns) {
            await safeCreate(campaignRepository, campaign.id, campaign, 'campaign');
        }

        // Seed media
        logger.info('[Seed] Seeding media assets...');
        for (const asset of seedData.media) {
            await safeCreate(mediaRepository, asset.id, asset, 'media');
        }

        // Seed playlists
        logger.info('[Seed] Seeding playlists...');
        for (const playlist of seedData.playlists) {
            await safeCreate(playlistRepository, playlist.id, playlist, 'playlist');
        }

        // Seed pricing
        logger.info('[Seed] Seeding pricing...');
        await safeCreate(pricingRepository, seedData.pricing.id, seedData.pricing, 'pricing');

        // Seed screens
        logger.info('[Seed] Seeding screens...');
        for (const screen of seedData.screens) {
            await safeCreate(screenRepository, screen.id, screen, 'screen');
        }

        // Generate loops for today
        logger.info('[Seed] Generating loops for today...');
        const today = new Date().toISOString().split('T')[0];
        for (const screen of seedData.screens) {
            for (let hour = 8; hour < 22; hour++) {
                const loopId = `${screen.id}_${today}_${hour}`;
                const slots = Array(12).fill(null).map((_, i) => ({
                    index: i,
                    status: 'available',
                    campaign_id: null,
                    advertiser_id: null,
                    creative_url: null
                }));

                await safeCreate(loopRepository, loopId, {
                    id: loopId,
                    screen_id: screen.id,
                    store_id: screen.store_id,
                    retailer_id: screen.retailer_id,
                    date: today,
                    hour: hour,
                    slots: slots,
                    status: 'APPROVED'
                }, 'loop');
            }
        }

        logger.info('[Seed] ✅ Seed completed!', stats);

    } catch (error) {
        logger.error('[Seed] ❌ Seed failed:', { error: error.message, stack: error.stack });
        process.exit(1);
    } finally {
        await closeFirestore();
    }
}

// Just run it
seed();

export { seed, seedData };
