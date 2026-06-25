// API Client
// Centralized API communication layer with error handling and retry logic

import { API_URL } from '../config.js';

/**
 * API Client Configuration
 */
const DEFAULT_CONFIG = {
    timeout: 10000,
    retries: 3,
    retryDelay: 1000,
    retryOn: [408, 429, 500, 502, 503, 504],
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

    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }

    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);
    }

    async applyRequestInterceptors(url, options) {
        let modifiedOptions = { ...options };
        for (const interceptor of this.requestInterceptors) {
            modifiedOptions = await interceptor(url, modifiedOptions);
        }
        return modifiedOptions;
    }

    async applyResponseInterceptors(response) {
        let modifiedResponse = response;
        for (const interceptor of this.responseInterceptors) {
            modifiedResponse = await interceptor(modifiedResponse);
        }
        return modifiedResponse;
    }

    async request(endpoint, options = {}, attempt = 1) {
        const url = `${this.baseURL}${endpoint}`;

        const modifiedOptions = await this.applyRequestInterceptors(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            // eslint-disable-next-line no-restricted-syntax
            const response = await fetch(url, {
                ...modifiedOptions,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const modifiedResponse = await this.applyResponseInterceptors(response);

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

            const data = await modifiedResponse.json();
            return data;

        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                const shouldRetry = attempt < this.config.retries;
                if (shouldRetry) {
                    await sleep(this.config.retryDelay * attempt);
                    return this.request(endpoint, options, attempt + 1);
                }
                throw new APIError('Request timeout', 408, null);
            }

            if (error instanceof TypeError) {
                const shouldRetry = attempt < this.config.retries;
                if (shouldRetry) {
                    await sleep(this.config.retryDelay * attempt);
                    return this.request(endpoint, options, attempt + 1);
                }
                window.dispatchEvent(new CustomEvent('api:network-error'));
                throw new APIError('Network error', 0, null);
            }

            throw error;
        }
    }

    async get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }

    async post(endpoint, data, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async put(endpoint, data, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async patch(endpoint, data, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    }

    async delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }
}

// Create singleton instance
const apiClient = new APIClient();

// ---------------------------------------------------------------------------
// Phase 2 – Secure demo token seeding
//
// BEFORE: demo-token + role='superadmin' were seeded unconditionally in DEV,
//         meaning any DEV page load silently gained super-admin API access.
//
// AFTER:
//   • Token seeding is still DEV-only (import.meta.env.DEV guard kept).
//   • The auto-seeded role is 'admin' (not 'superadmin').
//   • Elevating to 'superadmin' requires the user to explicitly switch persona
//     via the HamburgerMenu (which calls login() with the chosen role) — there
//     is no longer a silent path to superadmin on page load.
// ---------------------------------------------------------------------------
if (import.meta.env.DEV) {
    if (!localStorage.getItem('auth_token')) {
        localStorage.setItem('auth_token', 'demo-token');
    }
    // Phase 2: default demo role is 'admin', NOT 'superadmin'
    if (!localStorage.getItem('demo_role')) {
        localStorage.setItem('demo_role', 'admin');
    }
}

apiClient.addRequestInterceptor((url, options) => {
    const token    = localStorage.getItem('auth_token');
    const demoRole = localStorage.getItem('demo_role') || localStorage.getItem('active_persona');

    const hasAuth = options.headers && (options.headers['Authorization'] || options.headers['authorization']);
    if (token && !hasAuth) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
        };
    }

    const hasDemoRole = options.headers && (options.headers['x-demo-role'] || options.headers['X-Demo-Role']);
    if (demoRole && !hasDemoRole) {
        options.headers = {
            ...options.headers,
            'x-demo-role': demoRole,
        };
    }
    return options;
});

export { apiClient, APIClient };
export default apiClient;
