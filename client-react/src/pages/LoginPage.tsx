import { useState, useEffect, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import CyberBg from '../components/CyberBg';
import './LoginPage.css';

export default function LoginPage() {
  const [name, setName] = useState('');
  const { playerName, setPlayerName } = usePlayer();
  const navigate = useNavigate();

  useEffect(() => {
    if (playerName) navigate('/', { replace: true });
  }, [playerName, navigate]);

  function onSubmit() {
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    setPlayerName(trimmed);
    navigate('/');
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onSubmit();
  }

  return (
    <>
      <CyberBg />
      <div className="login-wrap">
        <div className="cyber-panel login-panel">
          <div className="sys-tag">SYS://ARCADE_v2.0</div>
          <h1 className="cyber-title login-title">
            ARCADE<span className="title-accent">4</span>
          </h1>
          <p className="login-subtitle">IDENTIFICACIÓN DE JUGADOR</p>

          <div className="login-field">
            <label className="cyber-label" htmlFor="nameInput">
              Nombre de combatiente
            </label>
            <input
              id="nameInput"
              className="cyber-input"
              type="text"
              maxLength={18}
              placeholder="INTRODUCE TU NOMBRE"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={onKey}
              autoComplete="off"
              autoFocus
            />
          </div>

          <button
            className="enter-btn"
            disabled={name.trim().length < 2}
            onClick={onSubmit}
          >
            ACCEDER AL SISTEMA
          </button>

          <div className="login-hint">mín. 2 caracteres</div>
        </div>
      </div>
    </>
  );
}
