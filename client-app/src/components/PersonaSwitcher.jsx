import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const PersonaSwitcher = () => {
    const { persona, setPersona } = useAuth();

    const personas = [
        { id: 'admin', label: 'Admin', icon: 'shield_person', color: 'bg-red-500' },
        { id: 'brand', label: 'Brand', icon: 'campaign', color: 'bg-primary' },
        { id: 'retailer', label: 'Retailer', icon: 'storefront', color: 'bg-emerald-500' }
    ];

    return (
        <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-surface-dark rounded-lg border border-slate-200 dark:border-slate-700">
            {personas.map((p) => (
                <button
                    key={p.id}
                    onClick={() => setPersona(p.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${persona === p.id
                            ? `${p.color} text-white shadow-sm shadow-blue-500/30`
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700'
                        }`}
                >
                    <span className="material-symbols-outlined text-[18px]">{p.icon}</span>
                    <span className="hidden sm:inline">{p.label}</span>
                </button>
            ))}
        </div>
    );
};

export default PersonaSwitcher;
