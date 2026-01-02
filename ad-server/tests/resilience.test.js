import { jest, describe, test, expect } from '@jest/globals';
import { withRetry, CircuitBreaker } from '../src/utils/ResilienceUtility.js';

describe('ResilienceUtility', () => {
    describe('withRetry', () => {
        test('retries on failure and eventually succeeds', async () => {
            let calls = 0;
            const fn = async () => {
                calls++;
                if (calls < 2) throw new Error('fail');
                return 'success';
            };

            const result = await withRetry(fn, {
                maxRetries: 2,
                baseDelayMs: 1
            });

            expect(result).toBe('success');
            expect(calls).toBe(2);
        });

        test('throws after max retries', async () => {
            const fn = async () => { throw new Error('fail'); };
            await expect(withRetry(fn, {
                maxRetries: 1,
                baseDelayMs: 1
            })).rejects.toThrow('fail');
        });
    });

    describe('CircuitBreaker', () => {
        test('trips after threshold failures', async () => {
            const breaker = new CircuitBreaker('test', {
                failureThreshold: 2
            });
            const fn = async () => { throw new Error('fail'); };

            await expect(breaker.execute(fn)).rejects.toThrow('fail');
            expect(breaker.state).toBe('CLOSED');

            await expect(breaker.execute(fn)).rejects.toThrow('fail');
            expect(breaker.state).toBe('OPEN');
        });

        test('blocks execution when OPEN', async () => {
            const breaker = new CircuitBreaker('test');
            breaker.state = 'OPEN';
            breaker.lastFailureTime = Date.now();

            const fn = jest.fn();
            await expect(breaker.execute(fn)).rejects.toThrow(/is OPEN/);
            expect(fn).not.toHaveBeenCalled();
        });
    });
});
