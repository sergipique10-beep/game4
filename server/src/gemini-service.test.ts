import { buildPrompt, parseColumn } from './gemini-service';
import { createEmptyBoard, applyMove } from './connect4-engine';

describe('buildPrompt', () => {
  it('includes the board and asks for a column 0-6', () => {
    const board = applyMove(createEmptyBoard(), 3, 1).board;
    const prompt = buildPrompt(board, 2);
    expect(prompt).toContain('0');
    expect(prompt).toContain('6');
    expect(prompt).toContain('1');
    expect(prompt).toContain('0 0 0 1 0 0 0');
  });
});

describe('parseColumn', () => {
  it('parses a plain digit', () => {
    expect(parseColumn('4')).toBe(4);
  });

  it('parses a digit embedded in text', () => {
    expect(parseColumn('La mejor jugada es la columna 2.')).toBe(2);
  });

  it('returns null when there is no valid digit', () => {
    expect(parseColumn('no lo sé')).toBeNull();
  });

  it('returns null for digits outside 0-6', () => {
    expect(parseColumn('9')).toBeNull();
  });

  it('does not parse a digit that is part of a larger number', () => {
    expect(parseColumn('10')).toBeNull();
  });
});
