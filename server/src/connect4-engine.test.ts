import { createEmptyBoard, getValidColumns, ROWS, COLS } from './connect4-engine';

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
