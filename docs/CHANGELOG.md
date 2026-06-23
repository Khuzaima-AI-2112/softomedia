# Changelog

## [Unreleased]

### Fixed
- Fixed Vite proxy configuration to default to ad-server port 8080 instead of dormant port 3001.
- Fixed nested /loops API routes resolving to 404 by properly nesting them under /locations router.
- Fixed Playwright configuration to ensure demo wizard tests run strictly under the isolated demo-wizard profile, eliminating concurrent race conditions.
- Fixed duplicate imports syntax error in 08_retailer_approval.spec.js.
- Fixed missing AdminOverview data-testid locator in test definitions.
- Fixed infinite retry loop in Player.jsx during E2E tests caused by 403 network connection refusals dropping into the reconnect flow.

