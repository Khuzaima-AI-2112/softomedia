import request from 'supertest';
import { jest } from '@jest/globals';
import { createTestApp } from './fixtures/test-app.js';
import { createInMemoryUserRepository } from './fixtures/in-memory-users.js';
import { describeWithAuthEmulator, signInAs } from './fixtures/emulator-sign-in.js';
import { mediaAttachment, mediaFile } from './fixtures/media-files.js';

jest.setTimeout(30_000);

const storedMedia = new Map();

const mediaRepository = {
    isDurable: () => true,
    findAllDurable: async () => [...storedMedia.values()],
    create: async (id, data) => {
        const record = { id, ...data };
        storedMedia.set(id, record);
        return record;
    },
};

const creativeRepository = {
    newId: () => 'crv_test',
    create: async (id, data) => ({ id, ...data }),
    delete: async () => {},
    findAll: async () => [],
};

jest.unstable_mockModule('../src/repositories/index.js', () => ({
    mediaRepository,
    creativeRepository,
    CREATIVE_STATUS: { PENDING: 'pending' },
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

// Headers for a Brand signed in through the Auth emulator.
let brandHeaders;

/** A Brand uploads a Creative file, optionally declaring a duration. */
function uploadAsBrand(bytes, attachment, fields = {}) {
    let pending = request(app).post('/api/assets/upload')
        .set(brandHeaders)
        .field('title', 'Brand creative')
        .field('category', 'paid');
    for (const [key, value] of Object.entries(fields)) pending = pending.field(key, value);
    return pending.attach('file', bytes, attachment);
}

const uploadFixture = (name, fields) => uploadAsBrand(mediaFile(name), mediaAttachment(name), fields);

/** The media the Brand sees in its library. */
async function brandLibrary() {
    return (await request(app).get('/api/assets').set(brandHeaders)).body;
}

describeWithAuthEmulator('Stricter media rules (#35)', () => {
    beforeAll(async () => {
        ({ headers: brandHeaders } = await signInAs('brand', { organizationId: 'test_brand_id' }));
    });

    beforeEach(() => storedMedia.clear());

    it('accepts a 5 s 16:9 .mp4 and records the duration it measured, not the one declared', async () => {
        const response = await uploadFixture('five-seconds-16x9.mp4', { duration: '15' });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({ mime_type: 'video/mp4', width: 1280, height: 720 });
        expect(response.body.duration).toBeCloseTo(5, 1);
    });

    it('accepts a 5 s 16:9 .mov', async () => {
        const response = await uploadFixture('five-seconds-16x9.mov');

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({ mime_type: 'video/quicktime', width: 1280, height: 720 });
        expect(response.body.duration).toBeCloseTo(5, 1);
    });

    it.each([
        ['four-point-nine-seconds-16x9.mp4', 4.9],
        ['five-seconds-with-longer-audio.mp4', 5],
    ])('accepts %s, whose video lasts %s s', async (name, seconds) => {
        const response = await uploadFixture(name);

        expect(response.status).toBe(201);
        expect(response.body.duration).toBeCloseTo(seconds, 2);
    });

    it('rejects a 6 s video, saying how long it lasts, even when 5 s is declared', async () => {
        const response = await uploadFixture('six-seconds-16x9.mp4', { duration: '5' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('A video must last 5 seconds (±0.1 s); this one lasts 6.0 s');
        expect(await brandLibrary()).toEqual([]);
    });

    it('rejects a 4:3 frame, naming its size', async () => {
        const response = await uploadFixture('five-seconds-4x3.mp4');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Media must be 16:9; this file is 960×720');
    });

    it('rejects a 16:9 frame smaller than 1280×720, naming its size', async () => {
        const response = await uploadFixture('five-seconds-640x360.mp4');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Media must be at least 1280×720; this file is 640×360');
    });

    it.each([
        ['frame-16x9.png', 'image/png', 1280, 720],
        ['frame-16x9.jpg', 'image/jpeg', 1920, 1080],
    ])('accepts a 16:9 image (%s) for one five-second Slot', async (name, mimeType, width, height) => {
        const response = await uploadFixture(name, { duration: '15' });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({ mime_type: mimeType, width, height, duration: 5 });
    });

    it.each([
        ['an unsupported .gif', Buffer.from('GIF89a'), { filename: 'creative.gif', contentType: 'image/gif' }],
        ['a .mov that is really a PNG', mediaFile('frame-16x9.png'), { filename: 'creative.mov', contentType: 'video/quicktime' }],
    ])('rejects %s by type and signature', async (_label, bytes, attachment) => {
        const response = await uploadAsBrand(bytes, attachment);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid file type. Allowed: .png, .jpg, .jpeg, .mp4, .mov');
    });

    // A valid 16:9 PNG with padding after its image data, to reach a given size.
    const paddedPng = bytes => Buffer.concat([mediaFile('frame-16x9.png'), Buffer.alloc(bytes)]).subarray(0, bytes);

    it('accepts a file between the old 5 MB limit and 20 MB', async () => {
        const response = await uploadAsBrand(paddedPng(6 * 1024 * 1024), mediaAttachment('frame-16x9.png'));

        expect(response.status).toBe(201);
    });

    it('rejects a file over 20 MB, saying so', async () => {
        const response = await uploadAsBrand(paddedPng(20 * 1024 * 1024 + 1), mediaAttachment('frame-16x9.png'));

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('File must be 20 MB or smaller');
        expect(await brandLibrary()).toEqual([]);
    });

    it('rejects a 16:9 image smaller than 1280×720, naming its size', async () => {
        const response = await uploadFixture('frame-640x360.png');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Media must be at least 1280×720; this file is 640×360');
    });

    it('rejects a 4:3 image, naming its size', async () => {
        const response = await uploadFixture('frame-4x3.png');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Media must be 16:9; this file is 1024×768');
    });

    // Files that pass the signature check but whose header can't be read.
    const box = (type, ...parts) => {
        const body = Buffer.concat(parts);
        const header = Buffer.alloc(8);
        header.writeUInt32BE(8 + body.length);
        header.write(type, 4, 'latin1');
        return Buffer.concat([header, body]);
    };
    const ftyp = box('ftyp', Buffer.from('isom0000'));
    const handler = kind => box('hdlr', Buffer.alloc(8), Buffer.from(kind, 'latin1'), Buffer.alloc(12));
    const mediaHeader = (timescale, duration) => {
        const body = Buffer.alloc(20);
        body.writeUInt32BE(timescale, 12);
        body.writeUInt32BE(duration, 16);
        return box('mdhd', body);
    };
    const largeBox = () => {
        const header = Buffer.alloc(16);
        header.writeUInt32BE(1);
        header.write('free', 4, 'latin1');
        header.writeBigUInt64BE(24n, 8);
        return Buffer.concat([header, Buffer.alloc(8)]);
    };
    const toEndBox = () => Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.from('mdat', 'latin1'), Buffer.alloc(4)]);
    const video = (...children) => Buffer.concat([ftyp, box('moov', ...children)]);

    it.each([
        ['has no movie box', Buffer.concat([ftyp, box('mdat', Buffer.alloc(8))])],
        ['has only 64-bit and open-ended boxes', Buffer.concat([ftyp, largeBox(), toEndBox()])],
        ['has a box shorter than its own header', Buffer.concat([ftyp, Buffer.from([0, 0, 0, 4]), Buffer.from('free')])],
        ['has only a sound track', video(box('trak', box('mdia', handler('soun'))))],
        ['has a track with no media', video(box('trak', box('udta')))],
        ['has a video track with no duration', video(box('trak', box('tkhd', Buffer.alloc(84)), box('mdia', handler('vide'))))],
        ['has a video track of zero length', video(box('trak', box('tkhd', Buffer.alloc(84)), box('mdia', handler('vide'), mediaHeader(600, 0))))],
        ['has a cut-short track header', video(box('trak', box('mdia', handler('vide'), mediaHeader(600, 3000)), box('tkhd', Buffer.alloc(4))))],
    ])('rejects a video that %s', async (_label, bytes) => {
        const response = await uploadAsBrand(bytes, { filename: 'creative.mp4', contentType: 'video/mp4' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('The video could not be read. Upload a playable .mp4 or .mov file');
    });

    it.each([
        ['a PNG with no image header', Buffer.concat([mediaFile('frame-16x9.png').subarray(0, 8), Buffer.alloc(24)]), 'creative.png'],
        ['a JPEG that breaks off after fill and restart markers', Buffer.from([0xff, 0xd8, 0xff, 0xff, 0xd0, 0x12, 0x34, 0x56, 0x78]), 'creative.jpg'],
        ['a JPEG that ends before any frame', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02, 0x00, 0x00]), 'creative.jpeg'],
    ])('rejects %s', async (_label, bytes, filename) => {
        const contentType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';
        const response = await uploadAsBrand(bytes, { filename, contentType });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('The image could not be read. Upload a valid .png, .jpg or .jpeg file');
    });
});
