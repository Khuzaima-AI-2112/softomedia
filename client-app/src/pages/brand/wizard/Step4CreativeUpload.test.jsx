import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { uploadAsset } = vi.hoisted(() => ({ uploadAsset: vi.fn() }));
vi.mock('../../../services/ApiService', () => ({ default: { uploadAsset } }));
// The preview reads the private creative through the API.
vi.mock('../../../services/api.js', () => ({ default: { get: vi.fn(async () => new Blob(['pixels'])) } }));

import Step4CreativeUpload from './Step4CreativeUpload';
import { browserCanPlayVideo } from '../../../../test-support/browserVideo';

function chooseCreative(file) {
    fireEvent.change(screen.getByLabelText('Creative title'), { target: { value: 'Autumn offer' } });
    fireEvent.change(screen.getByLabelText('Creative file'), { target: { files: [file] } });
}

describe('Brand creative upload', () => {
    let restoreBrowser = () => {};
    afterEach(() => {
        restoreBrowser();
        uploadAsset.mockReset();
    });

    it('refuses a .mov the browser cannot play, before uploading it', async () => {
        restoreBrowser = browserCanPlayVideo(false);
        render(<Step4CreativeUpload data={{}} updateData={vi.fn()} onNext={vi.fn()} onPrev={vi.fn()} />);

        chooseCreative(new File(['frames'], 'creative.mov', { type: 'video/quicktime' }));

        expect(await screen.findByText('This browser can\'t play creative.mov. Export it as an .mp4 and try again.'))
            .toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Upload creative' }));
        expect(await screen.findByText('Enter a creative title and choose a file')).toBeTruthy();
        expect(uploadAsset).not.toHaveBeenCalled();
    });

    it('uploads a .mov the browser can play', async () => {
        restoreBrowser = browserCanPlayVideo(true);
        uploadAsset.mockResolvedValue({ id: 'ast_mov', content_path: '/api/assets/ast_mov/content' });
        render(<Step4CreativeUpload data={{}} updateData={vi.fn()} onNext={vi.fn()} onPrev={vi.fn()} />);

        chooseCreative(new File(['frames'], 'creative.mov', { type: 'video/quicktime' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Upload creative' }).disabled).toBe(false));
        fireEvent.click(screen.getByRole('button', { name: 'Upload creative' }));

        await waitFor(() => expect(uploadAsset).toHaveBeenCalled());
        expect(uploadAsset.mock.calls[0][0].get('file').name).toBe('creative.mov');
    });

    it('uses the classified media contract and continues with the persisted asset', async () => {
        uploadAsset.mockResolvedValue({ id: 'ast_brand', content_path: '/api/assets/ast_brand/content' });
        const updateData = vi.fn();
        const onNext = vi.fn();
        render(<Step4CreativeUpload data={{}} updateData={updateData} onNext={onNext} onPrev={vi.fn()} />);

        fireEvent.change(screen.getByLabelText('Creative title'), { target: { value: 'Autumn offer' } });
        fireEvent.change(screen.getByLabelText('Creative file'), {
            target: { files: [new File(['pixels'], 'creative.png', { type: 'image/png' })] },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Upload creative' }));

        await waitFor(() => expect(uploadAsset).toHaveBeenCalled());
        const form = uploadAsset.mock.calls[0][0];
        expect(form.get('category')).toBe('paid');
        expect(form.get('title')).toBe('Autumn offer');
        expect(await screen.findByText('Creative uploaded successfully.')).toBeTruthy();

        fireEvent.click(screen.getByTestId('wizard-next-step'));
        expect(updateData).toHaveBeenCalledWith({
            creativeUrl: '/api/assets/ast_brand/content', creativeAssetId: 'ast_brand',
        });
        expect(onNext).toHaveBeenCalled();
    });
});
