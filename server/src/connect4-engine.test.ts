import { createEmptyBoard, getValidColumns, applyMove, checkWin, ROWS, COLS } from './connect4-engine';

describe('createEmptyBoard', () => {
  it('creates a 6x7 board full of zeros', () => {
    const board = createEmptyBoard();
    expect(board.length).toBe(ROWS);
    expect(board[0].length).toBe(COLS);
    expect(board.every((row) => row.every((cell) => cell === 0))).toBe(true);
  });
});

describe('getValidColumns', () => {
  it('returns all columns on an empty board', () => {
    const board = createEmptyBoard();
    expect(getValidColumns(board)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('excludes full columns', () => {
    const board = createEmptyBoard();
    for (let row = 0; row < ROWS; row++) {
      board[row][2] = 1;
    }
    expect(getValidColumns(board)).toEqual([0, 1, 3, 4, 5, 6]);
  });
});

describe('applyMove', () => {
  it('drops the piece in the lowest empty row of the column', () => {
    const board = createEmptyBoard();
    const { board: next, row } = applyMove(board, 3, 1);
    expect(row).toBe(ROWS - 1);
    expect(next[ROWS - 1][3]).toBe(1);
  });

  it('stacks pieces on top of each other', () => {
    let board = createEmptyBoard();
    board = applyMove(board, 3, 1).board;
    const { board: next, row } = applyMove(board, 3, 2);
    expect(row).toBe(ROWS - 2);
    expect(next[ROWS - 2][3]).toBe(2);
  });

  it('does not mutate the original board', () => {
    const board = createEmptyBoard();
    applyMove(board, 0, 1);
    expect(board).toEqual(createEmptyBoard());
  });

  it('throws when the column is full', () => {
    let board = createEmptyBoard();
    for (let i = 0; i < ROWS; i++) {
      board = applyMove(board, 5, 1).board;
    }
    expect(() => applyMove(board, 5, 2)).toThrow('Columna llena: 5');
  });

  it('throws when the column is out of range', () => {
    const board = createEmptyBoard();
    expect(() => applyMove(board, 7, 1)).toThrow('Columna fuera de rango: 7');
  });

  it('throws when the column index is negative', () => {
    const board = createEmptyBoard();
    expect(() => applyMove(board, -1, 1)).toThrow('Columna fuera de rango: -1');
  });
});

describe('checkWin', () => {
  it('returns null when there is no winner', () => {
    const board = createEmptyBoard();
    board[ROWS - 1][0] = 1;
    expect(checkWin(board, ROWS - 1, 0)).toBeNull();
  });

  it('detects a horizontal win', () => {
    const board = createEmptyBoard();
    for (let col = 0; col < 4; col++) board[ROWS - 1][col] = 1;
    const result = checkWin(board, ROWS - 1, 3);
    expect(result?.winner).toBe(1);
    expect(result?.cells).toHaveLength(4);
  });

  it('detects a vertical win', () => {
    const board = createEmptyBoard();
    for (let row = ROWS - 4; row < ROWS; row++) board[row][2] = 2;
    const result = checkWin(board, ROWS - 4, 2);
    expect(result?.winner).toBe(2);
    expect(result?.cells).toHaveLength(4);
  });

  it('detects a downward diagonal win (↘)', () => {
    const board = createEmptyBoard();
    board[0][0] = 1;
    board[1][1] = 1;
    board[2][2] = 1;
    board[3][3] = 1;
    const result = checkWin(board, 3, 3);
    expect(result?.winner).toBe(1);
    expect(result?.cells).toHaveLength(4);
  });

  it('detects an upward diagonal win (↗)', () => {
    const board = createEmptyBoard();
    board[3][0] = 2;
    board[2][1] = 2;
    board[1][2] = 2;
    board[0][3] = 2;
    const result = checkWin(board, 0, 3);
    expect(result?.winner).toBe(2);
    expect(result?.cells).toHaveLength(4);
  });
});
