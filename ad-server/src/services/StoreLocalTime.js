function previousDate(date) {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

/** Convert an unambiguous Store-local wall-clock value to an instant. */
export function storeLocalInstant(date, hour, minute, timeZone) {
    const [year, month, day] = date.split('-').map(Number);
    const targetWallClock = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    let instant = new Date(targetWallClock);
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const parts = Object.fromEntries(
            formatter.formatToParts(instant)
                .filter(part => part.type !== 'literal')
                .map(part => [part.type, Number(part.value)]),
        );
        const representedWallClock = Date.UTC(
            parts.year,
            parts.month - 1,
            parts.day,
            parts.hour,
            parts.minute,
            parts.second,
        );
        const correction = targetWallClock - representedWallClock;
        if (correction === 0) return instant;
        instant = new Date(instant.getTime() + correction);
    }
    return instant;
}

/**
 * The approval deadline for a broadcast date: 18:00 the day before, Store time.
 * A Reservation whose Creative still lacks an approval then is released (ADR 0007).
 */
export function approvalDeadline(store, date) {
    return storeLocalInstant(previousDate(date), 18, 0, store.time_zone);
}

/** The Store-local broadcast date and hour of an instant. */
export function storeLocalDateAndHour(now, timeZone) {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
            timeZone,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
        }).formatToParts(now)
            .filter(part => part.type !== 'literal')
            .map(part => [part.type, part.value]),
    );

    return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        hour: Number(parts.hour),
    };
}

/** The start of the Store hour after the one this instant falls in. */
export function startOfNextStoreHour(instant, timeZone) {
    const { date, hour } = storeLocalDateAndHour(instant, timeZone);
    return storeLocalInstant(date, hour + 1, 0, timeZone);
}
