import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

interface ExtendedWebSocket extends WebSocket {
  isAlive?: boolean;
  userId?: number;
  username?: string;
  channelSlug?: string;
}

export function setupWebSocketServer(server: HTTPServer) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: ExtendedWebSocket) => {
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data: string) => {
      try {
        const payload = JSON.parse(data.toString());

        switch (payload.type) {
          case 'JOIN_CHANNEL':
            ws.channelSlug = payload.channelSlug;
            ws.username = payload.username;
            ws.userId = payload.userId;
            break;

          case 'CHAT_MESSAGE':
            // Broadcast to everyone in the same channel
            wss.clients.forEach((client: ExtendedWebSocket) => {
              if (
                client.readyState === WebSocket.OPEN &&
                client.channelSlug === payload.channelSlug
              ) {
                client.send(JSON.stringify({
                  type: 'NEW_MESSAGE',
                  message: payload.message
                }));
              }
            });
            break;

          case 'MESSAGE_EDITED':
            wss.clients.forEach((client: ExtendedWebSocket) => {
              if (
                client.readyState === WebSocket.OPEN &&
                client.channelSlug === payload.channelSlug
              ) {
                client.send(JSON.stringify({
                  type: 'MESSAGE_EDITED',
                  message: payload.message
                }));
              }
            });
            break;

          case 'MESSAGE_DELETED':
            wss.clients.forEach((client: ExtendedWebSocket) => {
              if (
                client.readyState === WebSocket.OPEN &&
                client.channelSlug === payload.channelSlug
              ) {
                client.send(JSON.stringify({
                  type: 'MESSAGE_DELETED',
                  messageId: payload.messageId
                }));
              }
            });
            break;

          case 'REACTION_UPDATE':
            wss.clients.forEach((client: ExtendedWebSocket) => {
              if (
                client.readyState === WebSocket.OPEN &&
                client.channelSlug === payload.channelSlug
              ) {
                client.send(JSON.stringify({
                  type: 'REACTION_UPDATED',
                  messageId: payload.messageId,
                  reactions: payload.reactions
                }));
              }
            });
            break;

          case 'TYPING_INDICATOR':
            wss.clients.forEach((client: ExtendedWebSocket) => {
              if (
                client !== ws &&
                client.readyState === WebSocket.OPEN &&
                client.channelSlug === payload.channelSlug
              ) {
                client.send(JSON.stringify({
                  type: 'USER_TYPING',
                  username: ws.username,
                  isTyping: payload.isTyping
                }));
              }
            });
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('WebSocket message parsing error:', err);
      }
    });
  });

  const interval = setInterval(() => {
    wss.clients.forEach((client: ExtendedWebSocket) => {
      if (client.isAlive === false) return client.terminate();
      client.isAlive = false;
      client.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  return wss;
}
