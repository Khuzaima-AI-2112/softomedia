import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    const [isReporting, setIsReporting] = useState(false);
    const [issueText, setIssueText] = useState('');
    const [reportStatus, setReportStatus] = useState('');

    // For BUG-19: Context Selector
    const [retailers, setRetailers] = useState([]);
    const [selectedRetailerId, setSelectedRetailerId] = useState('');

    const navigate = useNavigate();

    useEffect(() => {
        if (user?.role === 'admin') {
            import('../../services/ApiService').then(module => {
                module.default.getRetailers().then(data => {
                    const list = data.retailers || data || [];
                    setRetailers(list);
                    if (list.length > 0 && !selectedRetailerId) {
                        setSelectedRetailerId(list[0].id);
                    }
                }).catch(err => console.error(err));
            });
        } else if (user?.linked_entity_id && !selectedRetailerId) {
            setSelectedRetailerId(user.linked_entity_id);
        }
    }, [user]);

    useEffect(() => {
        if (selectedRetailerId) {
            fetchRetailerData(selectedRetailerId);
        }
    }, [selectedRetailerId]);

    const fetchRetailerData = async (retailerId) => {
        if (!retailerId) return;

        setLoading(true);
        try {
            const data = await dashboardAPI.getRetailerDashboard(retailerId);

            setSystemStatus(data.system_status || 'offline');
            setEarnings(data.earnings?.current_month || 0); // safe navigation
            setScreenData(data.screen);
        } catch (error) {
            console.error('Failed to fetch retailer data:', error);
            setSystemStatus('offline');
        } finally {
            setLoading(false);
        }
    };

    // Fix BUG-15: Connect/Disconnect stub replaced by Restart Simulation
    const handleRestartScreen = () => {
        setSystemStatus('restarting');
        setTimeout(() => setSystemStatus('online'), 3000); // simulate reboot delay
    };

    const submitReport = () => {
        if (!issueText) return;
        setReportStatus('submitting');
        setTimeout(() => {
            setReportStatus('success');
            setTimeout(() => {
                setIsReporting(false);
                setIssueText('');
                setReportStatus('');
            }, 2000);
        }, 1000);
    };

    return (
        <>
            <HamburgerMenu />
            <div className="dashboard-ui" style={{ padding: 'var(--space-6)', maxWidth: '800px', margin: '0 auto' }}>
                {user?.role === 'admin' && (
                    <div style={{ marginBottom: '1rem', background: '#e0e7ff', padding: '1rem', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
                        <label style={{ fontWeight: 'bold', marginRight: '1rem', color: '#3730A3' }}>Super Admin View:</label>
                        <select
                            value={selectedRetailerId}
                            onChange={(e) => setSelectedRetailerId(e.target.value)}
                            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #C7D2FE', background: 'white' }}
                        >
                            <option value="">-- Select Retailer --</option>
                            {retailers.map(r => <option key={r.id} value={r.id}>{r.name || r.id}</option>)}
                        </select>
                    </div>
                )}
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
                        <button
                            onClick={() => navigate('/retailer/dashboard/schedule')}
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
                                display: 'block',
                                width: '100%',
                            }}
                        >
                            View Tomorrow&apos;s Schedule
                        </button>
                    </GlassCard>
                )}

                {/* Report Issue Modal */}
                {isReporting && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                        <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '400px', width: '100%' }}>
                            <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', fontWeight: 'bold' }}>Report an Issue</h3>
                            <textarea
                                value={issueText}
                                onChange={e => setIssueText(e.target.value)}
                                placeholder="Describe your issue..."
                                style={{ width: '100%', height: '100px', padding: '0.5rem', marginBottom: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
                                disabled={reportStatus === 'submitting' || reportStatus === 'success'}
                            />
                            {reportStatus === 'success' ? (
                                <div style={{ color: 'green', fontWeight: 'bold', marginBottom: '1rem' }}>Report submitted successfully!</div>
                            ) : null}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button onClick={() => setIsReporting(false)} disabled={reportStatus !== ''} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
                                <button onClick={submitReport} disabled={!issueText || reportStatus !== ''} style={{ padding: '0.5rem 1rem', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '4px' }}>
                                    {reportStatus === 'submitting' ? 'Submitting...' : 'Submit'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Troubleshoot Section - State 18 */}
                {systemStatus === 'offline' && (
                    <GlassCard>
                        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)', marginBottom: 'var(--space-6)', textAlign: 'center' }}>
                            Needs Action
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
                                onClick={handleRestartScreen}
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
                            >
                                <div style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-2)' }}>🔄</div>
                                <div style={{ fontWeight: 'var(--font-semibold)' }}>Restart System</div>
                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
                                    Attempt to reestablish remote connection
                                </div>
                            </button>

                            <button
                                onClick={() => setIsReporting(true)}
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
                            For every ad impression displayed, you receive a share of the advertiser&apos;s payment.
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
