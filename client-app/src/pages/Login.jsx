import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Maps canonical ROLE_HIERARCHY keys to their dashboard route segment.
// Keep in sync with PersonaSwitcher.jsx and HamburgerMenu.jsx.
const ROLE_ROUTE = {
    superadmin:    'admin',
    admin:         'admin',
    advertiser:    'brand',
    retaileradmin: 'retailer',
    techoperator:  'admin',
};

const QUICK_LOGINS = [
    { role: 'superadmin',   label: 'Super Admin', icon: '🛡️', border: 'border-purple-600', text: 'text-purple-600', hover: 'hover:bg-purple-50' },
    { role: 'admin',        label: 'Admin',       icon: '🔐', border: 'border-indigo-500', text: 'text-indigo-500', hover: 'hover:bg-indigo-50' },
    { role: 'advertiser',   label: 'Brand',       icon: '📺', border: 'border-emerald-500', text: 'text-emerald-600', hover: 'hover:bg-emerald-50' },
    { role: 'retaileradmin',label: 'Retailer',    icon: '🏪', border: 'border-amber-500',   text: 'text-amber-600',   hover: 'hover:bg-amber-50'   },
    { role: 'techoperator', label: 'Tech Op',     icon: '🔧', border: 'border-slate-500',   text: 'text-slate-600',   hover: 'hover:bg-slate-50'   },
];

function makeMockUser(role) {
    return {
        id:               `demo-${role}`,
        name:             role.replace(/([a-z])([A-Z])/g, '$1 $2')
                              .replace(/^./, c => c.toUpperCase()),
        email:            `${role}@demo.softomedia.com`,
        role,
        linked_entity_id: `entity-${role}`,
    };
}

function Login() {
    const [email, setEmail]     = useState('');
    const [error, setError]     = useState('');
    const { login }             = useAuth();
    const navigate              = useNavigate();

    const resolveRole = (emailVal) => {
        const e = emailVal.toLowerCase();
        if (e.includes('superadmin'))   return 'superadmin';
        if (e.includes('admin'))        return 'admin';
        if (e.includes('advertiser') || e.includes('brand')) return 'advertiser';
        if (e.includes('retailer'))     return 'retaileradmin';
        if (e.includes('tech'))         return 'techoperator';
        return 'advertiser'; // safe default
    };

    const doLogin = (role) => {
        const mockUser = makeMockUser(role);
        login(mockUser, 'demo-token');
        navigate(`/dashboard/${ROLE_ROUTE[role]}`);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!email.trim()) { setError('Please enter an email address.'); return; }
        setError('');
        doLogin(resolveRole(email));
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">

                {/* Logo / title */}
                <div className="flex flex-col items-center mb-8">
                    <span className="material-symbols-outlined text-primary text-4xl mb-2" aria-hidden="true">campaign</span>
                    <h1 className="text-xl font-bold text-slate-900">SoftoMedia</h1>
                    <p className="text-sm text-slate-500 mt-1">Sign in to your dashboard</p>
                </div>

                {/* Email form */}
                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                    <div>
                        <label
                            htmlFor="email"
                            className="block text-sm font-medium text-slate-700 mb-1"
                        >
                            Email Address
                        </label>
                        <input
                            id="email"
                            type="email"
                            placeholder="admin@demo.softomedia.com"
                            value={email}
                            onChange={(e) = data-testid="input-email"> { setEmail(e.target.value); setError(''); }}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                        {error && (
                            <p className="mt-1.5 text-xs text-red-600" role="alert">{error}</p>
                        )}
                    </div>
                    <button
                        type="submit"
                        className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
                    >
                        Enter Dashboard
                    </button>
                </form>

                {/* Quick demo access */}
                <div className="mt-6 pt-5 border-t border-slate-200">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest text-center mb-3">
                        Quick Demo Access
                    </p>
                    <div className="flex flex-col gap-2">
                        {QUICK_LOGINS.map(({ role, label, icon, border, text, hover }) => (
                            <button
                                key={role}
                                onClick={() => doLogin(role)}
                                data-testid={`quick-login-${role}`}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${border} ${text} ${hover}`}
                            >
                                <span aria-hidden="true">{icon}</span>
                                {label} Persona
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;
