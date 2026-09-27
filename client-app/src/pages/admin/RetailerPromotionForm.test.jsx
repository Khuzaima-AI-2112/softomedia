import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
    getRetailers: vi.fn(),
    getStores: vi.fn(),
    getAssets: vi.fn(),
    getDayparts: vi.fn(),
    createCampaign: vi.fn(),
}));

vi.mock('../../services/ApiService', () => ({ default: api }));

import RetailerPromotionForm from './RetailerPromotionForm';

const RETAILERS = [
    { id: 'cafe', name: 'Corner Café' },
    { id: 'grocer', name: 'Green Grocer' },
];
const MEDIA = [
    { id: 'muffin', title: 'Muffin upsell', category: 'retailer', owner_type: 'retailer', owner_id: 'cafe' },
    { id: 'apples', title: 'Apple week', category: 'retailer', owner_type: 'retailer', owner_id: 'grocer' },
    { id: 'brand-ad', title: 'Brand ad', category: 'paid', owner_type: 'brand', owner_id: 'cafe' },
];

async function renderForm(props = {}) {
    const onCreated = vi.fn();
    render(<RetailerPromotionForm onClose={vi.fn()} onCreated={onCreated} {...props} />);
    await waitFor(() => expect(screen.getByTestId('promotion-retailer-select').querySelectorAll('option')).toHaveLength(3));
    return { onCreated };
}

function fillBreakfastPromotion() {
    fireEvent.change(screen.getByTestId('promotion-name-input'), { target: { value: 'Breakfast muffin' } });
    fireEvent.change(screen.getByTestId('promotion-retailer-select'), { target: { value: 'cafe' } });
    fireEvent.change(screen.getByTestId('promotion-media-select'), { target: { value: 'muffin' } });
    fireEvent.change(screen.getByTestId('promotion-start-date'), { target: { value: '2030-01-07' } });
    fireEvent.change(screen.getByTestId('promotion-end-date'), { target: { value: '2030-01-09' } });
    fireEvent.click(screen.getByTestId('promotion-daypart-breakfast'));
}

describe('RetailerPromotionForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        api.getRetailers.mockResolvedValue(RETAILERS);
        api.getStores.mockResolvedValue([{ id: 'cafe-downtown', name: 'Downtown', retailer_id: 'cafe' }]);
        api.getAssets.mockResolvedValue(MEDIA);
        api.getDayparts.mockResolvedValue({
            breakfast: { start: 6, end: 11 }, lunch: { start: 11, end: 15 }, dinner: { start: 17, end: 21 },
        });
        api.createCampaign.mockImplementation(async body => ({ id: 'cmp-1', ...body }));
    });

    it('labels each Daypart with the network hours', async () => {
        await renderForm();

        expect(screen.getByText('Breakfast (06:00–11:00)')).toBeTruthy();
        expect(screen.getByText('Dinner (17:00–21:00)')).toBeTruthy();
    });

    it('offers only the chosen Retailer\'s own media', async () => {
        await renderForm();

        fireEvent.change(screen.getByTestId('promotion-retailer-select'), { target: { value: 'cafe' } });

        await waitFor(() => expect(api.getStores).toHaveBeenCalledWith({ retailer_id: 'cafe' }));
        const offered = [...screen.getByTestId('promotion-media-select').querySelectorAll('option')]
            .map(option => option.value).filter(Boolean);
        expect(offered).toEqual(['muffin']);
    });

    it('schedules a breakfast promotion for every date in the range', async () => {
        const { onCreated } = await renderForm();

        fillBreakfastPromotion();
        fireEvent.click(screen.getByTestId('promotion-submit-btn'));

        await waitFor(() => expect(api.createCampaign).toHaveBeenCalledWith({
            type: 'retailer',
            name: 'Breakfast muffin',
            retailer_id: 'cafe',
            media_id: 'muffin',
            schedule: { dates: ['2030-01-07', '2030-01-08', '2030-01-09'], dayparts: ['breakfast'], hours: [] },
        }));
        expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'cmp-1' }));
    });

    it('schedules chosen hours in one Store', async () => {
        await renderForm();
        fillBreakfastPromotion();
        fireEvent.click(screen.getByTestId('promotion-daypart-breakfast'));
        await waitFor(() => expect(screen.getByTestId('promotion-store-select').querySelectorAll('option')).toHaveLength(2));
        fireEvent.change(screen.getByTestId('promotion-store-select'), { target: { value: 'cafe-downtown' } });
        fireEvent.click(screen.getByTestId('promotion-hour-14'));
        fireEvent.click(screen.getByTestId('promotion-hour-9'));
        fireEvent.click(screen.getByTestId('promotion-submit-btn'));

        await waitFor(() => expect(api.createCampaign).toHaveBeenCalledWith(expect.objectContaining({
            store_id: 'cafe-downtown',
            schedule: { dates: ['2030-01-07', '2030-01-08', '2030-01-09'], dayparts: [], hours: [9, 14] },
        })));
    });

    it('asks for an hour or Daypart before submitting', async () => {
        await renderForm();
        fillBreakfastPromotion();
        fireEvent.click(screen.getByTestId('promotion-daypart-breakfast'));
        fireEvent.click(screen.getByTestId('promotion-submit-btn'));

        expect(await screen.findByText('Choose at least one Daypart or hour.')).toBeTruthy();
        expect(api.createCampaign).not.toHaveBeenCalled();
    });

    it('shows why the server refused the promotion', async () => {
        api.createCampaign.mockRejectedValue(new Error('The Retailer is unavailable'));
        await renderForm();
        fillBreakfastPromotion();
        fireEvent.click(screen.getByTestId('promotion-submit-btn'));

        expect(await screen.findByText('The Retailer is unavailable')).toBeTruthy();
    });
});
