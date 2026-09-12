import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { uploadAsset } = vi.hoisted(() => ({ uploadAsset: vi.fn() }));
vi.mock('../../../services/ApiService', () => ({ default: { uploadAsset } }));

import Step4CreativeUpload from './Step4CreativeUpload';

describe('Brand creative upload', () => {
    it('uses the classified media contract and continues with the persisted asset', async () => {
        uploadAsset.mockResolvedValue({ id: 'ast_brand', url: 'https://storage/creative.png' });
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
            creativeUrl: 'https://storage/creative.png', creativeAssetId: 'ast_brand',
        });
        expect(onNext).toHaveBeenCalled();
    });
});
