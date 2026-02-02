import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { prisma } from "../db/prisma.js";
import { z } from "zod";
import { maintenanceService } from "../services/maintenance/suppressor.js";

const statusPlugin = async (fastify: FastifyInstance) => {

  // GET /status - List monitor statuses (frontend expects this endpoint)
  fastify.get("/status", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async () => {
    const { prisma } = await import("../db/prisma.js");

    // Get all monitors with latest check and incident data
    const monitors = await prisma.monitor.findMany({
      include: {
        checks: { 
          orderBy: { checkedAt: "desc" }, 
          take: 1,
          select: {
            id: true,
            status: true,
            checkedAt: true,
            latencyMs: true,
            // Explicitly exclude payload to avoid large data
          }
        },
        incidents: { 
          where: { status: { not: "RESOLVED" } },
          orderBy: { startedAt: "desc" }, 
          take: 1,
          select: {
            id: true,
            status: true,
            startedAt: true,
            resolvedAt: true,
          }
        },
      },
    });

    // Batch query for all active maintenance windows
    const now = new Date();
    const activeMaintenanceWindows = await prisma.maintenanceWindow.findMany({
      where: {
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      include: {
        monitors: {
          select: { id: true }
        }
      }
    });

    // Create a Set of monitor IDs that are currently in maintenance
    const maintenanceMonitorIds = new Set<string>();
    activeMaintenanceWindows.forEach(window => {
      window.monitors.forEach(monitor => {
        maintenanceMonitorIds.add(monitor.id);
      });
    });

    const results = monitors.map((monitor) => {
      const latestCheck = monitor.checks[0];
      return {
        id: monitor.id,
        name: monitor.name,
        kind: monitor.kind,
        status: monitor.paused ? "paused" : (latestCheck?.status ?? "pending"),
        lastCheck: latestCheck?.checkedAt ?? null,
        incident: monitor.incidents[0] ?? null,
        inMaintenance: maintenanceMonitorIds.has(monitor.id),
        meta: null, // Certificate metadata would go here if needed
      };
    });

    return results;
  });

  // GET /status/health - Health check endpoint (no auth required for monitoring)
  fastify.get("/status/health", async (request, reply) => {
    const startTime = Date.now();

    try {
      // Check database connectivity
      await prisma.$queryRaw`SELECT 1`;

      // Get basic system stats
      const [monitorCount, checkCount, incidentCount] = await Promise.all([
        prisma.monitor.count(),
        prisma.checkResult.count(),
        prisma.incident.count({ where: { status: { not: "RESOLVED" } } }),
      ]);

      const responseTime = Date.now() - startTime;

      return {
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "1.0.0",
        uptime: process.uptime(),
        responseTime: `${responseTime}ms`,
        database: {
          connected: true,
          monitors: monitorCount,
          checks: checkCount,
          activeIncidents: incidentCount,
        },
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB",
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + "MB",
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      request.log.error("Health check failed:", error);

      return reply.code(503).send({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        error: error instanceof Error ? error.message : "Unknown error",
        database: {
          connected: false,
        },
      });
    }
  });

  // GET /status/list - Alternative endpoint
  fastify.get("/status/list", { preHandler: fastify.authenticate }, async () => {
    const monitors = await prisma.monitor.findMany({
      include: {
        checks: { orderBy: { checkedAt: "desc" }, take: 1 },
        incidents: { orderBy: { startedAt: "desc" }, take: 1 },
      },
    });

    // Batch query for all active maintenance windows
    const now = new Date();
    const activeMaintenanceWindows = await prisma.maintenanceWindow.findMany({
      where: {
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      include: {
        monitors: {
          select: { id: true }
        }
      }
    });

    // Create a Set of monitor IDs that are currently in maintenance
    const maintenanceMonitorIds = new Set<string>();
    activeMaintenanceWindows.forEach(window => {
      window.monitors.forEach(monitor => {
        maintenanceMonitorIds.add(monitor.id);
      });
    });

    const results = monitors.map((monitor) => {
      const latestCheck = monitor.checks[0];
      const payload = latestCheck?.payload as any;
      // Extract certificate metadata - it's directly in payload, not payload.meta
      const meta = monitor.kind === 'certificate' && payload ? {
        certificateExpiresAt: payload.certificateExpiresAt,
        certificateDaysLeft: payload.certificateDaysLeft,
      } : null;
      return {
        id: monitor.id,
        name: monitor.name,
        kind: monitor.kind,
        status: latestCheck?.status ?? "pending",
        lastCheck: latestCheck?.checkedAt ?? null,
        incident: monitor.incidents[0] ?? null,
        inMaintenance: maintenanceMonitorIds.has(monitor.id),
        meta,
      };
    });

    return results;
  });

  fastify.get("/status/:id/history", { preHandler: fastify.authenticate }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const query = z.object({ includePayload: z.string().optional() }).parse(request.query);
    const shouldIncludePayload = query.includePayload === 'true';

    const checks = await prisma.checkResult.findMany({
      where: { monitorId: params.id },
      orderBy: { checkedAt: "desc" },
      take: 200,
      select: {
        id: true,
        status: true,
        latencyMs: true,
        checkedAt: true,
        ...(shouldIncludePayload && { payload: true }),
      },
    });

    return checks;
  });

  fastify.get("/status/public/:slug", async (request, reply) => {
    const params = z.object({ slug: z.string() }).parse(request.params);
    const page = await prisma.publicStatusPage.findUnique({
      where: { slug: params.slug },
      include: {
        monitors: {
          include: {
            checks: { orderBy: { checkedAt: "desc" }, take: 5 },
            incidents: { where: { status: { not: "RESOLVED" } }, orderBy: { startedAt: "desc" }, take: 1 },
          },
        },
      },
    });
    if (!page) return reply.code(404).send({ message: "Not found" });
    return page;
  });

  // Test endpoint that requires WRITE permissions
  fastify.post("/status/test-write", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request, reply) => {
    return { message: "WRITE permission required and granted" };
  });
};

export default fp(statusPlugin);
