import { test, expect } from './base.fixtures.js';

const slots = Array.from({ length: 12 }, (_, position) => ({
    position,
    asset_id: `asset-${position}`,
    asset_name: `Asset ${position}`,
    duration: 5,
    status: position === 3 ? 'rejected' : 'pending',
    ...(position === 3 ? { rejection_reason: 'Competitor content' } : {}),
}));

const review = {
    store: { id: 'store-one', name: 'Toronto Flagship', time_zone: 'America/Toronto' },
    broadcast_date: '2030-01-02',
    approval_window: {
        normal_deadline: '2030-01-01T23:00:00.000Z',
        effective_deadline: '2030-01-02T12:00:00.000Z',
        first_broadcast: '2030-01-02T13:00:00.000Z',
        state: 'open',
        reopened: null,
    },
    loops: [{
        id: 'loop-one',
        date: '2030-01-02',
        hour: 8,
        retailer_id: 'retailer-one',
        store_id: 'store-one',
        status: 'pending_approval',
        slots: slots.map(slot => ({ ...slot, ...(slot.position === 3 ? { status: 'pending', rejection_reason: undefined } : {}) })),
    }],
};

test('Retailer reviews its Store-local schedule and persists a replacement request', async ({ retailerPage: page }) => {
    await page.route('**/api/stores', route => route.fulfill({
        status: 200,
        json: [review.store],
    }));
    await page.route('**/api/loops/review/store-one/**', route => route.fulfill({ status: 200, json: review }));
    let rejectionBody;
    await page.route('**/api/loops/loop-one/slots/3/reject', async route => {
        rejectionBody = route.request().postDataJSON();
        await route.fulfill({
            status: 200,
            json: { ...review.loops[0], status: 'replacement_requested', slots },
        });
    });

    await page.goto('/dashboard/retailer/schedule');

    await expect(page.getByTestId('store-time-zone')).toHaveText('Store time zone: America/Toronto');
    await expect(page.getByTestId('approval-deadline')).toContainText('Approval deadline:');
    await expect(page.getByTestId('schedule-store-select').locator('option')).toHaveCount(1);
    await page.getByTestId('schedule-hour-8').click();
    await page.getByTestId('reject-btn-3').click();
    await page.getByTestId('rejection-reason-select').selectOption('competitor');
    await page.getByTestId('confirm-reject-btn').click();

    expect(rejectionBody).toEqual({ reason: 'competitor' });
    await expect(page.getByText('Replacement requested from Admin')).toBeVisible();
    await expect(page.getByTestId('replacement-picker')).toHaveCount(0);
});

test('Admin corrects requested content, cannot approve it, and reopens an expired window with a reason', async ({ adminPage: page }) => {
    const rejectedLoop = {
        ...review.loops[0],
        status: 'replacement_requested',
        slots,
        screen_count: 1,
    };
    const expiredReview = {
        ...review,
        approval_window: { ...review.approval_window, state: 'expired', effective_deadline: '2030-01-01T23:00:00.000Z' },
        loops: [rejectedLoop],
    };
    await page.route('**/api/loops/review/store-one/2030-01-02', route => route.fulfill({ status: 200, json: expiredReview }));
    await page.route('**/api/loops/review/store-one/2030-01-02/reopen', async route => route.fulfill({
        status: 200,
        json: {
            ...review.approval_window,
            state: 'open',
            reopened: { reason: route.request().postDataJSON().reason },
        },
    }));
    await page.route('**/api/loops/loop-one', route => route.fulfill({ status: 200, json: rejectedLoop }));
    await page.route('**/api/assets', route => route.fulfill({
        status: 200,
        json: [{ id: 'corrected-asset', filename: 'Corrected Creative.png', file_type: 'image' }],
    }));
    let replacementBody;
    await page.route('**/api/loops/loop-one/slots/3/replace', async route => {
        replacementBody = route.request().postDataJSON();
        await route.fulfill({
            status: 200,
            json: {
                ...rejectedLoop,
                status: 'pending_approval',
                slots: slots.map(slot => slot.position === 3
                    ? { ...slot, asset_id: 'corrected-asset', status: 'replaced' }
                    : slot),
            },
        });
    });

    await page.goto('/dashboard/admin/loops/loop-one');

    await expect(page.getByText('Competitor content')).toBeVisible();
    await expect(page.getByTestId('approve-loop-btn')).toHaveCount(0);
    await page.getByTestId('slot-3').click();
    await page.getByTestId('asset-corrected-asset').click();
    expect(replacementBody).toEqual({ assetId: 'corrected-asset' });

    await expect(page.getByTestId('approval-window-state')).toContainText('Expired');
    await page.getByTestId('reopen-approval-window').click();
    await page.getByTestId('reopen-reason').fill('Corrected creative ready');
    await page.getByTestId('reopen-expiry').fill('2030-01-02T07:30');
    await page.getByTestId('confirm-reopen').click();
    await expect(page.getByTestId('approval-window-state')).toContainText('Open');
});
