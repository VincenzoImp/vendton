import { useState, useEffect, useRef, useCallback } from "react";

export interface SettlementEvent {
  type: string;
  dvmId?: string;
  dvmName?: string;
  payer: string;
  amount: string;
  asset?: string;
  payTo?: string;
  transaction: string;
  network?: string;
  timestamp: number;
}

interface UseWebSocketReturn {
  events: SettlementEvent[];
  isConnected: boolean;
  lastEvent: SettlementEvent | null;
}

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "ws://localhost:4000/ws"
    : "wss://vendton-gateway.up.railway.app/ws");
const MAX_EVENTS = 100;
const MAX_RECONNECT_DELAY = 30_000;
const BASE_RECONNECT_DELAY = 1_000;

export function useWebSocket(): UseWebSocketReturn {
  const [events, setEvents] = useState<SettlementEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SettlementEvent | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === "settlement" || data.type === "dvm_called") {
            const settlement: SettlementEvent = {
              type: data.type,
              dvmId: data.dvmId || data.serviceId || "",
              dvmName: data.dvmName || data.serviceName || "",
              payer: data.payer || "",
              amount: data.amount || "",
              asset: data.asset || "",
              payTo: data.payTo || "",
              transaction: data.transaction || "",
              network: data.network || "",
              timestamp: data.timestamp || Date.now(),
            };
            setLastEvent(settlement);
            setEvents((prev) => [settlement, ...prev].slice(0, MAX_EVENTS));
          }
        } catch {
          // Ignore non-JSON
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        wsRef.current = null;
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      scheduleReconnect();
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    if (reconnectTimerRef.current) return;

    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current),
      MAX_RECONNECT_DELAY,
    );
    reconnectAttemptRef.current += 1;

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      if (mountedRef.current) connect();
    }, delay);
  }, [connect]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { events, isConnected, lastEvent };
}
