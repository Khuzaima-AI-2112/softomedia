// API Client
// Centralized API communication layer with error handling and retry logic

import { API_URL } from '../config.js';

/**
 * API Client Configuration
 */
const DEFAULT_CONFIG = {
    timeout: 10000,           // 10 second timeout
    retries: 3,               // Retry failed requests 3 times
    retryDelay: 1000,         // 1 second between retries
    retryOn: [408, 429, 500, 502, 503, 504], // Retry on these status codes
};

/**
 * Custom API Error
 */
export class APIError extends Error {
    constructor(message, status, response) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.response = response;
    }
}

/**
 * Sleep utility for retry delays
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Base API Client
 */
class APIClient {
    constructor(baseURL = API_URL, config = {}) {
        this.baseURL = baseURL;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.requestInterceptors = [];
        this.responseInterceptors = [];
    }

    /**
     * Add request interceptor
     * @param {Function} interceptor - Function that receives and returns request options
     */
    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }

    /**
     * Add response interceptor
     * @param {Function} interceptor - Function that receives and returns response
     */
    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);
    }

    /**
     * Apply request interceptors
     */
    async applyRequestInterceptors(url, options) {
        let modifiedOptions = { ...options };
        for (const interceptor of this.requestInterceptors) {
            modifiedOptions = await interceptor(url, modifiedOptions);
        }
        return modifiedOptions;
    }

    /**
     * Apply response interceptors
     */
    async applyResponseInterceptors(response) {
        let modifiedResponse = response;
        for (const interceptor of this.responseInterceptors) {
            modifiedResponse = await interceptor(modifiedResponse);
        }
        return modifiedResponse;
    }

    /**
     * Make HTTP request with retry logic
     */
    async request(endpoint, options = {}, attempt = 1) {
        const url = `${this.baseURL}${endpoint}`;

        // Apply request interceptors
        const modifiedOptions = await this.applyRequestInterceptors(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        });

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            const response = await fetch(url, {
                ...modifiedOptions,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // Apply response interceptors
            const modifiedResponse = await this.applyResponseInterceptors(response);

            // Handle non-OK responses
            if (!modifiedResponse.ok) {
                const shouldRetry =
                    this.config.retryOn.includes(modifiedResponse.status) &&
                    attempt < this.config.retries;

                if (shouldRetry) {
                    await sleep(this.config.retryDelay * attempt);
                    return this.request(endpoint, options, attempt + 1);
                }

                const errorData = await modifiedResponse.json().catch(() => ({}));
                throw new APIError(
                    errorData.error || `HTTP ${modifiedResponse.status}`,
                    modifiedResponse.status,
                    errorData
                );
            }

            // Parse JSON response
            const data = await modifiedResponse.json();
            return data;

        } catch (error) {
            clearTimeout(timeoutId);

            // Handle timeout
            if (error.name === 'AbortError') {
                const shouldRetry = attempt < this.config.retries;
                if (shouldRetry) {
                    await sleep(this.config.retryDelay * attempt);
                    return this.request(endpoint, options, attempt + 1);
                }
                throw new APIError('Request timeout', 408, null);
            }

            // Handle network errors
            if (error instanceof TypeError) {
                const shouldRetry = attempt < this.config.retries;
                if (shouldRetry) {
                    await sleep(this.config.retryDelay * attempt);
                    return this.request(endpoint, options, attempt + 1);
                }
                throw new APIError('Network error', 0, null);
            }

            throw error;
        }
    }

    /**
     * GET request
     */
    async get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }

    /**
     * POST request
     */
    async post(endpoint, data, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * PUT request
     */
    async put(endpoint, data, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    /**
     * DELETE request
     */
    async delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }
}

// Create singleton instance
const apiClient = new APIClient();

// Add auth token interceptor
apiClient.addRequestInterceptor((url, options) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
        };
    }
    return options;
});

// Export singleton and class
export { apiClient, APIClient };
export default apiClient;
