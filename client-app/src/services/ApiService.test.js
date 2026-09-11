import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiClient } = vi.hoisted(() => ({ apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
} }));

vi.mock('./api', () => ({ default: apiClient }));

import apiService from './ApiService';

describe('platform governance API service', () => {
    beforeEach(() => vi.clearAllMocks());

    it('uses the dedicated demo organization endpoints', async () => {
        await apiService.getDemoOrganizations();
        await apiService.createDemoOrganization({ name: 'Northern Lights', type: 'retailer' });
        await apiService.updateDemoOrganization('demo_org_1', { status: 'inactive' });

        expect(apiClient.get).toHaveBeenCalledWith('/api/platform/organizations');
        expect(apiClient.post).toHaveBeenCalledWith('/api/platform/organizations', {
            name: 'Northern Lights', type: 'retailer',
        });
        expect(apiClient.patch).toHaveBeenCalledWith('/api/platform/organizations/demo_org_1', {
            status: 'inactive',
        });
    });
});
