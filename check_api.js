
const https = require('https');

function get(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        }).on('error', reject);
    });
}

(async () => {
    const baseUrl = 'https://ad-server-902866748272.us-central1.run.app';

    console.log('Seeding...');
    const seed = await get(`${baseUrl}/api/debug/seed`);
    console.log('Seed Status:', seed.status);
    console.log('Seed Body:', seed.body);

    console.log('\nFetching Ads...');
    const ads = await get(`${baseUrl}/api/ads`);
    console.log('Ads Status:', ads.status);
    console.log('Ads Body:', ads.body);
})();
