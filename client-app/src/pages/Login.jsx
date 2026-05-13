import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Login() {
    const navigate = useNavigate();
    const { login, setUser } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const data = await login(email, password);

            // Role-based routing — aligned to /dashboard/* structure
            const userRole = data.user.role;
            if (userRole === 'brand') {
                navigate('/dashboard/brand');
            } else if (userRole === 'retailer') {
                navigate('/dashboard/retailer');
            } else if (userRole === 'tech') {
                navigate('/dashboard/tech');
            } else {
                navigate('/dashboard/admin'); // admin and others
            }
        } catch (err) {
            console.error(err);
            setError(err.message || 'Invalid email or password');
        } finally {
            setLoading(false);
        }
    };

    // Super Admin demo bypass — no API call required
    const handleDemoAccess = () => {
        const demoUser = { role: 'admin', email: 'demo@softomedia.com', name: 'Super Admin (Demo)' };
        localStorage.setItem('auth_token', 'superadmin-demo-token');
        localStorage.setItem('auth_role', 'admin');
        localStorage.setItem('user_data', JSON.stringify(demoUser));
        // Force a full navigation so AuthContext re-reads localStorage on mount
        window.location.href = '/dashboard/admin';
    };

    return (
        <div style={{
            display: 'flex',
            height: '100vh',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f3f4f6'
        }}>
            <div style={{
                backgroundColor: 'white',
                padding: '2rem',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                width: '100%',
                maxWidth: '400px'
            }}>
                <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#111827' }}>Sign in to SoftoMedia</h2>

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#374151' }}>Email address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#374151' }}>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px'
                            }}
                        />
                    </div>

                    {error && (
                        <div style={{ color: 'red', marginBottom: '1rem', fontSize: '0.875rem' }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            backgroundColor: loading ? '#9ca3af' : '#2563eb',
                            color: 'white',
                            padding: '0.5rem',
                            borderRadius: '4px',
                            border: 'none',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontWeight: '500',
                            marginTop: '0.5rem'
                        }}
                    >
                        {loading ? 'Signing in...' : 'Sign in'}
                    </button>
                </form>

                {/* Demo bypass — for Super Admin testing without credentials */}
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem' }}>
                    <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.75rem' }}>DEMO ACCESS</p>
                    <button
                        onClick={handleDemoAccess}
                        style={{
                            width: '100%',
                            padding: '0.5rem',
                            backgroundColor: 'transparent',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            color: '#374151',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                        }}
                    >
                        ⚡ Enter as Super Admin (No Login)
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Login;
