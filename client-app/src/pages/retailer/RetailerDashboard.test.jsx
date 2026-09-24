import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const { apiService } = vi.hoisted(() => ({ apiService: {
    getStores: vi.fn(),
    getScreens: vi.fn(),
    getLoops: vi.fn(),
} }));
vi.mock('../../services/ApiService', () => ({ default: apiService }));
vi.mock('../../components/LocationManager', () => ({ default: () => null }));
vi.mock('../../components/CampaignApprovalList', () => ({ default: () => null }));

import RetailerDashboard from './RetailerDashboard';

describe('RetailerDashboard', () => {
    it('counts pending loops from the { loops, business_hours } response (#26)', async () => {
        apiService.getStores.mockResolvedValue([{ id: 'store_1' }]);
        apiService.getScreens.mockResolvedValue([{ id: 'screen_1', status: 'online' }]);
        apiService.getLoops.mockResolvedValue({
            loops: [{ status: 'PENDING' }, { validation_status: 'pending' }, { status: 'approved' }],
            business_hours: { start: 8, end: 22, is_closed: false },
        });

        render(<MemoryRouter><RetailerDashboard /></MemoryRouter>);

        expect(await screen.findByText(/2 loops awaiting your approval/)).toBeTruthy();
    });
});
