export const AdminLocators = {
    // Global Shell & Nav
    Shell: 'dashboard-shell',
    NavAdmin: 'nav-admin',
    NavTechOp: 'nav-techop',
    AdminOverview: 'admin-overview',

    // Retailers Page
    Retailers: {
        List: 'retailers-list',
        BtnAdd: 'btn-add-retailer',
        ModalForm: 'modal-retailer-form',
        InputName: 'input-retailer-name',
        InputContact: 'input-retailer-contact',
        BtnSubmit: 'btn-retailer-form-submit',
    },

    // Stores Page
    Stores: {
        List: 'stores-list',
        BtnAdd: 'btn-add-store',
        ModalForm: 'modal-store-form',
        InputName: 'input-store-name',
        InputAddress: 'input-store-address',
        BtnSubmit: 'btn-store-form-submit',
    },

    // Screens Page
    Screens: {
        List: 'screens-list',
        BtnAdd: 'btn-add-screen',
        ModalForm: 'modal-screen-form',
        InputName: 'input-screen-name',
        SelectStore: 'select-screen-store',
        BtnSubmit: 'btn-screen-form-submit',
    },

    // Business Hours Page
    BusinessHours: {
        MainForm: 'business-hours-form',
        InputOpen: 'input-hours-open',
        InputClose: 'input-hours-close',
        BtnApplyAll: 'btn-hours-apply-all',
        BtnSave: 'btn-hours-save',
        SaveConfirmation: 'hours-save-confirmation',
    },

    // Advertisers Page
    Advertisers: {
        List: 'advertisers-list',
        BtnAdd: 'btn-add-advertiser',
        ModalForm: 'modal-advertiser-form',
        InputName: 'input-advertiser-name',
        InputContact: 'input-advertiser-contact',
        BtnSubmit: 'btn-advertiser-form-submit',
    },

    // Loops Page
    Loops: {
        List: 'loops-list',
        BtnAdd: 'btn-add-loop',
        ModalForm: 'modal-loop-form',
        InputName: 'input-loop-name',
        SelectRetailer: 'select-loop-retailer',
        InputDuration: 'input-loop-duration',
        InputPaidSlots: 'input-loop-paid-slots',
        BtnSubmit: 'btn-loop-form-submit',
    },

    // Pricing Page
    Pricing: {
        Calendar: 'pricing-calendar',
        CalendarToday: 'pricing-calendar-today',
        ModalForm: 'modal-pricing-form',
        InputCpmRate: 'input-cpm-rate',
        SelectRetailer: 'select-pricing-retailer',
        BtnSubmit: 'btn-pricing-form-submit',
        SaveConfirmation: 'pricing-save-confirmation',
    },

    // Users Page
    Users: {
        List: 'users-list',
        BtnAdd: 'btn-add-user',
        ModalForm: 'modal-user-form',
        InputEmail: 'input-user-email',
        InputDisplayName: 'input-user-displayname',
        SelectRole: 'select-user-role',
        InputEntityId: 'input-user-entity-id',
        BtnSubmit: 'btn-user-form-submit',
    }
};

/**
 * Helper to easily get a locator by its testid within a Playwright page.
 * Usage: getLocator(page, AdminLocators.Retailers.List)
 */
export function getLocator(page, testId) {
    return page.locator(`[data-testid="${testId}"]`);
}
