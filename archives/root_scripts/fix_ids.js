const fs = require('fs');
const path = require('path');

const targets = [
    { file: 'src/pages/retailer/ScheduleHistory.jsx', search: ' className="space-y-8 animate-in fade-in duration-500"', replace: ' data-testid="schedule-history" className="space-y-8 animate-in fade-in duration-500"' },
    { file: 'src/pages/admin/TicketDashboard.jsx', search: ' className="space-y-8 animate-in fade-in duration-500"', replace: ' data-testid="ticket-dashboard" className="space-y-8 animate-in fade-in duration-500"' },
    { file: 'src/pages/admin/CampaignManagement.jsx', search: ' className="space-y-8 animate-in fade-in duration-500"', replace: ' data-testid="campaign-management" className="space-y-8 animate-in fade-in duration-500"' },
    { file: 'src/pages/brand/Invoices.jsx', search: ' className="space-y-8 animate-in fade-in duration-500"', replace: ' data-testid="invoices" className="space-y-8 animate-in fade-in duration-500"' },
    { file: 'src/pages/retailer/RetailerDashboard.jsx', search: ' className="grid grid-cols-1 md:grid-cols-4 gap-4"', replace: ' data-testid="retailer-dashboard-kpis" className="grid grid-cols-1 md:grid-cols-4 gap-4"' },
    { file: 'src/pages/admin/CampaignAnalytics.jsx', search: ' className="space-y-8 animate-in fade-in duration-500"', replace: ' data-testid="admin-campaign-analytics" className="space-y-8 animate-in fade-in duration-500"' },
    { file: 'src/pages/brand/AdvertiserCampaigns.jsx', search: ' className="space-y-8 animate-in fade-in duration-500"', replace: ' data-testid="campaigns-list" className="space-y-8 animate-in fade-in duration-500"' }
];

targets.forEach(t => {
    const p = path.join('client-app', t.file);
    if (fs.existsSync(p)) {
        let content = fs.readFileSync(p, 'utf8');
        if (!content.includes(t.replace)) {
            content = content.replace(t.search, t.replace);
            fs.writeFileSync(p, content);
            console.log(`Updated ${t.file}`);
        } else {
            console.log(`Already checked ${t.file}`);
        }
    } else {
        console.log(`File not found: ${t.file}`);
    }
});
