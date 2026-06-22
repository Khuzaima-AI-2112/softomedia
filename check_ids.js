const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.jsx')) {
            results.push(file);
        }
    });
    return results;
}

const uiContents = walk('client-app/src').map(f => fs.readFileSync(f, 'utf8'));

// The specific IDs missing from my quick check:
const requiredIds = [
    'schedule-history', 'ticket-dashboard', 'campaign-management',
    'invoices', 'invoice-row', 'advertiser-invoices', 'retailer-dashboard-kpis',
    'admin-campaign-analytics', 'schedule-history-row', 'campaigns-list'
];

for (const id of requiredIds) {
    const found = uiContents.some(content => content.includes(`data-testid="${id}"`));
    console.log(`${id}: ${found ? 'FOUND' : 'MISSING'}`);
}
