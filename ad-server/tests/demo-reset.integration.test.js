import { afterAll, afterEach, describe, expect, jest, test } from '@jest/globals';
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

process.env.NODE_ENV = 'test';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8090';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
process.env.STORAGE_EMULATOR_HOST = process.env.STORAGE_EMULATOR_HOST || 'http://127.0.0.1:9199';
process.env.GOOGLE_CLOUD_PROJECT = 'softomedia-demo';
process.env.FIREBASE_PROJECT_ID = 'softomedia-demo';

const projectId = 'softomedia-demo';
const bucketName = `${projectId}.appspot.com`;
const firestore = new Firestore({ projectId });
const storage = new Storage({ projectId });
const bucket = storage.bucket(bucketName);

const { DEMO_RESET_SCOPE, DEMO_STORAGE_PREFIX } = await import('../src/services/DemoBaseline.js');
const { resetDemoBaseline } = await import('../src/services/DemoResetService.js');
const { DEMO_PERSONAS, provisionDemoPersonas } = await import('../src/services/DemoPersonaProvisioner.js');
const { getFirebaseAuth } = await import('../src/utils/firebaseAuth.js');

const cleanupDocuments = [];
const cleanupObjects = [];
const createdAuthUserIds = [];
const firebaseAuth = getFirebaseAuth();
const execFileAsync = promisify(execFile);

jest.setTimeout(30_000);

afterEach(async () => {
    await Promise.all(cleanupDocuments.splice(0).map(reference => reference.delete()));
    await Promise.all(cleanupObjects.splice(0).map(async file => {
        try {
            await file.delete();
        } catch (error) {
            if (error.code !== 404) throw error;
        }
    }));
});

afterAll(async () => {
    if (createdAuthUserIds.length > 0) {
        await firebaseAuth.deleteUsers(createdAuthUserIds);
    }
    await firestore.terminate();
});

async function readPersistedBaseline() {
    const collections = ['advertisers', 'retailers', 'stores', 'locations', 'screens', 'media', 'campaigns', 'loops'];
    const snapshots = await Promise.all(collections.map(collection =>
        firestore.collection(collection).where('demo_reset_scope', '==', DEMO_RESET_SCOPE).get()
    ));
    return snapshots.flatMap((snapshot, index) => snapshot.docs.map(document => ({
        path: `${collections[index]}/${document.id}`,
        data: document.data(),
    }))).sort((left, right) => left.path.localeCompare(right.path));
}

async function readPersistedObjects() {
    const [objects] = await bucket.getFiles({ prefix: DEMO_STORAGE_PREFIX });
    return Promise.all(objects.sort((left, right) => left.name.localeCompare(right.name)).map(async object => ({
        name: object.name,
        contents: (await object.download())[0].toString('base64'),
    })));
}

