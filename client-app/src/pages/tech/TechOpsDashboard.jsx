import { useState, useEffect } from 'react';
import { Monitor, Wifi, WifiOff, Search, RotateCcw, Terminal } from 'lucide-react';
import apiClient from '../../services/api';
import '../../design-tokens.css';

function TechOpsDashboard() {
    const [stats, setStats]           = useState({ total: 0, online: 0, offline: 0, screens: [] });
    const [searchQuery, setSearchQuery] = useState('');
    const [hoveredRow, setHoveredRow] = useState(null);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchStatus = async () => {
        try {
            const data = await apiClient.get('/api/monitoring/status');
            const onlineCount  = data.screens.filter(s => s.status?.toUpperCase() === 'ONLINE').length;
            const offlineCount = data.screens.filter(s => s.status?.toUpperCase() === 'OFFLINE').length;
            setStats({ ...data, online: onlineCount, offline: offlineCount });
        } catch (e) { console.error('Failed to fetch screen status', e); }
    };

    const healthPct = stats.total > 0 ? Math.round((stats.online / stats.total) * 100) : 0;
    const healthColor =
        healthPct >= 80 ? 'var(--color-success)'
        : healthPct >= 50 ? '#d97706'
        : 'var(--color-error)';

    const filteredScreens = stats.screens.filter(s =>
        !searchQuery || String(s.id).toLowerCase().includes(searchQuery.toLowerCase())
    );

    const card = {
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: 'var(--space-5)',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
    };

    const KPI_CARDS = [
        {
            label: 'Managed Fleet',
            value: stats.total,
            sub: 'Active Screen Registry',
            icon: <Monitor size={15} />,
            iconColor: 'var(--color-primary)',
            iconBg: 'rgba(99,102,241,0.1)',
            valueColor: 'var(--color-text-primary)',
            pulse: false,
        },
        {
            label: 'Currently Online',
            value: stats.online,
            sub: 'Heartbeat active (< 2m)',
            icon: <Wifi size={15} />,
            iconColor: 'var(--color-success)',
            iconBg: 'var(--color-success-light)',
            valueColor: 'var(--color-success)',
            pulse: true,
        },
        {
            label: 'Connection Lost',
            value: stats.offline,
            sub: 'Requires immediate audit',
            icon: <WifiOff size={15} />,
            iconColor: 'var(--color-error)',
            iconBg: 'var(--color-error-light)',
            valueColor: 'var(--color-error)',
            pulse: false,
        },
    ];

    return (
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

            <style>{`
                @keyframes pulse-dot {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50%       { opacity: 0.4; transform: scale(0.7); }
                }
                .pulse-dot {
                    width: 8px; height: 8px; border-radius: 50%;
                    background-color: var(--color-success);
                    animation: pulse-dot 1.6s ease-in-out infinite;
                    flex-shrink: 0;
                }
            `}</style>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-4)', paddingTop: 'var(--space-2)' }}>
                <div>
                    <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.2 }}>Technical Operations</h1>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>Network-wide screen health and diagnostic tracking</p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-tertiary)', margin: '0 0 2px' }}>Global Health</p>
                    <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: healthColor, margin: 0, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{healthPct}%</p>
                </div>
            </div>

            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
                {KPI_CARDS.map(kpi => (
                    <div key={kpi.label} style={card}>
                        {/* Label row + icon badge top-right */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)' }}>{kpi.label}</span>
                                {/* Pulse dot sits right below label for Online card */}
                                {kpi.pulse && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <span className="pulse-dot" />
                                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)' }}>Live</span>
                                    </div>
                                )}
                            </div>
                            <span style={{
                                width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                                backgroundColor: kpi.iconBg, color: kpi.iconColor,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>{kpi.icon}</span>
                        </div>
                        {/* Big number */}
                        <p style={{ fontSize: 'var(--text-4xl)', fontWeight: 900, color: kpi.valueColor, margin: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{kpi.value}</p>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>{kpi.sub}</p>
                    </div>
                ))}
            </div>

            {/* Screen Inventory */}
            <div style={{
                backgroundColor: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-sm)',
                overflow: 'hidden',
            }}>
                {/* Table header bar */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: 'var(--space-4) var(--space-5)',
                    borderBottom: '1px solid var(--color-border)',
                }}>
                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0 }}>Screen Inventory &amp; Health</p>
                    <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', pointerEvents: 'none', display: 'flex' }}>
                            <Search size={13} />
                        </span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search screen ID…"
                            style={{
                                paddingLeft: 28, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--text-xs)',
                                backgroundColor: 'var(--color-bg-hover)',
                                color: 'var(--color-text-primary)',
                                outline: 'none', width: 180,
                                fontFamily: 'var(--font-body)',
                            }}
                        />
                    </div>
                </div>

                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-hover)' }}>
                                {['Screen ID', 'Status', 'Last Sync', ''].map((h, i) => (
                                    <th key={i} style={{
                                        padding: 'var(--space-3) var(--space-5)',
                                        fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)',
                                        textTransform: 'uppercase', letterSpacing: '0.08em',
                                        color: 'var(--color-text-tertiary)',
                                        textAlign: i === 3 ? 'right' : 'left',
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredScreens.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ padding: 'var(--space-12) var(--space-5)', textAlign: 'center' }}>
                                        <Monitor size={32} style={{ color: 'var(--color-border)', margin: '0 auto var(--space-2)' }} />
                                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: 0, fontStyle: 'italic' }}>
                                            {searchQuery ? 'No screens match your search.' : 'No screens detected in the registry.'}
                                        </p>
                                    </td>
                                </tr>
                            ) : filteredScreens.map((screen, idx) => {
                                const isOnline = screen.status?.toUpperCase() === 'ONLINE';
                                const isHovered = hoveredRow === screen.id;
                                return (
                                    <tr
                                        key={screen.id}
                                        onMouseEnter={() => setHoveredRow(screen.id)}
                                        onMouseLeave={() => setHoveredRow(null)}
                                        style={{
                                            borderBottom: idx !== filteredScreens.length - 1 ? '1px solid var(--color-border-light)' : 'none',
                                            backgroundColor: isHovered ? 'var(--color-bg-hover)' : 'transparent',
                                            transition: 'background-color var(--transition-fast)',
                                        }}
                                    >
                                        {/* Screen ID */}
                                        <td style={{ padding: 'var(--space-3) var(--space-5)', fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                                            {screen.id}
                                        </td>
                                        {/* Status badge */}
                                        <td style={{ padding: 'var(--space-3) var(--space-5)' }}>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                                padding: '2px 9px', borderRadius: 'var(--radius-full)',
                                                fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)',
                                                backgroundColor: isOnline ? 'var(--color-success-light)' : 'var(--color-error-light)',
                                                color: isOnline ? 'var(--color-success)' : 'var(--color-error)',
                                                border: `1px solid ${isOnline ? 'var(--color-success)' : 'var(--color-error)'}40`,
                                            }}>
                                                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: isOnline ? 'var(--color-success)' : 'var(--color-error)', flexShrink: 0 }} />
                                                {isOnline ? 'Online' : 'Offline'}
                                            </span>
                                        </td>
                                        {/* Last Sync */}
                                        <td style={{ padding: 'var(--space-3) var(--space-5)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                                            {screen.last_seen
                                                ? new Date(screen.last_seen).toLocaleTimeString()
                                                : <span style={{ fontStyle: 'italic', color: 'var(--color-border)' }}>Never</span>}
                                        </td>
                                        {/* Actions */}
                                        <td style={{ padding: 'var(--space-3) var(--space-5)', textAlign: 'right' }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                {[{ Icon: RotateCcw, label: 'Restart' }, { Icon: Terminal, label: 'Terminal' }].map(({ Icon, label }) => (
                                                    <button
                                                        key={label}
                                                        title={label}
                                                        aria-label={label}
                                                        style={{
                                                            padding: 6, borderRadius: 'var(--radius-sm)',
                                                            border: 'none', backgroundColor: 'transparent',
                                                            color: 'var(--color-text-tertiary)', cursor: 'pointer',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            transition: 'all var(--transition-fast)',
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.1)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
                                                    >
                                                        <Icon size={15} />
                                                    </button>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer count */}
                {filteredScreens.length > 0 && (
                    <div style={{
                        padding: 'var(--space-3) var(--space-5)',
                        borderTop: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-bg-hover)',
                    }}>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>
                            Showing <strong style={{ color: 'var(--color-text-secondary)' }}>{filteredScreens.length}</strong> of{' '}
                            <strong style={{ color: 'var(--color-text-secondary)' }}>{stats.total}</strong> screen{stats.total !== 1 ? 's' : ''}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default TechOpsDashboard;
