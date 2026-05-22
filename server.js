const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

let localC2Socket = null;
const pendingRequests = new Map();

// Parse raw body for ALL methods
app.use(express.raw({ type: '*/*', limit: '10mb' }));

app.all('*', (req, res) => {
    if (!localC2Socket) {
        return res.status(503).send("Local C2 is offline. Tunnel closed.");
    }

    const reqId = uuidv4();
    const requestData = {
        id: reqId,
        method: req.method,
        url: req.originalUrl,
        headers: req.headers,
        body: req.body ? req.body.toString('base64') : null
    };

    // Store response object to fulfill it later
    pendingRequests.set(reqId, res);

    // Send the request down the WebSocket tunnel
    localC2Socket.emit('http_request', requestData);

    // Timeout after 15 seconds
    setTimeout(() => {
        if (pendingRequests.has(reqId)) {
            pendingRequests.delete(reqId);
            if (!res.headersSent) {
                res.status(504).send("Gateway Timeout: Local C2 did not respond in time.");
            }
        }
    }, 15000);
});

io.on('connection', (socket) => {
    socket.on('identify', (role) => {
        if (role === 'local_c2') {
            localC2Socket = socket;
            console.log('Local Team Server (C2) connected securely!');
        }
    });

    socket.on('http_response', (data) => {
        const { id, status, headers, bodyBase64 } = data;
        const res = pendingRequests.get(id);
        
        if (res) {
            pendingRequests.delete(id);
            if (!res.headersSent) {
                if (headers) {
                    // Filter out chunked encoding because we are sending the whole body
                    delete headers['transfer-encoding'];
                    res.set(headers);
                }
                res.status(status || 200);
                
                if (bodyBase64) {
                    res.send(Buffer.from(bodyBase64, 'base64'));
                } else {
                    res.end();
                }
            }
        }
    });

    socket.on('disconnect', () => {
        if (socket === localC2Socket) {
            localC2Socket = null;
            console.log('Local Team Server (C2) went offline.');
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Render HTTP Tunnel Redirector running on port ${PORT}`);
});
