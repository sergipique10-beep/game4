import { createContext, useContext, useState, useCallback, useRef, ReactNode, useEffect } from 'react';

export interface SnakePoint { x: number; y: number; }

export interface SnakePlayer {
  id: string;
  body: SnakePoint[];
  direction: string;
  alive: boolean;
  score: number;
  color: string;
}

export interface SnakeGameState {
  snakes: SnakePlayer[];
  food: SnakePoint[];
  tick: number;
  width: number;
  height: number;
}

export interface SnakeRanking {
  playerId: string;
  name: string;
  score: number;
  color: string;
  position: number;
}

export type SnakePhase = 'lobby' | 'waiting' | 'countdown' | 'playing' | 'gameOver';

interface SnakeContextValue {
  phase: SnakePhase;
  roomCode: string | null;
  isOwner: boolean;
  isAI: boolean;
  playerCount: number;
  countdown: number | null;
  gameState: SnakeGameState | null;
  myId: string | null;
  rankings: SnakeRanking[] | null;
  errorMessage: string | null;
  awaitingRematch: boolean;
  createRoom: (name: string) => void;
  joinRoom: (code: string, name: string) => void;
  playVsAI: (name: string) => void;
  ownerStart: () => void;
  sendDirection: (dir: 'up' | 'down' | 'left' | 'right') => void;
  requestRematch: () => void;
  leaveRoom: () => void;
  clearError: () => void;
}

const SnakeContext = createContext<SnakeContextValue | null>(null);

export function SnakeProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<SnakePhase>('lobby');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isAI, setIsAI] = useState(false);
  const [playerCount, setPlayerCount] = useState(1);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [gameState, setGameState] = useState<SnakeGameState | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [rankings, setRankings] = useState<SnakeRanking[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [awaitingRematch, setAwaitingRematch] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<string[]>([]);
  const phaseRef = useRef<SnakePhase>('lobby');

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

  const handleMsg = useCallback((msg: Record<string, unknown>) => {
    switch (msg.type) {
      case 'snake_room_created':
        setRoomCode(msg.code as string);
        setMyId(msg.yourId as string);
        setIsOwner(true);
        setPhase('waiting');
        break;
      case 'snake_player_joined':
        setPlayerCount(msg.playerCount as number);
        break;
      case 'snake_countdown':
        setCountdown(msg.seconds as number);
        setPhase('countdown');
        break;
      case 'snake_game_start':
        setGameState(msg.state as SnakeGameState);
        if (msg.yourId) setMyId(msg.yourId as string);
        setCountdown(null);
        setAwaitingRematch(false);
        setPhase('playing');
        break;
      case 'snake_game_tick':
        setGameState(msg.state as SnakeGameState);
        break;
      case 'snake_game_over':
        setRankings(msg.rankings as SnakeRanking[]);
        setPhase('gameOver');
        break;
      case 'snake_player_left':
        setErrorMessage('Un jugador ha abandonado la partida');
        break;
      case 'error':
        setErrorMessage(msg.message as string);
        if (phaseRef.current === 'waiting') {
          setPhase('lobby');
          setRoomCode(null);
          setIsOwner(false);
          setPlayerCount(1);
        }
        break;
    }
  }, []);

  const connectWS = useCallback(() => {
    const ws = wsRef.current;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    const url = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
    const newWs = new WebSocket(url);
    wsRef.current = newWs;
    newWs.onopen = () => {
      for (const msg of pendingRef.current) newWs.send(msg);
      pendingRef.current = [];
    };
    newWs.onmessage = (e) => {
      try { handleMsg(JSON.parse(e.data) as Record<string, unknown>); } catch { /* ignore */ }
    };
    newWs.onerror = () => setErrorMessage('Error de conexión');
    newWs.onclose = () => {
      if (phaseRef.current === 'playing') setErrorMessage('Se perdió la conexión con el servidor');
    };
  }, [handleMsg]);

  const send = useCallback((msg: object) => {
    const str = JSON.stringify(msg);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(str);
    } else {
      pendingRef.current.push(str);
    }
  }, []);

  const createRoom = useCallback((name: string) => {
    setIsAI(false);
    connectWS();
    send({ type: 'snake_create_room', name });
  }, [connectWS, send]);

  const joinRoom = useCallback((code: string, name: string) => {
    setIsAI(false);
    setRoomCode(code);
    setIsOwner(false);
    setPhase('waiting');
    connectWS();
    send({ type: 'snake_join_room', code, name });
  }, [connectWS, send]);

  const playVsAI = useCallback((name: string) => {
    setIsAI(true);
    connectWS();
    send({ type: 'snake_play_vs_ai', name });
  }, [connectWS, send]);

  const ownerStart = useCallback(() => {
    send({ type: 'snake_owner_start' });
  }, [send]);

  const sendDirection = useCallback((dir: 'up' | 'down' | 'left' | 'right') => {
    send({ type: 'snake_direction', direction: dir });
  }, [send]);

  const requestRematch = useCallback(() => {
    send({ type: 'snake_rematch' });
    setAwaitingRematch(true);
    setPhase('waiting');
    setGameState(null);
    setRankings(null);
    setCountdown(null);
  }, [send]);

  const leaveRoom = useCallback(() => {
    send({ type: 'snake_leave_room' });
    wsRef.current?.close();
    wsRef.current = null;
    pendingRef.current = [];
    setPhase('lobby');
    setRoomCode(null);
    setIsOwner(false);
    setIsAI(false);
    setPlayerCount(1);
    setCountdown(null);
    setGameState(null);
    setMyId(null);
    setRankings(null);
    setErrorMessage(null);
    setAwaitingRematch(false);
  }, [send]);

  const clearError = useCallback(() => setErrorMessage(null), []);

  return (
    <SnakeContext.Provider value={{
      phase, roomCode, isOwner, isAI, playerCount, countdown,
      gameState, myId, rankings, errorMessage, awaitingRematch,
      createRoom, joinRoom, playVsAI, ownerStart,
      sendDirection, requestRematch, leaveRoom, clearError,
    }}>
      {children}
    </SnakeContext.Provider>
  );
}

export function useSnake() {
  const ctx = useContext(SnakeContext);
  if (!ctx) throw new Error('useSnake must be used inside SnakeProvider');
  return ctx;
}
