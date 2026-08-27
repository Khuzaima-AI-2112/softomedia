import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ROLES } from '../constants/roles';

// Role ids must match the server's ROLE_HIERARCHY keys in requireRole.js
// and the PERSONA_SWATCHES in HamburgerMenu.jsx exactly.
const PERSONAS = [
    { id: ROLES.SUPERADMIN,    label: 'Super Admin', icon: 'shield_person',       color: 'bg-red-600',     route: 'admin'               },
    { id: ROLES.ADMIN,         label: 'Admin',       icon: 'admin_panel_settings', color: 'bg-blue-500',    route: 'admin'               },
    { id: ROLES.ADVERTISER,    label: 'Brand',       icon: 'campaign',             color: 'bg-primary',     route: 'brand'               },
    { id: ROLES.RETAILERADMIN, label: 'Retailer',    icon: 'storefront',           color: 'bg-emerald-500', route: 'retailer'            },
    { id: ROLES.TECHOPERATOR,  label: 'Tech Op',     icon: 'build',                color: 'bg-slate-600',   route: 'techoperator'        },
];

const PersonaSwitcher = () => {
    const { persona, setPersona } = useAuth();
    const navigate = useNavigate();

    const handleSwitch = (p) => {
        // Keep localStorage in sync so the API interceptor sends the
        // correct x-demo-role header on subsequent requests.
        localStorage.setItem('demo_role', p.id);
        setPersona(p.id);
        navigate(`/dashboard/${p.route}`);
    };

    return (
        <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-surface-dark rounded-lg border border-slate-200 dark:border-slate-700">
            {PERSONAS.map((p) => (
                <button
                    key={p.id}
                    onClick={() => handleSwitch(p)}
                    data-testid={`persona-${p.id}`}
                    aria-label={`${p.label} View`}
                    aria-pressed={persona === p.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${
                        persona === p.id
                            ? `${p.color} text-white shadow-sm shadow-blue-500/30`
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700'
                    }`}
                >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{p.icon}</span>
                    <span className="hidden sm:inline">{p.label}</span>
                </button>
            ))}
        </div>
    );
};

export default PersonaSwitcher;
