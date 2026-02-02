import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { hashPassword } from "../auth/password.js";
import { log } from "../utils/logger.js";
import crypto from "crypto";

const invitationsPlugin = async (fastify: FastifyInstance) => {
  // Get all invitations (admin only)
  fastify.get("/invitations", {
    preHandler: fastify.authenticateAnyWithPermission('READ'),
    handler: async (request, reply) => {
      try {
        // @ts-expect-error - UserInvitation model exists in runtime Prisma Client
        const invitations = await prisma.userInvitation.findMany({
          where: {
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: {
            id: true,
            email: true,
            token: true,
            role: true,
            expiresAt: true,
            createdAt: true,
            createdBy: {
              select: {
                email: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        return invitations;
      } catch (error) {
        log.error("Failed to fetch invitations:", error);
        return reply.code(500).send({
          error: "Failed to fetch invitations",
          message: "An error occurred while fetching invitations",
        });
      }
    },
  });

  // Get invitation by ID (admin only)
  fastify.get("/invitations/:id", {
    preHandler: fastify.authenticateAnyWithPermission('READ'),
    handler: async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        // @ts-ignore - UserInvitation model exists in runtime Prisma Client
        const invitation = await prisma.userInvitation.findUnique({
          where: { id },
          select: {
            id: true,
            email: true,
            token: true,
            role: true,
            expiresAt: true,
            usedAt: true,
            createdAt: true,
            createdBy: {
              select: {
                email: true,
              },
            },
          },
        });

        if (!invitation) {
          return reply.code(404).send({
            error: "Invitation not found",
            message: "The requested invitation does not exist",
          });
        }

        return invitation;
      } catch (error) {
        log.error("Failed to fetch invitation:", error);
        return reply.code(500).send({
          error: "Failed to fetch invitation",
          message: "An error occurred while fetching the invitation",
        });
      }
    },
  });

  // Create invitation (admin only)
  fastify.post<{ Body: { email: string; role: "ADMIN" | "VIEWER"; expiresInDays?: number } }>(
    "/invitations",
    {
      preHandler: fastify.authenticateAnyWithPermission('WRITE'),
      handler: async (request, reply) => {
        try {
          const body = z
            .object({
              email: z.string().email(),
              role: z.enum(["ADMIN", "VIEWER"]).default("VIEWER"),
              expiresInDays: z.number().min(1).max(30).default(7),
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

          // Check for existing unused invitation
          const existingInvitation = await prisma.userInvitation.findFirst({
            where: {
              email: body.email,
              usedAt: null,
              expiresAt: { gt: new Date() },
            },
          });

          if (existingInvitation) {
            return reply.code(409).send({
              error: "Invitation already exists",
              message: "An active invitation for this email already exists",
            });
          }

          // Generate secure token
          const token = crypto.randomBytes(32).toString("hex");
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + body.expiresInDays);

          const user = request.user as { userId: string; email: string };
          const invitation = await prisma.userInvitation.create({
            data: {
              email: body.email,
              token,
              role: body.role,
              expiresAt,
              createdById: user.userId,
            },
            select: {
              id: true,
              email: true,
              token: true,
              role: true,
              expiresAt: true,
              createdAt: true,
            },
          });

          return invitation;
        } catch (error) {
          if (error instanceof z.ZodError) {
            return reply.code(400).send({
              error: "Validation failed",
              message: "Invalid email format or expiration days",
              details: error.errors,
            });
          }
          log.error("Failed to create invitation:", error);
          return reply.code(500).send({
            error: "Failed to create invitation",
            message: "An error occurred while creating the invitation",
          });
        }
      },
    }
  );

  // Delete invitation (admin only)
  fastify.delete<{ Params: { id: string } }>("/invitations/:id", {
    preHandler: fastify.authenticateAnyWithPermission('WRITE'),
    handler: async (request, reply) => {
      try {
        await prisma.userInvitation.delete({
          where: { id: request.params.id },
        });

        return { success: true };
      } catch (error) {
        log.error("Failed to delete invitation:", error);
        return reply.code(500).send({
          error: "Failed to delete invitation",
          message: "An error occurred while deleting the invitation",
        });
      }
    },
  });
};

// Public invitation routes (no authentication required)
const publicInvitationsPlugin = async (fastify: FastifyInstance) => {
  // Accept invitation (public)
  fastify.post<{ Body: { token: string; password: string } }>(
    "/invitations/accept",
    {
      handler: async (request, reply) => {
        const { token, password } = request.body;

        // Validate input
        if (!token || typeof token !== 'string') {
          return reply.code(400).send({
            error: "Validation failed",
            message: "Token is required",
          });
        }

        if (!password || typeof password !== 'string' || password.length < 8) {
          return reply.code(400).send({
            error: "Validation failed",
            message: "Password must be at least 8 characters",
          });
        }

        try {
          const invitation = await prisma.userInvitation.findUnique({
            where: { token },
          });

          if (!invitation) {
            return reply.code(404).send({
              error: "Invalid invitation",
              message: "This invitation link is invalid",
            });
          }

          if (invitation.usedAt) {
            return reply.code(400).send({
              error: "Invitation already used",
              message: "This invitation has already been used",
            });
          }

          if (invitation.expiresAt < new Date()) {
            return reply.code(400).send({
              error: "Invitation expired",
              message: "This invitation has expired",
            });
          }

          // Check if user already exists
          const existingUser = await prisma.user.findUnique({
            where: { email: invitation.email },
          });

          if (existingUser) {
            return reply.code(400).send({
              error: "User already exists",
              message: "A user with this email already exists",
            });
          }

          // Create user and mark invitation as used in a transaction
          const passwordHash = await hashPassword(password);

          const user = await prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
              data: {
                email: invitation.email,
                passwordHash,
                role: invitation.role,
              },
            });

            await tx.userInvitation.update({
              where: { id: invitation.id },
              data: { usedAt: new Date() },
            });

            return newUser;
          });

          // Generate JWT token
          const jwtToken = fastify.jwt.sign({
            userId: user.id,
            email: user.email,
          });

          return {
            token: jwtToken,
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
            },
          };
        } catch (error) {
          log.error("Failed to accept invitation:", error);
          return reply.code(500).send({
            error: "Failed to accept invitation",
            message: "An error occurred while accepting the invitation",
          });
        }
      },
    }
  );

  // Verify invitation token (public)
  fastify.get<{ Params: { token: string } }>("/invitations/verify/:token", {
    handler: async (request, reply) => {
      try {
        const invitation = await prisma.userInvitation.findUnique({
          where: { token: request.params.token },
          select: {
            email: true,
            role: true,
            expiresAt: true,
            usedAt: true,
          },
        });

        if (!invitation) {
          return reply.code(404).send({
            error: "Invalid invitation",
            message: "This invitation link is invalid",
          });
        }

        if (invitation.usedAt) {
          return reply.code(400).send({
            error: "Invitation already used",
            message: "This invitation has already been used",
          });
        }

        if (invitation.expiresAt < new Date()) {
          return reply.code(400).send({
            error: "Invitation expired",
            message: "This invitation has expired",
          });
        }

        return {
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
        };
      } catch (error) {
        log.error("Failed to verify invitation:", error);
        return reply.code(500).send({
          error: "Failed to verify invitation",
          message: "An error occurred while verifying the invitation",
        });
      }
    },
  });
};

export default fp(invitationsPlugin);
export const publicInvitations = fp(publicInvitationsPlugin);
