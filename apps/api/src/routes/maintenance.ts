import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { prisma } from "../db/prisma.js";

const windowSchema = z.object({
  name: z.string(),
  startsAt: z.string().transform((value) => new Date(value)),
  endsAt: z.string().transform((value) => new Date(value)),
  monitorIds: z.array(z.string()).min(1),
});

const maintenancePlugin = async (fastify: FastifyInstance) => {
  fastify.addHook("preHandler", fastify.authenticate);

  // GET /maintenance - List all maintenance windows (frontend expects this endpoint)
  fastify.get("/maintenance", async () => {
    return prisma.maintenanceWindow.findMany({
      include: { monitors: true },
      orderBy: { startsAt: "desc" },
    });
  });

  // GET /maintenance/list - Alternative endpoint
  fastify.get("/maintenance/list", async () => {
    return prisma.maintenanceWindow.findMany({
      include: { monitors: true },
      orderBy: { startsAt: "desc" },
    });
  });

  fastify.post("/maintenance", async (request) => {
    const body = windowSchema.parse(request.body);
    const window = await prisma.maintenanceWindow.create({
      data: {
        name: body.name,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        monitors: { connect: body.monitorIds.map((id) => ({ id })) },
      },
      include: { monitors: true },
    });
    return window;
  });

  fastify.put("/maintenance/:id", async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = windowSchema.partial().parse(request.body);
    const window = await prisma.maintenanceWindow.update({
      where: { id: params.id },
      data: {
        name: body.name ?? undefined,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        monitors: body.monitorIds
          ? {
              set: [],
              connect: body.monitorIds.map((id) => ({ id })),
            }
          : undefined,
      },
      include: { monitors: true },
    });
    return window;
  });

  fastify.delete("/maintenance/:id", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    await prisma.maintenanceWindow.delete({ where: { id: params.id } });
    reply.code(204).send();
  });
};

export default fp(maintenancePlugin);
