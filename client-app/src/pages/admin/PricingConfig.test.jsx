import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getPricingConfig, updatePricingConfig, getStores, updateStore, superadmin } = vi.hoisted(() => ({
    getPricingConfig: vi.fn(),
    updatePricingConfig: vi.fn(),
    getStores: vi.fn(),
    updateStore: vi.fn(),
    // One identity across renders: the page refetches when `user` changes.
    superadmin: { role: 'superadmin' },
}));

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: superadmin, loading: false }),
}));
vi.mock('../../services/ApiService', () => ({
    default: { getPricingConfig, updatePricingConfig, getStores, updateStore },
}));

import PricingConfig from './PricingConfig';

const CONFIG = {
    baseCPM: 15,
    allocation: { paid: 70, retailer: 20, internal: 10 },
    storeTrafficTiers: {
        low: { multiplier: 0.8, label: 'Low traffic' },
        medium: { multiplier: 1.0, label: 'Standard traffic' },
        high: { multiplier: 1.5, label: 'High traffic' },
    },
};

const STORES = [
    { id: 'store-1', name: 'Freshmart North', cpm_traffic_tier: 'high' },
    // Describes its footfall but has never been assigned a pricing tier.
    { id: 'store-2', name: 'Freshmart South', traffic_level: 'high' },
];

describe('PricingConfig — Store foot-traffic tiers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getPricingConfig.mockResolvedValue(CONFIG);
        updatePricingConfig.mockImplementation(async form => ({ ...CONFIG, ...form }));
        getStores.mockResolvedValue(STORES);
        updateStore.mockImplementation(async (id, data) => ({ id, ...data }));
    });

    // INC-2026-01-12: no price-altering multiplier may be applied unless the
    // Super Administrator can see and edit it here.
    it('shows every Store foot-traffic tier multiplier', async () => {
        render(<PricingConfig />);

        await waitFor(() => expect(screen.getByTestId('store-traffic-tiers')).toBeTruthy());
        expect(screen.getByTestId('store-tier-multiplier-high').value).toBe('1.5');
        expect(screen.getByTestId('store-tier-multiplier-medium').value).toBe('1');
        expect(screen.getByTestId('store-tier-multiplier-low').value).toBe('0.8');
        expect(screen.getByText('High traffic')).toBeTruthy();
    });

    it('saves an edited Store tier multiplier', async () => {
        render(<PricingConfig />);
        await waitFor(() => expect(screen.getByTestId('store-traffic-tiers')).toBeTruthy());

        fireEvent.change(screen.getByTestId('store-tier-multiplier-high'), { target: { value: '1.8' } });
        fireEvent.click(screen.getByTestId('btn-pricing-form-submit'));

        await waitFor(() => expect(updatePricingConfig).toHaveBeenCalled());
        const submitted = updatePricingConfig.mock.calls[0][0];
        expect(submitted.storeTrafficTiers.high.multiplier).toBe(1.8);
        expect(submitted.storeTrafficTiers.low.multiplier).toBe(0.8);
    });

    it('lets a Super Administrator assign a foot-traffic tier to any Store', async () => {
        render(<PricingConfig />);
        await waitFor(() => expect(screen.getByTestId('store-tier-assignments')).toBeTruthy());

        expect(screen.getByText('Freshmart North')).toBeTruthy();
        expect(screen.getByTestId('store-tier-select-store-1').value).toBe('high');
        // An unassigned Store reads as unassigned, not as an assigned Standard.
        expect(screen.getByTestId('store-tier-select-store-2').value).toBe('');

        fireEvent.change(screen.getByTestId('store-tier-select-store-2'), { target: { value: 'low' } });

        await waitFor(() => expect(updateStore).toHaveBeenCalledWith('store-2', { cpm_traffic_tier: 'low' }));
        await waitFor(() => expect(screen.getByTestId('store-tier-select-store-2').value).toBe('low'));
    });

    it('clears a Store’s tier back to unassigned', async () => {
        render(<PricingConfig />);
        await waitFor(() => expect(screen.getByTestId('store-tier-assignments')).toBeTruthy());

        fireEvent.change(screen.getByTestId('store-tier-select-store-1'), { target: { value: '' } });

        await waitFor(() => expect(updateStore).toHaveBeenCalledWith('store-1', { cpm_traffic_tier: null }));
    });

    it('surfaces a failure to assign a Store tier instead of showing it as applied', async () => {
        updateStore.mockRejectedValue(new Error('Access denied'));
        render(<PricingConfig />);
        await waitFor(() => expect(screen.getByTestId('store-tier-assignments')).toBeTruthy());

        fireEvent.change(screen.getByTestId('store-tier-select-store-1'), { target: { value: 'low' } });

        await waitFor(() => expect(screen.getByText('Access denied')).toBeTruthy());
        expect(screen.getByTestId('store-tier-select-store-1').value).toBe('high');
    });

    it('still renders when no Store tiers are configured yet', async () => {
        getPricingConfig.mockResolvedValue({ baseCPM: 15, allocation: CONFIG.allocation });
        render(<PricingConfig />);

        await waitFor(() => expect(screen.getByTestId('pricing-config')).toBeTruthy());
        expect(screen.getByTestId('store-tier-multiplier-medium').value).toBe('1');
    });
});
