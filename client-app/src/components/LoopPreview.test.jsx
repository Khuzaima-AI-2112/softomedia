import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LoopPreview from './LoopPreview';

// Slots as loop generation writes them.
const paid = (asset_name) => ({ allocated_category: 'paid', asset_name, content_kind: 'campaign', is_fallback: false });
const PAID_FALLBACK = { allocated_category: 'paid', asset_name: 'House ad', content_kind: 'fallback', is_fallback: true };
const PROMO = { allocated_category: 'retailer', asset_name: 'Fresh Week', content_kind: 'campaign', is_fallback: false };
const INTERNAL = { allocated_category: 'internal', asset_name: 'Softomedia news', content_kind: 'media', is_fallback: false };
const UNNAMED = { allocated_category: 'retailer', asset_name: null, is_fallback: true };

const SLOTS = [paid('Summer Fizz'), paid('Summer Fizz'), PAID_FALLBACK, PROMO, INTERNAL, UNNAMED];

const breakdown = () => screen.getByRole('list', { name: '60-Second Loop Breakdown' });
const items = () => screen.getByRole('list', { name: 'Active Loop Items' });

afterEach(() => vi.restoreAllMocks());

describe('LoopPreview', () => {
    it('shows the Slots in play order, each with what plays and its kind', () => {
        render(<LoopPreview slots={SLOTS} />);

        expect(within(breakdown()).getAllByRole('listitem').map(slot => slot.getAttribute('aria-label'))).toEqual([
            'Slot 1: Summer Fizz, Paid',
            'Slot 2: Summer Fizz, Paid',
            'Slot 3: House ad, Fallback',
            'Slot 4: Fresh Week, Retailer',
            'Slot 5: Softomedia news, Internal',
            'Slot 6: Fallback / Empty Slot, Fallback',
        ]);
    });

    it('lists each item once with how many Slots it fills', () => {
        render(<LoopPreview slots={SLOTS} />);

        expect(within(items()).getAllByRole('listitem').map(item => item.textContent)).toEqual([
            'Summer FizzPAID • 2 slot(s)',
            'House adFALLBACK • 1 slot(s)',
            'Fresh WeekRETAILER • 1 slot(s)',
            'Softomedia newsINTERNAL • 1 slot(s)',
            'Fallback / Empty SlotFALLBACK • 1 slot(s)',
        ]);
    });

    it('accepts the title a caller gives a Slot', () => {
        render(<LoopPreview slots={[{ ...paid('summer.mp4'), title: 'BonVie Summer Demo' }]} />);

        expect(within(breakdown()).getByRole('listitem').getAttribute('aria-label')).toBe('Slot 1: BonVie Summer Demo, Paid');
    });

    it('shows no item list for a loop with no Slots', () => {
        render(<LoopPreview />);

        expect(within(breakdown()).queryAllByRole('listitem')).toHaveLength(0);
        expect(screen.queryByRole('list', { name: 'Active Loop Items' })).toBeNull();
        expect(screen.getByText(/This loop repeats exactly 60 times per hour/)).toBeTruthy();
    });
});
