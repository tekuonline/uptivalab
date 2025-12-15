import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { prisma } from "../db/prisma.js";
import { z } from "zod";
import { maintenanceService } from "../services/maintenance/suppressor.js";

const statusPlugin = async (fastify: FastifyInstance) => {
  // GET /status - List monitor statuses (frontend expects this endpoint)
  fastify.get("/status", { preHandler: fastify.authenticate }, async () => {
    const monitors = await prisma.monitor.findMany({
      include: {
        checks: { orderBy: { checkedAt: "desc" }, take: 1 },
        incidents: { orderBy: { startedAt: "desc" }, take: 1 },
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
          status: latestCheck?.status ?? "pending",
          lastCheck: latestCheck?.checkedAt ?? null,
          incident: monitor.incidents[0] ?? null,
          inMaintenance,
          meta,
        };
      })
    );
    
    return results;
  });

  // GET /status/list - Alternative endpoint
  fastify.get("/status/list", { preHandler: fastify.authenticate }, async () => {
    const monitors = await prisma.monitor.findMany({
      include: {
        checks: { orderBy: { checkedAt: "desc" }, take: 1 },
        incidents: { orderBy: { startedAt: "desc" }, take: 1 },
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
          status: latestCheck?.status ?? "pending",
          lastCheck: latestCheck?.checkedAt ?? null,
          incident: monitor.incidents[0] ?? null,
          inMaintenance,
          meta,
        };
      })
    );
    
    return results;
  });

  fastify.get("/status/:id/history", { preHandler: fastify.authenticate }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    return prisma.checkResult.findMany({
      where: { monitorId: params.id },
      orderBy: { checkedAt: "desc" },
      take: 200,
    });
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
};

export default fp(statusPlugin);
