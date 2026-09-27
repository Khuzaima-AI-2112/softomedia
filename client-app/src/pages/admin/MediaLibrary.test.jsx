import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getAssets, uploadAsset } = vi.hoisted(() => ({
    getAssets: vi.fn(),
    uploadAsset: vi.fn(),
}));

vi.mock('../../services/ApiService', () => ({ default: { getAssets, uploadAsset } }));

import MediaLibrary from './MediaLibrary';
import { browserCanPlayVideo } from '../../../test-support/browserVideo';

describe('Admin media library', () => {
    let restoreBrowser = () => {};
    beforeEach(() => {
        vi.clearAllMocks();
        getAssets.mockResolvedValue([]);
    });
    afterEach(() => restoreBrowser());

    it('refuses a .mov the browser cannot play, before uploading it', async () => {
        restoreBrowser = browserCanPlayVideo(false);
        render(<MediaLibrary />);

        await screen.findByText('No media has been uploaded yet.');
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Store opening' } });
        fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'internal' } });
        fireEvent.change(screen.getByLabelText('Media file'), {
            target: { files: [new File(['frames'], 'opening.mov', { type: 'video/quicktime' })] },
        });

        expect((await screen.findByRole('alert')).textContent)
            .toBe('This browser can\'t play opening.mov. Export it as an .mp4 and try again.');
        fireEvent.click(screen.getByRole('button', { name: 'Upload media' }));
        expect((await screen.findByRole('alert')).textContent).toBe('Choose a media file');
        expect(uploadAsset).not.toHaveBeenCalled();
    });

    it('uploads classified fallback media and only shows success after persistence', async () => {
        let finishUpload;
        uploadAsset.mockReturnValue(new Promise(resolve => { finishUpload = resolve; }));
        render(<MediaLibrary />);

        await screen.findByText('No media has been uploaded yet.');
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Neutral holding image' } });
        fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'fallback' } });
        fireEvent.change(screen.getByLabelText('Media file'), {
            target: { files: [new File(['pixels'], 'fallback.png', { type: 'image/png' })] },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Upload media' }));

        expect(screen.getByRole('button', { name: 'Uploading…' }).disabled).toBe(true);
        expect(screen.queryByText(/uploaded successfully/i)).toBeNull();
        await waitFor(() => expect(uploadAsset).toHaveBeenCalled());
        const form = uploadAsset.mock.calls[0][0];
        expect(form.get('category')).toBe('fallback');
        expect(form.get('owner_type')).toBe('platform');
        expect(form.get('approval_status')).toBe('approved');

        finishUpload({
            id: 'ast_fallback', title: 'Neutral holding image', category: 'fallback',
            content_kind: 'neutral_fallback', approval_status: 'approved', status: 'ready',
            owner_type: 'platform', owner_id: null, duration: 5, filename: 'fallback.png',
        });

        expect(await screen.findByText('Media uploaded successfully.')).toBeTruthy();
        expect(within(screen.getByTestId('media-ast_fallback')).getByText('Neutral fallback')).toBeTruthy();
    });

    it('approves paid media only as a Creative: no approval choice on upload, and its Creative\'s status shown', async () => {
        uploadAsset.mockResolvedValue({
            id: 'ast_paid', title: 'Brand latte', category: 'paid', owner_type: 'brand', owner_id: 'brand-1',
            creative_id: 'crv_paid', creative: { id: 'crv_paid', approval_status: 'pending' },
            status: 'ready', duration: 5, filename: 'latte.png',
        });
        render(<MediaLibrary />);

        await screen.findByText('No media has been uploaded yet.');
        fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'paid' } });
        expect(screen.queryByLabelText('Approval status')).toBeNull();
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Brand latte' } });
        fireEvent.change(screen.getByLabelText('Brand ID'), { target: { value: 'brand-1' } });
        fireEvent.change(screen.getByLabelText('Media file'), {
            target: { files: [new File(['pixels'], 'latte.png', { type: 'image/png' })] },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Upload media' }));

        await waitFor(() => expect(uploadAsset).toHaveBeenCalled());
        expect(uploadAsset.mock.calls[0][0].has('approval_status')).toBe(false);
        expect(await within(await screen.findByTestId('media-ast_paid')).findByText('Creative pending')).toBeTruthy();
    });

    it('shows a truthful error and does not add an asset when persistence fails', async () => {
        uploadAsset.mockRejectedValue(new Error('Media could not be saved; no success was recorded'));
        render(<MediaLibrary />);

        await screen.findByText('No media has been uploaded yet.');
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Internal card' } });
        fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'internal' } });
        fireEvent.change(screen.getByLabelText('Media file'), {
            target: { files: [new File(['pixels'], 'internal.png', { type: 'image/png' })] },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Upload media' }));

        expect((await screen.findByRole('alert')).textContent).toContain('Media could not be saved');
        expect(screen.getByText('No media has been uploaded yet.')).toBeTruthy();
        expect(screen.queryByText(/uploaded successfully/i)).toBeNull();
    });
});
