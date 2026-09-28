import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { getCampaigns } = vi.hoisted(() => ({ getCampaigns: vi.fn() }));
vi.mock('../services/ApiService.js', () => ({ default: { getCampaigns, updateCampaignStatus: vi.fn() } }));
// Previews read the private files through the API.
vi.mock('../services/api.js', () => ({ default: { get: vi.fn(async () => new Blob(['pixels'])) } }));

import CampaignApprovalList from './CampaignApprovalList';

const campaign = fields => ({
    id: 'cmp_1', name: 'Breakfast story', status: 'pending_approval', advertiser_id: 'brand-one',
    start_date: '2030-01-07', end_date: '2030-01-07', ...fields,
});

const previews = async () => {
    fireEvent.click(await screen.findByText('Breakfast story'));
    return screen.getAllByRole('img').map(image => image.getAttribute('alt'));
};

describe('Retailer Campaign approval', () => {
    it('previews every file of a multi-file Creative, in play order, before the Retailer approves', async () => {
        getCampaigns.mockResolvedValue([campaign({ media_id: 'ast_1', creative_media_ids: ['ast_1', 'ast_2', 'ast_3'] })]);
        render(<CampaignApprovalList />);

        expect(await previews()).toEqual(['Creative file 1 of 3', 'Creative file 2 of 3', 'Creative file 3 of 3']);
    });

    it('previews a single-file Creative as before', async () => {
        getCampaigns.mockResolvedValue([campaign({ media_id: 'ast_1' })]);
        render(<CampaignApprovalList />);

        expect(await previews()).toEqual(['Creative Preview']);
    });
});
