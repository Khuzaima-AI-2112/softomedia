import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'softomedia-demo';
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'softomedia-demo';

const hasEmulators = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
const describeWithEmulators = hasEmulators ? describe : describe.skip;

const { PASSWORD, signIn } = await import('./fixtures/emulator-sign-in.js');

jest.setTimeout(30_000);

const identityToolkit = method =>
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:${method}?key=demo-api-key`;

async function signUp(email) {
    const response = await fetch(identityToolkit('signUp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`signUp failed: ${body.error?.message}`);
    return body;
}

/**
 * A signed-in Firebase account is bound to exactly one Softomedia profile: its
 * role and Organization come only from a profile that belongs to that account.
 */
describeWithEmulators('identity binding with Firebase emulators', () => {
    let request;
    let app;
    let superAdmin;
    const createdProfileIds = [];

    const me = token => request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    async function createProfile(fields) {
        const created = await request(app).post('/api/users').set(superAdmin).send(fields);
        expect(created.status).toBe(201);
        createdProfileIds.push(created.body.id);
        return created.body;
    }

    beforeAll(async () => {
        ({ default: request } = await import('supertest'));
        const { provisionDemoPersonas } = await import('../src/services/DemoPersonaProvisioner.js');
        await provisionDemoPersonas({ password: PASSWORD, expectedProjectId: 'softomedia-demo' });
        superAdmin = { Authorization: `Bearer ${await signIn('superadmin@demo.softomedia.test')}` };
        ({ default: app } = await import('../index.js'));
    });

    afterAll(async () => {
        const { userRepository } = await import('../src/repositories/index.js');
        await Promise.all(createdProfileIds.map(id => userRepository.delete(id).catch(() => null)));
    });

    test('an account with an unverified email does not take over a profile created for that email', async () => {
        const email = `unverified-${Date.now()}@jest.demo.softomedia.test`;
        await createProfile({ name: 'Invited Retailer', email, role: 'retaileradmin', linkedentityid: 'demo-retailer-freshmart' });

        const account = await signUp(email);
        const response = await me(account.idToken);

        expect(response.status).toBe(401);
    });

    test('the first account to verify an invited email is bound to the profile, and no later account can take it', async () => {
        const { getFirebaseAuth } = await import('../src/utils/firebaseAuth.js');
        const firebaseAuth = getFirebaseAuth();
        const email = `invited-${Date.now()}@jest.demo.softomedia.test`;
        const profile = await createProfile({ name: 'Invited Brand', email, role: 'brand', linkedentityid: 'demo-advertiser-bonvie' });

        const first = await signUp(email);
        await firebaseAuth.updateUser(first.localId, { emailVerified: true });
        const bound = await me(await signIn(email));

        expect(bound.status).toBe(200);
        expect(bound.body.user).toMatchObject({ id: profile.id, role: 'brand', organization_id: 'demo-advertiser-bonvie' });

        // The account is removed and someone registers the same email again.
        await firebaseAuth.deleteUser(first.localId);
        const second = await signUp(email);
        await firebaseAuth.updateUser(second.localId, { emailVerified: true });

        expect((await me(await signIn(email))).status).toBe(401);
    });

    test('a profile created with a capitalised email binds to the account that verifies that email', async () => {
        const { getFirebaseAuth } = await import('../src/utils/firebaseAuth.js');
        const stamp = Date.now();
        const profile = await createProfile({
            name: 'Invited Operator',
            email: `Invited-Case-${stamp}@Jest.Demo.Softomedia.test`,
            role: 'techoperator',
        });

        const email = `invited-case-${stamp}@jest.demo.softomedia.test`;
        const account = await signUp(email);
        await getFirebaseAuth().updateUser(account.localId, { emailVerified: true });
        const bound = await me(await signIn(email));

        expect(bound.status).toBe(200);
        expect(bound.body.user).toMatchObject({ id: profile.id, role: 'techoperator' });
    });

    test('a Super Administrator moving a user to another Organization takes effect on the next request', async () => {
        const { signInAs } = await import('./fixtures/emulator-sign-in.js');
        const retailer = await signInAs('retaileradmin', { organizationId: 'demo-retailer-freshmart' });
        createdProfileIds.push(retailer.uid);

        const moved = await request(app).patch(`/api/users/${retailer.uid}`).set(superAdmin)
            .send({ linkedentityid: 'demo-retailer-secondary' });
        expect(moved.status).toBe(200);

        const profile = await request(app).get('/api/auth/me').set(retailer.headers);
        expect(profile.status).toBe(200);
        expect(profile.body.user).toMatchObject({
            organization_id: 'demo-retailer-secondary',
            linked_entity_id: 'demo-retailer-secondary',
        });
    });

    test('a user a Super Administrator deactivates is refused on the next request', async () => {
        const { signInAs } = await import('./fixtures/emulator-sign-in.js');
        const operator = await signInAs('techoperator');
        createdProfileIds.push(operator.uid);
        expect((await request(app).get('/api/auth/me').set(operator.headers)).status).toBe(200);

        const deactivated = await request(app).patch(`/api/users/${operator.uid}`).set(superAdmin)
            .send({ status: 'inactive' });
        expect(deactivated.status).toBe(200);

        const [profile, screens] = await Promise.all([
            request(app).get('/api/auth/me').set(operator.headers),
            request(app).get('/api/screens').set(operator.headers),
        ]);
        expect([profile.status, screens.status]).toEqual([401, 401]);
    });
});
