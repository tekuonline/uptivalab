import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { hashPassword, verifyPassword } from "../auth/password.js";

const authPlugin = async (fastify: FastifyInstance) => {
  // Public registration is disabled - users can only be created by admins
  fastify.route({
    method: 'POST',
    url: '/auth/register',
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
