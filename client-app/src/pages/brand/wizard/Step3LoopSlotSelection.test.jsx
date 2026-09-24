import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from '../../../services/api';

const { getLoops } = vi.hoisted(() => ({ getLoops: vi.fn() }));
vi.mock('../../../services/ApiService', () => ({ default: { getLoops } }));
vi.mock('../../../services/PricingService', () => ({ default: {
    init: vi.fn(async () => {}),
    getTrafficTier: () => ({ key: 'medium', multiplier: 1, label: 'Medium' }),
    getSlotPrice: () => ({ price: 1 }),
    getEstimatedImpressions: () => 0,
    formatPrice: price => `$${price}`,
    formatImpressions: count => String(count),
} }));

import Step3LoopSlotSelection from './Step3LoopSlotSelection';

const wizardData = {
    selectedStores: ['store_1'],
    selectedScreens: ['screen_1'],
    dateRange: { start: '2026-09-25', end: '2026-10-01' },
};

const renderStep = () => render(
    <Step3LoopSlotSelection data={wizardData} updateData={vi.fn()} onNext={vi.fn()} onPrev={vi.fn()} />,
);

describe('Brand wizard slot step', () => {
    beforeEach(() => vi.clearAllMocks());

    it('explains screen-level booking when loops are refused, instead of empty hours (#24)', async () => {
        getLoops.mockRejectedValue(new APIError('Access denied', 403));

        renderStep();

        expect(await screen.findByText('Slot times are assigned after approval')).toBeTruthy();
        expect(screen.queryByText(/0\/0 slots/)).toBeNull();
        expect(screen.getByRole('button', { name: 'Continue with selected screens' })).toBeTruthy();
    });

    it('says availability failed to load for errors other than a refusal', async () => {
        getLoops.mockRejectedValue(new APIError('Server error', 500));

        renderStep();

        expect(await screen.findByText('Slot availability could not be loaded')).toBeTruthy();
        expect(screen.queryByText(/0\/0 slots/)).toBeNull();
    });

    it('still shows hourly slots when loops load', async () => {
        getLoops.mockResolvedValue({
            loops: [{ id: 'loop_8', hour: 8, screen_id: 'screen_1', slots: Array(12).fill({ status: 'available' }) }],
            business_hours: { start: 8, end: 10, is_closed: false },
        });

        renderStep();

        expect(await screen.findByText('12/12 slots')).toBeTruthy();
        expect(screen.queryByText('Slot times are assigned after approval')).toBeNull();
    });
});
