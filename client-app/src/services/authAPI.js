// Auth API Service
// Authentication-related API calls

import apiClient from './api.js';

export const authAPI = {
    /**
     * Login with email
     * @param {string} email - User email
     * @returns {Promise<{token: string, user: object}>}
     */
    async login(email) {
        const response = await apiClient.post('/api/auth/login', { email });

        // Store token in localStorage
        if (response.token) {
            localStorage.setItem('auth_token', response.token);
            localStorage.setItem('auth_user', JSON.stringify(response.user));
        }

        return response;
    },

    /**
     * Logout
     */
    logout() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
    },

    /**
     * Get current user from localStorage
     * @returns {object|null}
     */
    getCurrentUser() {
        const userStr = localStorage.getItem('auth_user');
        return userStr ? JSON.parse(userStr) : null;
    },

    /**
     * Check if user is authenticated
     * @returns {boolean}
     */
    isAuthenticated() {
        return !!localStorage.getItem('auth_token');
    },
};
