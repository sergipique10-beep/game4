import { createEmptyBoard } from './connect4-engine';
import { ClientId, Room } from './types';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export class RoomManager {
  rooms = new Map<string, Room>();

  uniqueCode(): string {
    let code = generateCode();
    while (this.rooms.has(code)) {
      code = generateCode();
    }
    return code;
  }

  createRoom(hostId: ClientId): Room {
    const room: Room = {
      code: this.uniqueCode(),
      board: createEmptyBoard(),
      currentPlayer: 1,
      players: [{ id: hostId, player: 1 }],
      vsAI: false,
      status: 'waiting',
      rematchRequestedBy: new Set(),
    };
    this.rooms.set(room.code, room);
    return room;
  }

  joinRoom(code: string, guestId: ClientId): Room | null {
    const room = this.rooms.get(code);
    if (!room || room.status !== 'waiting' || room.players.length >= 2) {
      return null;
    }
    room.players.push({ id: guestId, player: 2 });
    room.status = 'playing';
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }
}
