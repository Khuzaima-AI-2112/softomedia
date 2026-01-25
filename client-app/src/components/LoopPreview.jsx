
function LoopPreview({ slots = [] }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">60-Second Loop Breakdown</h4>
                <div className="flex items-center gap-4 text-xs font-medium">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        <span>Paid Ad</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span>Retailer</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                        <span>Fallback</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
                {slots.map((slot, i) => {
                    const bgColor = slot.type === 'paid' ? 'bg-primary' :
                        slot.type === 'retailer' ? 'bg-emerald-500' :
                            'bg-slate-100 dark:bg-slate-800';
                    const borderColor = slot.type === 'paid' ? 'border-primary' :
                        slot.type === 'retailer' ? 'border-emerald-500' :
                            'border-slate-200 dark:border-slate-700';

                    return (
                        <div
                            key={i}
                            className={`group relative aspect-square rounded-lg border-2 ${borderColor} ${bgColor} flex flex-col items-center justify-center cursor-help transition-all hover:scale-105 hover:shadow-lg`}
                        >
                            <span className="text-[10px] font-black opacity-30 group-hover:opacity-100">{i + 1}</span>

                            {/* Hover Details */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 rounded-xl bg-slate-900 text-white text-xs invisible group-hover:visible z-50 shadow-2xl ring-1 ring-white/10 translate-y-2 group-hover:translate-y-0 transition-all opacity-0 group-hover:opacity-100">
                                <p className="font-bold mb-1 truncate">{slot.title}</p>
                                <div className="flex justify-between items-center opacity-70">
                                    <span>{slot.type.toUpperCase()}</span>
                                    <span>5.0s</span>
                                </div>
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 flex gap-3 items-start">
                <span className="material-symbols-outlined text-blue-500 text-[20px]">info</span>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                    This loop repeats exactly 60 times per hour. Any rejected slots will be replaced by the default Fallback ad to maintain loop integrity.
                </p>
            </div>
        </div>
    );
}

export default LoopPreview;
