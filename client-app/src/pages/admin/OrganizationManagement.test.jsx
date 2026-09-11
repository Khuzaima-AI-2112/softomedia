import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDemoOrganizations, createDemoOrganization, updateDemoOrganization } = vi.hoisted(() => ({
    getDemoOrganizations: vi.fn(),
    createDemoOrganization: vi.fn(),
    updateDemoOrganization: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { role: 'superadmin' }, loading: false }),
}));
vi.mock('../../services/ApiService', () => ({
    default: { getDemoOrganizations, createDemoOrganization, updateDemoOrganization },
}));

import OrganizationManagement from './OrganizationManagement';

describe('OrganizationManagement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDemoOrganizations.mockResolvedValue([]);
        createDemoOrganization.mockResolvedValue({
            id: 'demo_org_1', name: 'Northern Lights', type: 'retailer', status: 'active',
        });
    });

    it('lets a Super Administrator create a demo organization and shows the persisted result', async () => {
        render(<OrganizationManagement />);

        await screen.findByText('No demo organizations yet.');
        fireEvent.change(screen.getByLabelText('Organization name'), { target: { value: 'Northern Lights' } });
        fireEvent.change(screen.getByLabelText('Organization type'), { target: { value: 'retailer' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create organization' }));

        await waitFor(() => expect(createDemoOrganization).toHaveBeenCalledWith({
            name: 'Northern Lights', type: 'retailer',
        }));
        expect(await screen.findByText('Northern Lights')).toBeTruthy();
    });

    it('keeps the organization visible when deactivation fails', async () => {
        getDemoOrganizations.mockResolvedValue([{
            id: 'demo_org_1', name: 'Northern Lights', type: 'retailer', status: 'active',
        }]);
        updateDemoOrganization.mockRejectedValue(new Error('Persistence unavailable'));

        render(<OrganizationManagement />);
        await screen.findByText('Northern Lights');
        fireEvent.click(screen.getByRole('button', { name: 'Deactivate Northern Lights' }));

        await waitFor(() => expect(updateDemoOrganization).toHaveBeenCalledWith('demo_org_1', { status: 'inactive' }));
        expect(screen.getByText('Persistence unavailable')).toBeTruthy();
        expect(screen.getByText('active')).toBeTruthy();
    });

    it('lets a Super Administrator edit an organization and renders the persisted result', async () => {
        getDemoOrganizations.mockResolvedValue([{
            id: 'demo_org_1', name: 'Northern Lights', type: 'retailer', status: 'active',
        }]);
        updateDemoOrganization.mockResolvedValue({
            id: 'demo_org_1', name: 'Northern Lights Media', type: 'brand', status: 'active',
        });

        render(<OrganizationManagement />);
        await screen.findByText('Northern Lights');
        fireEvent.click(screen.getByRole('button', { name: 'Edit Northern Lights' }));
        fireEvent.change(screen.getByLabelText('Edit organization name'), { target: { value: 'Northern Lights Media' } });
        fireEvent.change(screen.getByLabelText('Edit organization type'), { target: { value: 'brand' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save organization changes' }));

        await waitFor(() => expect(updateDemoOrganization).toHaveBeenCalledWith('demo_org_1', {
            name: 'Northern Lights Media', type: 'brand',
        }));
        expect(await screen.findByText('Northern Lights Media')).toBeTruthy();
    });
});
