
const KPICard = ({ label, value, trend, icon, color = 'text-primary', description }) => {
    return (
        <div data-testid={`kpi-card-${label.toLowerCase().replace(/\s+/g, '-')}`} className="p-6 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700/50 shadow-sm relative overflow-hidden group">
            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className={`material-symbols-outlined text-6xl ${color}`} aria-hidden="true">{icon}</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{label}</p>
            <div className="flex items-baseline gap-2">
                <p data-testid="kpi-value" className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
                {trend && (
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex items-center ${trend.startsWith('+') ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'
                        }`}>
                        <span className="material-symbols-outlined text-[14px] mr-0.5" aria-hidden="true">
                            {trend.startsWith('+') ? 'trending_up' : 'trending_down'}
                        </span>
                        {trend}
                    </span>
                )}
            </div>
            {description && <p className="text-slate-400 text-xs mt-2">{description}</p>}
        </div>
    );
};

export default KPICard;
