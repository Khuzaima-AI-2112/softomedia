# Predeployment Checklist

> [!IMPORTANT]
> Complete ALL checks before deploying to production.

## 1. Build Verification

- [ ] **Client Build**: Run `npm run build` in `client-app/` - must complete without errors
- [ ] **Bundle Size**: Verify bundle < 200kB gzipped
- [ ] **Ad Server**: Run `npm start` in `ad-server/` - server should start without errors

## 2. Code Quality

- [ ] **ESLint**: Run `npm run lint` in `client-app/` - zero warnings/errors
- [ ] **No Console Logs**: Remove `console.log` statements from production code
- [ ] **No TODO Comments**: Review and resolve critical TODOs

## 3. Testing

- [ ] **Unit Tests**: All unit tests pass
- [ ] **Integration Tests**: `npx playwright test --project=chromium` - all tests green
- [ ] **Visual Regression**: Check screenshots in `tests/screenshots/`

## 4. Configuration

- [ ] **Environment Variables**: Verify all required env vars are set
- [ ] **API Endpoints**: Confirm production API URLs are correct
- [ ] **Feature Flags**: Review and confirm feature flag states

## 5. Security

- [ ] **Secrets**: No hardcoded secrets in codebase
- [ ] **CORS**: Verify CORS configuration for production domains
- [ ] **Rate Limiting**: Confirm rate limits are appropriate for production

## 6. Documentation

- [ ] **Changelog**: Update `changelog.md` with release notes
- [ ] **README**: Verify setup instructions are current

## 7. Deployment

- [ ] **Cloud Build**: Verify `cloudbuild.yaml` is configured
- [ ] **Rollback Plan**: Document rollback procedure if issues arise

---

## Quick Commands

```bash
# Full predeployment check sequence
cd client-app && npm run build && npm run lint
cd ../ad-server && npm start &
cd .. && npx playwright test --project=chromium
```

## Sign-off

| Check | Completed | Date | Notes |
|-------|-----------|------|-------|
| Build | [ ] | | |
| Tests | [ ] | | |
| Review | [ ] | | |
