import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { log } from "../utils/logger.js";
import { advancedCache } from "../utils/advanced-cache.js";
import { getPaginationParams, buildPaginatedResponse } from "../utils/pagination.js";
import { buildSelectFields } from "../utils/field-filtering.js";

const windowSchema = z.object({
  name: z.string(),
  startsAt: z.string().transform((value) => new Date(value)),
  endsAt: z.string().transform((value) => new Date(value)),
  monitorIds: z.array(z.string()).min(1),
});

const maintenancePlugin = async (fastify: FastifyInstance) => {

  // GET /maintenance - List all maintenance windows with pagination & field filtering
  fastify.get("/maintenance", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request, reply) => {
    try {
      // Parse pagination parameters
      const { page, limit } = getPaginationParams(request.query as any, {
        defaultLimit: 20,
        maxLimit: 100,
      });

      // Parse field filtering parameters
      const fieldsParam = (request.query as any).fields as string | undefined;
      const selectFields = buildSelectFields('maintenanceWindow', fieldsParam);

      // Build cache key
      const cacheKey = `maintenance:list:page${page}:limit${limit}:fields${fieldsParam || 'standard'}`;
      
      // Check advanced cache first
      const cached = advancedCache.get('maintenanceWindows', cacheKey);
      if (cached) {
        return cached;
      }

      // Calculate skip for pagination
      const skip = (page - 1) * limit;

      // Optimized query
      const windows = await prisma.maintenanceWindow.findMany({
        select: selectFields,
        orderBy: { startsAt: "desc" },
        skip,
        take: limit,
      });

      // Get total count
      const totalCount = await prisma.maintenanceWindow.count();

      // Build paginated response
      const response = buildPaginatedResponse(windows, {
        page,
        limit,
        total: totalCount,
      });

      // Cache for 5 minutes
      advancedCache.set('maintenanceWindows', cacheKey, response, 5 * 60 * 1000);

      return response;
    } catch (error) {
      log.error("Error fetching maintenance windows:", error);
      return reply.code(500).send({ error: "Failed to fetch maintenance windows" });
    }
  });

  // GET /maintenance/list - Alternative endpoint
  fastify.get("/maintenance/list", { preHandler: fastify.authenticateAnyWithPermission('READ') }, async (request, reply) => {
    try {
      // Parse pagination parameters
      const { page, limit } = getPaginationParams(request.query as any, {
        defaultLimit: 20,
        maxLimit: 100,
      });

      // Parse field filtering parameters
      const fieldsParam = (request.query as any).fields as string | undefined;
      const selectFields = buildSelectFields('maintenanceWindow', fieldsParam);

      // Build cache key
      const cacheKey = `maintenance:list2:page${page}:limit${limit}:fields${fieldsParam || 'standard'}`;
      
      // Check advanced cache first
      const cached = advancedCache.get('maintenanceWindows', cacheKey);
      if (cached) {
        return cached;
      }

      // Calculate skip for pagination
      const skip = (page - 1) * limit;

      // Optimized query
      const windows = await prisma.maintenanceWindow.findMany({
        select: selectFields,
        orderBy: { startsAt: "desc" },
        skip,
        take: limit,
      });

      // Get total count
      const totalCount = await prisma.maintenanceWindow.count();

      // Build paginated response
      const response = buildPaginatedResponse(windows, {
        page,
        limit,
        total: totalCount,
      });

      // Cache for 5 minutes
      advancedCache.set('maintenanceWindows', cacheKey, response, 5 * 60 * 1000);

      return response;
    } catch (error) {
      log.error("Error fetching maintenance windows:", error);
      return reply.code(500).send({ error: "Failed to fetch maintenance windows" });
    }
  });

  fastify.post("/maintenance", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request) => {
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

  fastify.put("/maintenance/:id", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request) => {
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

  fastify.delete("/maintenance/:id", { preHandler: fastify.authenticateAnyWithPermission('WRITE') }, async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    await prisma.maintenanceWindow.delete({ where: { id: params.id } });
    reply.code(204).send();
  });
};

export default fp(maintenancePlugin);
