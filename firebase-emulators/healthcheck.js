// Docker HEALTHCHECK for the Firebase emulator suite: healthy once Auth,
// Firestore and Storage all accept TCP connections.
const net = require('net');

const ports = [9099 /* Auth */, 8090 /* Firestore */, 9199 /* Storage */];

function checkPort(port) {
    return new Promise((resolve, reject) => {
        const socket = net.createConnection({ port, host: '127.0.0.1' });
        socket.setTimeout(2000);
        socket.once('connect', () => {
            socket.destroy();
            resolve();
        });
        socket.once('timeout', () => {
            socket.destroy();
            reject(new Error(`timed out connecting to port ${port}`));
        });
        socket.once('error', reject);
    });
}

Promise.all(ports.map(checkPort))
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
