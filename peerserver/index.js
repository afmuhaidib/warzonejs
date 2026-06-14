const { PeerServer } = require('peer');

const PORT = process.env.PORT || 9000;

const server = PeerServer({
  port: PORT,
  path: '/peerjs',
  proxied: true,
  allow_discovery: false,
  corsOptions: { origin: '*' },
});

server.on('connection', (client) => console.log('[peer] connected:', client.getId()));
server.on('disconnect', (client) => console.log('[peer] disconnected:', client.getId()));

console.log('PeerJS server on port', PORT);
