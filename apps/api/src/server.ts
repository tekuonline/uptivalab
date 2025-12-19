import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fastifyJwt from "@fastify/jwt";
import { appConfig } from "./config.js";
import { registerRoutes } from "./routes/index.js";
import { settingsService } from "./services/settings/service.js";
import { cloudflareTunnel } from "./services/cloudflare-tunnel/service.js";

export const createServer = async () => {
  // Get reverse proxy settings
  const trustProxy = await settingsService.shouldTrustProxy();
  
  // Set server timezone if configured
  const serverTimezone = await settingsService.get<string>("serverTimezone");
  if (serverTimezone) {
    process.env.TZ = serverTimezone;
  }
  
  // Initialize Cloudflare Tunnel (will auto-start if token is configured)
  await cloudflareTunnel.initialize();
  
  const fastify = Fastify({
    logger: true,
    trustProxy: trustProxy,
  });

  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  await fastify.register(websocket);
  await fastify.register(rateLimit, { max: 100, timeWindow: "1 minute" });

  await fastify.register(fastifyJwt, {
    secret: appConfig.JWT_SECRET,
  });

  await fastify.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ message: "Unauthorized" });
    }
  });

  // await fastify.register(swagger, {
  //   openapi: {
  //     info: {
  //       title: "UptivaLab API",
  //       version: "0.1.0",
  //       description: "API-first monitoring platform",
  //     },
  //   },
  // });

  // await fastify.register(swaggerUi, {
  //   routePrefix: "/docs",
  // });

  // Register WebSocket route directly
  fastify.get("/ws/stream", { websocket: true }, async (connection, request) => {
    const token = (request.query as any).token as string;
    if (!token) {
      connection.close();
      return;
    }
    try {
      fastify.jwt.verify(token);
    } catch {
      connection.close();
      return;
    }

    const { broadcastBus } = await import("./realtime/events.js");
    const monitorListener = (result: unknown) => {
      if (connection.readyState === 1) { // OPEN
        connection.send(JSON.stringify({ type: "monitor:result", payload: result }));
      }
    };
    const incidentListener = (payload: unknown) => {
      if (connection.readyState === 1) { // OPEN
        connection.send(JSON.stringify({ type: "incident:update", payload }));
      }
    };

    broadcastBus.on("monitor:result", monitorListener);
    broadcastBus.on("incident:update", incidentListener);

    connection.on("close", () => {
      broadcastBus.off("monitor:result", monitorListener);
      broadcastBus.off("incident:update", incidentListener);
    });
  });

  // Register public status page routes (no authentication required)
  await fastify.register(async (fastify) => {
    const { publicStatusPagePlugin } = await import("./routes/status-pages.js");
    await fastify.register(publicStatusPagePlugin);
  }, { prefix: "/api" });

  // Register public heartbeat endpoint (no authentication required)
  await fastify.register(async (fastify) => {
    const { default: heartbeatRoutes } = await import("./routes/push-heartbeat.js");
    await fastify.register(heartbeatRoutes);
  }, { prefix: "/api" });

  // Register auth routes directly without authentication
  await fastify.register(async (fastify) => {
    const { default: authRoutes } = await import("./routes/auth.js");
    const { default: robotsRoutes } = await import("./routes/robots.js");
    await fastify.register(authRoutes);
    await fastify.register(robotsRoutes);
  }, { prefix: "/api" });

  // Register public invitation routes (no authentication)
  await fastify.register(async (fastify) => {
    const { publicInvitations } = await import("./routes/invitations.js");
    await fastify.register(publicInvitations);
  }, { prefix: "/api" });

  // Register protected routes with authentication
  await fastify.register(async (fastify) => {
    const { default: monitorsRoutes } = await import("./routes/monitors.js");
    const { default: statusRoutes } = await import("./routes/status.js");
    const { heartbeatManagementPlugin } = await import("./routes/push-heartbeat.js");
    const { default: notificationsRoutes } = await import("./routes/notifications.js");
    const { default: incidentsRoutes } = await import("./routes/incidents.js");
    const { default: maintenanceRoutes } = await import("./routes/maintenance.js");
    const { default: statusPagesRoutes } = await import("./routes/status-pages.js");
    const { default: settingsRoutes } = await import("./routes/settings.js");
    const { default: usersRoutes } = await import("./routes/users.js");
    const { default: invitationsRoutes } = await import("./routes/invitations.js");
    const { default: recorderRoutes } = await import("./routes/recorder.js");
    const { default: cloudflareTunnelRoutes } = await import("./routes/cloudflare-tunnel.js");
    
    await fastify.register(monitorsRoutes);
    await fastify.register(statusRoutes);
    await fastify.register(heartbeatManagementPlugin);
    await fastify.register(notificationsRoutes);
    await fastify.register(incidentsRoutes);
    await fastify.register(maintenanceRoutes);
    await fastify.register(statusPagesRoutes);
    await fastify.register(settingsRoutes);
    await fastify.register(usersRoutes);
    await fastify.register(invitationsRoutes);
    await fastify.register(recorderRoutes);
    await fastify.register(cloudflareTunnelRoutes);
  }, { prefix: "/api" });

  fastify.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  return fastify;
};
