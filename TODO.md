# TODO

## 🚫 Deployment Blockers (Must Fix Before Deploy)

### ESLint Configuration
- [ ] Create `.eslintrc.cjs` in `client-app/` directory
- [ ] Ensure `npm run lint` passes with zero errors

### Deployment Infrastructure
- [ ] Create `cloudbuild.yaml` for GCP Cloud Build
- [ ] Create `verify_predeploy.js` script (referenced in Deployment_Guide.md)

### Critical Test Failures
- [ ] Fix 6 failing Playwright tests (personas.spec.js, integration_gold_path.spec.js)

---

## High Priority

### Fix Gold Path Integration Test
- [ ] Debug why `integration_gold_path.spec.js` "Admin to Brand to Retailer" journey fails
- [ ] Investigate persona switcher navigation timing
- [ ] Update `personas.spec.js` to use `data-testid` instead of `data-test`

## Medium Priority

### Testing Improvements
- [ ] Add accessibility (a11y) tests with `@axe-core/playwright`
- [ ] Expand visual regression coverage to Admin and Retailer dashboards
- [ ] Add CI/CD quality gate for UI smoke tests

### Performance
- [ ] Configure CSP headers in `index.html`
- [ ] Add real backend connectivity checks to `Health.jsx`

## Low Priority

### Documentation
- [ ] Create architecture diagram for persona/routing flow
- [ ] Document testing strategy for new contributors
