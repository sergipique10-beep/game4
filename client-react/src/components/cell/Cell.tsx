import { memo } from 'react';
import type { CellValue } from '../../types';
import './Cell.css';

interface Props {
  value: CellValue;
  highlighted?: boolean;
  onClick?: () => void;
  hovering?: boolean;
}

function Cell({ value, highlighted = false, onClick, hovering = false }: Props) {
  return (
    <div
      className={`cell ${onClick ? 'clickable' : ''} ${hovering ? 'hovering' : ''}`}
      onClick={onClick}
    >
      <div className={`piece piece-${value} ${highlighted ? 'highlighted' : ''}`} />
    </div>
  );
}

export default memo(Cell);
