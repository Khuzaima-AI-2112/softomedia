import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { api, auth, loadBlob } = vi.hoisted(() => ({
    api: { getCreatives: vi.fn(), approveCreative: vi.fn(), rejectCreative: vi.fn() },
    auth: { user: null, can: () => false },
    loadBlob: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../services/ApiService', () => ({ default: api }));
vi.mock('../../services/api.js', () => ({ default: { get: loadBlob } }));

import CreativeApprovals from './CreativeApprovals';

const file = (id, mimeType = 'image/png') => ({
    id, title: `${id} title`, mime_type: mimeType, content_path: `/api/assets/${id}/content`,
});

const creative = (id, fields = {}) => ({
    id,
    title: `${id} title`,
    approval_status: 'pending',
    awaits_your_decision: true,
    files: [file(`${id}-file`)],
    retailer_approvals: [],
    ...fields,
});

function renderAs(permissions) {
    auth.user = { id: 'approver', permissions };
    auth.can = permission => permissions.includes(permission);
    render(
        <MemoryRouter initialEntries={['/dashboard/creative-approvals']}>
            <Routes>
                <Route path="/dashboard/creative-approvals" element={<CreativeApprovals />} />
                <Route path="/dashboard" element={<p>Dashboard home</p>} />
            </Routes>
        </MemoryRouter>,
    );
}

describe('Creative Approvals', () => {
    beforeEach(() => {
        Object.values(api).forEach(mock => mock.mockReset());
        loadBlob.mockReset();
        loadBlob.mockResolvedValue(new Blob(['file'], { type: 'image/png' }));
        globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview');
        globalThis.URL.revokeObjectURL = vi.fn();
    });

    it('lists only the Creatives waiting on the approver, previewing every file in play order', async () => {
        api.getCreatives.mockResolvedValue([
            creative('story', {
                files: [file('story-1'), file('story-2', 'video/mp4'), file('story-3')],
            }),
            creative('decided', { awaits_your_decision: false, approval_status: 'approved' }),
        ]);
        renderAs(['creatives.approve']);

        const row = await screen.findByTestId('creative-approval-story');
        expect(within(row).getByText('story title')).toBeTruthy();
        const previews = within(row).getAllByTestId(/^creative-preview-/);
        expect(previews.map(preview => preview.getAttribute('data-testid'))).toEqual([
            'creative-preview-story-1', 'creative-preview-story-2', 'creative-preview-story-3',
        ]);
        await waitFor(() => expect(previews[1].querySelector('video')).toBeTruthy());
        expect(previews[0].querySelector('img')).toBeTruthy();
        expect(loadBlob).toHaveBeenCalledWith('/api/assets/story-2/content', { responseType: 'blob' });
        expect(screen.queryByTestId('creative-approval-decided')).toBeNull();
    });

    it('approves a Creative, which then leaves the list', async () => {
        api.getCreatives.mockResolvedValue([creative('latte')]);
        api.approveCreative.mockResolvedValue({ ...creative('latte'), approval_status: 'approved' });
        renderAs(['creatives.approve']);

        fireEvent.click(await screen.findByTestId('approve-creative-latte'));

        await waitFor(() => expect(screen.queryByTestId('creative-approval-latte')).toBeNull());
        expect(api.approveCreative).toHaveBeenCalledWith('latte');
        expect(screen.getByRole('status').textContent).toBe('Approved “latte title”.');
        expect(screen.getByTestId('creative-approvals-empty')).toBeTruthy();
    });

    it('rejects a Creative only with a reason', async () => {
        api.getCreatives.mockResolvedValue([creative('bagel')]);
        api.rejectCreative.mockResolvedValue({ ...creative('bagel'), approval_status: 'rejected' });
        renderAs(['creatives.approve_own']);

        fireEvent.click(await screen.findByTestId('reject-creative-bagel'));
        const confirm = screen.getByTestId('confirm-reject-creative-bagel');
        expect(confirm.disabled).toBe(true);
        fireEvent.change(screen.getByTestId('reject-reason-bagel'), { target: { value: '  Logo is cropped ' } });
        fireEvent.click(confirm);

        await waitFor(() => expect(api.rejectCreative).toHaveBeenCalledWith('bagel', 'Logo is cropped'));
        expect((await screen.findByRole('status')).textContent).toBe('Rejected “bagel title”.');
    });

    it('keeps a Creative in the list and says why when the decision is refused', async () => {
        api.getCreatives.mockResolvedValue([creative('latte')]);
        api.approveCreative.mockRejectedValue(new Error('The Super Administrator approves a Creative first'));
        renderAs(['creatives.approve_own']);

        fireEvent.click(await screen.findByTestId('approve-creative-latte'));

        expect((await screen.findByRole('alert')).textContent).toBe('The Super Administrator approves a Creative first');
        expect(screen.getByTestId('creative-approval-latte')).toBeTruthy();
    });

    it('says when the Creatives cannot be loaded', async () => {
        api.getCreatives.mockRejectedValue(new Error('Network down'));
        renderAs(['creatives.approve']);

        expect((await screen.findByRole('alert')).textContent).toBe('Creatives could not be loaded: Network down');
    });

    it('sends anyone without an approval grant back to the dashboard', async () => {
        renderAs(['campaigns.create']);

        expect(await screen.findByText('Dashboard home')).toBeTruthy();
        expect(api.getCreatives).not.toHaveBeenCalled();
    });
});
