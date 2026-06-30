import type { GameOverInfo } from '../../types';
import './GameOverModal.css';

interface Props {
  gameOver: GameOverInfo;
  myPlayer: 1 | 2;
  onRematch: () => void;
  onExit: () => void;
}

export default function GameOverModal({ gameOver, myPlayer, onRematch, onExit }: Props) {
  const isWin = gameOver.result === 'win';
  const isDraw = gameOver.result === 'draw';
  const iWon = isWin && gameOver.winner === myPlayer;

  const title = isDraw ? '¡Empate!' : iWon ? '¡Has ganado!' : '¡Has perdido!';
  const subtitle = isDraw
    ? 'Nadie se lleva el punto esta vez'
    : iWon
    ? '¡Bien jugado! 4 en raya conseguido'
    : 'Tu rival conectó 4 primero';

  return (
    <div className="modal-overlay">
      <div className={`modal-box result-${isDraw ? 'draw' : iWon ? 'win' : 'lose'}`}>
        <h2 className="modal-title">{title}</h2>
        <p className="modal-subtitle">{subtitle}</p>
        <div className="modal-actions">
          <button className="btn-rematch" onClick={onRematch}>
            Revancha
          </button>
          <button className="btn-exit" onClick={onExit}>
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}
