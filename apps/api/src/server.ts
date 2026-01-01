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
import { prisma } from "./db/prisma.js";
import { verifyPassword } from "./auth/password.js";
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
  // await cloudflareTunnel.initialize();
  
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
      
      // Fetch and attach user information
      const { prisma } = await import("./db/prisma.js");
      const userId = (request.user as any).userId;
      if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, role: true }
        });
        if (user) {
          (request as any).user = { ...request.user, ...user };
        }
      }
    } catch (err) {
      reply.code(401).send({ message: "Unauthorized" });
    }
  });

  // API Key authentication decorator
  await fastify.decorate("authenticateApiKey", async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = request.headers['x-api-key'] || request.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) {
      return reply.code(401).send({ message: "API key required" });
    }

    // Skip JWT-style tokens (they contain dots)
    if (apiKey.includes('.')) {
      return reply.code(401).send({ message: "Invalid API key format" });
    }

    try {
      const { prisma } = await import("./db/prisma.js");
      const { verifyPassword } = await import("./auth/password.js");

      // Find all API keys and verify each one (inefficient but works for now)
      const allApiKeys = await prisma.apiKey.findMany({
        include: { user: true },
      });

      let validKeyRecord = null;
      for (const key of allApiKeys) {
        const isValid = await verifyPassword(key.tokenHash, apiKey);
        if (isValid) {
          validKeyRecord = key;
          break;
        }
      }

      if (!validKeyRecord) {
        return reply.code(401).send({ message: "Invalid API key" });
      }

      // Update last used timestamp
      await prisma.apiKey.update({
        where: { id: validKeyRecord.id },
        data: { lastUsedAt: new Date() },
      });

      // Attach user info to request
      (request as any).user = {
        userId: validKeyRecord.userId,
        email: validKeyRecord.user.email,
        role: validKeyRecord.user.role,
      };
    } catch (error) {
      console.error("Error in authenticateApiKey:", error);
      return reply.code(500).send({ message: "Authentication error" });
    }
  });

// Combined authentication (JWT or API Key) with permission checking
  await fastify.decorate("authenticateAnyWithPermission", (requiredPermission: 'READ' | 'WRITE') => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const authHeader = request.headers.authorization;
      // Fastify lowercases all header names
      const apiKeyHeader = request.headers['x-api-key'] as string | undefined;

      // Helper function to validate API key and attach user info
      const validateApiKey = async (apiKey: string): Promise<boolean> => {
        try {
          const { prisma } = await import("./db/prisma.js");
          const { verifyPassword } = await import("./auth/password.js");

          // Find all API keys and verify each one
          const allApiKeys = await prisma.apiKey.findMany({
            include: { user: true },
          });

          for (const key of allApiKeys) {
            const isValid = await verifyPassword(key.tokenHash, apiKey);
            if (isValid) {
              // Check permissions
              if (requiredPermission === 'WRITE' && key.permissions !== 'WRITE') {
                return false;
              }

              // Update last used timestamp
              await prisma.apiKey.update({
                where: { id: key.id },
                data: { lastUsedAt: new Date() },
              });

              // Attach user info to request
              (request as any).user = {
                userId: key.userId,
                email: key.user.email,
                role: key.user.role,
              };
              return true;
            }
          }
          return false;
        } catch (error) {
          return false;
        }
      };

      // Try API key authentication first (from X-API-Key header)
      if (apiKeyHeader) {
        if (await validateApiKey(apiKeyHeader)) {
          return;
        }
      }

      // Try Bearer token authentication
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);

        // Check if it's a JWT (contains dots)
        if (token.includes('.')) {
          // JWT authentication
          try {
            await request.jwtVerify();
            return;
          } catch (err) {
            // Fall through
          }
        } else {
          // API key in Authorization header
          if (await validateApiKey(token)) {
            return;
          }
        }
      }

      return reply.code(401).send({ message: "API Key or JWT required" });
    };
  });

  // await fastify.register(swagger, {
  //   openapi: {
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

  // Register public health endpoint (no authentication required)
  await fastify.register(async (fastify) => {
    fastify.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));
  }, { prefix: "/api" });

  // Register public status endpoint (with API key authentication)
  // await fastify.register(async (fastify) => {
  //   const { default: statusRoutes } = await import("./routes/status.js");
  //   await fastify.register(statusRoutes);
  // }, { prefix: "/api" });

  // Register public endpoints (status for testing)
  await fastify.register(async (fastify) => {
    const { default: statusRoutes } = await import("./routes/status.js");
    const { default: monitorsRoutes } = await import("./routes/monitors.js");
    await fastify.register(statusRoutes);
    await fastify.register(monitorsRoutes);
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
    
    // await fastify.register(monitorsRoutes); // Moved to status scope
    // await fastify.register(statusRoutes);
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

  return fastify;
};
