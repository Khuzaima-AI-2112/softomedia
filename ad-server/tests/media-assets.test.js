import { jest } from '@jest/globals';
import request from 'supertest';
import { createTestApp } from './fixtures/test-app.js';

const storedMedia = new Map();
const storedObjects = new Map();

const mediaRepository = {
    async create(id, data) {
        if (data.title === 'Metadata failure') throw new Error('Firestore unavailable');
        const record = { id, ...data };
        storedMedia.set(id, record);
        return record;
    },
    async findAll() {
        return [...storedMedia.values()];
    },
};

jest.unstable_mockModule('../src/repositories/index.js', () => ({ mediaRepository }));
jest.unstable_mockModule('../src/utils/storage.js', () => ({
    async uploadMediaObject({ destination, buffer, contentType }) {
        if (buffer.toString() === 'storage failure') throw new Error('Storage unavailable');
        storedObjects.set(destination, { buffer, contentType });
        return {
            storage_path: `gs://softomedia-demo.firebasestorage.app/${destination}`,
            url: `http://127.0.0.1:9199/v0/b/softomedia-demo.firebasestorage.app/o/${encodeURIComponent(destination)}?alt=media`,
        };
    },
    async deleteMediaObject(storagePath) {
        const destination = storagePath.split('/').slice(3).join('/');
        storedObjects.delete(destination);
    },
}));

const { default: assetsRouter } = await import('../src/api/assets.js');

function appAs(role, linkedEntityId = `entity-${role}`) {
    return createTestApp(assetsRouter, '/api/assets', {
        middleware: [(req, _res, next) => {
            req.user = {
                id: `${role}-user`,
                role,
                linked_entity_id: linkedEntityId,
                organization_id: linkedEntityId,
            };
            next();
        }],
    });
}

function upload(app, fields = {}, filename = 'creative.png') {
    let pending = request(app).post('/api/assets/upload');
    for (const [key, value] of Object.entries(fields)) pending = pending.field(key, value);
    return pending.attach('file', Buffer.from('real image bytes'), {
        filename,
        contentType: filename.endsWith('.mp4') ? 'video/mp4' : 'image/png',
    });
}

function uploadBytes(app, fields, bytes, filename = 'creative.png') {
    let pending = request(app).post('/api/assets/upload');
    for (const [key, value] of Object.entries(fields)) pending = pending.field(key, value);
    return pending.attach('file', Buffer.from(bytes), { filename, contentType: 'image/png' });
}

describe('classified media API', () => {
    beforeEach(() => {
        storedMedia.clear();
        storedObjects.clear();
    });

    it.each([
        ['paid', 'brand', 'brand-1', 'campaign'],
        ['retailer', 'retailer', 'retailer-1', 'campaign'],
        ['internal', 'platform', '', 'campaign'],
        ['fallback', 'platform', '', 'neutral_fallback'],
    ])('lets Admin persist %s media with playback metadata', async (category, ownerType, ownerId, contentKind) => {
        const response = await upload(appAs('admin'), {
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
        expect(response.body.size_bytes).toBe(16);
    });

    it('lets Brand use the same upload contract while enforcing Brand ownership', async () => {
        const app = appAs('brand', 'brand-owned-org');
        const response = await upload(app, {
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

        const list = await request(app).get('/api/assets');
        expect(list.status).toBe(200);
        expect(list.body.map(asset => asset.id)).toContain(response.body.id);
    });

    it.each(['retaileradmin', 'techoperator'])('rejects %s uploads', async role => {
        const response = await upload(appAs(role), {
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
        const response = await upload(appAs('admin'), { title: 'Incomplete' });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/category/i);
        expect(storedObjects.size).toBe(0);
    });

    it('removes the uploaded object when metadata persistence fails', async () => {
        const response = await upload(appAs('admin'), {
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
        const response = await uploadBytes(appAs('admin'), {
            title: 'Storage failure',
            category: 'internal',
            owner_type: 'platform',
            approval_status: 'approved',
            duration: '5',
        }, 'storage failure');

        expect(response.status).toBe(500);
        expect(response.body.error).toMatch(/no success was recorded/i);
        expect(storedObjects.size).toBe(0);
        expect(storedMedia.size).toBe(0);
    });
});
