import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import { createApiApp } from './server/app.ts';
import { getFullQuizState } from './server/db.ts';
import type { ServerWsMessage } from './src/types/quiz.ts';

let wss: WebSocketServer | null = null;

function broadcastWs(message: ServerWsMessage): void {
  if (!wss) return;
  const raw = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(raw);
      } catch {
        // Ignore broken WebSocket client
      }
    }
  }
}

const app = createApiApp({ onBroadcast: broadcastWs });
const server = http.createServer(app);
wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', async (ws) => {
  try {
    const state = await getFullQuizState();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'state:sync',
          payload: state,
        } satisfies ServerWsMessage)
      );
    }
  } catch {
    // Ignore transient sync error during handshake
  }
});

async function startServer(): Promise<void> {
  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(process.cwd(), 'dist');

  if (isProd) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, '0.0.0.0', () => {
    console.log(`QUIZ CHAMPION LIVE server listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
