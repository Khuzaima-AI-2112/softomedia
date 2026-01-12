import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Note: This script assumes GOOGLE_APPLICATION_CREDENTIALS is set 
// or it's running in a environment with ADC.
// For local use, ensure you've run 'gcloud auth application-default login'

const projectId = 'softomedia-live-2026';

initializeApp({
    projectId: projectId
});

const db = getFirestore();

async function checkConfig() {
    console.log(`Checking config for project: ${projectId}...`);
    const docRef = db.collection('pricing_config').doc('global');
    const doc = await docRef.get();

    if (!doc.exists) {
        console.log('No such document!');
    } else {
        console.log('Document data:', JSON.stringify(doc.data(), null, 2));
    }
}

checkConfig().catch(console.error);
