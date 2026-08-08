import http from 'http';
import app from './app';
import { setupWebSocketServer } from './websocket';

const PORT = parseInt(process.env.PORT || '3000', 10);
const server = http.createServer(app);

// Attach WebSocket server
setupWebSocketServer(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡ VibeSphere Gen Z Chat & Daily Highlights server running on port ${PORT}`);
});
