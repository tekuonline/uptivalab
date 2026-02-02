import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { advancedCache } from "../utils/advanced-cache.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { log } from "../utils/logger.js";
import { RATE_LIMITS, createRateLimitOptions } from "../utils/rate-limits.js";

const authPlugin = async (fastify: FastifyInstance) => {
  // Check if any users exist (for setup flow)
  fastify.route({
    method: 'GET',
    url: '/auth/setup-needed',
    handler: async (request, reply) => {
      try {
        const userCount = await prisma.user.count();
        return { setupNeeded: userCount === 0 };
      } catch (error) {
        log.error("Failed to check user count", { error });
        return reply.code(500).send({
          error: "Database error",
          message: "Unable to check setup status"
        });
      }
    }
  });

  // Create first admin user (only works if no users exist)
  fastify.route({
    method: 'POST',
    url: '/auth/setup',
    config: {
      rateLimit: createRateLimitOptions(RATE_LIMITS.AUTH_REGISTER),
    },
    handler: async (request, reply) => {
      try {
        // Check if any users already exist
        const userCount = await prisma.user.count();
        if (userCount > 0) {
          return reply.code(403).send({
            error: "Setup already completed",
            message: "An admin user has already been created. Please log in instead."
          });
        }

        const body = z
          .object({
            email: z.string().email(),
            password: z.string().min(8)
          })
          .parse(request.body);

        const passwordHash = await hashPassword(body.password);

        const user = await prisma.user.create({
          data: {
            email: body.email,
            passwordHash,
            role: 'ADMIN'
          },
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true
          }
        });

        const token = fastify.jwt.sign({ userId: user.id, email: user.email });
        return { token, user };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: "Validation failed",
            message: "Invalid email format or password must be at least 8 characters",
            details: error.errors
          });
        }
        log.error("Failed to create admin user", { error });
        return reply.code(500).send({
          error: "Setup failed",
          message: "An unexpected error occurred during setup"
        });
      }
    }
  });

  // Public registration is disabled - users can only be created by admins
  fastify.route({
    method: 'POST',
    url: '/auth/register',
    config: {
      rateLimit: authRateLimit,
    },
    handler: async (request, reply) => {
      return reply.code(403).send({
        error: "Registration disabled",
        message: "Public registration is not allowed. Please contact an administrator to create an account."
      });
    }
  });

  fastify.route({
    method: 'POST',
    url: '/auth/login',
    config: {
      rateLimit: createRateLimitOptions(RATE_LIMITS.AUTH_LOGIN),
    },
    handler: async (request, reply) => {
      try {
        const body = z
          .object({ 
            email: z.string().email(), 
            password: z.string().min(8) 
          })
          .parse(request.body);

        const user = await prisma.user.findUnique({ where: { email: body.email } });
        
        if (!user) {
          return reply.code(403).send({ 
            error: "Authentication failed",
            message: "Invalid email or password" 
          });
        }

        const isPasswordValid = await verifyPassword(user.passwordHash, body.password);
        
        if (!isPasswordValid) {
          return reply.code(403).send({ 
            error: "Authentication failed",
            message: "Invalid email or password" 
          });
        }

        const token = fastify.jwt.sign({ userId: user.id, email: user.email });

        // Warm cache on login - pre-fetch user's monitors, incidents, channels
        // This ensures first few API calls hit cache instead of database
        try {
          advancedCache.warm('monitors', async () => {
            return await prisma.monitor.findMany({
              where: { userId: user.id },
              select: {
                id: true,
                name: true,
                kind: true,
                paused: true,
                createdAt: true,
              },
              orderBy: { createdAt: "desc" },
              take: 50, // Warm top 50
            });
          });

          advancedCache.warm('incidents', async () => {
            return await prisma.incident.findMany({
              where: { monitor: { userId: user.id } },
              select: {
                id: true,
                status: true,
                startedAt: true,
                monitorId: true,
              },
              orderBy: { startedAt: "desc" },
              take: 50,
            });
          });

          advancedCache.warm('notificationChannels', async () => {
            return await prisma.notificationChannel.findMany({
              where: { userId: user.id },
              select: {
                id: true,
                name: true,
                type: true,
              },
              orderBy: { createdAt: "desc" },
              take: 20,
            });
          });
        } catch (warmError) {
          log.warn("Cache warming failed during login", { error: warmError });
          // Don't fail login if cache warming fails
        }

        return { token, user: { id: user.id, email: user.email, role: user.role } };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ 
            error: "Validation failed",
            message: "Invalid email format or password must be at least 8 characters",
            details: error.errors 
          });
        }
        return reply.code(500).send({ 
          error: "Authentication failed",
          message: "An unexpected error occurred during login" 
        });
      }
    }
  });
};

export default fp(authPlugin);
