# Login Global, Nombres en Snake y Fix WebSocket — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Login global antes de elegir juego, nombre del jugador visible en rankings de Snake, fix del bug WebSocket que descartaba mensajes, y botón "Volver al menú" en Conecta 4.

**Architecture:** Se agrega `playerName` signal al App component para centralizar el login. El nombre se pasa explícitamente a los métodos del SnakeSocketService, que a su vez lo envía al servidor. El servidor lo almacena por sala y lo incluye en los rankings al finalizar la partida.

**Tech Stack:** Angular 21 (signals, standalone components), Node.js + TypeScript, WebSocket (ws library), Jest (server tests).

## Global Constraints

- No crear archivos nuevos de componentes ni servicios — solo modificar los existentes.
- Mantener `ChangeDetectionStrategy.OnPush` en todos los componentes.
- El nombre mínimo sigue siendo 2 caracteres (ya validado en `LoginComponent`).
- Tests del servidor corren con: `cd server && npm test -- --testPathPattern=snake-room-manager`
- Tests del cliente corren con: `cd client && npx ng test --watch=false --include=**/app.spec.ts`

---

## File Map

| Archivo | Tipo | Cambio |
|---|---|---|
| `server/src/snake/snake-types.ts` | Modify | Agrega `name: string` a `SnakeRanking` |
| `server/src/snake/snake-room-manager.ts` | Modify | Agrega `names` map, actualiza firmas, incluye name en endGame |
| `server/src/snake/snake-room-manager.test.ts` | Modify | Actualiza tests existentes + agrega test de rankings con nombre |
| `server/src/websocket-server.ts` | Modify | Extrae `name` de mensajes snake y lo pasa al room manager |
| `client/src/app/services/snake-socket.service.ts` | Modify | Cola pendingMessages + `createRoom(name)` + `joinRoom(code,name)` + `SnakeRanking.name` |
| `client/src/app/components/snake-game-over/snake-game-over.component.html` | Modify | Muestra `ranking.name` en lugar de `ranking.playerId` |
| `client/src/app/components/home/home.component.ts` | Modify | Agrega output `backToMenu` |
| `client/src/app/components/home/home.component.html` | Modify | Agrega botón ← Menú |
| `client/src/app/app.ts` | Modify | Agrega `playerName` signal, `onLogin`, `onBackToMenu` |
| `client/src/app/app.html` | Modify | Nuevo flujo condicional con login global |
| `client/src/app/app.spec.ts` | Modify | Actualiza test de pantalla por defecto a `app-login` |

---

## Task 1: Server — Nombre del jugador en rankings de Snake

**Files:**
- Modify: `server/src/snake/snake-types.ts`
- Modify: `server/src/snake/snake-room-manager.ts`
- Modify: `server/src/snake/snake-room-manager.test.ts`

**Interfaces:**
- Produces: `SnakeRanking` con campo `name: string`; `SnakeRoomManager.createRoom(clientId, ws, name)` y `joinRoom(code, clientId, ws, name)` con tercer/cuarto argumento `name: string`

- [ ] **Step 1: Escribir test que falla — rankings incluyen el nombre**

En `server/src/snake/snake-room-manager.test.ts`, agregar al final del archivo:

```ts
describe('SnakeRoomManager — player names in rankings', () => {
  it('endGame broadcasts rankings with player names', () => {
    jest.useFakeTimers();
    const { fn, sent } = makeSend();
    const rm = new SnakeRoomManager(fn);
    const ws1 = makeFakeWs();
    const ws2 = makeFakeWs();
    const code = rm.createRoom('p1', ws1, 'Alice');
    rm.joinRoom(code, 'p2', ws2, 'Bob');
    jest.runAllTimers(); // drain countdown
    const room = (rm as any).rooms.get(code);
    // kill p2's snake to trigger endGame
    room.state.snakes.find((s: any) => s.id === 'p2').alive = false;
    (rm as any).endGame(room);
    const gameOverMsg = sent.filter(s => (s.msg as any).type === 'snake_game_over').at(-1)?.msg as any;
    expect(gameOverMsg).toBeDefined();
    expect(gameOverMsg.rankings.find((r: any) => r.playerId === 'p1').name).toBe('Alice');
    expect(gameOverMsg.rankings.find((r: any) => r.playerId === 'p2').name).toBe('Bob');
    jest.useRealTimers();
  });
});
```

