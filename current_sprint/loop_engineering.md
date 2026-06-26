# Loop Engineering in Software Development

**Loop Engineering** is the practice of identifying repetitive development patterns, cognitive loads, or manual verification steps in your workflow and codifying them into automated, continuous loops. 

Instead of relying on human vigilance (e.g., developers remembering architecture conventions or prompt instructions), you engineer programmatic rules, AST linting checks, or contract specifications that shorten the feedback loop.

Here are specific examples of how you can apply Loop Engineering to automate coding and prompting logic, directly drawn from the issues documented in the codebase:

---

### 1. Codifying Architectural Boundaries (E.g. Restricting Native `fetch()`)
*   **The Problem:** Developers bypassed the central `apiClient` singleton and invoked native `fetch()`, which missed authorization headers and broke the E2E state.
*   **Loop Engineering Solution:** Instead of adding "Remember to use the API client" to a developer handbook (or prompt guideline), write an ESLint static analysis rule to enforce it.
*   **Automated Guardrail:** Add this custom rule definition to `client-app/.eslintrc.cjs`:
    ```javascript
    module.exports = {
      rules: {
        'no-restricted-globals': ['error', {
          name: 'fetch',
          message: 'Direct fetch calls bypass authentication interceptors. Use apiClient from "@/services/api" instead.'
        }]
      }
    };
    ```

---

### 2. Static Middleware Audit (E.g. Preventing Route Gate Omission)
*   **The Problem:** A status transition route (`PATCH /api/campaigns/:id/status`) had `requireRole('retaileradmin')` applied but was missing the preceding `authenticate` middleware, causing `req.user` to be unpopulated and returning `403 Forbidden` to everyone.
*   **Loop Engineering Solution:** Automate middleware dependency analysis at commit/build time by walking the Abstract Syntax Tree (AST) of the router file to flag unsafe ordering.
*   **Automated Guardrail (audit-routes.js):**
    ```javascript
    const fs = require('fs');
    const parser = require('@babel/parser');
    const traverse = require('@babel/traverse').default;

    function auditRouterFile(filePath) {
      const code = fs.readFileSync(filePath, 'utf8');
      const ast = parser.parse(code, { sourceType: 'module' });

      traverse(ast, {
        CallExpression(path) {
          const callee = path.node.callee;
          // Check for router handler methods (e.g., router.patch, router.post)
          if (callee.object?.name === 'router' && ['get', 'post', 'put', 'patch', 'delete'].includes(callee.property?.name)) {
            const middlewareArgs = path.node.arguments.slice(1, -1);
            
            const hasRequireRole = middlewareArgs.some(arg => arg.name === 'requireRole' || arg.callee?.name === 'requireRole');
            const hasAuthenticate = middlewareArgs.some(arg => arg.name === 'authenticate');

            if (hasRequireRole && !hasAuthenticate) {
              console.error(`❌ [Security Alert] File: ${filePath} contains requireRole() but is missing authenticate!`);
              process.exit(1);
            }
          }
        }
      });
    }
    ```

---

### 3. Contract Synchronization (E.g. Mock/Real JWT Payload Divergence)
*   **The Problem:** The client-side mock user had `linked_entity_id`, but the backend demo bypass generated a structurally incomplete `req.user` object, creating a silent database corruption where campaigns were written with `advertiser_id: null`.
*   **Loop Engineering Solution:** Declare a single source of truth contract (e.g., a shared TypeScript interface or Zod validation schema) that both production code and test mocks import.
*   **Automated Guardrail (shared contract):**
    ```typescript
    // shared/contracts/user.ts
    import { z } from 'zod';

    export const UserPayloadSchema = z.object({
        id: z.string(),
        email: z.string().email(),
        name: z.string(),
        role: z.enum(['superadmin', 'admin', 'techoperator', 'retaileradmin', 'brand', 'advertiser']),
        linked_entity_id: z.string()
    });

    export type UserPayload = z.infer<typeof UserPayloadSchema>;
    ```
    If a developer adds a new role or metadata field to user sessions, the TypeScript compiler or schema checker will immediately fail compilation on any mock file (such as `auth.js` demo token overrides) that has not implemented the field, forcing mock/real parity.

---

