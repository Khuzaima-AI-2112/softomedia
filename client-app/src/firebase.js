import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';

const runtimeConfig = window.ENV || {};
const localProjectId = import.meta.env.DEV ? 'softomedia-local' : undefined;
const projectId = runtimeConfig.VITE_FIREBASE_PROJECT_ID
    || import.meta.env.VITE_FIREBASE_PROJECT_ID
    || localProjectId;
const firebaseConfig = {
    apiKey: runtimeConfig.VITE_FIREBASE_API_KEY
        || import.meta.env.VITE_FIREBASE_API_KEY
        || (import.meta.env.DEV ? 'local-development-key' : undefined),
    authDomain: runtimeConfig.VITE_FIREBASE_AUTH_DOMAIN
        || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
        || (projectId ? `${projectId}.firebaseapp.com` : undefined),
    projectId,
};

const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

const authEmulatorUrl = runtimeConfig.VITE_FIREBASE_AUTH_EMULATOR_URL
    || import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL;

if (authEmulatorUrl) {
    connectAuthEmulator(auth, authEmulatorUrl, {
        disableWarnings: true,
    });
}
