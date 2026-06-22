import { useState } from 'react';

function SupportTicketModal({ onClose }) {
    const [step, setStep] = useState('selection');
    const [issueType, setIssueType] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        setStep('success');
    };

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
            <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '1rem', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                {step === 'selection' && (
                    <>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Report Unit Issue</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {[
                                { id: 'wifi', label: 'Wi-Fi / Network Connection Failure', icon: 'wifi_off' },
                                { id: 'power', label: 'Power / Display Hardware Failure', icon: 'power_off' },
                                { id: 'sync', label: 'Ad Sync Inconsistency', icon: 'sync_problem' },
                            ].map(option => (
                                <button
                                    key={option.id}
                                    onClick={() => { setIssueType(option.label); setStep('form'); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.75rem', backgroundColor: 'white', cursor: 'pointer', textAlign: 'left' }}
                                    onMouseEnter={(e) => e.target.style.borderColor = '#6366f1'}
                                    onMouseLeave={(e) => e.target.style.borderColor = '#e5e7eb'}
                                >
                                    <span className="material-symbols-outlined" style={{ color: '#6b7280' }}>{option.icon}</span>
                                    <span style={{ fontWeight: '500' }}>{option.label}</span>
                                </button>
                            ))}
                        </div>
                        <button onClick={onClose} style={{ marginTop: '2rem', width: '100%', padding: '0.75rem', color: '#6b7280', border: 'none', background: 'none', cursor: 'pointer' }} data-testid="btn-modal-close">Cancel</button>
                    </>
                )}

                {step === 'form' && (
                    <form onSubmit={handleSubmit}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Issue Details</h2>
                        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Type: {issueType}</p>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Subject</label>
                            <input
                                data-testid="ticket-subject-input"
                                type="text"
                                required
                                placeholder="E.g., Screen 4 Offline"
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', marginBottom: '1rem', outline: 'none' }}
                            />
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Observation Notes</label>
                            <textarea
                                required
                                placeholder="Describe what you see on the screen..."
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', minHeight: '100px', outline: 'none' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button type="button" onClick={() => setStep('selection')} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>Back</button>
                            <button data-testid="btn-submit-ticket" type="submit" style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#6366f1', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Submit Ticket</button>
                        </div>
                    </form>
                )}

                {step === 'success' && (
                    <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                        <div style={{ width: '64px', height: '64px', backgroundColor: '#def7ec', color: '#03543f', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>check_circle</span>
                        </div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Ticket Received</h2>
                        <p style={{ color: '#6b7280', marginBottom: '2rem' }}>A technician has been notified for Northside Market (Aisle 4).</p>
                        <button onClick={onClose} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#111827', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Return to Dashboard</button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default SupportTicketModal;
