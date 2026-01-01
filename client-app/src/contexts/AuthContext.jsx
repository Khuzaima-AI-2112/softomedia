import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [persona, setPersonaState] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedPersona = localStorage.getItem('active_persona');
        if (savedPersona) {
            setPersonaState(savedPersona);
        } else {
            // Default to brand for demo purposes if nothing is set
            setPersonaState('brand');
        }
        setLoading(false);
    }, []);

    const setPersona = (type) => {
        localStorage.setItem('active_persona', type);
        setPersonaState(type);
    };

    const logout = () => {
        localStorage.removeItem('active_persona');
        setPersonaState(null);
    };

    return (
        <AuthContext.Provider value={{ persona, loading, setPersona, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
