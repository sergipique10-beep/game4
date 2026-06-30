export type CellValue = 0 | 1 | 2;
export type Board = CellValue[][];

export type ClientId = string;

export interface WinResult {
  winner: CellValue;
  cells: [number, number][];
}

export interface GameOverInfo {
  result: 'win' | 'draw';
  winner?: CellValue;
  cells?: [number, number][];
}

export interface MoveOutcome {
  board: Board;
  row: number;
  col: number;
  gameOver?: GameOverInfo;
}

export interface RoomPlayer {
  id: ClientId;
  player: CellValue;
}

export type AIDifficulty = 'easy' | 'hard';

export interface Room {
  code: string;
  board: Board;
  currentPlayer: CellValue;
  players: RoomPlayer[];
  vsAI: boolean;
  aiDifficulty?: AIDifficulty;
  status: 'waiting' | 'playing' | 'finished';
  rematchRequestedBy: Set<ClientId>;
}
