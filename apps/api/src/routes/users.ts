import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { hashPassword } from "../auth/password.js";

const usersPlugin = async (fastify: FastifyInstance) => {
  // Get all users (admin only)
  fastify.get("/users", {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const users = await prisma.user.findMany({
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                apiKeys: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        return users;
      } catch (error) {
        console.error("Failed to fetch users:", error);
        return reply.code(500).send({
          error: "Failed to fetch users",
          message: "An error occurred while fetching users",
        });
      }
    },
  });

  // Create user (admin only)
  fastify.post<{ Body: { email: string; password: string; role: "ADMIN" | "VIEWER" } }>(
    "/users",
    {
      onRequest: [fastify.authenticate],
      handler: async (request, reply) => {
        try {
          const body = z
            .object({
              email: z.string().email(),
              password: z.string().min(8),
              role: z.enum(["ADMIN", "VIEWER"]).default("VIEWER"),
            })
            .parse(request.body);

          // Check if user already exists
          const existingUser = await prisma.user.findUnique({
            where: { email: body.email },
          });

          if (existingUser) {
            return reply.code(409).send({
              error: "User already exists",
              message: "A user with this email address already exists",
            });
          }

          // Create user
          const passwordHash = await hashPassword(body.password);
          const user = await prisma.user.create({
            data: {
              email: body.email,
              passwordHash,
              role: body.role,
            },
            select: {
              id: true,
              email: true,
              role: true,
              createdAt: true,
            },
          });

          return user;
        } catch (error) {
          if (error instanceof z.ZodError) {
            return reply.code(400).send({
              error: "Validation failed",
              message: "Invalid email format or password must be at least 8 characters",
              details: error.errors,
            });
          }
          console.error("Failed to create user:", error);
          return reply.code(500).send({
            error: "Failed to create user",
            message: "An error occurred while creating the user",
          });
        }
      },
    }
  );

  // Update user role (admin only)
  fastify.put<{ Params: { id: string }; Body: { role: "ADMIN" | "VIEWER" } }>(
    "/users/:id/role",
    {
      onRequest: [fastify.authenticate],
      handler: async (request, reply) => {
        try {
          const body = z
            .object({
              role: z.enum(["ADMIN", "VIEWER"]),
            })
            .parse(request.body);

          const user = await prisma.user.update({
            where: { id: request.params.id },
            data: { role: body.role },
            select: {
              id: true,
              email: true,
              role: true,
              updatedAt: true,
            },
          });

          return user;
        } catch (error) {
          if (error instanceof z.ZodError) {
            return reply.code(400).send({
              error: "Validation failed",
              message: "Invalid role specified",
              details: error.errors,
            });
          }
          console.error("Failed to update user role:", error);
          return reply.code(500).send({
            error: "Failed to update user",
            message: "An error occurred while updating the user role",
          });
        }
      },
    }
  );

  // Delete user (admin only)
  fastify.delete<{ Params: { id: string } }>("/users/:id", {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        // Prevent deleting yourself
        const user = request.user as { userId: string; email: string } | undefined;
        if (user?.userId === request.params.id) {
          return reply.code(400).send({
            error: "Cannot delete yourself",
            message: "You cannot delete your own account",
          });
        }

        // Check if this is the last admin
        const adminCount = await prisma.user.count({
          where: { role: "ADMIN" },
        });

        const userToDelete = await prisma.user.findUnique({
          where: { id: request.params.id },
        });

        if (userToDelete?.role === "ADMIN" && adminCount <= 1) {
          return reply.code(400).send({
            error: "Cannot delete last admin",
            message: "You cannot delete the last admin user",
          });
        }

        await prisma.user.delete({
          where: { id: request.params.id },
        });

        return { success: true };
      } catch (error) {
        console.error("Failed to delete user:", error);
        return reply.code(500).send({
          error: "Failed to delete user",
          message: "An error occurred while deleting the user",
        });
      }
    },
  });
};

export default fp(usersPlugin);
