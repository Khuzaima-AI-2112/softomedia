import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { jest } from '@jest/globals';
import { createTestApp } from './fixtures/test-app.js';
import { createInMemoryUserRepository } from './fixtures/in-memory-users.js';
import { describeWithAuthEmulator, signInAs } from './fixtures/emulator-sign-in.js';

jest.setTimeout(30_000);

const mediaRepository = {
    isDurable: () => true,
    findAllDurable: async () => [],
    create: async (id, data) => ({ id, ...data }),
};

jest.unstable_mockModule('../src/repositories/index.js', () => ({
    mediaRepository,
    campaignRepository: { findAll: async () => [], targetsRetailer: () => false },
    userRepository: createInMemoryUserRepository(),
}));
jest.unstable_mockModule('../src/utils/storage.js', () => ({
    uploadMediaObject: async ({ destination }) => ({
        storage_path: `gs://test-bucket/${destination}`,
        object_ref: { kind: 'gcs', bucketName: 'test-bucket', destination },
    }),
    deleteMediaObject: async () => {},
    openMediaObject: async () => null,
}));

const { default: assetsRouter } = await import('../src/api/assets.js');
const { authenticate } = await import('../src/middleware/auth.js');
const app = createTestApp(assetsRouter, '/api/assets', { middleware: [authenticate] });

const roles = {
    BRAND: 'brand',
};

// Headers for a Brand signed in through the Auth emulator.
let brandHeaders;
const reqAs = (_role, method, route) => request(app)[method](route).set(brandHeaders);

describeWithAuthEmulator('4.4 Content Specifications & Compliance', () => {
    let dummyImagePath;
    let dummyVideoPath;
    let dummyGifPath;

    beforeAll(async () => {
        ({ headers: brandHeaders } = await signInAs(roles.BRAND, { organizationId: 'test_brand_id' }));
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
        const res = await reqAs(roles.BRAND, 'post', '/api/assets/upload')
            .attach('file', dummyGifPath);

        expect(res.status).toBe(400);
    });

    it('should reject .mp4 files if duration is missing or not exactly 5', async () => {
        const resNoDuration = await reqAs(roles.BRAND, 'post', '/api/assets/upload')
            .field('title', 'Video creative')
            .field('category', 'paid')
            .attach('file', dummyVideoPath);
        expect(resNoDuration.status).toBe(400);
        expect(resNoDuration.body.error).toMatch(/duration must be exactly 5 seconds/i);

        const resBadDuration = await reqAs(roles.BRAND, 'post', '/api/assets/upload')
            .field('title', 'Video creative')
            .field('category', 'paid')
            .field('duration', '15')
            .attach('file', dummyVideoPath);
        expect(resBadDuration.status).toBe(400);
        expect(resBadDuration.body.error).toMatch(/duration must be exactly 5 seconds/i);
    });

    it('should accept .mp4 files if duration is exactly 5', async () => {
        const res = await reqAs(roles.BRAND, 'post', '/api/assets/upload')
            .field('title', 'Video creative')
            .field('category', 'paid')
            .field('duration', '5')
            .attach('file', dummyVideoPath);
        expect(res.status).toBe(201);
        expect(res.body.duration).toBe(5);
        expect(res.body.file_type).toContain('mp4');
    });

    it('should accept image files implicitly defaulting duration to 5', async () => {
        const res = await reqAs(roles.BRAND, 'post', '/api/assets/upload')
            .field('title', 'Image creative')
            .field('category', 'paid')
            .attach('file', dummyImagePath);
        expect(res.status).toBe(201);
        expect(res.body.duration).toBe(5);
    });
});
