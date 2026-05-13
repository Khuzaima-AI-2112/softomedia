import { useState, useRef } from 'react';
import { UploadCloud, Link2, Image } from 'lucide-react';
import '../../../design-tokens.css';

const DEMO_CREATIVES = [
    { id: 1, url: 'https://picsum.photos/seed/ad1/1920/1080', label: 'Product Launch' },
    { id: 2, url: 'https://picsum.photos/seed/ad2/1920/1080', label: 'Sale Promo' },
    { id: 3, url: 'https://picsum.photos/seed/ad3/1920/1080', label: 'Brand Awareness' },
    { id: 4, url: 'https://picsum.photos/seed/ad4/1920/1080', label: 'Event Announcement' },
    { id: 5, url: 'https://picsum.photos/seed/ad5/1920/1080', label: 'Seasonal Campaign' },
    { id: 6, url: 'https://picsum.photos/seed/ad6/1920/1080', label: 'New Arrival' },
];

function Step4CreativeUpload({ data, updateData, onNext, onPrev }) {
    const [selectedCreative, setSelectedCreative] = useState(data.creativeUrl || '');
    const [customUrl, setCustomUrl]               = useState('');
    const [dragActive, setDragActive]             = useState(false);
    const [error, setError]                       = useState('');
    const inputRef = useRef(null);

    const handleSelectDemo = (url) => {
        setSelectedCreative(url);
        setCustomUrl('');
        setError('');
    };

    const handleApplyUrl = () => {
        if (!customUrl.trim()) { setError('Please enter a valid URL'); return; }
        setSelectedCreative(customUrl.trim());
        setError('');
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer.files?.[0];
        if (file) simulateFileUpload(file);
    };

    const handleFileInput = (e) => {
        const file = e.target.files?.[0];
        if (file) simulateFileUpload(file);
    };

    const simulateFileUpload = (file) => {
        // In production this would upload to storage; for now use object URL as preview
        const objectUrl = URL.createObjectURL(file);
        setSelectedCreative(objectUrl);
        setError('');
    };

    const handleContinue = () => {
        if (!selectedCreative) { setError('Please select or upload a creative'); return; }
        updateData({ creativeUrl: selectedCreative });
        onNext();
    };

    const card = {
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: '1.25rem 1.375rem',
    };

    const inputStyle = {
        flex: 1, padding: '0.625rem 0.875rem',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        fontSize: 'var(--text-sm)',
        backgroundColor: 'var(--color-bg-card)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-body)',
        outline: 'none',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '5rem' }}>

            {/* Specs row */}
            <div style={{ ...card, padding: '1rem 1.25rem' }}>
                <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Creative Specifications</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                    {[
                        { icon: <Image size={18} />, label: '16:9 Ratio', sub: '1920×1080 px' },
                        { icon: <UploadCloud size={18} />, label: 'JPG / PNG', sub: 'Max 5 MB' },
                        { icon: <UploadCloud size={18} />, label: 'MP4 / WebM', sub: 'Coming soon' },
                        { icon: <Image size={18} />, label: '5 seconds', sub: 'Per slot' },
                    ].map(item => (
                        <div key={item.label} style={{
                            padding: '0.75rem', borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--color-bg-hover)', textAlign: 'center',
                        }}>
                            <span style={{ color: 'var(--color-primary)', display: 'flex', justifyContent: 'center', marginBottom: 4 }}>{item.icon}</span>
                            <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)', margin: 0 }}>{item.label}</p>
                            <p style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', margin: 0 }}>{item.sub}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Drag & drop upload zone */}
            <div
                style={{
                    ...card,
                    padding: '2rem 1.5rem',
                    border: `2px dashed ${dragActive ? 'var(--color-primary)' : 'rgba(99,102,241,0.3)'}`,
                    backgroundColor: dragActive ? 'rgba(99,102,241,0.04)' : 'var(--color-bg-card)',
                    textAlign: 'center', cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                }}
                onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Upload creative file"
                onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
            >
                <input ref={inputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFileInput} />
                <div style={{
                    width: 52, height: 52, borderRadius: 'var(--radius-full)',
                    backgroundColor: dragActive ? 'rgba(99,102,241,0.12)' : 'var(--color-bg-hover)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 0.75rem', transition: 'background-color var(--transition-fast)',
                }}>
                    <UploadCloud size={24} style={{ color: 'var(--color-primary)' }} />
                </div>
                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)', margin: 0 }}>
                    {dragActive ? 'Drop to upload' : 'Drag & drop your creative here'}
                </p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 4 }}>JPG, PNG or MP4 · Max 5 MB</p>
                <span style={{
                    display: 'inline-block', marginTop: '0.75rem',
                    padding: '4px 14px', borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)',
                    color: 'var(--color-text-secondary)',
                    backgroundColor: 'var(--color-bg-card)',
                }}>Browse files</span>
            </div>

            {/* Demo grid */}
            <div style={card}>
                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)', marginBottom: '0.75rem' }}>Or pick a demo creative</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                    {DEMO_CREATIVES.map(c => {
                        const isSelected = selectedCreative === c.url;
                        return (
                            <button
                                key={c.id}
                                onClick={() => handleSelectDemo(c.url)}
                                data-testid={`demo-creative-${c.id}`}
                                style={{
                                    position: 'relative', overflow: 'hidden',
                                    borderRadius: 'var(--radius-md)',
                                    border: 'none', padding: 0, cursor: 'pointer',
                                    outline: isSelected ? '2px solid var(--color-primary)' : '2px solid transparent',
                                    outlineOffset: 3,
                                    transition: 'outline-color var(--transition-fast)',
                                    boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                                }}
                            >
                                <div style={{ aspectRatio: '16/9', backgroundColor: 'var(--color-bg-hover)' }}>
                                    <img src={c.url} alt={c.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                </div>
                                <div style={{
                                    position: 'absolute', bottom: 0, left: 0, right: 0,
                                    padding: '0.375rem 0.5rem',
                                    background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)',
                                }}>
                                    <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: '#fff', margin: 0 }}>{c.label}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Custom URL — lower visual weight */}
            <div style={{ ...card, padding: '0.875rem 1.25rem' }}>
                <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Or enter a custom URL</p>
                <div style={{ display: 'flex', gap: '0.625rem' }}>
                    <input
                        type="url"
                        data-testid="custom-creative-url-input"
                        value={customUrl}
                        onChange={e => setCustomUrl(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleApplyUrl()}
                        placeholder="https://example.com/creative.jpg"
                        style={inputStyle}
                    />
                    <button
                        onClick={handleApplyUrl}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '0 1rem', height: 38, flexShrink: 0,
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--color-bg-card)',
                            fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)',
                            color: 'var(--color-text-primary)', cursor: 'pointer',
                            transition: 'background-color var(--transition-fast)',
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-card)'}
                    >
                        <Link2 size={14} /> Apply
                    </button>
                </div>
                {error && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-error)', marginTop: '0.375rem' }}>{error}</p>}
            </div>

            {/* Preview */}
            {selectedCreative && (
                <div style={card}>
                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)', marginBottom: '0.75rem' }}>Preview</p>
                    <div style={{ aspectRatio: '16/9', borderRadius: 'var(--radius-md)', overflow: 'hidden', maxWidth: 560, backgroundColor: 'var(--color-bg-hover)', border: '1px solid var(--color-border)' }}>
                        <img src={selectedCreative} alt="Selected creative" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: '0.5rem' }}>This is how your ad will appear on screen</p>
                </div>
            )}

            {/* Sticky footer */}
            <footer style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
                backgroundColor: 'var(--color-bg-card)',
                borderTop: '1px solid var(--color-border)',
                boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
                padding: '0.875rem 2.5rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <button
                    onClick={onPrev}
                    style={{
                        height: 38, padding: '0 1.125rem',
                        backgroundColor: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)',
                        color: 'var(--color-text-primary)', cursor: 'pointer',
                        transition: 'background-color var(--transition-fast)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-card)'}
                >← Back</button>
                <button
                    onClick={handleContinue}
                    disabled={!selectedCreative}
                    data-testid="wizard-next-step"
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                        height: 38, padding: '0 1.25rem',
                        backgroundColor: 'var(--color-primary)', color: '#fff',
                        border: 'none', borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)',
                        cursor: !selectedCreative ? 'not-allowed' : 'pointer',
                        opacity: !selectedCreative ? 0.5 : 1,
                        transition: 'all var(--transition-fast)', boxShadow: 'var(--shadow-md)',
                    }}
                    onMouseEnter={e => { if (selectedCreative) e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--color-primary)'; }}
                >Review & Confirm →</button>
            </footer>
        </div>
    );
}

export default Step4CreativeUpload;
