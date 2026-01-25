
const GlassChart = ({ title, height = '200px', children }) => {
    return (
        <div className="p-6 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700/50 shadow-sm relative overflow-hidden group">
            {title && (
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">{title}</h3>
                    <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-primary/40"></div>
                        <div className="w-2 h-2 rounded-full bg-primary/20"></div>
                    </div>
                </div>
            )}
            <div style={{ height }} className="relative flex items-end gap-2 w-full">
                {children || (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs italic">
                        Chart data visualization placeholder
                    </div>
                )}
            </div>
        </div>
    );
};

// Sub-component for simple CSS bars
export const ChartBar = ({ percent, label, color = 'bg-primary' }) => (
    <div className="flex-1 flex flex-col items-center gap-2 group/bar">
        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-lg relative flex flex-col justify-end h-full min-h-[4px]">
            <div
                className={`${color} rounded-t-lg transition-all duration-500 ease-out group-hover/bar:brightness-110`}
                style={{ height: `${percent}%` }}
            >
                <div className="opacity-0 group-hover/bar:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none transition-opacity">
                    {percent}%
                </div>
            </div>
        </div>
        {label && <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">{label}</span>}
    </div>
);

export default GlassChart;
