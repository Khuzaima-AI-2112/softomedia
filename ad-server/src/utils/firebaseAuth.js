import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let firebaseApp;

export function getFirebaseAuth() {
    if (!firebaseApp) {
        const projectId = process.env.FIREBASE_PROJECT_ID
            || process.env.GOOGLE_CLOUD_PROJECT
            || process.env.GCLOUD_PROJECT;

        if (!projectId) throw new Error('A Firebase project ID is required');

        firebaseApp = getApps()[0] || initializeApp({
            projectId,
            ...(process.env.FIREBASE_AUTH_EMULATOR_HOST
                ? {}
                : { credential: applicationDefault() }),
        });
    }

    return getAuth(firebaseApp);
}
