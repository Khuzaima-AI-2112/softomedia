import React from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, Monitor, Users, Settings, LogOut } from 'lucide-react';

function DashboardLayout() {
    const navigate = useNavigate();
    const role = localStorage.getItem('softomedia_role') || 'admin';

    const handleLogout = () => {
        localStorage.removeItem('softomedia_token');
        localStorage.removeItem('softomedia_role');
        navigate('/login');
    };

    return (
        <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f3f4f6' }}>
            {/* Sidebar */}
            <aside style={{
                width: '250px',
                backgroundColor: '#1f2937',
                color: 'white',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #374151' }}>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>SoftoMedia</h1>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase' }}>{role} Portal</span>
                </div>

                <nav style={{ flex: 1, padding: '1rem' }}>
                    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <li>
                            <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', color: '#e5e7eb', textDecoration: 'none', borderRadius: '0.375rem', backgroundColor: '#374151' }}>
                                <LayoutDashboard size={20} />
                                Dashboard
                            </Link>
                        </li>
                        {role === 'admin' && (
                            <li>
                                <Link to="/dashboard/users" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', color: '#9ca3af', textDecoration: 'none' }}>
                                    <Users size={20} />
                                    Users
                                </Link>
                            </li>
                        )}
                        {(role === 'admin' || role === 'location') && (
                            <li>
                                <Link to="/dashboard/screens" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', color: '#9ca3af', textDecoration: 'none' }}>
                                    <Monitor size={20} />
                                    Screens
                                </Link>
                            </li>
                        )}
                        <li>
                            <Link to="/dashboard/settings" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', color: '#9ca3af', textDecoration: 'none' }}>
                                <Settings size={20} />
                                Settings
                            </Link>
                        </li>
                    </ul>
                </nav>

                <div style={{ padding: '1rem', borderTop: '1px solid #374151' }}>
                    <button
                        onClick={handleLogout}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            width: '100%',
                            padding: '0.75rem',
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer'
                        }}
                    >
                        <LogOut size={20} />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main style={{ flex: 1, overflow: 'auto' }}>
                <header style={{ backgroundColor: 'white', padding: '1rem 2rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>Overview</h2>
                </header>
                <div style={{ padding: '2rem' }}>
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

export default DashboardLayout;
