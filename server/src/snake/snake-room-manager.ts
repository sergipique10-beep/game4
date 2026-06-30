import { WebSocket } from 'ws';
import * as Engine from './snake-engine';
import { GameState, Direction, SnakeRanking } from './snake-types';
import { getBotDirection } from './snake-ai';

const BOT_ID = '__bot__';

interface SnakeRoom {
  code: string;
  state: GameState;
  clients: Map<string, WebSocket>;
  names: Map<string, string>;
  interval: ReturnType<typeof setInterval> | null;
  status: 'waiting' | 'countdown' | 'playing' | 'finished';
  rematchReadyIds: Set<string>;
  ownerId: string;
  isAI: boolean;
  botId: string | null;
}

export class SnakeRoomManager {
  private rooms = new Map<string, SnakeRoom>();
  private clientToRoom = new Map<string, string>();

  constructor(private send: (ws: WebSocket, payload: object) => void) {}

  createRoom(clientId: string, ws: WebSocket, name: string): string {
    const code = this.generateCode();
    let state = Engine.createGameState();
    state = Engine.spawnSnake(state, clientId);
    state = Engine.generateFood(state, Engine.FOOD_COUNT);
    const room: SnakeRoom = {
      code,
      state,
      clients: new Map([[clientId, ws]]),
      names: new Map([[clientId, name]]),
      interval: null,
      status: 'waiting',
      rematchReadyIds: new Set(),
      ownerId: clientId,
      isAI: false,
      botId: null,
    };
    this.rooms.set(code, room);
    this.clientToRoom.set(clientId, code);
    return code;
  }

  createAIRoom(clientId: string, ws: WebSocket, name: string): void {
    const code = this.generateCode();
    let state = Engine.createGameState();
    state = Engine.spawnSnake(state, clientId);
    state = Engine.spawnSnake(state, BOT_ID);
    state = Engine.generateFood(state, Engine.FOOD_COUNT);
    const room: SnakeRoom = {
      code,
      state,
      clients: new Map([[clientId, ws]]),
      names: new Map([[clientId, name], [BOT_ID, 'IA']]),
      interval: null,
      status: 'waiting',
      rematchReadyIds: new Set(),
      ownerId: clientId,
      isAI: true,
      botId: BOT_ID,
    };
    this.rooms.set(code, room);
    this.clientToRoom.set(clientId, code);
    this.send(ws, { type: 'snake_room_created', code, yourId: clientId });
    this.startGame(room);
  }

