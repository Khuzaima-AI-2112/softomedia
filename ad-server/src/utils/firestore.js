// Firestore Database Initialization
// Singleton pattern for Firestore instance

import { Firestore } from '@google-cloud/firestore';

let firestoreInstance = null;

/**
 * Initialize and return Firestore instance
 * Uses singleton pattern to ensure only one connection
 */
export function getFirestore() {
    if (!firestoreInstance) {
        const projectId = process.env.PROJECT_ID || 'softomedia-live2026';

        firestoreInstance = new Firestore({
            projectId,
            // In development, use emulator if FIRESTORE_EMULATOR_HOST is set
            // In production, uses Application Default Credentials
        });

        console.log(`[Firestore] Initialized for project: ${projectId}`);

        // Log emulator usage in development
        if (process.env.FIRESTORE_EMULATOR_HOST) {
            console.log(`[Firestore] Using emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
        }
    }

    return firestoreInstance;
}

/**
 * Close Firestore connection (for graceful shutdown)
 */
export async function closeFirestore() {
    if (firestoreInstance) {
        await firestoreInstance.terminate();
        firestoreInstance = null;
        console.log('[Firestore] Connection closed');
    }
}
