import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));
vi.mock('../services/api', () => ({ default: { get: apiGet } }));

import LoopPlaybackPreview from './LoopPlaybackPreview';

const imageBlob = () => new Blob(['pixels'], { type: 'image/png' });
const videoBlob = () => new Blob(['frames'], { type: 'video/mp4' });

// Short enough to keep tests fast under real timers (no fake-timer/waitFor
// deadlock), long enough that assertions run before the next advance.
const FAST = 0.15;

describe('LoopPlaybackPreview', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        URL.createObjectURL = vi.fn(() => 'blob:mock-url');
        URL.revokeObjectURL = vi.fn();
    });

    it('plays an image Slot, then advances to the next Slot after its duration', async () => {
        apiGet.mockImplementation(path => Promise.resolve(path.includes('ast_1') ? imageBlob() : videoBlob()));
        const slots = [
            { position: 0, asset_id: 'ast_1', asset_name: 'First', duration: FAST },
            { position: 1, asset_id: 'ast_2', asset_name: 'Second', duration: FAST },
        ];

        render(<LoopPlaybackPreview slots={slots} onClose={vi.fn()} />);
        expect(screen.getByText('Slot 1/2')).toBeTruthy();

        await waitFor(() => expect(screen.getByTestId('preview-image')).toBeTruthy());
        expect(apiGet).toHaveBeenCalledWith('/api/assets/ast_1/content', { responseType: 'blob' });

        await waitFor(() => expect(screen.getByTestId('preview-video')).toBeTruthy());
        expect(apiGet).toHaveBeenCalledWith('/api/assets/ast_2/content', { responseType: 'blob' });
        expect(screen.getByText('Slot 2/2')).toBeTruthy();
    });

    it('plays video Slots muted by default with an accessible unmute control', async () => {
        apiGet.mockResolvedValueOnce(videoBlob());
        const slots = [{ position: 0, asset_id: 'ast_video', duration: 5 }];

        render(<LoopPlaybackPreview slots={slots} onClose={vi.fn()} />);

        await waitFor(() => expect(screen.getByTestId('preview-video')).toBeTruthy());
        expect(screen.getByTestId('preview-video').muted).toBe(true);

        const toggle = screen.getByTestId('preview-mute-toggle');
        expect(toggle.getAttribute('aria-label')).toBe('Unmute');

        act(() => { toggle.click(); });
        expect(screen.getByTestId('preview-video').muted).toBe(false);
        expect(screen.getByTestId('preview-mute-toggle').getAttribute('aria-label')).toBe('Mute');
    });

    it('shows an empty-slot placeholder when a Slot has no assigned asset', async () => {
        const slots = [{ position: 0, asset_id: null, duration: 5 }];
        render(<LoopPlaybackPreview slots={slots} onClose={vi.fn()} />);

        const placeholder = await screen.findByTestId('preview-empty-slot');
        expect(placeholder.textContent).toBe('Empty slot');
        expect(apiGet).not.toHaveBeenCalled();
    });

    it('shows a no-slots placeholder and never schedules an advance when the Loop has no Slots', async () => {
        render(<LoopPlaybackPreview slots={[]} onClose={vi.fn()} />);

        const placeholder = await screen.findByTestId('preview-empty-slot');
        expect(placeholder.textContent).toBe('No Slots in this Loop');
        expect(screen.queryByText(/^Slot /)).toBeNull();
        expect(apiGet).not.toHaveBeenCalled();

        await new Promise(resolve => setTimeout(resolve, 20));
        expect(screen.getByTestId('preview-empty-slot').textContent).toBe('No Slots in this Loop');
    });

    it('loops back to the first Slot after the last one finishes', async () => {
        apiGet.mockResolvedValue(imageBlob());
        const slots = [
            { position: 0, asset_id: 'ast_1', duration: FAST },
            { position: 1, asset_id: 'ast_2', duration: FAST },
        ];

        render(<LoopPlaybackPreview slots={slots} onClose={vi.fn()} />);
        await waitFor(() => expect(screen.getByText('Slot 1/2')).toBeTruthy());
        await waitFor(() => expect(screen.getByText('Slot 2/2')).toBeTruthy());
        await waitFor(() => expect(screen.getByText('Slot 1/2')).toBeTruthy());
    });
});
