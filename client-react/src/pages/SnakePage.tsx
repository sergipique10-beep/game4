import { useRef, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSnake } from '../context/SnakeContext';
import { usePlayer } from '../context/PlayerContext';
import CyberBg from '../components/CyberBg';
import './SnakePage.css';

const BOT_ID = '__bot__';

// ─── Lobby ────────────────────────────────────────────────────────────────────

function LobbyView() {
  const { createRoom, joinRoom, playVsAI, errorMessage, clearError } = useSnake();
  const { playerName } = usePlayer();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get('room') ?? '');

  const name = playerName || 'Jugador';
  const avatar = name.charAt(0).toUpperCase();

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
              <span className="player-name-display">{name.toUpperCase()}</span>
            </div>
          </div>

          <h2 className="cyber-title lobby-section-title">SELECCIONAR MODO</h2>

          {errorMessage && (
            <div className="sn-inline-error">
              <span>{errorMessage}</span>
              <button onClick={clearError}>×</button>
            </div>
          )}

          <div className="lobby-options">
            <button className="option-btn btn-violet" onClick={() => playVsAI(name)}>
              <span className="option-icon">⬟</span>
              <span>
                <span className="option-label">VS INTELIGENCIA ARTIFICIAL</span>
                <span className="option-desc">Desafía al sistema de IA</span>
              </span>
            </button>

            <button className="option-btn" onClick={() => createRoom(name)}>
              <span className="option-icon">⬡</span>
              <span>
                <span className="option-label">CREAR PARTIDA</span>
                <span className="option-desc">Genera un código e invita amigos</span>
              </span>
            </button>
          </div>

          <div className="lobby-join-section">
            <span className="cyber-label">¿TIENES UN CÓDIGO?</span>
            <div className="lobby-join-row">
              <input
                className="cyber-input join-input"
                type="text"
                maxLength={4}
                placeholder="XXXX"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && code.trim().length === 4 && joinRoom(code.trim(), name)}
                autoComplete="off"
              />
              <button
                className="btn-ghost"
                disabled={code.trim().length !== 4}
                onClick={() => joinRoom(code.trim(), name)}
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

// ─── Waiting room ─────────────────────────────────────────────────────────────

