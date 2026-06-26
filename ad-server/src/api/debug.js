import express from 'express';
import { getFirestore } from '../utils/firestore.js';
import { seedDatabase } from '../services/SeedService.js';
import { clearMockStorage } from '../repositories/BaseRepository.js';
import logger from '../utils/logger.js';

const router = express.Router();

const COLLECTIONS = [
    'users',
    'ads',
    'screens',
    'retailers',
    'advertisers',
    'locations',
    'impressions',
    'playlists',
    'campaigns',
    'media',
    'scheduling_audits',
    'loops',
    'stores',
    'pricing',
    'invoices'
];

async function deleteCollection(db, collectionPath, batchSize = 100) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.orderBy('__name__').limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(db, query, resolve) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
        resolve();
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();

    process.nextTick(() => {
        deleteQueryBatch(db, query, resolve);
    });
}

router.post('/reset', async (req, res) => {
    // Safety guard: only allow in non-production or when ALLOW_DEMO_MODE=true
    const isDemoAllowed = process.env.ALLOW_DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production';
    if (!isDemoAllowed) {
        return res.status(403).json({ error: 'Reset denied: Not in development/demo mode' });
    }

    try {
        logger.info('[DebugAPI] Resetting database...');
        
        // 1. Clear Firestore
        const db = getFirestore();
        if (db) {
            for (const collection of COLLECTIONS) {
                await deleteCollection(db, collection);
            }
        }

        // 2. Clear Mock Memory Storage
        clearMockStorage();

        // 3. Reseed
        await seedDatabase();

        logger.info('[DebugAPI] Database reset complete.');
        res.status(200).json({ status: 'success', message: 'Database reset and seeded successfully' });
    } catch (error) {
        logger.error('[DebugAPI] Reset failed', { error: error.message });
        res.status(500).json({ error: 'Database reset failed', details: error.message });
    }
});

router.get('/users', async (req, res) => {
    try {
        const { userRepository } = await import('../repositories/index.js');
        const users = await userRepository.findAll();
        res.json(users);
    } catch(err) {
        res.status(500).json({error: err.message});
    }
});

export default router;
