import { Storage } from '@google-cloud/storage';
import path from 'path';

let storage;

/**
 * Get or initialize GCS storage client
 */
export const getStorageClient = () => {
    if (!storage) {
        // Gates cloud resource initialization for local/test environments
        if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.NODE_ENV !== 'production') {
            console.warn('[Storage] GOOGLE_APPLICATION_CREDENTIALS missing, storage client disabled');
            return null;
        }
        storage = new Storage();
    }
    return storage;
};

/**
 * Upload a file to GCS
 * @param {string} localPath - Path to local file
 * @param {string} destination - Destination path in bucket
 * @param {string} bucketName - Target bucket name
 */
export const uploadFile = async (localPath, destination, bucketName = 'softomedia-live-2026-assets') => {
    const client = getStorageClient();
    if (!client) {
        const normalizedPath = localPath.replace(/\\/g, '/');
        return {
            url: `http://localhost:8080/${normalizedPath}`, // Fallback for local dev
            storage_path: localPath
        };
    }

    try {
        const bucket = client.bucket(bucketName);
        const [file] = await bucket.upload(localPath, {
            destination: destination,
            metadata: {
                cacheControl: 'public, max-age=3600',
            },
        });

        // Make the file publicly readable for simpler MVP access
        // In production, we'd use signed URLs
        await file.makePublic();

        return {
            url: `https://storage.googleapis.com/${bucketName}/${destination}`,
            storage_path: `gs://${bucketName}/${destination}`
        };
    } catch (error) {
        console.error('[Storage] Upload failed:', error);
        throw error;
    }
};
