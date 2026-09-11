// Auth API Service
// Authentication-related API calls

import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebase.js';
import apiClient from './api.js';

let profileRequest = null;

export const authAPI = {
    /**
     * Login with Firebase email and password, then resolve the server profile.
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<{credential: object, user: object}>}
     */
    async login(email, password) {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const user = await this.getProfile();
        return { credential, user };
    },

    /**
     * Logout
     */
    async logout() {
        await signOut(auth);
    },

    /**
     * Resolve the authenticated Softomedia profile.
     * @returns {Promise<object>}
     */
    async getProfile() {
        if (!profileRequest) {
            profileRequest = apiClient.get('/api/auth/me')
                .then(response => response.user)
                .finally(() => {
                    profileRequest = null;
                });
        }
        return profileRequest;
    },

    /**
     * Check if user is authenticated
     * @returns {boolean}
     */
    isAuthenticated() {
        return !!auth.currentUser;
    },
};
