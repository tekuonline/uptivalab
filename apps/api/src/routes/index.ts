import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import monitorsRoutes from "./monitors.js";
import statusRoutes from "./status.js";
import authRoutes from "./auth.js";
import heartbeatRoutes from "./push-heartbeat.js";
import notificationsRoutes from "./notifications.js";
import incidentsRoutes from "./incidents.js";
import maintenanceRoutes from "./maintenance.js";
import statusPagesRoutes from "./status-pages.js";
import settingsRoutes from "./settings.js";
import robotsRoutes from "./robots.js";

const registerRoutesPlugin = async (fastify: FastifyInstance) => {
  await fastify.register(authRoutes);
  await fastify.register(robotsRoutes);
  await fastify.register(monitorsRoutes);
  await fastify.register(statusRoutes);
  await fastify.register(heartbeatRoutes);
  await fastify.register(notificationsRoutes);
  await fastify.register(incidentsRoutes);
  await fastify.register(maintenanceRoutes);
  await fastify.register(statusPagesRoutes);
  await fastify.register(settingsRoutes);
};

export const registerRoutes = fp(registerRoutesPlugin);
