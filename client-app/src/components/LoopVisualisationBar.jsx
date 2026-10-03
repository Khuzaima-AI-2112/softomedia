// The twelve five-second Slots of an Hourly Loop, marking the positions the
// Brand has picked in any of its booked hours. The loop repeats every 60 seconds through the hour.
function LoopVisualisationBar({ positions = [] }) {
    const picked = new Set(positions);

    return (
        <section className="bg-white dark:bg-surface-dark rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
                <span className="material-symbols-outlined text-primary" aria-hidden="true">analytics</span>
                <h3 id="loop-visualisation-title" className="text-lg font-bold">Hourly Loop</h3>
            </div>

            <div className="relative pt-4 pb-2">
                {/* Time markers */}
                <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mb-2 font-mono">
                    <span>0s</span><span>15s</span><span>30s</span><span>45s</span><span>60s</span>
                </div>

                <ol
                    aria-labelledby="loop-visualisation-title"
                    className="h-12 w-full bg-slate-100 dark:bg-slate-800 rounded-xl flex overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700 shadow-inner"
                >
                    {Array.from({ length: 12 }).map((_, i) => (
                        <li
                            key={i}
                            aria-label={`Slot ${i + 1}: ${picked.has(i) ? 'your Creative' : 'other content'}`}
                            className={`flex-1 border-r border-white/20 dark:border-slate-900/50 transition-all ${
                                picked.has(i)
                                    ? 'bg-primary'
                                    : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                        />
                    ))}
                </ol>

                {/* Legend */}
                <div className="flex flex-wrap gap-6 items-center border-t border-slate-100 dark:border-slate-800 mt-5 pt-4">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-primary shadow-sm shadow-primary/40" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Positions you picked ({picked.size})</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-700" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Other Content</span>
                    </div>
                </div>
            </div>

            <div className="mt-5 p-4 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/10 flex gap-3 items-start">
                <span className="material-symbols-outlined text-primary mt-0.5 text-[18px]" aria-hidden="true">info</span>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    Each Slot plays for 5 seconds, and the loop repeats every 60 seconds through each hour you booked. Highlighted positions are the ones you picked in any of those hours.
                </p>
            </div>
        </section>
    );
}

export default LoopVisualisationBar;
