/**
 * Step4CreativeUpload - Upload or select campaign creative
 * Part of the advertiser campaign booking wizard
 */

import { useState } from 'react';
import GlassCard from '../../../components/GlassCard';

// Demo creative URLs for quick selection
const DEMO_CREATIVES = [
    { id: 1, url: 'https://picsum.photos/seed/ad1/1920/1080', label: 'Product Launch' },
    { id: 2, url: 'https://picsum.photos/seed/ad2/1920/1080', label: 'Sale Promo' },
    { id: 3, url: 'https://picsum.photos/seed/ad3/1920/1080', label: 'Brand Awareness' },
    { id: 4, url: 'https://picsum.photos/seed/ad4/1920/1080', label: 'Event Announcement' },
    { id: 5, url: 'https://picsum.photos/seed/ad5/1920/1080', label: 'Seasonal Campaign' },
    { id: 6, url: 'https://picsum.photos/seed/ad6/1920/1080', label: 'New Arrival' }
];

function Step4CreativeUpload({ data, updateData, onNext, onPrev }) {
    const [selectedCreative, setSelectedCreative] = useState(data.creativeUrl || '');
    const [customUrl, setCustomUrl] = useState('');
    const [error, setError] = useState('');

    const handleSelectDemo = (url) => {
        setSelectedCreative(url);
        setCustomUrl('');
        setError('');
    };

    const handleCustomUrl = () => {
        if (!customUrl) {
            setError('Please enter a valid URL');
            return;
        }
        setSelectedCreative(customUrl);
        setError('');
    };

    const handleContinue = () => {
        if (!selectedCreative) {
            setError('Please select or upload a creative');
            return;
        }
        updateData({ creativeUrl: selectedCreative });
        onNext();
    };

    return (
        <div className="space-y-6">
            {/* Step Header */}
            <GlassCard className="border-l-4 border-l-primary">
                <div className="flex items-center gap-4">
                    <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-2xl">image</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Step 4: Upload Creative</h2>
                        <p className="text-slate-500 dark:text-slate-400">
                            Select or upload your advertisement creative (1920×1080 recommended)
                        </p>
                    </div>
                </div>
            </GlassCard>

            {/* Creative Requirements */}
            <GlassCard>
                <h3 className="font-bold text-lg mb-4">Creative Specifications</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-center">
                        <span className="material-symbols-outlined text-2xl text-primary mb-1">aspect_ratio</span>
                        <p className="text-sm font-medium">16:9 Ratio</p>
                        <p className="text-xs text-slate-500">1920×1080 px</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-center">
                        <span className="material-symbols-outlined text-2xl text-primary mb-1">timer</span>
                        <p className="text-sm font-medium">5 Seconds</p>
                        <p className="text-xs text-slate-500">Per slot</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-center">
                        <span className="material-symbols-outlined text-2xl text-primary mb-1">image</span>
                        <p className="text-sm font-medium">JPG/PNG</p>
                        <p className="text-xs text-slate-500">Max 5MB</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-center">
                        <span className="material-symbols-outlined text-2xl text-primary mb-1">movie</span>
                        <p className="text-sm font-medium">MP4/WebM</p>
                        <p className="text-xs text-slate-500">Coming soon</p>
                    </div>
                </div>
            </GlassCard>

            {/* Demo Creatives */}
            <GlassCard>
                <h3 className="font-bold text-lg mb-4">Select Demo Creative</h3>
                <p className="text-sm text-slate-500 mb-4">
                    Choose from our demo creatives for testing purposes
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {DEMO_CREATIVES.map(creative => (
                        <button
                            key={creative.id}
                            onClick={() => handleSelectDemo(creative.url)}
                            data-testid={`demo-creative-${creative.id}`}
                            className={`
                                relative group overflow-hidden rounded-xl border-2 transition-all
                                ${selectedCreative === creative.url
                                    ? 'border-primary ring-4 ring-primary/20'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'}
                            `}
                        >
                            <div className="aspect-video bg-slate-100 dark:bg-slate-800">
                                <img
                                    src={creative.url}
                                    alt={creative.label}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className={`
                                absolute inset-0 flex items-center justify-center transition-opacity
                                ${selectedCreative === creative.url
                                    ? 'bg-primary/20'
                                    : 'bg-black/0 group-hover:bg-black/20'}
                            `}>
                                {selectedCreative === creative.url && (
                                    <div className="size-12 rounded-full bg-primary flex items-center justify-center shadow-lg">
                                        <span className="material-symbols-outlined text-white text-2xl">check</span>
                                    </div>
                                )}
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                                <p className="text-white text-sm font-medium">{creative.label}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </GlassCard>

            {/* Custom URL */}
            <GlassCard>
                <h3 className="font-bold text-lg mb-4">Or Enter Custom URL</h3>
                <div className="flex gap-3">
                    <input
                        type="url"
                        data-testid="custom-creative-url-input"
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        placeholder="https://example.com/your-creative.jpg"
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                    />
                    <button
                        data-testid="btn-upload-creative"
                        onClick={handleCustomUrl}
                        className="px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-colors flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined">link</span>
                        Apply
                    </button>
                </div>
                {error && (
                    <p className="text-rose-500 text-sm mt-2">{error}</p>
                )}
            </GlassCard>

            {/* Preview */}
            {selectedCreative && (
                <GlassCard>
                    <h3 className="font-bold text-lg mb-4">Preview</h3>
                    <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden max-w-2xl mx-auto shadow-2xl">
                        <img
                            src={selectedCreative}
                            alt="Selected creative preview"
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <p className="text-center text-sm text-slate-500 mt-4">
                        This is how your ad will appear on screen
                    </p>
                </GlassCard>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4">
                <button
                    onClick={onPrev}
                    className="px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-colors flex items-center gap-2"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                    Back
                </button>
                <button
                    onClick={handleContinue}
                    disabled={!selectedCreative}
                    data-testid="wizard-next-step"
                    className="px-8 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/25 hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                    Continue
                    <span className="material-symbols-outlined">arrow_forward</span>
                </button>
            </div>
        </div>
    );
}

export default Step4CreativeUpload;
