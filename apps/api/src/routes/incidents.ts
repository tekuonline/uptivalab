import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { incidentManager } from "../services/incidents/manager.js";

const incidentSchema = z.object({
  status: z.enum(["OPEN", "INVESTIGATING", "MITIGATED", "RESOLVED"]).optional(),
  monitorId: z.string().optional(),
});

const eventSchema = z.object({
  message: z.string().min(3),
});

const incidentsPlugin = async (fastify: FastifyInstance) => {
  fastify.addHook("preHandler", fastify.authenticate);

  // GET /incidents - List all incidents (frontend expects this endpoint)
  fastify.get("/incidents", async (request) => {
    const query = incidentSchema.parse(request.query);
    return prisma.incident.findMany({
      where: {
        status: query.status,
        monitorId: query.monitorId,
      },
      orderBy: { startedAt: "desc" },
      include: {
        monitor: { select: { id: true, name: true, kind: true } },
        events: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
  });

  // GET /incidents/list - Alternative endpoint
  fastify.get("/incidents/list", async (request) => {
    const query = incidentSchema.parse(request.query);
    return prisma.incident.findMany({
      where: {
        status: query.status,
        monitorId: query.monitorId,
      },
      orderBy: { startedAt: "desc" },
      include: {
        monitor: { select: { id: true, name: true, kind: true } },
        events: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
  });

  fastify.get("/incidents/:id", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const incident = await prisma.incident.findUnique({
      where: { id: params.id },
      include: {
        monitor: { select: { id: true, name: true, kind: true } },
        events: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!incident) return reply.code(404).send({ message: "Incident not found" });
    return incident;
  });

  fastify.post("/incidents/:id/events", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = eventSchema.parse(request.body);
    const incident = await prisma.incident.findUnique({ where: { id: params.id } });
    if (!incident) return reply.code(404).send({ message: "Incident not found" });

    const event = await prisma.incidentEvent.create({
      data: { incidentId: params.id, message: body.message },
    });
    return event;
  });

  // PATCH /incidents/:id - Update incident status
  fastify.patch("/incidents/:id", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({ 
      status: z.enum(["OPEN", "INVESTIGATING", "MITIGATED", "RESOLVED"]) 
    }).parse(request.body);
    
    const incident = await prisma.incident.findUnique({ 
      where: { id: params.id },
      include: { monitor: { select: { id: true, name: true, kind: true } } },
    });
    if (!incident) return reply.code(404).send({ message: "Incident not found" });

    // Update incident status
    const updated = await prisma.incident.update({
      where: { id: params.id },
      data: { 
        status: body.status,
        resolvedAt: body.status === "RESOLVED" ? new Date() : null,
      },
      include: {
        monitor: { select: { id: true, name: true, kind: true } },
        events: { orderBy: { createdAt: "desc" } },
      },
    });

    // Create event for status change
    await prisma.incidentEvent.create({
      data: { 
        incidentId: params.id, 
        message: `Status changed to ${body.status}`,
      },
    });
    
    // Send notification for manual status change
    await incidentManager.notify(
      incident.monitorId,
      body.status as any,
      `Status manually changed to ${body.status}`,
      incident.monitor
    );

    return updated;
  });
};

export default fp(incidentsPlugin);