describe('guarded demo reset', () => {
    test('refuses a project mismatch before Firestore or Storage changes', async () => {
        const document = firestore.collection('campaigns').doc('demo-refusal-sentinel');
        const object = bucket.file(`${DEMO_STORAGE_PREFIX}refusal-sentinel.txt`);
        cleanupDocuments.push(document);
        cleanupObjects.push(object);

        await document.set({ demo_reset_scope: DEMO_RESET_SCOPE, value: 'keep' });
        await object.save('keep', { contentType: 'text/plain' });

        await expect(resetDemoBaseline({
            firestore,
            storage,
            activeProjectId: 'not-the-demo-project',
            expectedProjectId: projectId,
            bucketName,
            resetAt: new Date('2030-01-15T10:30:00.000Z'),
        })).rejects.toThrow('Refusing to reset demo data in project not-the-demo-project');

        await expect(resetDemoBaseline({
            firestore,
            storage,
            activeProjectId: projectId,
            expectedProjectId: projectId,
            bucketName: 'unrelated-live-project.appspot.com',
            resetAt: new Date('2030-01-15T10:30:00.000Z'),
        })).rejects.toThrow('Refusing to reset demo data in bucket unrelated-live-project.appspot.com');

        expect((await document.get()).data()).toEqual({
            demo_reset_scope: DEMO_RESET_SCOPE,
            value: 'keep',
        });
        expect((await object.download())[0].toString()).toBe('keep');
    });

    test('replaces only recognized demo records and objects with the persisted baseline', async () => {
        const unrelatedDocument = firestore.collection('campaigns').doc('unrelated-customer-record');
        const staleDemoDocument = firestore.collection('campaigns').doc('demo-stale-record');
        const staleDemoLoop = firestore.collection('loops').doc('demo-stale-loop');
        const scopedUserProfile = firestore.collection('users').doc('demo-preserved-user-profile');
        const unrelatedObject = bucket.file('unrelated/customer-object.txt');
        const staleDemoObject = bucket.file(`${DEMO_STORAGE_PREFIX}stale-object.txt`);
        cleanupDocuments.push(unrelatedDocument, staleDemoDocument, staleDemoLoop, scopedUserProfile);
        cleanupObjects.push(unrelatedObject, staleDemoObject);

        await Promise.all([
            unrelatedDocument.set({ value: 'preserve' }),
            staleDemoDocument.set({ demo_reset_scope: DEMO_RESET_SCOPE, value: 'replace' }),
            staleDemoLoop.set({ demo_reset_scope: DEMO_RESET_SCOPE, value: 'replace' }),
            scopedUserProfile.set({ demo_reset_scope: DEMO_RESET_SCOPE, value: 'preserve' }),
            unrelatedObject.save('preserve', { contentType: 'text/plain' }),
            staleDemoObject.save('replace', { contentType: 'text/plain' }),
        ]);

        const result = await resetDemoBaseline({
            firestore,
            storage,
            activeProjectId: projectId,
            expectedProjectId: projectId,
            bucketName,
            resetAt: new Date('2030-01-15T10:30:00.000Z'),
        });

        expect(result).toEqual({
            projectId,
            bucketName,
            resetAt: '2030-01-15T10:30:00.000Z',
            documentsWritten: 19,
            storageObjectsWritten: 4,
        });
        expect((await staleDemoDocument.get()).exists).toBe(false);
        expect((await staleDemoLoop.get()).exists).toBe(false);
        expect((await unrelatedDocument.get()).data()).toEqual({ value: 'preserve' });
        expect((await scopedUserProfile.get()).data()).toEqual({
            demo_reset_scope: DEMO_RESET_SCOPE,
            value: 'preserve',
        });
        expect((await staleDemoObject.exists())[0]).toBe(false);
        expect((await unrelatedObject.download())[0].toString()).toBe('preserve');

        const [retailers, stores, locations, screens, media, campaigns, loops] = await Promise.all([
            firestore.collection('retailers').where('demo_reset_scope', '==', DEMO_RESET_SCOPE).get(),
            firestore.collection('stores').where('demo_reset_scope', '==', DEMO_RESET_SCOPE).get(),
            firestore.collection('locations').where('demo_reset_scope', '==', DEMO_RESET_SCOPE).get(),
            firestore.collection('screens').where('demo_reset_scope', '==', DEMO_RESET_SCOPE).get(),
            firestore.collection('media').where('demo_reset_scope', '==', DEMO_RESET_SCOPE).get(),
            firestore.collection('campaigns').where('demo_reset_scope', '==', DEMO_RESET_SCOPE).get(),
            firestore.collection('loops').where('demo_reset_scope', '==', DEMO_RESET_SCOPE).get(),
        ]);

        expect(retailers.size).toBe(2);
        expect(stores.docs.map(document => document.data().time_zone).sort()).toEqual([
            'America/Phoenix',
            'America/Toronto',
        ]);
        expect(locations.size).toBe(3);
        expect(screens.size).toBe(3);
        expect(media.docs.map(document => document.data().category).sort()).toEqual([
            'fallback',
            'internal',
            'paid',
            'retailer',
        ]);
        expect(campaigns.docs.map(document => ({
            advertiserId: document.data().advertiser_id,
            startDate: document.data().start_date,
            endDate: document.data().end_date,
        }))).toEqual([
            {
                advertiserId: 'demo-advertiser-secondary',
                startDate: '2030-01-16',
                endDate: '2030-01-29',
            },
            {
                advertiserId: 'demo-advertiser-secondary',
                startDate: '2030-01-22',
                endDate: '2030-02-05',
            },
        ]);
        expect(loops.docs.map(document => document.data().date)).toEqual(['2030-01-16']);

        const [objects] = await bucket.getFiles({ prefix: DEMO_STORAGE_PREFIX });
        expect(objects.map(object => object.name).sort()).toEqual([
            `${DEMO_STORAGE_PREFIX}media/fallback.png`,
            `${DEMO_STORAGE_PREFIX}media/internal.png`,
            `${DEMO_STORAGE_PREFIX}media/paid.png`,
            `${DEMO_STORAGE_PREFIX}media/retailer.png`,
        ]);
        expect((await Promise.all(objects.map(object => object.download())))
            .every(([contents]) => contents.length > 0)).toBe(true);
    });

    test('restores the same baseline while preserving all seven Firebase accounts and profiles', async () => {
        const provisioned = await provisionDemoPersonas({
            password: `emulator-only-${Date.now()}`,
            expectedProjectId: projectId,
        });
        createdAuthUserIds.push(...provisioned.map(persona => persona.uid));
        cleanupDocuments.push(...provisioned.map(persona => firestore.collection('users').doc(persona.uid)));

        expect(provisioned.map(persona => persona.email)).toEqual(DEMO_PERSONAS.map(persona => persona.email));

        const authUsersBefore = (await firebaseAuth.listUsers()).users
            .map(user => ({ uid: user.uid, email: user.email }))
            .sort((left, right) => left.email.localeCompare(right.email));
        const profilesBefore = await Promise.all(provisioned.map(async persona => ({
            uid: persona.uid,
            data: (await firestore.collection('users').doc(persona.uid).get()).data(),
        })));

        const resetOptions = {
            firestore,
            storage,
            activeProjectId: projectId,
            expectedProjectId: projectId,
            bucketName,
            resetAt: new Date('2030-01-15T10:30:00.000Z'),
        };
        await resetDemoBaseline(resetOptions);
        const documentsAfterFirstReset = await readPersistedBaseline();
        const objectsAfterFirstReset = await readPersistedObjects();

        await Promise.all([
            firestore.collection('campaigns').doc('demo-secondary-campaign-1').update({ name: 'drifted' }),
            firestore.collection('campaigns').doc('demo-runtime-campaign').set({
                demo_reset_scope: DEMO_RESET_SCOPE,
                name: 'remove me',
            }),
            bucket.file(`${DEMO_STORAGE_PREFIX}media/paid.png`).save('drifted'),
            bucket.file(`${DEMO_STORAGE_PREFIX}runtime-object.txt`).save('remove me'),
        ]);

        await resetDemoBaseline(resetOptions);

        expect(await readPersistedBaseline()).toEqual(documentsAfterFirstReset);
        expect(await readPersistedObjects()).toEqual(objectsAfterFirstReset);

        const authUsersAfter = (await firebaseAuth.listUsers()).users
            .map(user => ({ uid: user.uid, email: user.email }))
            .sort((left, right) => left.email.localeCompare(right.email));
        const profilesAfter = await Promise.all(provisioned.map(async persona => ({
            uid: persona.uid,
            data: (await firestore.collection('users').doc(persona.uid).get()).data(),
        })));

        expect(authUsersAfter).toEqual(authUsersBefore);
        expect(profilesAfter).toEqual(profilesBefore);
    });

    test('runs the explicit reset command against the configured demo project', async () => {
        await firestore.collection('campaigns').doc('demo-command-drift').set({
            demo_reset_scope: DEMO_RESET_SCOPE,
            name: 'remove me',
        });

        const { stdout } = await execFileAsync(process.execPath, ['scripts/reset-demo.js'], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                NODE_ENV: 'test',
                GOOGLE_CLOUD_PROJECT: projectId,
                DEMO_PROJECT_ID: projectId,
                DEMO_ASSETS_BUCKET: bucketName,
            },
        });

        expect(stdout).toContain('"projectId": "softomedia-demo"');
        expect(stdout).toContain('"documentsWritten": 19');
        expect((await firestore.collection('campaigns').doc('demo-command-drift').get()).exists).toBe(false);
    });
});
