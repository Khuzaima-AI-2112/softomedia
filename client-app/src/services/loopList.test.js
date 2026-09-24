import { describe, expect, it } from 'vitest';
import { loopListFrom } from './loopList';

describe('loopListFrom', () => {
    it('reads the loops out of the { loops, business_hours } response', () => {
        const loops = [{ id: 'loop_8' }];
        expect(loopListFrom({ loops, business_hours: { start: 8, end: 22 } })).toBe(loops);
    });

    it('accepts a bare array', () => {
        const loops = [{ id: 'loop_8' }];
        expect(loopListFrom(loops)).toBe(loops);
    });

    it('returns an empty list for a missing or malformed response', () => {
        expect(loopListFrom(undefined)).toEqual([]);
        expect(loopListFrom({})).toEqual([]);
        expect(loopListFrom({ loops: 'not a list' })).toEqual([]);
    });
});
