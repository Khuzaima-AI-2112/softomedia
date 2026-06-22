const fs = require('fs');
const path = require('path');

const projectRoot = 'c:/Users/ChrisFro/Desktop/EmoGini/softomedia-live2026';
const locatorsDir = path.join(projectRoot, 'tests/demo_wizard');
const srcDir = path.join(projectRoot, 'client-app/src');

// 1. Parse locators
const requiredTestIds = new Set();
const locatorFiles = ['admin_locators.js', 'brand_locators.js', 'retailer_locators.js', 'wizard_locators.js'];

for (const file of locatorFiles) {
    const content = fs.readFileSync(path.join(locatorsDir, file), 'utf-8');
    // regex to find string values inside the object: key: 'value', or "value"
    const regex = /:\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        requiredTestIds.add(match[1]);
    }
}

console.log(`Found ${requiredTestIds.size} required locators in dictionaries.`);

// 2. Scan source code for existing data-testids
const existingTestIds = new Set();
const fileMap = new Map(); // to help guess where a missing locator should go

function scanDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            scanDir(fullPath);
        } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            // Look for data-testid="..." or data-testid={`...`}
            const regexStr = /data-testid=['"]([^'"]+)['"]/g;
            let match;
            while ((match = regexStr.exec(content)) !== null) {
                existingTestIds.add(match[1]);
            }
            
            // Also look for dynamic ones data-testid={`prefix-${var}`}
            const regexDyn = /data-testid=\{`([^$]+)\$/g;
            while ((match = regexDyn.exec(content)) !== null) {
                existingTestIds.add(match[1].replace(/-$/, '')); // store prefix
            }
            
            // store words to help guess file mapping
            const words = fullPath.toLowerCase().split(/[\/\\]/);
            fileMap.set(fullPath, words[words.length-1]);
        }
    }
}

scanDir(srcDir);
console.log(`Found ${existingTestIds.size} existing locators in source code.`);

// 3. Find missing
const missing = [];
for (const testId of requiredTestIds) {
    let found = false;
    if (existingTestIds.has(testId)) {
        found = true;
    } else {
        // check if any dynamic prefix matches (e.g. invoice-row- -> invoice-row)
        for (const existing of existingTestIds) {
            if (testId.startsWith(existing)) {
                found = true;
                break;
            }
        }
    }
    
    if (!found) {
        missing.push(testId);
    }
}

console.log(`\n--- MISSING LOCATORS (${missing.length}) ---`);
for (const m of missing) {
    console.log(m);
}
