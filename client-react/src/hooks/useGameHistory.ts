import { useState, useCallback } from 'react';
import type { GameHistoryEntry, GameMode, GameOverInfo } from '../types';

const STORAGE_KEY = 'game4_history';

function loadHistory(): GameHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function useGameHistory() {
  const [history, setHistory] = useState<GameHistoryEntry[]>(loadHistory);

  const addEntry = useCallback((
    gameOver: GameOverInfo,
    myPlayer: 1 | 2,
    mode: GameMode,
    opponent: string,
    turns: number
  ) => {
    const result: GameHistoryEntry['result'] =
      gameOver.result === 'draw' ? 'draw' :
      gameOver.winner === myPlayer ? 'win' : 'loss';

    const entry: GameHistoryEntry = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      result,
      mode,
      opponent,
      turns,
    };

    setHistory(prev => {
      const updated = [entry, ...prev].slice(0, 50);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  }, []);

  return { history, addEntry, clearHistory };
}