- [ ] **Step 2: Verificar que el test falla**

```bash
cd server && npm test -- --testPathPattern=snake-room-manager
```

Resultado esperado: FAIL — `rm.createRoom` / `rm.joinRoom` no aceptan `name` aún.

- [ ] **Step 3: Actualizar `snake-types.ts`**

Reemplazar la interfaz `SnakeRanking` en `server/src/snake/snake-types.ts`:

```ts
export interface SnakeRanking {
  playerId: string;
  name: string;
  score: number;
  color: string;
  position: number;
}
```

- [ ] **Step 4: Actualizar `snake-room-manager.ts`**

Reemplazar el contenido completo de `server/src/snake/snake-room-manager.ts`:

```ts
import { WebSocket } from 'ws';
import * as Engine from './snake-engine';
import { GameState, Direction, SnakeRanking } from './snake-types';

interface SnakeRoom {
  code: string;
  state: GameState;
  clients: Map<string, WebSocket>;
  names: Map<string, string>;
  interval: ReturnType<typeof setInterval> | null;
  status: 'waiting' | 'countdown' | 'playing' | 'finished';
  rematchReadyIds: Set<string>;
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
    };
    this.rooms.set(code, room);
    this.clientToRoom.set(clientId, code);
    return code;
  }

  joinRoom(code: string, clientId: string, ws: WebSocket, name: string): boolean {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'waiting' || room.clients.size >= 8) return false;
    room.state = Engine.spawnSnake(room.state, clientId);
    room.clients.set(clientId, ws);
    room.names.set(clientId, name);
    this.clientToRoom.set(clientId, code);
    this.broadcastAll(room, {
      type: 'snake_player_joined',
      playerId: clientId,
      playerCount: room.clients.size,
    });
    if (room.clients.size === 2) this.startCountdown(room);
    return true;
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
    for (const clientId of room.clients.keys()) state = Engine.spawnSnake(state, clientId);
    state = Engine.generateFood(state, Engine.FOOD_COUNT);
    room.state = state;
    this.startCountdown(room);
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
```

- [ ] **Step 5: Actualizar tests existentes en `snake-room-manager.test.ts` — pasar `name` a `createRoom` y `joinRoom`**

Reemplazar todas las llamadas a `rm.createRoom('p1', ws1)` por `rm.createRoom('p1', ws1, 'Alice')`.
Reemplazar todas las llamadas a `rm.joinRoom(code, 'p2', ws2)` por `rm.joinRoom(code, 'p2', ws2, 'Bob')`.

El archivo completo actualizado:

