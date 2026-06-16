import { Server as HttpServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { RoomManager } from './room-manager';
import { Room, MoveOutcome } from './types';
import { getAIMove } from './gemini-service';
import { createGeminiClient } from './gemini-client';

export function createWebSocketServer(
  httpServer: HttpServer,
  roomManager: RoomManager = new RoomManager()
): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer });
  const clientIds = new Map<WebSocket, string>();
  const socketsByClientId = new Map<string, WebSocket>();
  let nextId = 1;

  function send(socket: WebSocket, payload: unknown): void {
    socket.send(JSON.stringify(payload));
  }

  function findSocket(clientId: string): WebSocket | undefined {
    return socketsByClientId.get(clientId);
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
    socketsByClientId.set(clientId, socket);

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
      const room = roomManager.getRoomByClient(clientId);
      if (room) {
        roomManager.leaveRoom(room.code, clientId);
        broadcast(room, { type: 'opponent_disconnected' }, clientId);
      }
      clientIds.delete(socket);
      socketsByClientId.delete(clientId);
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
      case 'make_move': {
        const room = roomManager.getRoomByClient(clientId);
        if (!room) {
          send(socket, { type: 'error', message: 'No estás en ninguna partida' });
          return;
        }
        try {
          const outcome = roomManager.makeMove(room.code, clientId, msg.column);
          broadcastMoveOutcome(room, outcome);
          if (!outcome.gameOver && room.vsAI) {
            void playAITurn(room.code);
          }
        } catch (err) {
          send(socket, { type: 'error', message: (err as Error).message });
        }
        break;
      }
      case 'request_rematch': {
        const room = roomManager.getRoomByClient(clientId);
        if (!room) return;
        try {
          const accepted = roomManager.requestRematch(room.code, clientId);
          if (accepted) {
            broadcast(room, { type: 'rematch_accepted', board: room.board, currentPlayer: room.currentPlayer });
          }
        } catch (err) {
          send(socket, { type: 'error', message: (err as Error).message });
        }
        break;
      }
      case 'leave_room': {
        const room = roomManager.getRoomByClient(clientId);
        if (room) {
          roomManager.leaveRoom(room.code, clientId);
          broadcast(room, { type: 'opponent_left' }, clientId);
        }
        break;
      }
      default:
        send(socket, { type: 'error', message: `Tipo de mensaje desconocido: ${msg.type}` });
    }
  }

  function broadcastMoveOutcome(room: Room, outcome: MoveOutcome): void {
    broadcast(room, {
      type: outcome.gameOver ? 'game_over' : 'move_made',
      board: outcome.board,
      currentPlayer: room.currentPlayer,
      lastMove: { row: outcome.row, col: outcome.col },
      result: outcome.gameOver,
    });
  }

  async function playAITurn(code: string): Promise<void> {
    const room = roomManager.getRoom(code);
    if (!room) return;

    await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 300));

    const refreshed = roomManager.getRoom(code);
    if (!refreshed || refreshed.status !== 'playing') return;

    const col = await getAIMove(refreshed.board, refreshed.currentPlayer, createGeminiClient());
    const outcome = roomManager.applyAIMove(code, col);
    broadcastMoveOutcome(refreshed, outcome);
  }

  return wss;
}
