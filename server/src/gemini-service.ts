import { Board, CellValue } from './types';

export function buildPrompt(board: Board, aiPlayer: CellValue): string {
  const rows = board.map((row) => row.join(' ')).join('\n');
  return [
    'Estás jugando una partida de Conecta 4.',
    'El tablero tiene 6 filas y 7 columnas (0 a 6), 0 = vacío, 1 = jugador 1, 2 = jugador 2.',
    `Tú eres el jugador ${aiPlayer}.`,
    'Tablero actual (fila 0 = arriba):',
    rows,
    'Responde únicamente con el número de columna (0-6) donde quieres jugar.',
  ].join('\n');
}

export function parseColumn(response: string): number | null {
  const match = response.match(/(?<![0-9])[0-6](?![0-9])/);
  if (!match) return null;
  return parseInt(match[0], 10);
}