```ts
// server/src/snake/snake-room-manager.test.ts
import { WebSocket } from 'ws';
import { SnakeRoomManager } from './snake-room-manager';

function makeFakeWs(): WebSocket {
  return {
    send: jest.fn(),
    readyState: 1,
  } as unknown as WebSocket;
}

function makeSend() {
  const sent: Array<{ ws: WebSocket; msg: object }> = [];
  const fn = (ws: WebSocket, msg: object) => sent.push({ ws, msg });
  return { fn, sent };
}

function lastMsgTo(sent: Array<{ ws: WebSocket; msg: object }>, ws: WebSocket) {
  return sent.filter(s => s.ws === ws).at(-1)?.msg;
}

function allMsgTypes(sent: Array<{ ws: WebSocket; msg: object }>, ws: WebSocket) {
  return sent.filter(s => s.ws === ws).map(s => (s.msg as { type: string }).type);
}

describe('SnakeRoomManager — room lifecycle', () => {
  it('createRoom returns a 4-char code and spawns 1 snake', () => {
    const { fn, sent } = makeSend();
    const rm = new SnakeRoomManager(fn);
    const ws1 = makeFakeWs();
    const code = rm.createRoom('p1', ws1, 'Alice');
    expect(code).toHaveLength(4);
    const room = (rm as any).rooms.get(code);
    expect(room).toBeDefined();
    expect(room.state.snakes).toHaveLength(1);
    expect(room.state.food).toHaveLength(3);
    expect(room.status).toBe('waiting');
  });

  it('joinRoom returns false for unknown code', () => {
    const { fn } = makeSend();
    const rm = new SnakeRoomManager(fn);
    const ws = makeFakeWs();
    expect(rm.joinRoom('ZZZZ', 'p2', ws, 'Bob')).toBe(false);
  });

  it('joinRoom adds player and broadcasts snake_player_joined', () => {
    const { fn, sent } = makeSend();
    const rm = new SnakeRoomManager(fn);
    const ws1 = makeFakeWs();
    const ws2 = makeFakeWs();
    const code = rm.createRoom('p1', ws1, 'Alice');
    const joined = rm.joinRoom(code, 'p2', ws2, 'Bob');
    expect(joined).toBe(true);
    const types = allMsgTypes(sent, ws1);
    expect(types).toContain('snake_player_joined');
    const types2 = allMsgTypes(sent, ws2);
    expect(types2).toContain('snake_player_joined');
  });

  it('joinRoom rejects when room is not waiting', () => {
    const { fn } = makeSend();
    const rm = new SnakeRoomManager(fn);
    const ws1 = makeFakeWs();
    const code = rm.createRoom('p1', ws1, 'Alice');
    const room = (rm as any).rooms.get(code);
    room.status = 'playing';
    expect(rm.joinRoom(code, 'p2', makeFakeWs(), 'Bob')).toBe(false);
  });
});

describe('SnakeRoomManager — handleDirection', () => {
  it('updates snake nextDirection in state', () => {
    const { fn } = makeSend();
    const rm = new SnakeRoomManager(fn);
    const ws1 = makeFakeWs();
    const code = rm.createRoom('p1', ws1, 'Alice');
    const room = (rm as any).rooms.get(code);
    room.status = 'playing';
    rm.handleDirection('p1', 'right');
    expect(room.state.snakes[0].nextDirection).toBe('right');
  });

  it('ignores direction when not playing', () => {
    const { fn } = makeSend();
    const rm = new SnakeRoomManager(fn);
    const ws1 = makeFakeWs();
    const code = rm.createRoom('p1', ws1, 'Alice');
    rm.handleDirection('p1', 'right');
    const room = (rm as any).rooms.get(code);
    expect(room.state.snakes[0].nextDirection).toBe('up');
  });
});

describe('SnakeRoomManager — handleDisconnect', () => {
  it('removes the room when the only player disconnects during waiting', () => {
    const { fn } = makeSend();
    const rm = new SnakeRoomManager(fn);
    const ws1 = makeFakeWs();
    const code = rm.createRoom('p1', ws1, 'Alice');
    rm.handleDisconnect('p1');
    expect((rm as any).rooms.get(code)).toBeUndefined();
  });

  it('broadcasts snake_player_left to remaining players', () => {
    const { fn, sent } = makeSend();
    const rm = new SnakeRoomManager(fn);
    const ws1 = makeFakeWs();
    const ws2 = makeFakeWs();
    const code = rm.createRoom('p1', ws1, 'Alice');
    rm.joinRoom(code, 'p2', ws2, 'Bob');
    const room = (rm as any).rooms.get(code);
    room.status = 'playing';
    rm.handleDisconnect('p2');
    const types = allMsgTypes(sent, ws1);
    expect(types).toContain('snake_player_left');
  });
});

describe('SnakeRoomManager — player names in rankings', () => {
  it('endGame broadcasts rankings with player names', () => {
    jest.useFakeTimers();
    const { fn, sent } = makeSend();
    const rm = new SnakeRoomManager(fn);
    const ws1 = makeFakeWs();
    const ws2 = makeFakeWs();
    const code = rm.createRoom('p1', ws1, 'Alice');
    rm.joinRoom(code, 'p2', ws2, 'Bob');
    jest.runAllTimers();
    const room = (rm as any).rooms.get(code);
    room.state.snakes.find((s: any) => s.id === 'p2').alive = false;
    (rm as any).endGame(room);
    const gameOverMsg = sent.filter(s => (s.msg as any).type === 'snake_game_over').at(-1)?.msg as any;
    expect(gameOverMsg).toBeDefined();
    expect(gameOverMsg.rankings.find((r: any) => r.playerId === 'p1').name).toBe('Alice');
    expect(gameOverMsg.rankings.find((r: any) => r.playerId === 'p2').name).toBe('Bob');
    jest.useRealTimers();
  });
});
```

