/** A delivery report's counts by column, as Slots only. */
export const slotsOf = cells => Object.fromEntries(Object.entries(cells).map(([column, cell]) => [column, cell.slots]));
