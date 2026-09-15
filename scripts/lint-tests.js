const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

/**
 * Browser journeys prove behaviour through real Firebase sign-in and the real
 * API, so a spec may neither fake a session nor intercept the API or Firebase
 * Authentication.
 */
const TESTS_DIR = path.join(__dirname, '../tests');

const FAKE_SESSION_KEYS = /localStorage\.setItem\(\s*['"`](authToken|auth_token|auth_user|demo_role|active_persona)['"`]/g;
const INTERCEPTED_TARGET = /\/api\b|identitytoolkit|securetoken/;

let errorsFound = 0;

function specFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'firestore-rules' ? [] : specFiles(filePath);
    return filePath.endsWith('.spec.js') ? [filePath] : [];
  });
}

function lintFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.relative(process.cwd(), filePath);
  const violations = [];

  for (const match of content.matchAll(FAKE_SESSION_KEYS)) {
    violations.push(`fakes a session with localStorage '${match[1]}'; sign in through the login page instead`);
  }

  try {
    const ast = parser.parse(content, { sourceType: 'module', plugins: ['jsx'] });
    traverse(ast, {
      CallExpression({ node }) {
        const { callee } = node;
        const isRoute = callee.type === 'MemberExpression'
          && ['route', 'routeFromHAR'].includes(callee.property.name);
        const [target] = node.arguments;
        const pattern = target?.type === 'StringLiteral' ? target.value
          : target?.type === 'RegExpLiteral' ? target.pattern
            : target?.type === 'TemplateLiteral' ? target.quasis.map(quasi => quasi.value.raw).join('*')
              : null;
        if (isRoute && (pattern === null || INTERCEPTED_TARGET.test(pattern))) {
          violations.push(`intercepts ${pattern ?? 'a computed route'} at line ${node.loc.start.line}; use the real API`);
        }
      },
    });
  } catch (err) {
    violations.push(`could not be parsed: ${err.message}`);
  }

  for (const violation of violations) console.error(`❌ ${fileName} ${violation}`);
  if (violations.length > 0) errorsFound++;
}

console.log('Checking browser journeys for faked sessions and API interception...');
specFiles(TESTS_DIR).forEach(lintFile);

if (errorsFound > 0) {
  console.error(`\n🚨 ${errorsFound} spec file(s) fake a session or intercept the API.`);
  process.exit(1);
}
console.log('✅ Every browser journey uses real sign-in and the real API.');