- [ ] **Step 6: Verificar que todos los tests del room manager pasan**

```bash
cd server && npm test -- --testPathPattern=snake-room-manager
```

Resultado esperado: todos los tests PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/snake/snake-types.ts server/src/snake/snake-room-manager.ts server/src/snake/snake-room-manager.test.ts
git commit -m "feat(snake): add player name to SnakeRanking and room manager"
```

---

## Task 2: Server — WebSocket handler pasa `name` al room manager

**Files:**
- Modify: `server/src/websocket-server.ts:143-154`

**Interfaces:**
- Consumes: `SnakeRoomManager.createRoom(clientId, ws, name)` y `joinRoom(code, clientId, ws, name)` de Task 1

- [ ] **Step 1: Actualizar los dos cases de snake en `websocket-server.ts`**

Localizar el bloque `case 'snake_create_room'` (línea 143) y reemplazar:

```ts
case 'snake_create_room': {
  const code = snakeRoomManager.createRoom(clientId, socket);
  send(socket, { type: 'snake_room_created', code, yourId: clientId });
  break;
}
case 'snake_join_room': {
  const joined = snakeRoomManager.joinRoom(msg.code, clientId, socket);
  if (!joined) {
    send(socket, { type: 'error', message: 'Esa sala no existe o ya está completa' });
  }
  break;
}
```

Por:

```ts
case 'snake_create_room': {
  const name = typeof msg.name === 'string' ? msg.name : 'Jugador';
  const code = snakeRoomManager.createRoom(clientId, socket, name);
  send(socket, { type: 'snake_room_created', code, yourId: clientId });
  break;
}
case 'snake_join_room': {
  const name = typeof msg.name === 'string' ? msg.name : 'Jugador';
  const joined = snakeRoomManager.joinRoom(msg.code, clientId, socket, name);
  if (!joined) {
    send(socket, { type: 'error', message: 'Esa sala no existe o ya está completa' });
  }
  break;
}
```

- [ ] **Step 2: Verificar que el servidor compila sin errores**

```bash
cd server && npm run build
```

Resultado esperado: compilación exitosa sin errores TypeScript.

- [ ] **Step 3: Commit**

```bash
git add server/src/websocket-server.ts
git commit -m "feat(snake): pass player name from WebSocket handler to room manager"
```

---

## Task 3: Cliente — Fix WebSocket bug + nombre en mensajes de Snake

**Files:**
- Modify: `client/src/app/services/snake-socket.service.ts`

**Interfaces:**
- Produces: `SnakeSocketService.createRoom(name: string): void` y `joinRoom(code: string, name: string): void`
- Produces: interfaz `SnakeRanking` con campo `name: string`

- [ ] **Step 1: Reemplazar el contenido de `snake-socket.service.ts`**

```ts
import { Injectable, signal, inject } from '@angular/core';
import { WEBSOCKET_FACTORY } from './websocket';

export type SnakePhase = 'home' | 'waiting' | 'playing' | 'gameOver';
export type Direction = 'up' | 'down' | 'left' | 'right';

export interface SnakePoint { x: number; y: number; }
export interface SnakePlayer {
  id: string;
  body: SnakePoint[];
  direction: Direction;
  alive: boolean;
  score: number;
  color: string;
}
export interface SnakeGameState {
  snakes: SnakePlayer[];
  food: SnakePoint[];
  tick: number;
  width: number;
  height: number;
}
export interface SnakeRanking {
  playerId: string;
  name: string;
  score: number;
  color: string;
  position: number;
}

@Injectable({ providedIn: 'root' })
export class SnakeSocketService {
  private wsFactory = inject(WEBSOCKET_FACTORY);
  private ws: ReturnType<typeof this.wsFactory> | null = null;
  private pendingMessages: string[] = [];

