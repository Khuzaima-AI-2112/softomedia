import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { authAPI } from '../services/authAPI';
import { getDevelopmentIdentity } from '../services/developmentIdentity';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        return onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                setUser(getDevelopmentIdentity());
                setLoading(false);
                return;
            }

            try {
                setUser(await authAPI.getProfile());
            } catch {
                await authAPI.logout();
                setUser(null);
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
        await authAPI.logout();
        setUser(null);
    };

    const persona = user?.role || null;

    return (
        <AuthContext.Provider value={{ user, persona, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
