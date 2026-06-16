import { Board, CellValue, WinResult } from './types';

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

export function applyMove(
  board: Board,
  col: number,
  player: CellValue
): { board: Board; row: number } {
  if (col < 0 || col >= COLS) {
    throw new Error(`Columna fuera de rango: ${col}`);
  }
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row][col] === 0) {
      const newBoard = board.map((r) => [...r]);
      newBoard[row][col] = player;
      return { board: newBoard, row };
    }
  }
  throw new Error(`Columna llena: ${col}`);
}

const DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

export function checkWin(board: Board, row: number, col: number): WinResult | null {
  const player = board[row][col];
  if (player === 0) return null;

  for (const [dr, dc] of DIRECTIONS) {
    const cells: [number, number][] = [[row, col]];

    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
      cells.push([r, c]);
      r += dr;
      c += dc;
    }

    r = row - dr;
    c = col - dc;
    while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
      cells.push([r, c]);
      r -= dr;
      c -= dc;
    }

    if (cells.length >= 4) {
      return { winner: player, cells: cells.slice(0, 4) };
    }
  }

  return null;
}
