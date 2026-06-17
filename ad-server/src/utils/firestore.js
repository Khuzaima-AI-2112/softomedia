import { Firestore } from '@google-cloud/firestore';
import logger from './logger.js';

let db = null;
let useMock = false;

export const getFirestore = () => {
    if (db) return db;

    try {
        // Only force mock if we're not in production AND not even trying a project ID
        // Note: softomedia-live-2026 is hardcoded here for safety
        const projectId = 'softomedia-live-2026';

        db = new Firestore({
            projectId: projectId,
            keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS, // Can be undefined
            retry: { retries: 1 }
        });

        logger.info('Firestore initialized', { projectId });
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
