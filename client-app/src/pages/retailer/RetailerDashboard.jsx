import React, { useState, useEffect } from 'react';
import { dashboardAPI } from '../../services/api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import GlassCard from '../../components/GlassCard';
import HamburgerMenu from '../../components/HamburgerMenu';
import '../../design-tokens.css';

/**
 * RetailerDashboard - State 10: Retailer Concierge View
 * Simplified dashboard for shop owners - mobile-friendly
 */
function RetailerDashboard() {
    const { user } = useAuth();
    const [systemStatus, setSystemStatus] = useState('online');
    const [earnings, setEarnings] = useState(0);
    const [screenData, setScreenData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.linked_entity_id) {
            fetchRetailerData();
        }
    }, [user]);

    const fetchRetailerData = async () => {
        if (!user?.linked_entity_id) return;

        setLoading(true);
        try {
            const data = await dashboardAPI.getRetailerDashboard(user.linked_entity_id);

            setSystemStatus(data.system_status || 'offline');
            setEarnings(data.earnings.current_month || 0);
            setScreenData(data.screen);
        } catch (error) {
            console.error('Failed to fetch retailer data:', error);
            setSystemStatus('offline');
        } finally {
            setLoading(false);
        }
    };

    // Toggle status for demo purposes
    const toggleStatus = () => {
        setSystemStatus(prev => prev === 'online' ? 'offline' : 'online');
    };

    return (
        <>
            <HamburgerMenu />
            <div className="dashboard-ui" style={{ padding: 'var(--space-6)', maxWidth: '800px', margin: '0 auto' }}>
                {/* Simplified Navigation Helper */}
                <div style={{ marginBottom: 'var(--space-6)' }}>
                    <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', marginBottom: 'var(--space-2)' }}>
                        My Store
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                        Quick overview of your screen system
                    </p>
                </div>

                {/* Hero Status Card - State 10: The Concierge */}
                <GlassCard style={{ marginBottom: 'var(--space-8)', textAlign: 'center' }}>
                    {systemStatus === 'online' ? (
                        <>
                            {/* Green Checkmark */}
                            <div
                                style={{
                                    width: '120px',
                                    height: '120px',
                                    backgroundColor: 'var(--color-success-light)',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto var(--space-6)',
                                }}
                            >
                                <span style={{ fontSize: '4rem', color: 'var(--color-success)' }}>✓</span>
                            </div>

                            {/* Status Text */}
                            <h2 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-success)', marginBottom: 'var(--space-3)' }}>
                                System Online
                            </h2>
                            <p style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                                Your screen is active
                            </p>
                            {screenData && (
                                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
                                    {screenData.location} • {screenData.uptime}% uptime
                                </p>
                            )}
                        </>
                    ) : (
                        <>
                            {/* Offline State - Triggers State 18 */}
                            <div
                                style={{
                                    width: '120px',
                                    height: '120px',
                                    backgroundColor: 'var(--color-error-light)',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto var(--space-6)',
                                }}
                            >
                                <span style={{ fontSize: '4rem', color: 'var(--color-error)' }}>⚠️</span>
                            </div>

                            <h2 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-error)', marginBottom: 'var(--space-3)' }}>
                                Needs Attention
                            </h2>
                            <p style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-secondary)' }}>
                                Screen Offline
                            </p>
                        </>
                    )}
                </GlassCard>

                {/* Earnings Card - Single Metric */}
                {systemStatus === 'online' && (
                    <GlassCard style={{ marginBottom: 'var(--space-8)', textAlign: 'center' }}>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                            Estimated Earnings This Month
                        </p>
                        <p style={{ fontSize: 'var(--text-5xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-success)', fontVariantNumeric: 'tabular-nums' }}>
                            ${earnings.toFixed(2)}
                        </p>
                        <button
                            onClick={() => window.location.href = '/dashboard/earnings'}
                            style={{
                                marginTop: 'var(--space-6)',
                                padding: 'var(--space-4) var(--space-8)',
                                fontSize: 'var(--text-base)',
                                fontWeight: 'var(--font-semibold)',
                                color: 'white',
                                backgroundColor: 'var(--color-primary)',
                                border: 'none',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                transition: 'all var(--transition-base)',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            View Earnings Details
                        </button>
                    </GlassCard>
                )}

                {/* Troubleshoot Section - State 18 */}
                {systemStatus === 'offline' && (
                    <GlassCard>
                        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', marginBottom: 'var(--space-6)', textAlign: 'center' }}>
                            Quick Troubleshooting
                        </h3>

                        {/* Three Large Tappable Buttons for Mobile */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                            <button
                                onClick={() => alert('Checklist: \n1. Check Wi-Fi connection\n2. Verify router is on\n3. Test other devices')}
                                style={{
                                    padding: 'var(--space-6)',
                                    fontSize: 'var(--text-base)',
                                    fontWeight: 'var(--font-medium)',
                                    color: 'var(--color-text-primary)',
                                    backgroundColor: 'var(--color-bg-hover)',
                                    border: '2px solid var(--color-border)',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all var(--transition-fast)',
                                    minHeight: '80px',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                                    e.currentTarget.style.backgroundColor = 'white';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--color-border)';
                                    e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                                }}
                            >
                                <div style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-2)' }}>📶</div>
                                <div style={{ fontWeight: 'var(--font-semibold)' }}>Did the store lose Wi-Fi?</div>
                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
                                    Tap to see Wi-Fi troubleshooting steps
                                </div>
                            </button>

                            <button
                                onClick={() => alert('Check if:\n• TV is plugged in\n• Power strip is on\n• No tripped breakers')}
                                style={{
                                    padding: 'var(--space-6)',
                                    fontSize: 'var(--text-base)',
                                    fontWeight: 'var(--font-medium)',
                                    color: 'var(--color-text-primary)',
                                    backgroundColor: 'var(--color-bg-hover)',
                                    border: '2px solid var(--color-border)',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all var(--transition-fast)',
                                    minHeight: '80px',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                                    e.currentTarget.style.backgroundColor = 'white';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--color-border)';
                                    e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                                }}
                            >
                                <div style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-2)' }}>🔌</div>
                                <div style={{ fontWeight: 'var(--font-semibold)' }}>Is the TV unplugged?</div>
                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
                                    Tap to see power connection guide
                                </div>
                            </button>

                            <button
                                onClick={() => {
                                    const issue = prompt('Tell us what you see:');
                                    if (issue) {
                                        alert(`Report submitted!\n\nYour Issue: ${issue}\n\nOur support team has been notified and will contact you shortly.`);
                                    }
                                }}
                                style={{
                                    padding: 'var(--space-6)',
                                    fontSize: 'var(--text-base)',
                                    fontWeight: 'var(--font-semibold)',
                                    color: 'white',
                                    backgroundColor: 'var(--color-primary)',
                                    border: 'none',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all var(--transition-base)',
                                    minHeight: '80px',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <div style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-2)' }}>📝</div>
                                <div>Report Issue to Support</div>
                                <div style={{ fontSize: 'var(--text-sm)', opacity: 0.9, marginTop: 'var(--space-1)' }}>
                                    Our team will contact you within 1 hour
                                </div>
                            </button>
                        </div>
                    </GlassCard>
                )}

                {/* Profit Sharing & Earnings */}
                <GlassCard style={{ marginBottom: 'var(--space-6)' }}>
                    <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', marginBottom: 'var(--space-4)' }}>
                        💰 Your Earnings
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-light)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-success)' }}>
                            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>Total Earned</p>
                            <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-success)' }}>
                                ${(earnings || 0).toFixed(2)}
                            </p>
                        </div>

                        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-light)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-primary)' }}>
                            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>Profit Share</p>
                            <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-primary)' }}>
                                40%
                            </p>
                        </div>

                        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--color-bg-light)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-warning)' }}>
                            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>Impressions</p>
                            <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                                {screenData?.impressions_today || 0}
                            </p>
                        </div>
                    </div>

                    <div style={{ padding: 'var(--space-4)', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 'var(--radius-md)', marginTop: 'var(--space-4)' }}>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                            How it works
                        </p>
                        <p style={{ fontSize: 'var(--text-sm)', lineHeight: '1.6' }}>
                            You earn 40% of advertising revenue generated from your screen.
                            For every ad impression displayed, you receive a share of the advertiser's payment.
                            Earnings are calculated monthly and paid out automatically.
                        </p>
                    </div>
                </GlassCard>

                {/* Toggle for Demo */}
                <div style={{ textAlign: 'center', marginTop: 'var(--space-8)' }}>
                    <button
                        onClick={() => setSystemStatus(systemStatus === 'online' ? 'offline' : 'online')}
                        style={{
                            padding: 'var(--space-3) var(--space-6)',
                            fontSize: 'var(--text-sm)',
                            color: 'var(--color-text-secondary)',
                            backgroundColor: 'transparent',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                        }}
                    >
                        Toggle Status (Demo)
                    </button>
                </div>
            </div>
        </>);
}

export default RetailerDashboard;
