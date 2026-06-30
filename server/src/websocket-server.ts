import { Server as HttpServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { RoomManager } from './room-manager';
import { Room, MoveOutcome } from './types';
import { getAIMove } from './gemini-service';
import { createGeminiClient } from './gemini-client';
import { getBestMove } from './minimax';
import { SnakeRoomManager } from './snake/snake-room-manager';

export function createWebSocketServer(
  httpServer: HttpServer,
  roomManager: RoomManager = new RoomManager()
): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clientIds = new Map<WebSocket, string>();
  const socketsByClientId = new Map<string, WebSocket>();
  let nextId = 1;

  function send(socket: WebSocket, payload: unknown): void {
    socket.send(JSON.stringify(payload));
  }

  const snakeRoomManager = new SnakeRoomManager(send);

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
      roomManager.leaveMatchmaking(clientId);
      snakeRoomManager.handleDisconnect(clientId);
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
        const difficulty = msg.difficulty === 'hard' ? 'hard' : 'easy';
        const room = roomManager.createAIRoom(clientId, difficulty);
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
        if (!room) {
          send(socket, { type: 'error', message: 'No estás en ninguna partida' });
          return;
        }
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
      case 'find_match': {
        const room = roomManager.joinMatchmaking(clientId);
        if (room) {
          broadcast(room, { type: 'game_start', board: room.board, currentPlayer: room.currentPlayer });
        } else {
          send(socket, { type: 'searching' });
        }
        break;
      }
      case 'cancel_match': {
        roomManager.leaveMatchmaking(clientId);
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
      case 'snake_create_room': {
        const name = typeof msg.name === 'string' ? msg.name.trim().slice(0, 30) || 'Jugador' : 'Jugador';
        const code = snakeRoomManager.createRoom(clientId, socket, name);
        send(socket, { type: 'snake_room_created', code, yourId: clientId });
        break;
      }
      case 'snake_join_room': {
        const code = typeof msg.code === 'string' ? msg.code : '';
        const name = typeof msg.name === 'string' ? msg.name.trim().slice(0, 30) || 'Jugador' : 'Jugador';
        const joined = snakeRoomManager.joinRoom(code, clientId, socket, name);
        if (!joined) {
          send(socket, { type: 'error', message: 'Esa sala no existe o ya está completa' });
        }
        break;
      }
      case 'snake_direction': {
        const validDirections = ['up', 'down', 'left', 'right'];
        if (validDirections.includes(msg.direction)) {
          snakeRoomManager.handleDirection(clientId, msg.direction);
        }
        break;
      }
      case 'snake_rematch': {
        snakeRoomManager.handleRematch(clientId);
        break;
      }
      case 'snake_leave_room': {
        snakeRoomManager.handleLeave(clientId);
        break;
      }
      case 'snake_play_vs_ai': {
        const name = typeof msg.name === 'string' ? msg.name.trim().slice(0, 30) || 'Jugador' : 'Jugador';
        snakeRoomManager.createAIRoom(clientId, socket, name);
        break;
      }
      case 'snake_owner_start': {
        snakeRoomManager.ownerStart(clientId);
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
    try {
      const room = roomManager.getRoom(code);
      if (!room) return;

      await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 300));

      const refreshed = roomManager.getRoom(code);
      if (!refreshed || refreshed.status !== 'playing') return;

      const col = refreshed.aiDifficulty === 'hard'
        ? getBestMove(refreshed.board, refreshed.currentPlayer)
        : await getAIMove(refreshed.board, refreshed.currentPlayer, createGeminiClient());
      const outcome = roomManager.applyAIMove(code, col);
      broadcastMoveOutcome(refreshed, outcome);
    } catch (err) {
      console.warn(`Error al ejecutar el turno de la IA en la sala ${code}:`, err);
      const room = roomManager.getRoom(code);
      if (room) {
        broadcast(room, { type: 'error', message: 'La IA no pudo realizar su jugada' });
      }
    }
  }

  return wss;
}
