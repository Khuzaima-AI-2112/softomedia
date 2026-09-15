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

/**
 * Stores an uploaded media file as a private object. It is never made public;
 * the API streams it to the users and Screens allowed to see it.
 */
export async function uploadMediaObject({ destination, buffer, contentType, metadata = {} }) {
    const client = getStorageClient();
    const bucketName = assetsBucketName();
    if (!client || !bucketName) {
        throw new Error('Persistent media storage is unavailable');
    }

    const file = client.bucket(bucketName).file(destination);
    await file.save(buffer, {
        resumable: false,
        metadata: {
            contentType,
            cacheControl: 'private, max-age=300',
            metadata,
        },
    });
    return {
        storage_path: `gs://${bucketName}/${destination}`,
        object_ref: { kind: 'gcs', bucketName, destination },
    };
}

/**
 * Opens a stored media object for reading through the API. Objects are private,
 * so this server's credentials are the only way to read them. Returns null when
 * the path is not an object in the media bucket or the object is gone.
 */
export async function openMediaObject(storagePath) {
    const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(storagePath || '');
    if (!match || match[1] !== assetsBucketName()) return null;
    const client = getStorageClient();
    if (!client) throw new Error('Persistent media storage is unavailable');

    const file = client.bucket(match[1]).file(match[2]);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [metadata] = await file.getMetadata();
    return {
        contentType: metadata.contentType || 'application/octet-stream',
        size: metadata.size,
        stream: file.createReadStream(),
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
