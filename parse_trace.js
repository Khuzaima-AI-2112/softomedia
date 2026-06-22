const fs = require('fs');

const raw = fs.readFileSync('trace-out/0-trace.network', 'utf8');

raw.split('\n').forEach(line => {
    if (!line) return;
    try {
        const entry = JSON.parse(line);
        // We are looking for response objects or resource snapshots that might have response bodies
        if (entry.method === 'POST' && entry.url && entry.url.includes('/api/retailers')) {
            console.log('REQUEST POST /api/retailers:', entry);
        }
    } catch (e) { }
});

raw.split('\n').forEach(line => {
    if (!line) return;
    try {
        const entry = JSON.parse(line);
        if (entry.type === 'resource-snapshot') {
            if (entry.snapshot && entry.snapshot.response && entry.snapshot.request.url.includes('/api/retailers')) {
                console.log('RESPONSE:', entry.snapshot.response.status, entry.snapshot.response.content);
            }
        }
    } catch (e) { }
});
