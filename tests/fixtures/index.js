/**
 * tests/fixtures/index.js
 *
 * Barrel export for the unified test fixture system.
 *
 * USAGE:
 *   import { DEMO_ADMIN, buildLoop, mockLoopsApi } from '../fixtures/index.js';
 *
 * Or import from specific modules for tree-shaking clarity:
 *   import { DEMO_ADMIN } from '../fixtures/personas.js';
 *   import { buildLoop } from '../fixtures/factories.js';
 *   import { mockLoopsApi } from '../fixtures/mock-routes.js';
 */

export * from './personas.js';
export * from './factories.js';
export * from './mock-routes.js';
