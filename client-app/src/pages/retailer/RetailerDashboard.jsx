import React, { useState } from 'react';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import SupportTicketModal from '../../components/SupportTicketModal';

function RetailerDashboard() {
    const [isSyncActive, setIsSyncActive] = useState(true);
    const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

    const toggleSync = () => setIsSyncActive(!isSyncActive);

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#111827' }}>Retailer Command: Northside Market</h1>
                    <p style={{ color: '#6b7280' }}>Aisle 4 & 5 Screen Health • Managed by Store Owner</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={() => setIsSupportModalOpen(true)}
                        style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', backgroundColor: 'white', border: '1px solid #d1d5db', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                        Report Issue
                    </button>
                    <button
                        onClick={toggleSync}
                        style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', backgroundColor: isSyncActive ? '#ef4444' : '#10b981', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                        {isSyncActive ? 'Disconnect Sync' : 'Re-establish Sync'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <GlassCard>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontWeight: '600' }}>Network Connectivity</span>
                        <StatusBadge status={isSyncActive ? 'Online' : 'Offline'} />
                    </div>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {isSyncActive ? 'Secure handshake active with SoftoMedia-Cloud' : 'Connection lost. Please check Wi-Fi or contact support.'}
                    </p>
                </GlassCard>
                <GlassCard>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontWeight: '600' }}>Active Loop Rate</span>
                        <span style={{ color: '#10b981', fontWeight: 'bold' }}>12 slots/m</span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Sync interval: 5 seconds per ad transition</p>
                </GlassCard>
            </div>

            <GlassCard>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Local Asset Cache</h3>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    {['demo_ad_1.png', 'demo_ad_2.png', 'demo_ad_3.png'].map(asset => (
                        <div key={asset} style={{ flex: 1, padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', textAlign: 'center' }}>
                            <div style={{ height: '80px', backgroundColor: '#f3f4f6', borderRadius: '0.25rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span className="material-symbols-outlined" style={{ color: '#9ca3af' }}>image</span>
                            </div>
                            <p style={{ fontSize: '0.75rem', color: '#4b5563', overflow: 'hidden', textOverflow: 'ellipsis' }}>{asset}</p>
                        </div>
                    ))}
                </div>
            </GlassCard>

            {isSupportModalOpen && <SupportTicketModal onClose={() => setIsSupportModalOpen(false)} />}
        </div>
    );
}

export default RetailerDashboard;
