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
  fastify.addHook("preHandler", fastify.authenticate);

  // GET /notifications - List all notification channels (frontend expects this endpoint)
  fastify.get("/notifications", async () => {
    return prisma.notificationChannel.findMany({ include: { monitors: true }, orderBy: { createdAt: "desc" } });
  });

  // GET /notifications/list - Alternative endpoint
  fastify.get("/notifications/list", async () => {
    return prisma.notificationChannel.findMany({ include: { monitors: true }, orderBy: { createdAt: "desc" } });
  });

  fastify.post("/notifications", async (request) => {
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

  fastify.put("/notifications/:id", async (request) => {
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

  fastify.delete("/notifications/:id", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    await prisma.notificationChannel.delete({ where: { id: params.id } });
    reply.code(204).send();
  });
};

export default fp(notificationsPlugin);
