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

### 6. Self-Seeding Isolated Test Cycles (E.g. Mitigating Shared DB State Pollution)
*   **The Problem:** Tests share the same Firestore instance and clash with preexisting seed data (e.g. `ALREADY_EXISTS: ent_costco`), causing test suite cascades and false positives depending on execution order.
*   **Loop Engineering Solution:** Automate environment provisioning per test execution, preventing cross-test pollution. Every test run should run inside a clean Firestore emulator session or use dynamically isolated entity namespacing (e.g., prefixing collections or IDs with a unique run ID).
*   **Automated Guardrail (test isolation lifecycle):**
    Instead of manually running database flushes (`/flush`) before running tests, configure unit and integration tests to automatically spin up a fresh, localized emulator memory space or programmatically trigger clear/reset requests:
    ```javascript
    // ad-server/tests/setup.js
    const axios = require('axios');

    beforeEach(async () => {
      if (process.env.FIRESTORE_EMULATOR_HOST) {
        // Programmatically clear emulator Firestore DB before each spec run
        const emulatorUrl = `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/softomedia-live-2026/databases/(default)/documents`;
        await axios.delete(emulatorUrl);
      }
    });
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

