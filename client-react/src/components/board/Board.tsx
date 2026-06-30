import { useState } from 'react';
import Cell from '../cell/Cell';
import type { Board as BoardType } from '../../types';
import './Board.css';

interface Props {
  board: BoardType;
  interactive: boolean;
  onColumnClick?: (col: number) => void;
  highlightCells?: [number, number][];
  lastMove?: { row: number; col: number } | null;
}

export default function Board({ board, interactive, onColumnClick, highlightCells = [], lastMove }: Props) {
  const [hoverCol, setHoverCol] = useState<number | null>(null);

  const isHighlighted = (row: number, col: number) =>
    highlightCells.some(([r, c]) => r === row && c === col);

  const COLS = board[0]?.length ?? 7;

  return (
    <div className="board-wrap">
      <div className="board">
        {Array.from({ length: COLS }, (_, col) => (
          <div
            key={col}
            className="board-col"
            onMouseEnter={() => interactive && setHoverCol(col)}
            onMouseLeave={() => setHoverCol(null)}
            onClick={() => interactive && onColumnClick?.(col)}
          >
            {board.map((row, rowIdx) => (
              <Cell
                key={rowIdx}
                value={row[col]}
                highlighted={isHighlighted(rowIdx, col)}
                onClick={interactive ? () => onColumnClick?.(col) : undefined}
                hovering={interactive && hoverCol === col && row[col] === 0}
              />
            ))}
          </div>
        ))}
      </div>
      {lastMove && (
        <p className="board-last-move">
          Última jugada: fila {lastMove.row + 1}, columna {lastMove.col + 1}
        </p>
      )}
    </div>
  );
}
