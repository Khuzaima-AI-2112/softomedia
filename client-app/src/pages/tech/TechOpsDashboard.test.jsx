import { render, screen } from '@testing-library/react';
import { describe, it, vi } from 'vitest';

const apiClient = vi.hoisted(() => ({
    get: vi.fn(async (path) => (path === '/api/monitoring/status'
        ? { total: 0, online: 0, offline: 0, screens: [] }
        : {
            allocated_capacity: { approved_hourly_loop_count: 0, approved_slot_count: 0 },
            campaign_delivery: 0,
            fallback_playback: 0,
            holding_slide_playback: 0,
            recent_campaign_delivery: [],
        })),
}));

vi.mock('../../services/api', () => ({ default: apiClient }));

import TechOpsDashboard from './TechOpsDashboard';

describe('Tech Ops Screen inventory', () => {
    it('shows an ellipsis, not an escape sequence, in the search box', async () => {
        render(<TechOpsDashboard />);

        await screen.findByPlaceholderText('Search screen ID…');
    });
});
