// MVP: static 12-slot visual, not data-driven.
// Each slot = 5 min inside a 1-hour loop. Alternating primary / neutral.
// No props needed at MVP. Post-MVP: accept `slots` array to colour by booking status.
function LoopVisualisationBar() {
    return (
        <section className="bg-white dark:bg-surface-dark rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
                <span className="material-symbols-outlined text-primary">analytics</span>
                <h3 className="text-lg font-bold">1-Hour Loop Visualisation</h3>
            </div>

            <div className="relative pt-4 pb-2">
                {/* Time markers */}
                <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mb-2 font-mono">
                    <span>00:00</span><span>15:00</span><span>30:00</span><span>45:00</span><span>60:00</span>
                </div>

                {/* 12-slot bar — alternating primary / neutral */}
                <div className="h-12 w-full bg-slate-100 dark:bg-slate-800 rounded-xl flex overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700 shadow-inner">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div
                            key={i}
                            className={`flex-1 border-r border-white/20 dark:border-slate-900/50 transition-all ${
                                i % 2 === 0
                                    ? 'bg-primary'
                                    : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                        />
                    ))}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-6 items-center border-t border-slate-100 dark:border-slate-800 mt-5 pt-4">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-primary shadow-sm shadow-primary/40" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Your Ad (6 Slots)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Other Content</span>
                    </div>
                </div>
            </div>

            <div className="mt-5 p-4 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/10 flex gap-3 items-start">
                <span className="material-symbols-outlined text-primary mt-0.5 text-[18px]">info</span>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    Your ad plays <strong>every 5 minutes</strong> — maximum visibility during peak hours.
                </p>
            </div>
        </section>
    );
}

export default LoopVisualisationBar;
