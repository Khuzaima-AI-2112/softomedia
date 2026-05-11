import React, { useState, useEffect } from 'react';
import { API_URL } from '../../config.js';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import '../../design-tokens.css';

/**
 * CampaignReport - State 12: Final Campaign Report
 * Static, printable campaign performance report
 */
function CampaignReport({ campaignId }) {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (campaignId) {
            fetchReport();
        }
    }, [campaignId]);

    const fetchReport = async () => {
        try {
            // TODO: Replace with actual API call
            // const response = await fetch(`${API_URL}/api/campaigns/${campaignId}/report`);
            // const data = await response.json();

            // Mock data for now
            const mockReport = {
                id: campaignId || 'camp_001',
                name: 'Holiday Sale Campaign',
                startDate: '2025-12-01',
                endDate: '2025-12-23',
                status: 'completed',
                summary: {
                    totalSpend: 5420.50,
                    verifiedPlays: 24567,
                    cpm: 22.06,
                    completionRate: 98.5,
                },
                performanceByLocation: [
                    { location: 'Downtown Plaza', impressions: 8945, spent: 1876.32 },
                    { location: 'West Mall', impressions: 6234, spent: 1305.68 },
                    { location: 'Airport Terminal', impressions: 5432, spent: 1138.24 },
                    { location: 'Central Station', impressions: 3956, spent: 829.02 },
                ],
            };

            setReport(mockReport);
        } catch (error) {
            console.error('Failed to fetch report:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = () => {
        alert('PDF download would be triggered here using jsPDF or similar library');
        // Implementation with jsPDF:
        // const doc = new jsPDF();
        // doc.text(report.name, 10, 10);
        // ... add more content
        // doc.save(`campaign-report-${report.id}.pdf`);
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="dashboard-ui" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                <p style={{ color: 'var(--color-text-secondary)' }}>Loading report...</p>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="dashboard-ui" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                <p style={{ color: 'var(--color-text-secondary)' }}>Report not found</p>
            </div>
        );
    }

    return (
        <div className="dashboard-ui" style={{ padding: 'var(--space-6)', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Document Header */}
            <GlassCard style={{ marginBottom: 'var(--space-8)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
                    <div>
                        <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-bold)', marginBottom: 'var(--space-2)' }}>
                            Campaign Report
                        </h1>
                        <p style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
                            {report.name}
                        </p>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
                            {new Date(report.startDate).toLocaleDateString()} - {new Date(report.endDate).toLocaleDateString()}
                        </p>
                    </div>
                    <StatusBadge status={report.status} />
                </div>

                {/* Actions - Hide on print */}
                <div className="no-print" style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <button
                        onClick={handleDownloadPDF}
                        style={{
                            padding: 'var(--space-3) var(--space-6)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 'var(--font-medium)',
                            color: 'white',
                            backgroundColor: 'var(--color-primary)',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            transition: 'all var(--transition-base)',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        📄 Download PDF
                    </button>
                    <button
                        onClick={handlePrint}
                        style={{
                            padding: 'var(--space-3) var(--space-6)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 'var(--font-medium)',
                            color: 'var(--color-primary)',
                            backgroundColor: 'transparent',
                            border: '1px solid var(--color-primary)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                        }}
                    >
                        🖨️ Print
                    </button>
                </div>
            </GlassCard>

            {/* Summary Band */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 'var(--space-6)',
                    marginBottom: 'var(--space-8)',
                    padding: 'var(--space-8)',
                    backgroundColor: 'var(--color-primary)',
                    borderRadius: 'var(--radius-lg)',
                    color: 'white',
                }}
            >
                <div>
                    <p style={{ fontSize: 'var(--text-sm)', opacity: 0.9, marginBottom: 'var(--space-1)' }}>Total Spend</p>
                    <p style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-bold)', fontVariantNumeric: 'tabular-nums' }}>
                        ${report.summary.totalSpend.toLocaleString()}
                    </p>
                </div>
                <div>
                    <p style={{ fontSize: 'var(--text-sm)', opacity: 0.9, marginBottom: 'var(--space-1)' }}>Verified Plays</p>
                    <p style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-bold)', fontVariantNumeric: 'tabular-nums' }}>
                        {report.summary.verifiedPlays.toLocaleString()}
                    </p>
                </div>
                <div>
                    <p style={{ fontSize: 'var(--text-sm)', opacity: 0.9, marginBottom: 'var(--space-1)' }}>CPM</p>
                    <p style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-bold)', fontVariantNumeric: 'tabular-nums' }}>
                        ${report.summary.cpm.toFixed(2)}
                    </p>
                </div>
                <div>
                    <p style={{ fontSize: 'var(--text-sm)', opacity: 0.9, marginBottom: 'var(--space-1)' }}>Completion Rate</p>
                    <p style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-bold)', fontVariantNumeric: 'tabular-nums' }}>
                        {report.summary.completionRate}%
                    </p>
                </div>
            </div>

            {/* Performance by Location */}
            <GlassCard title="Performance by Location" style={{ marginBottom: 'var(--space-8)' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                                <th style={{ padding: 'var(--space-3)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)' }}>
                                    Location
                                </th>
                                <th style={{ padding: 'var(--space-3)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                                    Impressions
                                </th>
                                <th style={{ padding: 'var(--space-3)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                                    Amount Spent
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.performanceByLocation.map((loc, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                    <td style={{ padding: 'var(--space-3)', fontWeight: 'var(--font-medium)' }}>
                                        {loc.location}
                                    </td>
                                    <td style={{ padding: 'var(--space-3)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                        {loc.impressions.toLocaleString()}
                                    </td>
                                    <td style={{ padding: 'var(--space-3)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 'var(--font-medium)' }}>
                                        ${loc.spent.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr style={{ borderTop: '2px solid var(--color-border)', fontWeight: 'var(--font-bold)' }}>
                                <td style={{ padding: 'var(--space-3)' }}>Total</td>
                                <td style={{ padding: 'var(--space-3)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                    {report.summary.verifiedPlays.toLocaleString()}
                                </td>
                                <td style={{ padding: 'var(--space-3)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                    ${report.summary.totalSpend.toLocaleString()}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </GlassCard>

            {/* Heatmap Placeholder */}
            <GlassCard title="Impression Density Heatmap">
                <div
                    style={{
                        backgroundColor: 'var(--color-bg-hover)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-8)',
                        minHeight: '300px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                    }}
                >
                    <div>
                        <p style={{ fontSize: 'var(--text-4xl)', marginBottom: 'var(--space-3)' }}>🗺️</p>
                        <p style={{ color: 'var(--color-text-secondary)' }}>
                            Static density heatmap showing where impressions concentrated
                        </p>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>
                            (Integrate with Chart.js, D3, or similar visualization library)
                        </p>
                    </div>
                </div>
            </GlassCard>

            {/* Print-specific styles */}
            <style>{`
                @media print {
                    .no-print {
                        display: none !important;
                    }
                    body {
                        background: white;
                    }
                }
            `}</style>
        </div>
    );
}

export default CampaignReport;
