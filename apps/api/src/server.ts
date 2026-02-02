import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import rateLimit from "@fastify/rate-limit";
import compress from "@fastify/compress";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fastifyJwt from "@fastify/jwt";
import { appConfig } from "./config.js";
import { settingsService } from "./services/settings/service.js";
import { prisma } from "./db/prisma.js";
import { verifyPassword } from "./auth/password.js";
import { cloudflareTunnel } from "./services/cloudflare-tunnel/service.js";
import { memoryManager, startMemoryMonitoring } from "./utils/memory-manager.js";
import { log } from "./utils/logger.js";

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

  // Start memory monitoring in production (every 2 minutes)
  if (process.env.NODE_ENV === 'production') {
    startMemoryMonitoring(120000);
  }

  // Configure CORS with whitelist - prevents CSRF attacks
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [
        'http://localhost:4173',
        'http://localhost:3000',
        'http://localhost:8080',
      ];

  await fastify.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  });

  await fastify.register(websocket);
  
  // Enable gzip compression for responses >1KB (60-75% bandwidth reduction)
  await fastify.register(compress, {
    threshold: 1024,
    encodings: ['gzip', 'deflate']
  });
  
  // Global rate limiting (500 requests per minute)
  await fastify.register(rateLimit, { max: 500, timeWindow: "1 minute" });

  // API key prefix cache for faster O(1) lookup (refreshed every 5 minutes)
  let apiKeyPrefixCache: Map<string, { id: string; tokenHash: string; userId: string; permissions: string; user: { email: string; role: string } }> = new Map();
  let lastCacheRefresh = 0;

  const refreshApiKeyCache = async () => {
    try {
      const allApiKeys = await prisma.apiKey.findMany({
        include: { user: true },
      });
      const newCache = new Map();
      for (const key of allApiKeys) {
        const prefix = (key.tokenHash as string).substring(0, 8);
        newCache.set(prefix, key);
      }
      apiKeyPrefixCache = newCache;
      lastCacheRefresh = Date.now();
    } catch (error) {
      log.error("Failed to refresh API key cache:", { error: error instanceof Error ? error.message : String(error) });
    }
  };
  
  await refreshApiKeyCache();
  setInterval(refreshApiKeyCache, 5 * 60 * 1000);

  // Global error handler (sanitizes sensitive information in production)
  fastify.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;
    const isDevelopment = process.env.NODE_ENV !== 'production';

    // Sanitize error message - don't expose internal details in production
    const sanitizedMessage = isDevelopment ? error.message : 
      (statusCode === 500 ? 'Internal server error' : error.message);

    // Log the error (but not sensitive details in production)
    if (isDevelopment) {
      request.log.error({
        error: error.message,
        stack: error.stack,
        url: request.url,
        method: request.method,
      });
    } else {
      // Production: log only safe info
      request.log.error({
        error: sanitizedMessage,
        url: request.url,
        method: request.method,
        statusCode: statusCode,
      });
    }

    // Always return safe error message to client
    return reply.code(statusCode).send({
      message: sanitizedMessage,
      statusCode: statusCode,
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    log.error('Uncaught Exception:', { error });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    log.error('Unhandled Rejection at:', { promise, reason });
    process.exit(1);
  });

  await fastify.register(fastifyJwt, {
    secret: appConfig.JWT_SECRET,
  });

  // Add Cache-Control headers to prevent unnecessary client requests
  fastify.addHook('onSend', async (request, reply) => {
    // Cache GET requests for 5 minutes
    if (request.method === 'GET' && !reply.hasHeader('Cache-Control')) {
      reply.header('Cache-Control', 'public, max-age=300'); // 5 minutes
    }
    // Don't cache mutations
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
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
          (request as any).user = { ...(request as any).user, ...user };
        }
      }
    } catch (err) {
      reply.code(401).send({ message: "Unauthorized" });
    }
  });

  // API Key authentication decorator (optimized with prefix-based caching)
  await fastify.decorate("authenticateApiKey", async (request: FastifyRequest, reply: FastifyReply) => {
    let apiKey = request.headers['x-api-key'] || request.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) {
      return reply.code(401).send({ message: "API key required" });
    }

    // Ensure apiKey is a string (headers can be string[])
    if (Array.isArray(apiKey)) {
      apiKey = apiKey[0];
    }

    // Skip JWT-style tokens (they contain dots)
    if (apiKey.includes('.')) {
      return reply.code(401).send({ message: "Invalid API key format" });
    }

    try {
      const { verifyPassword } = await import("./auth/password.js");

      // Refresh cache if older than 5 minutes
      if (Date.now() - lastCacheRefresh > 5 * 60 * 1000) {
        await refreshApiKeyCache();
      }

      // Use prefix cache for faster lookup (O(1) instead of O(n))
      const prefix = apiKey.substring(0, 8);
      const potentialKeys = Array.from(apiKeyPrefixCache.values()).filter(k => 
        (k.tokenHash as string).substring(0, 8) === prefix
      );

      let validKeyRecord = null;
      for (const key of potentialKeys) {
        const isValid = await verifyPassword(key.tokenHash as string, apiKey as string);
        if (isValid) {
          validKeyRecord = key;
          break;
        }
      }

      if (!validKeyRecord) {
        return reply.code(401).send({ message: "Invalid API key" });
      }

      // Update last used timestamp (async, non-blocking)
      prisma.apiKey.update({
        where: { id: validKeyRecord.id },
        data: { lastUsedAt: new Date() },
      }).catch(err => log.error("Failed to update API key timestamp:", { error: err instanceof Error ? err.message : String(err) }));

      // Attach user info to request
      (request as any).user = {
        userId: validKeyRecord.userId,
        email: validKeyRecord.user.email,
        role: validKeyRecord.user.role,
      };
    } catch (error) {
      log.error("Error in authenticateApiKey:", { error: error instanceof Error ? error.message : String(error) });
      return reply.code(500).send({ message: "Authentication error" });
    }
  });

