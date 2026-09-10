import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { createWebSocketServer } from './websocket-server';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const clientDist = path.join(__dirname, '../../client-react/dist');
app.use(express.static(clientDist));

// SPA fallback so client-side routes (e.g. /snake, /conecta4) work on direct load/refresh
app.get(/^(?!\/health|\/ws).*/, (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const httpServer = http.createServer(app);
createWebSocketServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Conecta4 server escuchando en el puerto ${PORT}`);
});
