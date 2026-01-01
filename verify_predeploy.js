/**
 * verify_predeploy.js
 * Pre-deployment verification script
 * Run before deploying to ensure configuration is correct
 */

const fs = require('fs');
const path = require('path');

const checks = [];
let hasErrors = false;

function check(name, condition, errorMessage) {
    if (condition) {
        checks.push({ name, status: '✅ PASS' });
    } else {
        checks.push({ name, status: '❌ FAIL', error: errorMessage });
        hasErrors = true;
    }
}

console.log('\n🔍 Running Pre-Deployment Verification...\n');

// Check 1: Client app build output exists
const clientDistPath = path.join(__dirname, 'client-app', 'dist');
check(
    'Client Build',
    fs.existsSync(clientDistPath),
    'client-app/dist not found. Run: cd client-app && npm run build'
);

// Check 2: Ad-server entry point exists
const adServerIndex = path.join(__dirname, 'ad-server', 'index.js');
check(
    'Ad-Server Entry',
    fs.existsSync(adServerIndex),
    'ad-server/index.js not found'
);

// Check 3: No hardcoded localhost in ad-server
if (fs.existsSync(adServerIndex)) {
    const adServerContent = fs.readFileSync(adServerIndex, 'utf8');
    const hasLocalhost = /localhost:\d+/.test(adServerContent) && !/process\.env/.test(adServerContent);
    check(
        'No Hardcoded Localhost',
        !hasLocalhost,
        'ad-server/index.js contains hardcoded localhost without env fallback'
    );
}

// Check 4: Package.json files exist
check(
    'Client package.json',
    fs.existsSync(path.join(__dirname, 'client-app', 'package.json')),
    'client-app/package.json not found'
);

check(
    'Ad-Server package.json',
    fs.existsSync(path.join(__dirname, 'ad-server', 'package.json')),
    'ad-server/package.json not found'
);

// Check 5: Dockerfiles exist (or warn)
const clientDockerfile = path.join(__dirname, 'client-app', 'Dockerfile');
const adServerDockerfile = path.join(__dirname, 'ad-server', 'Dockerfile');

if (!fs.existsSync(clientDockerfile)) {
    checks.push({ name: 'Client Dockerfile', status: '⚠️ WARN', error: 'Dockerfile not found - will need for Cloud Run' });
}

if (!fs.existsSync(adServerDockerfile)) {
    checks.push({ name: 'Ad-Server Dockerfile', status: '⚠️ WARN', error: 'Dockerfile not found - will need for Cloud Run' });
}

// Check 6: ESLint config exists
check(
    'ESLint Config',
    fs.existsSync(path.join(__dirname, 'client-app', '.eslintrc.cjs')),
    'client-app/.eslintrc.cjs not found'
);

// Print results
console.log('─'.repeat(50));
checks.forEach(c => {
    console.log(`${c.status}  ${c.name}`);
    if (c.error) console.log(`      └── ${c.error}`);
});
console.log('─'.repeat(50));

if (hasErrors) {
    console.log('\n❌ Pre-deployment checks FAILED\n');
    process.exit(1);
} else {
    console.log('\n✅ All pre-deployment checks passed!\n');
    process.exit(0);
}
