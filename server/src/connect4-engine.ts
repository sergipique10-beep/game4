import { Board, CellValue } from './types';

export const ROWS = 6;
export const COLS = 7;

export function createEmptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<CellValue>(COLS).fill(0));
}

export function getValidColumns(board: Board): number[] {
  const valid: number[] = [];
  for (let col = 0; col < COLS; col++) {
    if (board[0][col] === 0) valid.push(col);
  }
  return valid;
}
