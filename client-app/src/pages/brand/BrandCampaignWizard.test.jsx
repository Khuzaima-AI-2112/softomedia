import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from '../../services/api';

const { createCampaign, navigate } = vi.hoisted(() => ({ createCampaign: vi.fn(), navigate: vi.fn() }));
vi.mock('../../services/ApiService', () => ({ default: { createCampaign } }));
vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => navigate }));

const PICKS = [
    { store_id: 'store_1', date: '2030-01-07', hour: 8, position: 0, price: 15.75 },
    { store_id: 'store_1', date: '2030-01-07', hour: 8, position: 1, price: 15.75 },
];

// Each step is stubbed: these tests cover only what the wizard submits and how it reacts.
vi.mock('./wizard/Step1LocationScreen', () => ({ default: ({ updateData, onNext }) => (
    <button onClick={() => { updateData({ selectedInventory: [{ store_id: 'store_1' }] }); onNext(); }}>step 1</button>
) }));
vi.mock('./wizard/Step2ScheduleUpload', () => ({ default: ({ onNext }) => <button onClick={onNext}>step 2</button> }));
vi.mock('./wizard/Step3LoopSlotSelection', () => ({ default: ({ data, updateData, onNext }) => (
    <div>
        <p data-testid="step-3">{data.selectedSlots.length} picked</p>
        {data.slotConflict && <p role="alert">{data.slotConflict}</p>}
        <button onClick={() => { updateData({ selectedSlots: PICKS }); onNext(); }}>step 3</button>
    </div>
) }));
vi.mock('./wizard/Step4CreativeUpload', () => ({ default: ({ updateData, onNext }) => (
    <button onClick={() => { updateData({ creativeAssetId: 'media_1' }); onNext(); }}>step 4</button>
) }));
vi.mock('./wizard/Step5ReviewConfirm', () => ({ default: ({ onConfirm }) => <button onClick={onConfirm}>confirm</button> }));

import BrandCampaignWizard from './BrandCampaignWizard';

const submitThroughTheWizard = async () => {
    render(<MemoryRouter><BrandCampaignWizard /></MemoryRouter>);
    for (const step of ['step 1', 'step 2', 'step 3', 'step 4', 'confirm']) {
        fireEvent.click(await screen.findByRole('button', { name: step }));
    }
};

describe('Brand Campaign wizard submission', () => {
    beforeEach(() => vi.clearAllMocks());

    it('submits the picked Slots for Reservation, without their prices', async () => {
        createCampaign.mockResolvedValue({ id: 'cmp_1' });

        await submitThroughTheWizard();

        await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/dashboard/brand'));
        const submitted = createCampaign.mock.calls[0][0];
        expect(submitted.slots).toEqual([
            { store_id: 'store_1', date: '2030-01-07', hour: 8, position: 0 },
            { store_id: 'store_1', date: '2030-01-07', hour: 8, position: 1 },
        ]);
        expect(submitted).not.toHaveProperty('selected_slots');
        expect(submitted.media_id).toBe('media_1');
    });

    it('returns to the Slot step with the conflict explained and the taken Slot unpicked', async () => {
        const message = 'Another Brand reserved a Slot you picked moments ago. Choose another Slot and submit again.';
        createCampaign.mockRejectedValue(new APIError(message, 409, {
            error: message, code: 'SLOT_TAKEN', slots: [{ store_id: 'store_1', date: '2030-01-07', hour: 8, position: 1 }],
        }));
        const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});

        await submitThroughTheWizard();

        expect((await screen.findByRole('alert')).textContent).toBe(message);
        expect(screen.getByTestId('step-3').textContent).toBe('1 picked');
        expect(alert).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
    });

    it('returns to the Slot step when the Booking Cutoff passed before submission', async () => {
        const message = 'Booking for 2030-01-07 closed at 18:00 on 2030-01-05 (America/Toronto). Choose a later date.';
        createCampaign.mockRejectedValue(new APIError(message, 400, { error: message, code: 'BOOKING_CLOSED' }));

        await submitThroughTheWizard();

        expect((await screen.findByRole('alert')).textContent).toBe(message);
        expect(screen.getByTestId('step-3').textContent).toBe('2 picked');
    });
});