function WaitingView() {
  const { roomCode, playerCount, isOwner, isAI, awaitingRematch, errorMessage, clearError, ownerStart, leaveRoom } = useSnake();
  const [copied, setCopied] = useState(false);

  function copyLink() {
    if (!roomCode) return;
    const url = `${window.location.origin}/snake?room=${roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  if (isAI || awaitingRematch) {
    return (
      <div className="snake-centered">
        <p className="snake-sub">{awaitingRematch ? 'Esperando revancha…' : 'Iniciando partida vs IA…'}</p>
        <div className="sn-spinner" />
      </div>
    );
  }

  return (
    <div className="snake-centered">
      <h2 className="snake-heading">Sala de espera</h2>

      {errorMessage && (
        <div className="snake-error">
          <span>{errorMessage}</span>
          <button className="sn-close-btn" onClick={clearError}>×</button>
        </div>
      )}

      {roomCode && (
        <div className="sn-code-block">
          <span className="sn-code-label">Código de sala</span>
          <span className="sn-room-code">{roomCode}</span>
          <button className="sn-copy-btn" onClick={copyLink}>
            {copied ? '✓ Copiado' : 'Copiar enlace'}
          </button>
        </div>
      )}

      <div className="sn-player-count">
        <span>{playerCount}/8 jugadores</span>
        <div className="sn-spinner" />
      </div>

      {isOwner ? (
        <button
          className="sn-start-btn"
          disabled={playerCount < 2}
          onClick={ownerStart}
        >
          Comenzar partida
        </button>
      ) : (
        <p className="sn-waiting-text">Esperando al anfitrión…</p>
      )}

      <button className="sn-ghost-btn" onClick={leaveRoom}>Cancelar</button>
    </div>
  );
}

// ─── Countdown ────────────────────────────────────────────────────────────────

function CountdownView() {
  const { countdown } = useSnake();
  return (
    <div className="snake-centered">
      <div className="sn-countdown">
        <span className="sn-countdown-num">{countdown}</span>
        <span className="sn-countdown-label">Iniciando partida…</span>
      </div>
    </div>
  );
}

// ─── Game canvas ──────────────────────────────────────────────────────────────

function GameView() {
  const { gameState, myId, sendDirection, leaveRoom, errorMessage, clearError } = useSnake();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Render game state on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cw = W / gameState.width;
    const ch = H / gameState.height;

    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.strokeStyle = '#1a1a35';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= gameState.width; x++) {
      ctx.beginPath(); ctx.moveTo(x * cw, 0); ctx.lineTo(x * cw, H); ctx.stroke();
    }
    for (let y = 0; y <= gameState.height; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * ch); ctx.lineTo(W, y * ch); ctx.stroke();
    }

    // Food
    ctx.shadowColor = '#ff6b00';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ff6b00';
    for (const f of gameState.food) {
      ctx.fillRect(f.x * cw + 1, f.y * ch + 1, cw - 2, ch - 2);
    }

    // Snakes (render from tail to head so head appears on top)
    for (const snake of gameState.snakes) {
      if (!snake.alive) continue;
      const isMe = snake.id === myId;
      ctx.fillStyle = snake.color;
      for (let i = snake.body.length - 1; i >= 0; i--) {
        const seg = snake.body[i];
        ctx.shadowColor = snake.color;
        ctx.shadowBlur = i === 0 ? (isMe ? 20 : 12) : 3;
        ctx.globalAlpha = i === 0 ? 1 : Math.max(0.3, 1 - i * 0.012);
        ctx.fillRect(seg.x * cw + 1, seg.y * ch + 1, cw - 2, ch - 2);
      }
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }, [gameState, myId]);

  // Keyboard controls
  useEffect(() => {
    const KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      ArrowUp: 'up', w: 'up', W: 'up',
      ArrowDown: 'down', s: 'down', S: 'down',
      ArrowLeft: 'left', a: 'left', A: 'left',
      ArrowRight: 'right', d: 'right', D: 'right',
    };
    const handler = (e: KeyboardEvent) => {
      const dir = KEYS[e.key];
      if (dir) { e.preventDefault(); sendDirection(dir); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sendDirection]);

  return (
    <div className="snake-game-layout">
      <header className="sn-game-header">
        <button className="sn-back-btn" onClick={leaveRoom}>← Salir</button>
        <div className="sn-scores">
          {gameState?.snakes.map(s => (
            <span
              key={s.id}
              className={`sn-score-chip${!s.alive ? ' dead' : ''}${s.id === myId ? ' mine' : ''}`}
              style={{ borderColor: s.color, color: s.color }}
            >
              {s.id === BOT_ID ? '🤖' : s.id === myId ? '★' : '●'} {s.score}
            </span>
          ))}
        </div>
      </header>

      {errorMessage && (
        <div className="snake-error banner">
          <span>{errorMessage}</span>
          <button className="sn-close-btn" onClick={clearError}>×</button>
        </div>
      )}

      <canvas ref={canvasRef} width={800} height={600} className="sn-canvas" />

      <div className="sn-dpad">
        <button className="sn-dpad-btn" onClick={() => sendDirection('up')}>▲</button>
        <div className="sn-dpad-row">
          <button className="sn-dpad-btn" onClick={() => sendDirection('left')}>◄</button>
          <div className="sn-dpad-center" />
          <button className="sn-dpad-btn" onClick={() => sendDirection('right')}>►</button>
        </div>
        <button className="sn-dpad-btn" onClick={() => sendDirection('down')}>▼</button>
      </div>
    </div>
  );
}

// ─── Game over ────────────────────────────────────────────────────────────────

function GameOverView() {
  const { rankings, myId, requestRematch, leaveRoom } = useSnake();

  return (
    <div className="snake-centered">
      <h2 className="snake-heading">Fin de partida</h2>
      <div className="sn-rankings">
        {rankings?.map(r => (
          <div
            key={r.playerId}
            className={`sn-rank-row pos-${r.position}${r.playerId === myId ? ' mine' : ''}`}
          >
            <span className="sn-rank-pos">#{r.position}</span>
            <span className="sn-rank-name" style={{ color: r.color }}>
              {r.playerId === BOT_ID ? '🤖 IA' : r.playerId === myId ? `${r.name} (Tú)` : r.name}
            </span>
            <span className="sn-rank-score">{r.score} pts</span>
          </div>
        ))}
      </div>
      <div className="sn-gameover-actions">
        <button onClick={requestRematch}>Revancha</button>
        <button className="sn-ghost-btn" onClick={leaveRoom}>Salir</button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SnakePage() {
  const { phase } = useSnake();
  return (
    <div className="snake-page-root">
      {phase === 'lobby'    && <LobbyView />}
      {phase === 'waiting'  && <WaitingView />}
      {phase === 'countdown' && <CountdownView />}
      {phase === 'playing'  && <GameView />}
      {phase === 'gameOver' && <GameOverView />}
    </div>
  );
}
