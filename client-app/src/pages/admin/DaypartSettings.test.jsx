import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDayparts, updateDayparts } = vi.hoisted(() => ({
    getDayparts: vi.fn(),
    updateDayparts: vi.fn(),
}));

vi.mock('../../services/ApiService', () => ({
    default: { getDayparts, updateDayparts },
}));

import DaypartSettings from './DaypartSettings';

const DEFAULTS = {
    breakfast: { start: 6, end: 11 },
    lunch: { start: 11, end: 15 },
    dinner: { start: 17, end: 21 },
};

describe('DaypartSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDayparts.mockResolvedValue(DEFAULTS);
        updateDayparts.mockImplementation(async dayparts => dayparts);
    });

    it('shows the network Dayparts', async () => {
        render(<DaypartSettings />);

        await waitFor(() => expect(screen.getByTestId('daypart-breakfast-start').value).toBe('6'));
        expect(screen.getByTestId('daypart-breakfast-end').value).toBe('11');
        expect(screen.getByTestId('daypart-lunch-start').value).toBe('11');
        expect(screen.getByTestId('daypart-dinner-end').value).toBe('21');
    });

    it('saves edited hours for the whole network', async () => {
        render(<DaypartSettings />);
        await waitFor(() => expect(screen.getByTestId('daypart-breakfast-start').value).toBe('6'));

        fireEvent.change(screen.getByTestId('daypart-breakfast-start'), { target: { value: '5' } });
        fireEvent.click(screen.getByTestId('btn-save-dayparts'));

        await waitFor(() => expect(updateDayparts).toHaveBeenCalledWith({
            ...DEFAULTS, breakfast: { start: 5, end: 11 },
        }));
        expect(await screen.findByText('Dayparts saved.')).toBeTruthy();
    });

    it('shows why the server refused the hours', async () => {
        // apiClient rejects with the server's error message.
        updateDayparts.mockRejectedValue(new Error('breakfast and lunch overlap'));
        render(<DaypartSettings />);
        await waitFor(() => expect(screen.getByTestId('daypart-breakfast-start').value).toBe('6'));

        fireEvent.change(screen.getByTestId('daypart-breakfast-end'), { target: { value: '12' } });
        fireEvent.click(screen.getByTestId('btn-save-dayparts'));

        expect(await screen.findByText('breakfast and lunch overlap')).toBeTruthy();
    });
});
