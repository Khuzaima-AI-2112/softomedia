import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardAPI } from '../../services/api';
import CampaignUploadDrawer from '../../components/CampaignUploadDrawer';
import ScheduleTimeline from '../../components/ScheduleTimeline';
import HamburgerMenu from '../../components/HamburgerMenu';

function BrandDashboard() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState(null);
    const [error, setError] = useState(null);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [showTimeline, setShowTimeline] = useState(false);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                setLoading(true);
                const data = await dashboardAPI.getBrandDashboard(user?.linked_entity_id);
                setDashboardData(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (user?.linked_entity_id) {
            fetchDashboard();
        }
    }, [user]);

    if (loading) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <h2>Loading dashboard...</h2>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
                <h2>Error loading dashboard</h2>
                <p>{error}</p>
            </div>
        );
    }

    const { summary, campaigns = [], credits = 0 } = dashboardData || {};

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const data = await dashboardAPI.getBrandDashboard(user?.linked_entity_id);
            setDashboardData(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUploadSuccess = () => {
        fetchDashboardData(); // Refresh data after upload
    };

    return (
        <>
            <HamburgerMenu />
            <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
                {/* Header */}
                <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                            Brand Dashboard
                        </h1>
                        <p style={{ color: '#6b7280' }}>Campaign performance and analytics</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            onClick={() => setShowTimeline(!showTimeline)}
                            style={{
                                padding: '0.75rem 1.5rem',
                                backgroundColor: showTimeline ? '#eef2ff' : '#fff',
                                color: showTimeline ? '#6366f1' : '#374151',
                                border: '1px solid ' + (showTimeline ? '#6366f1' : '#d1d5db'),
                                borderRadius: '0.5rem',
                                fontSize: '1rem',
                                fontWeight: '500',
                                cursor: 'pointer'
                            }}
                        >
                            📅 {showTimeline ? 'Hide' : 'View'} Schedule Timeline
                        </button>
                        <button
                            onClick={() => setIsUploadOpen(true)}
                            style={{
                                padding: '0.75rem 1.5rem',
                                backgroundColor: '#6366f1',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '0.5rem',
                                fontSize: '1rem',
                                fontWeight: '500',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            📤 Create Campaign
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                    <StatCard
                        title="Active Campaigns"
                        value={summary?.total_campaigns || 0}
                        color="#6366f1"
                    />
                    <StatCard
                        title="Total Impressions"
                        value={(summary?.total_impressions || 0).toLocaleString()}
                        color="#10b981"
                    />
                    <StatCard
                        title="Ad Credits"
                        value={credits.toLocaleString()}
                        color="#f59e0b"
                    />
                    <StatCard
                        title="Screens Reached"
                        value={summary?.screens_reached || 0}
                        color="#8b5cf6"
                    />
                </div>

                {/* Schedule Timeline */}
                {showTimeline && campaigns.length > 0 && (
                    <div style={{ marginBottom: '2rem' }}>
                        <ScheduleTimeline campaigns={campaigns} />
                    </div>
                )}

                {/* Campaigns Table */}
                <div style={{ backgroundColor: '#fff', borderRadius: '0.75rem', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
                        Your Campaigns
                    </h2>
                    {campaigns.length === 0 ? (
                        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>
                            No campaigns yet. Create your first campaign to get started!
                        </p>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>Campaign</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>Status</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>Impressions</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                {campaigns.map((campaign, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '0.75rem', fontWeight: '500' }}>{campaign.title}</td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <span style={{
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '999px',
                                                fontSize: '0.75rem',
                                                backgroundColor: campaign.status === 'active' ? '#d1fae5' : '#fee2e2',
                                                color: campaign.status === 'active' ? '#065f46' : '#991b1b',
                                                fontWeight: '500'
                                            }}>
                                                {campaign.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>{(campaign.impressions || 0).toLocaleString()}</td>
                                        <td style={{ padding: '0.75rem' }}>{campaign.duration}s</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Campaign Upload Drawer */}
                <CampaignUploadDrawer
                    isOpen={isUploadOpen}
                    onClose={() => setIsUploadOpen(false)}
                    onSuccess={handleUploadSuccess}
                />
            </div>
        </>
    );
}

function StatCard({ title, value, color }) {
    return (
        <div style={{
            backgroundColor: '#fff',
            padding: '1.5rem',
            borderRadius: '0.75rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            borderLeft: `4px solid ${color}`
        }}>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>{title}</p>
            <p style={{ fontSize: '2rem', fontWeight: '700', color: '#111827' }}>{value}</p>
        </div>
    );
}

export default BrandDashboard;
