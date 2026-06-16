import { buildPrompt, parseColumn, getAIMove, GeminiClient } from './gemini-service';
import { createEmptyBoard, applyMove, getValidColumns } from './connect4-engine';

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

function makeClient(responses: string[]): GeminiClient {
  let call = 0;
  return {
    generateMove: jest.fn(async () => {
      const response = responses[call];
      call += 1;
      return response;
    }),
  };
}

describe('getAIMove', () => {
  it('returns the parsed column on a valid first response', async () => {
    const board = createEmptyBoard();
    const client = makeClient(['3']);
    const col = await getAIMove(board, 2, client);
    expect(col).toBe(3);
    expect(client.generateMove).toHaveBeenCalledTimes(1);
  });

  it('retries when the response is unparseable', async () => {
    const board = createEmptyBoard();
    const client = makeClient(['no sé', '5']);
    const col = await getAIMove(board, 2, client);
    expect(col).toBe(5);
    expect(client.generateMove).toHaveBeenCalledTimes(2);
  });

  it('retries when the column is full, then falls back to random after exhausting retries', async () => {
    const board = createEmptyBoard();
    for (let i = 0; i < 6; i++) {
      board[i][0] = 1;
    }
    const client = makeClient(['0', '0', '0']);
    const col = await getAIMove(board, 2, client);
    expect(getValidColumns(board)).toContain(col);
    expect(client.generateMove).toHaveBeenCalledTimes(3);
  });

  it('falls back to a random valid column if the client throws', async () => {
    const board = createEmptyBoard();
    const client: GeminiClient = {
      generateMove: jest.fn(async () => {
        throw new Error('network error');
      }),
    };
    const col = await getAIMove(board, 2, client);
    expect(getValidColumns(board)).toContain(col);
    expect(client.generateMove).toHaveBeenCalledTimes(3);
  });
});
