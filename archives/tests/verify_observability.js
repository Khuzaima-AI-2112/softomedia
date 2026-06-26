
const API_URL = 'http://localhost:8080';

async function verifyTelemetry() {
    console.log('🔍 Verifying Observability Endpoints...');

    // 1. Test Client Error Reporting Endpoint
    try {
        console.log('1. Testing POST /api/telemetry/error...');
        const payload = {
            message: 'Test Error from Verification Script',
            stack: 'Error: Test\n    at verifyObservability.js:10:1',
            componentStack: 'in TestComponent',
            url: 'http://localhost:5174/test',
            userAgent: 'TestRunner/1.0'
        };

        const response = await fetch(`${API_URL}/api/telemetry/error`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.status === 200) {
            console.log('   ✅ Endpoint is active and returned 200 OK');
            const data = await response.json();
            console.log('   ✅ Response:', data);
        } else {
            console.error(`   ❌ Failed with status: ${response.status}`);
            if (response.status === 404) {
                console.error('      (Did you remember to restart the ad-server?)');
            }
        }
    } catch (error) {
        console.error('   ❌ Network Error:', error.message);
    }
}

verifyTelemetry();
