import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, History, PlayCircle, Unplug } from 'lucide-react';
import { dashboardAPI } from '../../services/api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import GlassCard from '../../components/GlassCard';
import HamburgerMenu from '../../components/HamburgerMenu';
import '../../design-tokens.css';

function RetailerDashboard() {
    const { user } = useAuth();
    const [systemStatus, setSystemStatus]         = useState('online');
    const [earnings, setEarnings]                 = useState(0);
    const [screenData, setScreenData]             = useState(null);
    const [loading, setLoading]                   = useState(true);
    const [isReporting, setIsReporting]           = useState(false);
    const [issueText, setIssueText]               = useState('');
    const [reportStatus, setReportStatus]         = useState('');
    const [retailers, setRetailers]               = useState([]);
    const [selectedRetailerId, setSelectedRetailerId] = useState('');

    // Store Locations state
    const [locations, setLocations]               = useState([]);
    const [newLocationName, setNewLocationName]   = useState('');
    const [newLocationAddress, setNewLocationAddress] = useState('');
    const [addingLocation, setAddingLocation]     = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        if (user?.role === 'admin') {
            import('../../services/ApiService').then(module => {
                module.default.getRetailers().then(data => {
                    const list = data.retailers || data || [];
                    setRetailers(list);
                    if (list.length > 0 && !selectedRetailerId) setSelectedRetailerId(list[0].id);
                }).catch(err => console.error(err));
            });
        } else if (user?.linked_entity_id && !selectedRetailerId) {
            setSelectedRetailerId(user.linked_entity_id);
        }
    }, [user]);

    useEffect(() => {
        if (selectedRetailerId) fetchRetailerData(selectedRetailerId);
    }, [selectedRetailerId]);

    const fetchRetailerData = async (retailerId) => {
        if (!retailerId) return;
        setLoading(true);
        try {
            const data = await dashboardAPI.getRetailerDashboard(retailerId);
            setSystemStatus(data.system_status || 'offline');
            setEarnings(data.earnings?.current_month || 0);
            setScreenData(data.screen);
            setLocations(data.locations || []);
        } catch (error) {
            console.error('Failed to fetch retailer data:', error);
            setSystemStatus('offline');
        } finally {
            setLoading(false);
        }
    };

    const handleRestartScreen = () => {
        setSystemStatus('restarting');
        setTimeout(() => setSystemStatus('online'), 3000);
    };

    const handleDisconnectSync = () => {
        if (!window.confirm('Are you sure you want to disconnect this screen from the network?')) return;
        setSystemStatus('offline');
    };

    const handleAddLocation = () => {
        if (!newLocationName.trim()) return;
        setLocations(prev => [...prev, { id: Date.now(), name: newLocationName.trim(), address: newLocationAddress.trim() }]);
        setNewLocationName('');
        setNewLocationAddress('');
        setAddingLocation(false);
    };

    const submitReport = () => {
        if (!issueText) return;
        setReportStatus('submitting');
        setTimeout(() => {
            setReportStatus('success');
            setTimeout(() => { setIsReporting(false); setIssueText(''); setReportStatus(''); }, 2000);
        }, 1000);
    };

    // ── Shared styles ────────────────────────────────────────────────────
    const card = {
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: 'var(--space-5)',
    };
    const inputStyle = {
        flex: 1, padding: '0.625rem 0.875rem',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        fontSize: 'var(--text-sm)',
        backgroundColor: 'var(--color-bg-card)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-body)', outline: 'none',
    };

    const QUICKLINKS = [
        {
            icon: <CalendarDays size={20} />,
            label: 'Schedule Calendar',
            desc: 'View and manage upcoming ad slots',
            route: '/retailer/dashboard/schedule',
        },
        {
            icon: <History size={20} />,
            label: 'Approval History',
            desc: 'Review past ad approvals and rejections',
            route: '/retailer/dashboard/approvals',
        },
        {
            icon: <PlayCircle size={20} />,
            label: 'Demo Player',
            desc: 'Preview how ads appear on your screen',
            route: '/retailer/dashboard/demo',
        },
    ];

    return (
        <>
            <HamburgerMenu />
            <div style={{ padding: 'var(--space-6)', maxWidth: 840, margin: '0 auto' }}>

                {/* Super-admin context selector */}
                {user?.role === 'admin' && (
                    <div style={{ marginBottom: 'var(--space-4)', ...card, display: 'flex', alignItems: 'center', gap: 'var(--space-3)', backgroundColor: 'rgba(99,102,241,0.06)' }}>
                        <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-primary)', flexShrink: 0 }}>Super Admin:</label>
                        <select
                            value={selectedRetailerId}
                            onChange={e => setSelectedRetailerId(e.target.value)}
                            style={{ ...inputStyle, flex: 'none', minWidth: 200 }}
                        >
                            <option value="">-- Select Retailer --</option>
                            {retailers.map(r => <option key={r.id} value={r.id}>{r.name || r.id}</option>)}
                        </select>
                    </div>
                )}

                {/* Page heading */}
                <div style={{ marginBottom: 'var(--space-6)' }}>
                    <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.2 }}>My Store</h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: 4 }}>Quick overview of your screen system</p>
                </div>

                {/* ── Hero Status Card ── */}
                <div style={{ ...card, textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                    {systemStatus === 'online' ? (
                        <>
                            <div style={{ width: 96, height: 96, backgroundColor: 'var(--color-success-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)' }}>
                                <span style={{ fontSize: '3rem', color: 'var(--color-success)' }}>✓</span>
                            </div>
                            <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-success)', margin: '0 0 var(--space-2)' }}>System Online</h2>
                            <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-1)' }}>Your screen is active</p>
                            {screenData && (
                                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: '0 0 var(--space-5)' }}>
                                    {screenData.location} · {screenData.uptime}% uptime
                                </p>
                            )}
                            {/* Destructive Disconnect Sync button */}
                            <button
                                onClick={handleDisconnectSync}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                                    padding: '0.5rem 1.125rem',
                                    border: '1.5px solid var(--color-error)',
                                    borderRadius: 'var(--radius-md)',
                                    backgroundColor: 'transparent',
                                    color: 'var(--color-error)',
                                    fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)',
                                    cursor: 'pointer',
                                    transition: 'all var(--transition-fast)',
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.backgroundColor = 'var(--color-error)';
                                    e.currentTarget.style.color = '#fff';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = 'var(--color-error)';
                                }}
                            >
                                <Unplug size={14} /> Disconnect Sync
                            </button>
                        </>
                    ) : systemStatus === 'restarting' ? (
                        <>
                            <div style={{ width: 96, height: 96, borderRadius: '50%', border: '4px solid var(--color-border)', borderTopColor: 'var(--color-primary)', animation: 'spin 0.8s linear infinite', margin: '0 auto var(--space-4)' }} />
                            <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0 }}>Restarting…</h2>
                            <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>Re-establishing connection</p>
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                        </>
                    ) : (
                        <>
                            <div style={{ width: 96, height: 96, backgroundColor: 'var(--color-error-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)' }}>
                                <span style={{ fontSize: '3rem' }}>⚠️</span>
                            </div>
                            <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-error)', margin: '0 0 var(--space-2)' }}>Needs Attention</h2>
                            <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', margin: 0 }}>Screen Offline</p>
                        </>
                    )}
                </div>

                {/* ── Earnings Card ── */}
                {systemStatus === 'online' && (
                    <div style={{ ...card, textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-3)' }}>Estimated Earnings This Month</p>
                        <p style={{ fontSize: 'var(--text-5xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-success)', fontVariantNumeric: 'tabular-nums', margin: 0 }}>
                            ${earnings.toFixed(2)}
                        </p>
                        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', marginTop: 'var(--space-5)' }}>
                            <button
                                onClick={() => window.location.href = '/dashboard/earnings'}
                                style={{
                                    padding: 'var(--space-3) var(--space-6)',
                                    fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)',
                                    color: '#fff', backgroundColor: 'var(--color-primary)',
                                    border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                    transition: 'all var(--transition-fast)', boxShadow: 'var(--shadow-sm)',
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
                            >View Earnings</button>
                            <button
                                onClick={() => navigate('/retailer/dashboard/schedule')}
                                style={{
                                    padding: 'var(--space-3) var(--space-6)',
                                    fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)',
                                    color: 'var(--color-primary)',
                                    backgroundColor: 'var(--color-bg-card)',
                                    border: '1px solid var(--color-primary)',
                                    borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                    transition: 'all var(--transition-fast)',
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.06)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-card)'}
                            >Tomorrow's Schedule</button>
                        </div>
                    </div>
                )}

                {/* ── Quicklink Cards ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                    {QUICKLINKS.map(ql => (
                        <button
                            key={ql.label}
                            onClick={() => navigate(ql.route)}
                            style={{
                                ...card, textAlign: 'left', cursor: 'pointer',
                                border: '1px solid var(--color-border)',
                                display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
                                transition: 'all var(--transition-fast)',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.borderColor = 'var(--color-primary)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.borderColor = 'var(--color-border)';
                            }}
                        >
                            <div style={{
                                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                                backgroundColor: 'rgba(99,102,241,0.1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--color-primary)', flexShrink: 0,
                            }}>
                                {ql.icon}
                            </div>
                            <div>
                                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.2 }}>{ql.label}</p>
                                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 3 }}>{ql.desc}</p>
                            </div>
                        </button>
                    ))}
                </div>

                {/* ── Store Locations ── */}
                <div style={{ ...card, marginBottom: 'var(--space-6)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0 }}>Store Locations</h3>
                        <button
                            onClick={() => setAddingLocation(v => !v)}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                padding: '4px 12px',
                                border: '1px solid var(--color-primary)',
                                borderRadius: 'var(--radius-md)',
                                backgroundColor: 'transparent',
                                color: 'var(--color-primary)',
                                fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)',
                                cursor: 'pointer', transition: 'all var(--transition-fast)',
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.07)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            {addingLocation ? '✕ Cancel' : '+ Add Location'}
                        </button>
                    </div>

                    {/* Inline add row */}
                    {addingLocation && (
                        <div style={{
                            display: 'flex', gap: 'var(--space-3)', alignItems: 'center',
                            padding: 'var(--space-3)', marginBottom: 'var(--space-4)',
                            backgroundColor: 'var(--color-bg-hover)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border-light)',
                        }}>
                            <input
                                type="text"
                                placeholder="Location name"
                                value={newLocationName}
                                onChange={e => setNewLocationName(e.target.value)}
                                style={inputStyle}
                            />
                            <input
                                type="text"
                                placeholder="Address (optional)"
                                value={newLocationAddress}
                                onChange={e => setNewLocationAddress(e.target.value)}
                                style={inputStyle}
                            />
                            <button
                                onClick={handleAddLocation}
                                disabled={!newLocationName.trim()}
                                style={{
                                    flexShrink: 0, padding: '0.625rem 1rem',
                                    backgroundColor: 'var(--color-primary)', color: '#fff',
                                    border: 'none', borderRadius: 'var(--radius-md)',
                                    fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)',
                                    cursor: newLocationName.trim() ? 'pointer' : 'not-allowed',
                                    opacity: newLocationName.trim() ? 1 : 0.5,
                                    transition: 'all var(--transition-fast)',
                                }}
                                onMouseEnter={e => { if (newLocationName.trim()) e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'; }}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
                            >Add</button>
                        </div>
                    )}

                    {/* Locations list */}
                    {locations.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            {locations.map(loc => (
                                <div key={loc.id} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: 'var(--space-3) var(--space-4)',
                                    backgroundColor: 'var(--color-bg-hover)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-border-light)',
                                }}>
                                    <div>
                                        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)', margin: 0 }}>{loc.name}</p>
                                        {loc.address && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>{loc.address}</p>}
                                    </div>
                                    <span style={{
                                        fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)',
                                        padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                        backgroundColor: 'var(--color-success-light)', color: '#03543f',
                                    }}>Active</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: 'var(--space-5) 0' }}>No locations added yet</p>
                    )}
                </div>

                {/* ── Earnings breakdown ── */}
                <div style={{ ...card, marginBottom: 'var(--space-6)' }}>
                    <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: '0 0 var(--space-4)' }}>💰 Your Earnings</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                        {[
                            { label: 'Total Earned', value: `$${(earnings || 0).toFixed(2)}`, accent: 'var(--color-success)' },
                            { label: 'Profit Share', value: '40%', accent: 'var(--color-primary)' },
                            { label: 'Impressions Today', value: String(screenData?.impressions_today || 0), accent: 'var(--color-text-primary)' },
                        ].map(({ label, value, accent }) => (
                            <div key={label} style={{
                                padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-hover)',
                                borderRadius: 'var(--radius-md)', borderLeft: `4px solid ${accent}`,
                            }}>
                                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'var(--font-semibold)' }}>{label}</p>
                                <p style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: accent, margin: 0 }}>{value}</p>
                            </div>
                        ))}
                    </div>
                    <div style={{ padding: 'var(--space-4)', backgroundColor: 'rgba(99,102,241,0.06)', borderRadius: 'var(--radius-md)' }}>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-2)' }}>How it works</p>
                        <p style={{ fontSize: 'var(--text-sm)', lineHeight: '1.6', color: 'var(--color-text-primary)', margin: 0 }}>
                            You earn 40% of advertising revenue generated from your screen. Earnings are calculated monthly and paid out automatically.
                        </p>
                    </div>
                </div>

                {/* ── Troubleshoot (offline) ── */}
                {systemStatus === 'offline' && (
                    <div style={{ ...card, marginBottom: 'var(--space-6)' }}>
                        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-5)', textAlign: 'center' }}>Needs Action</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {[
                                { emoji: '📶', title: 'Did the store lose Wi-Fi?', sub: 'Tap to see Wi-Fi troubleshooting steps', onClick: () => alert('Checklist:\n1. Check Wi-Fi\n2. Verify router\n3. Test other devices') },
                                { emoji: '🔄', title: 'Restart System', sub: 'Attempt to reestablish remote connection', onClick: handleRestartScreen },
                            ].map(item => (
                                <button key={item.title} onClick={item.onClick} style={{
                                    padding: 'var(--space-5)', textAlign: 'left',
                                    backgroundColor: 'var(--color-bg-hover)',
                                    border: '1.5px solid var(--color-border)',
                                    borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                    transition: 'all var(--transition-fast)',
                                }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-bg-card)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'; }}
                                >
                                    <div style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-2)' }}>{item.emoji}</div>
                                    <p style={{ fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)', margin: 0 }}>{item.title}</p>
                                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>{item.sub}</p>
                                </button>
                            ))}
                            <button onClick={() => setIsReporting(true)} style={{
                                padding: 'var(--space-5)', textAlign: 'left',
                                backgroundColor: 'var(--color-primary)', color: '#fff',
                                border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                            }}>
                                <div style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-2)' }}>📝</div>
                                <p style={{ fontWeight: 'var(--font-semibold)', margin: 0 }}>Report Issue to Support</p>
                                <p style={{ fontSize: 'var(--text-sm)', opacity: 0.9, marginTop: 'var(--space-1)' }}>Our team will contact you within 1 hour</p>
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Demo toggle ── */}
                <div style={{ textAlign: 'center', marginTop: 'var(--space-6)' }}>
                    <button
                        onClick={() => setSystemStatus(s => s === 'online' ? 'offline' : 'online')}
                        style={{
                            padding: 'var(--space-2) var(--space-5)',
                            fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
                            backgroundColor: 'transparent',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)', cursor: 'pointer',
                        }}
                    >Toggle Status (Demo)</button>
                </div>
            </div>

            {/* ── Report Issue modal ── */}
            {isReporting && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ ...card, width: '100%', maxWidth: 400, margin: 'var(--space-4)' }}>
                        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: '0 0 var(--space-4)' }}>Report an Issue</h3>
                        <textarea
                            value={issueText}
                            onChange={e => setIssueText(e.target.value)}
                            placeholder="Describe your issue…"
                            disabled={reportStatus !== ''}
                            style={{
                                width: '100%', height: 100, padding: 'var(--space-3)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--text-sm)', backgroundColor: 'var(--color-bg-hover)',
                                color: 'var(--color-text-primary)', resize: 'vertical',
                                fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box',
                            }}
                        />
                        {reportStatus === 'success' && (
                            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-success)', fontWeight: 'var(--font-semibold)', marginTop: 'var(--space-2)' }}>Report submitted successfully!</p>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                            <button onClick={() => setIsReporting(false)} disabled={reportStatus !== ''} style={{ padding: '0.5rem 1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-card)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>Cancel</button>
                            <button onClick={submitReport} disabled={!issueText || reportStatus !== ''} style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>
                                {reportStatus === 'submitting' ? 'Submitting…' : 'Submit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default RetailerDashboard;
