import { userRepository } from '../repositories/index.js';
import { getFirebaseAuth } from '../utils/firebaseAuth.js';
import { PERMISSIONS } from '../middleware/requireRole.js';

export const DEMO_PERSONAS = Object.freeze([
    Object.freeze({ email: 'superadmin@demo.softomedia.test', name: 'Demo Super Administrator', role: 'superadmin', linked_entity_id: null }),
    Object.freeze({ email: 'admin@demo.softomedia.test', name: 'Demo Admin', role: 'admin', linked_entity_id: null }),
    Object.freeze({ email: 'brand@demo.softomedia.test', name: 'Demo Brand', role: 'brand', linked_entity_id: 'demo-advertiser-bonvie' }),
    Object.freeze({ email: 'retaileradmin@demo.softomedia.test', name: 'Demo Retailer Administrator', role: 'retaileradmin', linked_entity_id: 'demo-retailer-freshmart' }),
    Object.freeze({
        email: 'techoperator@demo.softomedia.test',
        name: 'Demo Technical Operator',
        role: 'techoperator',
        linked_entity_id: null,
        permissions: Object.freeze([
            PERMISSIONS.PROOF_OF_PLAY_VIEW_NETWORK,
        ]),
    }),
    Object.freeze({ email: 'brand-secondary@demo.softomedia.test', name: 'Demo Secondary Brand', role: 'brand', linked_entity_id: 'demo-advertiser-secondary' }),
    Object.freeze({ email: 'retaileradmin-secondary@demo.softomedia.test', name: 'Demo Secondary Retailer Administrator', role: 'retaileradmin', linked_entity_id: 'demo-retailer-secondary' }),
]);

function activeProjectId() {
    return process.env.GOOGLE_CLOUD_PROJECT
        || process.env.GCLOUD_PROJECT
        || process.env.FIREBASE_PROJECT_ID;
}

export async function provisionDemoPersonas({ password, expectedProjectId }) {
    const projectId = activeProjectId();
    if (!expectedProjectId || projectId !== expectedProjectId) {
        throw new Error(`Refusing to provision demo personas in project ${projectId || '(unset)'}`);
    }
    if (!password || password.length < 12) {
        throw new Error('DEMO_ACCOUNT_PASSWORD must contain at least 12 characters');
    }

    const firebaseAuth = getFirebaseAuth();
    const provisioned = [];

    for (const persona of DEMO_PERSONAS) {
        let firebaseUser;
        try {
            firebaseUser = await firebaseAuth.getUserByEmail(persona.email);
            firebaseUser = await firebaseAuth.updateUser(firebaseUser.uid, {
                password,
                displayName: persona.name,
            });
        } catch (error) {
            if (error.code !== 'auth/user-not-found') throw error;
            firebaseUser = await firebaseAuth.createUser({
                email: persona.email,
                password,
                displayName: persona.name,
                emailVerified: true,
            });
        }

        await userRepository.update(firebaseUser.uid, {
            email: persona.email,
            name: persona.name,
            role: persona.role,
            linked_entity_id: persona.linked_entity_id,
            permissions: persona.permissions || [],
        });
        provisioned.push({ uid: firebaseUser.uid, ...persona });
    }

    return provisioned;
}
