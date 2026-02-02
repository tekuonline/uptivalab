import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { log } from "../utils/logger.js";
import { advancedCache } from "../utils/advanced-cache.js";
import { getPaginationParams, buildPaginatedResponse, type PaginationQuery } from "../utils/pagination.js";
import { buildSelectFields } from "../utils/field-filtering.js";
import { incidentManager } from "../services/incidents/manager.js";

const incidentSchema = z.object({
  status: z.enum(["OPEN", "INVESTIGATING", "MITIGATED", "RESOLVED"]).optional(),
  monitorId: z.string().optional(),
});

const eventSchema = z.object({
  message: z.string().min(3),
});

const incidentsPlugin = async (fastify: FastifyInstance) => {
  // GET /incidents - List all incidents with pagination & field filtering
  fastify.get("/incidents", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request, reply) => {
    try {
      const query = incidentSchema.parse(request.query);
      
      // Parse pagination parameters
      const { page, limit } = getPaginationParams(request.query as PaginationQuery, {
        defaultLimit: 15,
        maxLimit: 100,
      });

      // Parse field filtering parameters
      const fieldsParam = (request.query as Record<string, unknown>).fields as string | undefined;
      const selectFields = buildSelectFields('incident', fieldsParam);

      // Build cache key
      const cacheKey = `incidents:list:status${query.status || 'all'}:monitor${query.monitorId || 'all'}:page${page}:fields${fieldsParam || 'standard'}`;
      
      // Check advanced cache first
      const cached = advancedCache.get('incidents', cacheKey);
      if (cached) {
        return cached;
      }

      // Calculate skip for pagination
      const skip = (page - 1) * limit;

      // Optimized query
      const incidents = await prisma.incident.findMany({
        where: {
          status: query.status,
          monitorId: query.monitorId,
        },
        select: selectFields,
        orderBy: { startedAt: "desc" },
        skip,
        take: limit,
      });

      // Get total count
      const totalCount = await prisma.incident.count({
        where: {
          status: query.status,
          monitorId: query.monitorId,
        },
      });

      // Build paginated response
      const response = buildPaginatedResponse(incidents, {
        page,
        limit,
        total: totalCount,
      });

      // Cache for 3 minutes
      advancedCache.set('incidents', cacheKey, response, 3 * 60 * 1000);

      return response;
    } catch (error) {
      log.error("Error fetching incidents:", error);
      return reply.code(500).send({ error: "Failed to fetch incidents" });
    }
  });

  // GET /incidents/list - Alternative endpoint
  fastify.get("/incidents/list", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request, reply) => {
    try {
      const query = incidentSchema.parse(request.query);
      
      // Parse pagination parameters
      const { page, limit } = getPaginationParams(request.query as PaginationQuery, {
        defaultLimit: 15,
        maxLimit: 100,
      });

      // Parse field filtering parameters
      const fieldsParam = (request.query as Record<string, unknown>).fields as string | undefined;
      const selectFields = buildSelectFields('incident', fieldsParam);

      // Build cache key
      const cacheKey = `incidents:list2:status${query.status || 'all'}:monitor${query.monitorId || 'all'}:page${page}:fields${fieldsParam || 'standard'}`;
      
      // Check advanced cache first
      const cached = advancedCache.get('incidents', cacheKey);
      if (cached) {
        return cached;
      }

      // Calculate skip for pagination
      const skip = (page - 1) * limit;

      // Optimized query
      const incidents = await prisma.incident.findMany({
        where: {
          status: query.status,
          monitorId: query.monitorId,
        },
        select: selectFields,
        orderBy: { startedAt: "desc" },
        skip,
        take: limit,
      });

      // Get total count
      const totalCount = await prisma.incident.count({
        where: {
          status: query.status,
          monitorId: query.monitorId,
        },
      });

      // Build paginated response
      const response = buildPaginatedResponse(incidents, {
        page,
        limit,
        total: totalCount,
      });

      // Cache for 3 minutes
      advancedCache.set('incidents', cacheKey, response, 3 * 60 * 1000);

      return response;
    } catch (error) {
      log.error("Error fetching incidents:", error);
      return reply.code(500).send({ error: "Failed to fetch incidents" });
    }
  });

  fastify.get("/incidents/:id", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request, reply) => {
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

  fastify.post("/incidents/:id/events", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request, reply) => {
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
  fastify.patch("/incidents/:id", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request, reply) => {
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
