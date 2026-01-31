/**
 * Unified Mock Registry
 * Source of truth for all E2E tests
 */

export * from './brand.mock';
export * from './admin.mock';

// Helpers
export const createMockResponse = (data, status = 200) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(data)
});
