import { jest } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from './fixtures/test-app.js';
import { createInMemoryUserRepository } from './fixtures/in-memory-users.js';
import { describeWithAuthEmulator, signInAs } from './fixtures/emulator-sign-in.js';

jest.setTimeout(30_000);

const storedMedia = new Map();
const storedObjects = new Map();
let durableMetadataAvailable = true;

const mediaRepository = {
    isDurable: () => durableMetadataAvailable,
    async create(id, data) {
        if (data.title === 'Metadata failure') throw new Error('Firestore unavailable');
        const record = { id, ...data };
        storedMedia.set(id, record);
        return record;
    },
    async findAll() {
        return [...storedMedia.values()];
    },
    async findAllDurable() {
        return [...storedMedia.values()];
    },
};

jest.unstable_mockModule('../src/repositories/index.js', () => ({
    mediaRepository,
    campaignRepository: { findAll: async () => [], targetsRetailer: () => false },
    userRepository: createInMemoryUserRepository(),
}));
jest.unstable_mockModule('../src/utils/storage.js', () => ({
    async uploadMediaObject({ destination, buffer, contentType }) {
        if (buffer.toString().includes('storage failure')) throw new Error('Storage unavailable');
        storedObjects.set(destination, { buffer, contentType });
        return {
            storage_path: `gs://softomedia-demo.firebasestorage.app/${destination}`,
            object_ref: { kind: 'gcs', bucketName: 'softomedia-demo.firebasestorage.app', destination },
        };
    },
    async deleteMediaObject(objectReference) {
        storedObjects.delete(objectReference.destination);
    },
    async openMediaObject() {
        return null;
    },
}));

const { default: assetsRouter } = await import('../src/api/assets.js');
const { authenticate } = await import('../src/middleware/auth.js');
const app = createTestApp(assetsRouter, '/api/assets', { middleware: [authenticate] });

/** Requests from a user signed in through the Auth emulator with this role and Organization. */
async function appAs(role, organizationId = `entity-${role}`) {
    const { headers } = await signInAs(role, { organizationId });
    return {
        get: path => request(app).get(path).set(headers),
        post: path => request(app).post(path).set(headers),
    };
}

function upload(client, fields = {}, filename = 'creative.png') {
    let pending = client.post('/api/assets/upload');
    for (const [key, value] of Object.entries(fields)) pending = pending.field(key, value);
    const bytes = filename.endsWith('.mp4')
        ? Buffer.concat([Buffer.alloc(4), Buffer.from('ftypisom')])
        : Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Buffer.from('image')]);
    return pending.attach('file', bytes, {
        filename,
        contentType: filename.endsWith('.mp4') ? 'video/mp4' : 'image/png',
    });
}

function uploadBytes(client, fields, bytes, filename = 'creative.png') {
    let pending = client.post('/api/assets/upload');
    for (const [key, value] of Object.entries(fields)) pending = pending.field(key, value);
    return pending.attach('file', Buffer.from(bytes), { filename, contentType: 'image/png' });
}

describeWithAuthEmulator('classified media API', () => {
    beforeEach(() => {
        storedMedia.clear();
        storedObjects.clear();
        durableMetadataAvailable = true;
    });

    it.each([
        ['paid', 'brand', 'brand-1', 'campaign'],
        ['retailer', 'retailer', 'retailer-1', 'campaign'],
        ['internal', 'platform', '', 'campaign'],
        ['fallback', 'platform', '', 'neutral_fallback'],
    ])('lets Admin persist %s media with playback metadata', async (category, ownerType, ownerId, contentKind) => {
        const response = await upload(await appAs('admin'), {
            title: `${category} creative`,
            category,
            owner_type: ownerType,
            owner_id: ownerId,
            approval_status: 'approved',
            duration: '5',
        });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
            title: `${category} creative`,
            category,
            owner_type: ownerType,
            owner_id: ownerId || null,
            approval_status: 'approved',
            eligible_for_playback: true,
            content_kind: contentKind,
            duration: 5,
            mime_type: 'image/png',
            status: 'ready',
        });
        expect(response.body.id).toMatch(/^ast_/);
        expect(response.body.storage_path).toContain(response.body.id);
        expect(response.body.size_bytes).toBe(13);
    });

    it('lets Brand use the same upload contract while enforcing Brand ownership', async () => {
        const brand = await appAs('brand', 'brand-owned-org');
        const response = await upload(brand, {
            title: 'Brand creative',
            category: 'paid',
            owner_type: 'platform',
            owner_id: 'somebody-else',
            approval_status: 'approved',
            duration: '5',
        });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
            category: 'paid',
            owner_type: 'brand',
            owner_id: 'brand-owned-org',
            approval_status: 'pending_approval',
            eligible_for_playback: false,
        });

        const list = await brand.get('/api/assets');
        expect(list.status).toBe(200);
        expect(list.body.map(asset => asset.id)).toContain(response.body.id);
    });

    it.each(['retaileradmin', 'techoperator'])('rejects %s uploads', async role => {
        const response = await upload(await appAs(role), {
            title: 'Forbidden fallback',
            category: 'fallback',
            owner_type: 'platform',
            approval_status: 'approved',
            duration: '5',
        });

        expect(response.status).toBe(403);
        expect(storedObjects.size).toBe(0);
        expect(storedMedia.size).toBe(0);
    });

    it('rejects missing classification metadata before storing an object', async () => {
        const response = await upload(await appAs('admin'), { title: 'Incomplete' });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/category/i);
        expect(storedObjects.size).toBe(0);
    });

    it('removes the uploaded object when metadata persistence fails', async () => {
        const response = await upload(await appAs('admin'), {
            title: 'Metadata failure',
            category: 'internal',
            owner_type: 'platform',
            approval_status: 'approved',
            duration: '5',
        });

        expect(response.status).toBe(500);
        expect(response.body.error).toMatch(/could not be saved/i);
        expect(storedObjects.size).toBe(0);
        expect(storedMedia.size).toBe(0);
    });

    it('reports storage failure without recording metadata or success', async () => {
        const response = await uploadBytes(await appAs('admin'), {
            title: 'Storage failure',
            category: 'internal',
            owner_type: 'platform',
            approval_status: 'approved',
            duration: '5',
        }, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Buffer.from('storage failure')]));

        expect(response.status).toBe(500);
        expect(response.body.error).toMatch(/no success was recorded/i);
        expect(storedObjects.size).toBe(0);
        expect(storedMedia.size).toBe(0);
    });

    it('rejects bytes that do not match the declared media type', async () => {
        const response = await uploadBytes(await appAs('admin'), {
            title: 'Disguised executable',
            category: 'internal',
            owner_type: 'platform',
            approval_status: 'approved',
            duration: '5',
        }, 'not a png');

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/invalid file type/i);
        expect(storedObjects.size).toBe(0);
        expect(storedMedia.size).toBe(0);
    });

    it('does not store an object or report success when durable metadata is unavailable', async () => {
        durableMetadataAvailable = false;
        const response = await upload(await appAs('admin'), {
            title: 'Cannot persist',
            category: 'internal',
            owner_type: 'platform',
            approval_status: 'approved',
            duration: '5',
        });

        expect(response.status).toBe(503);
        expect(response.body.error).toMatch(/no success was recorded/i);
        expect(storedObjects.size).toBe(0);
        expect(storedMedia.size).toBe(0);
    });
});
