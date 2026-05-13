import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';

console.log('--- Starting Pre-deployment Check ---');

const isWindows = os.platform() === 'win32';

// 1. Check for hardcoded URLs (cross-platform)
console.log('Checking for hardcoded Cloud Run URLs...');
try {
  let output = '';
  if (isWindows) {
    // Windows: use findstr
    try {
      output = execSync(
        'findstr /s /i /r "https://ad-server-.*\\.run\\.app https://client-app-.*\\.run\\.app" *.yaml *.js *.jsx *.json *.md',
        { stdio: ['pipe', 'pipe', 'pipe'] }
      ).toString();
    } catch (e) {
      // findstr exit code 1 means no matches
      output = '';
    }
  } else {
    // Linux/Mac (Cloud Build): use grep
    try {
      output = execSync(
        "grep -r -E 'https://(ad-server|client-app)-[a-z0-9]+\\.run\\.app' " +
          "--include='*.yaml' --include='*.js' --include='*.jsx' --include='*.json' --include='*.md' " +
          "--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist " +
          "--exclude='deployment_log.md' --exclude='lessons_learned.md' --exclude='changelog.md' " +
          "--exclude='AGENTS.md' --exclude='DEPLOYMENT_README.md' --exclude='DEPLOY_GUIDE.md' " +
          "--exclude='verify_predeploy.js' " +
          ".",
        { stdio: ['pipe', 'pipe', 'pipe'] }
      ).toString();
    } catch (e) {
      // grep exit code 1 means no matches
      output = '';
    }
  }

  if (output && output.trim().length > 0) {
    console.error('ERROR: Hardcoded Cloud Run URLs found in source files:');
    console.error(output);
    console.error('Per AGENTS.md Rule 9.12: Hardcoded run.app URLs must be removed before deploy.');
    process.exit(1);
  }
  console.log('  ✓ No hardcoded run.app URLs found in source files.');
} catch (e) {
  console.error('Pre-deploy URL scan failed:', e.message);
  process.exit(1);
}

// 2. Verify deployment_log.md exists
console.log('Reviewing deployment_log.md...');
if (!fs.existsSync('deployment_log.md')) {
  console.error('ERROR: deployment_log.md not found.');
  process.exit(1);
}
console.log('  ✓ deployment_log.md present.');

// 3. Verify required cloudbuild.yaml files exist
console.log('Verifying cloudbuild.yaml files...');
const required = ['cloudbuild.yaml', 'ad-server/Dockerfile', 'client-app/Dockerfile'];
for (const f of required) {
  if (!fs.existsSync(f)) {
    console.error(`ERROR: required file missing: ${f}`);
    process.exit(1);
  }
}
console.log('  ✓ All required deployment files present.');

console.log('--- Pre-deployment Check Passed ---');
process.exit(0);
