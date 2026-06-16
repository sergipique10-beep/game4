import { applyMove, checkDraw, checkWin, createEmptyBoard } from './connect4-engine';
import { CellValue, ClientId, MoveOutcome, Room } from './types';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export class RoomManager {
  private rooms = new Map<string, Room>();

  private uniqueCode(): string {
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

  createAIRoom(playerId: ClientId): Room {
    const room: Room = {
      code: this.uniqueCode(),
      board: createEmptyBoard(),
      currentPlayer: 1,
      players: [{ id: playerId, player: 1 }],
      vsAI: true,
      status: 'playing',
      rematchRequestedBy: new Set(),
    };
    this.rooms.set(room.code, room);
    return room;
  }

  private resolveMove(room: Room, col: number, player: CellValue): MoveOutcome {
    const { board, row } = applyMove(room.board, col, player);
    room.board = board;

    const win = checkWin(board, row, col);
    if (win) {
      room.status = 'finished';
      return { board, row, col, gameOver: { result: 'win', winner: win.winner, cells: win.cells } };
    }
    if (checkDraw(board)) {
      room.status = 'finished';
      return { board, row, col, gameOver: { result: 'draw' } };
    }
    room.currentPlayer = room.currentPlayer === 1 ? 2 : 1;
    return { board, row, col };
  }

  makeMove(code: string, clientId: ClientId, col: number): MoveOutcome {
    const room = this.rooms.get(code);
    if (!room) throw new Error('Sala no encontrada');
    if (room.status !== 'playing') throw new Error('La partida no está en curso');

    const player = room.players.find((p) => p.id === clientId);
    if (!player) throw new Error('Jugador no pertenece a la sala');
    if (player.player !== room.currentPlayer) throw new Error('No es tu turno');

    return this.resolveMove(room, col, player.player);
  }

  applyAIMove(code: string, col: number): MoveOutcome {
    const room = this.rooms.get(code);
    if (!room) throw new Error('Sala no encontrada');
    return this.resolveMove(room, col, room.currentPlayer);
  }

  getRoomByClient(clientId: ClientId): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some((p) => p.id === clientId)) return room;
    }
    return undefined;
  }

  leaveRoom(code: string, _clientId: ClientId): void {
    this.rooms.delete(code);
  }

  requestRematch(code: string, clientId: ClientId): boolean {
    const room = this.rooms.get(code);
    if (!room) throw new Error('Sala no encontrada');
    if (room.status !== 'finished') throw new Error('La partida no ha terminado');

    const player = room.players.find((p) => p.id === clientId);
    if (!player) throw new Error('Jugador no pertenece a la sala');

    room.rematchRequestedBy.add(clientId);
    const allRequested = room.players.every((p) => room.rematchRequestedBy.has(p.id));

    if (room.vsAI || allRequested) {
      room.board = createEmptyBoard();
      room.currentPlayer = 1;
      room.status = 'playing';
      room.rematchRequestedBy.clear();
      return true;
    }
    return false;
  }
}
