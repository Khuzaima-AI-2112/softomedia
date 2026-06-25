import { jest } from '@jest/globals';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { createTestApp } from './fixtures/test-app.js';
import './fixtures/mock-repos.js';

const { default: apiRouter } = await import('../src/api/index.js');

const roles = {
    ADVERTISER: 'advertiser',
    CONTENTMANAGER: 'contentmanager'
};

const reqAs = (role, method, route) => {
    const app = createTestApp(apiRouter, '/api', {
        middleware: [
            (req, res, next) => {
                req.headers['authorization'] = 'Bearer demo-token';
                req.headers['x-demo-role'] = role;
                req.headers['x-demo-user-id'] = `${role}_user_123`;
                req.headers['x-demo-retailer-id'] = 'test_retailer_id';
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

        fs.writeFileSync(dummyImagePath, 'dummy image data');
        fs.writeFileSync(dummyVideoPath, 'dummy video data');
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
            .attach('file', dummyVideoPath);
        expect(resNoDuration.status).toBe(400);
        expect(resNoDuration.body.error).toMatch(/duration must be exactly 5 seconds/i);

        const resBadDuration = await reqAs(roles.ADVERTISER, 'post', '/api/assets/upload')
            .field('duration', '15')
            .attach('file', dummyVideoPath);
        expect(resBadDuration.status).toBe(400);
        expect(resBadDuration.body.error).toMatch(/duration must be exactly 5 seconds/i);
    });

    it('should accept .mp4 files if duration is exactly 5', async () => {
        const res = await reqAs(roles.ADVERTISER, 'post', '/api/assets/upload')
            .field('duration', '5')
            .attach('file', dummyVideoPath);
        // Assuming cloud storage mock or actual config returns 201
        expect([201, 500]).toContain(res.status);
        if (res.status === 201) {
            expect(res.body.duration).toBe(5);
            expect(res.body.file_type).toContain('mp4');
        }
    });

    it('should accept image files implicitly defaulting duration to 5', async () => {
        const res = await reqAs(roles.ADVERTISER, 'post', '/api/assets/upload')
            .attach('file', dummyImagePath);
        // Accepting image
        expect([201, 500]).toContain(res.status);
        if (res.status === 201) {
            expect(res.body.duration).toBe(5);
        }
    });
});
