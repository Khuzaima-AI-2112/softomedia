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

const files = walk('client-app/src');

const targets = {
    'TicketDashboard.jsx': 'ticket-dashboard',
    'CampaignManagement.jsx': 'campaign-management',
    'Invoices.jsx': 'invoices',
    'RetailerDashboard.jsx': 'retailer-dashboard-kpis',
    'LoopAnalytics.jsx': 'admin-campaign-analytics',
    'AdvertiserCampaigns.jsx': 'campaigns-list'
};

for (const file of files) {
    const name = path.basename(file);
    if (targets[name]) {
        let content = fs.readFileSync(file, 'utf8');
        const testid = `data-testid="${targets[name]}"`;
        if (!content.includes(testid)) {
            // Find the first main div (usually space-y-8 or similar)
            const patterns = [
                ' className="space-y-8 animate-in fade-in duration-500"',
                ' className="grid grid-cols-1 md:grid-cols-4 gap-4"',
                ' className="space-y-'
            ];
            for (const p of patterns) {
                if (content.includes(p)) {
                    content = content.replace(p, ` ${testid}${p}`);
                    fs.writeFileSync(file, content);
                    console.log(`Updated ${name} with ${testid}`);
                    break;
                }
            }
        } else {
            console.log(`Already has ${testid} in ${name}`);
        }
    }
}
