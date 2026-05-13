import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Zap, Monitor } from 'lucide-react';
import '../design-tokens.css';

function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [email, setEmail]       = useState('');
    const [password, setPassword] = useState('');
    const [error, setError]       = useState('');
    const [loading, setLoading]   = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const data = await login(email, password);
            const role = data.user.role;
            if (role === 'brand')    navigate('/dashboard/brand');
            else if (role === 'retailer') navigate('/dashboard/retailer');
            else if (role === 'tech')     navigate('/dashboard/tech');
            else                          navigate('/dashboard/admin');
        } catch (err) {
            setError(err.message || 'Invalid email or password');
        } finally {
            setLoading(false);
        }
    };

    const handleDemoAccess = () => {
        const demoUser = { role: 'admin', email: 'demo@softomedia.com', name: 'Super Admin (Demo)' };
        localStorage.setItem('auth_token', 'superadmin-demo-token');
        localStorage.setItem('auth_role', 'admin');
        localStorage.setItem('user_data', JSON.stringify(demoUser));
        window.location.href = '/dashboard/admin';
    };

    const inputStyle = {
        width: '100%', boxSizing: 'border-box',
        padding: 'var(--space-2-5) var(--space-3)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        fontSize: 'var(--text-sm)',
        backgroundColor: 'var(--color-bg-card)',
        color: 'var(--color-text-primary)',
        outline: 'none',
        fontFamily: 'var(--font-body)',
        transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
    };

    return (
        <div style={{ display: 'flex', height: '100vh', fontFamily: 'var(--font-body)' }}>

            {/* ---- Left: gradient hero panel ---- */}
            <div style={{
                flex: '0 0 45%',
                background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4f46e5 80%, #6366f1 100%)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: 'var(--space-12)',
                position: 'relative', overflow: 'hidden',
            }}>
                {/* decorative blobs */}
                <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: 320, height: 320, borderRadius: '50%', background: 'rgba(99,102,241,0.25)', filter: 'blur(60px)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '-60px', left: '-60px', width: 260, height: 260, borderRadius: '50%', background: 'rgba(129,140,248,0.2)', filter: 'blur(50px)', pointerEvents: 'none' }} />

                <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', color: '#fff', maxWidth: 340 }}>
                    {/* Logo mark */}
                    <div style={{
                        width: 56, height: 56, borderRadius: 16,
                        backgroundColor: 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto var(--space-5)',
                    }}>
                        <Monitor size={26} color="#fff" />
                    </div>
                    <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 900, letterSpacing: '-0.03em', margin: '0 0 var(--space-3)', lineHeight: 1.1 }}>SoftoMedia</h1>
                    <p style={{ fontSize: 'var(--text-base)', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: 0 }}>
                        The modern retail media platform. Manage screens, schedule campaigns, and track performance — all in one place.
                    </p>

                    {/* Feature pills */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 'var(--space-8)' }}>
                        {['Real-time analytics', 'AI scheduling', 'Network monitoring', 'Campaign automation'].map(f => (
                            <span key={f} style={{
                                fontSize: 'var(--text-xs)', fontWeight: 600,
                                padding: '4px 12px', borderRadius: 9999,
                                backgroundColor: 'rgba(255,255,255,0.12)',
                                border: '1px solid rgba(255,255,255,0.18)',
                                color: 'rgba(255,255,255,0.9)',
                            }}>{f}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* ---- Right: form panel ---- */}
            <div style={{
                flex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'var(--color-bg)',
                padding: 'var(--space-8)',
            }}>
                <div style={{ width: '100%', maxWidth: 380 }}>

                    <div style={{ marginBottom: 'var(--space-8)' }}>
                        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 var(--space-1)', letterSpacing: '-0.02em' }}>Welcome back</h2>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: 0 }}>Sign in to your SoftoMedia account</p>
                    </div>

                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1-5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email address</label>
                            <input
                                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                                placeholder="you@company.com"
                                style={inputStyle}
                                onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }}
                                onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1-5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Password</label>
                            <input
                                type="password" value={password} onChange={e => setPassword(e.target.value)} required
                                placeholder="••••••••"
                                style={inputStyle}
                                onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }}
                                onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}
                            />
                        </div>

                        {error && (
                            <div style={{
                                padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
                                backgroundColor: 'var(--color-error-light)',
                                border: '1px solid rgba(239,68,68,0.25)',
                                fontSize: 'var(--text-sm)', color: 'var(--color-error)',
                            }}>{error}</div>
                        )}

                        <button
                            type="submit" disabled={loading}
                            style={{
                                width: '100%', padding: 'var(--space-2-5)',
                                backgroundColor: loading ? 'var(--color-text-tertiary)' : 'var(--color-primary)',
                                color: '#fff', border: 'none',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                marginTop: 'var(--space-1)',
                                transition: 'background-color var(--transition-fast)',
                                fontFamily: 'var(--font-body)',
                            }}
                        >
                            {loading ? 'Signing in…' : 'Sign in'}
                        </button>
                    </form>

                    {/* Demo access */}
                    <div style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--color-border)' }}>
                        <p style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Demo Access</p>
                        <button
                            onClick={handleDemoAccess}
                            style={{
                                width: '100%', padding: 'var(--space-2-5)',
                                backgroundColor: 'transparent',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--color-text-secondary)',
                                fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                fontFamily: 'var(--font-body)',
                                transition: 'border-color var(--transition-fast), color var(--transition-fast)',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
                        >
                            <Zap size={14} />
                            Enter as Super Admin (No Login)
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default Login;
