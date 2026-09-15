import { beforeAll, afterAll, describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createHmac } from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.ALLOW_DEMO_MODE = 'false';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'softomedia-demo';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'softomedia-demo';
// A revision that still carries the retired secret must not accept tokens signed with it.
const LEGACY_JWT_SECRET = 'retired-jwt-secret';
process.env.JWT_SECRET = LEGACY_JWT_SECRET;

const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

const { getFirestore, closeFirestore } = await import('../src/utils/firestore.js');
const { default: apiRouter } = await import('../src/api/index.js');
const { authenticate } = await import('../src/middleware/auth.js');
const { PERMISSIONS, requireNetworkProofOfPlayView } = await import('../src/middleware/requireRole.js');
const { createTestApp } = await import('./fixtures/test-app.js');
const { PASSWORD } = await import('./fixtures/emulator-sign-in.js');

const app = createTestApp(apiRouter);
const scopedApp = express();
scopedApp.get(
    '/network-delivery',
    authenticate,
    requireNetworkProofOfPlayView,
    (_req, res) => res.json({ allowed: true })
);
const db = getFirestore();
const createdUserIds = [];

jest.setTimeout(20_000);

async function createFirebaseAccount(email, role, linkedEntityId = null, permissions = undefined) {
    const signUpResponse = await fetch(
        `http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password: PASSWORD,
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
        ...(permissions === undefined ? {} : { permissions }),
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
                password: PASSWORD,
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

// An HS256 token in the shape the retired POST /api/auth/login issued.
function legacyJwt(claims, secret) {
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ ...claims, iat: Math.floor(Date.now() / 1000) })}`;
    return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
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
    ])('refuses a profile still holding the retired %s role instead of acting as %s', async (legacyRole, canonicalRole) => {
        const account = await createFirebaseAccount(
            `${legacyRole}-${Date.now()}-${Math.random()}@demo.softomedia.test`,
            legacyRole,
            `${canonicalRole}-organization`
        );

        const response = await authenticatedProfile(account.idToken);
        const persistedProfile = await db.collection('users').doc(account.localId).get();

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'Authentication required' });
        expect(persistedProfile.data().role).toBe(legacyRole);
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

    test('refuses the retired demo token and custom JWTs even with the old switches on', async () => {
        const previous = {
            ALLOW_DEMO_MODE: process.env.ALLOW_DEMO_MODE,
            ALLOW_LEGACY_JWT_AUTH: process.env.ALLOW_LEGACY_JWT_AUTH,
        };
        process.env.ALLOW_DEMO_MODE = 'true';
        process.env.ALLOW_LEGACY_JWT_AUTH = 'true';

        try {
            const demoToken = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer demo-token')
                .set('x-demo-role', 'superadmin');
            const customJwt = await authenticatedProfile(
                legacyJwt({ id: 'legacy-user', role: 'superadmin' }, LEGACY_JWT_SECRET)
            );

            const refusal = { status: 401, body: { error: 'Authentication required' } };
            expect({
                demoToken: { status: demoToken.status, body: demoToken.body },
                customJwt: { status: customJwt.status, body: customJwt.body },
            }).toEqual({ demoToken: refusal, customJwt: refusal });
        } finally {
            for (const [name, value] of Object.entries(previous)) {
                if (value === undefined) delete process.env[name];
                else process.env[name] = value;
            }
        }
    });

    test('requires an explicit network Proof of Play permission for an operator profile', async () => {
        const deniedAccount = await createFirebaseAccount(
            `ungranted-operator-${Date.now()}@demo.softomedia.test`,
            'techoperator',
            null,
            []
        );
        const grantedAccount = await createFirebaseAccount(
            `granted-operator-${Date.now()}@demo.softomedia.test`,
            'techoperator',
            null,
            [PERMISSIONS.PROOF_OF_PLAY_VIEW_NETWORK]
        );

        const denied = await request(scopedApp)
            .get('/network-delivery')
            .set('Authorization', `Bearer ${deniedAccount.idToken}`);
        const granted = await request(scopedApp)
            .get('/network-delivery')
            .set('Authorization', `Bearer ${grantedAccount.idToken}`);

        expect(denied.status).toBe(403);
        expect(granted.status).toBe(200);
        expect(granted.body).toEqual({ allowed: true });
    });
});