### 4. Prompt Engineering Automation (E.g. "Do Not Overwrite Sacred Files")
*   **The Problem:** System instructions are long, causing the model to occasionally drop constraints (like Document Permanence rules).
*   **Loop Engineering Solution:** Put the critical constraints inside a local script or git hook that checks files before commit.
*   **Automated Guardrail (Pre-commit hook for sacred files):**
    Instead of telling the AI agent in a prompt "never delete lessons_learned.md", install a git pre-commit hook that rejects deletions of these files programmatically:
    ```bash
    # .git/hooks/pre-commit
    #!/bin/sh
    # Check if LESSONS_LEARNED.md is being deleted or truncated significantly
    if git diff --name-only | grep -q "LESSONS_LEARNED.md"; then
        line_diff=$(git diff --numstat LESSONS_LEARNED.md | awk '{print $2}')
        if [ "$line_diff" -gt 100 ]; then
            echo "❌ ERROR: Large deletion detected in LESSONS_LEARNED.md. This file is sacred."
            exit 1
        fi
    fi
    ```

---

### 5. Config Schema Contract Validation (E.g. Preventing Missing Production Keys)
*   **The Problem:** The missing `GEMINI_API_KEY` env variable in production led to immediate 500 errors in the `ghost-api` endpoint, which went unnoticed during local development where the key was present in the `.env` file.
*   **Loop Engineering Solution:** Do not wait for a user to trigger a broken feature to discover missing configurations. Enforce strict configuration contracts at application boot time, crashing the server immediately if key env variables are missing.
*   **Automated Guardrail (config-contract.js):**
    ```javascript
    // ad-server/src/config/env.js
    const { z } = require('zod');

    const envSchema = z.object({
      NODE_ENV: z.enum(['development', 'production', 'test']),
      PORT: z.string().default('8080'),
      JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
      GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required for AI walkthrough features"),
      ALLOW_DEMO_MODE: z.preprocess(val => val === 'true', z.boolean()).default(false)
    });

    const parsed = envSchema.safeParse(process.env);

    if (!parsed.success) {
      console.error("❌ Invalid environment configuration:", parsed.error.format());
      process.exit(1);
    }

    module.exports = parsed.data;
    ```

---

### 6. Sequential Global Self-Seeding Test Cycles (E.g. Mitigating Shared DB State Pollution)
*   **The Problem:** Tests share the same Firestore instance and clash with preexisting seed data (e.g. `ALREADY_EXISTS: ent_costco`), causing test suite cascades and false positives depending on execution order.
*   **Loop Engineering Solution:** Automate environment provisioning globally before the test suite runs. Trigger an endpoint that programmatically clears existing data **and** immediately runs the database seed service, ensuring the test run begins with a guaranteed, fresh seed state. Enforce sequential execution (`workers: 1`) to prevent cascading database contamination during the run rather than restructuring for per-test isolation.
*   **Automated Guardrail (dev-only reset endpoint, global setup integration, and sequential execution):**
    Expose a development-only reset endpoint in the backend API and configure the test framework's global setup hooks to call it before executing any spec files. Additionally, enforce `workers: 1` in `playwright.config.js`:
    ```javascript
    // ad-server/src/api/debug.js (Development-only route)
    router.post('/reset', async (req, res) => {
      if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_MODE !== 'true') {
        return res.status(403).json({ error: 'Denied' });
      }
      const db = getFirestore();
      for (const collection of COLLECTIONS) {
        await deleteCollection(db, collection); // Batch delete all documents
      }
      clearMockStorage(); // Clear in-memory singleton Maps
      await seedDatabase(); // Populate default seed entities
      res.status(200).json({ status: 'success' });
    });

    // tests/global.setup.js (Playwright global setup)
    async function globalSetup(config) {
      console.log('🔄 Resetting database to clean seeded state...');
      const res = await fetch('http://localhost:8080/api/debug/reset', { method: 'POST' });
      if (!res.ok) throw new Error('Database reset failed');
      console.log('✅ Clean database re-seeded successfully.');
    }
    ```

---

