import { describe, expect, test } from '@jest/globals';
import {
    DEFAULT_DAYPARTS,
    daypartsError,
    isPromotionScheduledAt,
    promotionScheduleError,
} from '../src/services/Dayparts.js';

describe('Dayparts', () => {
    test('default to breakfast 06–11, lunch 11–15 and dinner 17–21', () => {
        expect(DEFAULT_DAYPARTS).toEqual({
            breakfast: { start: 6, end: 11 },
            lunch: { start: 11, end: 15 },
            dinner: { start: 17, end: 21 },
        });
        expect(daypartsError(DEFAULT_DAYPARTS)).toBeNull();
    });

    test.each([
        ['a missing Daypart', { breakfast: { start: 6, end: 11 }, lunch: { start: 11, end: 15 } }],
        ['an unknown Daypart', { ...DEFAULT_DAYPARTS, brunch: { start: 10, end: 12 } }],
        ['a start after its end', { ...DEFAULT_DAYPARTS, dinner: { start: 21, end: 17 } }],
        ['an empty Daypart', { ...DEFAULT_DAYPARTS, dinner: { start: 17, end: 17 } }],
        ['an hour past midnight', { ...DEFAULT_DAYPARTS, dinner: { start: 17, end: 25 } }],
        ['a fractional hour', { ...DEFAULT_DAYPARTS, dinner: { start: 17.5, end: 21 } }],
        ['overlapping Dayparts', { ...DEFAULT_DAYPARTS, lunch: { start: 10, end: 15 } }],
    ])('refuse %s', (_name, dayparts) => {
        expect(daypartsError(dayparts)).toEqual(expect.any(String));
    });
});

describe('a Retailer promotion schedule', () => {
    const breakfast = { dates: ['2030-01-07', '2030-01-09'], dayparts: ['breakfast'], hours: [] };

    test('plays in its Dayparts on its dates only', () => {
        expect(isPromotionScheduledAt(breakfast, DEFAULT_DAYPARTS, '2030-01-07', 6)).toBe(true);
        expect(isPromotionScheduledAt(breakfast, DEFAULT_DAYPARTS, '2030-01-07', 10)).toBe(true);
        expect(isPromotionScheduledAt(breakfast, DEFAULT_DAYPARTS, '2030-01-07', 11)).toBe(false);
        expect(isPromotionScheduledAt(breakfast, DEFAULT_DAYPARTS, '2030-01-08', 8)).toBe(false);
        expect(isPromotionScheduledAt(breakfast, DEFAULT_DAYPARTS, '2030-01-09', 8)).toBe(true);
    });

    test('follows the network Dayparts as they are now, not as they were when it was scheduled', () => {
        const earlyBreakfast = { ...DEFAULT_DAYPARTS, breakfast: { start: 5, end: 9 } };

        expect(isPromotionScheduledAt(breakfast, earlyBreakfast, '2030-01-07', 5)).toBe(true);
        expect(isPromotionScheduledAt(breakfast, earlyBreakfast, '2030-01-07', 9)).toBe(false);
    });

    test('plays in chosen hours, alongside any chosen Dayparts', () => {
        const schedule = { dates: ['2030-01-07'], dayparts: ['dinner'], hours: [14] };

        expect(isPromotionScheduledAt(schedule, DEFAULT_DAYPARTS, '2030-01-07', 14)).toBe(true);
        expect(isPromotionScheduledAt(schedule, DEFAULT_DAYPARTS, '2030-01-07', 18)).toBe(true);
        expect(isPromotionScheduledAt(schedule, DEFAULT_DAYPARTS, '2030-01-07', 13)).toBe(false);
    });

    test('without a schedule plays every hour, as promotions did before Dayparts', () => {
        expect(isPromotionScheduledAt(undefined, DEFAULT_DAYPARTS, '2030-01-07', 3)).toBe(true);
    });

    test('is accepted when it names dates and at least one hour or Daypart', () => {
        expect(promotionScheduleError(breakfast)).toBeNull();
        expect(promotionScheduleError({ dates: ['2030-01-07'], hours: [7, 8] })).toBeNull();
    });

    test.each([
        ['no schedule', undefined],
        ['no dates', { dates: [], dayparts: ['breakfast'] }],
        ['an invalid date', { dates: ['2030-02-30'], dayparts: ['breakfast'] }],
        ['no hours or Dayparts', { dates: ['2030-01-07'], dayparts: [], hours: [] }],
        ['an unknown Daypart', { dates: ['2030-01-07'], dayparts: ['brunch'] }],
        ['an hour outside the day', { dates: ['2030-01-07'], hours: [24] }],
    ])('is refused with %s', (_name, schedule) => {
        expect(promotionScheduleError(schedule)).toEqual(expect.any(String));
    });
});
