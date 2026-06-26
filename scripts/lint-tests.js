const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const TESTS_DIR = path.join(__dirname, '../tests');

// Simple regex to catch manual role setting (we'll keep regex for this simple check)
const MANUAL_ROLE_REGEX = /localStorage\.setItem\(['"`](demo_role|active_persona)['"`]/g;

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

  // Check Rule 2: Manual Auth State (Regex is fine for this specific API call)
  let match;
  while ((match = MANUAL_ROLE_REGEX.exec(content)) !== null) {
    console.error(`❌ [Rule 2 Violation] Manual auth state detected in ${fileName}`);
    console.error(`   Found: localStorage.setItem('${match[1]}')`);
    console.error(`   Fix: Use loginAs() or authReset() from demo.fixtures.js or personas.js.\n`);
    hasError = true;
  }

  // Check Rule 1: No Raw Data Mocks using AST
  try {
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx']
    });

    traverse(ast, {
      CallExpression(nodePath) {
        const callee = nodePath.node.callee;
        
        // Detect page.route(..., () => ...)
        if (
          callee.type === 'MemberExpression' &&
          callee.object.name === 'page' &&
          callee.property.name === 'route'
        ) {
          // Now check if ANY child node inside this route call contains JSON.stringify
          nodePath.traverse({
            CallExpression(childPath) {
              const childCallee = childPath.node.callee;
              if (
                childCallee.type === 'MemberExpression' &&
                childCallee.object.name === 'JSON' &&
                childCallee.property.name === 'stringify'
              ) {
                console.error(`❌ [Rule 1 Violation] Raw JSON mock detected in ${fileName}`);
                console.error(`   Found: page.route() combined with inline JSON.stringify()`);
                console.error(`   Fix: Import a factory builder from tests/fixtures/factories.js or use tests/fixtures/mock-routes.js.\n`);
                hasError = true;
                childPath.stop(); // Stop traversing this route call once we found one
              }
            }
          });
        }
      }
    });
  } catch (err) {
    console.error(`⚠️ [Parser Error] Could not parse AST for ${fileName}: ${err.message}`);
  }

  if (hasError) {
    errorsFound++;
  }
}

console.log('Running test fixture guardrails lint via AST analysis...');
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
