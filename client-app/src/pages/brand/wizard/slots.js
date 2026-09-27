/** Whether two picks or Reservations name the same Slot: Store, date, hour and position. */
export const sameSlot = (left, right) => left.store_id === right.store_id && left.date === right.date
    && left.hour === right.hour && left.position === right.position;

/** Every date of the Campaign, first to last, as YYYY-MM-DD. */
export function campaignDates({ start, end } = {}) {
    if (!start) return [];
    const dates = [];
    const day = new Date(`${start}T00:00:00Z`);
    const last = new Date(`${end && end >= start ? end : start}T00:00:00Z`);
    for (; day <= last; day.setUTCDate(day.getUTCDate() + 1)) dates.push(day.toISOString().slice(0, 10));
    return dates;
}
