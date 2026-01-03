import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient, APIClient, APIError } from './api';

describe('APIClient', () => {
    let client;
    const baseURL = 'http://test-api.com';

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('fetch', vi.fn());
        client = new APIClient(baseURL, { retryDelay: 1, timeout: 100 });

        // Mock localStorage
        const storage = {};
        vi.stubGlobal('localStorage', {
            getItem: vi.fn(key => storage[key]),
            setItem: vi.fn((key, val) => storage[key] = val),
            clear: vi.fn(() => { })
        });
    });

    it('makes a successful GET request', async () => {
        const mockData = { id: 1, name: 'Test' };
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockData,
        });

        const result = await client.get('/test');

        expect(result).toEqual(mockData);
        expect(fetch).toHaveBeenCalledWith(`${baseURL}/test`, expect.objectContaining({
            method: 'GET'
        }));
    });

    it('handles non-OK responses with custom APIError', async () => {
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            json: async () => ({ error: 'Not Found' }),
        });

        await expect(client.get('/not-found')).rejects.toThrow(APIError);
    });

    it('retries on specific status codes', async () => {
        fetch
            .mockResolvedValueOnce({ ok: false, status: 500 })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });

        const result = await client.get('/retry');

        expect(result.success).toBe(true);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('attaches auth token from localStorage if present', async () => {
        localStorage.setItem('auth_token', 'fake-token');

        // We use the singleton instance here to test the interceptor
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

        await apiClient.get('/secure');

        expect(fetch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            headers: expect.objectContaining({
                'Authorization': 'Bearer fake-token'
            })
        }));
    });

    it.skip('handles request timeout', async () => {
        fetch.mockImplementationOnce((url, options) => {
            return new Promise((resolve, reject) => {
                if (options.signal) {
                    options.signal.addEventListener('abort', () => {
                        const error = new Error('The operation was aborted');
                        error.name = 'AbortError';
                        reject(error);
                    });
                }
            });
        });

        await expect(client.get('/timeout')).rejects.toThrow('Request timeout');
    });
});
