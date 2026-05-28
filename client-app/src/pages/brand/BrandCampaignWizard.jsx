import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Step1LocationScreen from './wizard/Step1LocationScreen';
import Step2ScheduleUpload from './wizard/Step2ScheduleUpload';
import Step3LoopSlotSelection from './wizard/Step3LoopSlotSelection';
import Step4CreativeUpload from './wizard/Step4CreativeUpload';
import Step5ReviewConfirm from './wizard/Step5ReviewConfirm';
import GlassCard from '../../components/GlassCard';
import apiService from '../../services/ApiService';

const STEPS = [
    { id: 1, name: 'Location', icon: 'location_on', description: 'Select stores & screens' },
    { id: 2, name: 'Schedule', icon: 'calendar_month', description: 'Choose campaign dates' },
    { id: 3, name: 'Slots', icon: 'view_module', description: 'Select hourly loops' },
    { id: 4, name: 'Creative', icon: 'image', description: 'Upload your ad' },
    { id: 5, name: 'Review', icon: 'check_circle', description: 'Confirm booking' }
];

const BrandCampaignWizard = () => {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    // Bug #27 fix: track in-flight submission to prevent double-fire
    const [submitting, setSubmitting] = useState(false);
    const [wizardData, setWizardData] = useState({
        // Step 1: Location
        selectedRetailers: [],
        selectedStores: [],
        selectedScreens: [],
        // Step 2: Schedule
        campaignName: '',
        dateRange: {
            start: new Date().toISOString().split('T')[0],
            end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        },
        budget: 1000,
        // Step 3: Slots
        selectedSlots: [],
        // Step 4: Creative
        creativeUrl: '',
        creativeDuration: 5,
        // Totals (calculated)
        totalCost: 0,
        totalImpressions: 0
    });

    console.log(`[Diagnostic] Wizard Step: ${currentStep}`, {
        stores: wizardData.selectedStores.length,
        screens: wizardData.selectedScreens.length,
        hasName: !!wizardData.campaignName
    });

    const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, 5));
    const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));
    const goToStep = (step) => {
        if (step <= currentStep) {
            setCurrentStep(step);
        }
    };

    const updateWizardData = (newData) => {
        setWizardData((prev) => ({ ...prev, ...newData }));
    };

    const handleConfirm = async () => {
        // Bug #27 fix: prevent double-submission
        if (submitting) return;
        setSubmitting(true);
        try {
            const campaignData = {
                advertiser_id: 'adv_001',
                name: wizardData.campaignName || 'New Campaign',
                creative_url: wizardData.creativeUrl,
                duration: wizardData.creativeDuration,
                start_date: wizardData.dateRange.start,
                end_date: wizardData.dateRange.end,
                budget: wizardData.budget,
                status: 'pending'
            };

            const campaign = await apiService.createCampaign(campaignData);

            // Bug #27 fix: only call bookSlots when there are slots to book
            if (wizardData.selectedSlots.length > 0) {
                const slotMappings = wizardData.selectedSlots.map(slot => ({
                    loopId: slot.loopId,
                    slotIndex: slot.slotIndex,
                    creativeUrl: wizardData.creativeUrl,
                    advertiser_id: 'adv_001'
                }));
                await apiService.bookSlots(campaign.id, slotMappings);
            }

            navigate('/dashboard/brand');
        } catch (error) {
            console.error('Failed to book campaign:', error);
            alert('An error occurred while booking your campaign. Please try again.');
        } finally {
            // Always clear — if navigate() fires the component may already be
            // unmounted, but the setState is a no-op in that case (React 18).
            setSubmitting(false);
        }
    };

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return (
                    <Step1LocationScreen
                        data={wizardData}
                        updateData={updateWizardData}
                        onNext={nextStep}
                    />
                );
            case 2:
                return (
                    <Step2ScheduleUpload
                        data={wizardData}
                        updateData={updateWizardData}
                        onNext={nextStep}
                        onPrev={prevStep}
                    />
                );
            case 3:
                return (
                    <Step3LoopSlotSelection
                        data={wizardData}
                        updateData={updateWizardData}
                        onNext={nextStep}
                        onPrev={prevStep}
                    />
                );
            case 4:
                return (
                    <Step4CreativeUpload
                        data={wizardData}
                        updateData={updateWizardData}
                        onNext={nextStep}
                        onPrev={prevStep}
                    />
                );
            case 5:
                return (
                    <Step5ReviewConfirm
                        data={wizardData}
                        onConfirm={handleConfirm}
                        submitting={submitting}
                        onPrev={prevStep}
                    />
                );
            default:
                return <div>Unknown Step</div>;
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <nav className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <a href="/dashboard/brand" className="hover:text-primary">Campaigns</a>
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    <span className="text-primary font-medium">New Campaign</span>
                </nav>
                <h1 className="text-3xl font-bold tracking-tight">Create New Campaign</h1>
            </div>

            {/* Step Progress Indicator */}
            <GlassCard className="!p-4">
                <div className="flex items-center justify-between">
                    {STEPS.map((step, index) => (
                        <React.Fragment key={step.id}>
                            <button
                                onClick={() => goToStep(step.id)}
                                disabled={step.id > currentStep}
                                className={`
                                    flex items-center gap-3 px-4 py-2 rounded-xl transition-all
                                    ${currentStep === step.id
                                        ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                        : step.id < currentStep
                                            ? 'text-primary hover:bg-primary/5 cursor-pointer'
                                            : 'text-slate-400 cursor-not-allowed'}
                                `}
                            >
                                <div className={`
                                    size-8 rounded-full flex items-center justify-center
                                    ${currentStep === step.id
                                        ? 'bg-white/20'
                                        : step.id < currentStep
                                            ? 'bg-primary/10'
                                            : 'bg-slate-100 dark:bg-slate-800'}
                                `}>
                                    {step.id < currentStep ? (
                                        <span className="material-symbols-outlined text-lg text-primary">check</span>
                                    ) : (
                                        <span className="material-symbols-outlined text-lg">{step.icon}</span>
                                    )}
                                </div>
                                <div className="hidden md:block text-left">
                                    <p className="text-sm font-bold">{step.name}</p>
                                    <p className={`text-xs ${currentStep === step.id ? 'text-white/70' : 'text-slate-400'}`}>
                                        {step.description}
                                    </p>
                                </div>
                            </button>

                            {index < STEPS.length - 1 && (
                                <div className={`
                                    flex-1 h-0.5 mx-2
                                    ${step.id < currentStep ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}
                                `} />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </GlassCard>

            {/* Step Content */}
            <div className="flex flex-col gap-8">
                {renderStep()}
            </div>
        </div>
    );
};

export default BrandCampaignWizard;
