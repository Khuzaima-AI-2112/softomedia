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

// Generate the markdown content
const mdContent = `# Playwright Test IDs — TRUE Missing Checklist
The following \`data-testid\` hooks are required by the Playwright suite (\`*_locators.js\` or specs) but are physically missing from the React GUI source code. 
These MUST be injected inside \`client-app/src\` components before the Massive E2E suite can pass.

## Missing UI Tags
${missing.map(id => `- [ ] \`${id}\``).join('\n')}
`;

fs.writeFileSync('current_sprint/playwright_testids_TRUE_checklist.md', mdContent);
console.log("Checklist generated!");
