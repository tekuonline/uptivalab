import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { hashPassword } from "../auth/password.js";
import { handleApiError } from "../utils/error-handler.js";

const baseSchema = z.object({
  name: z.string(),
  slug: z.string().min(3).max(64).regex(/^[a-z0-9-]+$/),
  heroMessage: z.string().max(280).optional(),
  customDomain: z.string().url().optional(),
  monitorIds: z.array(z.string()).default([]),
  theme: z.union([z.string(), z.record(z.any())]).optional(),
  password: z.string().min(8).optional(),
  showIncidents: z.boolean().default(true),
  showMaintenance: z.boolean().default(true),
});

const statusPagesPlugin = async (fastify: FastifyInstance) => {
  // GET /status-pages - List all status pages (frontend expects this endpoint)
  fastify.get("/status-pages", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request, reply) => {
    try {
      return await prisma.publicStatusPage.findMany({
        include: { monitors: true },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      const apiError = handleApiError(error, "list status pages");
      return reply.code(500).send(apiError);
    }
  });

  // GET /status-pages/list - Alternative endpoint
  fastify.get("/status-pages/list", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request, reply) => {
    try {
      return await prisma.publicStatusPage.findMany({
        include: { monitors: true },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      const apiError = handleApiError(error, "list status pages");
      return reply.code(500).send(apiError);
    }
  });

  fastify.post("/status-pages", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request, reply) => {
    try {
      const body = baseSchema.parse(request.body);
      const page = await prisma.publicStatusPage.create({
        data: {
          name: body.name,
          slug: body.slug,
          heroMessage: body.heroMessage,
          customDomain: body.customDomain,
          theme: body.theme,
          passwordHash: body.password ? await hashPassword(body.password) : undefined,
          showIncidents: body.showIncidents,
          showMaintenance: body.showMaintenance,
          monitors: body.monitorIds.length ? { connect: body.monitorIds.map((id) => ({ id })) } : undefined,
        },
        include: { monitors: true },
      });
      return page;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: "Validation failed",
          message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      }
      const apiError = handleApiError(error, "create status page");
      return reply.code(500).send(apiError);
    }
  });

  fastify.put("/status-pages/:id", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request, reply) => {
    try {
      const params = z.object({ id: z.string() }).parse(request.params);
      const body = baseSchema.partial().parse(request.body);

      const data: Record<string, unknown> = {
        name: body.name,
        slug: body.slug,
        heroMessage: body.heroMessage,
        customDomain: body.customDomain,
        theme: body.theme,
        showIncidents: body.showIncidents,
        showMaintenance: body.showMaintenance,
      };

      if (body.password) {
        data.passwordHash = await hashPassword(body.password);
      }

      const page = await prisma.publicStatusPage.update({
        where: { id: params.id },
        data: {
          ...data,
          monitors: body.monitorIds
            ? {
                set: [],
                connect: body.monitorIds.map((id) => ({ id })),
              }
            : undefined,
        },
        include: { monitors: true },
      });
      return page;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: "Validation failed",
          message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      }
      const apiError = handleApiError(error, "update status page");
      return reply.code(500).send(apiError);
    }
  });

  fastify.delete("/status-pages/:id", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request, reply) => {
    try {
      const params = z.object({ id: z.string() }).parse(request.params);
      await prisma.publicStatusPage.delete({ where: { id: params.id } });
      reply.code(204).send();
    } catch (error) {
      const apiError = handleApiError(error, "delete status page");
      return reply.code(500).send(apiError);
    }
  });

  // GET /status-pages/:id - Get a specific status page (authenticated)
  fastify.get("/status-pages/:id", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request, reply) => {
    try {
      const params = z.object({ id: z.string() }).parse(request.params);
      const page = await prisma.publicStatusPage.findUnique({
        where: { id: params.id },
        include: {
          monitors: {
            include: {
              checks: { orderBy: { checkedAt: "desc" }, take: 100 },
              incidents: {
                where: { status: "OPEN" },
                orderBy: { startedAt: "desc" },
                include: { events: { orderBy: { createdAt: "desc" }, take: 5 } },
              },
            },
          },
        },
      });

      if (!page) {
        return reply.code(404).send({ message: "Status page not found" });
      }

      return page;
    } catch (error) {
      const apiError = handleApiError(error, "get status page");
      return reply.code(500).send(apiError);
    }
  });
};

