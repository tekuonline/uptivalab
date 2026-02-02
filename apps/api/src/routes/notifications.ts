import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { log } from "../utils/logger.js";
import { advancedCache } from "../utils/advanced-cache.js";
import { getPaginationParams, buildPaginatedResponse, type PaginationQuery } from "../utils/pagination.js";
import { buildSelectFields } from "../utils/field-filtering.js";

const channelSchema = z.object({
  name: z.string(),
  type: z.enum(["email", "ntfy", "discord", "slack", "telegram", "gotify", "pushover", "webhook", "apprise"]),
  config: z.record(z.any()).default({}),
  monitorIds: z.array(z.string()).default([]),
});

const maskSensitiveFields = (config: any) => {
  const maskedConfig = { ...config };
  if (maskedConfig.password) maskedConfig.password = '***MASKED***';
  if (maskedConfig.apiKey) maskedConfig.apiKey = '***MASKED***';
  if (maskedConfig.token) maskedConfig.token = '***MASKED***';
  if (maskedConfig.secret) maskedConfig.secret = '***MASKED***';
  if (maskedConfig.webhookUrl && maskedConfig.webhookUrl.includes('hooks.slack.com')) {
    maskedConfig.webhookUrl = maskedConfig.webhookUrl.replace(/(https:\/\/hooks\.slack\.com\/services\/)([^\/]+\/[^\/]+\/)(.+)/, '$1***MASKED***/$3');
  }
  if (maskedConfig.botToken) maskedConfig.botToken = '***MASKED***';
  return maskedConfig;
};

const notificationsPlugin = async (fastify: FastifyInstance) => {

  // GET /notifications - List all notification channels with pagination & field filtering
  fastify.get("/notifications", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request, reply) => {
    try {
      // Parse pagination parameters
      const { page, limit } = getPaginationParams(request.query as PaginationQuery, {
        defaultLimit: 20,
        maxLimit: 100,
      });

      // Parse field filtering parameters
      const fieldsParam = (request.query as PaginationQuery).fields as string | undefined;
      const selectFields = buildSelectFields('notificationChannel', fieldsParam);

      // Build cache key
      const cacheKey = `notifications:list:page${page}:limit${limit}:fields${fieldsParam || 'standard'}`;
      
      // Check advanced cache first
      const cached = advancedCache.get('notificationChannels', cacheKey);
      if (cached) {
        return cached;
      }

      // Calculate skip for pagination
      const skip = (page - 1) * limit;

      // Optimized query
      const channels = await prisma.notificationChannel.findMany({
        select: selectFields,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      });

      // Get total count
      const totalCount = await prisma.notificationChannel.count();

      // Mask sensitive fields and build response
      const maskedChannels = channels.map((channel: any) => ({
        ...channel,
        config: maskSensitiveFields(channel.config),
      }));

      // Build paginated response
      const response = buildPaginatedResponse(maskedChannels, {
        page,
        limit,
        total: totalCount,
      });

      // Cache for 5 minutes
      advancedCache.set('notificationChannels', cacheKey, response, 5 * 60 * 1000);

      return response;
    } catch (error) {
      log.error("Error fetching notification channels:", error);
      return reply.code(500).send({ error: "Failed to fetch notification channels" });
    }
  });

  // GET /notifications/list - Alternative endpoint
  fastify.get("/notifications/list", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request, reply) => {
    try {
      // Parse pagination parameters
      const { page, limit } = getPaginationParams(request.query as PaginationQuery, {
        defaultLimit: 20,
        maxLimit: 100,
      });

      // Parse field filtering parameters
      const fieldsParam = (request.query as PaginationQuery).fields as string | undefined;
      const selectFields = buildSelectFields('notificationChannel', fieldsParam);

      // Build cache key
      const cacheKey = `notifications:list2:page${page}:limit${limit}:fields${fieldsParam || 'standard'}`;
      
      // Check advanced cache first
      const cached = advancedCache.get('notificationChannels', cacheKey);
      if (cached) {
        return cached;
      }

      // Calculate skip for pagination
      const skip = (page - 1) * limit;

      // Optimized query
      const channels = await prisma.notificationChannel.findMany({
        select: selectFields,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      });

      // Get total count
      const totalCount = await prisma.notificationChannel.count();

      // Mask sensitive fields and build response
      const maskedChannels = channels.map((channel: any) => ({
        ...channel,
        config: maskSensitiveFields(channel.config),
      }));

      // Build paginated response
      const response = buildPaginatedResponse(maskedChannels, {
        page,
        limit,
        total: totalCount,
      });

      // Cache for 5 minutes
      advancedCache.set('notificationChannels', cacheKey, response, 5 * 60 * 1000);

      return response;
    } catch (error) {
      log.error("Error fetching notification channels:", error);
      return reply.code(500).send({ error: "Failed to fetch notification channels" });
    }
  });

  fastify.post("/notifications", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request) => {
    const body = channelSchema.parse(request.body);
    const { monitorIds, ...channelData } = body;
    const channel = await prisma.notificationChannel.create({
      data: {
        ...channelData,
        monitors: monitorIds.length ? { connect: monitorIds.map((id) => ({ id })) } : undefined,
      },
      include: { monitors: true },
    });
    return channel;
  });

  fastify.put("/notifications/:id", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = channelSchema.partial().parse(request.body);
    const { monitorIds, ...channelData } = body;
    const channel = await prisma.notificationChannel.update({
      where: { id: params.id },
      data: {
        ...channelData,
        monitors: monitorIds
          ? {
              set: [],
              connect: monitorIds.map((id) => ({ id })),
            }
          : undefined,
      },
      include: { monitors: true },
    });
    return channel;
  });

  fastify.delete("/notifications/:id", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    await prisma.notificationChannel.delete({ where: { id: params.id } });
    reply.code(204).send();
  });

  // POST /notifications/test - Test notification channel before saving
  fastify.post("/notifications/test", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request, reply) => {
    const body = channelSchema.parse(request.body);
    
    try {
      // Import notification service
      const { sendTestNotification } = await import("../services/notifications/test-sender.js");
      
      // Send test notification
      const result = await sendTestNotification(body.type, body.config);
      
      if (result.success) {
        return { success: true, message: "Test notification sent successfully" };
      } else {
        return reply.code(400).send({ success: false, error: result.error });
      }
    } catch (error: any) {
      return reply.code(500).send({ 
        success: false, 
        error: error.message || "Failed to send test notification" 
      });
    }
  });
};

export default fp(notificationsPlugin);
