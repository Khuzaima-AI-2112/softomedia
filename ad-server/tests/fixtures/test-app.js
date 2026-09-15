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
