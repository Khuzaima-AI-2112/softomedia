import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useCampaignStore from '../../stores/useCampaignStore';
import Step1LocationScreen from './wizard/Step1LocationScreen';
import Step2ScheduleUpload from './wizard/Step2ScheduleUpload';
import Step3LoopSlotSelection from './wizard/Step3LoopSlotSelection';
import Step4CreativeUpload from './wizard/Step4CreativeUpload';
import Step5ReviewConfirm from './wizard/Step5ReviewConfirm';
import apiService from '../../services/ApiService';
import { Check } from 'lucide-react';
import '../../design-tokens.css';

const STEPS = [
    { id: 1, label: 'Location',  desc: 'Select stores & screens' },
    { id: 2, label: 'Schedule',  desc: 'Choose campaign dates' },
    { id: 3, label: 'Slots',     desc: 'Select hourly loops' },
    { id: 4, label: 'Creative',  desc: 'Upload your ad' },
    { id: 5, label: 'Review',    desc: 'Confirm booking' },
];

function StepperBar({ current, onGoTo }) {
    return (
        <div style={{
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
        }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                {STEPS.map((step, idx) => {
                    const done   = step.id < current;
                    const active = step.id === current;
                    const future = step.id > current;
                    const last   = idx === STEPS.length - 1;
                    const circleBg    = active || done ? 'var(--color-primary)' : 'var(--color-bg-hover)';
                    const labelColor  = active ? 'var(--color-text-primary)' : done ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)';

                    return (
                        <React.Fragment key={step.id}>
                            <button
                                onClick={() => done && onGoTo(step.id)}
                                disabled={future}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    background: 'none', border: 'none',
                                    padding: '0.25rem 0.375rem',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: done ? 'pointer' : 'default',
                                    flexShrink: 0,
                                    transition: 'background-color var(--transition-fast)',
                                }}
                                onMouseEnter={e => { if (done) e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'; }}
                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                <span style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                    backgroundColor: circleBg,
                                    transition: 'background-color var(--transition-fast)',
                                }}>
                                    {done
                                        ? <Check size={14} color="#fff" strokeWidth={3} />
                                        : <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', color: active ? '#fff' : 'var(--color-text-tertiary)' }}>{step.id}</span>
                                    }
                                </span>
                                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                    <span style={{
                                        fontSize: 'var(--text-sm)',
                                        fontWeight: active ? 'var(--font-bold)' : 'var(--font-medium)',
                                        color: labelColor,
                                        lineHeight: 1.2,
                                        whiteSpace: 'nowrap',
                                    }}>{step.label}</span>
                                    <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>{step.desc}</span>
                                </span>
                            </button>
                            {!last && (
                                <div style={{
                                    flex: 1, height: 1, margin: '0 0.375rem',
                                    backgroundColor: 'var(--color-border)',
                                    position: 'relative', overflow: 'hidden',
                                }}>
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        backgroundColor: 'rgba(99,102,241,0.4)',
                                        transform: done ? 'scaleX(1)' : 'scaleX(0)',
                                        transformOrigin: 'left',
                                        transition: 'transform var(--transition-base)',
                                    }} />
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}

const BrandCampaignWizard = () => {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [wizardData, setWizardData] = useState({
        selectedRetailers: [],
        selectedStores: [],
        selectedScreens: [],
        campaignName: '',
        dateRange: {
            start: new Date().toISOString().split('T')[0],
            end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        },
        budget: 1000,
        selectedSlots: [],
        creativeUrl: '',
        creativeDuration: 5,
        totalCost: 0,
        totalImpressions: 0,
    });

    const { editMode, campaignData, reset } = useCampaignStore();
    const { id } = useParams();

    useEffect(() => {
        if (editMode && campaignData) {
            setWizardData(prev => ({
                ...prev,
                campaignName: campaignData.title || campaignData.name || '',
                creativeDuration: campaignData.duration || 5,
            }));
        }
        return () => reset();
    }, [editMode, campaignData, reset]);

    const nextStep = () => setCurrentStep(p => Math.min(p + 1, 5));
    const prevStep = () => setCurrentStep(p => Math.max(p - 1, 1));
    const goToStep = (step) => { if (step <= currentStep) setCurrentStep(step); };
    const updateWizardData = (d) => setWizardData(p => ({ ...p, ...d }));

    const handleConfirm = async () => {
        try {
            const payload = {
                advertiser_id: 'adv_001',
                name: wizardData.campaignName || 'New Campaign',
                creative_url: wizardData.creativeUrl,
                duration: wizardData.creativeDuration,
                start_date: wizardData.dateRange.start,
                end_date: wizardData.dateRange.end,
                budget: wizardData.budget,
                status: 'pending',
            };
            if (editMode && campaignData?.id) {
                await apiService.updateCampaignStatus(campaignData.id, 'pending');
            } else {
                const campaign = await apiService.createCampaign(payload);
                const slotMappings = wizardData.selectedSlots.map(slot => ({
                    loopId: slot.loopId,
                    slotIndex: slot.slotIndex,
                    creativeUrl: wizardData.creativeUrl,
                    advertiser_id: 'adv_001',
                }));
                await apiService.bookSlots(campaign.id, slotMappings);
            }
            navigate('/brand/dashboard');
        } catch (err) {
            console.error('Failed to book campaign:', err);
            alert('An error occurred while booking your campaign. Please try again.');
        }
    };

    const renderStep = () => {
        switch (currentStep) {
            case 1: return <Step1LocationScreen data={wizardData} updateData={updateWizardData} onNext={nextStep} />;
            case 2: return <Step2ScheduleUpload data={wizardData} updateData={updateWizardData} onNext={nextStep} onPrev={prevStep} />;
            case 3: return <Step3LoopSlotSelection data={wizardData} updateData={updateWizardData} onNext={nextStep} onPrev={prevStep} />;
            case 4: return <Step4CreativeUpload data={wizardData} updateData={updateWizardData} onNext={nextStep} onPrev={prevStep} />;
            case 5: return <Step5ReviewConfirm data={wizardData} onConfirm={handleConfirm} onPrev={prevStep} />;
            default: return null;
        }
    };

    return (
        <div style={{ minHeight: '100%' }}>
            <div style={{ marginBottom: '1.25rem' }}>
                <nav style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
                    <a href="/dashboard/brand" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Campaigns</a>
                    <span style={{ color: 'var(--color-text-tertiary)' }}>›</span>
                    <span style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-medium)' }}>New Campaign</span>
                </nav>
                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
                    Create New Campaign
                </h2>
            </div>
            <StepperBar current={currentStep} onGoTo={goToStep} />
            {renderStep()}
        </div>
    );
};

export default BrandCampaignWizard;
