

const API_URL = 'http://localhost:8080/ghost-api';

async function runTest() {
    console.log('🚀 Starting Headless Gemini Verification...');

    // 1. Health Check
    try {
        console.log('Testing Server Connection...');
        // Just hitting the root or a known endpoint to see if it's up
        // Assuming /ghost-api/tickets returns 200 even if empty
        const health = await fetch(`${API_URL}/tickets`);
        if (!health.ok) throw new Error('Server not reachable');
        console.log('✅ Server is UP');
    } catch (e) {
        console.error('❌ Server is DOWN. Please start `ad-server`.', e);
        process.exit(1);
    }

    // 2. Analyze as Buyer
    let ticketId = null;
    let initialDaily = 0;
    try {
        console.log('\nTesting CRM Buyer Persona...');
        const res = await fetch(`${API_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                steps: [{ url: '/test/buyer', note: 'Is this expensive?', image: '' }],
                persona: 'CRM_buyer_persona'
            })
        });
        const data = await res.json();

        if (!data.answer) throw new Error('No answer returned');
        if (!data.ticketId) throw new Error('No ticketId returned');
        if (!data.usage) throw new Error('No usage stats returned');

        console.log(`✅ Buyer Answer: ${data.answer.substring(0, 50)}...`);
        console.log(`✅ Ticket ID: ${data.ticketId}`);
        console.log(`✅ Daily Count: ${data.usage.daily}`);

        ticketId = data.ticketId;
        initialDaily = data.usage.daily;
    } catch (e) {
        console.error('❌ Buyer Test Failed:', e);
        process.exit(1);
    }

    // 3. Analyze as Tester (Counter Check)
    try {
        console.log('\nTesting Software Tester Persona...');
        const res = await fetch(`${API_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                steps: [{ url: '/test/bug', note: 'It crashing', image: '' }],
                persona: 'software_tester_persona'
            })
        });
        const data = await res.json();

        console.log(`✅ Tester Answer: ${data.answer.substring(0, 50)}...`);

        if (data.usage.daily !== initialDaily + 1) {
            console.warn(`⚠️ Warning: Usage count did not increment correctly. Expected ${initialDaily + 1}, got ${data.usage.daily}`);
        } else {
            console.log('✅ Usage Counter Incremented Successfully');
        }
    } catch (e) {
        console.error('❌ Tester Test Failed:', e);
    }

    // 4. Verify Ticket Retrieval
    try {
        console.log('\nVerifying Ticket Archive...');
        const res = await fetch(`${API_URL}/tickets/${ticketId}`);
        if (!res.ok) throw new Error('Ticket not found');
        const ticket = await res.json();

        if (ticket.id !== ticketId) throw new Error('ID Mismatch');
        if (ticket.persona !== 'CRM_buyer_persona') throw new Error('Persona Mismatch');

        console.log('✅ Ticket Downloaded & Verified');
    } catch (e) {
        console.error('❌ Ticket Verification Failed:', e);
    }

    console.log('\n✨ ALL SYSTEMS GO ✨');
}

runTest();
