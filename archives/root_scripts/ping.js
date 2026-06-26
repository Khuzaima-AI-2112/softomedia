async function run() {
    try {
        const res = await fetch('http://127.0.0.1:3001/api/retailers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer demo-token', 'x-demo-role': 'admin' },
            body: JSON.stringify({ name: 'FreshMart', logo: '🏪', contact_email: 'x@x.ca', contract_start: '2026-06-19' })
        });
        console.log(res.status);
        console.log(await res.text());
    } catch (err) {
        console.log('Error', err);
    }
}
run();