  joinRoom(code: string, clientId: string, ws: WebSocket, name: string): boolean {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'waiting' || room.clients.size >= 8 || room.isAI) return false;
    room.state = Engine.spawnSnake(room.state, clientId);
    room.clients.set(clientId, ws);
    room.names.set(clientId, name);
    this.clientToRoom.set(clientId, code);
    this.broadcastAll(room, {
      type: 'snake_player_joined',
      playerId: clientId,
      playerCount: room.clients.size,
    });
    return true;
  }

  ownerStart(clientId: string): void {
    const room = this.getClientRoom(clientId);
    if (!room) return;
    if (room.ownerId !== clientId) return;
    if (room.status !== 'waiting') return;
    if (room.clients.size < 2) return;
    this.startCountdown(room);
  }

  handleDirection(clientId: string, direction: Direction): void {
    const room = this.getClientRoom(clientId);
    if (!room || room.status !== 'playing') return;
    room.state = Engine.setDirection(room.state, clientId, direction);
  }

  handleDisconnect(clientId: string): void {
    const room = this.getClientRoom(clientId);
    if (!room) return;
    room.clients.delete(clientId);
    this.clientToRoom.delete(clientId);

    room.rematchReadyIds.delete(clientId);

    if (room.status === 'finished' && room.rematchReadyIds.size === room.clients.size && room.clients.size > 0) {
      this.resetGame(room);
      return;
    }

    if (room.status === 'waiting') {
      this.broadcastAll(room, { type: 'error', message: 'El anfitrión se ha desconectado' });
      this.destroyRoom(room);
      return;
    }

    if (room.status === 'countdown' && room.clients.size < 2) {
      this.broadcastAll(room, { type: 'error', message: 'Un jugador se ha desconectado antes de empezar' });
      this.destroyRoom(room);
      return;
    }

    this.broadcastAll(room, { type: 'snake_player_left', playerId: clientId });
    room.state = {
      ...room.state,
      snakes: room.state.snakes.map(s => s.id === clientId ? { ...s, alive: false } : s),
    };

    if (room.clients.size === 0) { this.destroyRoom(room); return; }

    const alive = room.state.snakes.filter(s => s.alive).length;
    if (room.status === 'playing' && alive <= 1 && room.state.snakes.length > 1) {
      this.endGame(room);
    }
  }

  handleLeave(clientId: string): void {
    this.handleDisconnect(clientId);
  }

  handleRematch(clientId: string): void {
    const room = this.getClientRoom(clientId);
    if (!room || room.status !== 'finished') return;
    room.rematchReadyIds.add(clientId);
    if (room.rematchReadyIds.size === room.clients.size) this.resetGame(room);
  }

  // ── private ────────────────────────────────────────────────────────────────

  private startCountdown(room: SnakeRoom): void {
    room.status = 'countdown';
    let seconds = 3;
    room.interval = setInterval(() => {
      if (seconds > 0) {
        this.broadcastAll(room, { type: 'snake_countdown', seconds });
        seconds--;
      } else {
        if (room.interval) clearInterval(room.interval);
        room.interval = null;
        this.startGame(room);
      }
    }, 1000);
  }

  private startGame(room: SnakeRoom): void {
    room.status = 'playing';
    for (const [clientId, ws] of room.clients) {
      this.send(ws, {
        type: 'snake_game_start',
        state: Engine.getSerializedState(room.state),
        yourId: clientId,
      });
    }
    room.interval = setInterval(() => this.gameTick(room), 120);
  }

  private gameTick(room: SnakeRoom): void {
    if (room.isAI && room.botId) {
      const humanId = [...room.clients.keys()].find(id => id !== room.botId) ?? '';
      if (humanId) {
        const dir = getBotDirection(room.state, room.botId, humanId);
        room.state = Engine.setDirection(room.state, room.botId, dir);
      }
    }

    const { state, deaths } = Engine.tick(room.state);
    room.state = state;
    for (const d of deaths) {
      this.broadcastAll(room, { type: 'snake_player_died', playerId: d.id, score: d.score });
    }
    this.broadcastAll(room, { type: 'snake_game_tick', state: Engine.getSerializedState(state) });
    const alive = state.snakes.filter(s => s.alive).length;
    if (alive <= 1 && state.snakes.length > 1) this.endGame(room);
  }

  private endGame(room: SnakeRoom): void {
    if (room.interval) { clearInterval(room.interval); room.interval = null; }
    room.status = 'finished';
    const rankings: SnakeRanking[] = room.state.snakes
      .map(s => ({
        playerId: s.id,
        name: room.names.get(s.id) ?? s.id,
        score: s.score,
        color: s.color,
        position: 0,
      }))
      .sort((a, b) => b.score - a.score)
      .map((r, i) => ({ ...r, position: i + 1 }));
    this.broadcastAll(room, { type: 'snake_game_over', rankings });
  }

  private resetGame(room: SnakeRoom): void {
    room.rematchReadyIds.clear();
    let state = Engine.createGameState();
    const ids = room.isAI
      ? [...room.clients.keys(), room.botId!]
      : [...room.clients.keys()];
    for (const id of ids) state = Engine.spawnSnake(state, id);
    state = Engine.generateFood(state, Engine.FOOD_COUNT);
    room.state = state;
    if (room.isAI) {
      this.startGame(room);
    } else {
      this.startCountdown(room);
    }
  }

  private destroyRoom(room: SnakeRoom): void {
    if (room.interval) clearInterval(room.interval);
    for (const id of room.clients.keys()) this.clientToRoom.delete(id);
    this.rooms.delete(room.code);
  }

  private broadcastAll(room: SnakeRoom, msg: object): void {
    for (const ws of room.clients.values()) this.send(ws, msg);
  }

  private getClientRoom(clientId: string): SnakeRoom | undefined {
    const code = this.clientToRoom.get(clientId);
    return code ? this.rooms.get(code) : undefined;
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    do {
      code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    } while (this.rooms.has(code));
    return code;
  }
}
