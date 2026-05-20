"use client";
import { useEffect, useRef, useCallback } from "react";
import type { WSEvent } from "@/types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export function useRoomWS(
  roomId: string | null,
  token: string | null,
  onEvent: (event: WSEvent) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!roomId || !token) return;

    let alive = true;
    let pingInterval: ReturnType<typeof setInterval>;

    function connect() {
      if (!alive) return;
      const ws = new WebSocket(`${WS_URL}/ws/room/${roomId}?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 25000);
      };

      ws.onmessage = (e) => {
        try {
          const event: WSEvent = JSON.parse(e.data);
          onEventRef.current(event);
        } catch {}
      };

      ws.onclose = () => {
        clearInterval(pingInterval);
        if (alive) setTimeout(connect, 2000); // Reconnect
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      alive = false;
      clearInterval(pingInterval);
      wsRef.current?.close();
    };
  }, [roomId, token]);
}
