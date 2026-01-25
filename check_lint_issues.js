
const fs = require('fs');
const path = require('path');
// glob removed

function findFiles(dir, extension) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(findFiles(file, extension));
        } else {
            if (file.endsWith(extension)) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = findFiles('client-app/src', '.jsx');
const jsFiles = findFiles('client-app/src', '.js');
const allFiles = [...files, ...jsFiles];

console.log('Checking ' + allFiles.length + ' files...');

allFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');

    // Check for pricingService
    if (content.includes('pricingService') && !content.includes('import pricingService') && !content.includes('const pricingService =')) {
        // Check if it's not just a comment
        // Simple heuristic: check if pricingService appears NOT in a comment
        // For now, simple check.
        console.log(`[MISSING IMPORT] ${file}`);
    }

    // Check for unescaped entities (heuristic)
    // defined as ' s or ' t or similar inside > < tags?
    // eslint catches typical ones.
    // I won't implement full JSX parsing here, but I can trust the previous lint logs for unescaped entities were likely in BrandDashboard or Step5?
});