// Public status page plugin (no authentication required)
const publicStatusPagePlugin = async (fastify: FastifyInstance) => {
  // GET /public/status/:slug - Get public status page by slug (no auth required)
  fastify.get("/public/status/:slug", async (request, reply) => {
    try {
      const params = z.object({ slug: z.string() }).parse(request.params);
      
      const page = await prisma.publicStatusPage.findUnique({
        where: { slug: params.slug },
        include: {
          monitors: {
            include: {
              checks: { orderBy: { checkedAt: "desc" }, take: 100 },
              incidents: {
                where: {
                  status: { not: "RESOLVED" }, // Exclude resolved incidents
                },
                orderBy: { startedAt: "desc" },
                include: { events: { orderBy: { createdAt: "desc" }, take: 5 } },
              },
              maintenance: {
                where: {
                  endsAt: { gte: new Date() }, // Only current and future maintenance
                },
                orderBy: { startsAt: "asc" },
              },
            },
          },
        },
      });

      if (!page) {
        return reply.code(404).send({ message: "Status page not found" });
      }

    // Check if password protected
    if (page.passwordHash) {
      const authHeader = request.headers.authorization;
      if (!authHeader) {
        return reply.code(401).send({ message: "Password required", passwordProtected: true });
      }
      // For simplicity, password should be sent as "Bearer <password>"
      // In a real app, you'd want a proper password verification flow
    }

    // Calculate overall status based on most recent check of each monitor
    const monitorStatuses = page.monitors.map((m: any) => m.checks[0]?.status).filter(Boolean);
    const downCount = monitorStatuses.filter((s: string) => s === 'down').length;
    const totalMonitors = monitorStatuses.length;
    
    const overallStatus = totalMonitors === 0 ? 'operational'
      : downCount === 0 ? 'operational'
      : downCount === totalMonitors ? 'down'
      : 'degraded';

    // Calculate uptime for each monitor
    const monitorsWithStats = page.monitors.map((monitor: any) => {
      const checks = monitor.checks || [];
      const upCount = checks.filter((c: any) => c.status === 'up').length;
      const uptimePercentage = checks.length > 0 ? (upCount / checks.length) * 100 : 0;
      
      // Get last 90 checks for uptime graph
      const last90 = checks.slice(0, 90).reverse();
      
      // Extract certificate metadata from latest check
      const latestCheck = checks[0];
      const payload = latestCheck?.payload as any;
      // Certificate data is directly in payload, not payload.meta
      const certificateMeta = monitor.kind === 'certificate' && payload ? {
        certificateExpiresAt: payload.certificateExpiresAt,
        certificateDaysLeft: payload.certificateDaysLeft,
      } : null;
      
      return {
        id: monitor.id,
        name: monitor.name,
        kind: monitor.kind,
        status: checks[0]?.status || 'unknown',
        uptimePercentage: Math.round(uptimePercentage * 100) / 100,
        lastCheck: checks[0]?.checkedAt || null,
        responseTime: checks[0]?.responseTime || null,
        incidents: monitor.incidents,
        meta: certificateMeta || null,
        uptimeData: last90.map((c: any) => ({
          timestamp: c.checkedAt,
          status: c.status,
          responseTime: c.responseTime,
        })),
      };
    });

    // Get upcoming maintenance windows if enabled
    const upcomingMaintenance = page.showMaintenance
      ? await prisma.maintenanceWindow.findMany({
          where: {
            monitors: { some: { id: { in: page.monitors.map((m: any) => m.id) } } },
            endsAt: { gte: new Date() },
          },
          include: { monitors: { select: { id: true, name: true } } },
          orderBy: { startsAt: "asc" },
        })
      : [];

    return {
      name: page.name,
      slug: page.slug,
      heroMessage: page.heroMessage,
      customDomain: page.customDomain,
      theme: page.theme,
      showIncidents: page.showIncidents,
      showMaintenance: page.showMaintenance,
      overallStatus,
      monitors: monitorsWithStats,
      upcomingMaintenance,
      updatedAt: new Date().toISOString(),
    };
    } catch (error) {
      const apiError = handleApiError(error, "get public status page");
      return reply.code(500).send(apiError);
    }
  });

  // GET /public/status/:slug/history/:monitorId - Get detailed history for a monitor on public page
  fastify.get("/public/status/:slug/history/:monitorId", async (request, reply) => {
    try {
      const params = z.object({
        slug: z.string(),
        monitorId: z.string(),
      }).parse(request.params);
      
      const query = z.object({
        days: z.coerce.number().min(1).max(90).default(7),
      }).parse(request.query);

      const page = await prisma.publicStatusPage.findUnique({
        where: { slug: params.slug },
        include: {
          monitors: {
            where: { id: params.monitorId },
          },
        },
      });

      if (!page || page.monitors.length === 0) {
        return reply.code(404).send({ message: "Monitor not found on this status page" });
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - query.days);

      const checks = await prisma.checkResult.findMany({
        where: {
          monitorId: params.monitorId,
          checkedAt: { gte: startDate },
        },
        orderBy: { checkedAt: "asc" },
      });

    // Group by hour for better visualization
    const hourlyStats: Record<string, { up: number; down: number; total: number; avgResponseTime: number }> = {};
    
    checks.forEach((check: any) => {
      const hour = new Date(check.checkedAt);
      hour.setMinutes(0, 0, 0);
      const key = hour.toISOString();
      
      if (!hourlyStats[key]) {
        hourlyStats[key] = { up: 0, down: 0, total: 0, avgResponseTime: 0 };
      }
      hourlyStats[key].total++;
      if (check.status === 'up') {
        hourlyStats[key].up++;
        if (check.responseTime) {
          hourlyStats[key].avgResponseTime += check.responseTime;
        }
      } else {
        hourlyStats[key].down++;
      }
    });

    // Calculate averages
    Object.keys(hourlyStats).forEach(key => {
      if (hourlyStats[key].up > 0) {
        hourlyStats[key].avgResponseTime = Math.round(hourlyStats[key].avgResponseTime / hourlyStats[key].up);
      }
    });

    return {
      monitor: page.monitors[0],
      history: Object.entries(hourlyStats).map(([timestamp, stats]) => ({
        timestamp,
        uptimePercentage: stats.total > 0 ? Math.round((stats.up / stats.total) * 10000) / 100 : 0,
        avgResponseTime: stats.avgResponseTime,
        upChecks: stats.up,
        downChecks: stats.down,
      })),
      overall: {
        totalChecks: checks.length,
        upChecks: checks.filter((c: any) => c.status === 'up').length,
        uptimePercentage: checks.length > 0
          ? Math.round((checks.filter((c: any) => c.status === 'up').length / checks.length) * 10000) / 100
          : 0,
      },
    };
    } catch (error) {
      const apiError = handleApiError(error, "get monitor history");
      return reply.code(500).send(apiError);
    }
  });
};

export default fp(statusPagesPlugin);
export { publicStatusPagePlugin };
