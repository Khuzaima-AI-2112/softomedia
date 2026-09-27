/**
 * Dayparts and Retailer promotion schedules.
 *
 * A Daypart is a network-wide range of whole hours, start inclusive and end
 * exclusive: breakfast 06–11 covers the loops at 06:00 to 10:00. A promotion
 * names Dayparts rather than copying their hours, so it follows the Super
 * Administrator's later changes. Store opening hours trim both, because loops
 * are generated only for the hours a Store is open.
 */

export const DAYPART_NAMES = Object.freeze(['breakfast', 'lunch', 'dinner']);

export const DEFAULT_DAYPARTS = Object.freeze({
    breakfast: Object.freeze({ start: 6, end: 11 }),
    lunch: Object.freeze({ start: 11, end: 15 }),
    dinner: Object.freeze({ start: 17, end: 21 }),
});

const isHourBoundary = value => Number.isInteger(value) && value >= 0 && value <= 24;
const isHour = value => Number.isInteger(value) && value >= 0 && value < 24;

function isCalendarDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

/** Why a set of Dayparts can't be saved, or null. */
export function daypartsError(dayparts) {
    if (!dayparts || typeof dayparts !== 'object') return 'Dayparts are required';
    const names = Object.keys(dayparts);
    if (names.length !== DAYPART_NAMES.length || !DAYPART_NAMES.every(name => names.includes(name))) {
        return `Dayparts must be exactly ${DAYPART_NAMES.join(', ')}`;
    }
    for (const name of DAYPART_NAMES) {
        const { start, end } = dayparts[name] || {};
        if (!isHourBoundary(start) || !isHourBoundary(end) || start >= end) {
            return `${name} must start before it ends, on whole hours from 0 to 24`;
        }
    }
    const byStart = DAYPART_NAMES.map(name => ({ name, ...dayparts[name] }))
        .sort((a, b) => a.start - b.start);
    for (let index = 1; index < byStart.length; index++) {
        if (byStart[index].start < byStart[index - 1].end) {
            return `${byStart[index - 1].name} and ${byStart[index].name} overlap`;
        }
    }
    return null;
}

/** Why a Retailer promotion's schedule can't be saved, or null. */
export function promotionScheduleError(schedule) {
    if (!schedule || typeof schedule !== 'object') return 'A promotion needs a schedule of dates and hours or Dayparts';
    const { dates, dayparts = [], hours = [] } = schedule;
    if (!Array.isArray(dates) || dates.length === 0) return 'Choose at least one date';
    if (!dates.every(isCalendarDate)) return 'Dates must be calendar dates (YYYY-MM-DD)';
    if (!Array.isArray(dayparts) || !Array.isArray(hours)) return 'Dayparts and hours must be lists';
    if (dayparts.length === 0 && hours.length === 0) return 'Choose at least one hour or Daypart';
    if (!dayparts.every(name => DAYPART_NAMES.includes(name))) {
        return `Dayparts must be among ${DAYPART_NAMES.join(', ')}`;
    }
    if (!hours.every(isHour)) return 'Hours must be whole hours from 0 to 23';
    return null;
}

function scheduledForHour(schedule, dayparts, hour) {
    return (schedule.hours || []).includes(hour)
        || (schedule.dayparts || []).some(name => {
            const range = dayparts[name];
            return range && hour >= range.start && hour < range.end;
        });
}

/**
 * Whether a promotion plays at this date and hour. A promotion saved before
 * Dayparts has no schedule and plays in every hour of its Campaign dates.
 */
export function isPromotionScheduledAt(schedule, dayparts, date, hour) {
    if (!schedule) return true;
    return (schedule.dates || []).includes(date) && scheduledForHour(schedule, dayparts, hour);
}