### 7. Workflow Manifest Verification (E.g. Avoiding Orphaned Scripts in CI)
*   **The Problem:** Smoke tests and verification runs failed (`MODULE_NOT_FOUND`) because CI workflows/commands pointed to non-existent scripts (e.g., `verify_predeploy.js`), leaving verification gaps.
*   **Loop Engineering Solution:** Add a static linter step that parses pipeline files (`cloudbuild.yaml`, `.github/workflows/*`, etc.) and cross-references any referenced local command/script with files on disk.
*   **Automated Guardrail (audit-ci-scripts.js):**
    ```javascript
    const fs = require('fs');
    const yaml = require('js-yaml');
    const path = require('path');

    function auditWorkflowCommands() {
      const buildConfig = yaml.load(fs.readFileSync('./cloudbuild.yaml', 'utf8'));
      buildConfig.steps.forEach(step => {
        if (step.name === 'gcr.io/cloud-builders/npm' && step.args) {
          const runCmd = step.args.join(' ');
          // Parse script references, e.g., 'node scripts/xyz.js' or 'npm run abc'
          const nodeScriptMatches = runCmd.match(/node\s+([a-zA-Z0-9_\-\.\/]+)/g);
          if (nodeScriptMatches) {
            nodeScriptMatches.forEach(match => {
              const scriptPath = match.replace('node', '').trim();
              if (scriptPath.endsWith('.js') && !fs.existsSync(path.resolve(scriptPath))) {
                console.error(`❌ [Orphaned Script Alert] CloudBuild references non-existent node script: ${scriptPath}`);
                process.exit(1);
              }
            });
          }
        }
      });
    }
    auditWorkflowCommands();
    ```

---

### 8. Playwright AST Linter for Unique test-ids (E.g. Preventing Strict Mode Collisions)
*   **The Problem:** Nested UI components wrapping a global component (like `StatusBadge` carrying its own `data-testid="campaign-status"`) resulted in locator strict mode exceptions when query paths matched multiple identical test-ids.
*   **Loop Engineering Solution:** Automate duplicate element detection. A loop should check for non-unique locator definitions within single UI component trees, or raise errors when a generic badge is declared with a hardcoded global `data-testid` instead of leaving that to the parent page.
*   **Automated Guardrail (Static Test ID Enforcement):**
    Write an ESLint custom rule to prevent raw, hardcoded string test-ids on highly reusable sub-components, forcing developers to accept them as dynamic props:
    ```javascript
    // client-app/.eslintrc.cjs custom rule snippet
    'react/no-reusable-hardcoded-testid': {
      meta: {
        messages: {
          noHardcodedTestId: "Reusable child components (e.g., StatusBadge) must not hardcode 'data-testid'. Pass it dynamically as a prop from the parent component instead."
        }
      },
      create(context) {
        return {
          JSXAttribute(node) {
            if (node.name.name === 'data-testid' && node.value.type === 'Literal') {
              const filename = context.getFilename();
              if (filename.includes('src/components/')) {
                context.report({ node, messageId: 'noHardcodedTestId' });
              }
            }
          }
        };
      }
    }
    ```

---

### 9. Deferring Env Evaluation to Avoid ESM Hoisting Bugs
*   **The Problem:** ES Module (ESM) resolution statically parses and executes imports before running script files. Top-level statements like `const ALLOW_DEMO = process.env.ALLOW_DEMO_MODE === 'true';` are evaluated *before* the entry script (e.g., `server.js`) can call `dotenv.config()`, resulting in `undefined` configuration values.
*   **Loop Engineering Solution:** Defer the resolution of environment variables to request/evaluation time (e.g., within route handler scopes, getters, or config resolution helpers) instead of executing them statically at module load time.
*   **Automated Guardrail (Dynamic Env Getters):**
    Ensure environment checks are encapsulated in getters or functions:
    ```javascript
    // ad-server/src/api/schedules.js
    router.get('/', (req, res) => {
        // Evaluated at request time, safely after dotenv.config() has loaded
        const allowDemo = process.env.ALLOW_DEMO_MODE === 'true';
        if (allowDemo) {
            // handle demo logic
        }
    });
    ```

---

### 10. Mock Map Reference Retention vs Re-assignment
*   **The Problem:** Backend repositories often cache references to in-memory mock storage objects at load time. Reassigning or deleting the root reference keys (e.g., `MOCK_STORAGE = {}` or `delete MOCK_STORAGE[key]`) breaks connection to the active singleton repositories initialized during startup.
*   **Loop Engineering Solution:** Keep the storage reference object constant and clear its values internally (using `Map.prototype.clear()`) rather than reassigning the map or deleting keys.
*   **Automated Guardrail (Reference-safe Mock Purge):**
    Implement a safe reset function that purges the contents of existing Maps without breaking references:
    ```javascript
    // ad-server/src/repositories/BaseRepository.js
    export function clearMockStorage() {
        // Safe: clears entries inside the Map while retaining the object reference
        MOCK_STORAGE.clear();
    }
    ```

