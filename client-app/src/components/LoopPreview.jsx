
const EMPTY_TITLE = 'Fallback / Empty Slot';

// What a Slot shows as: its allocated category, or Fallback Content.
const CATEGORIES = {
    paid: { label: 'Paid', legend: 'Paid Ad', dot: 'bg-primary', tile: 'bg-primary border-primary' },
    retailer: { label: 'Retailer', legend: 'Retailer', dot: 'bg-emerald-500', tile: 'bg-emerald-500 border-emerald-500' },
    internal: { label: 'Internal', legend: 'Internal', dot: 'bg-sky-500', tile: 'bg-sky-500 border-sky-500' },
    fallback: { label: 'Fallback', legend: 'Fallback', dot: 'bg-slate-300', tile: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
};

// A generated Slot keeps its allocated category; it plays Fallback Content when nothing eligible fills it.
const categoryOf = (slot) => CATEGORIES[
    slot.is_fallback || !CATEGORIES[slot.allocated_category] ? 'fallback' : slot.allocated_category
];
const titleOf = (slot) => slot.title || slot.asset_name || EMPTY_TITLE;

function LoopPreview({ slots = [] }) {
    const titles = [...new Set(slots.map(titleOf))];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 id="loop-breakdown-title" className="text-sm font-bold text-slate-500 uppercase tracking-wider">60-Second Loop Breakdown</h4>
                <div className="flex items-center gap-4 text-xs font-medium">
                    {Object.values(CATEGORIES).map(category => (
                        <div key={category.label} className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${category.dot}`}></div>
                            <span>{category.legend}</span>
                        </div>
                    ))}
                </div>
            </div>

            <ol aria-labelledby="loop-breakdown-title" className="grid grid-cols-6 md:grid-cols-12 gap-2">
                {slots.map((slot, i) => {
                    const category = categoryOf(slot);
                    return (
                        <li
                            key={i}
                            aria-label={`Slot ${i + 1}: ${titleOf(slot)}, ${category.label}`}
                            className={`group relative aspect-square rounded-lg border-2 ${category.tile} flex flex-col items-center justify-center cursor-help transition-all hover:scale-105 hover:shadow-lg`}
                        >
                            <span className="text-[10px] font-black opacity-30 group-hover:opacity-100">{i + 1}</span>

                            {/* Hover Details */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 rounded-xl bg-slate-900 text-white text-xs invisible group-hover:visible z-50 shadow-2xl ring-1 ring-white/10 translate-y-2 group-hover:translate-y-0 transition-all opacity-0 group-hover:opacity-100">
                                <p className="font-bold mb-1 truncate">{titleOf(slot)}</p>
                                <div className="flex justify-between items-center opacity-70">
                                    <span>{category.label.toUpperCase()}</span>
                                    <span>5.0s</span>
                                </div>
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
                            </div>
                        </li>
                    );
                })}
            </ol>

            {titles.length > 0 && (
                <div className="mt-4 space-y-2">
                    <h5 id="loop-items-title" className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Loop Items</h5>
                    <ul aria-labelledby="loop-items-title" className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                        {titles.map(title => {
                            const matching = slots.filter(slot => titleOf(slot) === title);
                            const category = categoryOf(matching[0]);
                            return (
                                <li key={title} className="py-2 flex justify-between items-center text-slate-700 dark:text-slate-300">
                                    <span className="font-semibold">{title}</span>
                                    <span className="text-slate-400 font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                        {category.label.toUpperCase()} &bull; {matching.length} slot(s)
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

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
