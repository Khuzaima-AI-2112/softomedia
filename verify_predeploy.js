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

// Check 1: Client app build output exists (skip in CI/Cloud Build)
const isCI = process.env.PROJECT_ID || process.env.BUILD_ID || process.env.CI || process.env.GCP_PROJECT;
const clientDistPath = path.join(__dirname, 'client-app', 'dist');

if (!isCI) {
    check(
        'Client Build',
        fs.existsSync(clientDistPath),
        'client-app/dist not found. Run: cd client-app && npm run build'
    );
} else {
    console.log('⏭️  Skipping local build check in CI environment');
}

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

// Check 7: No Hardcoded Absolute Paths (Safeguard)
function scanForAbsolutePaths(dir) {
    let found = false;
    const files = fs.readdirSync(dir);

    for (const file of files) {
        if (file.startsWith('node_modules') || file.startsWith('.')) continue;

        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (scanForAbsolutePaths(fullPath)) found = true;
        } else if (file.endsWith('.js')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            // Look for C:\Users or /Users/ (mac/linux home)
            if (/C:\\Users/i.test(content) || /\/Users\//.test(content)) {
                // Allow our own verification script to have it (false positive prevention)
                if (file === 'verify_predeploy.js') continue;

                check(
                    `No Hardcoded Paths in ${file}`,
                    false,
                    `Found hardcoded absolute path in ${fullPath}`
                );
                found = true;
            }
        }
    }
    return found;
}

console.log('Scanning for hardcoded absolute paths...');
scanForAbsolutePaths(path.join(__dirname, 'ad-server'));

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
