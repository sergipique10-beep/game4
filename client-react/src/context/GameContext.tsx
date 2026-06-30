import { createContext, useContext, useState, useCallback, useMemo, useRef, ReactNode } from 'react';
import type { Board, GameStatus, GameOverInfo, LastMove, AIDifficulty } from '../types';

// Mirrors Angular GameSocketService public interface
interface GameContextValue {
  // State
  board: Board;
  gameStatus: GameStatus;
  currentPlayer: 1 | 2;
  myPlayer: 1 | 2 | null;
  roomCode: string | null;
  lastMove: LastMove | null;
  gameOver: GameOverInfo | null;
  turnCount: number;

  // Actions — mirrors Angular service methods exactly
  createRoom: () => void;
  joinRoom: (code: string) => void;
  playVsAI: (difficulty?: AIDifficulty) => void;
  findMatch: () => void;
  cancelMatch: () => void;
  makeMove: (column: number) => void;
  requestRematch: () => void;
  leaveRoom: () => void;

  // Internal plumbing used by WsBridge
  registerSend: (fn: (msg: object) => void) => void;
  handleServerMessage: (msg: ServerMessage) => void;
  subscribeToMessages: (handler: (msg: ServerMessage) => void) => () => void;
}

export type ServerMessage =
  | { type: 'room_created'; code: string }
  | { type: 'opponent_joined' }
  | { type: 'game_start'; board: Board; currentPlayer: 1 | 2 }
  | { type: 'move_made'; board: Board; currentPlayer: 1 | 2; lastMove: LastMove }
  | { type: 'game_over'; board: Board; currentPlayer: 1 | 2; lastMove: LastMove; result: GameOverInfo }
  | { type: 'rematch_accepted'; board: Board; currentPlayer: 1 | 2 }
  | { type: 'searching' }
  | { type: 'opponent_disconnected' }
  | { type: 'opponent_left' }
  | { type: 'error'; message: string };

const emptyBoard = (): Board => Array.from({ length: 6 }, () => Array(7).fill(0) as (0 | 1 | 2)[]);

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [board, setBoard] = useState<Board>(emptyBoard());
  const [gameStatus, setGameStatus] = useState<GameStatus>('idle');
  const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1);
  const [myPlayer, setMyPlayer] = useState<1 | 2 | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [gameOver, setGameOver] = useState<GameOverInfo | null>(null);
  const [turnCount, setTurnCount] = useState(0);

  // Store send fn in a ref so action methods always see the latest without stale closures
  const sendFnRef = useRef<((msg: object) => void) | null>(null);
  const listenersRef = useRef<Set<(msg: ServerMessage) => void>>(new Set());

  const registerSend = useCallback((fn: (msg: object) => void) => {
    sendFnRef.current = fn;
  }, []);

  const send = useCallback((msg: object) => {
    sendFnRef.current?.(msg);
  }, []);

  const subscribeToMessages = useCallback((handler: (msg: ServerMessage) => void) => {
    listenersRef.current.add(handler);
    return () => { listenersRef.current.delete(handler); };
  }, []);

  // ── Action methods — mirrors Angular GameSocketService ──

  const createRoom = useCallback(() => {
    setMyPlayer(1);
    send({ type: 'create_room' });
  }, [send]);

  const joinRoom = useCallback((code: string) => {
    setMyPlayer(2);
    send({ type: 'join_room', code });
  }, [send]);

  const playVsAI = useCallback((difficulty: AIDifficulty = 'easy') => {
    setMyPlayer(1);
    send({ type: 'play_vs_ai', difficulty });
  }, [send]);

  const findMatch = useCallback(() => {
    setMyPlayer(1);
    setGameStatus('searching');
    send({ type: 'find_match' });
  }, [send]);

  const cancelMatch = useCallback(() => {
    send({ type: 'cancel_match' });
    setGameStatus('idle');
  }, [send]);

  const makeMove = useCallback((column: number) => {
    send({ type: 'make_move', column });
  }, [send]);

  const requestRematch = useCallback(() => {
    send({ type: 'request_rematch' });
  }, [send]);

  const leaveRoom = useCallback(() => {
    send({ type: 'leave_room' });
    setBoard(emptyBoard());
    setGameStatus('idle');
    setCurrentPlayer(1);
    setMyPlayer(null);
    setRoomCode(null);
    setLastMove(null);
    setGameOver(null);
    setTurnCount(0);
  }, [send]);

  // ── Server message handler ──

  const handleServerMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'room_created':
        setRoomCode(msg.code);
        setMyPlayer(1);
        setGameStatus('waiting');
        break;
      case 'opponent_joined':
        setGameStatus('playing');
        break;
      case 'game_start':
        setBoard(msg.board);
        setCurrentPlayer(msg.currentPlayer);
        // myPlayer is set before sending (createRoom→1, joinRoom→2, playVsAI→1)
        // so we only fall back to 2 if somehow not set
        setMyPlayer(prev => prev ?? 2);
        setGameStatus('playing');
        setGameOver(null);
        setLastMove(null);
        setTurnCount(0);
        break;
      case 'move_made':
        setBoard(msg.board);
        setCurrentPlayer(msg.currentPlayer);
        setLastMove(msg.lastMove);
        setTurnCount(prev => prev + 1);
        break;
      case 'game_over':
        setBoard(msg.board);
        setLastMove(msg.lastMove);
        setGameOver(msg.result);
        setGameStatus('finished');
        break;
      case 'rematch_accepted':
        setBoard(msg.board);
        setCurrentPlayer(msg.currentPlayer);
        setGameStatus('playing');
        setGameOver(null);
        setLastMove(null);
        setTurnCount(0);
        break;
      case 'searching':
        setGameStatus('searching');
        break;
      case 'opponent_disconnected':
      case 'opponent_left':
        setGameStatus('finished');
        break;
    }
    listenersRef.current.forEach(h => h(msg));
  }, []);

  const value = useMemo<GameContextValue>(() => ({
    board, gameStatus, currentPlayer, myPlayer,
    roomCode, lastMove, gameOver, turnCount,
    createRoom, joinRoom, playVsAI, findMatch, cancelMatch, makeMove, requestRematch, leaveRoom,
    registerSend, handleServerMessage, subscribeToMessages,
  }), [
    board, gameStatus, currentPlayer, myPlayer,
    roomCode, lastMove, gameOver, turnCount,
    createRoom, joinRoom, playVsAI, findMatch, cancelMatch, makeMove, requestRematch, leaveRoom,
    registerSend, handleServerMessage, subscribeToMessages,
  ]);

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside GameProvider');
  return ctx;
}

export type { AIDifficulty };
