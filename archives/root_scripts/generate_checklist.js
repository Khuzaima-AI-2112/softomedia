const fs = require('fs');
const path = require('path');

const locators = new Set();

const demoWizFiles = fs.readdirSync('tests/demo_wizard');
for (const f of demoWizFiles) {
    if (f.endsWith('_locators.js')) {
        const text = fs.readFileSync(`tests/demo_wizard/${f}`, 'utf8');
        // Extract dictionary values: prop: 'some-value'
        const matches = [...text.matchAll(/:\s*'([a-z0-9\-]+)'/g)];
        matches.forEach(m => locators.add(m[1]));
    }
    if (f.endsWith('.spec.js')) {
        const text = fs.readFileSync(`tests/demo_wizard/${f}`, 'utf8');
        // Extract inline overrides
        const matches = [...text.matchAll(/data-testid="([a-z0-9\-]+)"/g)];
        matches.forEach(m => locators.add(m[1]));
    }
}

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
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

const missing = [];
for (const id of locators) {
    if (id.length < 3) continue;
    if (!allUiText.includes(id)) {
        missing.push(id);
    }
}

// Generate the report
console.log("=== Missing data-testid Properties ===");
if (missing.length === 0) {
    console.log("All locators are correctly mapped in client-app!");
} else {
    console.log(`Found ${missing.length} missing locators in client-app:`);
    missing.forEach(id => console.log(` - ${id}`));
}

