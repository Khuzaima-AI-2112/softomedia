import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { campaignsAPI } from '../services/api';

function CampaignReport() {
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const [report, setReport] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchReport = async () => {
            try {
                setLoading(true);
                const data = await campaignsAPI.getReport(id);
                setReport(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchReport();
        }
    }, [id]);

    if (loading) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <h2>Loading campaign report...</h2>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
                <h2>Error loading report</h2>
                <p>{error}</p>
            </div>
        );
    }

    const { campaign = {}, screens = [], metrics = {} } = report || {};

    const handlePrint = () => {
        window.print();
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
            {/* Header with Print Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                        Campaign Report
                    </h1>
                    <p style={{ color: '#6b7280' }}>{campaign.title}</p>
                </div>
                <button
                    onClick={handlePrint}
                    style={{
                        padding: '0.75rem 1.5rem',
                        backgroundColor: '#6366f1',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        fontWeight: '500',
                        cursor: 'pointer'
                    }}
                >
                    🖨️ Print Report
                </button>
            </div>

            {/* Campaign Info */}
            <div style={{ backgroundColor: '#fff', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
                    Campaign Details
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                    <div>
                        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Duration</p>
                        <p style={{ fontSize: '1.125rem', fontWeight: '500' }}>{campaign.duration_seconds}s per play</p>
                    </div>
                    <div>
                        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Status</p>
                        <p style={{ fontSize: '1.125rem', fontWeight: '500' }}>{campaign.status}</p>
                    </div>
                </div>
            </div>

            {/* Performance Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <MetricCard
                    title="Total Impressions"
                    value={(metrics.total_impressions || 0).toLocaleString()}
                    color="#10b981"
                />
                <MetricCard
                    title="Unique Screens"
                    value={screens.length}
                    color="#6366f1"
                />
                <MetricCard
                    title="Average Per Screen"
                    value={screens.length > 0 ? Math.round(metrics.total_impressions / screens.length) : 0}
                    color="#f59e0b"
                />
            </div>

            {/* Screen Breakdown */}
            <div style={{ backgroundColor: '#fff', borderRadius: '0.75rem', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
                    Performance by Screen
                </h2>
                {screens.length === 0 ? (
                    <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>
                        No screen data available
                    </p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>Screen ID</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>Location</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>Impressions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {screens.map((screen, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '0.75rem', fontWeight: '500' }}>{screen.screen_id}</td>
                                    <td style={{ padding: '0.75rem' }}>{screen.location || 'N/A'}</td>
                                    <td style={{ padding: '0.75rem' }}>{(screen.impressions || 0).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

function MetricCard({ title, value, color }) {
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

export default CampaignReport;
