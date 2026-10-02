import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));
vi.mock('../services/api', () => ({ default: { get: apiGet } }));

import LoopPreviewModal from './LoopPreviewModal';

const loop = {
    id: 'loop_1',
    hour: 9,
    date: '2030-01-16',
    slots: [
        { position: 0, asset_id: 'ast_1', asset_name: 'Retailer promo', duration: 5 },
    ],
};

afterEach(() => vi.restoreAllMocks());

describe('LoopPreviewModal — playback preview', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiGet.mockReturnValue(new Promise(() => {})); // never resolves; only visibility is under test
        URL.createObjectURL = vi.fn(() => 'blob:mock-url');
        URL.revokeObjectURL = vi.fn();
    });

    // Nobody approves an Hourly Loop (ADR 0007); the Retailer Administrator only previews it (#21).
    it('shows the loop\'s Slots with no approve or reject action', () => {
        render(<LoopPreviewModal loop={loop} onClose={vi.fn()} />);

        expect(screen.getByTestId('preview-slot-0').textContent).toContain('Retailer promo');
        expect(screen.queryByRole('button', { name: /approve/i })).toBeNull();
        expect(screen.queryByRole('button', { name: /reject/i })).toBeNull();
    });

    it('opens the loop playback preview, showing the actual assigned Slot media', async () => {
        render(<LoopPreviewModal loop={loop} onClose={vi.fn()} />);

        expect(screen.queryByTestId('loop-playback-preview')).toBeNull();

        fireEvent.click(screen.getByTestId('btn-preview-playback'));

        await waitFor(() => expect(screen.getByTestId('loop-playback-preview')).toBeTruthy());
        expect(apiGet).toHaveBeenCalledWith('/api/assets/ast_1/content', { responseType: 'blob' });
    });

    it('closes the playback preview and returns to the Slot grid', async () => {
        render(<LoopPreviewModal loop={loop} onClose={vi.fn()} />);

        fireEvent.click(screen.getByTestId('btn-preview-playback'));
        await waitFor(() => expect(screen.getByTestId('loop-playback-preview')).toBeTruthy());

        fireEvent.click(screen.getByTestId('preview-close-btn'));
        expect(screen.queryByTestId('loop-playback-preview')).toBeNull();
        expect(screen.getByTestId('loop-slots')).toBeTruthy();
    });
});