  readonly phase = signal<SnakePhase>('home');
  readonly roomCode = signal<string | null>(null);
  readonly playerCount = signal<number>(1);
  readonly countdown = signal<number | null>(null);
  readonly gameState = signal<SnakeGameState | null>(null);
  readonly myId = signal<string | null>(null);
  readonly rankings = signal<SnakeRanking[] | null>(null);
  readonly errorMessage = signal<string | null>(null);

  createRoom(name: string): void {
    this.connect();
    this.send({ type: 'snake_create_room', name });
  }

  joinRoom(code: string, name: string): void {
    this.connect();
    this.send({ type: 'snake_join_room', code, name });
    this.phase.set('waiting');
    this.roomCode.set(code);
  }

  sendDirection(direction: Direction): void {
    this.send({ type: 'snake_direction', direction });
  }

  requestRematch(): void {
    this.send({ type: 'snake_rematch' });
  }

  leaveRoom(): void {
    this.send({ type: 'snake_leave_room' });
    this.ws?.close();
    this.ws = null;
    this.resetState();
  }

  private connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = this.wsFactory(`${proto}//${location.host}/ws`);
    this.ws.onopen = () => {
      for (const msg of this.pendingMessages) this.ws!.send(msg);
      this.pendingMessages = [];
    };
    this.ws.onmessage = (e: { data: string }) => this.handle(JSON.parse(e.data));
    this.ws.onerror = () => this.errorMessage.set('Error de conexión');
    this.ws.onclose = () => {
      if (this.phase() === 'playing') this.errorMessage.set('Se perdió la conexión con el servidor');
    };
  }

  private send(msg: object): void {
    const str = JSON.stringify(msg);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(str);
    } else {
      this.pendingMessages.push(str);
    }
  }

  private handle(msg: Record<string, unknown>): void {
    this.errorMessage.set(null);
    switch (msg['type']) {
      case 'snake_room_created':
        this.roomCode.set(msg['code'] as string);
        this.myId.set(msg['yourId'] as string);
        this.phase.set('waiting');
        break;
      case 'snake_player_joined':
        this.playerCount.set(msg['playerCount'] as number);
        break;
      case 'snake_countdown':
        this.countdown.set(msg['seconds'] as number);
        break;
      case 'snake_game_start':
        this.gameState.set(msg['state'] as SnakeGameState);
        this.myId.set(msg['yourId'] as string);
        this.countdown.set(null);
        this.phase.set('playing');
        break;
      case 'snake_game_tick':
        this.gameState.set(msg['state'] as SnakeGameState);
        break;
      case 'snake_game_over':
        this.rankings.set(msg['rankings'] as SnakeRanking[]);
        this.phase.set('gameOver');
        break;
      case 'snake_player_left':
        this.errorMessage.set('Un jugador ha abandonado la partida');
        break;
      case 'error':
        this.errorMessage.set(msg['message'] as string);
        break;
    }
  }

  private resetState(): void {
    this.phase.set('home');
    this.roomCode.set(null);
    this.playerCount.set(1);
    this.countdown.set(null);
    this.gameState.set(null);
    this.myId.set(null);
    this.rankings.set(null);
    this.errorMessage.set(null);
    this.pendingMessages = [];
  }
}
```

- [ ] **Step 2: Verificar que el cliente compila sin errores**

```bash
cd client && npx ng build --configuration=production 2>&1 | head -30
```

Resultado esperado: sin errores de TypeScript.

- [ ] **Step 3: Commit**

```bash
git add client/src/app/services/snake-socket.service.ts
git commit -m "fix(snake): add WebSocket pending messages queue and player name to room messages"
```

---

## Task 4: Cliente — Nombre en tabla de rankings de Snake

**Files:**
- Modify: `client/src/app/components/snake-game-over/snake-game-over.component.html`

**Interfaces:**
- Consumes: `SnakeRanking.name: string` de Task 3

- [ ] **Step 1: Actualizar el template de snake-game-over**

Reemplazar el contenido completo de `client/src/app/components/snake-game-over/snake-game-over.component.html`:

```html
<div class="game-over">
  <h1 class="title">
    @if (rankings()[0]?.playerId === myId()) {
      VICTORIA
    } @else {
      FIN DE PARTIDA
    }
  </h1>

  <table class="ranking">
    <thead>
      <tr>
        <th>Pos</th>
        <th>Jugador</th>
        <th>Puntos</th>
      </tr>
    </thead>
    <tbody>
      @for (r of rankings(); track r.playerId) {
        <tr [class.me]="isMe(r)">
          <td class="pos">{{ medal(r.position) }}</td>
          <td class="player">
            <span class="dot" [style.background]="r.color"></span>
            {{ isMe(r) ? 'Tú' : r.name }}
          </td>
          <td class="score">{{ r.score }}</td>
        </tr>
      }
    </tbody>
  </table>

  <div class="actions">
    <button class="btn btn-primary" (click)="rematch.emit()">Revancha</button>
    <button class="btn btn-ghost" (click)="exit.emit()">Salir al inicio</button>
  </div>
