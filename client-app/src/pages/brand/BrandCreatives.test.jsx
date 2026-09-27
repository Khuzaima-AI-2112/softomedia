import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { getCreatives } = vi.hoisted(() => ({ getCreatives: vi.fn() }));
vi.mock('../../services/ApiService', () => ({ default: { getCreatives } }));

import BrandCreatives from './BrandCreatives';

const creative = (id, approvalStatus, fields = {}) => ({
    id,
    approval_status: approvalStatus,
    reason: null,
    files: [{ id: `ast_${id}`, title: `${id} title`, content_path: `/api/assets/ast_${id}/content` }],
    ...fields,
});

describe('Brand Creatives', () => {
    afterEach(() => getCreatives.mockReset());

    it('shows each Creative with its approval status, and the reason for a decision against it', async () => {
        getCreatives.mockResolvedValue([
            creative('latte', 'pending'),
            creative('muffin', 'approved'),
            creative('bagel', 'rejected', { reason: 'Logo is cropped' }),
            creative('scone', 'revoked', { reason: 'Offer has ended' }),
        ]);
        render(<BrandCreatives />);

        const status = async id => (await screen.findByTestId(`creative-status-${id}`)).textContent;
        expect(await status('latte')).toBe('Pending approval');
        expect(await status('muffin')).toBe('Approved');
        expect(await status('bagel')).toBe('Rejected');
        expect(within(screen.getByTestId('creative-row-bagel')).getByText('Logo is cropped')).toBeTruthy();
        expect(await status('scone')).toBe('Revoked');
        expect(within(screen.getByTestId('creative-row-scone')).getByText('Offer has ended')).toBeTruthy();
    });

    it('tells apart two uploads of the same file by when each was uploaded', async () => {
        getCreatives.mockResolvedValue([
            creative('latte', 'pending', { created_at: '2030-01-15T10:30:00.000Z' }),
            creative('latte-again', 'pending', {
                created_at: '2030-01-16T10:30:00.000Z',
                files: [{ id: 'ast_again', title: 'latte title', content_path: '/api/assets/ast_again/content' }],
            }),
        ]);
        render(<BrandCreatives />);

        const uploaded = async id => within(await screen.findByTestId(`creative-row-${id}`)).getByText(/^Uploaded /).textContent;
        expect([await uploaded('latte'), await uploaded('latte-again')]).toEqual([
            `Uploaded ${new Date('2030-01-15T10:30:00.000Z').toLocaleDateString()}`,
            `Uploaded ${new Date('2030-01-16T10:30:00.000Z').toLocaleDateString()}`,
        ]);
    });

    it('says when the Brand has no Creatives yet', async () => {
        getCreatives.mockResolvedValue([]);
        render(<BrandCreatives />);

        expect((await screen.findByTestId('brand-creatives-empty')).textContent).toBe('No creatives uploaded yet.');
    });

    it('says when the Creatives could not be loaded', async () => {
        getCreatives.mockRejectedValue(new Error('offline'));
        render(<BrandCreatives />);

        expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Your creatives could not be loaded.');
    });
});
