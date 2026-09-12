import { Storage } from '@google-cloud/storage';
import fs from 'fs';
import path from 'path';

let storage;

export const getStorageClient = () => {
    if (!storage) {
        const projectId = process.env.GOOGLE_CLOUD_PROJECT
            || process.env.GCLOUD_PROJECT
            || process.env.FIREBASE_PROJECT_ID;

        if (
            !process.env.STORAGE_EMULATOR_HOST
            && !process.env.GOOGLE_APPLICATION_CREDENTIALS
            && process.env.NODE_ENV !== 'production'
        ) {
            return null;
        }
        storage = new Storage({ projectId });
    }
    return storage;
};

function assetsBucketName() {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT
        || process.env.GCLOUD_PROJECT
        || process.env.FIREBASE_PROJECT_ID;
    return process.env.DEMO_ASSETS_BUCKET
        || process.env.GCS_BUCKET_NAME
        || (projectId ? `${projectId}.firebasestorage.app` : null);
}

function publicObjectUrl(bucketName, destination) {
    if (process.env.STORAGE_EMULATOR_HOST) {
        const origin = process.env.STORAGE_EMULATOR_HOST.replace(/\/$/, '');
        return `${origin}/v0/b/${bucketName}/o/${encodeURIComponent(destination)}?alt=media`;
    }
    return `https://storage.googleapis.com/${bucketName}/${destination}`;
}

export async function uploadMediaObject({ destination, buffer, contentType, metadata = {} }) {
    const client = getStorageClient();
    const bucketName = assetsBucketName();
    if (!client || !bucketName) {
        const filename = path.basename(destination);
        const localPath = path.resolve('assets', filename);
        await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
        await fs.promises.writeFile(localPath, buffer);
        return { url: `/assets/${filename}`, storage_path: localPath };
    }

    const file = client.bucket(bucketName).file(destination);
    await file.save(buffer, {
        resumable: false,
        metadata: {
            contentType,
            cacheControl: 'public, max-age=3600',
            metadata,
        },
    });
    await file.makePublic();
    return {
        url: publicObjectUrl(bucketName, destination),
        storage_path: `gs://${bucketName}/${destination}`,
    };
}

export async function deleteMediaObject(storagePath) {
    if (storagePath.startsWith('gs://')) {
        const remainder = storagePath.slice('gs://'.length);
        const slash = remainder.indexOf('/');
        const bucketName = remainder.slice(0, slash);
        const destination = remainder.slice(slash + 1);
        const client = getStorageClient();
        if (!client) throw new Error('Storage client is unavailable for cleanup');
        await client.bucket(bucketName).file(destination).delete({ ignoreNotFound: true });
        return;
    }
    await fs.promises.rm(storagePath, { force: true });
}

/** Legacy path-based upload retained for existing callers. */
export const uploadFile = async (localPath, destination, bucketName = assetsBucketName()) => {
    const client = getStorageClient();
    if (client && bucketName) {
        const [file] = await client.bucket(bucketName).upload(localPath, {
            destination,
            metadata: { cacheControl: 'public, max-age=3600' },
        });
        await file.makePublic();
        return {
            url: publicObjectUrl(bucketName, destination),
            storage_path: `gs://${bucketName}/${destination}`,
        };
    }
    const normalizedPath = localPath.replace(/\\/g, '/');
    return { url: `http://localhost:8080/${normalizedPath}`, storage_path: localPath };
};
