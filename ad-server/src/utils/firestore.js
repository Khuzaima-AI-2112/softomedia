import { Firestore } from '@google-cloud/firestore';
import logger from './logger.js';

let db = null;
let useMock = false;

export const getFirestore = () => {
    if (db) return db;

    try {
        if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.NODE_ENV !== 'production') {
            logger.warn('No GOOGLE_APPLICATION_CREDENTIALS found. Using in-memory mock mode.');
            useMock = true;
            return null;
        }

        db = new Firestore({
            projectId: 'softomedia-live-2026',
            keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            retry: { retries: 1 }
        });

        return db;
    } catch (error) {
        logger.error('Firestore initialization failed, switching to mock mode', { error: error.message });
        useMock = true;
        return null;
    }
};

export const isMockMode = () => useMock;
