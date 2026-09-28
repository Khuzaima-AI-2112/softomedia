/**
 * Shared doubles for suites that run the whole server against the emulators.
 */
import { jest } from '@jest/globals';

/** Makes one repository method fail as an unavailable Firestore would, until mocks are restored. */
export function failStorage(object, method, error = new Error('Firestore unavailable')) {
    return jest.spyOn(object, method).mockRejectedValue(error);
}

/** The twelve five-second Slots of a full Hourly Loop, each holding an asset. */
export const FULL_HOURLY_LOOP = Object.freeze(Array.from({ length: 12 }, (_, position) =>
    Object.freeze({ position, asset_id: `asset-${position}`, duration: 5 })));
