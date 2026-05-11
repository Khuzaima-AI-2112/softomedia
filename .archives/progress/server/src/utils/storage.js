import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const BUCKET_NAME = 'softomedia-live2026-ads';

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
