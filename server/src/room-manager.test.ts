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
