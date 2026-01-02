import { getFirestore } from '../utils/firestore.js';
import logger from '../utils/logger.js';
import { withRetry } from '../utils/ResilienceUtility.js';

export class BackupService {
    /**
     * Trigger a Firestore export to a GCS bucket
     * @param {string} bucket - GCS bucket name (e.g., 'gs://softomedia-backups')
     * @returns {Promise<object>} - Operation metadata
     */
    async exportDatabase(bucket = 'softomedia-live-2026-backups') {
        const db = getFirestore();
        if (!db) {
            throw new Error('Firestore not initialized');
        }

        try {
            const databasePath = 'projects/softomedia-live-2026/databases/(default)';
            logger.info('Starting Firestore backup', { bucket, databasePath });

            // Using withRetry to handle transient initiation failures
            const [operation] = await withRetry(() => db.exportDocuments({
                outputUriPrefix: `gs://${bucket}`,
                collectionIds: [] // Export all
            }), { maxRetries: 2, baseDelayMs: 500 });

            logger.info('Firestore backup operation started', { operationId: operation.name });
            return {
                status: 'started',
                operationId: operation.name,
                bucket
            };
        } catch (error) {
            logger.error('Firestore backup failed to start', { error: error.message });
            throw error;
        }
    }
}

export const backupService = new BackupService();
