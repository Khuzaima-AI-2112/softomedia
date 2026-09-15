/**
 * Real Firebase sign-in for backend suites, through the Auth emulator.
 *
 * Requests carry a Firebase ID token and pass through the real authenticate
 * middleware, which resolves the profile saved here. Suites that run without
 * the emulators skip themselves with describeWithAuthEmulator.
 */
import { describe } from '@jest/globals';

export const PASSWORD = 'Phase1-demo-password!';

export const hasAuthEmulator = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
export const describeWithAuthEmulator = hasAuthEmulator ? describe : describe.skip;

const identityToolkit = method =>
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:${method}?key=demo-api-key`;

async function callIdentityToolkit(method, email, password) {
    const response = await fetch(identityToolkit(method), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`Firebase emulator ${method} failed: ${body.error?.message}`);
    return body;
}

/** Signs in an existing account, such as a provisioned demo persona, and returns its ID token. */
export async function signIn(email, password = PASSWORD) {
    return (await callIdentityToolkit('signInWithPassword', email, password)).idToken;
}

const accounts = new Map();

/**
 * The Auth emulator issues tokens on the real clock, which a suite with a faked
 * clock sees as expired or not yet issued. The emulator does not check
 * signatures, so the same claims are re-issued with the suite's current time.
 */
function issuedAtSuiteClock(idToken) {
    const [header, payload] = idToken.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    // auth_time stays real: one before the account existed reads as a revoked session.
    const reissued = { ...claims, iat: now, exp: now + 3600 };
    return `${header}.${Buffer.from(JSON.stringify(reissued)).toString('base64url')}.`;
}

/**
 * Returns Authorization headers for a signed-in user with this role, organization
 * and explicit permissions. The account is created once per suite; the profile is
 * saved again whenever it is missing, so suites that clear in-memory storage
 * between tests can call this after clearing. Suites with a faked clock pass
 * fakeClock: true after installing it.
 */
export async function signInAs(role, { organizationId = null, permissions = [], fakeClock = false } = {}) {
    const key = JSON.stringify([role, organizationId, [...permissions].sort()]);
    if (!accounts.has(key)) {
        const email = `${role}-${accounts.size}-${Date.now()}@jest.demo.softomedia.test`;
        const { localId, idToken } = await callIdentityToolkit('signUp', email, PASSWORD);
        accounts.set(key, { uid: localId, email, idToken });
    }
    const { uid, email, idToken } = accounts.get(key);

    // Imported here so a suite's module mocks (such as an in-memory Firestore) apply.
    const { userRepository } = await import('../../src/repositories/index.js');
    if (!(await userRepository.findById(uid))) {
        await userRepository.create(uid, {
            email,
            name: `${role} test user`,
            role,
            linked_entity_id: organizationId,
            organization_id: organizationId,
            permissions,
        });
    }

    const token = fakeClock ? issuedAtSuiteClock(idToken) : idToken;
    return { uid, headers: { Authorization: `Bearer ${token}` } };
}
