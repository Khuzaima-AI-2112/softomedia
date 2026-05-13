import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET || 'softomedia-live2026-ads';

export const generateSignedUrl = async (fileName) => {
    try {
        const options = {
            version: 'v4',
            action: 'read',
            expires: Date.now() + 60 * 60 * 1000, // 60 minutes
        };

        const [url] = await storage
            .bucket(BUCKET_NAME)
            .file(fileName)
            .getSignedUrl(options);

        return url;
    } catch (error) {
        console.error('Error generating signed URL:', error);
        // Fallback to public URL if signing fails (e.g. missing permissions in dev)
        return `https://storage.googleapis.com/${BUCKET_NAME}/${fileName}`;
    }
};

/**
 * Upload a local file to Google Cloud Storage.
 * @param {string} localPath - Absolute or relative path to the temp file on disk.
 * @param {string} destinationName - Filename/path to store in GCS.
 * @returns {{ storage_path: string, url: string }}
 */
export const uploadFile = async (localPath, destinationName) => {
    const destPath = `assets/${destinationName}`;
    const bucket = storage.bucket(BUCKET_NAME);

    await bucket.upload(localPath, {
        destination: destPath,
        metadata: {
            cacheControl: 'public, max-age=31536000',
        },
    });

    const file = bucket.file(destPath);
    await file.makePublic();

    return {
        storage_path: destPath,
        url: `https://storage.googleapis.com/${BUCKET_NAME}/${destPath}`,
    };
};
