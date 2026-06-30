import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PlayerProvider } from './context/PlayerContext';
import { GameProvider, useGame } from './context/GameContext';
import { SnakeProvider } from './context/SnakeContext';
import { useWebSocket } from './hooks/useWebSocket';
import HomePage from './pages/HomePage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import HistoryPage from './pages/HistoryPage';
import SnakePage from './pages/SnakePage';

function WsBridge() {
  const { handleServerMessage, registerSend } = useGame();
  useWebSocket(handleServerMessage, registerSend);
  return null;
}

export default function App() {
  return (
    <PlayerProvider>
      <GameProvider>
        <BrowserRouter>
          <WsBridge />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/lobby" element={<LobbyPage />} />
            <Route path="/game" element={<GamePage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/snake" element={
              <SnakeProvider>
                <SnakePage />
              </SnakeProvider>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </GameProvider>
    </PlayerProvider>
  );
}
