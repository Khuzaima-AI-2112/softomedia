import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LoopVisualisationBar from './LoopVisualisationBar';

const slots = () => within(screen.getByRole('list', { name: 'Hourly Loop' })).getAllByRole('listitem');

afterEach(() => vi.restoreAllMocks());

describe('LoopVisualisationBar', () => {
    it("shows the hour's twelve five-second Slots in order, marking the Brand's own", () => {
        render(<LoopVisualisationBar positions={[2, 3, 3]} />);

        expect(slots().map(slot => slot.getAttribute('aria-label'))).toEqual([
            'Slot 1: other content',
            'Slot 2: other content',
            'Slot 3: your Creative',
            'Slot 4: your Creative',
            ...Array.from({ length: 8 }, (_, i) => `Slot ${i + 5}: other content`),
        ]);
        expect(screen.getByText('Your Slots (2)')).toBeTruthy();
        expect(screen.getByText(/repeats every 60 seconds/)).toBeTruthy();
    });

    it('does not claim the Brand plays every 5 minutes', () => {
        render(<LoopVisualisationBar positions={[0]} />);

        expect(screen.queryByText(/every 5 minutes/)).toBeNull();
        expect(screen.getAllByText(/^\d+s$/).map(marker => marker.textContent)).toEqual(['0s', '15s', '30s', '45s', '60s']);
    });

    it('marks no Slot before any is picked', () => {
        render(<LoopVisualisationBar />);

        expect(slots().every(slot => slot.getAttribute('aria-label').endsWith('other content'))).toBe(true);
        expect(screen.getByText('Your Slots (0)')).toBeTruthy();
    });
});
