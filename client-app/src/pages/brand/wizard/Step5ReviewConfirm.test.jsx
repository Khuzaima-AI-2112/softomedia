import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../services/PricingService', () => ({
    default: {
        getEstimatedImpressions: () => 0,
        formatImpressions: (count) => String(count),
        formatPrice: (amount) => `$${amount}`,
    },
}));

import Step5ReviewConfirm from './Step5ReviewConfirm';

const pick = (hour, position) => ({ store_id: 's-downtown', date: '2026-10-05', hour, position, price: 10 });

afterEach(() => vi.restoreAllMocks());

describe('Step5ReviewConfirm — where the picked Slots sit in the Hourly Loop', () => {
    it('marks every position the Brand picked, in any hour', () => {
        render(
            <Step5ReviewConfirm
                data={{ selectedSlots: [pick(9, 2), pick(9, 3), pick(10, 2)] }}
                onConfirm={vi.fn()}
                onPrev={vi.fn()}
            />
        );

        const loop = screen.getByRole('list', { name: 'Hourly Loop' });
        const yours = within(loop).getAllByRole('listitem')
            .filter(slot => slot.getAttribute('aria-label').endsWith('your Creative'))
            .map(slot => slot.getAttribute('aria-label'));
        expect(yours).toEqual(['Slot 3: your Creative', 'Slot 4: your Creative']);
        expect(screen.getByText('Positions you picked (2)')).toBeTruthy();
    });
});
