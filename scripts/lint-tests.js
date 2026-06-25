const fs = require('fs');
const path = require('path');

const TESTS_DIR = path.join(__dirname, '../tests');

// Simple regex to catch manual role setting
const MANUAL_ROLE_REGEX = /localStorage\.setItem\(['"`](demo_role|active_persona)['"`]/g;

// Heuristic regex to catch raw JSON returned in page.route
// It looks for route.fulfill or route.continue with inline JSON.stringify({
const RAW_JSON_MOCK_REGEX = /JSON\.stringify\(\s*\{/g;
const PAGE_ROUTE_REGEX = /page\.route\(/g;

let errorsFound = 0;

function walkDir(dir) {
  let files = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      // Skip fixtures directory
      if (file === 'fixtures' || file === 'mocks') continue;
      files = files.concat(walkDir(filePath));
    } else {
      if (filePath.endsWith('.spec.js')) {
        files.push(filePath);
      }
    }
  }
  return files;
}

function lintFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let hasError = false;
  const fileName = path.relative(process.cwd(), filePath);

  // Check Rule 2: Manual Auth State
  let match;
  while ((match = MANUAL_ROLE_REGEX.exec(content)) !== null) {
    console.error(`❌ [Rule 2 Violation] Manual auth state detected in ${fileName}`);
    console.error(`   Found: localStorage.setItem('${match[1]}')`);
    console.error(`   Fix: Use loginAs() or authReset() from demo.fixtures.js or personas.js.\n`);
    hasError = true;
  }

  // Check Rule 1: No Raw Data Mocks
  // If the file uses page.route and JSON.stringify({ together, it's highly likely hardcoding a mock payload
  if (PAGE_ROUTE_REGEX.test(content) && RAW_JSON_MOCK_REGEX.test(content)) {
    console.error(`❌ [Rule 1 Violation] Raw JSON mock detected in ${fileName}`);
    console.error(`   Found: page.route() combined with JSON.stringify({ ... })`);
    console.error(`   Fix: Import a factory builder from tests/fixtures/factories.js or use tests/fixtures/mock-routes.js.\n`);
    hasError = true;
  }

  if (hasError) {
    errorsFound++;
  }
}

console.log('Running test fixture guardrails lint...');
const specFiles = walkDir(TESTS_DIR);

for (const file of specFiles) {
  lintFile(file);
}

if (errorsFound > 0) {
  console.error(`\n🚨 Lint failed: ${errorsFound} files have test fixture violations.`);
  process.exit(1);
} else {
  console.log('✅ All tests pass fixture guardrails.');
}
