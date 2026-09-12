import { getFirestore } from '../utils/firestore.js';
import { getStorageClient } from '../utils/storage.js';

const DEFAULT_PROBE_TIMEOUT_MS = 2_000;

async function defaultFirestoreProbe() {
    const firestore = getFirestore();
    if (!firestore) throw new Error('Firestore is not configured');
    await firestore.collection('screens').limit(1).get();
}

async function defaultStorageProbe() {
    const storage = getStorageClient();
    if (!storage) throw new Error('Cloud Storage is not configured');
    const projectId = process.env.GOOGLE_CLOUD_PROJECT
        || process.env.GCLOUD_PROJECT
        || process.env.FIREBASE_PROJECT_ID;
    const bucketName = process.env.STORAGE_BUCKET || `${projectId}.appspot.com`;
    if (!projectId && !process.env.STORAGE_BUCKET) {
        throw new Error('Cloud Storage bucket is not configured');
    }
    await storage.bucket(bucketName).getMetadata();
}

export class OperationalHealthService {
    constructor({
        firestoreProbe = defaultFirestoreProbe,
        storageProbe = defaultStorageProbe,
        clock = () => new Date(),
        timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
    } = {}) {
        this.firestoreProbe = firestoreProbe;
        this.storageProbe = storageProbe;
        this.clock = clock;
        this.timeoutMs = timeoutMs;
    }

    async dependencyState(probe) {
        let timeoutId;
        try {
            const timeout = new Promise((_, reject) => {
                timeoutId = setTimeout(
                    () => reject(new Error('Dependency probe timed out')),
                    this.timeoutMs,
                );
            });
            await Promise.race([probe(), timeout]);
            return { state: 'healthy' };
        } catch {
            return { state: 'unavailable' };
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async check() {
        const [firestore, storage] = await Promise.all([
            this.dependencyState(this.firestoreProbe),
            this.dependencyState(this.storageProbe),
        ]);
        return {
            backend: { state: 'healthy' },
            firestore,
            storage,
            checked_at: this.clock().toISOString(),
        };
    }
}

export const operationalHealthService = new OperationalHealthService();
