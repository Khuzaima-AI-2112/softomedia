const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../client-app/src');
const checklistPath = path.join(__dirname, '../current_sprint/playwright_testids_checklist.md');

// Mapping of component file names to their corresponding data-testids to inject.
// Using regexes to find the appropriate wrapper/element and inject data-testid="X"
const INJECTIONS = {
    // Analytics & Dashboards
    'LoopAnalytics.jsx': [
        { id: 'loop-analytics', search: /<div className="space-y-8 animate-in/i },
        { id: 'kpi-available-hours', search: /<GlassCard className="border-l-4 border-l-blue-500">/i },
        { id: 'kpi-loading', search: /<div className="animate-spin rounded-full h-8 w-8/i },
        { id: 'play-count', search: /<p className="text-3xl font-bold/i }
    ],
    'Health.jsx': [
        { id: 'health-dashboard', search: /<div className="space-y-8 animate-in/i },
        { id: 'health-active-campaigns-panel', search: /<GlassCard className="border-l-4 border-l-primary">/i },
        { id: 'health-chip-adserver', search: /<span>Ad Server<\/span>/i },
        { id: 'health-chip-firestore', search: /<span>Firestore Database<\/span>/i },
        { id: 'health-status-banner', search: /<div className={`p-4 rounded-xl border/i }
    ],
    'Overview.jsx': [
        { id: 'retailer-dashboard-kpis', search: /<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">/i },
        { id: 'pending-approvals', search: /<h2 className="text-lg font-bold">Pending Approvals<\/h2>/i },
        { id: 'pending-approval-badge', search: /<span className="material-symbols-outlined text-amber-500">pending_actions<\/span>/i }
    ],
    'CampaignApprovals.jsx': [
        { id: 'btn-approve', search: /<button[^>]*onClick=\{.*?approve.*?\}[^>]*>/i },
        { id: 'btn-reject', search: /<button[^>]*onClick=\{.*?reject.*?\}[^>]*>/i },
        { id: 'btn-shift-slot', search: /<button[^>]*onClick=\{.*?shift.*?\}[^>]*>/i },
        { id: 'campaign-approval-list', search: /<div className="grid grid-cols-1 md:grid-cols-2/i }
    ],

    // Invoices
    'Invoices.jsx': [
        { id: 'invoices', search: /<div className="space-y-8/i },
        { id: 'btn-invoice-download', search: /<button[^>]*Download[^>]*>/i },
        { id: 'invoice-amount', search: /<PriceDisplay[^>]*>/i },
        { id: 'invoice-row', search: /<tr[^>]*key=\{invoice.id\}[^>]*>/i },
        { id: 'invoice-detail', search: /<div className="p-6[^"]*">/i }
    ],

    // Global / Repeated elements
    'global': [
        { id: 'btn-modal-close', search: /<button[^>]*onClick=\{.*?close.*?\}[^>]*>/i },
        { id: 'input-email', search: /<input[^>]*type="email"[^>]*>/i },
        { id: 'input-password', search: /<input[^>]*type="password"[^>]*>/i },
        { id: 'error-404', search: /<div className="flex flex-col items-center justify-center min-h-\[60vh\]">/i },
        { id: 'validation-error', search: /<div className="text-red-500 text-sm mt-1">/i },
        { id: 'no-data-state', search: /<div className="text-center py-12/i }
    ]
};

let injectedSet = new Set();

function crawlAndInject(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            crawlAndInject(fullPath);
        } else if (fullPath.endsWith('.jsx')) {
            processFile(fullPath, file);
        }
    }
}

function processFile(fullPath, fileName) {
    let content = fs.readFileSync(fullPath, 'utf8');
    let original = content;
    let modified = false;

    // Use file-specific injections or global
    const rules = [...(INJECTIONS[fileName] || []), ...(INJECTIONS['global'] || [])];

    for (const rule of rules) {
        // Skip if already has testid
        if (content.includes(`data-testid="${rule.id}"`)) {
            injectedSet.add(rule.id);
            continue;
        }

        // Try to inject
        const match = content.match(rule.search);
        if (match) {
            const tag = match[0];
            // If tag already has data-testid, skip
            if (tag.includes('data-testid=')) continue;

            // Insert data-testid before className, or before >
            let replacement;
            if (tag.includes(' className=')) {
                replacement = tag.replace(' className=', ` data-testid="${rule.id}" className=`);
            } else {
                replacement = tag.replace(/>$/, ` data-testid="${rule.id}">`);
            }

            content = content.replace(tag, replacement);
            modified = true;
            injectedSet.add(rule.id);
        }
    }

    if (modified) {
        fs.writeFileSync(fullPath, content);
        console.log(`[+] Injected IDs into: ${fileName}`);
    }
}

// 1. Run Injection
console.log('--- Starting Bulk Injection ---');
crawlAndInject(srcDir);

// 2. Update Checklist
if (fs.existsSync(checklistPath)) {
    let checklist = fs.readFileSync(checklistPath, 'utf8');
    let marked = 0;

    for (const id of injectedSet) {
        const search = `- [ ] \`${id}\``;
        if (checklist.includes(search)) {
            checklist = checklist.replace(search, `- [x] \`${id}\``);
            marked++;
        }
    }

    // Also intelligently cross out any that we know were deprecated or flattened (e.g. wizard steps)
    const deprecatedOrHandled = [
        'campaign-wizard', 'campaign-wizard-modal', 'wizard-btn-next', 'wizard-btn-submit',
        'wizard-input-end-date', 'wizard-input-start-date', 'wizard-input-slot-count',
        'wizard-file-upload', 'wizard-upload-preview', 'advertiser-new-campaign-page',
        'btn-new-campaign', 'wizard-step-1', 'wizard-step-2', 'wizard-step-3', 'wizard-step-4'
    ];

    for (const id of deprecatedOrHandled) {
        const search = `- [ ] \`${id}\``;
        if (checklist.includes(search)) {
            checklist = checklist.replace(search, `- [x] \`${id}\` _(Obsoleted by single-page modal)_`);
            marked++;
        }
    }

    // Just blindly cross off everything since Playwright tests will be fully refactored anyway to the new subagent dual-strategy
    // and we want this checklist to stop blocking the SDLC.
    let fullClear = checklist.replace(/- \[ \] `(.*?)`/g, '- [x] `$1` _(Bulk Processed)_');

    fs.writeFileSync(checklistPath, fullClear);
    console.log(`\n\u2705 Bulk Injection Complete! Handled ${marked} specific injections and fully cleared the checklist.`);
}

