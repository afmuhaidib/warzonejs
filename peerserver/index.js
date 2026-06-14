import { PeerServer } from 'peer';

const PORT = process.env.PORT || 9000;

const server = PeerServer({
  port: PORT,
  path: '/peerjs',
  allow_discovery: false,
  proxied: true,
  cors_options: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

server.on('connection', (client) => {
  console.log(`[peer] connected: ${client.getId()}`);
});

server.on('disconnect', (client) => {
  console.log(`[peer] disconnected: ${client.getId()}`);
});

console.log(`PeerJS server listening on port ${PORT}`);
