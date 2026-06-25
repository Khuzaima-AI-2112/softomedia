const http = require('http');

async function checkPort(port, host = 'localhost', path = '/') {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}${path}`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => {
      resolve(false);
    });
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function runPreflight() {
  console.log('✈️  Running E2E Preflight Checks...');

  // Check Backend
  const backendPort = process.env.PORT || 8080;
  const isBackendUp = await checkPort(backendPort, 'localhost', '/health');
  if (!isBackendUp) {
    console.error(`❌ [Preflight Error] Backend is not responding on port ${backendPort} at /health.`);
    console.error(`   Please run the backend server before starting E2E tests.`);
    process.exit(1);
  } else {
    console.log(`✅ Backend responding on port ${backendPort}`);
  }

  console.log('✅ Preflight Checks Passed. Ready for E2E Tests.\n');
}

runPreflight();
