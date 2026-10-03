// The Store's wall clock, from its IANA time zone.
const storeClock = (timeZone, now = new Date()) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
}).formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));

/** Tomorrow's broadcast date (YYYY-MM-DD) in the Store's time zone. */
export const tomorrowInTimeZone = (timeZone) => {
    const { year, month, day } = storeClock(timeZone);
    return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
};

/** The hour (0–23) it is now in the Store's time zone. */
export const hourInTimeZone = (timeZone) => storeClock(timeZone).hour;

/** An hour of the day as "9:00 AM"; hour 24 is the midnight that ends the day. */
export const formatHour = (hour) => {
    const h = hour % 24;
    return `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
};
