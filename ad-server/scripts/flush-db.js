import { getFirestore, closeFirestore } from '../src/utils/firestore.js';
import logger from '../src/utils/logger.js';

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
    'pricing'
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

async function flush() {
    try {
        logger.info('[Flush] Starting Firestore flush...');

        // Production safety guard (similar to seed.js)
        if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
            logger.error('[Flush] ❌ FLUSH DENIED: Running in production without SEED_ALLOW_PRODUCTION=true');
            process.exit(1);
        }

        const db = getFirestore();
        if (!db) {
            throw new Error('Could not initialize Firestore');
        }

        for (const collection of COLLECTIONS) {
            logger.info(`[Flush] Deleting collection: ${collection}`);
            await deleteCollection(db, collection);
            logger.info(`[Flush] ✅ Deleted collection: ${collection}`);
        }

        logger.info('[Flush] ✅ Database successfully flushed!');
    } catch (error) {
        logger.error('[Flush] ❌ Flush failed:', { error: error.message, stack: error.stack });
        process.exit(1);
    } finally {
        await closeFirestore();
    }
}

flush();
