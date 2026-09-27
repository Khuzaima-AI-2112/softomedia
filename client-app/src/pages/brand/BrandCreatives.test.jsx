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

        const row = async title => (await screen.findByText(title)).closest('li');
        expect(within(await row('latte title')).getByText('Pending approval')).toBeTruthy();
        expect(within(await row('muffin title')).getByText('Approved')).toBeTruthy();
        const rejected = await row('bagel title');
        expect(within(rejected).getByText('Rejected')).toBeTruthy();
        expect(within(rejected).getByText('Logo is cropped')).toBeTruthy();
        const revoked = await row('scone title');
        expect(within(revoked).getByText('Revoked')).toBeTruthy();
        expect(within(revoked).getByText('Offer has ended')).toBeTruthy();
    });

    it('says when the Brand has no Creatives yet', async () => {
        getCreatives.mockResolvedValue([]);
        render(<BrandCreatives />);

        expect(await screen.findByText('No creatives uploaded yet.')).toBeTruthy();
    });

    it('says when the Creatives could not be loaded', async () => {
        getCreatives.mockRejectedValue(new Error('offline'));
        render(<BrandCreatives />);

        expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Your creatives could not be loaded.');
    });
});
