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

const { DEMO_BUSINESS_COLLECTIONS, DEMO_STORAGE_PREFIX, buildDemoBaseline } = await import('../src/services/DemoBaseline.js');
const { resetDemoBaseline } = await import('../src/services/DemoResetService.js');
const { DEMO_PERSONAS, provisionDemoPersonas } = await import('../src/services/DemoPersonaProvisioner.js');
const { getFirebaseAuth } = await import('../src/utils/firebaseAuth.js');
const repositories = await import('../src/repositories/index.js');
const { BaseRepository } = await import('../src/repositories/BaseRepository.js');
const { playbackService } = await import('../src/services/PlaybackService.js');
const { loopGenerationService } = await import('../src/services/LoopGenerationService.js');

const RESET_AT = new Date('2030-01-15T10:30:00.000Z');

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

const reset = (overrides = {}) => resetDemoBaseline({
    firestore,
    storage,
    activeProjectId: projectId,
    expectedProjectId: projectId,
    bucketName,
    resetAt: RESET_AT,
    ...overrides,
});

const byPath = (left, right) => left.path.localeCompare(right.path);

/** Every collection a repository writes, apart from user profiles, which reset keeps. */
const repositoryCollections = [...new Set(Object.values(repositories)
    .filter(value => value instanceof BaseRepository)
    .map(repository => repository.collectionName))]
    .filter(collection => collection !== 'users')
    .sort();

async function readBusinessDocuments() {
    const snapshots = await Promise.all(DEMO_BUSINESS_COLLECTIONS.map(collection => firestore.collection(collection).get()));
    return snapshots.flatMap((snapshot, index) => snapshot.docs.map(document => ({
        path: `${DEMO_BUSINESS_COLLECTIONS[index]}/${document.id}`,
        data: document.data(),
    }))).sort(byPath);
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

        await document.set({ value: 'keep' });
        await object.save('keep', { contentType: 'text/plain' });

        await expect(reset({ activeProjectId: 'not-the-demo-project' }))
            .rejects.toThrow('Refusing to reset demo data in project not-the-demo-project');
        await expect(reset({ bucketName: 'unrelated-live-project.appspot.com' }))
            .rejects.toThrow('Refusing to reset demo data in bucket unrelated-live-project.appspot.com');

        expect((await document.get()).data()).toEqual({ value: 'keep' });
        expect((await object.download())[0].toString()).toBe('keep');
    });

    test('empties every collection the app writes to', () => {
        expect(repositoryCollections.filter(collection => !DEMO_BUSINESS_COLLECTIONS.includes(collection))).toEqual([]);
    });

    // #18: what the app wrote during a walkthrough carried no mark, so reset left it behind.
    test('removes every app-created record and upload, keeps user profiles, and restores the baseline', async () => {
        const appCreated = repositoryCollections.map(collection =>
            firestore.collection(collection).doc(`app-created-${collection}`));
        const userProfile = firestore.collection('users').doc('demo-preserved-user-profile');
        const appUpload = bucket.file(`${DEMO_STORAGE_PREFIX}uploads/app-created.png`);
        const outsideDemoPrefix = bucket.file('unrelated/customer-object.txt');
        cleanupDocuments.push(...appCreated, userProfile);
        cleanupObjects.push(appUpload, outsideDemoPrefix);

        await Promise.all([
            ...appCreated.map(document => document.set({ name: 'made during a walkthrough' })),
            firestore.collection('campaigns').doc('demo-secondary-campaign-1').set({ name: 'drifted' }),
            userProfile.set({ value: 'preserve' }),
            appUpload.save('uploaded', { contentType: 'text/plain' }),
            outsideDemoPrefix.save('preserve', { contentType: 'text/plain' }),
        ]);

        const result = await reset();

        const baseline = buildDemoBaseline({ resetAt: RESET_AT, bucketName });
        expect(result).toEqual({
            projectId,
            bucketName,
            resetAt: '2030-01-15T10:30:00.000Z',
            documentsWritten: baseline.documents.length,
            storageObjectsWritten: 4,
        });
        expect(await readBusinessDocuments()).toEqual(baseline.documents
            .map(({ collection, id, data }) => ({ path: `${collection}/${id}`, data }))
            .sort(byPath));
        expect((await userProfile.get()).data()).toEqual({ value: 'preserve' });

        const [objects] = await bucket.getFiles({ prefix: DEMO_STORAGE_PREFIX });
        expect(objects.map(object => object.name).sort()).toEqual([
            `${DEMO_STORAGE_PREFIX}media/fallback.png`,
            `${DEMO_STORAGE_PREFIX}media/internal.png`,
            `${DEMO_STORAGE_PREFIX}media/paid.png`,
            `${DEMO_STORAGE_PREFIX}media/retailer.png`,
        ]);
        expect((await Promise.all(objects.map(object => object.download())))
            .every(([contents]) => contents.length > 0)).toBe(true);
        expect((await outsideDemoPrefix.download())[0].toString()).toBe('preserve');
    });

    // The Screen asks for its schedule at the moment of the reset, so no hour or midnight passes in between.
    test('a Screen plays today\'s seeded schedule, as loop generation would have made it', async () => {
        await reset();

        const playback = await playbackService.getForScreen('demo-screen-secondary-2', RESET_AT);
        expect(playback).toEqual(expect.objectContaining({
            schedule_status: 'approved',
            playback_mode: 'approved_schedule',
            loop_id: `${playback.broadcast_date}_${playback.hour}_demo-store-phoenix-allday`,
        }));
        expect(playback.slots.filter(slot => slot.presentation_type === 'campaign')).toEqual([
            expect.objectContaining({
                campaign_id: 'demo-secondary-campaign-1',
                asset_id: 'demo-media-paid',
                counts_as_delivery: true,
            }),
        ]);
        expect(playback.slots.some(slot => slot.presentation_type === 'media'
            && slot.asset_id === 'demo-media-internal')).toBe(true);

        const seeded = (await firestore.collection('loops').doc(playback.loop_id).get()).data();
        const { loops } = await loopGenerationService.generateDailySchedule(
            playback.broadcast_date, 'demo-retailer-secondary', 'demo-store-phoenix-allday');
        expect(loops).toHaveLength(24);
        expect(loops.find(loop => loop.id === playback.loop_id).slots).toEqual(seeded.slots);

        await reset();
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

        await reset();
        const documentsAfterFirstReset = await readBusinessDocuments();
        const objectsAfterFirstReset = await readPersistedObjects();

        await Promise.all([
            firestore.collection('campaigns').doc('demo-secondary-campaign-1').update({ name: 'drifted' }),
            firestore.collection('campaigns').doc('demo-runtime-campaign').set({ name: 'remove me' }),
            bucket.file(`${DEMO_STORAGE_PREFIX}media/paid.png`).save('drifted'),
            bucket.file(`${DEMO_STORAGE_PREFIX}runtime-object.txt`).save('remove me'),
        ]);

        await reset();

        expect(await readBusinessDocuments()).toEqual(documentsAfterFirstReset);
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
        await firestore.collection('campaigns').doc('demo-command-drift').set({ name: 'remove me' });

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
        expect(stdout).toMatch(/"documentsWritten": \d+/);
        expect((await firestore.collection('campaigns').doc('demo-command-drift').get()).exists).toBe(false);
    });
});
