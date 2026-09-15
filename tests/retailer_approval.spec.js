import { test, expect, hasEmulators, signIn } from './fixtures/demo-session.js';

test.skip(!hasEmulators, 'requires Firebase Auth, Firestore, and Storage emulators');

const RETAILER_ID = 'demo-retailer-freshmart';

/**
 * A fixed-offset Store time zone in which it is about 02:00 now, so the
 * approval windows do not depend on when the journey runs: tomorrow's window
 * is open until today 18:00, and today's window has expired while its first
 * broadcast at 08:00 is still ahead.
 */
function storeClockNear2am(now = new Date()) {
    let offset = (2 - now.getUTCHours() + 24) % 24;
    if (offset > 14) offset -= 24;
    const timeZone = offset === 0 ? 'Etc/GMT' : `Etc/GMT${offset > 0 ? '-' : '+'}${Math.abs(offset)}`;
    const localDate = days => new Date(now.getTime() + (offset * 60 + days * 24 * 60) * 60_000).toISOString().slice(0, 10);
    return { timeZone, today: localDate(0), tomorrow: localDate(1) };
}

async function seedStoreSchedule({ storeId, timeZone, date, loopId, slots, status }) {
    const { default: StoreRepository } = await import('../ad-server/src/repositories/StoreRepository.js');
    const { loopRepository } = await import('../ad-server/src/repositories/LoopRepository.js');
    const { dailyScheduleRepository } = await import('../ad-server/src/repositories/DailyScheduleRepository.js');

    if (!(await StoreRepository.findById(storeId))) {
        await StoreRepository.create(storeId, { name: `Approval Store ${storeId}`, retailer_id: RETAILER_ID, time_zone: timeZone });
    }
    await loopRepository.create(loopId, { date, hour: 8, retailer_id: RETAILER_ID, store_id: storeId, status, slots });
    await dailyScheduleRepository.save(storeId, date, { retailer_id: RETAILER_ID, operating_hours: [8], loop_ids: [loopId] });
}

const pendingSlots = () => Array.from({ length: 12 }, (_, position) => ({
    position,
    asset_id: 'demo-media-paid',
    asset_name: `Approval creative ${position}`,
    duration: 5,
    status: 'pending',
}));

test('Retailer reviews its Store-local schedule and persists a replacement request', async ({ page, demo }) => {
    const suffix = Date.now();
    const storeId = `approval-store-${suffix}`;
    const loopId = `approval-loop-${suffix}`;
    const { timeZone, tomorrow } = storeClockNear2am();
    const { loopRepository } = await import('../ad-server/src/repositories/LoopRepository.js');
    await demo.reset();
    await demo.provisionPersonas();
    await seedStoreSchedule({ storeId, timeZone, date: tomorrow, loopId, slots: pendingSlots(), status: 'pending_approval' });

    try {
        await signIn(page, 'retaileradmin@demo.softomedia.test', /\/dashboard\/retailer$/);
        await page.goto('/dashboard/retailer/schedule');
        await page.getByTestId('schedule-store-select').selectOption(storeId);
        // Another Retailer's Store is not offered.
        await expect(page.getByTestId('schedule-store-select').locator('option[value="demo-store-phoenix"]')).toHaveCount(0);

        await expect(page.getByTestId('store-time-zone')).toHaveText(`Store time zone: ${timeZone}`);
        await expect(page.getByTestId('approval-deadline')).toContainText('Approval deadline:');
        await page.getByTestId('schedule-hour-8').click();
        await page.getByTestId('reject-btn-3').click();
        await page.getByTestId('rejection-reason-select').selectOption('competitor');
        await page.getByTestId('confirm-reject-btn').click();

        await expect(page.getByText('Replacement requested from Admin')).toBeVisible();
        await expect(page.getByTestId('replacement-picker')).toHaveCount(0);
        const persisted = await loopRepository.findById(loopId);
        expect(persisted.status).toBe('replacement_requested');
        expect(persisted.slots[3]).toMatchObject({ status: 'rejected', rejection_reason: 'competitor' });
    } finally {
        await demo.reset();
    }
});

test('Admin corrects requested content, cannot approve it, and reopens an expired window with a reason', async ({ page, demo }) => {
    const suffix = Date.now();
    const storeId = `approval-store-${suffix}`;
    const loopId = `approval-loop-${suffix}`;
    const { timeZone, today } = storeClockNear2am();
    const { loopRepository } = await import('../ad-server/src/repositories/LoopRepository.js');
    const { dailyScheduleRepository } = await import('../ad-server/src/repositories/DailyScheduleRepository.js');
    const slots = pendingSlots().map(slot => slot.position === 3
        ? { ...slot, status: 'rejected', rejection_reason: 'Competitor content' }
        : slot);
    await demo.reset();
    await demo.provisionPersonas();
    await seedStoreSchedule({ storeId, timeZone, date: today, loopId, slots, status: 'replacement_requested' });

    try {
        await signIn(page, 'admin@demo.softomedia.test', /\/dashboard\/admin$/);
        await page.goto(`/dashboard/admin/loops/${loopId}`);

        await expect(page.getByText('Competitor content')).toBeVisible();
        await expect(page.getByTestId('approve-loop-btn')).toHaveCount(0);
        await page.getByTestId('slot-3').click();
        await page.getByTestId('asset-demo-media-internal').click();
        await expect.poll(async () => (await loopRepository.findById(loopId)).slots[3].asset_id).toBe('demo-media-internal');

        await expect(page.getByTestId('approval-window-state')).toContainText('Expired');
        await page.getByTestId('reopen-approval-window').click();
        await page.getByTestId('reopen-reason').fill('Corrected creative ready');
        await page.getByTestId('reopen-expiry').fill(`${today}T07:30`);
        await page.getByTestId('confirm-reopen').click();
        await expect(page.getByTestId('approval-window-state')).toContainText('Open');

        const schedule = await dailyScheduleRepository.findByStoreAndDate(storeId, today);
        expect(schedule.approval_window.reopened).toMatchObject({ reason: 'Corrected creative ready' });
        await page.reload();
        await expect(page.getByTestId('approval-window-state')).toContainText('Open');
    } finally {
        await demo.reset();
    }
});
