/** Mirrors ad-server/src/services/Dayparts.js: whole hours, end exclusive. */
export const DAYPART_NAMES = Object.freeze(['breakfast', 'lunch', 'dinner']);

export const DAYPART_LABELS = Object.freeze({
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
});

/** 6 → "06:00"; 24 is midnight at the end of the day. */
export function formatHour(hour) {
    return `${String(hour).padStart(2, '0')}:00`;
}
