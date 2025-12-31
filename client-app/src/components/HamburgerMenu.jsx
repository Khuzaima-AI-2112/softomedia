import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../design-tokens.css';

function HamburgerMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const getMenuItems = () => {
        if (user?.role === 'admin') {
            return [
                { label: 'Dashboard', path: '/dashboard', icon: '📊' },
                { label: 'Users', path: '/dashboard/users', icon: '👥' },
                { label: 'Screens', path: '/dashboard/screens', icon: '📺' },
            ];
        } else if (user?.role === 'brand') {
            return [
                { label: 'Dashboard', path: '/brand/dashboard', icon: '📊' },
            ];
        } else if (user?.role === 'retailer') {
            return [
                { label: 'Dashboard', path: '/retailer/dashboard', icon: '📊' },
            ];
        }
        return [];
    };

    const handleNavigate = (path) => {
        navigate(path);
        setIsOpen(false);
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <>
            {/* Hamburger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: 'fixed',
                    top: '1rem',
                    right: '1rem',
                    zIndex: 1001,
                    padding: '0.75rem',
                    backgroundColor: 'var(--color-primary, #6366f1)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.2s',
                    width: '3rem',
                    height: '3rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                }}
                aria-label="Menu"
            >
                {isOpen ? '✕' : '☰'}
            </button>

            {/* Backdrop Overlay */}
            {isOpen && (
                <div
                    onClick={() => setIsOpen(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 999,
                        animation: 'fadeIn 0.2s',
                    }}
                />
            )}

            {/* Slide-out Menu */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    right: isOpen ? 0 : '-300px',
                    width: '280px',
                    height: '100vh',
                    backgroundColor: 'white',
                    boxShadow: isOpen ? '-4px 0 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
                    zIndex: 1000,
                    padding: '5rem 1.5rem 2rem 1.5rem',
                    transition: 'right 0.3s ease-in-out',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {/* User Info */}
                <div style={{
                    marginBottom: '2rem',
                    paddingBottom: '1rem',
                    borderBottom: '1px solid #e5e7eb',
                }}>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                        Signed in as
                    </div>
                    <div style={{ fontWeight: '600', color: '#111827', marginBottom: '0.25rem' }}>
                        {user?.email}
                    </div>
                    <div style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        backgroundColor: '#dbeafe',
                        color: '#1e40af',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        textTransform: 'capitalize',
                    }}>
                        {user?.role}
                    </div>
                </div>

                {/* Navigation Links */}
                <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {getMenuItems().map((item) => (
                        <button
                            key={item.path}
                            onClick={() => handleNavigate(item.path)}
                            style={{
                                padding: '0.75rem 1rem',
                                textAlign: 'left',
                                fontSize: '1rem',
                                color: '#374151',
                                backgroundColor: 'transparent',
                                border: 'none',
                                borderRadius: '0.5rem',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                        >
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>

                {/* Logout Button */}
                <button
                    onClick={handleLogout}
                    style={{
                        padding: '0.75rem 1rem',
                        marginTop: 'auto',
                        fontSize: '1rem',
                        fontWeight: '500',
                        color: '#dc2626',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#fee2e2';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#fef2f2';
                    }}
                >
                    🚪 Logout
                </button>
            </div>

            {/* Keyframe animation for fade-in */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </>
    );
}

export default HamburgerMenu;
