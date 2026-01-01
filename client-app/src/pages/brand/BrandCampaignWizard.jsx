import React, { useState } from 'react';
import Step1LocationScreen from './wizard/Step1LocationScreen';
import Step2ScheduleUpload from './wizard/Step2ScheduleUpload';
import Step3ReviewDistribution from './wizard/Step3ReviewDistribution';

const BrandCampaignWizard = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [wizardData, setWizardData] = useState({
        selectedStore: null,
        selectedScreens: [],
        dateRange: { start: '2023-10-05', end: '2023-10-12' },
        selectedSlots: [],
        creativeFile: null
    });

    const nextStep = () => setCurrentStep((prev) => prev + 1);
    const prevStep = () => setCurrentStep((prev) => prev - 1);

    const updateWizardData = (newData) => {
        setWizardData((prev) => ({ ...prev, ...newData }));
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
                    <Step3ReviewDistribution
                        data={wizardData}
                        onConfirm={() => {
                            // TODO: Implement campaign creation API call
                            // For now, just navigate back to dashboard
                        }}
                        onPrev={prevStep}
                    />
                );
            default:
                return <div>Unknown Step</div>;
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <nav className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <span>Campaigns</span>
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    <span className="text-primary font-medium">New Campaign</span>
                </nav>
                <h1 className="text-3xl font-bold tracking-tight">Create New Campaign</h1>
            </div>

            <div className="flex flex-col gap-8">
                {renderStep()}
            </div>
        </div>
    );
};

export default BrandCampaignWizard;
