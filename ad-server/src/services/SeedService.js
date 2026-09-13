import {
    userRepository,
    locationRepository,
    StoreRepository,
    adRepository,
    retailerRepository,
    screenRepository,
    loopRepository
} from '../repositories/index.js';
import { loopGenerationService } from './LoopGenerationService.js';
import { LOOP_STATUS } from '../repositories/LoopRepository.js';
import logger from '../utils/logger.js';

/**
 * Seed Service
 * Populates repositories with MVP data for development and testing.
 *
 * Phase 1: All hardcoded role strings normalised to canonical values:
 *   'admin'  → 'superadmin'
 *   'brand'  → 'advertiser'
 *   'tech'   → 'techoperator'
 *
 * IMPORTANT: seedDatabase() is called inside app.listen() — NOT at module load
 * time — so Jest test imports of `app` do NOT trigger a seed. This prevents
 * the ALREADY_EXISTS Firestore contamination across parallel test suites.
 */

/**
 * Idempotent create — silently skips Firestore ALREADY_EXISTS (gRPC code 6).
 * Safe to call on every server restart; deterministic seed data never changes.
 */
async function createIfAbsent(repo, id, data) {
    try {
        await repo.create(id, data);
    } catch (err) {
        if (err.code === 6 || (err.message && err.message.includes('ALREADY_EXISTS'))) {
            return; // Document already seeded from a previous boot — expected.
        }
        throw err;
    }
}

export async function seedDatabase() {
    try {
        logger.info('Starting database seeding...');

        // 1. Seed Users — Phase 1: role strings normalised
        const users = [
            { id: 'usr_admin_001', email: 'admin@softomedia.com', role: 'superadmin', name: 'Super Admin' },
            { id: 'usr_brand_001', email: 'brand@nike.com', role: 'advertiser', name: 'Brand Manager', linked_entity_id: 'ent_nike' },
            { id: 'usr_retail_001', email: 'manager@costco.com', role: 'retaileradmin', name: 'Retailer Admin', linked_entity_id: 'ent_costco' },
            { id: 'usr_tech_001', email: 'tech@softomedia.com', role: 'techoperator', name: 'Field Tech' }
        ];

        for (const user of users) {
            await createIfAbsent(userRepository, user.id, user);
        }

        // 2. Seed Retailer, Store & Location
        await createIfAbsent(retailerRepository, 'ent_costco', { name: 'Costco Wholesale' });
        await createIfAbsent(StoreRepository, 'store_downtown_01', {
            name: 'Downtown Flagship',
            retailer_id: 'ent_costco',
            location_ids: ['loc_downtown_01'],
            status: 'active'
        });
        await createIfAbsent(locationRepository, 'loc_downtown_01', {
            id: 'loc_downtown_01',
            name: 'Downtown Flagship',
            retailer_id: 'ent_costco',
            store_id: 'store_downtown_01',
            screen_ids: ['demo-screen-01', 'demo-screen-02']
        });

        // 2b. Seed Screens
        await createIfAbsent(screenRepository, 'demo-screen-01', { name: 'Main Entrance Kiosk A', store_id: 'store_downtown_01', location_id: 'loc_downtown_01', status: 'online' });
        await createIfAbsent(screenRepository, 'demo-screen-02', { name: 'Checkout Screen 05', store_id: 'store_downtown_01', location_id: 'loc_downtown_01', status: 'online' });

        // 4. Seed Mock Ads
        await createIfAbsent(adRepository, 'ad_nike_001', {
            title: 'demo-ad.mp4',
            campaign_id: 'cmp_demo_001',
            status: 'approved',
            content_url: 'https://placehold.co/1920x1080?text=8AM%20Slot%20-%20Ad%201',
            scheduled_slot: '08:00 AM'
        });
        await createIfAbsent(adRepository, 'ad_nike_002', {
            title: 'Nike Air Max Flow',
            campaign_id: 'cmp_demo_001',
            status: 'approved',
            content_url: 'https://placehold.co/1920x1080?text=8AM%20Slot%20-%20Ad%202',
            scheduled_slot: '08:00 AM'
        });
        await createIfAbsent(adRepository, 'ad_nike_003', {
            title: 'Afternoon Special',
            campaign_id: 'cmp_demo_001',
            status: 'approved',
            content_url: 'https://placehold.co/1920x1080?text=9AM%20Slot%20Promo',
            scheduled_slot: '09:00 AM'
        });
        await createIfAbsent(adRepository, 'ad_verify_001', {
            title: 'prime-time-ad.mp4',
            campaign_id: 'cmp_demo_001',
            status: 'approved',
            content_url: 'https://placehold.co/1920x1080?text=7PM%20Slot%20-%20A',
            scheduled_slot: '07:00 PM'
        });
        await createIfAbsent(adRepository, 'ad_verify_002', {
            title: 'prime-time-promo.mp4',
            campaign_id: 'cmp_demo_001',
            status: 'approved',
            content_url: 'https://placehold.co/1920x1080?text=7PM%20Slot%20-%20B',
            scheduled_slot: '07:00 PM'
        });
        await createIfAbsent(adRepository, 'ad_allday_001', {
            title: 'softomedia-brand.mp4',
            campaign_id: 'cmp_demo_001',
            status: 'approved',
            content_url: 'https://placehold.co/1920x1080?text=Always%20On%20-%20Softomedia%20Corporate',
            scheduled_slot: 'ALL_DAY'
        });
        await createIfAbsent(adRepository, 'ad_allday_002', {
            title: 'nike-brand-showcase.mp4',
            campaign_id: 'cmp_demo_001',
            status: 'approved',
            content_url: 'https://placehold.co/1920x1080?text=Always%20On%20-%20Nike%20Brand%20Showcase',
            scheduled_slot: 'ALL_DAY'
        });
        await createIfAbsent(adRepository, 'ad_allday_003', {
            title: 'seasonal-retail-promo.mp4',
            campaign_id: 'cmp_demo_001',
            status: 'approved',
            content_url: 'https://placehold.co/1920x1080?text=Always%20On%20-%20Retail%20Seasonal',
            scheduled_slot: 'ALL_DAY'
        });

        logger.info('Database seeding complete.', {
            users: users.length,
            stores: 1,
            locations: 1,
            screens: 2,
            ads: 8
        });

        // 5. Auto-Generate Loops for the current date — fixes "Waiting for Scheduled Slot"
        const currentTargetDate = new Date().toISOString().split('T')[0];
        const currentTargetHour = new Date().getHours();

        logger.info(`Generating loops for ${currentTargetDate} to support Demo Player...`);
        const generatedLoops = await loopGenerationService.generateDailyLoops(currentTargetDate, 'ent_costco', 'store_downtown_01');

        // Approve the loop for the current hour so Demo Player functions immediately
        const currentHourLoops = generatedLoops.filter(l => l.hour === currentTargetHour);
        for (const loop of currentHourLoops) {
            await loopRepository.update(loop.id, {
                status: LOOP_STATUS.APPROVED,
                approved_at: new Date().toISOString(),
                approved_by: 'usr_admin_001',
            });
            logger.info(`Auto-approved current hour loop: ${loop.id}`);
        }

        logger.info('Demo Loops Seeded successfully.');

    } catch (error) {
        logger.error('Seeding failed', { error: error.message });
    }
}
