import { useEffect, useRef } from "react";
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
const toWebsocketUrl = (base) => {
    try {
        const url = new URL(base);
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        url.pathname = "/ws/stream";
        url.search = "";
        return url.toString();
    }
    catch {
        return "ws://localhost:8080/ws/stream";
    }
};
export const useRealtime = (handler, token) => {
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
                const parsed = JSON.parse(event.data);
                handlerRef.current(parsed);
            }
            catch (err) {
                console.error("Realtime message parse error", err);
            }
        };
        return () => socket.close();
    }, [token]);
};
