import { useEffect, useRef, useCallback } from 'react';
import type { ServerMessage } from '../context/GameContext';

const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

export function useWebSocket(
  onMessage: (msg: ServerMessage) => void,
  registerSend: (fn: (msg: object) => void) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<string[]>([]);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  // Mirrors Angular's send() with pendingMessages queue
  const send = useCallback((msg: object) => {
    const data = JSON.stringify(msg);
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(data);
    } else {
      pendingRef.current.push(data);
    }
  }, []);

  useEffect(() => {
    registerSend(send);
  }, [registerSend, send]);

  useEffect(() => {
    let active = true;

    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!active) { ws.close(); return; }
        // Flush pending messages — mirrors Angular's pendingMessages flush in onopen
        for (const msg of pendingRef.current) ws.send(msg);
        pendingRef.current = [];
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as ServerMessage;
          onMessageRef.current(msg);
        } catch {
          console.warn('Mensaje WS no válido:', event.data);
        }
      };

      ws.onerror = () => console.warn('WebSocket error');

      ws.onclose = () => {
        if (active) wsRef.current = null;
      };
    }

    connect();

    return () => {
      active = false;
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws?.readyState === WebSocket.OPEN) ws.close();
    };
  }, []);
}
