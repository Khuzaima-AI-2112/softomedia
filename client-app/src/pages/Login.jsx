import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { dashboardRouteForRole } from '../constants/roles';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            const user = await login(email.trim(), password);
            const route = dashboardRouteForRole(user.role);
            if (!route) throw new Error('Unsupported account role');
            navigate(`/dashboard/${route}`, { replace: true });
        } catch {
            setError('Unable to sign in with those credentials.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
                <div className="flex flex-col items-center mb-8">
                    <span className="material-symbols-outlined text-primary text-4xl mb-2" aria-hidden="true">campaign</span>
                    <h1 className="text-xl font-bold text-slate-900">SoftoMedia</h1>
                    <p className="text-sm text-slate-500 mt-1">Sign in to your dashboard</p>
                </div>

                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                            Email Address
                        </label>
                        <input
                            id="email"
                            type="email"
                            autoComplete="username"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            data-testid="input-email"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            data-testid="input-password"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                    </div>
                    {error && (
                        <p data-testid="login-error" className="text-xs text-red-600" role="alert">{error}</p>
                    )}
                    <button
                        type="submit"
                        disabled={submitting}
                        data-testid="btn-login"
                        className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
                    >
                        {submitting ? 'Signing in…' : 'Enter Dashboard'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Login;
