/** Whether two picks or Reservations name the same Slot: Store, date, hour and position. */
export const sameSlot = (left, right) => left.store_id === right.store_id && left.date === right.date
    && left.hour === right.hour && left.position === right.position;
