const fs = require('fs');

function extractLocators() {
    const locators = [];
    const files = fs.readdirSync('tests/demo_wizard').filter(f => f.endsWith('_locators.js'));
    for (const f of files) {
        const text = fs.readFileSync(`tests/demo_wizard/${f}`, 'utf8');
        const matches = [...text.matchAll(/'([^']+)'/g)]; // all single quoted strings
        matches.forEach(m => locators.push(m[1]));
    }
    // also grab any direct data-testid="" in specs
    const specs = fs.readdirSync('tests/demo_wizard').filter(f => f.endsWith('.spec.js'));
    for (const f of specs) {
        const text = fs.readFileSync(`tests/demo_wizard/${f}`, 'utf8');
        const matches = [...text.matchAll(/data-testid="([^"]+)"/g)];
        matches.forEach(m => locators.push(m[1]));
    }
    return [...new Set(locators)]; // unique
}

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
            results.push(file);
        }
    });
    return results;
}

const req = extractLocators();
const uiFiles = walk('client-app/src');
let allUiText = '';
for (const f of uiFiles) {
    allUiText += fs.readFileSync(f, 'utf8') + '\n';
}

const missing = [];
for (const id of req) {
    // Ignore locators that aren't data-testids (like URLs, simple strings, etc)
    if (id.includes('/') || id.includes(' ') || id.length < 3) continue;

    // Exact match `data-testid="ID"` or `` data-testid={`ID...`} ``
    // We just check if the ID string exists in the UI code
    if (!allUiText.includes(id)) {
        missing.push(id);
    }
}
console.log("Possibly missing test IDs:");
console.log(missing.join('\n'));
