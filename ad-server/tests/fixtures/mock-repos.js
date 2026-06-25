/**
 * ad-server/tests/fixtures/mock-repos.js
 *
 * Shared mock repository builders for backend Jest tests.
 *
 * DESIGN PRINCIPLES:
 *   1. Each builder returns a complete mock repository with jest.fn() stubs.
 *   2. Callers pass overrides to customize specific methods or return values.
 *   3. All standard CRUD methods are stubbed by default.
 *   4. Circuit breaker health is always included (matches production repos).
 *
 * USAGE:
 *   import { createMockScreenRepository } from './fixtures/mock-repos.js';
 *
 *   jest.unstable_mockModule('../src/repositories/index.js', () => ({
 *     screenRepository: createMockScreenRepository(),
 *   }));
 *
 * ADDING A NEW MOCK REPO:
 *   1. Add a builder function below following the pattern.
 *   2. Export it from this file.
 *   3. Update jest.unstable_mockModule() calls in test files to use it.
 */

import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Base mock builder — provides standard CRUD stubs
// ---------------------------------------------------------------------------

function createBaseMockRepo(overrides = {}) {
    return {
        findById: jest.fn(() => null),
        findAll: jest.fn(() => []),
        create: jest.fn((id, data) => ({ id, ...data })),
        update: jest.fn((id, data) => ({ id, ...data })),
        delete: jest.fn(() => true),
        exists: jest.fn(() => false),
        count: jest.fn(() => 0),
        breaker: {
            getHealth: jest.fn(() => ({ state: 'CLOSED', failures: 0 })),
        },
        db: true,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Domain-specific mock repositories
// ---------------------------------------------------------------------------

export function createMockScreenRepository(overrides = {}) {
    return createBaseMockRepo({
        findByStoreId: jest.fn(() => []),
        findByRetailerId: jest.fn(() => []),
        register: jest.fn((data) => ({ screen_id: data.screen_id || 'mock-screen', ...data })),
        ...overrides,
    });
}

export function createMockAdRepository(overrides = {}) {
    return createBaseMockRepo({
        findByAdvertiserId: jest.fn(() => []),
        findByCampaignId: jest.fn(() => []),
        ...overrides,
    });
}

export function createMockRetailerRepository(overrides = {}) {
    return createBaseMockRepo({
        findByStatus: jest.fn(() => []),
        ...overrides,
    });
}

export function createMockAdvertiserRepository(overrides = {}) {
    return createBaseMockRepo({
        findByLinkedUserId: jest.fn(() => []),
        ...overrides,
    });
}

export function createMockCampaignRepository(overrides = {}) {
    return createBaseMockRepo({
        findByAdvertiserId: jest.fn(() => []),
        findByRetailerId: jest.fn(() => []),
        findByStatus: jest.fn(() => []),
        ...overrides,
    });
}

export function createMockLoopRepository(overrides = {}) {
    return createBaseMockRepo({
        findByDate: jest.fn(() => []),
        findByDateAndHour: jest.fn(() => null),
        findByRetailerId: jest.fn(() => []),
        ...overrides,
    });
}

export function createMockStoreRepository(overrides = {}) {
    return createBaseMockRepo({
        findByRetailerId: jest.fn(() => []),
        ...overrides,
    });
}

export function createMockUserRepository(overrides = {}) {
    return createBaseMockRepo({
        findByEmail: jest.fn(() => null),
        findByRole: jest.fn(() => []),
        ...overrides,
    });
}

export function createMockPricingRepository(overrides = {}) {
    return createBaseMockRepo({
        getConfig: jest.fn(() => ({
            baseCPM: 12.0,
            traffic_tiers: {},
            retailer_overrides: {},
        })),
        updateConfig: jest.fn(),
        clearOverridesOnBaseCPMChange: jest.fn(),
        ...overrides,
    });
}

export function createMockPlaylistRepository(overrides = {}) {
    return createBaseMockRepo({
        findGlobal: jest.fn(() => null),
        findByScreenId: jest.fn(() => null),
        ...overrides,
    });
}
