---
description: Pre-deployment checks for softomedia-live2026
---

1. Verify Google Cloud project is set correctly
// turbo
```bash
gcloud config get-value project --project softomedia-live-2026
```

2. Ensure there are no uncommitted changes
// turbo
```bash
git status --porcelain
```

3. Run linting to catch code style issues
// turbo
```bash
npm run lint
```

4. Execute unit and integration test suites
// turbo
```bash
npm test
```

5. Perform a security audit of dependencies
// turbo
```bash
npm audit
```

6. Build the application for production
// turbo
```bash
npm run build
```

7. Verify build artifacts exist and are not empty
// turbo
```bash
ls -lh dist/ || echo "No dist folder found"
```

8. Confirm Firebase configuration points to the correct project
// turbo
```bash
firebase projects:list --project softomedia-live-2026
```

9. Run any custom pre‑deployment scripts (if any)
// turbo
```bash
npm run predeploy
```
