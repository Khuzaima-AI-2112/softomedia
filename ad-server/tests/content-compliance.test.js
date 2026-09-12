import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { jest } from '@jest/globals';
import { createTestApp } from './fixtures/test-app.js';

const mediaRepository = {
    isDurable: () => true,
    findAllDurable: async () => [],
    create: async (id, data) => ({ id, ...data }),
};

jest.unstable_mockModule('../src/repositories/index.js', () => ({ mediaRepository }));
jest.unstable_mockModule('../src/utils/storage.js', () => ({
    uploadMediaObject: async ({ destination }) => ({
        storage_path: `gs://test-bucket/${destination}`,
        url: `https://storage.test/${destination}`,
        object_ref: { kind: 'gcs', bucketName: 'test-bucket', destination },
    }),
    deleteMediaObject: async () => {},
}));

const { default: assetsRouter } = await import('../src/api/assets.js');

const roles = {
    ADVERTISER: 'advertiser',
    CONTENTMANAGER: 'contentmanager'
};

const reqAs = (role, method, route) => {
    const app = createTestApp(assetsRouter, '/api/assets', {
        middleware: [
            (req, _res, next) => {
                req.user = {
                    id: `${role}_user_123`,
                    role,
                    linked_entity_id: 'test_brand_id',
                };
                next();
            }
        ]
    });
    return request(app)[method](route);
};

describe('4.4 Content Specifications & Compliance', () => {
    let dummyImagePath;
    let dummyVideoPath;
    let dummyGifPath;

    beforeAll(() => {
        // Create dummy files for tests
        dummyImagePath = path.join(process.cwd(), 'dummy.png');
        dummyVideoPath = path.join(process.cwd(), 'dummy.mp4');
        dummyGifPath = path.join(process.cwd(), 'dummy.gif');

        fs.writeFileSync(dummyImagePath, Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
            ...Buffer.from('image data'),
        ]));
        fs.writeFileSync(dummyVideoPath, Buffer.concat([
            Buffer.alloc(4),
            Buffer.from('ftypisom'),
        ]));
        fs.writeFileSync(dummyGifPath, 'dummy gif data');
    });

    afterAll(() => {
        // Clean up
        if (fs.existsSync(dummyImagePath)) fs.unlinkSync(dummyImagePath);
        if (fs.existsSync(dummyVideoPath)) fs.unlinkSync(dummyVideoPath);
        if (fs.existsSync(dummyGifPath)) fs.unlinkSync(dummyGifPath);
    });

    it('should reject unsupported file types like .gif', async () => {
        const res = await reqAs(roles.ADVERTISER, 'post', '/api/assets/upload')
            .attach('file', dummyGifPath);

        // Multer throws error HTML/JSON depending on handler, but expects 500 or 400 for bad extension
        expect([400, 500]).toContain(res.status);
    });

    it('should reject .mp4 files if duration is missing or not exactly 5', async () => {
        const resNoDuration = await reqAs(roles.ADVERTISER, 'post', '/api/assets/upload')
            .field('title', 'Video creative')
            .field('category', 'paid')
            .attach('file', dummyVideoPath);
        expect(resNoDuration.status).toBe(400);
        expect(resNoDuration.body.error).toMatch(/duration must be exactly 5 seconds/i);

        const resBadDuration = await reqAs(roles.ADVERTISER, 'post', '/api/assets/upload')
            .field('title', 'Video creative')
            .field('category', 'paid')
            .field('duration', '15')
            .attach('file', dummyVideoPath);
        expect(resBadDuration.status).toBe(400);
        expect(resBadDuration.body.error).toMatch(/duration must be exactly 5 seconds/i);
    });

    it('should accept .mp4 files if duration is exactly 5', async () => {
        const res = await reqAs(roles.ADVERTISER, 'post', '/api/assets/upload')
            .field('title', 'Video creative')
            .field('category', 'paid')
            .field('duration', '5')
            .attach('file', dummyVideoPath);
        expect(res.status).toBe(201);
        expect(res.body.duration).toBe(5);
        expect(res.body.file_type).toContain('mp4');
    });

    it('should accept image files implicitly defaulting duration to 5', async () => {
        const res = await reqAs(roles.ADVERTISER, 'post', '/api/assets/upload')
            .field('title', 'Image creative')
            .field('category', 'paid')
            .attach('file', dummyImagePath);
        expect(res.status).toBe(201);
        expect(res.body.duration).toBe(5);
    });
});
