import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { monitorOrchestrator } from "../services/monitor-engine/orchestrator.js";
import crypto from "crypto";
import { handleApiError } from "../utils/error-handler.js";

const pushPlugin = async (fastify: FastifyInstance) => {
  // Public endpoint - no auth required for heartbeat push
  fastify.post("/heartbeat/:token", async (request, reply) => {
    try {
      const params = z.object({ token: z.string() }).parse(request.params);
      const record = await prisma.heartbeatToken.findFirst({
        where: { tokenHash: params.token },
        include: { monitor: true },
      });
      if (!record || !record.monitor) return reply.code(404).send({ message: "Unknown token" });

      const now = new Date();
      await prisma.heartbeatToken.update({
        where: { id: record.id },
        data: { lastHeartbeat: now },
      });

      await monitorOrchestrator.handleResult(
        {
          monitorId: record.monitorId,
          status: "up",
          message: "Heartbeat received",
          checkedAt: now.toISOString(),
          meta: {
            pushWindowSeconds: record.heartbeatEvery,
            heartbeatReceivedAt: now.toISOString(),
          },
        },
        { id: record.monitor.id, name: record.monitor.name }
      );

      reply.code(204).send();
    } catch (error) {
      const apiError = handleApiError(error, "process heartbeat");
      return reply.code(500).send(apiError);
    }
  });
};

// Authenticated heartbeat management plugin
const heartbeatManagementPlugin = async (fastify: FastifyInstance) => {
  // GET /heartbeats - List all heartbeat tokens
  fastify.get("/heartbeats", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request, reply) => {
    try {
      return await prisma.heartbeatToken.findMany({
        include: { monitor: { select: { id: true, name: true, kind: true } } },
        orderBy: { id: "desc" },
      });
    } catch (error) {
      const apiError = handleApiError(error, "list heartbeats");
      return reply.code(500).send(apiError);
    }
  });

  // POST /heartbeats - Create a heartbeat token for a monitor
  fastify.post("/heartbeats", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request, reply) => {
    try {
      const body = z.object({
        monitorId: z.string(),
        heartbeatEvery: z.number().min(60).max(86400), // 1 min to 24 hours
      }).parse(request.body);

      // Check if a heartbeat token already exists for this monitor
      const existing = await prisma.heartbeatToken.findFirst({
        where: { monitorId: body.monitorId },
      });

      if (existing) {
        return reply.code(409).send({
          error: "Conflict",
          message: "A heartbeat token already exists for this monitor. Please delete the existing token first.",
        });
      }

      // Generate a unique token
      const token = crypto.randomBytes(32).toString('hex');

      const heartbeat = await prisma.heartbeatToken.create({
        data: {
          monitorId: body.monitorId,
          tokenHash: token,
          heartbeatEvery: body.heartbeatEvery,
        },
        include: { monitor: true },
      });

      return {
        ...heartbeat,
        url: `/api/heartbeat/${token}`,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: "Validation failed",
          message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      }
      const apiError = handleApiError(error, "create heartbeat token");
      return reply.code(500).send(apiError);
    }
  });

  // DELETE /heartbeats/:id - Delete a heartbeat token
  fastify.delete("/heartbeats/:id", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request, reply) => {
    try {
      const params = z.object({ id: z.string() }).parse(request.params);
      await prisma.heartbeatToken.delete({ where: { id: params.id } });
      reply.code(204).send();
    } catch (error) {
      const apiError = handleApiError(error, "delete heartbeat token");
      return reply.code(500).send(apiError);
    }
  });

  // GET /heartbeats/:id/history - Get heartbeat history
  fastify.get("/heartbeats/:id/history", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request, reply) => {
    try {
      const params = z.object({ id: z.string() }).parse(request.params);
      const query = z.object({
        days: z.coerce.number().min(1).max(90).default(7),
      }).parse(request.query);

      const heartbeat = await prisma.heartbeatToken.findUnique({
        where: { id: params.id },
        include: { monitor: true },
      });

      if (!heartbeat) {
        return reply.code(404).send({ error: "Heartbeat not found" });
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - query.days);

      const checks = await prisma.checkResult.findMany({
        where: {
          monitorId: heartbeat.monitorId,
          checkedAt: { gte: startDate },
        },
        orderBy: { checkedAt: "desc" },
        take: 500,
      });

    // Calculate intervals between heartbeats
    const intervals = [];
    for (let i = 0; i < checks.length - 1; i++) {
      const current = new Date(checks[i].checkedAt);
      const previous = new Date(checks[i + 1].checkedAt);
      const intervalSeconds = (current.getTime() - previous.getTime()) / 1000;
      
      intervals.push({
        timestamp: checks[i].checkedAt,
        intervalSeconds,
        expectedSeconds: heartbeat.heartbeatEvery,
        isLate: intervalSeconds > heartbeat.heartbeatEvery * 1.2, // 20% grace period
        status: checks[i].status,
      });
    }

    return {
      heartbeat: {
        id: heartbeat.id,
        monitorId: heartbeat.monitorId,
        monitorName: heartbeat.monitor.name,
        heartbeatEvery: heartbeat.heartbeatEvery,
        lastHeartbeat: heartbeat.lastHeartbeat,
      },
      intervals: intervals.reverse(), // Chronological order
      stats: {
        totalHeartbeats: checks.length,
        missedHeartbeats: checks.filter((c: any) => c.status !== 'up').length,
        avgInterval: intervals.length > 0
          ? Math.round(intervals.reduce((sum, i) => sum + i.intervalSeconds, 0) / intervals.length)
          : 0,
      },
    };
    } catch (error) {
      const apiError = handleApiError(error, "get heartbeat history");
      return reply.code(500).send(apiError);
    }
  });
};

export default fp(pushPlugin);
export { heartbeatManagementPlugin };
