import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { authAPI } from '../services/authAPI';
import pricingService from '../services/PricingService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // The next user to sign in on this tab must not see these prices.
    const endSession = () => {
        pricingService.reset();
        setUser(null);
    };

    useEffect(() => {
        // Also fires when the session ends or the user signs out in another tab.
        return onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                endSession();
                setLoading(false);
                return;
            }

            try {
                setUser(await authAPI.getProfile());
            } catch {
                await authAPI.logout();
                endSession();
            } finally {
                setLoading(false);
            }
        });
    }, []);

    const login = async (email, password) => {
        setLoading(true);
        try {
            const { user: profile } = await authAPI.login(email, password);
            setUser(profile);
            return profile;
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            await authAPI.logout();
        } finally {
            endSession();
        }
    };

    const persona = user?.role || null;
    // UI gating only: the backend enforces every grant on its own.
    const can = permission => Boolean(user?.permissions?.includes(permission));

    return (
        <AuthContext.Provider value={{ user, persona, loading, login, logout, can }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
