import { useEffect, useRef } from "react";

const API_BASE = import.meta.env.VITE_API_URL;

const toWebsocketUrl = (base: string) => {
  try {
    const url = new URL(base);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/ws/stream";
    url.search = "";
    return url.toString();
  } catch {
    // Fallback: convert API_BASE to websocket URL
    const fallbackUrl = new URL(API_BASE);
    fallbackUrl.protocol = fallbackUrl.protocol === "https:" ? "wss:" : "ws:";
    fallbackUrl.pathname = "/ws/stream";
    fallbackUrl.search = "";
    return fallbackUrl.toString();
  }
};

export type RealtimeEvent =
  | { type: "monitor:result"; payload: { monitorId: string; status: string; message?: string; checkedAt: string } }
  | { type: "incident:update"; payload: unknown };

export const useRealtime = (handler: (event: RealtimeEvent) => void, token?: string | null) => {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const endpoint = new URL(toWebsocketUrl(API_BASE));
    if (token) {
      endpoint.searchParams.set("token", token);
    }
    const socket = new WebSocket(endpoint);
    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as RealtimeEvent;
        handlerRef.current(parsed);
      } catch (err) {
        console.error("Realtime message parse error", err);
      }
    };
    return () => socket.close();
  }, [token]);
};
