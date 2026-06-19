export const BrandLocators = {
    // Shell
    NavBrand: 'nav-brand',
    AdvertiserDashboard: 'advertiser-dashboard',
    AdvertiserCampaigns: 'advertiser-campaigns',
    CampaignsList: 'campaigns-list',

    // Invoices & Billing
    Invoices: 'invoices',
    InvoiceRow: 'invoice-row',
    InvoiceDetail: 'invoice-detail',
    InvoiceAmount: 'invoice-amount',
    BtnInvoiceDownload: 'btn-invoice-download',

    // General Buttons
    BtnNewCampaign: 'btn-new-campaign',
};

export function getLocator(page, testId) {
    if (!testId) throw new Error("Missing testId in getLocator. Did you use a valid BrandLocators key?");
    return page.locator(`[data-testid="${testId}"]`);
}
