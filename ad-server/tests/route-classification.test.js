import { beforeAll, describe, expect, jest, test } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'softomedia-demo';
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'softomedia-demo';

jest.setTimeout(30_000);

/**
 * Every mounted route is either for a signed-in user, for a Screen with its
 * device key, a health check, or listed here as deliberately public.
 */
const DELIBERATELY_PUBLIC = new Set([
    'GET /',
    'GET /health',
    'GET /api/health/v2',
    // Crash reports from the error screen, including before sign-in.
    'POST /api/logs/error',
]);

const REMOVED = [
    'GET /api/debug/seed',
    'POST /api/debug/reset',
    'GET /api/debug/users',
    'POST /api/auth/login',
    'GET /api/playlist/sweep-screen',
    'GET /api/playlists',
    'GET /api/playlists/sweep-id',
    'POST /api/playlists',
    'PUT /api/playlists/sweep-id',
    'DELETE /api/playlists/sweep-id',
    'GET /api/telemetry/upload-url',
    'PUT /api/telemetry/sink/sweep-file',
    'POST /api/telemetry/error',
    // Firestore export to a caller-named bucket; backups are GCP scheduled exports.
    'POST /api/ops/backup',
    // Unused stubs and mocked or ungated data.
    'GET /api/dashboard/stats',
    'GET /api/pricing',
    'GET /api/pricing/estimate',
    'GET /api/pricing/calculate',
    'GET /api/pricing/overrides/sweep-id',
    // Public static files; media is served from Cloud Storage.
    'GET /assets/demo_ad_1.png',
];

// Express 4 keeps a mount path only as a RegExp such as /^\/device\/?(?=\/|$)/i.
function mountPath(layer) {
    return layer.regexp.source
        .replace(/^\^/, '')
        .replace('\\/?(?=\\/|$)', '')
        .replace(/\\\//g, '/');
}

function mountedRoutes(stack, prefix = '') {
    return stack.flatMap(layer => {
        if (layer.route) {
            return Object.keys(layer.route.methods)
                // CORS pre-flight answers OPTIONS for every path.
                .filter(method => method !== '_all' && method !== 'options')
                .map(method => ({
                    method: method.toUpperCase(),
                    path: (prefix + layer.route.path).replace(/(.)\/$/, '$1'),
                }));
        }
        if (layer.handle?.stack) {
            return mountedRoutes(layer.handle.stack, prefix + mountPath(layer));
        }
        return [];
    });
}

const concrete = path => path.replace(/:[^/]+/g, 'sweep-id').replace(/\*/g, 'sweep-file');

describe('route classification', () => {
    let request;
    let app;
    let routes;

    beforeAll(async () => {
        ({ default: request } = await import('supertest'));
        ({ default: app } = await import('../index.js'));
        const unique = new Map(mountedRoutes(app._router.stack)
            .map(route => [`${route.method} ${route.path}`, route]));
        routes = [...unique.values()];
    });

    test('the sweep discovers the mounted API', () => {
        const keys = routes.map(route => `${route.method} ${route.path}`);
        expect(keys).toEqual(expect.arrayContaining([
            'GET /api/device/playback',
            'POST /api/screens',
            'GET /api/campaigns',
            'GET /api/tickets',
        ]));
    });

    test('every route that is not deliberately public refuses a request without credentials', async () => {
        const reachable = [];
        for (const { method, path } of routes) {
            if (DELIBERATELY_PUBLIC.has(`${method} ${path}`)) continue;
            const response = await request(app)[method.toLowerCase()](concrete(path)).send({});
            if (response.status !== 401) reachable.push(`${method} ${path} -> ${response.status}`);
        }
        expect(reachable).toEqual([]);
    });

    test('debug, custom login, legacy playlist, telemetry, backup, stub and static file routes are gone', async () => {
        const stillPresent = [];
        for (const route of REMOVED) {
            const [method, path] = route.split(' ');
            const response = await request(app)[method.toLowerCase()](path).send({});
            if (response.status !== 404) stillPresent.push(`${route} -> ${response.status}`);
        }
        expect(stillPresent).toEqual([]);
    });

    test('a crash report larger than the public cap is refused', async () => {
        const response = await request(app)
            .post('/api/logs/error')
            .send({ message: 'x'.repeat(20_000) });
        expect(response.status).toBe(413);
    });
});
