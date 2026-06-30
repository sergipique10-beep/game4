import { createContext, useContext, useState, ReactNode } from 'react';

interface PlayerContextValue {
  playerName: string;
  setPlayerName: (name: string) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [playerName, setPlayerName] = useState<string>(
    () => localStorage.getItem('playerName') ?? ''
  );

  function handleSetName(name: string) {
    localStorage.setItem('playerName', name);
    setPlayerName(name);
  }

  return (
    <PlayerContext.Provider value={{ playerName, setPlayerName: handleSetName }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider');
  return ctx;
}
