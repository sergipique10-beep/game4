import { Board, CellValue } from './types';

const ROWS = 6;
const COLS = 7;
const WIN_SCORE = 1_000_000;

function getValidCols(board: Board): number[] {
  const cols: number[] = [];
  for (let c = 0; c < COLS; c++) {
    if (board[0][c] === 0) cols.push(c);
  }
  return cols;
}

function drop(board: Board, col: number, player: CellValue): Board {
  const next = board.map((r) => [...r]) as Board;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (next[r][col] === 0) {
      next[r][col] = player;
      break;
    }
  }
  return next;
}

function isWin(board: Board, player: CellValue): boolean {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      if (board[r][c] === player && board[r][c+1] === player && board[r][c+2] === player && board[r][c+3] === player) return true;
    }
  }
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === player && board[r+1][c] === player && board[r+2][c] === player && board[r+3][c] === player) return true;
    }
  }
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      if (board[r][c] === player && board[r+1][c+1] === player && board[r+2][c+2] === player && board[r+3][c+3] === player) return true;
    }
  }
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      if (board[r][c] === player && board[r-1][c+1] === player && board[r-2][c+2] === player && board[r-3][c+3] === player) return true;
    }
  }
  return false;
}

function scoreWindow(window: CellValue[], ai: CellValue, human: CellValue): number {
  const aiCount = window.filter((c) => c === ai).length;
  const humanCount = window.filter((c) => c === human).length;
  const empty = window.filter((c) => c === 0).length;

  if (aiCount === 4) return 100;
  if (aiCount === 3 && empty === 1) return 5;
  if (aiCount === 2 && empty === 2) return 2;
  if (humanCount === 3 && empty === 1) return -4;
  return 0;
}

function scoreBoard(board: Board, ai: CellValue): number {
  const human = ai === 1 ? 2 : 1;
  let score = 0;

  const center = Math.floor(COLS / 2);
  score += board.filter((r) => r[center] === ai).length * 3;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      score += scoreWindow(board[r].slice(c, c + 4) as CellValue[], ai, human);
    }
  }
  for (let c = 0; c < COLS; c++) {
    const col = board.map((r) => r[c]);
    for (let r = 0; r <= ROWS - 4; r++) {
      score += scoreWindow(col.slice(r, r + 4) as CellValue[], ai, human);
    }
  }
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      score += scoreWindow([board[r][c], board[r+1][c+1], board[r+2][c+2], board[r+3][c+3]], ai, human);
    }
  }
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      score += scoreWindow([board[r][c], board[r-1][c+1], board[r-2][c+2], board[r-3][c+3]], ai, human);
    }
  }
  return score;
}

function minimax(board: Board, depth: number, alpha: number, beta: number, maximizing: boolean, ai: CellValue): number {
  const human = ai === 1 ? 2 : 1;
  const validCols = getValidCols(board);

  if (isWin(board, ai)) return WIN_SCORE + depth;
  if (isWin(board, human)) return -(WIN_SCORE + depth);
  if (validCols.length === 0 || depth === 0) return scoreBoard(board, ai);

  if (maximizing) {
    let value = -Infinity;
    for (const col of validCols) {
      value = Math.max(value, minimax(drop(board, col, ai), depth - 1, alpha, beta, false, ai));
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  } else {
    let value = Infinity;
    for (const col of validCols) {
      value = Math.min(value, minimax(drop(board, col, human as CellValue), depth - 1, alpha, beta, true, ai));
      beta = Math.min(beta, value);
      if (alpha >= beta) break;
    }
    return value;
  }
}

export function getBestMove(board: Board, ai: CellValue, depth = 6): number {
  const validCols = getValidCols(board);
  let bestCol = validCols[Math.floor(validCols.length / 2)];
  let bestScore = -Infinity;

  for (const col of validCols) {
    const score = minimax(drop(board, col, ai), depth - 1, -Infinity, Infinity, false, ai);
    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }
  }
  return bestCol;
}