</div>
```

El único cambio es la línea `{{ isMe(r) ? 'Tú' : r.name }}` en lugar de `{{ isMe(r) ? 'Tú' : r.playerId }}`.

- [ ] **Step 2: Commit**

```bash
git add client/src/app/components/snake-game-over/snake-game-over.component.html
git commit -m "feat(snake): display player name in game over rankings"
```

---

## Task 5: Cliente — Login global y botón "Volver al menú" en Conecta 4

**Files:**
- Modify: `client/src/app/components/home/home.component.ts`
- Modify: `client/src/app/components/home/home.component.html`
- Modify: `client/src/app/app.ts`
- Modify: `client/src/app/app.html`
- Modify: `client/src/app/app.spec.ts`

**Interfaces:**
- Consumes: `SnakeSocketService.createRoom(name)` y `joinRoom(code, name)` de Task 3

- [ ] **Step 1: Agregar output `backToMenu` a HomeComponent**

En `client/src/app/components/home/home.component.ts`, agregar el output después de `joinRoom`:

```ts
readonly createRoom = output<void>();
readonly findMatch = output<void>();
readonly playVsAI = output<'easy' | 'hard'>();
readonly joinRoom = output<string>();
readonly backToMenu = output<void>();
```

- [ ] **Step 2: Agregar botón "← Menú" al template de HomeComponent**

En `client/src/app/components/home/home.component.html`, agregar un botón al inicio del panel, justo después de `<div class="cyber-panel home-panel">`:

```html
<app-cyber-bg />
<div class="home-wrap">
  <div class="cyber-panel home-panel">

    <button class="btn-back" (click)="backToMenu.emit()">← Menú</button>

    <div class="player-bar">
      ...resto del contenido sin cambios...
```

El botón completo que insertar al inicio del panel:
```html
    <button class="btn-back" (click)="backToMenu.emit()">← Menú</button>
