const fs = require('fs');
const path = require('path');

console.log("🔍 Running Pre-Deployment Verification...");

// 1. Verify Sacred Files exist (Document Permanence Rule)
const sacredFiles = ['docs/LESSONS_LEARNED.md', 'docs/CHANGELOG.md'];
for (const file of sacredFiles) {
    if (!fs.existsSync(file)) {
        console.error(`❌ [Pre-Deploy Error] Sacred file missing: ${file}`);
        console.error(`   This file is protected by Document Permanence rules.`);
        process.exit(1);
    }
}
console.log("  ✅ Sacred documentation files verified.");

// 2. Verify Monorepo Sub-packages
const requiredPackageFiles = ['ad-server/package.json', 'client-app/package.json'];
for (const pFile of requiredPackageFiles) {
    if (!fs.existsSync(pFile)) {
        console.error(`❌ [Pre-Deploy Error] Sub-package file missing: ${pFile}`);
        process.exit(1);
    }
}
console.log("  ✅ Sub-package architecture verified.");

// 3. Environment Template Verification
if (!fs.existsSync('.env.example')) {
    console.error("❌ [Pre-Deploy Error] Missing '.env.example' template file.");
    process.exit(1);
}

// 4. Local Environment Warning (if not running in Cloud Build / CI)
const isCI = process.env.BUILD_ID || process.env.CI || process.env.PROJECT_ID;
if (!isCI) {
    const hasLocalEnv = fs.existsSync('.env.development') || fs.existsSync('.env');
    if (!hasLocalEnv) {
        console.warn("⚠️  [Pre-Deploy Warning] Neither '.env.development' nor '.env' file found.");
        console.warn("   Run 'cp .env.example .env.development' to configure local environment variables.");
    } else {
        console.log("  ✅ Local environment file detected.");
    }
} else {
    console.log("  ✅ Cloud Build / CI execution environment detected.");
}

console.log("✅ Pre-deployment checks passed cleanly.");
process.exit(0);

