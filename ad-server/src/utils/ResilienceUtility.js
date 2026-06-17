import logger from './logger.js';

/**
 * Resilience Utility
 * Provides patterns for fault tolerance: Retries and Circuit Breakers
 */

/**
 * Retry an async function with exponential backoff and jitter
 */
export async function withRetry(fn, options = {}) {
    const {
        maxRetries = 3,
        baseDelayMs = 100,
        maxDelayMs = 3000,
        onRetry = null
    } = options;

    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt === maxRetries) break;

            const delay = Math.min(
                baseDelayMs * Math.pow(2, attempt) + Math.random() * 100,
                maxDelayMs
            );

            logger.warn(`Retry attempt ${attempt + 1} for function`, {
                error: error.message,
                nextDelayMs: Math.round(delay)
            });

            if (onRetry) onRetry(error, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}

/**
 * Simple Circuit Breaker Implementation
 */
export class CircuitBreaker {
    constructor(dependencyName, options = {}) {
        this.name = dependencyName;
        this.failureThreshold = options.failureThreshold || 5;
        this.resetTimeoutMs = options.resetTimeoutMs || 30000; // 30s

        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failures = 0;
        this.lastFailureTime = null;
    }

    async execute(fn) {
        if (this.state === 'OPEN') {
            const now = Date.now();
            if (now - this.lastFailureTime > this.resetTimeoutMs) {
                this.state = 'HALF_OPEN';
                logger.info(`Circuit Breaker [${this.name}] moving to HALF_OPEN`);
            } else {
                const err = new Error(`Circuit Breaker [${this.name}] is OPEN`);
                err.code = 'CIRCUIT_BREAKER_OPEN';
                err.retryAfterMs = Math.max(
                    0,
                    this.resetTimeoutMs - (now - this.lastFailureTime)
                );
                throw err;
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure(error);
            throw error;
        }
    }

    onSuccess() {
        if (this.state !== 'CLOSED') {
            logger.info(`Circuit Breaker [${this.name}] restored to CLOSED`);
        }
        this.failures = 0;
        this.state = 'CLOSED';
    }

    onFailure(error) {
        this.failures++;
        this.lastFailureTime = Date.now();

        if (this.failures >= this.failureThreshold || this.state === 'HALF_OPEN') {
            this.state = 'OPEN';
            logger.error(`Circuit Breaker [${this.name}] tripped to OPEN`, {
                failures: this.failures,
                error: error.message
            });
        }
    }

    getHealth() {
        return {
            name: this.name,
            state: this.state,
            failures: this.failures
        };
    }
}
