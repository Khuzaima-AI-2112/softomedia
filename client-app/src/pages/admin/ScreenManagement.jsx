import React, { useState, useEffect } from 'react';
import { screensAPI } from '../../services/api.js';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import '../../design-tokens.css';

/**
 * ScreenManagement - State 7: Screen Management List
 * Dense data table with search, filtering, and real-time status
 */
function ScreenManagement() {
    const [screens, setScreens] = useState([]);
    const [filteredScreens, setFilteredScreens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'offline'
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchScreens();
    }, [statusFilter, searchQuery]);

    const fetchScreens = async () => {
        setLoading(true);
        try {
            const data = await screensAPI.getManagement(
                statusFilter === 'all' ? null : statusFilter,
                searchQuery || null
            );
            setScreens(data.screens || []);
            setFilteredScreens(data.screens || []);
        } catch (error) {
            console.error('Failed to fetch screens:', error);
            setScreens([]);
            setFilteredScreens([]);
        } finally {
            setLoading(false);
        }
    };

    const formatLastSeen = (timestamp) => {
        if (!timestamp) return 'Never';
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="dashboard-ui" style={{ padding: 'var(--space-6)' }}>
            <GlassCard>
                {/* Header */}
                <div style={{ marginBottom: 'var(--space-6)' }}>
                    <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', marginBottom: 'var(--space-2)' }}>
                        Screen Management
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)' }}>
                        Manage physical hardware across all locations
                    </p>
                </div>

                {/* Filters & Search */}
                <div
                    style={{
                        display: 'flex',
                        gap: 'var(--space-4)',
                        marginBottom: 'var(--space-6)',
                        flexWrap: 'wrap',
                    }}
                >
                    {/* Search */}
                    <input
                        type="text"
                        placeholder="Search by Screen ID or Location..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            flex: 1,
                            minWidth: '250px',
                            padding: 'var(--space-3)',
                            fontSize: 'var(--text-sm)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            outline: 'none',
                            transition: 'border-color var(--transition-fast)',
                        }}
                        onFocus={(e) => {
                            e.currentTarget.style.borderColor = 'var(--color-primary)';
                        }}
                        onBlur={(e) => {
                            e.currentTarget.style.borderColor = 'var(--color-border)';
                        }}
                    />

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{
                            padding: 'var(--space-3)',
                            fontSize: 'var(--text-sm)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--color-bg-card)',
                            cursor: 'pointer',
                        }}
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="offline">Offline</option>
                        <option value="pending">Pending</option>
                    </select>

                    {/* Results Count */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            color: 'var(--color-text-secondary)',
                            fontSize: 'var(--text-sm)',
                        }}
                    >
                        {filteredScreens.length} of {screens.length} screens
                    </div>
                </div>

                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                                <th style={{ padding: 'var(--space-3)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>
                                    Unit ID
                                </th>
                                <th style={{ padding: 'var(--space-3)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>
                                    Store Name
                                </th>
                                <th style={{ padding: 'var(--space-3)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>
                                    Status
                                </th>
                                <th style={{ padding: 'var(--space-3)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>
                                    Last Heartbeat
                                </th>
                                <th style={{ padding: 'var(--space-3)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="5" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                                        Loading screens...
                                    </td>
                                </tr>
                            ) : filteredScreens.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                                        No screens found matching your filters
                                    </td>
                                </tr>
                            ) : (
                                filteredScreens.map((screen) => (
                                    <tr
                                        key={screen.screen_id}
                                        style={{
                                            borderBottom: '1px solid var(--color-border-light)',
                                            transition: 'background-color var(--transition-fast)',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                        }}
                                    >
                                        <td style={{ padding: 'var(--space-3)', fontWeight: 'var(--font-medium)', fontFamily: 'var(--font-mono)' }}>
                                            {screen.screen_id}
                                        </td>
                                        <td style={{ padding: 'var(--space-3)' }}>
                                            {screen.location || 'Unknown Location'}
                                        </td>
                                        <td style={{ padding: 'var(--space-3)' }}>
                                            <StatusBadge status={screen.status} />
                                        </td>
                                        <td style={{ padding: 'var(--space-3)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                                            {formatLastSeen(screen.last_seen)}
                                        </td>
                                        <td style={{ padding: 'var(--space-3)' }}>
                                            <button
                                                onClick={() => alert(`View details for ${screen.screen_id}`)}
                                                style={{
                                                    padding: 'var(--space-2) var(--space-3)',
                                                    fontSize: 'var(--text-xs)',
                                                    color: 'var(--color-primary)',
                                                    backgroundColor: 'transparent',
                                                    border: '1px solid var(--color-primary)',
                                                    borderRadius: 'var(--radius-md)',
                                                    cursor: 'pointer',
                                                    transition: 'all var(--transition-fast)',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                                                    e.currentTarget.style.color = 'white';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                    e.currentTarget.style.color = 'var(--color-primary)';
                                                }}
                                            >
                                                Details
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </GlassCard>
        </div>
    );
}

export default ScreenManagement;
