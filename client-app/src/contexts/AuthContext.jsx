import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [persona, setPersonaState] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedPersona = localStorage.getItem('active_persona');
        const savedUser = localStorage.getItem('auth_user');

        if (savedUser) {
            setUser(JSON.parse(savedUser));
        }

        if (savedPersona) {
            setPersonaState(savedPersona);
        } else if (savedUser) {
            setPersonaState(JSON.parse(savedUser).role);
        } else {
            setPersonaState('brand');
        }
        setLoading(false);
    }, []);

    const login = (userData, token) => {
        localStorage.setItem('auth_user', JSON.stringify(userData));
        localStorage.setItem('auth_token', token);
        localStorage.setItem('active_persona', userData.role);
        setUser(userData);
        setPersonaState(userData.role);
    };

    const setPersona = (type) => {
        localStorage.setItem('active_persona', type);
        localStorage.setItem('demo_role', type); // Sync role for backend bypass

        // Ensure demo-token is set if no real token exists
        if (!localStorage.getItem('auth_token')) {
            localStorage.setItem('auth_token', 'demo-token');
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
        localStorage.removeItem('active_persona');
        setUser(null);
        setPersonaState('brand');
    };

    return (
        <AuthContext.Provider value={{ user, persona, loading, login, setPersona, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
