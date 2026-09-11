import {
    DEMO_BUSINESS_COLLECTIONS,
    DEMO_RESET_SCOPE,
    DEMO_RESET_SCOPE_FIELD,
    DEMO_STORAGE_PREFIX,
    buildDemoBaseline,
} from './DemoBaseline.js';

const MAX_ATOMIC_FIRESTORE_WRITES = 500;

export function assertDedicatedDemoProject({ activeProjectId, expectedProjectId }) {
    if (!expectedProjectId || activeProjectId !== expectedProjectId) {
        throw new Error(`Refusing to reset demo data in project ${activeProjectId || '(unset)'}`);
    }
}

export function assertDedicatedDemoBucket({ bucketName, expectedProjectId }) {
    const recognizedBucketNames = new Set([
        `${expectedProjectId}.appspot.com`,
        `${expectedProjectId}.firebasestorage.app`,
    ]);
    if (!recognizedBucketNames.has(bucketName)) {
        throw new Error(`Refusing to reset demo data in bucket ${bucketName || '(unset)'}`);
    }
}

export async function resetDemoBaseline({
    firestore,
    storage,
    activeProjectId,
    expectedProjectId,
    bucketName,
    resetAt = new Date(),
}) {
    assertDedicatedDemoProject({ activeProjectId, expectedProjectId });
    assertDedicatedDemoBucket({ bucketName, expectedProjectId });
    if (!firestore || !storage) {
        throw new Error('Firestore and Cloud Storage clients are required for demo reset');
    }

    const baseline = buildDemoBaseline({ resetAt, bucketName });
    const baselineIds = new Map();
    for (const document of baseline.documents) {
        if (!baselineIds.has(document.collection)) baselineIds.set(document.collection, new Set());
        baselineIds.get(document.collection).add(document.id);
    }

    const scopedSnapshots = await Promise.all(DEMO_BUSINESS_COLLECTIONS.map(collection =>
        firestore.collection(collection)
            .where(DEMO_RESET_SCOPE_FIELD, '==', DEMO_RESET_SCOPE)
            .get()
    ));
    const staleDocumentReferences = scopedSnapshots.flatMap((snapshot, index) => {
        const collection = DEMO_BUSINESS_COLLECTIONS[index];
        return snapshot.docs
            .filter(document => !baselineIds.get(collection)?.has(document.id))
            .map(document => document.ref);
    });

    const writeCount = staleDocumentReferences.length + baseline.documents.length;
    if (writeCount > MAX_ATOMIC_FIRESTORE_WRITES) {
        throw new Error(`Demo reset requires ${writeCount} Firestore writes; refusing to exceed the atomic limit`);
    }

    const bucket = storage.bucket(bucketName);
    const [scopedObjects] = await bucket.getFiles({ prefix: DEMO_STORAGE_PREFIX });
    const baselineObjectNames = new Set(baseline.storageObjects.map(object => object.name));

    await Promise.all(baseline.storageObjects.map(async object => {
        const file = bucket.file(object.name);
        await file.save(object.body, {
            resumable: false,
            metadata: object.metadata,
        });
        await file.makePublic();
    }));
    await Promise.all(scopedObjects
        .filter(object => !baselineObjectNames.has(object.name))
        .map(object => object.delete()));

    const batch = firestore.batch();
    for (const reference of staleDocumentReferences) batch.delete(reference);
    for (const document of baseline.documents) {
        batch.set(firestore.collection(document.collection).doc(document.id), document.data);
    }
    await batch.commit();

    return {
        projectId: activeProjectId,
        bucketName,
        resetAt: baseline.resetAt,
        documentsWritten: baseline.documents.length,
        storageObjectsWritten: baseline.storageObjects.length,
    };
}
