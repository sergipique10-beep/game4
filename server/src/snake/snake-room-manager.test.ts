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
    jest.runAllTimers(); // drain countdown (no-op now; endGame is called directly below)
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

describe('SnakeRoomManager — owner-start', () => {
  it('ownerStart starts countdown when called by owner with 2+ players', () => {
    jest.useFakeTimers();
    const { fn, sent } = makeSend();
    const rm = new SnakeRoomManager(fn);
    const ws1 = makeFakeWs();
    const ws2 = makeFakeWs();
    const code = rm.createRoom('p1', ws1, 'Alice');
    rm.joinRoom(code, 'p2', ws2, 'Bob');
    // Should NOT have started countdown automatically
    const room = (rm as any).rooms.get(code);
    expect(room.status).toBe('waiting');
    // Owner starts
    rm.ownerStart('p1');
    expect(room.status).toBe('countdown');
    jest.useRealTimers();
  });

  it('ownerStart does nothing when called by non-owner', () => {
    const { fn } = makeSend();
    const rm = new SnakeRoomManager(fn);
    const ws1 = makeFakeWs();
    const ws2 = makeFakeWs();
    const code = rm.createRoom('p1', ws1, 'Alice');
    rm.joinRoom(code, 'p2', ws2, 'Bob');
    rm.ownerStart('p2'); // p2 is NOT the owner
    const room = (rm as any).rooms.get(code);
    expect(room.status).toBe('waiting');
  });

  it('ownerStart does nothing with only 1 player', () => {
    const { fn } = makeSend();
    const rm = new SnakeRoomManager(fn);
    const ws1 = makeFakeWs();
    rm.createRoom('p1', ws1, 'Alice');
    // Only 1 player, owner tries to start
    const room = (rm as any).rooms.get([...(rm as any).rooms.keys()][0]);
    rm.ownerStart('p1');
    expect(room.status).toBe('waiting');
  });
});

describe('SnakeRoomManager — AI room', () => {
  it('createAIRoom starts the game immediately', () => {
    const { fn, sent } = makeSend();
    const rm = new SnakeRoomManager(fn);
    const ws1 = makeFakeWs();
    rm.createAIRoom('p1', ws1, 'Alice');
    const types = sent.filter(s => s.ws === ws1).map(s => (s.msg as any).type);
    expect(types).toContain('snake_game_start');
  });

  it('createAIRoom spawns bot snake with id __bot__', () => {
    const { fn } = makeSend();
    const rm = new SnakeRoomManager(fn);
    const ws1 = makeFakeWs();
    rm.createAIRoom('p1', ws1, 'Alice');
    const room = [...(rm as any).rooms.values()][0];
    expect(room.state.snakes.some((s: any) => s.id === '__bot__')).toBe(true);
  });

  it('joinRoom rejects AI rooms', () => {
    const { fn } = makeSend();
    const rm = new SnakeRoomManager(fn);
    const ws1 = makeFakeWs();
    rm.createAIRoom('p1', ws1, 'Alice');
    const room = [...(rm as any).rooms.values()][0];
    const result = rm.joinRoom(room.code, 'p2', makeFakeWs(), 'Bob');
    expect(result).toBe(false);
  });
});
