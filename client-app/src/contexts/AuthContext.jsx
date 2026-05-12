import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, removeAuthToken } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Restore session from localStorage on mount
        const token = localStorage.getItem('auth_token');
        const userData = localStorage.getItem('user_data');

        if (token && userData) {
            try {
                setUser(JSON.parse(userData));
            } catch {
                // Corrupt user_data — clear everything and force re-login
                removeAuthToken();
                localStorage.removeItem('user_data');
            }
        }

        setLoading(false);
    }, []);

    const login = async (email, password) => {
        const data = await authAPI.login(email, password);

        // Persist full user object for session restore on reload
        localStorage.setItem('user_data', JSON.stringify(data.user));
        setUser(data.user);

        return data;
    };

    const logout = () => {
        // removeAuthToken clears both auth_token AND auth_role atomically
        removeAuthToken();
        localStorage.removeItem('user_data');
        setUser(null);
        // authAPI.logout also calls removeAuthToken + redirects — keep in sync
        window.location.href = '/login';
    };

    const value = {
        user,
        login,
        logout,
        isAuthenticated: !!user,
        loading,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
