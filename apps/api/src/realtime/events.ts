import { EventEmitter } from "node:events";
import type { MonitorResult } from "@uptivalab/monitoring";

export type IncidentRealtimePayload = {
  id: string;
  monitorId: string;
  status: string;
  startedAt: Date;
  resolvedAt: Date | null;
};

export type RealtimeEvent =
  | { type: "monitor:result"; payload: MonitorResult }
  | { type: "incident:update"; payload: IncidentRealtimePayload };

class BroadcastBus extends EventEmitter {
  emitResult(result: MonitorResult) {
    this.emit("monitor:result", result);
  }

  onResult(handler: (result: MonitorResult) => void) {
    this.on("monitor:result", handler);
  }

  emitIncidentUpdate(payload: IncidentRealtimePayload) {
    this.emit("incident:update", payload);
  }

  onIncidentUpdate(handler: (payload: IncidentRealtimePayload) => void) {
    this.on("incident:update", handler);
  }
}

export const broadcastBus = new BroadcastBus();
