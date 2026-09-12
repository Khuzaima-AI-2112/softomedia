import { Storage } from '@google-cloud/storage';

let storage;

function activeProjectId() {
    return process.env.GOOGLE_CLOUD_PROJECT
        || process.env.GCLOUD_PROJECT
        || process.env.FIREBASE_PROJECT_ID;
}

export const getStorageClient = () => {
    if (!storage) {
        const projectId = activeProjectId();

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
    const projectId = activeProjectId();
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
        throw new Error('Persistent media storage is unavailable');
    }

    const file = client.bucket(bucketName).file(destination);
    let objectCreated = false;
    try {
        await file.save(buffer, {
            resumable: false,
            metadata: {
                contentType,
                cacheControl: 'public, max-age=3600',
                metadata,
            },
        });
        objectCreated = true;
        await file.makePublic();
    } catch (error) {
        if (objectCreated) {
            try {
                await file.delete({ ignoreNotFound: true });
            } catch (cleanupError) {
                throw new AggregateError([error, cleanupError], 'Storage upload and cleanup both failed');
            }
        }
        throw error;
    }
    return {
        url: publicObjectUrl(bucketName, destination),
        storage_path: `gs://${bucketName}/${destination}`,
        object_ref: { kind: 'gcs', bucketName, destination },
    };
}

export async function deleteMediaObject(objectReference) {
    if (objectReference.kind === 'gcs') {
        const client = getStorageClient();
        if (!client) throw new Error('Storage client is unavailable for cleanup');
        await client.bucket(objectReference.bucketName).file(objectReference.destination).delete({ ignoreNotFound: true });
        return;
    }
    throw new Error('Unsupported media object reference');
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
