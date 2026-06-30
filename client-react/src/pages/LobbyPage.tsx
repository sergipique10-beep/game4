import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { useGame } from '../context/GameContext';
import CyberBg from '../components/CyberBg';
import './LobbyPage.css';

export default function LobbyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { playerName } = usePlayer();
  const { createRoom, joinRoom, playVsAI, findMatch, cancelMatch, gameStatus } = useGame();

  const [showDifficulty, setShowDifficulty] = useState(false);
  const [joinCode, setJoinCode] = useState(searchParams.get('room') ?? '');

  useEffect(() => {
    if (gameStatus === 'playing' || gameStatus === 'waiting') navigate('/game');
  }, [gameStatus, navigate]);

  const avatar = (playerName || '?').charAt(0).toUpperCase();

  return (
    <>
      <CyberBg />
      <div className="home-wrap">
        <div className="cyber-panel home-panel">

          <button className="btn-back" onClick={() => navigate('/')}>← Menú</button>

          <div className="player-bar">
            <div className="lobby-avatar">{avatar}</div>
            <div className="player-info">
              <span className="cyber-label">JUGADOR ACTIVO</span>
              <span className="player-name-display">{(playerName || '?').toUpperCase()}</span>
            </div>
          </div>

          <h2 className="cyber-title lobby-section-title">SELECCIONAR MODO</h2>

          {gameStatus === 'searching' ? (
            <div className="lobby-searching">
              <div className="lobby-spinner" />
              <span className="cyber-label">Buscando rival…</span>
              <button className="btn-ghost cancel-diff" onClick={cancelMatch}>CANCELAR</button>
            </div>
          ) : (
            <>
              <div className="lobby-options">
                <button className="option-btn" onClick={createRoom}>
                  <span className="option-icon">⬡</span>
                  <span>
                    <span className="option-label">SALA PRIVADA</span>
                    <span className="option-desc">Genera un código e invita a un amigo</span>
                  </span>
                </button>

                <button className="option-btn btn-magenta" onClick={findMatch}>
                  <span className="option-icon">◈</span>
                  <span>
                    <span className="option-label">BUSCAR RIVAL</span>
                    <span className="option-desc">Matchmaking automático online</span>
                  </span>
                </button>

                <button className="option-btn btn-violet" onClick={() => setShowDifficulty(v => !v)}>
                  <span className="option-icon">⬟</span>
                  <span>
                    <span className="option-label">VS INTELIGENCIA ARTIFICIAL</span>
                    <span className="option-desc">Desafía al sistema de IA</span>
                  </span>
                </button>
              </div>

              {showDifficulty && (
                <div className="lobby-difficulty-picker">
                  <span className="cyber-label">SELECCIONAR DIFICULTAD</span>
                  <div className="lobby-difficulty-btns">
                    <button className="diff-btn" onClick={() => { setShowDifficulty(false); playVsAI('easy'); }}>
                      <span className="diff-icon">◎</span>
                      <span className="diff-label">FÁCIL</span>
                      <span className="diff-desc">Gemini — impredecible</span>
                    </button>
                    <button className="diff-btn diff-btn--hard" onClick={() => { setShowDifficulty(false); playVsAI('hard'); }}>
                      <span className="diff-icon">◉</span>
                      <span className="diff-label">DIFÍCIL</span>
                      <span className="diff-desc">Minimax — juega perfecto</span>
                    </button>
                  </div>
                  <button className="btn-ghost cancel-diff" onClick={() => setShowDifficulty(false)}>CANCELAR</button>
                </div>
              )}
            </>
          )}

          <div className="lobby-join-section">
            <span className="cyber-label">¿TIENES UN CÓDIGO?</span>
            <div className="lobby-join-row">
              <input
                className="cyber-input join-input"
                type="text"
                maxLength={4}
                placeholder="XXXX"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && joinCode.trim().length === 4 && joinRoom(joinCode.trim())}
                autoComplete="off"
              />
              <button
                className="btn-ghost"
                disabled={joinCode.trim().length !== 4}
                onClick={() => joinRoom(joinCode.trim())}
              >
                UNIRSE
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
