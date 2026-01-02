import { getFirestore } from '../utils/firestore.js';
import logger from '../utils/logger.js';

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
            const client = db._firestoreClient || db.client; // Handle different SDK versions
            const databasePath = `projects/softomedia-live-2026/databases/(default)`;

            logger.info('Starting Firestore backup', { bucket, databasePath });

            // Using the admin client to trigger export
            // Note: This requires roles/datastore.importExportAdmin
            const [operation] = await db.exportDocuments({
                outputUriPrefix: `gs://${bucket}`,
                collectionIds: [] // Export all
            });

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
