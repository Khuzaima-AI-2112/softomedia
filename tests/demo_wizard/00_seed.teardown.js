/**
 * 00_seed.teardown.js
 *
 * Playwright globalTeardown wrapper for the demo wizard suite.
 *
 * Playwright's globalTeardown config key only accepts a file path — it does
 * NOT support the `file#namedExport` fragment syntax. This wrapper imports
 * the named demoSeedTeardown export from 00_seed.setup.js and re-exports it
 * as the default export so Playwright can resolve it correctly.
 *
 * Referenced in playwright.config.js as:
 *   globalTeardown: './tests/demo_wizard/00_seed.teardown.js'
 */

export { demoSeedTeardown as default } from './00_seed.setup.js';
