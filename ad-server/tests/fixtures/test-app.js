/**
 * ad-server/tests/fixtures/test-app.js
 *
 * Shared Express test app builder for backend Jest tests.
 *
 * Provides a pre-configured Express app with JSON body parsing and optional
 * middleware, reducing the boilerplate of creating an app in every test file.
 *
 * USAGE:
 *   import { createTestApp } from './fixtures/test-app.js';
 *
 *   const app = createTestApp(myRouter, '/api/health');
 *   const response = await request(app).get('/api/health/v2');
 *
 * OPTIONS:
 *   createTestApp(router, path, {
 *     middleware: [cors(), rateLimit(...)],  // extra middleware
 *     json: true,                           // enable JSON parsing (default: true)
 *   });
 */

import express from 'express';

/**
 * Create a test Express app with the given router mounted at the given path.
 *
 * @param {import('express').Router} router — Express router to mount
 * @param {string} [path='/api'] — URL prefix to mount the router at
 * @param {object} [options]
 * @param {Function[]} [options.middleware] — additional middleware to apply
 * @param {boolean} [options.json] — enable express.json() (default: true)
 * @returns {import('express').Application}
 */
export function createTestApp(router, path = '/api', options = {}) {
    const app = express();

    // JSON body parsing (enabled by default)
    if (options.json !== false) {
        app.use(express.json());
    }

    // Apply additional middleware
    if (options.middleware) {
        for (const mw of options.middleware) {
            app.use(mw);
        }
    }

    // Mount the router
    app.use(path, router);

    return app;
}

/**
 * Create a mock request user object for auth middleware bypass.
 *
 * @param {object} [overrides]
 * @returns {object} A mock user object
 */
export function createMockUser(overrides = {}) {
    return {
        id: 'test-user-001',
        email: 'test@softomedia.demo',
        role: 'admin',
        linked_entity_id: 'entity-admin-001',
        ...overrides,
    };
}

/**
 * Create a middleware that injects a mock user into req.user,
 * simulating authenticated requests without real auth infrastructure.
 *
 * @param {object} [userOverrides] — overrides for the mock user
 * @returns {Function} Express middleware
 */
export function createMockAuthMiddleware(userOverrides = {}) {
    const mockUser = createMockUser(userOverrides);
    return (req, _res, next) => {
        req.user = mockUser;
        next();
    };
}
