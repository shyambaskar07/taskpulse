import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

class WebSocketManager {
  private wss: WebSocketServer | null = null;

  public init(server: http.Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Connected to TaskPulse Live Metrics Stream' }));

      ws.on('message', (msg) => {
        try {
          const parsed = JSON.parse(msg.toString());
          if (parsed.type === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
          }
        } catch (err) {
          // ignore
        }
      });
    });
  }

  public broadcast(type: string, data: any) {
    if (!this.wss) return;

    const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }
}

export const wsManager = new WebSocketManager();
