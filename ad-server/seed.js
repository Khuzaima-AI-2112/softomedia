// Firestore Seed Script
// Populates Firestore with initial test data

import { getFirestore, closeFirestore } from './src/utils/firestore.js';
import {
    userRepository,
    adRepository,
    screenRepository,
    retailerRepository,
    advertiserRepository,
    locationRepository
} from './src/repositories/index.js';
import { ROLES } from './src/utils/constants.js';

const seedData = {
    retailers: [
        { id: 'ret_001', name: 'Demo Retail Corp', logo_url: 'https://placehold.co/200', settings: { theme: 'dark' } }
    ],
    advertisers: [
        { id: 'adv_001', name: 'Global Brands Inc', industry: 'Retail', billing_id: 'BILL_001' }
    ],
    locations: [
        { id: 'loc_001', retailer_id: 'ret_001', name: 'Downtown Store', store_profile: 'flagship' }
    ],
    users: [
        { id: 'admin_001', email: 'admin@demo.com', role: ROLES.SUPER_ADMIN, name: 'Global Admin' },
        { id: 'retailer_001', email: 'retailer@demo.com', role: ROLES.RETAILER_ADMIN, name: 'Retailer Admin', linked_entity_id: 'ret_001' },
        { id: 'advertiser_001', email: 'advertiser@demo.com', role: ROLES.ADVERTISER, name: 'Brand Manager', linked_entity_id: 'adv_001' },
        { id: 'manager_001', email: 'manager@demo.com', role: ROLES.SOFTOMEDIA_MANAGER, name: 'Campaign Manager' },
        { id: 'tech_001', email: 'tech@demo.com', role: ROLES.TECH_OPERATOR, name: 'Technical Support' },
    ],
    ads: [
        { id: 'ad_001', title: 'Demo Coffee', file_path: 'demo_ad_1.png', duration: 5, status: 'approved', advertiser_id: 'adv_001' },
        { id: 'ad_002', title: 'Demo Tech', file_path: 'demo_ad_2.png', duration: 5, status: 'approved', advertiser_id: 'adv_001' },
    ],
    screens: [
        { id: 'demo-screen-01', screen_id: 'demo-screen-01', status: 'active', location_id: 'loc_001', last_seen: new Date().toISOString() }
    ]
};

async function seed() {
    try {
        console.log('[Seed] Starting Firestore seed...');

        // Initialize Firestore
        getFirestore();

        // Seed retailers
        console.log('[Seed] Seeding retailers...');
        for (const retailer of seedData.retailers) {
            const exists = await retailerRepository.exists(retailer.id);
            if (!exists) {
                await retailerRepository.create(retailer.id, retailer);
                console.log(`[Seed] Created retailer: ${retailer.name}`);
            }
        }

        // Seed advertisers
        console.log('[Seed] Seeding advertisers...');
        for (const advertiser of seedData.advertisers) {
            const exists = await advertiserRepository.exists(advertiser.id);
            if (!exists) {
                await advertiserRepository.create(advertiser.id, advertiser);
                console.log(`[Seed] Created advertiser: ${advertiser.name}`);
            }
        }

        // Seed locations
        console.log('[Seed] Seeding locations...');
        for (const location of seedData.locations) {
            const exists = await locationRepository.exists(location.id);
            if (!exists) {
                await locationRepository.create(location.id, location);
                console.log(`[Seed] Created location: ${location.name}`);
            }
        }

        // Seed users
        console.log('[Seed] Seeding users...');
        for (const user of seedData.users) {
            const exists = await userRepository.exists(user.id);
            if (!exists) {
                await userRepository.create(user.id, user);
                console.log(`[Seed] Created user: ${user.email} (${user.role})`);
            } else {
                // Update role if exists to match new role names
                await userRepository.update(user.id, { role: user.role });
                console.log(`[Seed] Updated user role: ${user.email} -> ${user.role}`);
            }
        }

        // Seed ads
        console.log('[Seed] Seeding ads...');
        for (const ad of seedData.ads) {
            const exists = await adRepository.exists(ad.id);
            if (!exists) {
                await adRepository.create(ad.id, ad);
                console.log(`[Seed] Created ad: ${ad.title}`);
            }
        }

        // Seed screens
        console.log('[Seed] Seeding screens...');
        for (const screen of seedData.screens) {
            const exists = await screenRepository.exists(screen.id);
            if (!exists) {
                await screenRepository.create(screen.id, screen);
                console.log(`[Seed] Created screen: ${screen.screen_id}`);
            }
        }

        console.log('[Seed] âœ… Seed completed successfully!');

    } catch (error) {
        console.error('[Seed] âŒ Seed failed:', error);
        process.exit(1);
    } finally {
        await closeFirestore();
    }
}

// Run seed if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    seed();
}

export { seed, seedData };