```

- [ ] **Step 3: Reemplazar `app.ts`**

```ts
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { GameSocketService } from './services/game-socket.service';
import { SnakeSocketService } from './services/snake-socket.service';
import { GameSelectComponent } from './components/game-select/game-select.component';
import { LoginComponent } from './components/login/login.component';
import { HomeComponent } from './components/home/home.component';
import { WaitingRoomComponent } from './components/waiting-room/waiting-room.component';
import { FindMatchComponent } from './components/find-match/find-match.component';
import { BoardComponent } from './components/board/board.component';
import { GameOverComponent } from './components/game-over/game-over.component';
import { SnakeHomeComponent } from './components/snake-home/snake-home.component';
import { SnakeWaitingRoomComponent } from './components/snake-waiting-room/snake-waiting-room.component';
import { SnakeGameComponent } from './components/snake-game/snake-game.component';
import { SnakeGameOverComponent } from './components/snake-game-over/snake-game-over.component';
import { ToastComponent } from './components/toast/toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    GameSelectComponent,
    LoginComponent, HomeComponent, WaitingRoomComponent, FindMatchComponent,
    BoardComponent, GameOverComponent,
    SnakeHomeComponent, SnakeWaitingRoomComponent, SnakeGameComponent, SnakeGameOverComponent,
    ToastComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  readonly game = inject(GameSocketService);
  readonly snake = inject(SnakeSocketService);
  readonly selectedGame = signal<'connect4' | 'snake' | null>(null);
  readonly playerName = signal<string | null>(null);

  initialCode = '';

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    this.initialCode = params.get('room')?.toUpperCase() ?? '';
  }

  toastMessage(): string | null {
    if (this.selectedGame() === 'snake') return this.snake.errorMessage();
    if (this.game.errorMessage()) return this.game.errorMessage();
    if (this.game.opponentLeft()) return 'Tu rival se ha desconectado';
    return null;
  }

  onToastDismissed(): void {
    this.game.errorMessage.set(null);
    this.snake.errorMessage.set(null);
  }

  onLogin(name: string): void {
    this.playerName.set(name);
    this.game.login(name);
  }

  onSelectGame(game: 'connect4' | 'snake'): void {
    this.selectedGame.set(game);
  }

  onBackToMenu(): void {
    this.selectedGame.set(null);
  }

  onSnakeBack(): void {
    this.snake.leaveRoom();
    this.selectedGame.set(null);
  }
}
```

- [ ] **Step 4: Reemplazar `app.html`**

```html
@if (playerName() === null) {
  <app-login (enter)="onLogin($event)" />
} @else if (selectedGame() === null) {
  <app-game-select (select)="onSelectGame($event)" />
} @else if (selectedGame() === 'connect4') {
  @switch (game.phase()) {
    @case ('home') {
      <app-home
        [playerName]="game.playerName()"
        [initialCode]="initialCode"
        (createRoom)="game.createRoom()"
        (findMatch)="game.findMatch()"
        (playVsAI)="game.playVsAI($event)"
        (joinRoom)="game.joinRoom($event)"
        (backToMenu)="onBackToMenu()"
      />
    }
    @case ('waiting') {
      <app-waiting-room [roomCode]="game.roomCode()!" (leave)="game.leaveRoom()" />
    }
    @case ('findingMatch') {
      <app-find-match (cancel)="game.cancelMatch()" />
    }
    @case ('playing') {
      <app-board
        [boardState]="game.board()"
        [currentPlayer]="game.currentPlayer()"
        [myPlayer]="game.myPlayer()"
        [isVsAI]="game.isVsAI()"
        (columnClick)="game.makeMove($event)"
      />
    }
    @case ('gameOver') {
      <app-game-over
        [boardState]="game.board()"
        [result]="game.gameOverResult()!"
        [myPlayer]="game.myPlayer()"
        (rematch)="game.requestRematch()"
        (exit)="game.leaveRoom()"
      />
    }
  }
} @else if (selectedGame() === 'snake') {
  @switch (snake.phase()) {
    @case ('home') {
      <app-snake-home
        (createRoom)="snake.createRoom(playerName()!)"
        (joinRoom)="snake.joinRoom($event, playerName()!)"
        (back)="onSnakeBack()"
      />
    }
    @case ('waiting') {
      <app-snake-waiting-room
        [roomCode]="snake.roomCode()"
        [playerCount]="snake.playerCount()"
        [countdown]="snake.countdown()"
        (leave)="snake.leaveRoom()"
      />
    }
    @case ('playing') {
      <app-snake-game />
    }
    @case ('gameOver') {
      <app-snake-game-over
        [rankings]="snake.rankings()!"
        [myId]="snake.myId()!"
        (rematch)="snake.requestRematch()"
        (exit)="onSnakeBack()"
      />
    }
  }
}

<app-toast [message]="toastMessage()" (dismissed)="onToastDismissed()" />
```

- [ ] **Step 5: Actualizar `app.spec.ts`**

Reemplazar el test `'renders the game select screen by default'`:

```ts
import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders the login screen by default', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-login')).toBeTruthy();
  });
});
```

- [ ] **Step 6: Verificar que los tests del cliente pasan**

```bash
cd client && npx ng test --watch=false --include=**/app.spec.ts
```

Resultado esperado: 2 tests PASS.

- [ ] **Step 7: Verificar build de producción completo**

```bash
cd client && npx ng build --configuration=production 2>&1 | tail -10
```

Resultado esperado: sin errores, output en `dist/`.

- [ ] **Step 8: Commit**

```bash
git add client/src/app/app.ts client/src/app/app.html client/src/app/app.spec.ts client/src/app/components/home/home.component.ts client/src/app/components/home/home.component.html
git commit -m "feat: global login screen and back-to-menu button in Connect4"
```
