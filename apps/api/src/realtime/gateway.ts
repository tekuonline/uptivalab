import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { broadcastBus } from "./events.js";

const gatewayPlugin = async (fastify: FastifyInstance) => {
  fastify.get("/stream", { websocket: true }, (connection) => {
    const monitorListener = (result: unknown) => {
      connection.socket.send(JSON.stringify({ type: "monitor:result", payload: result }));
    };
    const incidentListener = (payload: unknown) => {
      connection.socket.send(JSON.stringify({ type: "incident:update", payload }));
    };

    broadcastBus.on("monitor:result", monitorListener);
    broadcastBus.on("incident:update", incidentListener);

    connection.socket.on("close", () => {
      broadcastBus.off("monitor:result", monitorListener);
      broadcastBus.off("incident:update", incidentListener);
    });
  });
};

export const realtimeGateway = fp(gatewayPlugin);
