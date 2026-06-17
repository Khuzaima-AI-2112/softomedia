import { Firestore } from '@google-cloud/firestore';
import logger from './logger.js';

let db = null;
let useMock = false;

export const getFirestore = () => {
    if (db) return db;

    try {
        const projectId = 'softomedia-live-2026';

        const firestoreOptions = {
            projectId: projectId,
            retry: { retries: 1 }
        };
        // Only set keyFilename if explicitly provided.
        // On Cloud Run with Workload Identity, this env var is absent — passing
        // undefined to keyFilename causes the constructor to throw, which triggers
        // mock mode. Omitting it entirely lets the SDK use ADC via metadata server.
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            firestoreOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        }

        db = new Firestore(firestoreOptions);

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
