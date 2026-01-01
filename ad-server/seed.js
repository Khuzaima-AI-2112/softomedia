// Firestore Seed Script
// Populates Firestore with initial test data

import { getFirestore, closeFirestore } from './src/utils/firestore.js';
import { userRepository, adRepository, screenRepository } from './src/repositories/index.js';

const seedData = {
    users: [
        { id: 'admin_001', email: 'admin@demo.com', role: 'admin', name: 'Admin User' },
        { id: 'brand_001', email: 'brand@demo.com', role: 'brand', name: 'Demo Brand', linked_entity_id: 'demo_corp' },
        { id: 'retailer_001', email: 'retailer@demo.com', role: 'retailer', name: 'Demo Retailer', linked_entity_id: 'demo-screen-01' },
    ],
    ads: [
        { id: 'ad_001', title: 'Demo Coffee', file_path: 'demo_ad_1.png', duration: 5, status: 'approved' },
        { id: 'ad_002', title: 'Demo Tech', file_path: 'demo_ad_2.png', duration: 5, status: 'approved' },
        { id: 'ad_003', title: 'Demo Travel', file_path: 'demo_ad_3.png', duration: 5, status: 'approved' },
        { id: 'ad_004', title: 'Costco Savings', file_path: 'demo_ad_costco.png', duration: 5, status: 'approved' },
        { id: 'ad_005', title: 'Fresh Pizza', file_path: 'demo_ad_pizza.png', duration: 5, status: 'approved' },
        { id: 'ad_006', title: 'Seasonal Sale', file_path: 'seasonal_sale.png', duration: 5, status: 'approved' },
        { id: 'ad_007', title: 'Bakery Fresh', file_path: 'bakery_fresh.png', duration: 5, status: 'approved' },
    ],
    screens: [
        { id: 'demo-screen-01', screen_id: 'demo-screen-01', status: 'active', last_seen: new Date().toISOString() }
    ]
};

async function seed() {
    try {
        console.log('[Seed] Starting Firestore seed...');

        // Initialize Firestore
        getFirestore();

        // Seed users
        console.log('[Seed] Seeding users...');
        for (const user of seedData.users) {
            const exists = await userRepository.exists(user.id);
            if (!exists) {
                await userRepository.create(user.id, user);
                console.log(`[Seed] Created user: ${user.email}`);
            } else {
                console.log(`[Seed] User already exists: ${user.email}`);
            }
        }

        // Seed ads
        console.log('[Seed] Seeding ads...');
        for (const ad of seedData.ads) {
            const exists = await adRepository.exists(ad.id);
            if (!exists) {
                await adRepository.create(ad.id, ad);
                console.log(`[Seed] Created ad: ${ad.title}`);
            } else {
                console.log(`[Seed] Ad already exists: ${ad.title}`);
            }
        }

        // Seed screens
        console.log('[Seed] Seeding screens...');
        for (const screen of seedData.screens) {
            const exists = await screenRepository.exists(screen.id);
            if (!exists) {
                await screenRepository.create(screen.id, screen);
                console.log(`[Seed] Created screen: ${screen.screen_id}`);
            } else {
                console.log(`[Seed] Screen already exists: ${screen.screen_id}`);
            }
        }

        console.log('[Seed] ✅ Seed completed successfully!');

    } catch (error) {
        console.error('[Seed] ❌ Seed failed:', error);
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
