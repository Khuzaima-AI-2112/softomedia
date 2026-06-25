export const WizardLocators = {
    CampaignWizardModal: 'campaign-wizard-modal',
    InputCampaignName: 'wizard-input-name',
    SelectRetailer: 'wizard-select-retailer',
    InputDescription: 'wizard-input-desc',
    InputStartDate: 'wizard-input-start-date',
    InputEndDate: 'wizard-input-end-date',
    InputBudget: 'wizard-input-budget',
    InputCreative: 'wizard-input-creative',
    BtnSubmit: 'wizard-btn-submit',
    Step1: 'wizard-input-name'
};

export function getLocator(page, testId) {
    if (!testId) throw new Error("Missing testId in getLocator. Did you use a valid WizardLocators key?");
    return page.locator(`[data-testid="${testId}"]`);
}

export function getDynamicLocator(page, testId) {
    return page.locator(`[data-testid="${testId}"]`);
}
