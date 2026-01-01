import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { prisma } from "../db/prisma.js";

const channelSchema = z.object({
  name: z.string(),
  type: z.enum(["email", "ntfy", "discord", "slack", "telegram", "gotify", "pushover", "webhook", "apprise"]),
  config: z.record(z.any()).default({}),
  monitorIds: z.array(z.string()).default([]),
});

const notificationsPlugin = async (fastify: FastifyInstance) => {

  // GET /notifications - List all notification channels (frontend expects this endpoint)
  fastify.get("/notifications", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async () => {
    const channels = await prisma.notificationChannel.findMany({ include: { monitors: true }, orderBy: { createdAt: "desc" } });
    // Mask sensitive fields
    return channels.map(channel => {
      const config = channel.config as any;
      const maskedConfig = { ...config };
      if (maskedConfig.password) maskedConfig.password = '***MASKED***';
      if (maskedConfig.apiKey) maskedConfig.apiKey = '***MASKED***';
      if (maskedConfig.token) maskedConfig.token = '***MASKED***';
      if (maskedConfig.secret) maskedConfig.secret = '***MASKED***';
      if (maskedConfig.webhookUrl && maskedConfig.webhookUrl.includes('hooks.slack.com')) {
        maskedConfig.webhookUrl = maskedConfig.webhookUrl.replace(/(https:\/\/hooks\.slack\.com\/services\/)([^\/]+\/[^\/]+\/)(.+)/, '$1***MASKED***/$3');
      }
      if (maskedConfig.botToken) maskedConfig.botToken = '***MASKED***';
      return { ...channel, config: maskedConfig };
    });
  });

  // GET /notifications/list - Alternative endpoint
  fastify.get("/notifications/list", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async () => {
    const channels = await prisma.notificationChannel.findMany({ include: { monitors: true }, orderBy: { createdAt: "desc" } });
    // Mask sensitive fields
    return channels.map(channel => {
      const config = channel.config as any;
      const maskedConfig = { ...config };
      if (maskedConfig.password) maskedConfig.password = '***MASKED***';
      if (maskedConfig.apiKey) maskedConfig.apiKey = '***MASKED***';
      if (maskedConfig.token) maskedConfig.token = '***MASKED***';
      if (maskedConfig.secret) maskedConfig.secret = '***MASKED***';
      if (maskedConfig.webhookUrl && maskedConfig.webhookUrl.includes('hooks.slack.com')) {
        maskedConfig.webhookUrl = maskedConfig.webhookUrl.replace(/(https:\/\/hooks\.slack\.com\/services\/)([^\/]+\/[^\/]+\/)(.+)/, '$1***MASKED***/$3');
      }
      if (maskedConfig.botToken) maskedConfig.botToken = '***MASKED***';
      return { ...channel, config: maskedConfig };
    });
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
