import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { monitorOrchestrator } from "../services/monitor-engine/orchestrator.js";
import { maintenanceService } from "../services/maintenance/suppressor.js";

const monitorSchema = z.object({
  name: z.string(),
  kind: z.enum(["http", "tcp", "ping", "dns", "docker", "certificate", "database", "synthetic", "grpc", "push"]),
  config: z.record(z.any()),
  interval: z.number().min(15_000),
  timeout: z.number().optional(),
  notificationIds: z.array(z.string()).optional(),
});

const monitorsPlugin = async (fastify: FastifyInstance) => {
  fastify.addHook("preHandler", fastify.authenticate);

  // GET /monitors - List all monitors (frontend expects this endpoint)
  fastify.get("/monitors", async () => {
    const monitors = await prisma.monitor.findMany({
      include: {
        tags: { include: { tag: true } },
        group: true,
        checks: { orderBy: { checkedAt: "desc" }, take: 90 }, // Get 90 most recent checks for uptime bar
        notificationChannels: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Add status, lastCheck, and maintenance status from latest check
    const results = await Promise.all(
      monitors.map(async (monitor: any) => {
        const inMaintenance = await maintenanceService.isSuppressed(monitor.id);
        const latestCheck = monitor.checks[0];
        const payload = latestCheck?.payload as any;
        // Extract certificate metadata for certificate monitors
        const meta = monitor.kind === 'certificate' && payload ? {
          certificateExpiresAt: payload.certificateExpiresAt,
          certificateDaysLeft: payload.certificateDaysLeft,
        } : null;
        
        // Mask sensitive fields in config
        const config = monitor.config as any;
        const maskedConfig = { ...config };
        if (maskedConfig.password) maskedConfig.password = '***MASKED***';
        if (maskedConfig.authPassword) maskedConfig.authPassword = '***MASKED***';
        if (maskedConfig.apiKey) maskedConfig.apiKey = '***MASKED***';
        if (maskedConfig.token) maskedConfig.token = '***MASKED***';
        if (maskedConfig.secret) maskedConfig.secret = '***MASKED***';
        if (maskedConfig.connectionString && maskedConfig.connectionString.includes('password=')) {
          maskedConfig.connectionString = maskedConfig.connectionString.replace(/password=[^;\s]+/gi, 'password=***MASKED***');
        }
        
        const result = {
          ...monitor,
          config: maskedConfig,
          status: latestCheck?.status ?? "pending",
          lastCheck: latestCheck?.checkedAt ?? null,
          recentChecks: monitor.checks, // Keep checks for uptime bar
          inMaintenance,
          meta,
          notificationIds: monitor.notificationChannels?.map((nc: any) => nc.id) || [],
        };
        
        // Remove fields we don't want in response
        delete (result as any).checks;
        delete (result as any).notificationChannels;
        
        return result;
      })
    );
    
    return results;
  });

  // GET /monitors/list - Alternative endpoint for listing monitors
  fastify.get("/monitors/list", async () => {
    const monitors = await prisma.monitor.findMany({
      include: {
        tags: { include: { tag: true } },
        group: true,
        checks: { orderBy: { checkedAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });

    // Add status, lastCheck, and maintenance status from latest check result
    const results = await Promise.all(
      monitors.map(async (monitor: any) => {
        const inMaintenance = await maintenanceService.isSuppressed(monitor.id);
        return {
          ...monitor,
          status: monitor.checks[0]?.status ?? "pending",
          lastCheck: monitor.checks[0]?.checkedAt ?? null,
          checks: undefined, // Remove checks from response
          inMaintenance,
        };
      })
    );
    
    return results;
  });

  // GET /monitors/:id - Get a single monitor with details
  fastify.get("/monitors/:id", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const monitor = await prisma.monitor.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        tags: { include: { tag: true } },
        group: true,
        checks: { orderBy: { checkedAt: "desc" }, take: 100 },
        incidents: { orderBy: { startedAt: "desc" }, take: 10 },
        heartbeats: true,
      },
    });
    
    // Compute status from latest check
    const status = monitor.checks[0]?.status ?? "pending";
    
    // Extract certificate metadata for certificate monitors
    const latestCheck = monitor.checks[0];
    const payload = latestCheck?.payload as any;
    const meta = monitor.kind === 'certificate' && payload ? {
      certificateExpiresAt: payload.certificateExpiresAt,
      certificateDaysLeft: payload.certificateDaysLeft,
    } : null;
    
    // Mask sensitive fields in config
    const config = monitor.config as any;
    const maskedConfig = { ...config };
    if (maskedConfig.password) maskedConfig.password = '***MASKED***';
    if (maskedConfig.authPassword) maskedConfig.authPassword = '***MASKED***';
    if (maskedConfig.apiKey) maskedConfig.apiKey = '***MASKED***';
    if (maskedConfig.token) maskedConfig.token = '***MASKED***';
    if (maskedConfig.secret) maskedConfig.secret = '***MASKED***';
    if (maskedConfig.connectionString && maskedConfig.connectionString.includes('password=')) {
      maskedConfig.connectionString = maskedConfig.connectionString.replace(/password=[^;\s]+/gi, 'password=***MASKED***');
    }
    
    return {
      ...monitor,
      status,
      meta,
      config: maskedConfig,
    };
  });

  // GET /monitors/:id/history - Get monitor check history for graphs
  fastify.get("/monitors/:id/history", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const query = z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z.coerce.number().min(1).max(1000).default(200),
    }).parse(request.query);

    const where: any = { monitorId: params.id };
    
    if (query.from || query.to) {
      where.checkedAt = {};
      if (query.from) where.checkedAt.gte = new Date(query.from);
      if (query.to) where.checkedAt.lte = new Date(query.to);
    }

    const checks = await prisma.checkResult.findMany({
      where,
      orderBy: { checkedAt: "desc" },
      take: query.limit,
    });

    // Calculate uptime percentage
    const totalChecks = checks.length;
    const upChecks = checks.filter((c: any) => c.status === "up").length;
    const uptimePercentage = totalChecks > 0 ? (upChecks / totalChecks) * 100 : 0;

    // Calculate average response time
    const responseTimes = checks.filter((c: any) => c.latencyMs !== null).map((c: any) => c.latencyMs!);
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length
      : null;

    return {
      checks: checks.reverse(), // Return in chronological order for graphs
      stats: {
        totalChecks,
        upChecks,
        downChecks: totalChecks - upChecks,
        uptimePercentage: Math.round(uptimePercentage * 100) / 100,
        avgResponseTime: avgResponseTime !== null ? Math.round(avgResponseTime) : null,
      },
    };
  });

  // GET /monitors/:id/uptime - Get uptime data for the last 90 days
  fastify.get("/monitors/:id/uptime", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const query = z.object({
      days: z.coerce.number().min(1).max(90).default(90),
    }).parse(request.query);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - query.days);

    const checks = await prisma.checkResult.findMany({
      where: {
        monitorId: params.id,
        checkedAt: { gte: startDate },
      },
      orderBy: { checkedAt: "asc" },
      select: {
        status: true,
        checkedAt: true,
        latencyMs: true,
      },
    });

    // Group by day
    const dailyStats: Record<string, { up: number; down: number; total: number; avgResponseTime: number }> = {};
    
    checks.forEach((check: any) => {
      const day = check.checkedAt.toISOString().split('T')[0];
      if (!dailyStats[day]) {
        dailyStats[day] = { up: 0, down: 0, total: 0, avgResponseTime: 0 };
      }
      dailyStats[day].total++;
      if (check.status === 'up') {
        dailyStats[day].up++;
        if (check.latencyMs) {
          dailyStats[day].avgResponseTime += check.latencyMs;
        }
      } else {
        dailyStats[day].down++;
      }
    });

    // Calculate average response times
    Object.keys(dailyStats).forEach(day => {
      if (dailyStats[day].up > 0) {
        dailyStats[day].avgResponseTime = Math.round(dailyStats[day].avgResponseTime / dailyStats[day].up);
      }
    });

    return {
      days: Object.entries(dailyStats).map(([date, stats]) => ({
        date,
        uptimePercentage: stats.total > 0 ? Math.round((stats.up / stats.total) * 10000) / 100 : 0,
        upChecks: stats.up,
        downChecks: stats.down,
        totalChecks: stats.total,
        avgResponseTime: stats.avgResponseTime,
      })),
      overall: {
        totalChecks: checks.length,
        upChecks: checks.filter((c: any) => c.status === 'up').length,
        uptimePercentage: checks.length > 0
          ? Math.round((checks.filter((c: any) => c.status === 'up').length / checks.length) * 10000) / 100
          : 0,
      },
    };
  });

  fastify.post("/monitors", async (request) => {
    const body = monitorSchema.parse(request.body);
    const { notificationIds, ...monitorData } = body;
    
    // Create monitor with notification channels
    const monitor = await prisma.monitor.create({
      data: {
        ...monitorData,
        notificationChannels: notificationIds && notificationIds.length > 0
          ? { connect: notificationIds.map((id) => ({ id })) }
          : undefined,
      },
    });
    
    await monitorOrchestrator.scheduleMonitor(monitor.id, monitor.interval);
    return monitor;
  });

  fastify.put("/monitors/:id", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = monitorSchema.partial().parse(request.body);
    const { notificationIds, ...monitorData } = body;
    
    // Update monitor with notification channels
    const monitor = await prisma.monitor.update({
      where: { id: params.id },
      data: {
        ...monitorData,
        notificationChannels: notificationIds !== undefined
          ? { set: notificationIds.map((id) => ({ id })) }
          : undefined,
      },
    });
    
    await monitorOrchestrator.cancelMonitor(monitor.id);
    await monitorOrchestrator.scheduleMonitor(monitor.id, monitor.interval);
    return monitor;
  });

  fastify.delete("/monitors/:id", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    await prisma.monitor.delete({ where: { id: params.id } });
    await monitorOrchestrator.cancelMonitor(params.id);
    reply.code(204);
  });

  fastify.post("/:id/run", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const monitor = await prisma.monitor.findUniqueOrThrow({ where: { id: params.id } });
    const result = await monitorOrchestrator.queue.add("monitor", { monitorId: monitor.id });
    return { jobId: result.id };
  });

  fastify.post("/monitors/:id/pause", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const monitor = await prisma.monitor.update({
      where: { id: params.id },
      data: { paused: true },
    });
    await monitorOrchestrator.cancelMonitor(params.id);
    return monitor;
  });

  fastify.post("/monitors/:id/resume", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const monitor = await prisma.monitor.update({
      where: { id: params.id },
      data: { paused: false },
    });
    await monitorOrchestrator.scheduleMonitor(monitor.id, monitor.interval);
    return monitor;
  });

  // GET /monitors/config-options - Get available configuration options
  fastify.get("/monitors/config-options", async () => {
    const { MonitorConfigHelper } = await import("../utils/monitor-config.js");
    
    const [dockerHosts, proxies, remoteBrowsers, chromeExecutable, steamApiKey] = await Promise.all([
      MonitorConfigHelper.getDockerHosts(),
      MonitorConfigHelper.getProxies(),
      MonitorConfigHelper.getRemoteBrowsers(),
      MonitorConfigHelper.getChromeExecutable(),
      MonitorConfigHelper.getSteamApiKey(),
    ]);

    return {
      dockerHosts,
      proxies,
      remoteBrowsers,
      chromeExecutable,
      steamApiKey,
    };
  });
};

export default fp(monitorsPlugin);
