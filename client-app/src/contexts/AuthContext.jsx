import { createContext, useContext, useState, useEffect } from 'react';
import { ROLES } from '../constants/roles';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [persona, setPersonaState] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Persona is a development affordance only. In production the dashboard
        // follows the role on the authenticated user, never a stored key.
        const savedPersona = import.meta.env.DEV
            ? localStorage.getItem('demo_role')
            : null;
        const savedUser = localStorage.getItem('auth_user');

        if (savedUser) {
            setUser(JSON.parse(savedUser));
        }

        if (savedPersona) {
            setPersonaState(savedPersona);
        } else if (savedUser) {
            setPersonaState(JSON.parse(savedUser).role);
        } else {
            // 'advertiser' is the canonical ROLE_HIERARCHY key (was 'brand' — stale)
            setPersonaState(ROLES.ADVERTISER);
        }
        setLoading(false);
    }, []);

    const login = (userData, token) => {
        localStorage.setItem('auth_user', JSON.stringify(userData));
        localStorage.setItem('auth_token', token);
        if (import.meta.env.DEV) {
            localStorage.setItem('demo_role', userData.role);
        }
        setUser(userData);
        setPersonaState(userData.role);
    };

    const setPersona = (type) => {
        // Persona switching is a development affordance. Outside DEV nothing is
        // persisted and no demo credentials are minted, so the call reduces to
        // local UI state.
        if (import.meta.env.DEV) {
            localStorage.setItem('demo_role', type);

            // Ensure demo-token is set if no real token exists
            if (!localStorage.getItem('auth_token')) {
                localStorage.setItem('auth_token', 'demo-token');
            }
        }

        // Sync user.role so role-based checks (e.g. isSuperAdmin in Overview)
        // stay accurate when switching persona via PersonaSwitcher.
        setUser(prev => prev ? { ...prev, role: type } : {
            id: `demo-${type}`,
            name: type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
            email: `${type}@demo.softomedia.com`,
            role: type,
            linked_entity_id: `entity-${type}`
        });

        setPersonaState(type);
    };

    const logout = () => {
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('demo_role');
        setUser(null);
        // 'advertiser' is the canonical ROLE_HIERARCHY key (was 'brand' — stale)
        setPersonaState(ROLES.ADVERTISER);
    };

    return (
        <AuthContext.Provider value={{ user, persona, loading, login, setPersona, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
