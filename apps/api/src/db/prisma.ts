import prismaPkg from "@prisma/client";
import { log } from "../utils/logger.js";

const { PrismaClient } = prismaPkg;

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

// Add slow query detection and logging
prisma.$use(async (params, next) => {
  const start = Date.now();
  const result = await next(params);
  const duration = Date.now() - start;
  
  // Log queries that take >100ms (potential performance issues)
  if (duration > 100) {
    log.warn(
      `⏱️  SLOW QUERY (${duration}ms): ${params.model}.${params.action}`,
      params.args?.where ? JSON.stringify(params.args.where) : ''
    );
  }
  
  // Log very slow queries (>500ms) as errors
  if (duration > 500) {
    log.error(
      `🔴 VERY SLOW QUERY (${duration}ms): ${params.model}.${params.action}`,
      params.args?.where ? JSON.stringify(params.args.where) : ''
    );
  }
  
  return result;
});
