export type CellValue = 0 | 1 | 2;
export type Board = CellValue[][];
export type GameStatus = 'idle' | 'searching' | 'waiting' | 'playing' | 'finished';
export type AIDifficulty = 'easy' | 'hard';
export type GameMode = 'vs-ai' | 'create-room' | 'join-room' | 'matchmaking';

export interface GameOverInfo {
  result: 'win' | 'draw';
  winner?: CellValue;
  cells?: [number, number][];
}

export interface LastMove {
  row: number;
  col: number;
}

export interface GameHistoryEntry {
  id: string;
  date: string;
  result: 'win' | 'loss' | 'draw';
  mode: GameMode;
  opponent: string;
  turns: number;
}