---

### 11. Fail-Fast Test Preflight Audits
*   **The Problem:** Executing E2E test suites when the backend server or the database emulator is offline launches hundreds of browser processes that immediately timeout, consuming local CPU resources and generating useless log noise.
*   **Loop Engineering Solution:** Integrate a preflight health check script that verifies all dependencies and emulators are listening on their respective ports, halting execution immediately if they are unreachable.
*   **Automated Guardrail (test-preflight.js):**
    Before booting Playwright, run a lightweight validation script:
    ```javascript
    // scripts/test-preflight.js
    const http = require('http');

    function checkPort(port, name) {
      return new Promise((resolve, reject) => {
        const req = http.request({ host: 'localhost', port, path: '/health', method: 'GET', timeout: 2000 }, (res) => {
          if (res.statusCode === 200) resolve();
          else reject(new Error(`${name} returned status ${res.statusCode}`));
        });
        req.on('error', () => reject(new Error(`${name} is offline`)));
        req.end();
      });
    }

    Promise.all([
      checkPort(8080, 'Ad Server'),
      checkPort(8090, 'Firestore Emulator')
    ]).catch(err => {
      console.error(`❌ Preflight check failed: ${err.message}`);
      process.exit(1);
    });
    ```

---

### 12. Dedicated Test Linter Rules
*   **The Problem:** Developers sometimes hardcode mock JSON responses or manual authentication sequences directly inside spec files, fracturing the centralized testing architecture and leading to silent test drifts.
*   **Loop Engineering Solution:** Introduce an automated script to lint test files, using pattern matching or AST analysis to reject files containing raw mocks or manual storage bypasses.
*   **Automated Guardrail (lint-tests.js):**
    Add a script to lint the test specs before execution:
    ```javascript
    // scripts/lint-tests.js
    const fs = require('fs');
    const path = require('path');

    const testsDir = path.resolve(__dirname, '../tests');
    const specFiles = fs.readdirSync(testsDir).filter(f => f.endsWith('.spec.js'));

    specFiles.forEach(file => {
      const content = fs.readFileSync(path.join(testsDir, file), 'utf8');
      if (content.includes('JSON.stringify') && content.includes('page.route')) {
        console.error(`❌ [Lint Error] File ${file} uses inline JSON.stringify within page.route(). Use factories instead.`);
        process.exit(1);
      }
      if (content.includes('localStorage.setItem') && content.includes('auth_token')) {
        console.error(`❌ [Lint Error] File ${file} sets auth token manually. Use loginAs() helper instead.`);
        process.exit(1);
      }
    });
    ```

---

### 13. Playwright Actionability & Floating UI Interception
*   **The Problem:** E2E tests utilizing Playwright's actionability checks (e.g., `locator.click()`) fail intermittently or consistently because floating UI elements (like a sticky chat widget or the Gemini AI helper) overlay the target element, causing a "subtree intercepts pointer events" error. 
*   **Loop Engineering Solution:** Instead of polluting individual test files with `{ force: true }` (which bypasses actionability and can mask real visibility bugs) or manual `addStyleTag` calls that reset upon navigation (or fail if executed before the DOM head exists), programmatically disable the rendering of non-essential UI elements globally for the entire test environment using an injected environment flag.
*   **Automated Guardrail (Global Init Script Injection & App Environment Check):**
    Inject a global `window` flag via Playwright's `addInitScript` in `test.beforeEach` or `global.setup.js` to ensure the state persists across all page navigations:
    ```javascript
    // tests/personas.spec.js
    test.beforeEach(async ({ page }) => {
        // Globally flag the environment as a Playwright test
        await page.addInitScript(() => {
            window.__PLAYWRIGHT_TEST__ = true;
        });
    });
    ```
    Then, in the React application's widget loader, intercept this flag to bypass rendering entirely:
    ```javascript
    // client-app/src/components/SafeWidgetLoader.jsx
    const SafeWidgetLoader = () => {
        const isTestEnv = typeof window !== 'undefined' && window.__PLAYWRIGHT_TEST__;
        if (isTestEnv) return null; // Invisible in Playwright

        return <GeminiWidget />;
    };
    ```
