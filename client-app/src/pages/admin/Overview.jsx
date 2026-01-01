import React from 'react';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';

function AdminOverview() {
    const screens = [
        { id: 'demo-screen-01', location: 'Aisle 4 (Beverages)', status: 'Online', health: '100%', lastSync: '2m ago' },
        { id: 'demo-screen-02', location: 'Aisle 12 (Frozen)', status: 'Online', health: '98%', lastSync: '5m ago' },
        { id: 'demo-screen-03', location: 'Produce Endcap', status: 'Warning', health: '45%', lastSync: '1h ago' },
    ];

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#111827' }}>Global Grocery Control</h1>
                <p style={{ color: '#6b7280' }}>Infrastructure overview across all retail locations</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <GlassCard>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Total Active Screens</p>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#6366f1' }}>1,240</p>
                </GlassCard>
                <GlassCard>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Network Latency</p>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>24ms</p>
                </GlassCard>
                <GlassCard>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Active Ad Campaigns</p>
                    <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>452</p>
                </GlassCard>
            </div>

            <GlassCard>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Screen Infrastructure</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                                <th style={{ padding: '1rem 0', color: '#6b7280', fontWeight: '600' }}>Screen ID</th>
                                <th style={{ padding: '1rem 0', color: '#6b7280', fontWeight: '600' }}>Location</th>
                                <th style={{ padding: '1rem 0', color: '#6b7280', fontWeight: '600' }}>Status</th>
                                <th style={{ padding: '1rem 0', color: '#6b7280', fontWeight: '600' }}>Health</th>
                                <th style={{ padding: '1rem 0', color: '#6b7280', fontWeight: '600' }}>Last Sync</th>
                            </tr>
                        </thead>
                        <tbody>
                            {screens.map(screen => (
                                <tr key={screen.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '1rem 0', fontWeight: '500' }}>{screen.id}</td>
                                    <td style={{ padding: '1rem 0', color: '#4b5563' }}>{screen.location}</td>
                                    <td style={{ padding: '1rem 0' }}>
                                        <StatusBadge status={screen.status} />
                                    </td>
                                    <td style={{ padding: '1rem 0' }}>{screen.health}</td>
                                    <td style={{ padding: '1rem 0', color: '#9ca3af', fontSize: '0.875rem' }}>{screen.lastSync}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </GlassCard>
        </div>
    );
}

export default AdminOverview;