// Combined authentication (JWT or API Key) with permission checking
  await fastify.decorate("authenticateAnyWithPermission", (requiredPermission: 'READ' | 'WRITE') => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const authHeader = request.headers.authorization;
      // Fastify lowercases all header names
      const apiKeyHeader = request.headers['x-api-key'] as string | undefined;

      // Helper function to validate API key with permission checking (optimized)
      const validateApiKey = async (apiKey: string): Promise<boolean> => {
        try {
          // Refresh cache if older than 5 minutes
          if (Date.now() - lastCacheRefresh > 5 * 60 * 1000) {
            await refreshApiKeyCache();
          }

          // Use prefix cache for faster lookup
          const prefix = apiKey.substring(0, 8);
          const potentialKeys = Array.from(apiKeyPrefixCache.values()).filter(k => 
            (k.tokenHash as string).substring(0, 8) === prefix
          );

          for (const key of potentialKeys) {
            const isValid = await verifyPassword(key.tokenHash, apiKey);
            if (isValid) {
              // Check permissions
              if (requiredPermission === 'WRITE' && key.permissions !== 'WRITE') {
                return false;
              }

              // Update last used timestamp (async, non-blocking)
              prisma.apiKey.update({
                where: { id: key.id },
                data: { lastUsedAt: new Date() },
              }).catch(err => log.error("Failed to update API key timestamp:", { error: err instanceof Error ? err.message : String(err) }));

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
          log.error("API key validation error:", { error: error instanceof Error ? error.message : String(error) });
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
            
            // Fetch and attach user information (similar to authenticate decorator)
            try {
              const userId = (request.user as any).userId;
              if (userId) {
                const user = await prisma.user.findUnique({
                  where: { id: userId },
                  select: { id: true, email: true, role: true }
                });
                if (user) {
                  (request as any).user = { ...(request as any).user, ...user };
                  return;
                }
              }
            } catch (dbError) {
              log.error("Database error during JWT user lookup:", { error: dbError });
              // Fall through to 401
            }
            // User not found, fall through to 401
          } catch (err) {
            // JWT verification failed, fall through
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
  // Register WebSocket route with secure Authorization header (backwards compatible with query params)
  // Supports both JWT tokens and API keys via Authorization header
  fastify.get("/ws/stream", { websocket: true }, async (connection, request) => {
    // Get token from Authorization header (preferred) or query params (legacy support)
    let token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      token = (request.query as any).token as string;
    }

    if (!token) {
      connection.close(4001, "Authentication required");
      return;
    }

    let authenticated = false;
    let userId: string | null = null;

    try {
      // Try JWT verification first
      if (token.includes('.')) {
        const payload = fastify.jwt.verify(token);
        authenticated = true;
        userId = (payload as any).userId;
      } else {
        // Try API key verification with cache
        const { verifyPassword } = await import("./auth/password.js");
        
        // Refresh cache if needed
        if (Date.now() - lastCacheRefresh > 5 * 60 * 1000) {
          await refreshApiKeyCache();
        }

        const prefix = token.substring(0, 8);
        const potentialKeys = Array.from(apiKeyPrefixCache.values()).filter(k => 
          (k.tokenHash as string).substring(0, 8) === prefix
        );

        for (const key of potentialKeys) {
          const isValid = await verifyPassword(key.tokenHash, token);
          if (isValid) {
            authenticated = true;
            userId = key.userId;
            break;
          }
        }
      }
    } catch (error) {
      // JWT/API key verification failed
      authenticated = false;
    }

    if (!authenticated || !userId) {
      connection.close(4001, "Authentication failed");
      return;
    }

    // WebSocket inactivity timeout (30 minutes)
    let lastActivity = Date.now();
    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    const CHECK_INTERVAL = 60 * 1000; // Check every minute

    const inactivityTimer = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivity;
      if (timeSinceLastActivity > INACTIVITY_TIMEOUT) {
        connection.close(1008, "Inactivity timeout");
        clearInterval(inactivityTimer);
      }
    }, CHECK_INTERVAL);

    const { broadcastBus } = await import("./realtime/events.js");
    const monitorListener = (result: unknown) => {
      if (connection.readyState === 1) { // OPEN
        lastActivity = Date.now(); // Update activity timestamp
        connection.send(JSON.stringify({ type: "monitor:result", payload: result }));
      }
    };
    const incidentListener = (payload: unknown) => {
      if (connection.readyState === 1) { // OPEN
        lastActivity = Date.now(); // Update activity timestamp
        connection.send(JSON.stringify({ type: "incident:update", payload }));
      }
    };

    broadcastBus.on("monitor:result", monitorListener);
    broadcastBus.on("incident:update", incidentListener);

    connection.on("message", () => {
      lastActivity = Date.now(); // Track client activity
    });

    connection.on("close", () => {
      clearInterval(inactivityTimer);
      broadcastBus.off("monitor:result", monitorListener);
      broadcastBus.off("incident:update", incidentListener);
      memoryManager.untrackListener('websocket');
    });

    memoryManager.trackListener('websocket');
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
    
    // Memory metrics endpoint (for debugging/monitoring)
    fastify.get("/metrics/memory", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async () => {
      const health = memoryManager.getHealth();
      return health;
    });
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
