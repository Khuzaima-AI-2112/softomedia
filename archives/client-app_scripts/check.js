/* eslint-env node */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

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

const files = walk('src');
for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    try {
        esbuild.transformSync(code, { loader: 'jsx' });
    } catch (e) {
        console.error('ERROR in', file);
        console.error(e.message);
    }
}
