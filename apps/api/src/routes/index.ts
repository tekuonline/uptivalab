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
import cloudflareTunnelRoutes from "./cloudflare-tunnel.js";
// import recorderRoutes from "./recorder.js";
// Dynamic imports for users and invitations to avoid bundling issues
// import usersRoutes from "./users.js";
// import invitationsRoutes from "./invitations.js";

const registerRoutesPlugin = async (fastify: FastifyInstance) => {
  // Register auth and robots routes
  await fastify.register(authRoutes);
  await fastify.register(robotsRoutes);
  
  // Register monitoring and status routes
  await fastify.register(monitorsRoutes);
  await fastify.register(statusRoutes);
  await fastify.register(heartbeatRoutes);
  await fastify.register(notificationsRoutes);
  await fastify.register(incidentsRoutes);
  await fastify.register(maintenanceRoutes);
  await fastify.register(statusPagesRoutes);
  await fastify.register(settingsRoutes);
  await fastify.register(cloudflareTunnelRoutes);
  // await fastify.register(recorderRoutes);
  
  // Register user management routes dynamically
  try {
    const { default: usersRoutes } = await import("./users.js");
    await fastify.register(usersRoutes);
    console.log("✓ Users routes loaded successfully");
  } catch (error) {
    console.error("✗ Failed to load users routes:", error);
  }
  
  try {
    const { default: invitationsRoutes } = await import("./invitations.js");
    await fastify.register(invitationsRoutes);
    console.log("✓ Invitations routes loaded successfully");
  } catch (error) {
    console.error("✗ Failed to load invitations routes:", error);
  }

  try {
    const { default: recorderRoutes } = await import("./recorder.js");
    await fastify.register(recorderRoutes);
    console.log("✓ Recorder routes loaded successfully");
  } catch (error) {
    console.error("✗ Failed to load recorder routes:", error);
  }
};

export const registerRoutes = fp(registerRoutesPlugin);
