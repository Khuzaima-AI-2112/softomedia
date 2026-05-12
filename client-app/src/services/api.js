import { API_URL } from '../config.js';

/**
 * API Service Layer
 * Centralized API calls with authentication
 */

// Get auth token from localStorage
const getAuthToken = () => {
    return localStorage.getItem('auth_token');
};

// Set auth token in localStorage
export const setAuthToken = (token) => {
    localStorage.setItem('auth_token', token);
};

// Set auth role in localStorage
export const setAuthRole = (role) => {
    localStorage.setItem('auth_role', role);
};

// Remove auth token and role (atomic logout)
export const removeAuthToken = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_role');
};

// Base fetch with auth headers
const authFetch = async (url, options = {}) => {
    const token = getAuthToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        // Token expired or invalid — clear both keys before redirecting
        removeAuthToken();
        window.location.href = '/login';
        throw new Error('Unauthorized');
    }

    return response;
};

// ===== HTTP CLIENT =====
// Generic REST client used by ApiService.js (apiClient.get/post/put/patch/delete)

const handleResponse = async (response) => {
    if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`;
        try {
            const err = await response.json();
            errorMsg = err.error || err.message || errorMsg;
        } catch (_) { /* non-JSON body */ }
        throw new Error(errorMsg);
    }
    // 204 No Content — nothing to parse
    if (response.status === 204) return null;
    return response.json();
};

const apiClient = {
    get: (path) =>
        authFetch(`${API_URL}${path}`).then(handleResponse),

    post: (path, body, options = {}) => {
        const isFormData = body instanceof FormData;
        const fetchOptions = {
            method: 'POST',
            ...options,
        };
        if (!isFormData) {
            fetchOptions.body = JSON.stringify(body);
        } else {
            // Let the browser set the multipart boundary automatically
            fetchOptions.body = body;
            fetchOptions.headers = { ...options.headers };
            delete fetchOptions.headers['Content-Type'];
        }
        return authFetch(`${API_URL}${path}`, fetchOptions).then(handleResponse);
    },

    put: (path, body) =>
        authFetch(`${API_URL}${path}`, {
            method: 'PUT',
            body: JSON.stringify(body),
        }).then(handleResponse),

    patch: (path, body) =>
        authFetch(`${API_URL}${path}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }).then(handleResponse),

    delete: (path) =>
        authFetch(`${API_URL}${path}`, { method: 'DELETE' }).then(handleResponse),
};

// ===== AUTH API =====

export const authAPI = {
    login: async (email, password) => {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Login failed');
        }

        const data = await response.json();
        setAuthToken(data.token);
        if (data.user?.role) {
            setAuthRole(data.user.role);
        }
        return data;
    },

    logout: () => {
        removeAuthToken();
        window.location.href = '/login';
    },
};

// ===== USERS API =====

export const usersAPI = {
    invite: async (email, role, name, business_name) => {
        const response = await authFetch(`${API_URL}/api/users/invite`, {
            method: 'POST',
            body: JSON.stringify({ email, role, name, business_name }),
        });
        return response.json();
    },

    create: async (userData) => {
        const response = await authFetch(`${API_URL}/api/users`, {
            method: 'POST',
            body: JSON.stringify(userData),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to create user');
        }

        return response.json();
    },

    list: async (role = null, status = null) => {
        const params = new URLSearchParams();
        if (role) params.append('role', role);
        if (status) params.append('status', status);

        const response = await authFetch(`${API_URL}/api/users?${params}`);
        return response.json();
    },

    acceptInvitation: async (token, password, name) => {
        const response = await fetch(`${API_URL}/api/users/accept-invitation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password, name }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to accept invitation');
        }

        const data = await response.json();
        setAuthToken(data.token);
        if (data.user?.role) {
            setAuthRole(data.user.role);
        }
        return data;
    },

    delete: async (userId) => {
        const response = await authFetch(`${API_URL}/api/users/${userId}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to delete user');
        }

        return response.json();
    },
};

// ===== DASHBOARD API =====

export const dashboardAPI = {
    getRetailerDashboard: async (retailerId) => {
        const response = await authFetch(`${API_URL}/api/dashboard/retailer/${retailerId}`);
        return response.json();
    },

    getBrandDashboard: async (brandId) => {
        const response = await authFetch(`${API_URL}/api/dashboard/brand/${brandId}`);
        return response.json();
    },
};

// ===== SCREENS API =====

export const screensAPI = {
    list: async () => {
        const response = await authFetch(`${API_URL}/api/screens`);
        return response.json();
    },

    getManagement: async (status = null, search = null, sort = 'last_seen', order = 'desc') => {
        const params = new URLSearchParams({ sort, order });
        if (status) params.append('status', status);
        if (search) params.append('search', search);

        const response = await authFetch(`${API_URL}/api/screens/management?${params}`);
        return response.json();
    },

    getDiagnostics: async (screenId) => {
        const response = await authFetch(`${API_URL}/api/screens/${screenId}/diagnostics`);
        return response.json();
    },
};

// ===== CAMPAIGNS API =====

export const campaignsAPI = {
    create: async (formData) => {
        const token = getAuthToken();
        const response = await fetch(`${API_URL}/api/campaigns/create`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                // Don't set Content-Type for multipart/form-data
            },
            body: formData, // FormData object
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create campaign');
        }

        return response.json();
    },

    list: async (status = null) => {
        const params = new URLSearchParams();
        if (status) params.append('status', status);

        const response = await authFetch(`${API_URL}/api/campaigns?${params}`);
        return response.json();
    },

    get: async (campaignId) => {
        const response = await authFetch(`${API_URL}/api/campaigns/${campaignId}`);
        return response.json();
    },

    update: async (campaignId, updates) => {
        const response = await authFetch(`${API_URL}/api/campaigns/${campaignId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
        return response.json();
    },

    delete: async (campaignId) => {
        const response = await authFetch(`${API_URL}/api/campaigns/${campaignId}`, {
            method: 'DELETE',
        });
        return response.json();
    },

    getReport: async (campaignId) => {
        const response = await authFetch(`${API_URL}/api/campaigns/${campaignId}/report`);
        return response.json();
    },
};

// ===== NOTIFICATIONS API =====

export const notificationsAPI = {
    subscribe: async (fcm_token, device_type = 'web') => {
        const response = await authFetch(`${API_URL}/api/notifications/subscribe`, {
            method: 'POST',
            body: JSON.stringify({ fcm_token, device_type }),
        });
        return response.json();
    },

    unsubscribe: async () => {
        const response = await authFetch(`${API_URL}/api/notifications/unsubscribe`, {
            method: 'DELETE',
        });
        return response.json();
    },

    getPreferences: async () => {
        const response = await authFetch(`${API_URL}/api/notifications/preferences`);
        return response.json();
    },

    updatePreferences: async (preferences) => {
        const response = await authFetch(`${API_URL}/api/notifications/preferences`, {
            method: 'PUT',
            body: JSON.stringify(preferences),
        });
        return response.json();
    },

    // FIX: removed erroneous double `async` keyword that caused a syntax error
    getHistory: async (limit = 50) => {
        const response = await authFetch(`${API_URL}/api/notifications/history?limit=${limit}`);
        return response.json();
    },
};

export default apiClient;
