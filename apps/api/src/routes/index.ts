import type { FastifyInstance } from "fastify";

export const registerRoutes = async (fastify: FastifyInstance) => {
  // Register auth routes (public)
  const { default: authRoutes } = await import("./auth.js");
  await fastify.register(authRoutes);

  // Register robots.txt route (public)
  const { default: robotsRoutes } = await import("./robots.js");
  await fastify.register(robotsRoutes);

  // Register status routes (public)
  const { default: statusRoutes } = await import("./status.js");
  await fastify.register(statusRoutes);

  // Register monitors routes (authenticated)
  const { default: monitorsRoutes } = await import("./monitors.js");
  await fastify.register(monitorsRoutes);
};