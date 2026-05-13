import { Firestore } from '@google-cloud/firestore';
import { logger } from './logger.js';

let db = null;
let useMock = false;

export const getFirestore = () => {
    if (db) return db;

    try {
        const config = {
            projectId: 'softomedia-live-2026',
            retry: { retries: 1 }
        };

        // Only set keyFilename if explicitly provided (local dev only)
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            config.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        }

        db = new Firestore(config);

        logger.info('Firestore initialized', { projectId: config.projectId });
        return db;
    } catch (error) {
        logger.error('Firestore initialization failed, switching to mock mode', { error: error.message });
        useMock = true;
        return null;
    }
};

export const isMockMode = () => useMock;

export const closeFirestore = async () => {
    if (db) {
        await db.terminate();
        db = null;
    }
};
