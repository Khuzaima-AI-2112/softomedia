import React, { useState } from 'react';

const Step2ScheduleUpload = ({ data, updateData, onNext, onPrev }) => {
    const [dragActive, setDragActive] = useState(false);

    const timeSlots = [
        { time: '08:00 - 09:00', availability: 80, status: 'Available' },
        { time: '09:00 - 10:00', availability: 45, status: 'Limited' },
        { time: '10:00 - 11:00', availability: 0, status: 'Sold Out' },
        { time: '11:00 - 12:00', availability: 100, status: 'Available' },
        { time: '12:00 - 13:00', availability: 90, status: 'Available' },
        { time: '13:00 - 14:00', availability: 60, status: 'Available' },
        { time: '14:00 - 15:00', availability: 30, status: 'Limited' },
        { time: '15:00 - 16:00', availability: 75, status: 'Available' },
    ];

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            updateData({ creativeFile: e.dataTransfer.files[0].name });
        }
    };

    const toggleSlot = (slot) => {
        const current = data.selectedSlots;
        if (current.includes(slot)) {
            updateData({ selectedSlots: current.filter(s => s !== slot) });
        } else {
            updateData({ selectedSlots: [...current, slot] });
        }
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mb-24">
            <div className="xl:col-span-8 flex flex-col gap-8">
                {/* Duration Section */}
                <section className="p-8 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="material-symbols-outlined text-primary">calendar_month</span>
                        <h2 className="text-xl font-bold">Campaign Duration</h2>
                    </div>

                    <div className="flex flex-col md:flex-row gap-8 justify-between">
                        {/* Mock Calendar Grid */}
                        <div className="flex-1 max-w-sm mx-auto">
                            <div className="text-center font-bold mb-4">October 2023</div>
                            <div className="grid grid-cols-7 gap-1 text-center text-sm">
                                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => <div key={d} className="py-2 text-slate-400 font-medium">{d}</div>)}
                                {Array.from({ length: 31 }).map((_, i) => {
                                    const day = i + 1;
                                    const isSelected = day >= 5 && day <= 12;
                                    return (
                                        <div
                                            key={i}
                                            className={`py-2 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-primary text-white font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                                                }`}
                                        >
                                            {day}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex-1 flex flex-col justify-center bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-dashed border-slate-200 dark:border-slate-700">
                            <h3 className="text-sm font-bold text-slate-500 uppercase mb-2">Selected Range</h3>
                            <div className="text-2xl font-black text-primary mb-1">8 Days</div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Oct 05 - Oct 12, 2023</p>
                        </div>
                    </div>
                </section>

                {/* Time Slot Section */}
                <section className="p-8 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="material-symbols-outlined text-primary">schedule</span>
                        <h2 className="text-xl font-bold">Daily Time Slots</h2>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {timeSlots.map((slot, i) => {
                            const isSelected = data.selectedSlots.includes(slot.time);
                            const isSoldOut = slot.status === 'Sold Out';
                            return (
                                <button
                                    key={i}
                                    disabled={isSoldOut}
                                    onClick={() => toggleSlot(slot.time)}
                                    className={`relative flex flex-col gap-2 p-3 text-left rounded-lg border-2 transition-all ${isSelected
                                        ? 'border-primary bg-primary/5'
                                        : isSoldOut
                                            ? 'border-slate-100 dark:border-slate-800 opacity-50 cursor-not-allowed'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'
                                        }`}
                                >
                                    <span className="text-sm font-bold">{slot.time}</span>
                                    <div className="flex flex-col gap-1.5">
                                        <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${isSelected ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
                                                style={{ width: `${slot.availability}%` }}
                                            />
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase ${isSoldOut ? 'text-red-500' : 'text-slate-400'}`}>
                                            {slot.status}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* Creative Upload Section */}
                <section className="p-8 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="material-symbols-outlined text-primary">cloud_upload</span>
                        <h2 className="text-xl font-bold">Upload Creative</h2>
                    </div>

                    <div
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => updateData({ creativeFile: 'demo-ad.mp4' })}
                        className={`relative group h-48 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${dragActive ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-800 hover:border-primary/50'
                            } ${data.creativeFile ? 'border-emerald-500 bg-emerald-500/5' : ''}`}
                    >
                        <span className={`material-symbols-outlined text-4xl mb-4 ${data.creativeFile ? 'text-emerald-500' : 'group-hover:text-primary transition-colors'}`}>
                            {data.creativeFile ? 'check_circle' : 'cloud_upload'}
                        </span>
                        <p className="font-bold text-lg mb-1">{data.creativeFile || 'Click or drag file to upload'}</p>
                        <p className="text-xs text-slate-500">MP4, JPG, PNG up to 50MB (1080x1920)</p>
                    </div>
                </section>
            </div>

            {/* Sticky Sidebar Summary */}
            <aside className="xl:col-span-4">
                <div className="sticky top-24 flex flex-col gap-6 p-8 rounded-xl bg-slate-900 text-white shadow-2xl border border-white/10 ring-1 ring-white/5">
                    <h3 className="text-xl font-bold pb-4 border-b border-white/10">Booking Summary</h3>

                    <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                            <span className="text-sm text-slate-400">Selected Screens</span>
                            <span className="font-bold">{data.selectedScreens.length} Units</span>
                        </div>
                        <div className="flex justify-between items-start">
                            <span className="text-sm text-slate-400">Duration</span>
                            <span className="font-bold text-right">8 Days<br /><span className="text-[10px] font-normal opacity-60">Oct 05 - Oct 12</span></span>
                        </div>
                        <div className="flex justify-between items-start">
                            <span className="text-sm text-slate-400">Time Slots</span>
                            <span className="font-bold text-right">{data.selectedSlots.length} Slots/Day</span>
                        </div>
                        <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                            <span className="text-sm text-slate-400 font-medium">Total Cost</span>
                            <div className="flex flex-col items-end">
                                <span className="text-3xl font-black text-primary">$720.00</span>
                                <span className="text-[10px] opacity-40">Inclusive of VAT</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onNext}
                        disabled={!data.creativeFile || data.selectedSlots.length === 0}
                        data-testid="proceed-to-review"
                        className="w-full py-4 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold transition-all flex items-center justify-center gap-2 group shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                    >
                        <span>Proceed to Review</span>
                        <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">payments</span>
                    </button>

                    <button
                        onClick={onPrev}
                        className="w-full py-2 text-slate-400 hover:text-white text-sm font-medium transition-colors"
                    >
                        Back to Selection
                    </button>
                </div>
            </aside>
        </div>
    );
};

export default Step2ScheduleUpload;
