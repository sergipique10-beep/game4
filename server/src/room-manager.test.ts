import { RoomManager } from './room-manager';

describe('RoomManager.createRoom', () => {
  it('creates a waiting room with the host as player 1', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('host-1');
    expect(room.status).toBe('waiting');
    expect(room.players).toEqual([{ id: 'host-1', player: 1 }]);
    expect(room.code).toHaveLength(4);
  });
});

describe('RoomManager.joinRoom', () => {
  it('adds the guest as player 2 and starts the game', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('host-1');
    const joined = manager.joinRoom(room.code, 'guest-1');
    expect(joined?.status).toBe('playing');
    expect(joined?.players).toEqual([
      { id: 'host-1', player: 1 },
      { id: 'guest-1', player: 2 },
    ]);
  });

  it('returns null for an unknown room code', () => {
    const manager = new RoomManager();
    expect(manager.joinRoom('ZZZZ', 'guest-1')).toBeNull();
  });

  it('returns null when the room already has 2 players', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('host-1');
    manager.joinRoom(room.code, 'guest-1');
    expect(manager.joinRoom(room.code, 'guest-2')).toBeNull();
  });
});

describe('RoomManager.createAIRoom', () => {
  it('creates a playing room with vsAI true', () => {
    const manager = new RoomManager();
    const room = manager.createAIRoom('player-1');
    expect(room.status).toBe('playing');
    expect(room.vsAI).toBe(true);
    expect(room.players).toEqual([{ id: 'player-1', player: 1 }]);
  });
});

describe('RoomManager.makeMove', () => {
  it('applies the move and switches the turn', () => {
    const manager = new RoomManager();
    const room = manager.createAIRoom('player-1');
    const outcome = manager.makeMove(room.code, 'player-1', 3);
    expect(outcome.row).toBe(5);
    expect(outcome.col).toBe(3);
    expect(outcome.gameOver).toBeUndefined();
    expect(manager.getRoom(room.code)?.currentPlayer).toBe(2);
  });

  it('throws when it is not the player turn', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('host-1');
    manager.joinRoom(room.code, 'guest-1');
    expect(() => manager.makeMove(room.code, 'guest-1', 0)).toThrow('No es tu turno');
  });

  it('throws for a client outside the room', () => {
    const manager = new RoomManager();
    const room = manager.createAIRoom('player-1');
    expect(() => manager.makeMove(room.code, 'intruder', 0)).toThrow(
      'Jugador no pertenece a la sala'
    );
  });

  it('reports gameOver with result win and winning cells', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('host-1');
    manager.joinRoom(room.code, 'guest-1');
    manager.makeMove(room.code, 'host-1', 0); // player 1, row5 col0
    manager.makeMove(room.code, 'guest-1', 4); // player 2, row5 col4
    manager.makeMove(room.code, 'host-1', 1); // player 1, row5 col1
    manager.makeMove(room.code, 'guest-1', 5); // player 2, row5 col5
    manager.makeMove(room.code, 'host-1', 2); // player 1, row5 col2
    manager.makeMove(room.code, 'guest-1', 6); // player 2, row5 col6 (irrelevant)
    const outcome = manager.makeMove(room.code, 'host-1', 3); // player 1 wins horizontally on row5 cols 0-3
    expect(outcome.gameOver?.result).toBe('win');
    expect(outcome.gameOver?.winner).toBe(1);
    expect(outcome.gameOver?.cells).toHaveLength(4);
    expect(manager.getRoom(room.code)?.status).toBe('finished');
  });
});

describe('RoomManager.applyAIMove', () => {
  it('applies the move as the current player without a clientId', () => {
    const manager = new RoomManager();
    const room = manager.createAIRoom('player-1');
    manager.makeMove(room.code, 'player-1', 0); // human plays, AI is now current (player 2)
    const outcome = manager.applyAIMove(room.code, 1);
    expect(outcome.col).toBe(1);
    expect(manager.getRoom(room.code)?.currentPlayer).toBe(1);
  });
});

describe('RoomManager.getRoomByClient', () => {
  it('finds the room a client belongs to', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('host-1');
    expect(manager.getRoomByClient('host-1')?.code).toBe(room.code);
  });

  it('returns undefined for an unknown client', () => {
    const manager = new RoomManager();
    expect(manager.getRoomByClient('nobody')).toBeUndefined();
  });
});

describe('RoomManager.leaveRoom', () => {
  it('removes the room', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('host-1');
    manager.leaveRoom(room.code, 'host-1');
    expect(manager.getRoom(room.code)).toBeUndefined();
  });
});

describe('RoomManager.requestRematch', () => {
  it('restarts immediately for a vsAI room', () => {
    const manager = new RoomManager();
    const room = manager.createAIRoom('player-1');
    manager.makeMove(room.code, 'player-1', 0); // row5 col0
    manager.applyAIMove(room.code, 4); // row5 col4
    manager.makeMove(room.code, 'player-1', 1); // row5 col1
    manager.applyAIMove(room.code, 5); // row5 col5
    manager.makeMove(room.code, 'player-1', 2); // row5 col2
    manager.applyAIMove(room.code, 6); // row5 col6
    manager.makeMove(room.code, 'player-1', 3); // player 1 wins horizontally
    expect(manager.getRoom(room.code)?.status).toBe('finished');

    const accepted = manager.requestRematch(room.code, 'player-1');
    expect(accepted).toBe(true);
    const refreshed = manager.getRoom(room.code);
    expect(refreshed?.status).toBe('playing');
    expect(refreshed?.board.every((row) => row.every((cell) => cell === 0))).toBe(true);
  });

  it('waits for both players in a 2-player room', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('host-1');
    manager.joinRoom(room.code, 'guest-1');
    manager.makeMove(room.code, 'host-1', 0); // row5 col0
    manager.makeMove(room.code, 'guest-1', 4); // row5 col4
    manager.makeMove(room.code, 'host-1', 1); // row5 col1
    manager.makeMove(room.code, 'guest-1', 5); // row5 col5
    manager.makeMove(room.code, 'host-1', 2); // row5 col2
    manager.makeMove(room.code, 'guest-1', 6); // row5 col6
    manager.makeMove(room.code, 'host-1', 3); // host wins horizontally
    expect(manager.getRoom(room.code)?.status).toBe('finished');

    expect(manager.requestRematch(room.code, 'host-1')).toBe(false);
    expect(manager.requestRematch(room.code, 'guest-1')).toBe(true);
  });

  it('throws when the game is still in progress', () => {
    const manager = new RoomManager();
    const room = manager.createAIRoom('player-1');
    expect(() => manager.requestRematch(room.code, 'player-1')).toThrow(
      'La partida no ha terminado'
    );
  });

  it('throws when requested by a client outside the room', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('host-1');
    manager.joinRoom(room.code, 'guest-1');
    manager.makeMove(room.code, 'host-1', 0); // row5 col0
    manager.makeMove(room.code, 'guest-1', 4); // row5 col4
    manager.makeMove(room.code, 'host-1', 1); // row5 col1
    manager.makeMove(room.code, 'guest-1', 5); // row5 col5
    manager.makeMove(room.code, 'host-1', 2); // row5 col2
    manager.makeMove(room.code, 'guest-1', 6); // row5 col6
    manager.makeMove(room.code, 'host-1', 3); // host wins horizontally
    expect(manager.getRoom(room.code)?.status).toBe('finished');

    expect(() => manager.requestRematch(room.code, 'intruder')).toThrow(
      'Jugador no pertenece a la sala'
    );
  });
});
