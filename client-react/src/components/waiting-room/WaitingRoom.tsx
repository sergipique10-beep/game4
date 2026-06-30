import { useState } from 'react';
import './WaitingRoom.css';

interface Props {
  roomCode: string;
}

export default function WaitingRoom({ roomCode }: Props) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    const url = `${window.location.origin}/lobby?room=${roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="waiting-room">
      <h2>Esperando rival…</h2>
      <p className="waiting-sub">Comparte el código con tu amigo</p>

      <div className="room-code">{roomCode}</div>

      <button className="copy-btn" onClick={copyLink}>
        {copied ? '✓ Enlace copiado' : 'Copiar enlace'}
      </button>

      <div className="spinner" aria-label="Buscando jugador" />
    </div>
  );
}
