import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { usePlayer } from '../context/PlayerContext';
import { useGameHistory } from '../hooks/useGameHistory';
import Board from '../components/board/Board';
import PlayerCard from '../components/player-card/PlayerCard';
import WaitingRoom from '../components/waiting-room/WaitingRoom';
import GameOverModal from '../components/game-over-modal/GameOverModal';
import Toast from '../components/toast/Toast';
import './GamePage.css';

export default function GamePage() {
  const navigate = useNavigate();
  const { playerName } = usePlayer();
  const { addEntry } = useGameHistory();
  const {
    board, gameStatus, currentPlayer, myPlayer,
    roomCode, lastMove, gameOver, turnCount,
    makeMove, requestRematch, leaveRoom, subscribeToMessages,
  } = useGame();

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToMessages((msg) => {
      if (msg.type === 'opponent_disconnected' || msg.type === 'opponent_left') {
        setToast('Tu rival se ha desconectado');
      }
      if (msg.type === 'error') {
        setToast(msg.message);
      }
      if (msg.type === 'game_over' && myPlayer) {
        addEntry(msg.result, myPlayer, roomCode ? 'create-room' : 'vs-ai', 'Rival', turnCount);
      }
    });
  }, [subscribeToMessages, myPlayer, roomCode, turnCount, addEntry]);

  useEffect(() => {
    if (gameStatus === 'idle') navigate('/lobby');
  }, [gameStatus, navigate]);

  if (gameStatus === 'idle') return null;

  const isMyTurn = gameStatus === 'playing' && currentPlayer === myPlayer;
  const opponentName = myPlayer === 1 ? 'Rival' : playerName;
  const highlightCells: [number, number][] = gameOver?.cells ?? [];

  function handleExit() {
    leaveRoom();
    navigate('/lobby');
  }

  const handleColumnClick = useCallback((col: number) => {
    if (gameStatus !== 'playing' || currentPlayer !== myPlayer) return;
    makeMove(col);
  }, [gameStatus, currentPlayer, myPlayer, makeMove]);

  return (
    <div className="game-page">
      <header className="game-header">
        <button className="back-btn" onClick={handleExit}>← Salir</button>
        <h1 className="game-title">4 en Raya</h1>
        <span className="game-turn-count">Turno {turnCount}</span>
      </header>

      {gameStatus === 'waiting' && roomCode && (
        <WaitingRoom roomCode={roomCode} />
      )}

      {(gameStatus === 'playing' || gameStatus === 'finished') && myPlayer && (
        <div className="game-body">
          <div className="players-row">
            <PlayerCard
              name={myPlayer === 1 ? playerName || 'Tú' : opponentName}
              player={1}
              isMyTurn={currentPlayer === 1}
              isMe={myPlayer === 1}
            />
            <span className="vs-label">VS</span>
            <PlayerCard
              name={myPlayer === 2 ? playerName || 'Tú' : opponentName}
              player={2}
              isMyTurn={currentPlayer === 2}
              isMe={myPlayer === 2}
            />
          </div>

          {gameStatus === 'playing' && (
            <p className="turn-hint">
              {isMyTurn ? '🎯 Es tu turno — haz clic en una columna' : '⏳ Esperando al rival…'}
            </p>
          )}

          <Board
            board={board}
            interactive={isMyTurn}
            onColumnClick={handleColumnClick}
            highlightCells={highlightCells}
            lastMove={lastMove}
          />
        </div>
      )}

      {gameStatus === 'finished' && gameOver && myPlayer && (
        <GameOverModal
          gameOver={gameOver}
          myPlayer={myPlayer}
          onRematch={requestRematch}
          onExit={handleExit}
        />
      )}

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
