import prismaPkg from "@prisma/client";
const { PrismaClient } = prismaPkg;

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});
