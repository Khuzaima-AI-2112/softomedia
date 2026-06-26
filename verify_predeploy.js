const fs = require('fs');

console.log("Running Pre-Deployment Verification...");

// 1. Verify Sacred Files exist
const sacredFiles = ['docs/LESSONS_LEARNED.md', 'docs/CHANGELOG.md'];
for (const file of sacredFiles) {
    if (!fs.existsSync(file)) {
        console.error(`❌ [Pre-Deploy Error] Sacred file missing: ${file}`);
        console.error(`   This file is protected by Document Permanence rules.`);
        process.exit(1);
    }
}

// 2. Add other CI checks here as needed
console.log("✅ Pre-deployment checks passed.");
process.exit(0);
