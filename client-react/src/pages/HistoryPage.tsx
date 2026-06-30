import { useNavigate } from 'react-router-dom';
import { useGameHistory } from '../hooks/useGameHistory';
import './HistoryPage.css';

const MODE_LABELS: Record<string, string> = {
  'vs-ai': 'VS IA',
  'create-room': 'Multijugador',
  'join-room': 'Multijugador',
  'matchmaking': 'Matchmaking',
};

const RESULT_LABELS: Record<string, string> = {
  win: '🏆 Victoria',
  loss: '💀 Derrota',
  draw: '🤝 Empate',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const { history, clearHistory } = useGameHistory();

  return (
    <div className="history-page">
      <header className="history-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Volver</button>
        <h1>Historial</h1>
        {history.length > 0 && (
          <button className="clear-btn" onClick={clearHistory}>Borrar todo</button>
        )}
      </header>

      {history.length === 0 ? (
        <div className="history-empty">
          <p>Aún no has jugado ninguna partida.</p>
          <button onClick={() => navigate('/lobby')}>Jugar ahora</button>
        </div>
      ) : (
        <div className="history-stats">
          <div className="stat-card">
            <span className="stat-value">{history.length}</span>
            <span className="stat-label">Partidas</span>
          </div>
          <div className="stat-card win">
            <span className="stat-value">{history.filter(e => e.result === 'win').length}</span>
            <span className="stat-label">Victorias</span>
          </div>
          <div className="stat-card loss">
            <span className="stat-value">{history.filter(e => e.result === 'loss').length}</span>
            <span className="stat-label">Derrotas</span>
          </div>
          <div className="stat-card draw">
            <span className="stat-value">{history.filter(e => e.result === 'draw').length}</span>
            <span className="stat-label">Empates</span>
          </div>
        </div>
      )}

      <ul className="history-list">
        {history.map(entry => (
          <li key={entry.id} className={`history-entry result-${entry.result}`}>
            <span className="entry-result">{RESULT_LABELS[entry.result]}</span>
            <span className="entry-mode">{MODE_LABELS[entry.mode] ?? entry.mode}</span>
            <span className="entry-turns">{entry.turns} turnos</span>
            <span className="entry-date">{formatDate(entry.date)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
