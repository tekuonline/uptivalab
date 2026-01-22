import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { monitorOrchestrator } from "../services/monitor-engine/orchestrator.js";
import { handleApiError } from "../utils/error-handler.js";

const monitorsPlugin = async (fastify: FastifyInstance) => {

  // GET /monitors - List monitors (with API key authentication)
  fastify.get("/monitors", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request, reply) => {
    const { maintenanceService } = await import("../services/maintenance/suppressor.js");

    const monitors = await prisma.monitor.findMany({
      include: {
        checks: { orderBy: { checkedAt: "desc" }, take: 1 },
        incidents: { orderBy: { startedAt: "desc" }, take: 1 },
        group: true,
        tags: true,
        notificationChannels: true,
      },
    });

    const results = await Promise.all(
      monitors.map(async (monitor: typeof monitors[number]) => {
        const inMaintenance = await maintenanceService.isSuppressed(monitor.id);
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
          config: monitor.config,
          interval: monitor.interval,
          timeout: monitor.timeout,
          paused: monitor.paused,
          createIncidents: (monitor as any).createIncidents,
          status: monitor.paused ? "paused" : (latestCheck?.status ?? "pending"),
          group: monitor.group,
          tags: monitor.tags,
          notificationChannels: monitor.notificationChannels,
          latestCheck: latestCheck ? {
            id: latestCheck.id,
            status: latestCheck.status,
            latencyMs: latestCheck.latencyMs,
            checkedAt: latestCheck.checkedAt,
            payload: latestCheck.payload,
          } : null,
          incident: monitor.incidents[0] ?? null,
          inMaintenance,
          meta,
          createdAt: monitor.createdAt,
          updatedAt: monitor.updatedAt,
        };
      })
    );

    return results;
  });

  // Validation schema for synthetic monitor steps
  const syntheticStepSchema = z.object({
    action: z.enum(['goto', 'click', 'fill', 'expect', 'wait']),
    selector: z.string().optional(),
    value: z.string().optional(),
    text: z.string().optional(),
    property: z.string().optional(),
    url: z.string().optional(),
    timeout: z.number().int().positive().optional(),
  });

  const syntheticConfigSchema = z.object({
    steps: z.array(syntheticStepSchema).min(1),
    browser: z.enum(['chromium', 'firefox', 'webkit']).optional(),
    baseUrl: z.string().optional(),
    remoteBrowserId: z.string().optional(),
    useLocalBrowser: z.boolean().optional(),
    ignoreHTTPSErrors: z.boolean().optional(),
  });

  // POST /monitors - Create a new monitor
  fastify.post("/monitors", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request, reply) => {
    try {
      const body = z.object({
        name: z.string().min(1),
        kind: z.enum(['http', 'tcp', 'ping', 'dns', 'docker', 'certificate', 'database', 'synthetic', 'grpc', 'push']),
        config: z.record(z.any()),
        interval: z.number().int().min(1000), // minimum 1 second
        timeout: z.number().int().min(1000).optional(), // minimum 1 second
        paused: z.boolean().optional().default(false),
        createIncidents: z.boolean().optional().default(true),
        groupId: z.string().optional(),
        tagIds: z.array(z.string()).optional(),
        notificationIds: z.array(z.string()).optional(),
      }).parse(request.body);

      // Validate synthetic monitor config if kind is synthetic
      if (body.kind === 'synthetic') {
        try {
          syntheticConfigSchema.parse(body.config);
        } catch (error) {
          if (error instanceof z.ZodError) {
            return reply.code(400).send({
              error: "Invalid synthetic monitor configuration",
              message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
            });
          }
          throw error;
        }
      }

      // Validate group exists if provided
      if (body.groupId) {
        const group = await prisma.monitorGroup.findUnique({
          where: { id: body.groupId }
        });
        if (!group) {
          return reply.code(400).send({ error: "Invalid group ID" });
        }
      }

      // Validate tags exist if provided
      if (body.tagIds && body.tagIds.length > 0) {
        const tags = await prisma.tag.findMany({
          where: { id: { in: body.tagIds } }
        });
        if (tags.length !== body.tagIds.length) {
          return reply.code(400).send({ error: "One or more invalid tag IDs" });
        }
      }

      // Validate notification channels exist if provided
      if (body.notificationIds && body.notificationIds.length > 0) {
        const channels = await prisma.notificationChannel.findMany({
          where: { id: { in: body.notificationIds } }
        });
        if (channels.length !== body.notificationIds.length) {
          return reply.code(400).send({ error: "One or more invalid notification channel IDs" });
        }
      }

      const monitor = await prisma.monitor.create({
        data: {
          name: body.name,
          kind: body.kind,
          config: body.config,
          interval: body.interval,
          timeout: body.timeout,
          paused: body.paused,
          createIncidents: body.createIncidents,
          groupId: body.groupId,
          tags: body.tagIds ? {
            create: body.tagIds.map(tagId => ({ tagId }))
          } : undefined,
          notificationChannels: body.notificationIds ? {
            connect: body.notificationIds.map(id => ({ id }))
          } : undefined,
        },
        include: {
          group: true,
          tags: true,
          notificationChannels: true,
        },
      });

      // Schedule the monitor with the monitoring engine if it's not paused
      if (!monitor.paused) {
        try {
          await monitorOrchestrator.scheduleMonitor(monitor.id, monitor.interval);
        } catch (error) {
          console.error("Failed to schedule monitor:", error);
          // Don't fail the creation if scheduling fails
        }
      }

      // If this is a push monitor, create a heartbeat token
      if (body.kind === 'push') {
        const crypto = await import('crypto');
        const token = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        await prisma.heartbeatToken.create({
          data: {
            monitorId: monitor.id,
            tokenHash: hashedToken,
            heartbeatEvery: body.interval / 1000, // Convert ms to seconds
          },
        });

        return {
          ...monitor,
          heartbeatToken: token, // Return the plain token only once during creation
        };
      }

      return monitor;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: "Validation failed",
          message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      }
      const apiError = handleApiError(error, "create monitor");
      return reply.code(500).send(apiError);
    }
  });

  // GET /monitors/:id - Get single monitor by ID
  fastify.get("/monitors/:id", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { maintenanceService } = await import("../services/maintenance/suppressor.js");

    const monitor = await prisma.monitor.findUnique({
      where: { id },
      include: {
        checks: { orderBy: { checkedAt: "desc" }, take: 1 },
        incidents: { orderBy: { startedAt: "desc" }, take: 1 },
        group: true,
        tags: true,
        notificationChannels: true,
      },
    });

    if (!monitor) {
      return reply.code(404).send({ message: "Monitor not found" });
    }

    const inMaintenance = await maintenanceService.isSuppressed(monitor.id);
    const latestCheck = monitor.checks[0];
    const payload = latestCheck?.payload as any;

    // Extract certificate metadata - it's directly in payload, not payload.meta
    const meta = monitor.kind === 'certificate' && payload ? {
      certificateExpiresAt: payload.certificateExpiresAt,
      certificateDaysLeft: payload.certificateDaysLeft,
    } : null;

    // Handle heartbeat monitors specially
    let heartbeats = null;
    if (monitor.kind === 'push') {
      const heartbeatToken = await prisma.heartbeatToken.findFirst({
        where: { monitorId: monitor.id },
      });
      if (heartbeatToken) {
        heartbeats = {
          tokenHash: heartbeatToken.tokenHash,
          heartbeatEvery: monitor.interval / 1000,
          lastHeartbeat: heartbeatToken.lastHeartbeat,
        };
      }
    }

    return {
      id: monitor.id,
      name: monitor.name,
      kind: monitor.kind,
      config: monitor.config,
      interval: monitor.interval,
      timeout: monitor.timeout,
      paused: monitor.paused,
      createIncidents: (monitor as any).createIncidents,
      status: monitor.paused ? "paused" : (latestCheck?.status ?? "pending"),
      group: monitor.group,
      tags: monitor.tags,
      notificationChannels: monitor.notificationChannels,
      latestCheck: latestCheck ? {
        id: latestCheck.id,
        status: latestCheck.status,
        latencyMs: latestCheck.latencyMs,
        checkedAt: latestCheck.checkedAt,
        payload: latestCheck.payload,
      } : null,
      incident: monitor.incidents[0] ?? null,
      inMaintenance,
      meta,
      heartbeats,
      createdAt: monitor.createdAt,
      updatedAt: monitor.updatedAt,
    };
  });

  // PUT /monitors/:id - Update an existing monitor
  fastify.put("/monitors/:id", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = z.object({
        name: z.string().min(1).optional(),
        config: z.record(z.any()).optional(),
        interval: z.number().int().min(1000).optional(), // minimum 1 second
        timeout: z.number().int().min(1000).optional(), // minimum 1 second
        paused: z.boolean().optional(),
        createIncidents: z.boolean().optional(),
        groupId: z.string().nullable().optional(),
        tagIds: z.array(z.string()).optional(),
        notificationIds: z.array(z.string()).optional(),
      }).parse(request.body);

      // Check if monitor exists
      const existingMonitor = await prisma.monitor.findUnique({
        where: { id },
        include: { tags: true }
      });

      if (!existingMonitor) {
        return reply.code(404).send({ error: "Monitor not found" });
      }

      // Validate synthetic monitor config if kind is synthetic and config is being updated
      if (existingMonitor.kind === 'synthetic' && body.config) {
        try {
          syntheticConfigSchema.parse(body.config);
        } catch (error) {
          if (error instanceof z.ZodError) {
            return reply.code(400).send({
              error: "Invalid synthetic monitor configuration",
              message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
            });
          }
          throw error;
        }
      }

      // Validate group exists if provided
      if (body.groupId !== undefined && body.groupId !== null) {
        const group = await prisma.monitorGroup.findUnique({
          where: { id: body.groupId }
        });
        if (!group) {
          return reply.code(400).send({ error: "Invalid group ID" });
        }
      }

      // Validate tags exist if provided
      if (body.tagIds) {
        const tags = await prisma.tag.findMany({
          where: { id: { in: body.tagIds } }
        });
        if (tags.length !== body.tagIds.length) {
          return reply.code(400).send({ error: "One or more invalid tag IDs" });
        }
      }

      // Validate notification channels exist if provided
      if (body.notificationIds) {
        const channels = await prisma.notificationChannel.findMany({
          where: { id: { in: body.notificationIds } }
        });
        if (channels.length !== body.notificationIds.length) {
          return reply.code(400).send({ error: "One or more invalid notification channel IDs" });
        }
      }

      const updateData: any = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.config !== undefined) updateData.config = body.config;
      if (body.interval !== undefined) updateData.interval = body.interval;
      if (body.timeout !== undefined) updateData.timeout = body.timeout;
      if (body.paused !== undefined) updateData.paused = body.paused;
      if (body.createIncidents !== undefined) updateData.createIncidents = body.createIncidents;
      if (body.groupId !== undefined) updateData.groupId = body.groupId;

      const monitor = await prisma.monitor.update({
        where: { id },
        data: {
          ...updateData,
          tags: body.tagIds ? {
            deleteMany: {},
            create: body.tagIds.map(tagId => ({ tagId }))
          } : undefined,
          notificationChannels: body.notificationIds ? {
            set: body.notificationIds.map(id => ({ id }))
          } : undefined,
        },
        include: {
          group: true,
          tags: {
            include: {
              tag: true
            }
          },
        },
      });

      // Handle scheduling changes
      try {
        if (body.paused === true) {
          // Monitor was paused, cancel scheduling
          await monitorOrchestrator.cancelMonitor(id);
        } else if (body.paused === false) {
          // Monitor was resumed, schedule it
          await monitorOrchestrator.scheduleMonitor(id, monitor.interval);
        } else if (body.interval !== undefined && !monitor.paused) {
          // Interval changed and monitor is not paused, reschedule
          await monitorOrchestrator.cancelMonitor(id);
          await monitorOrchestrator.scheduleMonitor(id, monitor.interval);
        }
      } catch (error) {
        console.error("Failed to update monitor scheduling:", error);
        // Don't fail the update if scheduling fails
      }

      return monitor;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: "Validation failed",
          message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      }
      const apiError = handleApiError(error, "update monitor");
      return reply.code(500).send(apiError);
    }
  });

  // GET /monitors/:id/history - Get monitor check history
  fastify.get("/monitors/:id/history", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { limit = '50' } = request.query as { limit?: string };

    const monitor = await prisma.monitor.findUnique({
      where: { id },
    });

    if (!monitor) {
      return reply.code(404).send({ message: "Monitor not found" });
    }

    const limitNum = Math.min(parseInt(limit || '50'), 1000); // Cap at 1000

    const checks = await prisma.checkResult.findMany({
      where: { monitorId: id },
      orderBy: { checkedAt: "desc" },
      take: limitNum,
    });

    // Calculate stats from the returned checks
    const totalChecks = checks.length;
    const upChecks = checks.filter(check => check.status === 'up').length;
    const downChecks = checks.filter(check => check.status === 'down').length;
    const uptimePercentage = totalChecks > 0 ? (upChecks / totalChecks) * 100 : 0;
    const avgResponseTime = checks.length > 0
      ? checks.filter(c => c.latencyMs != null).reduce((sum, c) => sum + (c.latencyMs || 0), 0) /
        checks.filter(c => c.latencyMs != null).length
      : null;

    return {
      checks: checks.map(check => ({
        id: check.id,
        status: check.status,
        latencyMs: check.latencyMs,
        checkedAt: check.checkedAt,
        payload: check.payload,
      })),
      stats: {
        totalChecks,
        upChecks,
        downChecks,
        uptimePercentage,
        avgResponseTime,
      },
    };
  });

  // GET /monitors/:id/uptime - Get monitor uptime statistics
  fastify.get("/monitors/:id/uptime", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { days = '30' } = request.query as { days?: string };

    const monitor = await prisma.monitor.findUnique({
      where: { id },
    });

    if (!monitor) {
      return reply.code(404).send({ message: "Monitor not found" });
    }

    const daysNum = Math.min(parseInt(days || '30'), 365); // Cap at 365 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    // Get all checks for the monitor in the date range
    const checks = await prisma.checkResult.findMany({
      where: {
        monitorId: id,
        checkedAt: {
          gte: startDate,
        },
      },
      orderBy: { checkedAt: "asc" },
      select: {
        id: true,
        status: true,
        latencyMs: true,
        checkedAt: true,
        // Exclude payload field to avoid serialization issues
      },
    });

    // Calculate uptime statistics
    const totalChecks = checks.length;
    const upChecks = checks.filter(check => check.status === 'up').length;
    const downChecks = checks.filter(check => check.status === 'down').length;
    const uptimePercentage = totalChecks > 0 ? (upChecks / totalChecks) * 100 : 0;

    // Calculate daily uptime
    const dailyStats: { [date: string]: { total: number; up: number } } = {};
    checks.forEach(check => {
      const date = check.checkedAt.toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { total: 0, up: 0 };
      }
      dailyStats[date].total++;
      if (check.status === 'up') {
        dailyStats[date].up++;
      }
    });

    const uptimeDays = Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      uptimePercentage: stats.total > 0 ? (stats.up / stats.total) * 100 : 0,
    })).sort((a, b) => a.date.localeCompare(b.date));

    return {
      stats: {
        totalChecks,
        upChecks,
        downChecks,
        uptimePercentage,
        avgResponseTime: checks.length > 0
          ? checks.filter(c => c.latencyMs != null).reduce((sum, c) => sum + (c.latencyMs || 0), 0) /
            checks.filter(c => c.latencyMs != null).length
          : null,
      },
      days: uptimeDays,
    };
  });

  // POST /monitors/:id/pause - Pause a monitor
  fastify.post("/monitors/:id/pause", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      // First check if monitor exists and its current paused status
      const existingMonitor = await prisma.monitor.findUnique({
        where: { id },
      });

      if (!existingMonitor) {
        return reply.code(404).send({ message: "Monitor not found" });
      }

      if (existingMonitor.paused) {
        return reply.code(400).send({ message: "Monitor is already paused" });
      }

      const monitor = await prisma.monitor.update({
        where: { id },
        data: { paused: true },
        include: {
          group: true,
          tags: true,
        },
      });

      // Cancel the monitor scheduling
      try {
        await monitorOrchestrator.cancelMonitor(id);
      } catch (error) {
        console.error("Failed to cancel monitor scheduling:", error);
        // Don't fail the pause operation if scheduling cancellation fails
      }

      return monitor;
    } catch (error) {
      const apiError = handleApiError(error, "pause monitor");
      return reply.code(500).send(apiError);
    }
  });

  // POST /monitors/:id/resume - Resume a monitor
  fastify.post("/monitors/:id/resume", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      // First check if monitor exists and its current paused status
      const existingMonitor = await prisma.monitor.findUnique({
        where: { id },
      });

      if (!existingMonitor) {
        return reply.code(404).send({ message: "Monitor not found" });
      }

      if (!existingMonitor.paused) {
        return reply.code(400).send({ message: "Monitor is already running" });
      }

      const monitor = await prisma.monitor.update({
        where: { id },
        data: { paused: false },
        include: {
          group: true,
          tags: true,
        },
      });

      // Schedule the monitor
      try {
        await monitorOrchestrator.scheduleMonitor(id, monitor.interval);
      } catch (error) {
        console.error("Failed to schedule monitor:", error);
        // Don't fail the resume operation if scheduling fails
      }

      return monitor;
    } catch (error) {
      const apiError = handleApiError(error, "get monitor");
      return reply.code(500).send(apiError);
    }
  });

  // POST /monitors/:id/run - Manually run a monitor check
  fastify.post("/monitors/:id/run", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      // Check if monitor exists
      const monitor = await prisma.monitor.findUnique({
        where: { id },
        include: {
          group: true,
          tags: true,
        },
      });

      if (!monitor) {
        return reply.code(404).send({ message: "Monitor not found" });
      }

      // Run the monitor check manually
      const result = await monitorOrchestrator.runMonitorCheck(id);
      return {
        success: true,
        message: "Monitor check completed",
        result,
      };
    } catch (error) {
      const apiError = handleApiError(error, "run monitor check");
      return reply.code(500).send(apiError);
    }
  });

  // DELETE /monitors/:id - Delete a monitor
  fastify.delete("/monitors/:id", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      // Check if monitor exists
      const monitor = await prisma.monitor.findUnique({
        where: { id },
        include: {
          checks: { take: 1 },
          incidents: { take: 1 },
          heartbeats: true,
        },
      });

      if (!monitor) {
        return reply.code(404).send({ error: "Monitor not found" });
      }

      // Cancel the monitor scheduling before deletion
      try {
        await monitorOrchestrator.cancelMonitor(id);
      } catch (error) {
        console.error("Failed to cancel monitor scheduling:", error);
        // Don't fail the deletion if scheduling cancellation fails
      }

      // Delete associated heartbeat token if it exists
      if (monitor.heartbeats) {
        await prisma.heartbeatToken.delete({
          where: { monitorId: id }
        });
      }

      // Delete the monitor (cascade will handle related records)
      await prisma.monitor.delete({
        where: { id }
      });

      return { success: true, message: "Monitor deleted successfully" };
    } catch (error) {
      const apiError = handleApiError(error, "delete monitor");
      return reply.code(500).send(apiError);
    }
  });
};

export default fp(monitorsPlugin);
