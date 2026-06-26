const fs = require('fs');
const path = require('path');

// 1. Extract required locators from tests/demo_wizard
const locators = [];
const demoWizFiles = fs.readdirSync('tests/demo_wizard');

for (const f of demoWizFiles) {
    if (f.endsWith('.js')) {
        const text = fs.readFileSync(`tests/demo_wizard/${f}`, 'utf8');
        // Find locator dictionary values: e.g. Login: 'nav-login', 
        // or data-testid="something"
        const dictMatches = [...text.matchAll(/'([a-z0-9\-]+)'/g)];
        dictMatches.forEach(m => locators.push(m[1]));

        const inlineMatches = [...text.matchAll(/data-testid="([^"]+)"/g)];
        inlineMatches.forEach(m => locators.push(m[1]));
    }
}

// Keep only likely test IDs (lowercase alphanumeric and hyphens, len > 3)
const reqIds = [...new Set(locators)].filter(id =>
    id.length > 3 && /^[a-z0-9\-]+$/.test(id) && !id.includes('.') && !id.includes('/')
);

// 2. Scan UI codebase
function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(fullPath));
        } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
            results.push(fullPath);
        }
    });
    return results;
}

const uiFiles = walk('client-app/src');
let allUiText = '';
for (const f of uiFiles) {
    allUiText += fs.readFileSync(f, 'utf8') + '\n';
}

// 3. Find missing
const missing = [];
for (const id of reqIds) {
    if (!allUiText.includes(id)) {
        missing.push(id);
    }
}

console.log("=== MISSING LOCATORS ===");
console.log(missing.sort().join('\n'));
