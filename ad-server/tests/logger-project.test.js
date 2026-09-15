import { describe, expect, test } from '@jest/globals';

describe('logger project label', () => {
    test('log entries name the Google Cloud project the server is connected to', async () => {
        const previous = process.env.GOOGLE_CLOUD_PROJECT;
        process.env.GOOGLE_CLOUD_PROJECT = 'softomedia-logger-check';
        try {
            const { default: logger } = await import('../src/utils/logger.js');
            expect(logger.defaultMeta.project_id).toBe('softomedia-logger-check');
        } finally {
            if (previous === undefined) delete process.env.GOOGLE_CLOUD_PROJECT;
            else process.env.GOOGLE_CLOUD_PROJECT = previous;
        }
    });
});
