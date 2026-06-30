import { memo } from 'react';
import './PlayerCard.css';

interface Props {
  name: string;
  player: 1 | 2;
  isMyTurn: boolean;
  isMe?: boolean;
}

function PlayerCard({ name, player, isMyTurn, isMe = false }: Props) {
  return (
    <div className={`player-card player-${player} ${isMyTurn ? 'active' : ''}`}>
      <div className="player-piece" />
      <div className="player-info">
        <span className="player-name">{name}{isMe ? ' (tú)' : ''}</span>
        {isMyTurn && <span className="turn-badge">Tu turno</span>}
      </div>
    </div>
  );
}

export default memo(PlayerCard);
