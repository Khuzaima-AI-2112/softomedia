import { beforeAll, afterAll, describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';
import express from 'express';

process.env.NODE_ENV = 'test';
process.env.ALLOW_DEMO_MODE = 'false';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'softomedia-demo';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'softomedia-demo';

const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

const { getFirestore, closeFirestore } = await import('../src/utils/firestore.js');
const { default: apiRouter } = await import('../src/api/index.js');
const { authenticate } = await import('../src/middleware/auth.js');
const { ACTIONS, requirePermission } = await import('../src/middleware/authorization.js');
const { createTestApp } = await import('./fixtures/test-app.js');

const app = createTestApp(apiRouter);
const scopedApp = express();
scopedApp.get(
    '/entities/:entityId',
    authenticate,
    requirePermission(ACTIONS.ENTITY_RESOURCE_READ, req => ({ linkedEntityId: req.params.entityId })),
    (req, res) => res.json({ entityId: req.params.entityId })
);
const db = getFirestore();
const createdUserIds = [];

jest.setTimeout(20_000);

async function createFirebaseAccount(email, role, linkedEntityId = null) {
    const signUpResponse = await fetch(
        `http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password: 'Phase1-demo-password!',
                returnSecureToken: true,
            }),
        }
    );
    const account = await signUpResponse.json();
    if (!signUpResponse.ok) {
        throw new Error(account.error?.message || 'Failed to create Auth emulator account');
    }

    createdUserIds.push(account.localId);
    await db.collection('users').doc(account.localId).set({
        email,
        name: email.split('@')[0],
        role,
        linked_entity_id: linkedEntityId,
    });

    return account;
}

async function createAccountWithoutProfile(email) {
    const response = await fetch(
        `http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password: 'Phase1-demo-password!',
                returnSecureToken: true,
            }),
        }
    );
    const account = await response.json();
    if (!response.ok) throw new Error(account.error?.message || 'Failed to create account');
    createdUserIds.push(account.localId);
    return account;
}

async function authenticatedProfile(idToken) {
    return request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${idToken}`);
}

function expireFirebaseToken(idToken) {
    const [header, payload] = idToken.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    claims.exp = 0;
    return `${header}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.`;
}

beforeAll(async () => {
    await Promise.all([
        ...createdUserIds.map(id => db.collection('users').doc(id).delete()),
    ]);
});

afterAll(async () => {
    await Promise.all(createdUserIds.map(id => db.collection('users').doc(id).delete()));
    await closeFirestore();
});

describe('Firebase-authenticated profile boundary', () => {
    test.each([
        ['superadmin', null],
        ['admin', null],
        ['brand', 'brand-one'],
        ['retaileradmin', 'retailer-one'],
        ['techoperator', null],
    ])('returns the canonical %s identity for a real Firebase ID token', async (role, linkedEntityId) => {
        const account = await createFirebaseAccount(
            `${role}-${Date.now()}-${Math.random()}@demo.softomedia.test`,
            role,
            linkedEntityId
        );

        const response = await authenticatedProfile(account.idToken);

        expect(response.status).toBe(200);
        expect(response.body.user).toMatchObject({
            id: account.localId,
            email: account.email,
            role,
            linked_entity_id: linkedEntityId,
        });
    });

    test.each([
        ['contentmanager', 'admin'],
        ['advertiser', 'brand'],
    ])('migrates legacy role %s to %s idempotently', async (legacyRole, canonicalRole) => {
        const account = await createFirebaseAccount(
            `${legacyRole}-${Date.now()}-${Math.random()}@demo.softomedia.test`,
            legacyRole,
            `${canonicalRole}-organization`
        );

        const firstResponse = await authenticatedProfile(account.idToken);
        const secondResponse = await authenticatedProfile(account.idToken);
        const persistedProfile = await db.collection('users').doc(account.localId).get();

        expect(firstResponse.status).toBe(200);
        expect(firstResponse.body.user.role).toBe(canonicalRole);
        expect(secondResponse.status).toBe(200);
        expect(secondResponse.body.user.role).toBe(canonicalRole);
        expect(persistedProfile.data().role).toBe(canonicalRole);
    });

    test('returns the same authentication failure for missing, invalid, expired, and profile-less identities', async () => {
        const accountWithoutProfile = await createAccountWithoutProfile(
            `missing-profile-${Date.now()}@demo.softomedia.test`
        );
        const expiredAccount = await createFirebaseAccount(
            `expired-token-${Date.now()}@demo.softomedia.test`,
            'brand',
            'brand-one'
        );

        const missingTokenResponse = await request(app).get('/api/auth/me');
        const invalidTokenResponse = await authenticatedProfile('not-a-firebase-token');
        const expiredTokenResponse = await authenticatedProfile(expireFirebaseToken(expiredAccount.idToken));
        const missingProfileResponse = await authenticatedProfile(accountWithoutProfile.idToken);

        expect(missingTokenResponse.status).toBe(401);
        expect(invalidTokenResponse.status).toBe(401);
        expect(expiredTokenResponse.status).toBe(401);
        expect(missingProfileResponse.status).toBe(401);
        expect(missingTokenResponse.body).toEqual({ error: 'Authentication required' });
        expect(invalidTokenResponse.body).toEqual({ error: 'Authentication required' });
        expect(expiredTokenResponse.body).toEqual({ error: 'Authentication required' });
        expect(missingProfileResponse.body).toEqual({ error: 'Authentication required' });
    });

    test('never accepts the legacy demo token in production', async () => {
        const previousNodeEnv = process.env.NODE_ENV;
        const previousDemoMode = process.env.ALLOW_DEMO_MODE;
        process.env.NODE_ENV = 'production';
        process.env.ALLOW_DEMO_MODE = 'true';

        try {
            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer demo-token')
                .set('x-demo-role', 'superadmin');

            expect(response.status).toBe(401);
            expect(response.body).toEqual({ error: 'Authentication required' });
        } finally {
            if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
            else process.env.NODE_ENV = previousNodeEnv;
            if (previousDemoMode === undefined) delete process.env.ALLOW_DEMO_MODE;
            else process.env.ALLOW_DEMO_MODE = previousDemoMode;
        }
    });

    test('enforces an explicit action against the authenticated entity scope', async () => {
        const account = await createFirebaseAccount(
            `scoped-brand-${Date.now()}@demo.softomedia.test`,
            'brand',
            'brand-one'
        );

        const ownEntity = await request(scopedApp)
            .get('/entities/brand-one')
            .set('Authorization', `Bearer ${account.idToken}`);
        const otherEntity = await request(scopedApp)
            .get('/entities/brand-two')
            .set('Authorization', `Bearer ${account.idToken}`);

        expect(ownEntity.status).toBe(200);
        expect(otherEntity.status).toBe(403);
        expect(otherEntity.body).toEqual({ error: 'Access denied' });
    });
});
