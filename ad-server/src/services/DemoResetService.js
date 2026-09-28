import {
    DEMO_BUSINESS_COLLECTIONS,
    DEMO_STORAGE_PREFIX,
    buildDemoBaseline,
} from './DemoBaseline.js';

const MAX_BATCH_WRITES = 500;

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
    const bucket = storage.bucket(bucketName);
    const [scopedObjects] = await bucket.getFiles({ prefix: DEMO_STORAGE_PREFIX });
    const baselineObjectNames = new Set(baseline.storageObjects.map(object => object.name));

    await Promise.all(baseline.storageObjects.map(async object => {
        const file = bucket.file(object.name);
        await file.save(object.body, {
            resumable: false,
            metadata: object.metadata,
        });
    }));
    await Promise.all(scopedObjects
        .filter(object => !baselineObjectNames.has(object.name))
        .map(object => object.delete()));

    // The project guard above makes every business record synthetic, so each
    // collection is emptied whoever wrote to it (#18). A walkthrough can leave
    // more records than one atomic batch holds, so a reset that fails midway
    // leaves a partial baseline; running it again completes it.
    await Promise.all(DEMO_BUSINESS_COLLECTIONS.map(collection =>
        firestore.recursiveDelete(firestore.collection(collection))));
    for (let start = 0; start < baseline.documents.length; start += MAX_BATCH_WRITES) {
        const batch = firestore.batch();
        for (const document of baseline.documents.slice(start, start + MAX_BATCH_WRITES)) {
            batch.set(firestore.collection(document.collection).doc(document.id), document.data);
        }
        await batch.commit();
    }

    return {
        projectId: activeProjectId,
        bucketName,
        resetAt: baseline.resetAt,
        documentsWritten: baseline.documents.length,
        storageObjectsWritten: baseline.storageObjects.length,
    };
}
