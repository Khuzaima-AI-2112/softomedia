import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { api } = vi.hoisted(() => ({ api: { getCreatives: vi.fn(), substituteCreative: vi.fn() } }));
vi.mock('../../services/ApiService', () => ({ default: api }));

import CreativeSubstitution from './CreativeSubstitution';
import { APIError } from '../../services/api.js';

const creative = (id, fields = {}) => ({
    id,
    title: `${id} title`,
    approval_status: 'approved',
    media_ids: [`${id}-file`],
    retailer_approvals: [],
    ...fields,
});

const CAMPAIGN = { id: 'cmp-1', name: 'Latte at Downtown', creative_id: 'latte' };

afterEach(() => vi.restoreAllMocks());

// A revoked Creative's Slots play Fallback Content until the Brand substitutes another (#38).
describe('CreativeSubstitution', () => {
    beforeEach(() => {
        Object.values(api).forEach(mock => mock.mockReset());
    });

    it('offers nothing while the Campaign\'s Creative is not revoked', async () => {
        api.getCreatives.mockResolvedValue([creative('latte'), creative('mocha')]);
        render(<CreativeSubstitution campaign={CAMPAIGN} onSubstituted={vi.fn()} />);

        expect(await screen.findByText('latte title')).toBeTruthy();
        expect(screen.queryByRole('combobox', { name: 'Substitute Creative' })).toBeNull();
    });

    it('offers the Brand\'s other Creatives of as many files that may still play, and substitutes one', async () => {
        api.getCreatives.mockResolvedValue([
            creative('latte', { retailer_approvals: [{ retailer_id: 'harbor', retailer_name: 'Harbor Bakeries', status: 'revoked', reason: 'Menu changed' }] }),
            creative('mocha', { approval_status: 'pending' }),
            creative('duo', { media_ids: ['duo-1', 'duo-2'] }),
            creative('stale', { approval_status: 'revoked' }),
            creative('refused', { approval_status: 'rejected' }),
        ]);
        const updated = { ...CAMPAIGN, creative_id: 'mocha' };
        api.substituteCreative.mockResolvedValue(updated);
        const onSubstituted = vi.fn();
        render(<CreativeSubstitution campaign={CAMPAIGN} onSubstituted={onSubstituted} />);

        expect(await screen.findByRole('alert')).toHaveProperty('textContent',
            'Revoked by Harbor Bakeries: Menu changed. Its Slots play Fallback Content until you substitute another Creative.');
        const choice = screen.getByRole('combobox', { name: 'Substitute Creative' });
        expect([...choice.options].map(option => option.value)).toEqual(['', 'mocha']);

        fireEvent.change(choice, { target: { value: 'mocha' } });
        fireEvent.click(screen.getByRole('button', { name: 'Substitute' }));

        await waitFor(() => expect(api.substituteCreative).toHaveBeenCalledWith('cmp-1', 'mocha'));
        expect(onSubstituted).toHaveBeenCalledWith(updated);
        expect(await screen.findByRole('status')).toHaveProperty('textContent',
            '“mocha title” now fills this Campaign\'s Slots. It plays once it has both approvals.');
    });

    it('says why when the Super Administrator revoked it, and shows the server\'s reason a substitution fails', async () => {
        api.getCreatives.mockResolvedValue([
            creative('latte', { approval_status: 'revoked', reason: 'Offer has ended' }),
            creative('mocha'),
        ]);
        api.substituteCreative.mockRejectedValue(new APIError('A cancelled Campaign plays no Creative', 409,
            { error: 'A cancelled Campaign plays no Creative' }));
        render(<CreativeSubstitution campaign={CAMPAIGN} onSubstituted={vi.fn()} />);

        expect(await screen.findByText(/Revoked by the Super Administrator: Offer has ended\./)).toBeTruthy();
        fireEvent.change(screen.getByRole('combobox', { name: 'Substitute Creative' }), { target: { value: 'mocha' } });
        fireEvent.click(screen.getByRole('button', { name: 'Substitute' }));

        expect(await screen.findByText('A cancelled Campaign plays no Creative')).toBeTruthy();
    });
});
