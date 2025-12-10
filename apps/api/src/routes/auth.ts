import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { hashPassword, verifyPassword } from "../auth/password.js";

const authPlugin = async (fastify: FastifyInstance) => {
  // Explicitly skip authentication for auth routes by creating a child context
  fastify.route({
    method: 'POST',
    url: '/auth/register',
    handler: async (request, reply) => {
      const body = z
        .object({
          email: z.string().email(),
          password: z.string().min(8),
        })
        .parse(request.body);

      const exists = await prisma.user.findUnique({ where: { email: body.email } });
      if (exists) {
        return reply.code(409).send({ message: "User already exists" });
      }

      const user = await prisma.user.create({
        data: {
          email: body.email,
          passwordHash: await hashPassword(body.password),
        },
      });

      const token = fastify.jwt.sign({ userId: user.id, email: user.email });
      return { token, user: { id: user.id, email: user.email, role: user.role } };
    }
  });

  fastify.route({
    method: 'POST',
    url: '/auth/login',
    handler: async (request, reply) => {
      const body = z
        .object({ email: z.string().email(), password: z.string().min(8) })
        .parse(request.body);

      const user = await prisma.user.findUnique({ where: { email: body.email } });
      if (!user || !(await verifyPassword(user.passwordHash, body.password))) {
        return reply.code(401).send({ message: "Invalid credentials" });
      }
      const token = fastify.jwt.sign({ userId: user.id, email: user.email });
      return { token, user: { id: user.id, email: user.email, role: user.role } };
    }
  });
};

export default fp(authPlugin);
