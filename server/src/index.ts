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

app.use(express.static(path.join(__dirname, '../../client/dist/client/browser')));

const httpServer = http.createServer(app);
createWebSocketServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Conecta4 server escuchando en el puerto ${PORT}`);
});
