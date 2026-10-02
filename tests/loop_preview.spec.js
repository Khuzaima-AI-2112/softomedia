import { test, expect, hasEmulators, signIn } from './fixtures/demo-session.js';

test.skip(!hasEmulators, 'requires Firebase Auth, Firestore, and Storage emulators');

const RETAILER_ID = 'demo-retailer-freshmart';

/** Tomorrow's date in the Store's time zone, the day the Schedule page previews. */
function tomorrowIn(timeZone, now = new Date()) {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
    const [year, month, day] = today.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

async function seedStoreSchedule({ storeId, timeZone, date, loopId }) {
    const { default: StoreRepository } = await import('../ad-server/src/repositories/StoreRepository.js');
    const { loopRepository } = await import('../ad-server/src/repositories/LoopRepository.js');
    const { dailyScheduleRepository } = await import('../ad-server/src/repositories/DailyScheduleRepository.js');

    await StoreRepository.create(storeId, { name: `Preview Store ${storeId}`, retailer_id: RETAILER_ID, time_zone: timeZone });
    // A generated loop: nobody approves an Hourly Loop (ADR 0007).
    await loopRepository.create(loopId, {
        date,
        hour: 8,
        retailer_id: RETAILER_ID,
        store_id: storeId,
        slots: Array.from({ length: 12 }, (_, position) => ({
            position,
            asset_id: 'demo-media-paid',
            asset_name: `Preview creative ${position}`,
            duration: 5,
        })),
    });
    await dailyScheduleRepository.save(storeId, date, { retailer_id: RETAILER_ID, operating_hours: [8], loop_ids: [loopId] });
}

test('Retailer previews its Store-local schedule, with nothing to approve or reject', async ({ page, demo }) => {
    const suffix = Date.now();
    const storeId = `preview-store-${suffix}`;
    const timeZone = 'America/Toronto';
    await demo.reset();
    await demo.provisionPersonas();
    await seedStoreSchedule({ storeId, timeZone, date: tomorrowIn(timeZone), loopId: `preview-loop-${suffix}` });

    try {
        await signIn(page, 'retaileradmin@demo.softomedia.test', /\/dashboard\/retailer$/);
        await page.goto('/dashboard/retailer/schedule');
        await page.getByTestId('schedule-store-select').selectOption(storeId);
        // Another Retailer's Store is not offered.
        await expect(page.getByTestId('schedule-store-select').locator('option[value="demo-store-phoenix"]')).toHaveCount(0);

        await expect(page.getByTestId('store-time-zone')).toHaveText(`Store time zone: ${timeZone}`);
        await expect(page.getByText(/approval deadline/i)).toHaveCount(0);
        await page.getByTestId('schedule-hour-8').click();

        await expect(page.getByTestId('preview-slot-3')).toContainText('Preview creative 3');
        await expect(page.getByRole('button', { name: /approve|reject/i })).toHaveCount(0);
        await page.getByTestId('btn-preview-playback').click();
        await expect(page.getByTestId('loop-playback-preview')).toBeVisible();
    } finally {
        await demo.reset();
    }
});

test('Admin corrects a Slot in the loop that plays', async ({ page, demo }) => {
    const suffix = Date.now();
    const loopId = `preview-loop-${suffix}`;
    const { loopRepository } = await import('../ad-server/src/repositories/LoopRepository.js');
    await demo.reset();
    await demo.provisionPersonas();
    await seedStoreSchedule({ storeId: `preview-store-${suffix}`, timeZone: 'America/Toronto', date: tomorrowIn('America/Toronto'), loopId });

    try {
        await signIn(page, 'admin@demo.softomedia.test', /\/dashboard\/admin$/);
        await page.goto(`/dashboard/admin/loops/${loopId}`);

        await expect(page.getByRole('button', { name: /approve|reopen/i })).toHaveCount(0);
        await page.getByTestId('slot-3').click();
        await page.getByTestId('asset-demo-media-internal').click();
        await expect.poll(async () => (await loopRepository.findById(loopId)).slots[3].asset_id).toBe('demo-media-internal');
    } finally {
        await demo.reset();
    }
});
