import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Login() {
    const [email, setEmail] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = (e) => {
        e.preventDefault();
        const role = email.includes('admin') ? 'admin' : (email.includes('brand') ? 'brand' : 'retailer');
        const mockUser = {
            id: `demo-${role}`,
            email: email,
            role: role,
            linked_entity_id: `entity-${role}`
        };
        login(mockUser, 'demo-token');
        navigate(`/dashboard/${role}`);
    };

    const handleDemoLogin = (role) => {
        const mockUser = {
            id: `demo-${role}`,
            email: `${role}@demo.com`,
            role: role,
            linked_entity_id: `entity-${role}`
        };
        login(mockUser, 'demo-token');
        navigate(`/dashboard/${role}`);
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ backgroundColor: 'white', padding: '2.5rem', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', width: '100%', maxWidth: '400px' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '1.5rem', color: '#111827' }}>SoftoMedia</h1>
                <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '2rem' }}>Sign in to your dashboard</p>

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>Email Adress</label>
                        <input
                            type="email"
                            placeholder="retailer@demo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', outline: 'none' }}
                        />
                    </div>
                    <button type="submit" style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', backgroundColor: '#6366f1', color: 'white', fontWeight: 'bold' }}>
                        Enter Dashboard
                    </button>
                </form>

                <div style={{ marginTop: '2rem', borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem' }}>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', textAlign: 'center', marginBottom: '1rem' }}>Quick Demo Access</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <button onClick={() => handleDemoLogin('admin')} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #6366f1', color: '#6366f1' }}>🔐 Admin Persona</button>
                        <button onClick={() => handleDemoLogin('brand')} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #10b981', color: '#10b981' }}>📺 Brand Persona</button>
                        <button onClick={() => handleDemoLogin('retailer')} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #f59e0b', color: '#f59e0b' }}>🏪 Retailer Persona</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;
