import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function HamburgerMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const { user, login } = useAuth();
    const navigate = useNavigate();

    const menuItems = [
        { label: 'Dashboard', path: `/dashboard/${user?.role || 'admin'}`, icon: 'dashboard' },
        { label: 'Ad Player', path: '/player', icon: 'play_circle' },
        ...(user?.role === 'admin' ? [{ label: 'System Health', path: '/dashboard/health', icon: 'health_metrics' }] : []),
        ...(user?.role === 'retailer' ? [{ label: 'Schedule Manager', path: '/dashboard/retailer/schedule', icon: 'calendar_today' }] : []),
        { label: 'Settings', path: '#', icon: 'settings' },
    ];

    const personaSwatches = [
        { role: 'admin', label: '🔐 Admin View', color: '#6366f1', path: '/dashboard/admin' },
        { role: 'brand', label: '📺 Brand View', color: '#10b981', path: '/dashboard/brand' },
        { role: 'retailer', label: '🏪 Retailer View', color: '#f59e0b', path: '/dashboard/retailer' },
    ];

    const handlePersonaSwitch = (swatch) => {
        const mockUser = {
            id: `demo-${swatch.role}`,
            email: `${swatch.role}@demo.com`,
            role: swatch.role,
            linked_entity_id: `entity-${swatch.role}`
        };
        login(mockUser, 'demo-token');
        setIsOpen(false);
        navigate(swatch.path);
    };

    return (
        <>
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                data-testid="menu-toggle"
                style={{
                    position: 'fixed',
                    top: '1rem',
                    left: '1rem',
                    zIndex: 1001,
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }} aria-hidden="true">{isOpen ? 'close' : 'menu'}</span>
            </button>

            {/* Backdrop */}
            {isOpen && (
                <div
                    onClick={() => setIsOpen(false)}
                    style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999 }}
                />
            )}

            {/* Sidebar */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: isOpen ? 0 : '-300px',
                    width: '280px',
                    height: '100vh',
                    backgroundColor: 'white',
                    zIndex: 1000,
                    transition: 'left 0.3s ease',
                    padding: '2rem 1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '4px 0 10px rgba(0,0,0,0.1)'
                }}
            >
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '2rem', color: '#111827' }}>SoftoMedia</h3>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {menuItems.map(item => (
                        <Link
                            key={item.label}
                            to={item.path}
                            onClick={() => setIsOpen(false)}
                            data-testid={`nav-link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.75rem',
                                color: '#4b5563',
                                textDecoration: 'none',
                                borderRadius: '0.5rem',
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }} aria-hidden="true">{item.icon}</span>
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div style={{ marginTop: 'auto', borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem' }}>
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', marginBottom: '1rem' }}>Persona Switch</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {personaSwatches.map(swatch => (
                            <button
                                key={swatch.role}
                                onClick={() => handlePersonaSwitch(swatch)}
                                data-testid={`menu-persona-${swatch.role}`}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.5rem',
                                    border: `1px solid ${swatch.color}`,
                                    borderRadius: '0.5rem',
                                    backgroundColor: 'white',
                                    color: swatch.color,
                                    cursor: 'pointer',
                                    fontSize: '0.875rem'
                                }}
                            >
                                {swatch.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}

export default HamburgerMenu;
