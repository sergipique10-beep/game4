import { Server as HttpServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { RoomManager } from './room-manager';
import { Room } from './types';

export function createWebSocketServer(
  httpServer: HttpServer,
  roomManager: RoomManager = new RoomManager()
): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer });
  const clientIds = new Map<WebSocket, string>();
  let nextId = 1;

  function send(socket: WebSocket, payload: unknown): void {
    socket.send(JSON.stringify(payload));
  }

  function findSocket(clientId: string): WebSocket | undefined {
    for (const [socket, id] of clientIds.entries()) {
      if (id === clientId) return socket;
    }
    return undefined;
  }

  function broadcast(room: Room, payload: unknown, excludeId?: string): void {
    for (const player of room.players) {
      if (player.id === excludeId) continue;
      const socket = findSocket(player.id);
      if (socket) send(socket, payload);
    }
  }

  wss.on('connection', (socket: WebSocket) => {
    const clientId = `client-${nextId++}`;
    clientIds.set(socket, clientId);

    socket.on('message', (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        send(socket, { type: 'error', message: 'Mensaje inválido' });
        return;
      }
      handleMessage(socket, clientId, msg);
    });

    socket.on('close', () => {
      clientIds.delete(socket);
    });
  });

  function handleMessage(socket: WebSocket, clientId: string, msg: any): void {
    switch (msg.type) {
      case 'create_room': {
        const room = roomManager.createRoom(clientId);
        send(socket, { type: 'room_created', code: room.code });
        break;
      }
      case 'join_room': {
        const room = roomManager.joinRoom(msg.code, clientId);
        if (!room) {
          send(socket, { type: 'error', message: 'Esa sala no existe o ya está completa' });
          return;
        }
        broadcast(room, { type: 'opponent_joined' }, clientId);
        broadcast(room, { type: 'game_start', board: room.board, currentPlayer: room.currentPlayer });
        break;
      }
      case 'play_vs_ai': {
        const room = roomManager.createAIRoom(clientId);
        send(socket, { type: 'game_start', board: room.board, currentPlayer: room.currentPlayer });
        break;
      }
      default:
        send(socket, { type: 'error', message: `Tipo de mensaje desconocido: ${msg.type}` });
    }
  }

  return wss;
}
