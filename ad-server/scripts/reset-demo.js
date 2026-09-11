import { resetDemoBaseline } from '../src/services/DemoResetService.js';
import { closeFirestore, getFirestore } from '../src/utils/firestore.js';
import { getStorageClient } from '../src/utils/storage.js';

function activeProjectId() {
    return process.env.GOOGLE_CLOUD_PROJECT
        || process.env.GCLOUD_PROJECT
        || process.env.FIREBASE_PROJECT_ID;
}

const activeProject = activeProjectId();
const expectedProject = process.env.DEMO_PROJECT_ID;
const bucketName = process.env.DEMO_ASSETS_BUCKET;

try {
    const result = await resetDemoBaseline({
        firestore: getFirestore(),
        storage: getStorageClient(),
        activeProjectId: activeProject,
        expectedProjectId: expectedProject,
        bucketName,
    });
    console.log(JSON.stringify(result, null, 2));
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    await closeFirestore();
}
