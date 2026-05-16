
const GlassCard = ({ children, className = '', ...props }) => {
    return (
        <div
            className={`backdrop-blur-xl bg-white/70 dark:bg-slate-900/40 border border-white/40 dark:border-slate-700/50 rounded-2xl p-5 shadow-xl shadow-slate-200/50 dark:shadow-none ${className}`}
            {...props}
        >
            {children}
        </div>
    );
};

export default GlassCard;
