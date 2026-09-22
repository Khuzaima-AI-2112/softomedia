import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));
vi.mock('../services/api', () => ({ default: { get: apiGet, patch: vi.fn() } }));

import LoopPreviewModal from './LoopPreviewModal';

const loop = {
    id: 'loop_1',
    hour: 9,
    date: '2030-01-16',
    status: 'pending_approval',
    slots: [
        { position: 0, asset_id: 'ast_1', asset_name: 'Retailer promo', duration: 5, status: 'PENDING' },
    ],
};

describe('LoopPreviewModal — playback preview', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiGet.mockReturnValue(new Promise(() => {})); // never resolves; only visibility is under test
        URL.createObjectURL = vi.fn(() => 'blob:mock-url');
        URL.revokeObjectURL = vi.fn();
    });

    it('opens the loop playback preview from the approval surface, showing the actual assigned Slot media', async () => {
        render(<LoopPreviewModal loop={loop} onClose={vi.fn()} onRefresh={vi.fn()} />);

        expect(screen.queryByTestId('loop-playback-preview')).toBeNull();

        fireEvent.click(screen.getByTestId('btn-preview-playback'));

        await waitFor(() => expect(screen.getByTestId('loop-playback-preview')).toBeTruthy());
        expect(apiGet).toHaveBeenCalledWith('/api/assets/ast_1/content', { responseType: 'blob' });
    });

    it('closes the playback preview and returns to the approval grid', async () => {
        render(<LoopPreviewModal loop={loop} onClose={vi.fn()} onRefresh={vi.fn()} />);

        fireEvent.click(screen.getByTestId('btn-preview-playback'));
        await waitFor(() => expect(screen.getByTestId('loop-playback-preview')).toBeTruthy());

        fireEvent.click(screen.getByTestId('preview-close-btn'));
        expect(screen.queryByTestId('loop-playback-preview')).toBeNull();
        expect(screen.getByTestId('approve-loop-btn')).toBeTruthy();
    });
});
